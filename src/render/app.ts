// PixiJS-Anwendung: Canvas, Kartenansicht, Kamera und Feldauswahl.
import { Application, Container } from 'pixi.js';
import { hexEquals, pixelToHex, type Hex } from '../core/hex';
import { inBounds } from '../core/map';
import type { GameState } from '../core/state';
import { CameraController, screenToWorld } from './camera';
import { hexSize } from './config';
import { createMapView } from './map';
import { theme } from './theme';

export interface Renderer {
  app: Application;
  selectTile(h: Hex | null): void;
}

export async function createRenderer(
  container: HTMLElement,
  state: GameState,
  onSelect: (h: Hex | null) => void,
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

  let selected: Hex | null = null;
  const selectTile = (h: Hex | null): void => {
    selected = h;
    view.setSelection(h);
  };

  const controller = new CameraController(app.canvas, world, {
    world: view.bounds,
    hexSize,
    onTap: (sx, sy) => {
      const w = screenToWorld(controller.state, sx, sy);
      const h = pixelToHex(w, hexSize);
      if (!inBounds(state.map, h) || (selected && hexEquals(selected, h))) {
        selectTile(null);
        onSelect(null);
      } else {
        selectTile(h);
        onSelect(h);
      }
    },
  });
  controller.setViewport({ width: app.screen.width, height: app.screen.height });
  controller.fit();
  app.renderer.on('resize', (w: number, h: number) => {
    controller.setViewport({ width: w, height: h });
  });

  return { app, selectTile };
}
