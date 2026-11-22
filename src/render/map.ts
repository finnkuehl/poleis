// Map view: the painted terrain (drawn once, statically) with the dynamic layers above it.
import { Container, Graphics } from 'pixi.js';
import { inBounds } from '../core/map';
import { hexCorners, hexToPixel, type Hex } from '../core/hex';
import type { BuildingStatus } from '../core/rules/production';
import type { GameState, MapState, PlayerId } from '../core/state';
import { NO_ART, type ArtSet } from './art';
import { mapWorldBounds } from './bounds';
import type { Rect } from './camera';
import { hexSize } from './config';
import { createEconomyLayers } from './economyLayers';
import { createGroundLayer } from './groundLayer';
import { groundFootprints } from './groundworks';
import { createOrderLayers, type OrderPath } from './orderLayers';
import { playerColorOf } from './playerColor';
import { createTerrainLayer } from './terrainLayer';
import { createUnitLayers } from './unitLayers';
import { theme } from './theme';

export { mapWorldBounds };

export interface MapView {
  container: Container;
  bounds: Rect;
  /** Redraws the dynamic layers (territory, roads, buildings, badges, the ground under buildings). */
  update(state: GameState, statuses: Record<number, BuildingStatus>, viewer?: PlayerId): void;
  /** Red outlines on attack targets; [] clears. */
  setAttackTargets(hexes: readonly Hex[]): void;
  setSelection(h: Hex | null): void;
  /** Test option: no fog, enemy units and buildings drawn everywhere. Takes effect on the next update. */
  setRevealAll(value: boolean): void;
  /** Ghost token at world position; null hides it. */
  setGhost(unit: { type: string; owner: number } | null, x?: number, y?: number): void;
  /** Highlights valid tiles; [] clears. */
  setHighlights(hexes: readonly Hex[]): void;
  /** Road preview along `path`, dots on `newTiles`; null clears. */
  setPathPreview(path: readonly Hex[] | null, newTiles: readonly Hex[]): void;
  /** Draws move-order paths; [] clears. */
  setOrderPaths(paths: readonly OrderPath[]): void;
}

/** `art`: the loaded building and unit art (see art.ts); without it the map uses plates and emoji. */
export function createMapView(map: MapState, art: ArtSet = NO_ART): MapView {
  const container = new Container();
  // Static painted terrain, built once (see terrainLayer.ts)
  const terrain = createTerrainLayer(map, hexSize);
  // Ground under the buildings (yards, plazas, fields, the fishery's sandy yard), see groundLayer.ts
  const ground = createGroundLayer(hexSize);
  const selection = new Graphics();
  const economy = createEconomyLayers(art);
  const unitLayers = createUnitLayers(art);
  const orders = createOrderLayers();
  /** Test option "no fog"; the ground footprints use the same filter as the buildings. */
  let revealAll = false;

  container.addChild(
    terrain.ground,
    ground.layer,
    terrain.details,
    ...economy.below,
    unitLayers.units,
    unitLayers.fog,
    orders.layer,
    ...economy.above,
    unitLayers.attack,
    selection,
    unitLayers.ghost,
  );

  return {
    container,
    bounds: mapWorldBounds(map, hexSize),
    setRevealAll(value) {
      revealAll = value;
      economy.setRevealAll(value);
      ground.setRevealAll(value);
      unitLayers.setRevealAll(value);
    },
    update(state, statuses, viewer = 0) {
      economy.update(state, statuses, viewer);
      // The terrain makes room (no trees, rocks, flowers) where the ground under a building lies
      if (ground.update(state, viewer)) {
        terrain.setFootprints(groundFootprints(state, viewer, revealAll, hexSize));
      }
      orders.setColor(playerColorOf(state, viewer));
      unitLayers.update(state, viewer);
    },
    setAttackTargets: unitLayers.setAttackTargets,
    setGhost: unitLayers.setGhost,
    setHighlights: economy.setHighlights,
    setPathPreview: economy.setPathPreview,
    setOrderPaths: orders.setOrderPaths,
    setSelection(h) {
      selection.clear();
      if (!h || !inBounds(map, h)) return;
      const corners = hexCorners(hexToPixel(h, hexSize), hexSize).flatMap((p) => [p.x, p.y]);
      selection
        .poly(corners)
        .fill({ color: theme.selectionColor, alpha: theme.selectionFillAlpha })
        .stroke({
          color: theme.selectionOuterColor,
          width: theme.selectionOuterWidth,
          join: 'round',
        })
        .poly(corners)
        .stroke({ color: theme.selectionColor, width: theme.selectionWidth, join: 'round' });
    },
  };
}
