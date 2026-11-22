// Game controller: holds the GameState and the interaction mode, wires renderer and UI together.
import { playAiTurns, takeAiTurn } from '../ai';
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
  economyOverview,
  enemiesInSight,
  passengersOf,
  planMoveOrder,
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
  workersNeeded,
  type BuildingStatus,
  type OrderPlan,
} from '../core/rules';
import type { GameState, Unit } from '../core/state';
import {
  BUILDING_IDS,
  BUILDINGS,
  CITY_LEVELS,
  aiConfig,
  UNITS,
  economyConfig,
  type BuildingId,
  type CityLevel,
  type Stock,
  type UnitId,
} from '../data';
import { cityName } from '../i18n/cityNames';
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
import { createRenderer, type OrderPath } from '../render/app';
import { browserStorage, listSaves, saveGame } from '../save';
import { buildOptionsFor } from './buildOptions';
import {
  createBottomBar,
  createBuildMenu,
  createConfirmSheet,
  createEconomySheet,
  createEndScreen,
  createGameMenu,
  createModeBanner,
  createResourceBar,
  createScoresSheet,
  createSeedLabel,
  createTileInfoPanel,
  createToast,
  attackPreviewLines,
  civName,
  eventLines,
  formatSaveError,
  orderConfirm,
  perTurnText,
  setArtPlayers,
  aboardState,
  aboardText,
  inUnitCycle,
  trainOptions,
  turnSummary,
} from './index';

const PLAYER = 0;

/** sessionStorage key: the in-game Load asks the next page load to open this slot directly. */
export const BOOT_INTENT_KEY = 'poleis.boot';

type Mode =
  | { kind: 'idle' }
  | { kind: 'placing'; building: BuildingId }
  | { kind: 'roadStart' }
  | { kind: 'roadEnd'; from: Hex }
  | { kind: 'unit'; unitId: number };

/** Dev/test options from the URL: `reveal` = no fog (display only), `watch` = an AI plays the human too. */
export interface GameOptions {
  reveal?: boolean;
  watch?: boolean;
}

/** Creates the renderer and all UI components and runs the interaction. Rejects on renderer errors. */
export async function createGame(
  appContainer: HTMLElement,
  uiContainer: HTMLElement,
  initialState: GameState,
  testMode = false,
  options: GameOptions = {},
): Promise<void> {
  const watch = options.watch === true;
  const reveal = watch || options.reveal === true;
  let state = initialState;
  setArtPlayers(state.players);
  let mode: Mode = { kind: 'idle' };
  let selected: Hex | null = null;
  let statuses: Record<number, BuildingStatus> = {};
  let menuOpen = false;
  // A unit stands on the selected building tile and the player asked for the building panel.
  let preferBuilding = false;

  // Seed label first: later elements stack above it.
  createSeedLabel(uiContainer, state.seedText, testMode, watch);

  // Unit drag & drop: the unit being dragged (null = no drag)
  let dragUnitId: number | null = null;
  // Hex last planned for during the drag (re-plan only when it changes) and its order preview.
  let dragHoverHex: Hex | null = null;
  let dragPreview: { unitId: number; plan: OrderPlan } | null = null;
  const renderer = await createRenderer(appContainer, state, (h) => onTileTap(h), {
    onStart: (h, sx, sy) => startUnitDrag(h, sx, sy),
    onMove: (h, sx, sy) => moveUnitDrag(h, sx, sy),
    onEnd: (h) => endUnitDrag(h),
    onCancel: () => cancelUnitDrag(),
  });
  renderer.setRevealAll(reveal);
  const toast = createToast(uiContainer);
  const resourceBar = createResourceBar(uiContainer, {
    onMenu: () => {
      resetToIdle();
      gameMenu.open();
    },
    onOverview: () => {
      resetToIdle();
      economySheet.open(economyOverview(state, PLAYER));
    },
  });
  const economySheet = createEconomySheet(uiContainer, {
    onTogglePriority: (good, low) => {
      commit({ type: 'setGoodPriority', good, low });
    },
  });
  const scoresSheet = createScoresSheet(uiContainer);
  const banner = createModeBanner(uiContainer, () => resetToIdle());
  const confirm = createConfirmSheet(uiContainer);
  const storage = browserStorage();
  const goToMainMenu = (): void => window.location.assign(window.location.pathname);
  const gameMenu = createGameMenu(uiContainer, {
    confirm,
    getSaves: () => listSaves(storage),
    onScores: () => scoresSheet.open(state, PLAYER),
    onSave: (slot) => {
      const result = saveGame(storage, slot, state);
      if (result.ok) toast.show(fill(en.gameMenu.saved, { n: slot }));
      else toast.show(formatSaveError(result.error), 'error');
    },
    onLoad: (slot) => {
      // Reloading the page is the simplest way to get a clean renderer and UI for the loaded game.
      try {
        window.sessionStorage.setItem(BOOT_INTENT_KEY, JSON.stringify({ load: slot }));
      } catch {
        toast.show(formatSaveError('unavailable'), 'error');
        return;
      }
      window.location.reload();
    },
    onMainMenu: goToMainMenu,
  });
  let endScreenShown = false;
  const endScreen = createEndScreen(uiContainer, {
    onNewGame: goToMainMenu,
    onLookAtMap: () => {},
  });
  const panel = createTileInfoPanel(uiContainer, () => {
    if (mode.kind === 'unit') {
      resetToIdle();
      return;
    }
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
      economySheet.close();
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
      economySheet.close();
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
      if (state.result) return;
      economySheet.close();
      selectNextUnit();
    },
    onEndTurn: () => {
      resetToIdle();
      if (state.result) {
        endScreen.show(state, PLAYER);
        return;
      }
      if (watch) {
        toggleWatchPause();
        return;
      }
      endTurn();
    },
  });

  // Watch mode: an AI plays player 0 and the turns run by themselves; End turn pauses/resumes.
  let watchPaused = false;
  let watchTimer: number | undefined;
  function toggleWatchPause(): void {
    watchPaused = !watchPaused;
    toast.show(watchPaused ? en.watchPaused : en.watchRunning);
  }
  function startWatch(): void {
    watchTimer = window.setInterval(() => {
      if (watchPaused) return;
      if (state.result) {
        window.clearInterval(watchTimer);
        return;
      }
      state = takeAiTurn(state, PLAYER);
      endTurn();
    }, aiConfig.watchIntervalMs);
  }

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
    const production = previewProduction(s, PLAYER);
    for (const c of s.cities) {
      if (c.owner === PLAYER && advanceCheck(s, c.id, production)?.canAdvance) ready.add(c.id);
    }
    return ready;
  }

  /** Ends the turn and shows one toast with the news of the turn. */
  function endTurn(): void {
    const readyBefore = readyCities(state);
    const unitsBefore = new Set(ownUnits().map((u) => u.id));
    if (!commit({ type: 'endTurn' })) return;
    // The AI civilizations take their turns (instantly) until it is the player's turn again.
    state = playAiTurns(state);
    refresh();
    autosave();
    // Watch mode: no turn-summary toasts (they would pile up every second).
    if (watch) return;
    // News about the rivals first, then the player's own turn summary.
    const lines = eventLines(state, PLAYER);
    const report = state.result ? null : state.lastReport;
    if (report) {
      const canAdvance: Record<number, CityLevel> = {};
      const production = previewProduction(state, PLAYER);
      for (const c of state.cities) {
        if (c.owner !== PLAYER) continue;
        const check = advanceCheck(state, c.id, production);
        if (!check) continue;
        if (check.to && check.canAdvance && !readyBefore.has(c.id)) canAdvance[c.id] = check.to;
      }
      const spawnedUnits = ownUnits()
        .filter((u) => !unitsBefore.has(u.id))
        .map((u) => u.type);
      const cityNames: Record<number, string> = {};
      for (const c of state.cities) cityNames[c.id] = cityName(c.nameIndex);
      lines.push(...turnSummary(report, { canAdvance, spawnedUnits, cityNames }));
    }
    if (lines.length === 0) return;
    const isError = lines.some((l) => l.kind === 'error');
    toast.show(
      lines.map((l) => l.text).join('\n'),
      isError ? 'error' : 'info',
      3000 + 1000 * (lines.length - 1),
    );
  }

  let autosaveFailureShown = false;
  /** Saves the game to the autosave slot; a failure is reported once per session and never blocks play. */
  function autosave(): void {
    // Test mode (sandbox) never touches the real autosave.
    if (testMode || watch) return;
    const result = saveGame(storage, 'auto', state);
    if (!result.ok && !autosaveFailureShown) {
      autosaveFailureShown = true;
      toast.show(formatSaveError(result.error), 'error');
    }
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
    clearDragPreview();
    showOrderPaths();
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
    const overview = economyOverview(state, PLAYER);
    resourceBar.update(
      stockOf(state),
      state.lastReport?.delta ?? null,
      state.turn,
      state.settings.victory.points ? state.settings.turnLimit : null,
      people(),
      overview.workers,
    );
    if (economySheet.isOpen()) economySheet.open(overview);
    bottomBar.setTurn(state.turn);
    bottomBar.setGameOver(state.result !== null);
    if (state.result && !endScreenShown) {
      endScreenShown = true;
      endScreen.show(state, PLAYER);
    }
    bottomBar.setUnitsEnabled(ownUnits().length > 0);
    if (mode.kind === 'idle') showPanel();
    else if (mode.kind === 'unit') refreshUnitMode();
    showOrderPaths();
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
      const production = previewProduction(state, PLAYER);
      const check = advanceCheck(state, cityId, production);
      if (city && check) {
        // Residents eat after this turn's production, so judge food, needs and taxes
        // against the stock as it will be after production (a copy – the real state stays).
        const afterProduction = structuredClone(state);
        runProduction(afterProduction, PLAYER);
        panel.showCity({
          hex,
          terrain,
          name: cityName(city.nameIndex),
          level: city.level,
          train: trainInfo(building),
          stats: cityStats(afterProduction, cityId, production),
          check,
          stock: stockOf(afterProduction),
          onAdvance: check.to ? () => askAdvance(cityId) : undefined,
        });
        return;
      }
    }
    if (building) {
      const assigned = assignWorkers(state, PLAYER, connectedBuildingIds(state, PLAYER));
      panel.showBuilding({
        hex,
        terrain,
        type: building.type,
        status: statuses[building.id] ?? { kind: 'noProduction' },
        workers: { assigned: assigned[building.id] ?? 0, needed: workersNeeded(building) },
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
        train:
          building.type === 'barracks' || building.type === 'harbor'
            ? trainInfo(building)
            : undefined,
        onDemolish:
          building.type === 'cityCenter' || building.type === 'wonder'
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

  /** Training list of a barracks, harbor or city center (settlers), from its city's level, residents and the player's goods. */
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
        building:
          building.type === 'harbor'
            ? 'harbor'
            : building.type === 'cityCenter'
              ? 'cityCenter'
              : 'barracks',
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
    const cap = UNITS[unit.type].capacity;
    const ship = unit.aboard === null ? null : state.units.find((u) => u.id === unit.aboard);
    panel.showUnit({
      hex: unit.hex,
      terrain,
      unit,
      own,
      // Cargo is only shown for own ships
      cargo:
        own && cap > 0
          ? {
              capacity: cap,
              passengers: passengersOf(state, unit.id),
              onSelect: (id) => selectPassenger(id),
            }
          : undefined,
      aboard:
        own && ship
          ? {
              state: aboardState(unit, landingTiles(unit)),
              onShip: () => enterUnitMode(ship),
            }
          : undefined,
      hasTargets: own && visibleTargets(unit).length > 0,
      found,
      order: own && unit.order ? orderInfo(unit) : null,
    });
  }

  /** Number of free shore tiles a passenger could land on (0 for units that are not aboard). */
  function landingTiles(unit: Unit): number {
    if (unit.aboard === null) return 0;
    return reachableTiles(state, unit.id, { ignoreHiddenUnits: true }).filter(
      (r) => r.kind === 'land',
    ).length;
  }

  /** Tap on a passenger in its ship's panel: select it, its landing tiles light up. */
  function selectPassenger(id: number): void {
    const p = state.units.find((u) => u.id === id);
    if (!p) return;
    const aboard = aboardState(p, landingTiles(p));
    if (aboard !== 'land') {
      toast.show(aboardText(aboard), 'error');
      return;
    }
    enterUnitMode(p, false);
  }

  /** Panel data of a unit on a move order: turns until arrival and the "Stop" action. */
  function orderInfo(unit: Unit): { turns: number | null; onStop(): void } {
    const planned = unit.order ? planMoveOrder(state, unit.id, unit.order.to) : null;
    return {
      turns: planned?.ok ? planned.plan.turns : null,
      onStop: () => {
        if (commit({ type: 'cancelOrder', unitId: unit.id })) {
          toast.show(en.orders.stopped);
          refreshUnitMode();
        }
      },
    };
  }

  function clearDragPreview(): void {
    dragHoverHex = null;
    dragPreview = null;
  }

  /**
   * Draws the move-order paths: faint for every own unit on its way, active for the selected one
   * (unit mode). A preview replaces the entry of its unit. Called whenever state or mode change.
   */
  function showOrderPaths(preview: { unitId: number; plan: OrderPlan } | null = dragPreview): void {
    const selectedId = mode.kind === 'unit' ? mode.unitId : null;
    const paths: OrderPath[] = [];
    for (const u of ownUnits()) {
      if (preview && preview.unitId === u.id) continue;
      if (!u.order) continue;
      const planned = planMoveOrder(state, u.id, u.order.to);
      if (!planned.ok) continue;
      paths.push({
        path: planned.plan.path,
        stops: planned.plan.stops,
        style: u.id === selectedId ? 'active' : 'faint',
      });
    }
    if (preview) {
      paths.push({ path: preview.plan.path, stops: preview.plan.stops, style: 'active' });
    }
    renderer.setOrderPaths(paths);
  }

  /** Plan for a far tile if it is worth an order (at least one more turn), else null. */
  function farPlan(unit: Unit, hex: Hex): OrderPlan | null {
    const planned = planMoveOrder(state, unit.id, hex);
    return planned.ok && planned.plan.turns >= 1 ? planned.plan : null;
  }

  /** Sets the move order; reports it if the walk of this turn stopped right away. */
  function commitOrder(unit: Unit, hex: Hex): void {
    if (!commit({ type: 'setOrder', unitId: unit.id, to: hex })) {
      refreshUnitMode();
      return;
    }
    const after = state.units.find((u) => u.id === unit.id);
    if (after && !after.order && !hexEquals(after.hex, hex)) {
      const text =
        enemiesInSight(state, after).length > 0 ? en.orders.stoppedEnemy : en.orders.stoppedBlocked;
      toast.show(fill(text, { unit: en.units[after.type] }), 'error');
    }
    refreshUnitMode();
  }

  function askOrder(unit: Unit, hex: Hex, plan: OrderPlan): void {
    panel.hide();
    showOrderPaths({ unitId: unit.id, plan });
    confirm.show({
      ...orderConfirm(unit.type, plan.turns),
      onConfirm: () => commitOrder(unit, hex),
      onCancel: () => {
        refreshUnitMode();
        showOrderPaths();
      },
    });
  }

  function foundHere(unit: Unit): void {
    const hex = unit.hex;
    leaveUnitMode();
    selected = hex;
    preferBuilding = false;
    renderer.selectTile(hex);
    if (commit({ type: 'foundCity', unitId: unit.id })) {
      const founded = state.cities[state.cities.length - 1];
      toast.show(fill(en.flow.cityFounded, { city: founded ? cityName(founded.nameIndex) : '' }));
    }
  }

  /** Can the unit still do something this turn (a reachable tile or an attack target)? */
  function canAct(unit: Unit): boolean {
    // A passenger can only land: a move left and a free shore tile
    if (unit.aboard !== null) return !unit.attacked && unit.movesLeft > 0 && landingTiles(unit) > 0;
    if (
      !unit.attacked &&
      unit.movesLeft > 0 &&
      reachableTiles(state, unit.id, { ignoreHiddenUnits: true }).length > 0
    ) {
      return true;
    }
    return attackTargets(state, unit.id).some((t) => isVisible(state, PLAYER, t.hex));
  }

  /** Units button: the next own unit (by id, after the current one, wrapping) that can still act. */
  function selectNextUnit(): void {
    if (state.result) return;
    const inUnitMode = mode.kind === 'unit';
    const current = selected ? unitAt(state, selected) : undefined;
    const currentId =
      mode.kind === 'unit' ? mode.unitId : current?.owner === PLAYER ? current.id : -1;
    const sorted = ownUnits().sort((a, b) => a.id - b.id);
    // In unit mode the current unit is skipped; otherwise it comes last (it may still be due).
    const ordered = [
      ...sorted.filter((u) => u.id > currentId),
      ...sorted.filter((u) => u.id < currentId),
      ...sorted.filter((u) => u.id === currentId && !inUnitMode),
    ];
    // If the selected unit is the only one that can still act, keep it (and re-center on it).
    const waiting = (u: Unit): boolean => !u.order && inUnitCycle(u, canAct(u), landingTiles(u));
    const next = ordered.find(waiting) ?? sorted.find((u) => u.id === currentId && waiting(u));
    if (!next) {
      toast.show(en.unitText.allDone);
      return;
    }
    enterUnitMode(next);
  }

  /** A press on an own unit that can still act turns into a drag instead of a map pan. */
  function startUnitDrag(hex: Hex | null, sx: number, sy: number): boolean {
    if (state.result || !hex || (mode.kind !== 'idle' && mode.kind !== 'unit')) return false;
    const unit = unitAt(state, hex);
    if (!unit || unit.owner !== PLAYER || !(canAct(unit) || unit.order)) return false;
    // No re-centering: the map must stay under the finger.
    enterUnitMode(unit, false);
    if (mode.kind !== 'unit') return false;
    dragUnitId = unit.id;
    renderer.setDragGhost(unit.id, sx, sy);
    return true;
  }

  function moveUnitDrag(hex: Hex | null, sx: number, sy: number): void {
    if (dragUnitId === null) return;
    renderer.setDragGhost(dragUnitId, sx, sy);
    const unit = state.units.find((u) => u.id === dragUnitId);
    renderer.selectTile(hex ?? unit?.hex ?? null);
    if (!unit) return;
    const same = hex === dragHoverHex || (hex && dragHoverHex && hexEquals(hex, dragHoverHex));
    if (same) return;
    dragHoverHex = hex;
    dragPreview = null;
    if (
      hex &&
      !hexEquals(hex, unit.hex) &&
      !visibleTargets(unit).some((t) => hexEquals(t.hex, hex)) &&
      !reachableTiles(state, unit.id, { ignoreHiddenUnits: true }).some((r) =>
        hexEquals(r.hex, hex),
      )
    ) {
      const plan = farPlan(unit, hex);
      if (plan) dragPreview = { unitId: unit.id, plan };
    }
    showOrderPaths();
  }

  function endUnitDrag(hex: Hex | null): void {
    const id = dragUnitId;
    if (id === null) return;
    dragUnitId = null;
    renderer.setDragGhost(null);
    clearDragPreview();
    showOrderPaths();
    const unit = state.units.find((u) => u.id === id);
    if (mode.kind !== 'unit' || mode.unitId !== id || !unit) {
      renderer.selectTile(selected);
      return;
    }
    if (hex && !hexEquals(hex, unit.hex)) {
      const target = visibleTargets(unit).find((t) => hexEquals(t.hex, hex));
      if (target) {
        askAttack(unit, target);
        return;
      }
      if (
        reachableTiles(state, unit.id, { ignoreHiddenUnits: true }).some((r) =>
          hexEquals(r.hex, hex),
        )
      ) {
        commit({ type: 'move', unitId: unit.id, to: hex });
        return;
      }
      if (farPlan(unit, hex)) {
        commitOrder(unit, hex);
        return;
      }
    }
    // Dropped elsewhere: nothing happens, the unit stays selected.
    refreshUnitMode();
  }

  function cancelUnitDrag(): void {
    if (dragUnitId === null) return;
    dragUnitId = null;
    renderer.setDragGhost(null);
    clearDragPreview();
    refreshUnitMode();
    showOrderPaths();
  }

  function enterUnitMode(unit: Unit, center = true): void {
    resetToIdle();
    mode = { kind: 'unit', unitId: unit.id };
    selected = unit.hex;
    preferBuilding = false;
    renderer.selectTile(unit.hex);
    bottomBar.setMode('units');
    refreshUnitMode();
    if (center) centerAbovePanel(unit.hex);
  }

  /** Pans the map so the unit sits in the free map area above (or, on wide screens, beside) the panel. */
  function centerAbovePanel(hex: Hex): void {
    const panelEl = document.querySelector<HTMLElement>('.tile-info');
    const rect = panelEl && !panelEl.hidden ? panelEl.getBoundingClientRect() : null;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (!rect) {
      renderer.centerOn(hex);
    } else if (w >= 700) {
      // Card at the bottom left: use the area to its right.
      renderer.centerOnScreenPoint(hex, (rect.right + w) / 2, h / 2);
    } else {
      // Bottom sheet: use the area between the top of the screen and the sheet.
      renderer.centerOnScreenPoint(hex, w / 2, rect.top / 2 + 24);
    }
  }

  /** Leaves unit mode but keeps the selection (highlights and targets are cleared). */
  function leaveUnitMode(): void {
    mode = { kind: 'idle' };
    renderer.setHighlights([]);
    renderer.setAttackTargets([]);
    bottomBar.setMode('idle');
    showOrderPaths();
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
    if (!canAct(unit) && !unit.order) {
      // Nothing left to do: back to idle, the unit stays selected ("Done for this turn").
      leaveUnitMode();
      showPanel();
      return;
    }
    const reach = reachableTiles(state, unit.id, { ignoreHiddenUnits: true });
    renderer.setHighlights(
      reach.map((r) => r.hex),
      reach.filter((r) => r.kind === 'board').map((r) => r.hex),
    );
    renderer.setAttackTargets(visibleTargets(unit).map((t) => t.hex));
    showUnitPanel(unit);
    showOrderPaths();
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
          toast.show(formatAttacked(en.units[attacker.type], preview));
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
    if (
      reachableTiles(state, unit.id, { ignoreHiddenUnits: true }).some((r) => hexEquals(r.hex, hex))
    ) {
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
    const plan = farPlan(unit, hex);
    if (plan) {
      askOrder(unit, hex, plan);
      return;
    }
    leaveUnitMode();
    tapIdle(hex);
  }

  /** Panel for a tile without building and road: build list in own territory, else a hint. */
  function showEmptyTile(hex: Hex, terrain: TerrainId): void {
    if (ownerAt(state, hex) !== PLAYER) {
      const rival = state.buildings.find(
        (b) => b.type === 'cityCenter' && b.owner !== PLAYER && hexEquals(b.hex, hex),
      );
      panel.showTerrain(hex, terrain, {
        note: rival
          ? fill(en.tileInfo.enemyCity, { civ: civName(state, rival.owner) })
          : TERRAIN[terrain].isWater
            ? undefined
            : en.tileInfo.outsideNote,
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

  function cityLabel(cityId: number): string {
    const city = state.cities.find((c) => c.id === cityId);
    return city ? cityName(city.nameIndex) : en.cityPanel.fallbackName;
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
        if (commit({ type: 'advanceCity', cityId }))
          toast.show(formatAdvanced(cityLabel(cityId), target));
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
    economySheet.close();
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
  if (watch) startWatch();
  // A new or loaded game is saved right away, so Continue always has something to continue.
  autosave();
}
