// Dev-only preview of the UI components with sample data (open /ui-preview.html with `npm run dev`).
import '../style.css';
import './ui.css';
import { emptyStock } from '../core/rules/goods';
import { en } from '../i18n/en';
import {
  createBottomBar,
  createBuildMenu,
  createConfirmSheet,
  createModeBanner,
  createResourceBar,
  createSeedLabel,
  createTileInfoPanel,
  createToast,
} from './index';
import type { AdvanceCheck } from '../core/rules/advance';
import type { CityReport, CityStats } from '../core/rules/population';
import type { BuildingStatus, TurnReport } from '../core/rules/production';
import type { BuildingId, CityLevel, Stock } from '../data';
import { formatAdvanced, formatBought, formatSold } from '../i18n/format';
import { turnSummary } from './turnSummary';

const ui = document.getElementById('ui');
const controls = document.getElementById('preview-controls');
if (!ui || !controls) throw new Error('Missing containers');

const stock = { ...emptyStock(), wood: 6, stone: 1, grain: 4, planks: 2 };

const bar = createResourceBar(ui);
bar.update(
  { ...stock, drachmas: 7, grapes: 2, wine: 1 },
  { wood: 2, stone: -1, grain: 3, planks: 0, bread: 1, drachmas: 3 },
  3,
  120,
  { residents: 6, housing: 8 },
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
  return { turn: 5, player: 0, delta: {}, buildings: [], cities };
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
