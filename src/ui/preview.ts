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
import type { BuildingStatus } from '../core/rules/production';
import type { BuildingId } from '../data';

const ui = document.getElementById('ui');
const controls = document.getElementById('preview-controls');
if (!ui || !controls) throw new Error('Missing containers');

const stock = { ...emptyStock(), wood: 6, stone: 1, grain: 4, planks: 2 };

const bar = createResourceBar(ui);
bar.update(stock, { wood: 2, stone: -1, grain: 3, planks: 0, bread: 1 }, 3, 120);
createSeedLabel(ui, '12345');
const toast = createToast(ui);
const panel = createTileInfoPanel(ui, () => toast.show('Panel closed'));
const confirm = createConfirmSheet(ui);
const banner = createModeBanner(ui, () => {
  banner.hide();
  bottom.setMode('idle');
});
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
    menu.open(stock);
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
