# Poleis – Art direction

> Shared style guide for all game graphics (M7). Every new icon, building, unit or terrain
> drawing follows it, so the pieces look like one world.

## Idea: painted Aegean miniatures

The map is a sunlit tabletop of the ancient Aegean. Buildings and units look like small
**painted figurines** standing on it: whitewashed marble walls, terracotta roofs, bronze,
olive wood and linen. The light comes from the **upper left**; every object casts a short,
soft shadow to the lower right. Shapes are simple and chunky so they read on a phone at
small sizes – think of a carefully painted board-game piece, not a detailed illustration.

One bold thing per object (a red roof, a bronze shield, a blue awning), everything else calm.

## Decisions (with the user, M7)

- **Style:** painted miniatures on a sunlit tabletop map.
- **Buildings:** a miniature standing on a small round base in the owner's color.
- **Units:** a figure on a round token in the owner's color (board-game piece).
- **Landscape:** rich and lively (beaches, waves, Mediterranean trees, rolling hills, snowy peaks).
- **Mood:** **bright Mediterranean** – sunny and warm, clearly more saturated than the first
  procedural map: turquoise coast, golden fields, white houses, red roofs, deep blue sea.
- **UI icons:** the drawn art replaces the emoji everywhere (map, resource bar, overview,
  build menu, panels, training lists), so the game looks the same on every phone.

## Palette (hex)

| Name | Hex | Use |
|---|---|---|
| Ink | `#1d2b36` | outlines, darkest shadow |
| Marble | `#eceee8` | walls, columns, light stone |
| Marble shade | `#c9cdc2` | shadow side of marble |
| Terracotta | `#b5523b` | roof tiles, amphorae |
| Terracotta shade | `#8a3b2a` | shadow side of roofs |
| Bronze | `#b0793a` | bronze metal, shields, coins |
| Bronze light | `#d9a35a` | highlights on metal |
| Verdigris | `#3e7d6b` | aged bronze, UI accent |
| Olive | `#6f7d3a` | leaves, olive trees, vines |
| Olive dark | `#4a5a26` | leaf shadow |
| Wheat | `#d9b45a` | grain, straw, bread crust |
| Wood | `#8a5a34` | timber, logs, tools |
| Wood dark | `#5e3b22` | shadow side of wood |
| Aegean blue | `#2e6da4` | water details, awnings |
| Turquoise | `#3fb3b8` | shallow coastal water (bright mood) |
| Sea deep | `#1e5f8a` | open ocean (bright mood) |
| Meadow | `#9cc25a` | sunny plains (bright mood) |
| Sand | `#e8d29a` | beaches |
| Wine | `#7a2a3a` | wine, grapes |
| Stone grey | `#8a8178` | rock, ore, mountains |

Player colors are **not** baked into the art: buildings stand on a small base and units on a
token that the game draws in the player's color (Tyrian purple, cinnabar, Aegean blue, gold).
Units may carry a neutral bronze shield; the colored token around them shows the owner.

## Drawing rules (SVG)

- **Files:** `public/assets/goods/<goodId>.svg`, `public/assets/buildings/<buildingId>.svg`,
  `public/assets/units/<unitId>.svg` – ids exactly as in `src/data/` (e.g. `oliveGrove`,
  `cityCenter`). Plain SVG 1.1, no scripts, no external references, no embedded raster images,
  no text/fonts.
- **Canvas:** goods icons `viewBox="0 0 64 64"`; buildings and units `viewBox="0 0 96 96"`.
  Transparent background. Keep ~4 units of padding; buildings sit on an implied ground line
  around y = 80 and are drawn in a slight three-quarter view (front face + roof/top visible).
- **Outline:** one ink outline around each shape, `stroke="#1d2b36"`, width 2.5 (icons) / 3
  (buildings, units), `stroke-linejoin="round"`, `stroke-linecap="round"`. Inner detail lines
  thinner (1.5–2) or as darker fills.
- **Shading:** flat two-tone: base color + shadow side (right/bottom) in the "shade" color, plus
  at most one small light highlight (top/left). At most one simple linear gradient per object.
- **Shadow:** buildings and units get a soft ground shadow: an ellipse in ink at 20–25 % opacity
  offset to the lower right, under the object.
- **Legibility:** goods icons must be recognisable at **20 px**; buildings at **40 px**; units at
  **32 px**. One clear silhouette each – if two icons look alike at 20 px, change one.
- **Consistency:** same outline width, same light direction, same palette across a set.
  Differences between buildings come from silhouette and the one bold color, not from style.

## Terrain (drawn in code, `src/render/`)

Terrain stays procedural (PixiJS Graphics), drawn once. Same light direction; soft, painted
look: subtle color variation per tile (deterministic, from the tile position), small details
(grass tufts, umbrella pines and cypresses, rolling hills, rocky peaks with snow, sandy beaches
where land meets water, foam and wave lines on the coast, darker deep ocean). Tile outlines
are faint. Everything must stay smooth (60 fps) on a 40 × 40 map on a mid-range phone.

## Where the art comes from

All graphics are original work made for Poleis (no downloads). Origin and license of every
asset are listed in `ASSETS.md`.
