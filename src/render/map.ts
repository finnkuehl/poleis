// Map view: the painted terrain (drawn once, statically) with the dynamic layers above it.
import { Container, Graphics } from 'pixi.js';
import { inBounds } from '../core/map';
import { visibleTiles } from '../core/rules/vision';
import { hexCorners, hexToPixel, type Hex } from '../core/hex';
import type { BuildingStatus } from '../core/rules/production';
import type { GameState, MapState, PlayerId } from '../core/state';
import { NO_ART, type ArtSet } from './art';
import { mapWorldBounds } from './bounds';
import type { Rect } from './camera';
import { hexSize } from './config';
import { createEconomyLayers } from './economyLayers';
import { roadGeometry } from './geometry';
import { createGroundLayer } from './groundLayer';
import { footprintSignature, groundFootprints, unitFootprints } from './groundworks';
import { createOrderLayers, type OrderPath } from './orderLayers';
import { playerColorOf } from './playerColor';
import { createTerrainLayer } from './terrainLayer';
import { createUnitLayers } from './unitLayers';
import { theme } from './theme';

export { mapWorldBounds };

/** Tiles `viewer` has explored (none if the player is unknown). */
function exploredBy(state: GameState, viewer: PlayerId): readonly boolean[] {
  return state.players.find((p) => p.id === viewer)?.explored ?? [];
}

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

/**
 * `art`: the loaded building, unit and terrain art (see art.ts); without it the map uses plates
 * and emoji, and the terrain its own painted trees.
 */
export function createMapView(map: MapState, art: ArtSet = NO_ART): MapView {
  const container = new Container();
  // Static painted terrain, built once (see terrainLayer.ts), with the drawn trees and shrubs
  const terrain = createTerrainLayer(map, hexSize, art.terrain);
  // Ground under the buildings (yards, plazas, fields, the fishery's sandy yard), see groundLayer.ts
  const ground = createGroundLayer(hexSize);
  const selection = new Graphics();
  const economy = createEconomyLayers(art);
  const unitLayers = createUnitLayers(art);
  const orders = createOrderLayers();
  /** Test option "no fog"; the ground footprints use the same filter as the buildings. */
  let revealAll = false;
  /** Key of the footprints last sent to the terrain (it repaints only when they change). */
  let footprintKey = '';

  // Terrain rows (trees, hills' texture, mountains) sort together with the buildings: a
  // mountain in front covers a building behind it and the other way round
  for (const row of terrain.rows) economy.sorted.addChild(row);

  container.addChild(
    terrain.ground,
    ground.layer,
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
      ground.update(state, viewer);
      // The terrain makes room (no trees, rocks, flowers) where the ground under a building lies,
      // and its trees, shrubs and rocks step aside under the units the viewer can see (the same
      // filter as the unit sprites, so no hidden unit shows through a gap in the forest)
      const visible = revealAll ? null : visibleTiles(state, viewer);
      const footprints = [
        ...groundFootprints(state, viewer, revealAll, hexSize),
        ...unitFootprints(state, viewer, revealAll, hexSize, visible),
      ];
      const key = footprintSignature(footprints);
      if (key !== footprintKey) {
        footprintKey = key;
        terrain.setFootprints(footprints);
      }
      // ... keeps its trees and shrubs off the roads, and shows nothing on unexplored tiles
      terrain.setRoads(roadGeometry(state));
      terrain.setExplored(revealAll ? null : exploredBy(state, viewer));
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
