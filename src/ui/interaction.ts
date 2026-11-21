// Game controller: holds the GameState and the interaction mode, wires renderer and UI together.
import { applyAction, type Action } from '../core/actions';
import { hexEquals, type Hex } from '../core/hex';
import { terrainAt, tileIndex } from '../core/map';
import {
  assignWorkers,
  canAfford,
  checkPlacement,
  connectedBuildingIds,
  missingGoods,
  planRoad,
  previewProduction,
  validPlacements,
  type BuildingStatus,
} from '../core/rules';
import type { GameState } from '../core/state';
import { BUILDINGS, economyConfig, type BuildingId, type Stock } from '../data';
import { en } from '../i18n/en';
import { fill, formatError, formatGoods, formatMissing, formatRoadTiles } from '../i18n/format';
import { createRenderer } from '../render/app';
import {
  createBottomBar,
  createBuildMenu,
  createConfirmSheet,
  createModeBanner,
  createResourceBar,
  createSeedLabel,
  createTileInfoPanel,
  createToast,
  perTurnText,
} from './index';

const PLAYER = 0;

type Mode =
  | { kind: 'idle' }
  | { kind: 'placing'; building: BuildingId }
  | { kind: 'roadStart' }
  | { kind: 'roadEnd'; from: Hex };

/** Creates the renderer and all UI components and runs the interaction. Rejects on renderer errors. */
export async function createGame(
  appContainer: HTMLElement,
  uiContainer: HTMLElement,
  initialState: GameState,
): Promise<void> {
  let state = initialState;
  let mode: Mode = { kind: 'idle' };
  let selected: Hex | null = null;
  let statuses: Record<number, BuildingStatus> = {};
  let menuOpen = false;

  // Seed label first: later elements stack above it.
  createSeedLabel(uiContainer, state.seedText);

  const renderer = await createRenderer(appContainer, state, (h) => onTileTap(h));
  const toast = createToast(uiContainer);
  const resourceBar = createResourceBar(uiContainer);
  const banner = createModeBanner(uiContainer, () => resetToIdle());
  const confirm = createConfirmSheet(uiContainer);
  const panel = createTileInfoPanel(uiContainer, () => {
    selected = null;
    renderer.selectTile(null);
  });
  const menu = createBuildMenu(uiContainer, {
    onPick: (id) => startPlacing(id),
    onClose: () => {
      menuOpen = false;
      if (mode.kind === 'idle') bottomBar.setMode('idle');
    },
  });
  const bottomBar = createBottomBar(uiContainer, {
    onBuild: () => {
      if (menuOpen || mode.kind === 'placing') {
        resetToIdle();
        return;
      }
      resetToIdle();
      panel.hide();
      menuOpen = true;
      bottomBar.setMode('build');
      menu.open(stockOf(state));
    },
    onRoad: () => {
      if (mode.kind === 'roadStart' || mode.kind === 'roadEnd') {
        resetToIdle();
        return;
      }
      resetToIdle();
      mode = { kind: 'roadStart' };
      bottomBar.setMode('road');
      banner.show(en.flow.roadStartPrompt);
    },
    onEndTurn: () => {
      resetToIdle();
      commit({ type: 'endTurn' });
    },
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mode.kind !== 'idle') resetToIdle();
  });

  function stockOf(s: GameState): Stock {
    const player = s.players.find((p) => p.id === PLAYER);
    if (!player) throw new Error('Player 0 missing');
    return player.goods;
  }

  /** Back to idle: no mode, highlights, preview, banner, sheets, menu or selection. */
  function resetToIdle(): void {
    mode = { kind: 'idle' };
    menuOpen = false;
    menu.close();
    confirm.hide();
    banner.hide();
    renderer.setHighlights([]);
    renderer.setPathPreview(null);
    bottomBar.setMode('idle');
    selected = null;
    renderer.selectTile(null);
    panel.hide();
  }

  function refresh(): void {
    statuses = {};
    for (const report of previewProduction(state, PLAYER).buildings) {
      statuses[report.buildingId] = report.status;
    }
    renderer.setState(state, statuses);
    resourceBar.update(
      stockOf(state),
      state.lastReport?.delta ?? null,
      state.turn,
      economyConfig.turnLimit,
    );
    bottomBar.setTurn(state.turn);
    if (mode.kind === 'idle') showPanel();
  }

  /** Applies an action; on success stores the state and refreshes, otherwise shows the error. */
  function commit(action: Action): boolean {
    const result = applyAction(state, action);
    if (!result.ok) {
      toast.show(formatError(result.error), 'error');
      return false;
    }
    state = result.state;
    refresh();
    return true;
  }

  function buildingAt(h: Hex): GameState['buildings'][number] | undefined {
    return state.buildings.find((b) => b.owner === PLAYER && hexEquals(b.hex, h));
  }

  function hasRoad(h: Hex): boolean {
    const i = tileIndex(state.map, h);
    return i >= 0 && state.roads[i] === true;
  }

  /** Shows the panel for the selected tile (or hides it if nothing is selected). */
  function showPanel(): void {
    if (!selected) {
      panel.hide();
      return;
    }
    const hex = selected;
    const terrain = terrainAt(state.map, hex);
    if (!terrain) {
      panel.hide();
      return;
    }
    const building = buildingAt(hex);
    if (building) {
      const def = BUILDINGS[building.type];
      const assigned = assignWorkers(state, PLAYER, connectedBuildingIds(state, PLAYER));
      panel.showBuilding({
        hex,
        terrain,
        type: building.type,
        status: statuses[building.id] ?? { kind: 'noProduction' },
        workers: { assigned: assigned[building.id] ?? 0, needed: def.workers },
        onDemolish:
          building.type === 'cityCenter'
            ? undefined
            : () =>
                askDemolish(
                  fill(en.flow.demolishConfirmTitle, { building: en.buildings[building.type] }),
                  fill(en.flow.demolished, { building: en.buildings[building.type] }),
                  hex,
                ),
      });
    } else if (hasRoad(hex)) {
      panel.showRoad({
        hex,
        terrain,
        onDemolish: () =>
          askDemolish(en.flow.roadDemolishConfirmTitle, en.flow.roadDemolished, hex),
      });
    } else {
      panel.showTerrain(hex, terrain);
    }
  }

  function askDemolish(title: string, doneText: string, hex: Hex): void {
    panel.hide();
    confirm.show({
      title,
      lines: [en.flow.demolishNoRefund],
      confirmLabel: en.ui.demolish,
      danger: true,
      onConfirm: () => {
        if (commit({ type: 'demolish', hex })) {
          toast.show(doneText);
          selected = null;
          renderer.selectTile(null);
          panel.hide();
        } else {
          showPanel();
        }
      },
      onCancel: () => showPanel(),
    });
  }

  function startPlacing(id: BuildingId): void {
    menuOpen = false;
    menu.close();
    mode = { kind: 'placing', building: id };
    renderer.setHighlights(validPlacements(state, PLAYER, id));
    banner.show(fill(en.flow.placePrompt, { building: en.buildings[id] }));
    bottomBar.setMode('build');
  }

  function onTileTap(hex: Hex | null): void {
    // A tap on the map closes any open sheet or menu and counts as a fresh tap.
    // Cancel path: a build confirm sheet clears the selection marker on cancel.
    confirm.cancel();
    renderer.setPathPreview(null);
    if (menuOpen) {
      menuOpen = false;
      menu.close();
      bottomBar.setMode('idle');
    }
    switch (mode.kind) {
      case 'idle':
        tapIdle(hex);
        break;
      case 'placing':
        if (hex) tapPlacing(mode.building, hex);
        break;
      case 'roadStart':
        if (hex) tapRoadStart(hex);
        break;
      case 'roadEnd':
        if (hex) tapRoadEnd(mode.from, hex);
        break;
    }
  }

  function tapIdle(hex: Hex | null): void {
    selected = hex && !(selected && hexEquals(selected, hex)) ? hex : null;
    renderer.selectTile(selected);
    showPanel();
  }

  function tapPlacing(id: BuildingId, hex: Hex): void {
    const error = checkPlacement(state, PLAYER, id, hex);
    if (error) {
      selected = null;
      renderer.selectTile(null);
      toast.show(formatError(error), 'error');
      return;
    }
    const def = BUILDINGS[id];
    selected = hex;
    renderer.selectTile(hex);
    const lines = [`${en.ui.cost}: ${formatGoods(def.cost) || '–'}`];
    const perTurn = perTurnText(id);
    if (perTurn) lines.push(perTurn);
    confirm.show({
      title: fill(en.flow.buildConfirmTitle, { building: en.buildings[id] }),
      lines,
      confirmLabel: en.ui.build,
      onConfirm: () => {
        if (commit({ type: 'build', building: id, hex })) {
          toast.show(fill(en.flow.built, { building: en.buildings[id] }));
          resetToIdle();
        } else {
          selected = null;
          renderer.selectTile(null);
        }
      },
      onCancel: () => {
        selected = null;
        renderer.selectTile(null);
      },
    });
  }

  function tapRoadStart(hex: Hex): void {
    const result = planRoad(state, PLAYER, hex, hex);
    if (!result.ok) {
      toast.show(formatError(result.error), 'error');
      return;
    }
    mode = { kind: 'roadEnd', from: hex };
    renderer.setHighlights([hex]);
    banner.show(en.flow.roadEndPrompt);
  }

  function tapRoadEnd(from: Hex, to: Hex): void {
    const result = planRoad(state, PLAYER, from, to);
    if (!result.ok) {
      toast.show(formatError(result.error), 'error');
      return;
    }
    const { plan } = result;
    renderer.setPathPreview(plan.path, plan.newTiles);
    const stock = stockOf(state);
    let disabledReason: string | undefined;
    if (plan.newTiles.length === 0) disabledReason = en.flow.roadNothingNew;
    else if (!canAfford(stock, plan.cost)) {
      disabledReason = formatMissing(missingGoods(stock, plan.cost));
    }
    confirm.show({
      title: en.flow.roadConfirmTitle,
      lines: [
        formatRoadTiles(plan.newTiles.length),
        `${en.ui.cost}: ${formatGoods(plan.cost) || '–'}`,
      ],
      confirmLabel: en.ui.build,
      disabledReason,
      onConfirm: () => {
        if (commit({ type: 'buildRoad', from, to })) {
          toast.show(en.flow.roadBuilt);
          resetToIdle();
        } else {
          renderer.setPathPreview(null);
        }
      },
      onCancel: () => renderer.setPathPreview(null),
    });
  }

  refresh();
}
