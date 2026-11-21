// Dev-only preview of the UI components with sample data (open /ui-preview.html with `npm run dev`).
import '../style.css';
import './ui.css';
import { emptyStock } from '../core/rules/goods';
import { en } from '../i18n/en';
import {
  createBottomBar,
  createBuildMenu,
  createConfirmSheet,
  createEconomySheet,
  createModeBanner,
  createResourceBar,
  createSeedLabel,
  createEndScreen,
  createGameMenu,
  createMenuButton,
  createScoresSheet,
  createStartMenu,
  createTileInfoPanel,
  createToast,
  eventLines,
} from './index';
import { createGameState, type GameEvent } from '../core/state';
import type { SaveListEntry } from '../save';
import type { EconomyOverview } from '../core/rules/economy';
import type { AdvanceCheck } from '../core/rules/advance';
import type { CityReport, CityStats } from '../core/rules/population';
import type { BuildingStatus, TurnReport } from '../core/rules/production';
import type { BuildingId, CityLevel, Stock } from '../data';
import { formatAdvanced, formatBought, formatSold } from '../i18n/format';
import { turnSummary } from './turnSummary';
import type { BuildOption } from './buildOptions';
import type { Unit } from '../core/state';
import { UNITS, type UnitId } from '../data';
import { formatAttacked } from '../i18n/format';
import { attackPreviewLines, trainOptions } from './unitText';

const ui = document.getElementById('ui');
const controls = document.getElementById('preview-controls');
if (!ui || !controls) throw new Error('Missing containers');

const stock = { ...emptyStock(), wood: 6, stone: 1, grain: 4, planks: 2 };

const economy = createEconomySheet(ui);
const sampleOverview: EconomyOverview = {
  workers: { residents: 8, housing: 12, working: 6, free: 2, missing: 1 },
  goods: [
    {
      good: 'wood',
      stock: 6,
      produced: [{ source: 'woodcutter', amount: 4, count: 2 }],
      consumed: [{ source: 'building', detail: 'sawmill', amount: 2, count: 1 }],
      net: 2,
      turnsLeft: null,
    },
    {
      good: 'fish',
      stock: 7,
      produced: [{ source: 'fishery', amount: 2, count: 1 }],
      consumed: [
        { source: 'residents', amount: 3, count: 1 },
        { source: 'units', amount: 2, count: 1 },
      ],
      net: -3,
      turnsLeft: 2,
    },
    {
      good: 'drachmas',
      stock: 7,
      produced: [{ source: 'taxes', amount: 3, count: 1 }],
      consumed: [],
      net: 3,
      turnsLeft: null,
    },
  ],
};
const bar = createResourceBar(ui, { onOverview: () => economy.open(sampleOverview) });
bar.update(
  { ...stock, drachmas: 7, grapes: 2, wine: 1 },
  { wood: 2, stone: -1, grain: 3, planks: 0, bread: 1, drachmas: 3 },
  3,
  120,
  { residents: 6, housing: 8 },
  { residents: 6, housing: 8, working: 4, free: 2, missing: 1 },
);
createSeedLabel(ui, '12345');
const toast = createToast(ui);
const panel = createTileInfoPanel(ui, () => toast.show('Panel closed'));
const confirm = createConfirmSheet(ui);
const banner = createModeBanner(ui, () => {
  banner.hide();
  bottom.setMode('idle');
});
let menuLevel: CityLevel = 'settlement';
const menu = createBuildMenu(ui, {
  onPick: (id: BuildingId) => {
    menu.close();
    bottom.setMode('build');
    banner.show(en.flow.placePrompt.replace('{building}', en.buildings[id]));
  },
  onClose: () => bottom.setMode('idle'),
});
const bottom = createBottomBar(ui, {
  onBuild: () => {
    bottom.setMode('build');
    menu.open(stock, menuLevel);
  },
  onRoad: () => {
    bottom.setMode('road');
    banner.show(en.flow.roadStartPrompt);
  },
  onUnits: () => {
    bottom.setMode('units');
    toast.show('Units mode');
  },
  onEndTurn: () => toast.show('Turn ended'),
});
bottom.setTurn(3);
bottom.setMode('idle');

const hex = { q: 4, r: 3 };
const workers = { assigned: 1, needed: 2 };
const statuses: [string, BuildingStatus][] = [
  ['Producing', { kind: 'producing' }],
  ['Not connected', { kind: 'notConnected' }],
  ['Missing workers', { kind: 'missingWorkers', assigned: 1, needed: 2 }],
  ['Missing input', { kind: 'missingInput', missing: { wood: 2 } }],
  ['No production', { kind: 'noProduction' }],
  ['Open', { kind: 'working' }],
];

function addControl(label: string, run: () => void): void {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', run);
  controls?.appendChild(b);
}

for (const [label, status] of statuses) {
  addControl(label, () =>
    panel.showBuilding({
      hex,
      terrain: 'plains',
      type: status.kind === 'missingInput' ? 'sawmill' : 'farm',
      status,
      workers,
      onDemolish: () => toast.show(en.flow.demolished.replace('{building}', 'Farm')),
    }),
  );
}
// ---- City panel at each level ----
const cityStats: CityStats = {
  residents: 12,
  housing: 16,
  foodPerTurn: 6,
  needs: [],
  supply: null,
  taxPerTurn: 6,
};
const settlementCheck: AdvanceCheck = {
  to: 'polis',
  residents: { have: 12, need: 20, ok: false },
  supply: { good: 'oil', streak: 2, turns: 3, ok: false },
  cost: {
    cost: { planks: 20, stone: 20, drachmas: 30 },
    missing: { stone: 19, drachmas: 30 },
    ok: false,
  },
  canAdvance: false,
};
const fed: Stock = { ...stock, fish: 8, bread: 2, oil: 3, drachmas: 40, planks: 30, stone: 30 };

function showCity(level: CityLevel, stats: CityStats, check: AdvanceCheck, goods: Stock): void {
  panel.showCity({
    hex,
    terrain: 'plains',
    level,
    stats,
    check,
    stock: goods,
    onAdvance: () => toast.show(formatAdvanced(check.to ?? level)),
  });
}
addControl('City: settlement, not ready', () =>
  showCity('settlement', cityStats, settlementCheck, fed),
);
addControl('City: settlement, ready', () =>
  showCity(
    'settlement',
    { ...cityStats, residents: 20, housing: 20, foodPerTurn: 10, taxPerTurn: 10 },
    {
      to: 'polis',
      residents: { have: 20, need: 20, ok: true },
      supply: { good: 'oil', streak: 3, turns: 3, ok: true },
      cost: { cost: settlementCheck.cost.cost, missing: {}, ok: true },
      canAdvance: true,
    },
    fed,
  ),
);
addControl('City: hungry', () =>
  showCity('settlement', cityStats, settlementCheck, { ...fed, fish: 1, bread: 0 }),
);
addControl('City: polis, no oil', () =>
  showCity(
    'polis',
    {
      ...cityStats,
      residents: 30,
      housing: 36,
      foodPerTurn: 15,
      needs: [{ good: 'oil', amount: 3, inStock: false }],
      taxPerTurn: 15,
    },
    {
      to: 'metropolis',
      residents: { have: 30, need: 50, ok: false },
      supply: { good: 'wine', streak: 0, turns: 3, ok: false },
      cost: {
        cost: { planks: 40, stone: 40, bronze: 10, drachmas: 80 },
        missing: { bronze: 10, drachmas: 40 },
        ok: false,
      },
      canAdvance: false,
    },
    { ...fed, oil: 0 },
  ),
);
addControl('City: metropolis', () =>
  showCity(
    'metropolis',
    {
      ...cityStats,
      residents: 60,
      housing: 60,
      foodPerTurn: 30,
      needs: [
        { good: 'oil', amount: 6, inStock: true },
        { good: 'wine', amount: 6, inStock: true },
      ],
      taxPerTurn: 45,
    },
    {
      to: null,
      residents: { have: 60, need: 0, ok: true },
      supply: { good: 'oil', streak: 0, turns: 0, ok: true },
      cost: { cost: {}, missing: {}, ok: true },
      canAdvance: false,
    },
    fed,
  ),
);

// ---- Pause and marketplace ----
let farmPaused = false;
function showFarm(): void {
  panel.showBuilding({
    hex,
    terrain: 'plains',
    type: 'woodcutter',
    status: farmPaused ? { kind: 'paused' } : { kind: 'producing' },
    workers,
    paused: farmPaused,
    onTogglePause: () => {
      farmPaused = !farmPaused;
      toast.show(
        (farmPaused ? en.flow.paused : en.flow.resumed).replace(
          '{building}',
          en.buildings.woodcutter,
        ),
      );
      showFarm();
    },
  });
}
addControl('Paused building', () => {
  farmPaused = true;
  showFarm();
});

const marketStock: Stock = { ...stock, wood: 5, grain: 1, drachmas: 4 };
function showMarket(enabled: boolean): void {
  panel.showBuilding({
    hex,
    terrain: 'plains',
    type: 'marketplace',
    status: enabled ? { kind: 'working' } : { kind: 'missingWorkers', assigned: 0, needed: 1 },
    workers: { assigned: enabled ? 1 : 0, needed: 1 },
    paused: false,
    onTogglePause: () => toast.show(en.flow.paused.replace('{building}', en.buildings.marketplace)),
    trade: {
      enabled,
      stock: marketStock,
      onSell: (good) => {
        marketStock[good] -= 2;
        marketStock.drachmas += 1;
        toast.show(formatSold(good, 2, 1));
        showMarket(enabled);
      },
      onBuy: (good) => {
        marketStock[good] += 1;
        marketStock.drachmas -= 3;
        toast.show(formatBought(good, 1, 3));
        showMarket(enabled);
      },
    },
  });
}
addControl('Marketplace: trading', () => showMarket(true));
addControl('Marketplace: not staffed', () => showMarket(false));

addControl('Build menu: settlement', () => {
  menuLevel = 'settlement';
  bottom.setMode('build');
  menu.open(stock, menuLevel);
});
addControl('Build menu: polis', () => {
  menuLevel = 'polis';
  bottom.setMode('build');
  menu.open(stock, menuLevel);
});

// ---- Turn summary toasts, one after the other ----
function cityReport(over: Partial<CityReport>): CityReport {
  return {
    cityId: 1,
    residentsBefore: 6,
    residentsAfter: 7,
    foodNeeded: 3,
    foodEaten: { fish: 3 },
    fed: true,
    needsMet: true,
    needsConsumed: {},
    supplied: null,
    supplyStreak: 0,
    taxes: 3,
    ...over,
  };
}
function turnReport(...cities: CityReport[]): TurnReport {
  return {
    turn: 5,
    player: 0,
    delta: {},
    buildings: [],
    cities,
    units: { spawned: 0, upkeepEaten: {}, starving: false, lost: 0 },
    captured: [],
    orders: [],
  };
}
addControl('Turn summary toasts', () => {
  const sequence = [
    ...turnSummary(turnReport(cityReport({ supplied: true, supplyStreak: 2 })), {
      supply: { 1: { good: 'oil', turnsNeeded: 3 } },
    }),
    ...turnSummary(turnReport(cityReport({ fed: false, residentsAfter: 5, taxes: 2 }))),
    ...turnSummary(turnReport(cityReport({ taxes: 0, residentsAfter: 6 })), {
      canAdvance: { 1: 'polis' },
    }),
  ];
  sequence.forEach((line, i) =>
    window.setTimeout(() => toast.show(line.text, line.kind), i * 3200),
  );
});

addControl('Road panel', () =>
  panel.showRoad({ hex, terrain: 'forest', onDemolish: () => toast.show(en.flow.roadDemolished) }),
);
addControl('Terrain panel', () => panel.showTerrain(hex, 'hills'));
const mixedOptions: BuildOption[] = [
  { id: 'borderTower', state: 'ok', gain: 11 },
  { id: 'house', state: 'ok' },
  { id: 'farm', state: 'ok' },
  { id: 'sawmill', state: 'unaffordable', missing: { wood: 2 } },
  { id: 'vineyard', state: 'locked', level: 'polis' },
  { id: 'marketplace', state: 'locked', level: 'polis' },
];
const buildHandlers = {
  onBuild: (id: BuildingId) => toast.show(en.flow.built.replace('{building}', en.buildings[id])),
};
addControl('Empty plains: build list', () =>
  panel.showTerrain(hex, 'plains', {
    build: { options: mixedOptions, stock, ...buildHandlers },
    onRoadFrom: () => toast.show(en.flow.roadEndPrompt),
  }),
);
addControl('Empty forest: only woodcutter', () =>
  panel.showTerrain(hex, 'forest', {
    build: { options: [{ id: 'woodcutter', state: 'ok' }], stock, ...buildHandlers },
    onRoadFrom: () => toast.show(en.flow.roadEndPrompt),
  }),
);
addControl('Outside territory', () =>
  panel.showTerrain(hex, 'plains', { note: en.tileInfo.outsideNote }),
);
addControl('Confirm border tower', () =>
  confirm.show({
    title: en.flow.buildConfirmTitle.replace('{building}', en.buildings.borderTower),
    lines: ['Cost: 2 Wood, 4 Stone', '+11 territory tiles'],
    confirmLabel: en.ui.build,
    onConfirm: () => undefined,
    onCancel: () => undefined,
  }),
);
addControl('Confirm build', () =>
  confirm.show({
    title: en.flow.buildConfirmTitle.replace('{building}', en.buildings.farm),
    lines: ['Cost: 3 Wood', '2 workers'],
    confirmLabel: en.ui.build,
    onConfirm: () => toast.show(en.flow.built.replace('{building}', en.buildings.farm)),
    onCancel: () => toast.show('Cancelled'),
  }),
);
addControl('Confirm road (disabled)', () =>
  confirm.show({
    title: en.flow.roadConfirmTitle,
    lines: ['5 new road tiles', 'Cost: 5 Wood'],
    confirmLabel: en.ui.road,
    disabledReason: 'Not enough goods: 0 Wood missing.',
    onConfirm: () => undefined,
    onCancel: () => undefined,
  }),
);
addControl('Confirm demolish', () =>
  confirm.show({
    title: en.flow.demolishConfirmTitle.replace('{building}', en.buildings.farm),
    lines: [en.flow.demolishNoRefund],
    confirmLabel: en.ui.demolish,
    danger: true,
    onConfirm: () => toast.show(en.flow.demolished.replace('{building}', 'Farm')),
    onCancel: () => undefined,
  }),
);
// ---- Units ----
function sampleUnit(type: UnitId, over: Partial<Unit> = {}): Unit {
  return {
    id: 1,
    type,
    owner: 0,
    hex,
    hp: UNITS[type].hp,
    movesLeft: UNITS[type].movement,
    hasMoved: false,
    acted: false,
    attacked: false,
    capturing: null,
    order: null,
    ...over,
  };
}
addControl('Units button disabled', () => bottom.setUnitsEnabled(false));
addControl('Units button enabled', () => bottom.setUnitsEnabled(true));
addControl('Unit: own, ready', () =>
  panel.showUnit({ hex, terrain: 'plains', unit: sampleUnit('spearman'), own: true }),
);
addControl('Unit: own, hurt, can attack', () =>
  panel.showUnit({
    hex,
    terrain: 'forest',
    unit: sampleUnit('archer', { hp: 3, movesLeft: 0, acted: true }),
    own: true,
  }),
);
addControl('Unit: own, done', () =>
  panel.showUnit({
    hex,
    terrain: 'hills',
    unit: sampleUnit('spearman', { movesLeft: 0, acted: true, attacked: true }),
    own: true,
  }),
);
addControl('Unit: own, on the way', () =>
  panel.showUnit({
    hex,
    terrain: 'plains',
    unit: sampleUnit('scout'),
    own: true,
    order: { turns: 3, onStop: () => toast.show(en.orders.stopped) },
  }),
);
addControl('Unit: enemy', () =>
  panel.showUnit({
    hex,
    terrain: 'plains',
    unit: sampleUnit('hoplite', { owner: 1, hp: 8, movesLeft: 0 }),
    own: false,
  }),
);
addControl('Settler: can found', () =>
  panel.showUnit({
    hex,
    terrain: 'plains',
    unit: sampleUnit('settler'),
    own: true,
    found: { ok: true, onFound: () => toast.show(en.flow.cityFounded) },
  }),
);
addControl('Settler: blocked', () =>
  panel.showUnit({
    hex,
    terrain: 'plains',
    unit: sampleUnit('settler'),
    own: true,
    found: {
      ok: false,
      reason: en.errors.tooCloseToCity.replace('{distance}', '4'),
      onFound: () => undefined,
    },
  }),
);
const trainStock: Stock = { ...emptyStock(), planks: 5, bronze: 0, bread: 4, drachmas: 9 };
function showBarracks(pending: UnitId | null): void {
  panel.showBuilding({
    hex,
    terrain: 'plains',
    type: 'barracks',
    status: { kind: 'working' },
    workers: { assigned: 1, needed: 1 },
    train: {
      options: trainOptions({ cityLevel: 'settlement', residents: 2, stock: trainStock }),
      pending,
      onTrain: (id) => {
        toast.show(en.flow.trainOrdered.replace('{unit}', en.units[id]));
        showBarracks(id);
      },
    },
  });
}
addControl('Barracks: train list', () => showBarracks(null));
addControl('Barracks: order pending', () => showBarracks('spearman'));
addControl('Confirm attack', () => {
  const a = sampleUnit('spearman');
  const d = sampleUnit('spearman', { id: 2, owner: 1 });
  confirm.show({
    title: en.attack.confirmTitle.replace('{unit}', en.units.spearman),
    lines: attackPreviewLines(
      { damage: 5, counter: 5, defenderDies: false, attackerDies: false },
      a,
      d,
    ),
    confirmLabel: en.attack.confirm,
    onConfirm: () =>
      toast.show(
        formatAttacked('Spearman', {
          damage: 5,
          counter: 5,
          defenderDies: false,
          attackerDies: false,
        }),
      ),
    onCancel: () => undefined,
  });
});
addControl('Confirm attack: kill', () => {
  const d = sampleUnit('archer', { id: 2, owner: 1, hp: 4 });
  confirm.show({
    title: en.attack.confirmTitle.replace('{unit}', en.units.archer),
    lines: attackPreviewLines(
      { damage: 5, counter: 0, defenderDies: true, attackerDies: false },
      sampleUnit('spearman'),
      d,
    ),
    confirmLabel: en.attack.confirm,
    onConfirm: () =>
      toast.show(
        formatAttacked('Spearman', {
          damage: 5,
          counter: 0,
          defenderDies: true,
          attackerDies: false,
        }),
      ),
    onCancel: () => undefined,
  });
});
addControl('Turn summary: units', () => {
  const base = turnReport();
  const sequence = [
    ...turnSummary(
      { ...base, units: { spawned: 1, upkeepEaten: {}, starving: false, lost: 0 } },
      { spawnedUnits: ['spearman'] },
    ),
    ...turnSummary({ ...base, units: { spawned: 0, upkeepEaten: {}, starving: true, lost: 1 } }),
    ...turnSummary({ ...base, captured: [2] }),
  ];

  sequence.forEach((line, i) =>
    window.setTimeout(() => toast.show(line.text, line.kind), i * 3200),
  );
});
addControl('Turn summary: move orders', () => {
  const base = turnReport();
  const sequence = turnSummary({
    ...base,
    orders: [
      { unitId: 1, unitType: 'scout', outcome: 'arrived' },
      { unitId: 2, unitType: 'spearman', outcome: 'enemySpotted' },
    ],
  });
  sequence.forEach((line, i) =>
    window.setTimeout(() => toast.show(line.text, line.kind), i * 3200),
  );
});
addControl('Toast', () => toast.show(en.flow.roadBuilt));
addControl('Error toast', () => toast.show('This tile is already occupied.', 'error'));
addControl(
  'Toggle end turn',
  (() => {
    let on = true;
    return () => {
      on = !on;
      bottom.setEnabled(on);
    };
  })(),
);

// ---- Menus, scores, end screen (a 4-civilization game with sample data) ----
const game = createGameState('preview', { settings: { aiCount: 3, playerName: 'Ilios' } });
game.turn = 47;
game.players[2].alive = false;
game.buildings.push({
  id: 900,
  type: 'wonder',
  owner: 1,
  hex: { q: 6, r: 6 },
  paused: false,
  progress: 2,
});
const sampleEvents: GameEvent[] = [
  {
    type: 'attack',
    turn: 47,
    attacker: 1,
    defender: 0,
    attackerUnit: 'hoplite',
    defenderUnit: 'scout',
    hex,
    damage: 4,
    counter: 0,
    defenderKilled: false,
    attackerKilled: false,
    seenBy: [0, 1],
  },
  { type: 'cityFounded', turn: 47, by: 3, cityId: 9, hex, seenBy: [0, 3] },
  { type: 'wonderStarted', turn: 47, player: 1, hex, seenBy: [0, 1, 2, 3] },
  { type: 'eliminated', turn: 47, player: 2, seenBy: [0, 2] },
  { type: 'cityCaptured', turn: 47, by: 1, from: 0, cityId: 1, hex, seenBy: [0, 1] },
];
const sampleSaves: SaveListEntry[] = [
  {
    slot: 'auto',
    savedAt: '2026-11-21T14:05:00Z',
    summary: { turn: 47, playerName: 'Ilios', aiCount: 3, mapSize: 'normal', seedText: 'preview' },
  },
  {
    slot: 2,
    savedAt: '2026-11-20T19:30:00Z',
    summary: { turn: 31, playerName: '', aiCount: 2, mapSize: 'small', seedText: '7' },
  },
];

const startMenu = createStartMenu(ui, {
  seed: '12345',
  saves: sampleSaves,
  onNewGame: (settings, seed) => {
    startMenu.hide();
    toast.show(
      `${settings.aiCount} rivals, ${settings.mapSize}, seed ${seed}, color ${settings.playerColor}`,
    );
  },
  onContinue: () => {
    startMenu.hide();
    toast.show('Continue');
  },
  onLoad: (slot) => {
    startMenu.hide();
    toast.show(`Load slot ${String(slot)}`);
  },
});
const scores = createScoresSheet(ui);
const gameMenu = createGameMenu(ui, {
  confirm,
  getSaves: () => sampleSaves,
  onScores: () => scores.open(game, 0),
  onSave: (slot) => toast.show(`Saved to slot ${slot}`),
  onLoad: (slot) => toast.show(`Load ${String(slot)}`),
  onMainMenu: () => toast.show('Main menu'),
});
const endScreen = createEndScreen(ui, {
  onNewGame: () => toast.show('New game'),
  onLookAtMap: () => toast.show('Look at the map'),
});
document.querySelector('.resource-bar__scroll')?.prepend(createMenuButton(() => gameMenu.open()));

addControl('Start menu', () => startMenu.show());
addControl('Start menu: no saves', () => {
  startMenu.setSaves([]);
  startMenu.show();
});
addControl('Game menu', () => gameMenu.open());
addControl('Scores', () => scores.open(game, 0));
addControl('End: victory', () => {
  const s = createGameState('preview', { settings: { aiCount: 3 } });
  s.result = { winner: 0, reason: 'wonder', turn: 64 };
  endScreen.show(s);
});
addControl('End: defeat', () => {
  const s = structuredClone(game);
  s.result = { winner: 1, reason: 'points', turn: 120 };
  endScreen.show(s);
});
addControl('End: last city fell', () => {
  const s = structuredClone(game);
  s.result = { winner: null, reason: 'eliminated', turn: 47 };
  endScreen.show(s);
});
addControl('Turn summary: rivals', () => {
  const lines = eventLines({ ...game, events: sampleEvents }, 0);
  lines.forEach((line, i) => window.setTimeout(() => toast.show(line.text, line.kind), i * 3200));
});
