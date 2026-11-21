# Poleis

Poleis is a turn-based city-building strategy game set in antiquity on a hex map. You build cities, goods chains and roads, and compete against 1–3 AI civilizations. It runs in the browser, mobile first, but also on desktop.

**Play online:** https://finnkuehl.github.io/poleis/ (available after the first merge into `main`)

## Requirements

- Node.js 22 (LTS)

## Getting started

```
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

The game opens with the start menu: continue the autosaved game, load one of 3 saved games, or start a new one (name, color, 1–3 rival civilizations, map size, seed, victory types).

**Useful address options (for testing):**
- `?seed=123` (or `?seed=athens`) – pre-fills the seed in the start menu; the same seed always makes the same map.
- `&sandbox` – test mode, skips the menu: a large stock of goods and a passive enemy city, e.g. `?seed=1&sandbox`. The seed label shows "(test mode)". Not autosaved.
- `&ai=3` / `&size=small|normal|large` – skip the menu and start directly with that many AI rivals / that map size, e.g. `?seed=1&ai=3`.

## Testing on a phone over Wi-Fi

```
npm run dev -- --host
```

Open the "Network" address from the terminal on your phone (phone and computer on the same Wi-Fi).

## Commands

| Command                 | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `npm install`           | Install dependencies                           |
| `npm run dev`           | Start the dev server (http://localhost:5173)   |
| `npm run dev -- --host` | Make the dev server reachable over Wi-Fi       |
| `npm run build`         | Build the production version into `dist/`      |
| `npm test`              | Run tests                                      |
| `npm run lint`          | Check code quality                             |
| `npm run typecheck`     | Check TypeScript types                         |

## Project structure

- `src/core/` – pure game logic (hex math, map generation, rules, actions, turns)
- `src/data/` – all balancing numbers
- `src/ai/` – AI players
- `src/render/` – drawing with PixiJS
- `src/ui/` – HTML/CSS user interface
- `src/save/` – saving and loading
- `src/i18n/` – all visible texts
- `docs/` – game design and progress

The balancing numbers live in `src/data/`.
