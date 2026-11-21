// Game controller: holds the GameState and the interaction mode, wires renderer and UI together.
import { applyAction, type Action } from '../core/actions';
import { hexEquals, type Hex } from '../core/hex';
import { terrainAt, tileIndex } from '../core/map';
import { TERRAIN, type TerrainId } from '../data/terrain';
import {
  advanceCheck,
  attackTargets,
  checkFoundCity,
  combatPreview,
  isVisible,
  reachableTiles,
  unitAt,
  assignWorkers,
  canAfford,
  canTrade,
  cityIdOf,
  cityStats,
  housing,
  checkPlacement,
  connectedBuildingIds,
  missingGoods,
  ownerAt,
  planRoad,
  previewProduction,
  runProduction,
  territoryGain,
  validPlacements,
  type BuildingStatus,
} from '../core/rules';
import type { GameState, Unit } from '../core/state';
import {
  BUILDING_IDS,
  BUILDINGS,
  CITY_LEVELS,
  economyConfig,
  type BuildingId,
  type CityLevel,
  type GoodId,
  type Stock,
  type UnitId,
} from '../data';
import { en } from '../i18n/en';
import {
  fill,
  formatAdvanced,
  formatAdvanceTo,
  formatAttacked,
  formatBought,
  formatError,
  formatGoods,
  formatMissing,
  formatRoadTiles,
  formatSold,
  formatTerritoryGain,
} from '../i18n/format';
import { createRenderer } from '../render/app';
import { buildOptionsFor } from './buildOptions';
import {
  createBottomBar,
  createBuildMenu,
  createConfirmSheet,
  createModeBanner,
  createResourceBar,
  createSeedLabel,
  createTileInfoPanel,
  createToast,
  attackPreviewLines,
  perTurnText,
  trainOptions,
  turnSummary,
} from './index';

const PLAYER = 0;

type Mode =
  | { kind: 'idle' }
  | { kind: 'placing'; building: BuildingId }
  | { kind: 'roadStart' }
  | { kind: 'roadEnd'; from: Hex }
  | { kind: 'unit'; unitId: number };

/** Creates the renderer and all UI components and runs the interaction. Rejects on renderer errors. */
export async function createGame(
  appContainer: HTMLElement,
  uiContainer: HTMLElement,
  initialState: GameState,
  testMode = false,
): Promise<void> {
  let state = initialState;
  let mode: Mode = { kind: 'idle' };
  let selected: Hex | null = null;
  let statuses: Record<number, BuildingStatus> = {};
  let menuOpen = false;
  // A unit stands on the selected building tile and the player asked for the building panel.
  let preferBuilding = false;

  // Seed label first: later elements stack above it.
  createSeedLabel(uiContainer, state.seedText, testMode);

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
      menu.open(stockOf(state), highestLevel(state));
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
    onUnits: () => {
      if (mode.kind === 'unit') {
        resetToIdle();
        return;
      }
      selectNextUnit();
    },
    onEndTurn: () => {
      resetToIdle();
      endTurn();
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

  function highestLevel(s: GameState): CityLevel {
    let best = 0;
    for (const c of s.cities) {
      if (c.owner === PLAYER) best = Math.max(best, CITY_LEVELS.indexOf(c.level));
    }
    return CITY_LEVELS[best];
  }

  /** Ids of the player's cities that can advance right now. */
  function readyCities(s: GameState): Set<number> {
    const ready = new Set<number>();
    for (const c of s.cities) {
      if (c.owner === PLAYER && advanceCheck(s, c.id)?.canAdvance) ready.add(c.id);
    }
    return ready;
  }

  /** Ends the turn and shows one toast with the news of the turn. */
  function endTurn(): void {
    const readyBefore = readyCities(state);
    const unitsBefore = new Set(ownUnits().map((u) => u.id));
    if (!commit({ type: 'endTurn' })) return;
    const report = state.lastReport;
    if (!report) return;
    const canAdvance: Record<number, CityLevel> = {};
    const supply: Record<number, { good: GoodId; turnsNeeded: number }> = {};
    for (const c of state.cities) {
      if (c.owner !== PLAYER) continue;
      const check = advanceCheck(state, c.id);
      if (!check) continue;
      if (check.to && check.canAdvance && !readyBefore.has(c.id)) canAdvance[c.id] = check.to;
      supply[c.id] = { good: check.supply.good, turnsNeeded: check.supply.turns };
    }
    const spawnedUnits = ownUnits()
      .filter((u) => !unitsBefore.has(u.id))
      .map((u) => u.type);
    const lines = turnSummary(report, { canAdvance, supply, spawnedUnits });
    if (lines.length === 0) return;
    const isError = lines.some((l) => l.kind === 'error');
    toast.show(
      lines.map((l) => l.text).join('\n'),
      isError ? 'error' : 'info',
      3000 + 1000 * (lines.length - 1),
    );
  }

  /** Back to idle: no mode, highlights, preview, banner, sheets, menu or selection. */
  function resetToIdle(): void {
    mode = { kind: 'idle' };
    menuOpen = false;
    menu.close();
    confirm.hide();
    banner.hide();
    renderer.setHighlights([]);
    renderer.setAttackTargets([]);
    renderer.setPathPreview(null);
    bottomBar.setMode('idle');
    selected = null;
    preferBuilding = false;
    renderer.selectTile(null);
    panel.hide();
  }

  /** Residents and housing summed over the player's cities. */
  function people(): { residents: number; housing: number } {
    let residents = 0;
    let housingSum = 0;
    for (const c of state.cities) {
      if (c.owner !== PLAYER) continue;
      residents += c.residents;
      housingSum += housing(state, c.id);
    }
    return { residents, housing: housingSum };
  }

  function refresh(): void {
    statuses = {};
    for (const report of previewProduction(state, PLAYER).buildings) {
      statuses[report.buildingId] = report.status;
    }
    renderer.setState(state, statuses, PLAYER);
    resourceBar.update(
      stockOf(state),
      state.lastReport?.delta ?? null,
      state.turn,
      economyConfig.turnLimit,
      people(),
    );
    bottomBar.setTurn(state.turn);
    bottomBar.setUnitsEnabled(ownUnits().length > 0);
    if (mode.kind === 'idle') showPanel();
    else if (mode.kind === 'unit') refreshUnitMode();
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
    const unit = unitAt(state, hex);
    if (unit && unit.owner === PLAYER && !preferBuilding) {
      showUnitPanel(unit);
      return;
    }
    if (unit && unit.owner !== PLAYER && isVisible(state, PLAYER, hex)) {
      showUnitPanel(unit);
      return;
    }
    const building = buildingAt(hex);
    if (building?.type === 'cityCenter') {
      const cityId = cityIdOf(state, building);
      const city = state.cities.find((c) => c.id === cityId);
      const check = advanceCheck(state, cityId);
      if (city && check) {
        // Residents eat after this turn's production, so judge food, needs and taxes
        // against the stock as it will be after production (a copy – the real state stays).
        const afterProduction = structuredClone(state);
        runProduction(afterProduction, PLAYER);
        panel.showCity({
          hex,
          terrain,
          level: city.level,
          stats: cityStats(afterProduction, cityId),
          check,
          stock: stockOf(afterProduction),
          onAdvance: check.to ? () => askAdvance(cityId) : undefined,
        });
        return;
      }
    }
    if (building) {
      const def = BUILDINGS[building.type];
      const assigned = assignWorkers(state, PLAYER, connectedBuildingIds(state, PLAYER));
      panel.showBuilding({
        hex,
        terrain,
        type: building.type,
        status: statuses[building.id] ?? { kind: 'noProduction' },
        workers: { assigned: assigned[building.id] ?? 0, needed: def.workers },
        paused: building.paused,
        onTogglePause: () => {
          const name = en.buildings[building.type];
          if (commit({ type: 'togglePause', hex })) {
            toast.show(
              fill(building.paused ? en.flow.resumed : en.flow.paused, { building: name }),
            );
          }
        },
        trade:
          building.type === 'marketplace'
            ? {
                enabled: canTrade(state, PLAYER),
                stock: stockOf(state),
                onSell: (good) => {
                  const { sellAmount, sellPrice } = economyConfig.market;
                  if (commit({ type: 'trade', good, direction: 'sell', lots: 1 })) {
                    toast.show(formatSold(good, sellAmount, sellPrice));
                  }
                },
                onBuy: (good) => {
                  if (commit({ type: 'trade', good, direction: 'buy', lots: 1 })) {
                    toast.show(formatBought(good, 1, economyConfig.market.buyPrice));
                  }
                },
              }
            : undefined,
        train: building.type === 'barracks' ? trainInfo(building) : undefined,
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
      showEmptyTile(hex, terrain);
    }
  }

  function ownUnits(): Unit[] {
    return state.units.filter((u) => u.owner === PLAYER);
  }

  function isExplored(h: Hex): boolean {
    const i = tileIndex(state.map, h);
    const player = state.players.find((p) => p.id === PLAYER);
    return i >= 0 && player?.explored[i] === true;
  }

  /** Training list of a barracks, from its city's level, residents and the player's goods. */
  function trainInfo(building: GameState['buildings'][number]): {
    options: ReturnType<typeof trainOptions>;
    pending: UnitId | null;
    onTrain(id: UnitId): void;
  } {
    const city = state.cities.find((c) => c.id === cityIdOf(state, building));
    return {
      options: trainOptions({
        cityLevel: city?.level ?? 'settlement',
        residents: city?.residents ?? 0,
        stock: stockOf(state),
      }),
      pending: state.training.find((t) => t.barracksId === building.id)?.unit ?? null,
      onTrain: (id) => {
        if (commit({ type: 'train', barracksId: building.id, unit: id })) {
          toast.show(fill(en.flow.trainOrdered, { unit: en.units[id] }));
        }
      },
    };
  }

  /** Unit panel; own settlers get the "Found city here" button. */
  function showUnitPanel(unit: Unit): void {
    const terrain = terrainAt(state.map, unit.hex);
    if (!terrain) return;
    const own = unit.owner === PLAYER;
    let found: { ok: boolean; reason?: string; onFound(): void } | undefined;
    if (own && unit.type === 'settler') {
      const error = checkFoundCity(state, PLAYER, unit.id);
      found = {
        ok: error === null,
        reason: error ? formatError(error) : undefined,
        onFound: () => foundHere(unit),
      };
    }
    panel.showUnit({ hex: unit.hex, terrain, unit, own, found });
  }

  function foundHere(unit: Unit): void {
    const hex = unit.hex;
    leaveUnitMode();
    selected = hex;
    preferBuilding = false;
    renderer.selectTile(hex);
    if (commit({ type: 'foundCity', unitId: unit.id })) {
      toast.show(en.flow.cityFounded);
    }
  }

  /** Can the unit still do something this turn (a reachable tile or an attack target)? */
  function canAct(unit: Unit): boolean {
    if (!unit.attacked && unit.movesLeft > 0 && reachableTiles(state, unit.id).length > 0) {
      return true;
    }
    return attackTargets(state, unit.id).some((t) => isVisible(state, PLAYER, t.hex));
  }

  /** Units button: the next own unit (by id, after the current one, wrapping) that can still act. */
  function selectNextUnit(): void {
    const current = selected ? unitAt(state, selected) : undefined;
    const currentId = current?.owner === PLAYER ? current.id : -1;
    const sorted = ownUnits().sort((a, b) => a.id - b.id);
    const ordered = [
      ...sorted.filter((u) => u.id > currentId),
      ...sorted.filter((u) => u.id <= currentId),
    ];
    const next = ordered.find(canAct);
    resetToIdle();
    if (!next) {
      toast.show(en.unitText.allDone);
      return;
    }
    renderer.centerOn(next.hex);
    enterUnitMode(next);
  }

  function enterUnitMode(unit: Unit): void {
    resetToIdle();
    mode = { kind: 'unit', unitId: unit.id };
    selected = unit.hex;
    preferBuilding = false;
    renderer.selectTile(unit.hex);
    bottomBar.setMode('units');
    refreshUnitMode();
  }

  /** Leaves unit mode but keeps the selection (highlights and targets are cleared). */
  function leaveUnitMode(): void {
    mode = { kind: 'idle' };
    renderer.setHighlights([]);
    renderer.setAttackTargets([]);
    bottomBar.setMode('idle');
  }

  /** Redraws panel, highlights and red targets of the selected unit after any change. */
  function refreshUnitMode(): void {
    if (mode.kind !== 'unit') return;
    const unitId = mode.unitId;
    const unit = state.units.find((u) => u.id === unitId && u.owner === PLAYER);
    if (!unit) {
      resetToIdle();
      return;
    }
    selected = unit.hex;
    renderer.selectTile(unit.hex);
    if (!canAct(unit)) {
      // Nothing left to do: back to idle, the unit stays selected ("Done for this turn").
      leaveUnitMode();
      showPanel();
      return;
    }
    renderer.setHighlights(reachableTiles(state, unit.id).map((r) => r.hex));
    renderer.setAttackTargets(visibleTargets(unit).map((t) => t.hex));
    showUnitPanel(unit);
  }

  function visibleTargets(unit: Unit): Unit[] {
    return attackTargets(state, unit.id).filter((t) => isVisible(state, PLAYER, t.hex));
  }

  function askAttack(attacker: Unit, defender: Unit): void {
    const preview = combatPreview(state, attacker.id, defender.id);
    panel.hide();
    confirm.show({
      title: fill(en.attack.confirmTitle, { unit: en.units[defender.type] }),
      lines: attackPreviewLines(preview, attacker, defender),
      confirmLabel: en.attack.confirm,
      onConfirm: () => {
        if (commit({ type: 'attack', unitId: attacker.id, targetId: defender.id })) {
          toast.show(formatAttacked(en.units[attacker.type], preview.damage, preview.defenderDies));
        } else {
          refreshUnitMode();
        }
      },
      onCancel: () => refreshUnitMode(),
    });
  }

  /** A tap while a unit is selected: move, attack, switch unit or fall back to the idle tap. */
  function tapUnitMode(unitId: number, hex: Hex | null): void {
    const unit = state.units.find((u) => u.id === unitId);
    if (!unit || !hex) {
      leaveUnitMode();
      tapIdle(hex);
      return;
    }
    const target = visibleTargets(unit).find((t) => hexEquals(t.hex, hex));
    if (target) {
      askAttack(unit, target);
      return;
    }
    if (reachableTiles(state, unit.id).some((r) => hexEquals(r.hex, hex))) {
      commit({ type: 'move', unitId: unit.id, to: hex });
      return;
    }
    const other = unitAt(state, hex);
    if (other && other.owner === PLAYER) {
      if (other.id !== unit.id) {
        enterUnitMode(other);
      } else if (buildingAt(hex)) {
        leaveUnitMode();
        preferBuilding = true;
        showPanel();
      }
      return;
    }
    leaveUnitMode();
    tapIdle(hex);
  }

  /** Panel for a tile without building and road: build list in own territory, else a hint. */
  function showEmptyTile(hex: Hex, terrain: TerrainId): void {
    if (ownerAt(state, hex) !== PLAYER) {
      panel.showTerrain(hex, terrain, {
        note: TERRAIN[terrain].isWater ? undefined : en.tileInfo.outsideNote,
      });
      return;
    }
    const options = buildOptionsFor(state, PLAYER, hex);
    const roadOk = planRoad(state, PLAYER, hex, hex).ok;
    panel.showTerrain(hex, terrain, {
      build: {
        options,
        stock: stockOf(state),
        onBuild: (id) => {
          if (commit({ type: 'build', building: id, hex })) {
            toast.show(fill(en.flow.built, { building: en.buildings[id] }));
          }
        },
      },
      onRoadFrom: roadOk ? () => startRoadFrom(hex) : undefined,
      note: options.length === 0 ? en.tileInfo.nothingToBuild : undefined,
    });
  }

  /** "Road from here": skips the start tap and waits for the road's end tile. */
  function startRoadFrom(hex: Hex): void {
    resetToIdle();
    mode = { kind: 'roadEnd', from: hex };
    bottomBar.setMode('road');
    renderer.setHighlights([hex]);
    banner.show(en.flow.roadEndPrompt);
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

  function askAdvance(cityId: number): void {
    const check = advanceCheck(state, cityId);
    if (!check?.to) return;
    const target = check.to;
    const names = BUILDING_IDS.filter((id) => BUILDINGS[id].minLevel === target).map((id) =>
      en.buildings[id].toLowerCase(),
    );
    const list =
      names.length > 1
        ? `${names.slice(0, -1).join(', ')} ${en.cityPanel.listAnd} ${names[names.length - 1]}`
        : names.join('');
    const lines = [`${en.ui.cost}: ${formatGoods(check.cost.cost) || '–'}`];
    if (names.length > 0) lines.push(fill(en.cityPanel.advanceUnlocks, { list }));
    panel.hide();
    confirm.show({
      title: `${formatAdvanceTo(target)}?`,
      lines,
      confirmLabel: en.cityPanel.advanceConfirm,
      onConfirm: () => {
        if (commit({ type: 'advanceCity', cityId })) toast.show(formatAdvanced(target));
        else showPanel();
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
      case 'unit':
        tapUnitMode(mode.unitId, hex);
        break;
    }
  }

  function tapIdle(hex: Hex | null): void {
    const same = hex !== null && selected !== null && hexEquals(selected, hex);
    if (hex && !same && !isExplored(hex)) {
      // Fog: nothing is revealed about an unexplored tile.
      selected = null;
      preferBuilding = false;
      renderer.selectTile(null);
      panel.hide();
      toast.show(en.unitText.unexplored);
      return;
    }
    const unit = hex ? unitAt(state, hex) : undefined;
    if (hex && same && unit?.owner === PLAYER && buildingAt(hex) && !preferBuilding) {
      // Second tap on a unit standing on a building: show the building instead.
      preferBuilding = true;
      showPanel();
      return;
    }
    selected = hex && !same ? hex : null;
    preferBuilding = false;
    renderer.selectTile(selected);
    if (selected && unit && unit.owner === PLAYER) {
      enterUnitMode(unit);
      return;
    }
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
    // Border tower and co.: show the land that would be claimed.
    const restoreHighlights = (): void =>
      renderer.setHighlights(validPlacements(state, PLAYER, id));
    if (def.territoryRadius > 0) {
      const gain = territoryGain(state, hex, def.territoryRadius);
      renderer.setHighlights(gain);
      lines.push(formatTerritoryGain(gain.length));
    }
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
          restoreHighlights();
        }
      },
      onCancel: () => {
        selected = null;
        renderer.selectTile(null);
        restoreHighlights();
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
