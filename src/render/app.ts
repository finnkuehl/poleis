// PixiJS application: canvas, map view, camera and tile selection.
import { Application, Container, CullerPlugin, extensions } from 'pixi.js';
import { hexToPixel, pixelToHex, type Hex } from '../core/hex';
import { inBounds } from '../core/map';
import type { BuildingStatus } from '../core/rules/production';
import type { GameState, PlayerId } from '../core/state';
import { loadArt } from './art';
import { CameraController, screenToWorld } from './camera';
import { hexSize, startHexScreenRadiusPx } from './config';
import { createMapView } from './map';
import type { OrderPath } from './orderLayers';
import { theme } from './theme';

/** Optional hooks for dragging a unit; `h` is the hex under the pointer (null outside the map). */
export interface DragHandlers {
  /** `h` is the hex at the press position; return true to start a unit drag. */
  onStart(h: Hex | null, sx: number, sy: number): boolean;
  onMove(h: Hex | null, sx: number, sy: number): void;
  onEnd(h: Hex | null, sx: number, sy: number): void;
  onCancel(): void;
}

export interface Renderer {
  app: Application;
  /** Redraws everything from `viewer`'s perspective (fog of war, visible enemy units). */
  setState(state: GameState, statuses: Record<number, BuildingStatus>, viewer?: PlayerId): void;
  /** Red outlines on attack targets; [] clears. */
  setAttackTargets(hexes: readonly Hex[]): void;
  selectTile(h: Hex | null): void;
  /** Test option: shows the whole map (no fog, all units and buildings); takes effect on the next setState. */
  setRevealAll(value: boolean): void;
  /** Highlights valid tiles; [] clears. */
  setHighlights(hexes: readonly Hex[]): void;
  /** Road preview along `path` (dots on `newTiles`); null clears. */
  setPathPreview(path: readonly Hex[] | null, newTiles?: readonly Hex[]): void;
  /** Draws move-order paths (faint for units on their way, active for the selected one); [] clears. */
  setOrderPaths(paths: readonly OrderPath[]): void;
  /** Centers the view on `h`; a hex gets the given screen radius (clamped to the zoom limits). */
  centerOn(h: Hex, hexScreenRadiusPx?: number): void;
  /** Ghost token of `unitId` at the screen position; null hides it. */
  setDragGhost(unitId: number | null, sx?: number, sy?: number): void;
  /** Hex under a screen position, null outside the map. */
  screenToHex(sx: number, sy: number): Hex | null;
  /** Pans (zoom unchanged) so that `h` appears at the screen point (sx, sy). */
  centerOnScreenPoint(h: Hex, sx: number, sy: number): void;
}

/** The culler extension is registered globally, only once. */
let cullerAdded = false;

export async function createRenderer(
  container: HTMLElement,
  state: GameState,
  onTileTap: (h: Hex | null) => void,
  drag?: DragHandlers,
): Promise<Renderer> {
  const resolution = Math.min(window.devicePixelRatio || 1, 2);
  // Load and rasterize the SVG art while the renderer starts (both before the first draw)
  const artLoading = loadArt(resolution);
  // Culling: every frame, objects marked `cullable` (the terrain's row slices) that lie off the
  // screen are skipped. Registered once, before the first application starts.
  if (!cullerAdded) {
    extensions.add(CullerPlugin);
    cullerAdded = true;
  }
  const app = new Application();
  await app.init({
    background: theme.background,
    resizeTo: window,
    antialias: true,
    autoDensity: true,
    resolution,
  });
  container.appendChild(app.canvas);
  const art = await artLoading;

  // The camera moves and scales this container; as its own render group, panning and zooming
  // only change the group's transform instead of every sprite and shape inside
  const world = new Container({ isRenderGroup: true });
  app.stage.addChild(world);
  const view = createMapView(state.map, art);
  world.addChild(view.container);

  const selectTile = (h: Hex | null): void => view.setSelection(h);

  let current = state;
  const screenToHex = (sx: number, sy: number): Hex | null => {
    const h = pixelToHex(screenToWorld(controller.state, sx, sy), hexSize);
    // Outside the map -> null
    return inBounds(current.map, h) ? h : null;
  };
  const controller: CameraController = new CameraController(app.canvas, world, {
    world: view.bounds,
    hexSize,
    // The caller decides what to select
    onTap: (sx, sy) => onTileTap(screenToHex(sx, sy)),
    onDragStart: drag ? (sx, sy) => drag.onStart(screenToHex(sx, sy), sx, sy) : undefined,
    onDragMove: drag ? (sx, sy) => drag.onMove(screenToHex(sx, sy), sx, sy) : undefined,
    onDragEnd: drag ? (sx, sy) => drag.onEnd(screenToHex(sx, sy), sx, sy) : undefined,
    onDragCancel: drag ? () => drag.onCancel() : undefined,
  });
  const setDragGhost = (unitId: number | null, sx = 0, sy = 0): void => {
    const unit = unitId === null ? undefined : current.units.find((u) => u.id === unitId);
    if (!unit) {
      view.setGhost(null);
      return;
    }
    const w = screenToWorld(controller.state, sx, sy);
    view.setGhost(unit, w.x, w.y);
  };
  controller.setViewport({ width: app.screen.width, height: app.screen.height });
  const centerOn = (h: Hex, radiusPx = startHexScreenRadiusPx): void => {
    const p = hexToPixel(h, hexSize);
    controller.centerOn(p.x, p.y, radiusPx / hexSize);
  };
  const centerOnScreenPoint = (h: Hex, sx: number, sy: number): void => {
    const p = hexToPixel(h, hexSize);
    const z = controller.state.zoom;
    // World point that has to sit in the viewport center so that p lands on (sx, sy).
    controller.centerOn(
      p.x + (app.screen.width / 2 - sx) / z,
      p.y + (app.screen.height / 2 - sy) / z,
      z,
    );
  };
  const city = state.buildings.find((b) => b.type === 'cityCenter' && b.owner === 0);
  if (city) centerOn(city.hex);
  else controller.fit();
  app.renderer.on('resize', (w: number, h: number) => {
    controller.setViewport({ width: w, height: h });
  });

  return {
    app,
    setState: (s, statuses, viewer) => {
      current = s;
      view.update(s, statuses, viewer);
    },
    setDragGhost,
    screenToHex,
    selectTile,
    setRevealAll: view.setRevealAll,
    setHighlights: view.setHighlights,
    setAttackTargets: view.setAttackTargets,
    setPathPreview: (path, newTiles = []) => view.setPathPreview(path, newTiles),
    setOrderPaths: view.setOrderPaths,
    centerOn,
    centerOnScreenPoint,
  };
}
export type { OrderPath } from './orderLayers';
