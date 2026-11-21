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
