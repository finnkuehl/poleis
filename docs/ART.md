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

## Chosen direction: V1 isometric diorama (decided with the user after the keyframes)

Three keyframes were made (V1 isometric diorama, V2 painterly storybook, V3 sculpted low-poly);
the user chose **V1**. The flat "ink outline" rules of the first draft no longer apply to
buildings and units. Reference keyframe: house and temple by `tools/art/` (see below).

- **Geometry:** true **2:1 dimetric (isometric)** projection; every face drawn in its own face
  coordinates and placed with one SVG `matrix()`. Light from the upper left: tops lit, left faces a
  warm mid tone, right faces in cool shade with a warm-green bounce.
- **No black outlines.** Edges come from value contrast and thin darker same-hue lines.
- **Soft light:** gradients per face, ambient occlusion where walls meet the ground and under eaves,
  a projected cast shadow on the base, a soft drop shadow under the base (modest `feGaussianBlur`).
- **Materials:** whitewashed lime walls, barrel roof tiles in terracotta rows, marble with
  fluting, bronze and gold accents, blue shutters/awnings, olive trees and cypresses as props.
- **Base:** every building stands on a round diorama base: grass top (tufts, flowers), earth side
  with strata, and a **rim band in the owner's color** (thick enough to read at 40 px).
- **Owner color versions:** each building/unit comes as two layers with the same canvas:
  `<id>.svg` (the art; color-neutral parts) and `<id>.accent.svg` (only the parts in the owner's
  color – the base rim band plus a few per-building touches such as banners, shutters, awnings,
  shields, crests or sails – drawn in **neutral greys with their light and shade**, so the game
  can tint them with the player color: PixiJS `sprite.tint` on the map, a CSS mask in the UI).
  This gives every civilization slightly different-looking cities and armies.
- **Canvas and anchor (fixed, the game relies on it):**
  - Buildings: `viewBox="0 0 256 256"`; the center of the base's top ellipse is at **(128, 176)**
    and the base's top ellipse is **208 wide** (x 24 → 232). The game scales the image so this
    width is 0.92 × the hex width and puts that center on the tile center; the building rises
    above it and may overlap the tile above (the game sorts by row).
  - Units: `viewBox="0 0 128 128"`; a small round base/token whose top ellipse center is at
    **(64, 96)** and which is **88 wide**; the figure stands on it. The game scales it to 0.62 × the
    hex width.
- **Legibility:** buildings must read at **40 px** and units at **32 px** (silhouette + one bold
  color). Keep file sizes reasonable (aim < 150 KB per SVG); the game rasterizes each SVG once.
- **Goods icons** (`public/assets/goods/`, 64 × 64) stay **flat icons** (best for 20 px UI), with the
  palette above; they are not part of the diorama style.
- **Generator:** the art is produced by small Python 3 scripts (standard library only) in
  `tools/art/` that print plain SVG – re-run them to regenerate an asset.

## Terrain (drawn in code, `src/render/`)

Terrain stays procedural (PixiJS Graphics), drawn once. Same light direction; soft, painted
look: subtle color variation per tile (deterministic, from the tile position), small details
(grass tufts, umbrella pines and cypresses, rolling hills, rocky peaks with snow, sandy beaches
where land meets water, foam and wave lines on the coast, darker deep ocean). Tile outlines
are faint. Everything must stay smooth (60 fps) on a 40 × 40 map on a mid-range phone.

## Where the art comes from

All graphics are original work made for Poleis (no downloads). Origin and license of every
asset are listed in `ASSETS.md`.
