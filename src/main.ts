// Einstiegspunkt: startet die Darstellung und zeigt bei Fehlern eine Meldung.
import './style.css';
import { de } from './i18n/de';
import { createRenderer } from './render/app';

// iOS-Safari: Pinch-Zoom der ganzen Seite verhindern
document.addEventListener('gesturestart', (event) => event.preventDefault());

const appContainer = document.getElementById('app');
const uiContainer = document.getElementById('ui');

if (appContainer) {
  createRenderer(appContainer).catch((error: unknown) => {
    console.error(error);
    if (uiContainer) {
      const message = document.createElement('p');
      message.textContent = de.renderError;
      message.style.cssText =
        'color:#f4e9d8;font-family:Georgia,serif;padding:24px;text-align:center;';
      uiContainer.appendChild(message);
    }
  });
}
