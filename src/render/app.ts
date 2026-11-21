// PixiJS-Anwendung: erzeugt den Canvas und zeichnet (vorerst) nur den Titel.
import { Application, Text } from 'pixi.js';
import { de } from '../i18n/de';
import { theme } from './theme';

export async function createRenderer(container: HTMLElement): Promise<Application> {
  const app = new Application();
  await app.init({
    background: theme.background,
    resizeTo: window,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  container.appendChild(app.canvas);

  const title = new Text({
    text: de.gameTitle,
    style: {
      fill: theme.titleColor,
      fontFamily: theme.fontFamily,
      fontSize: 48,
    },
  });
  title.anchor.set(0.5);
  app.stage.addChild(title);

  // Titel mittig setzen und Schriftgröße an die kürzere Bildschirmseite anpassen
  const layout = (): void => {
    const { width, height } = app.screen;
    title.style.fontSize = Math.round(Math.min(width, height) * theme.titleSizeRatio);
    title.position.set(width / 2, height / 2);
  };
  layout();
  app.renderer.on('resize', layout);

  return app;
}
