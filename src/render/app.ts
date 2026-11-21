// PixiJS application: canvas, map view, camera and tile selection.
import { Application, Container } from 'pixi.js';
import { hexToPixel, pixelToHex, type Hex } from '../core/hex';
import { inBounds } from '../core/map';
import type { BuildingStatus } from '../core/rules/production';
import type { GameState, PlayerId } from '../core/state';
import { CameraController, screenToWorld } from './camera';
import { hexSize, startHexScreenRadiusPx } from './config';
import { createMapView } from './map';
import { theme } from './theme';

export interface Renderer {
  app: Application;
  /** Redraws everything from `viewer`'s perspective (fog of war, visible enemy units). */
  setState(state: GameState, statuses: Record<number, BuildingStatus>, viewer?: PlayerId): void;
  /** Red outlines on attack targets; [] clears. */
  setAttackTargets(hexes: readonly Hex[]): void;
  selectTile(h: Hex | null): void;
  /** Highlights valid tiles; [] clears. */
  setHighlights(hexes: readonly Hex[]): void;
  /** Road preview along `path` (dots on `newTiles`); null clears. */
  setPathPreview(path: readonly Hex[] | null, newTiles?: readonly Hex[]): void;
  /** Centers the view on `h`; a hex gets the given screen radius (clamped to the zoom limits). */
  centerOn(h: Hex, hexScreenRadiusPx?: number): void;
  /** Pans (zoom unchanged) so that `h` appears at the screen point (sx, sy). */
  centerOnScreenPoint(h: Hex, sx: number, sy: number): void;
}

export async function createRenderer(
  container: HTMLElement,
  state: GameState,
  onTileTap: (h: Hex | null) => void,
): Promise<Renderer> {
  const app = new Application();
  await app.init({
    background: theme.background,
    resizeTo: window,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  container.appendChild(app.canvas);

  const world = new Container();
  app.stage.addChild(world);
  const view = createMapView(state.map);
  world.addChild(view.container);

  const selectTile = (h: Hex | null): void => view.setSelection(h);

  const controller = new CameraController(app.canvas, world, {
    world: view.bounds,
    hexSize,
    onTap: (sx, sy) => {
      const w = screenToWorld(controller.state, sx, sy);
      const h = pixelToHex(w, hexSize);
      // The caller decides what to select; outside the map -> null
      onTileTap(inBounds(state.map, h) ? h : null);
    },
  });
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
    setState: view.update,
    selectTile,
    setHighlights: view.setHighlights,
    setAttackTargets: view.setAttackTargets,
    setPathPreview: (path, newTiles = []) => view.setPathPreview(path, newTiles),
    centerOn,
    centerOnScreenPoint,
  };
}
