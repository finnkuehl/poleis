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
- **Buildings:** ~~a miniature standing on a small round base~~ – changed after the first
  playtest: buildings stand **directly on the map** (see "Grounded buildings" below).
- **Units:** a figure on a round token in the owner's color (board-game piece) – kept, units are
  pieces you pick and move.
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
- **Base:** ~~every building stands on a round diorama base~~ – replaced, see "Grounded buildings".
- **Owner color versions:** each building/unit comes as two layers with the same canvas:
  `<id>.svg` (the art; color-neutral parts) and `<id>.accent.svg` (only the parts in the owner's
  color – a few per-building touches such as banners, shutters, awnings, painted doors and
  friezes, shields, crests or sails (grounded buildings have no rim band any more) – drawn in **neutral greys with their light and shade**, so the game
  can tint them with the player color: PixiJS `sprite.tint` on the map, a CSS mask in the UI).
  This gives every civilization slightly different-looking cities and armies.
  **Draw order: the accent layer goes UNDER the art.** The art file has transparent holes exactly
  where the accents are (the library punches them automatically), so anything in front of an
  accent hides it and trims/shadows painted later sit on top of the tinted color. In PixiJS:
  a container `[accentSprite (tint = player color), artSprite]`; in CSS: the accent image with a
  player-color layer in `mix-blend-mode: multiply` masked by the accent, then the art on top.
- **Canvas and anchor (fixed, the game relies on it):**
  - Buildings: `viewBox="0 0 256 256"`; the **ground point under the building's center** is at
    **(128, 176)** and **208 canvas units** equal 0.92 × the hex width (the old base's width, kept as
    the scale reference). The game puts that point on the tile center; the building rises above it
    and may overlap the tile above (the game sorts by row).
  - Units: `viewBox="0 0 128 128"`; a small round base/token whose top ellipse center is at
    **(64, 96)** and which is **88 wide**; the figure stands on it. The game scales it to 0.62 × the
    hex width.
- **Legibility:** buildings must read at **40 px** and units at **32 px** (silhouette + one bold
  color). Keep file sizes reasonable (aim < 150 KB per SVG); the game rasterizes each SVG once.
- **Goods icons** (`public/assets/goods/`, 64 × 64) stay **flat icons** (best for 20 px UI), with the
  palette above; they are not part of the diorama style.
- **Generator:** the art is produced by small Python 3 scripts (standard library only) in
  `tools/art/` that print plain SVG – re-run them to regenerate an asset.

## Grounded buildings (decided with the user after the first playtest of V1)

The round plateaus made every building a separate figurine, so a city looked like a shelf of
toys, and the fishery brought its own water that never matched the coast. New rules:

- **No base.** A building stands directly on its tile. The art file contains only the building and
  its props (fences, carts, stacks, a tree or two) with soft contact and cast shadows on a
  **transparent** ground – no grass disc, no earth side, no rim band.
- **Ground under a building is drawn by the game** (`src/render/`), in map space and fitted to the
  hex, so it blends into the tile's terrain and joins its neighbors: trodden-earth yards, paved
  plazas, a forest clearing, a quarry pit. The map's own trees, rocks and flowers make room
  inside that patch and stay around it.
- **Owner color = colored details only** (shutters, awnings, banners, roof trim, sails). The
  territory border already shows whose land it is (you can only build on your own land).
- **Fields fill their tile:** farm, vineyard and olive grove ground (furrows, vine rows, orchard
  rows) is drawn by the game across the whole hex, and neighboring fields join up.
- **No footpaths between buildings** (tried and dropped: straight paths from tile to tile looked
  like a grid). Buildings are connected by the roads the player builds; between buildings there is
  only the terrain, garden beds and the soft yards.
- **Water-facing buildings use the real water:** the fishery is ONE drawn 3D scene (hut on the
  shore, wooden jetty, moored boat) in **6 direction versions** `fishery.e0.svg` … `fishery.e5.svg`
  (edge 0 = east, then clockwise in 60° steps). The game picks the version whose jetty reaches into
  the neighboring water tile; there is no painted water in the art. (A flat jetty drawn in code was
  tried and looked much worse than the drawn scene.) `fishery.svg` stays as the compact icon. The
  harbor (M6) will work the same way.
- **One human scale for all buildings** (decided after the user saw the test town: the house was
  bigger than the temple). Doors, windows and people have the same size on every building;
  the buildings differ in footprint, ordered by importance. World units of `tools/art/iso.py`:

  | Size | Main body (longest side) | Buildings |
  |---|---|---|
  | Human scale | door 16 high × 9 wide, window ~8 × 7, person ~14, one storey ~20 | all |
  | Small | 32–44 | farmhouse, fisher's hut, woodcutter's cabin, vineyard/olive-grove shed, border tower (narrow but tall) |
  | Modest | 44–54 | house (plus a courtyard wall, shed or pergola so the tile still feels lived in) |
  | Medium | 50–64 | sawmill, bakery, oil press, winery, smelter, quarry/mine works |
  | Large | 64–80 | storehouse, barracks, marketplace |
  | Major | 70–90 | temple, city center (the city's heart, never smaller than the temple) |
  | Monumental | up to the canvas | wonder |
- **Map:** soft blending between terrain types (no visible hex patchwork; tile edges only faintly
  visible for tapping), a curvier coast with rocks, small cliffs and a few boats.

## Terrain (drawn in code, `src/render/`)

Terrain stays procedural (PixiJS Graphics), drawn once (rows are repainted only when buildings
change what stands on them). Same light direction; soft, painted look: one flat color per
terrain with large, soft light/dark washes from a smooth noise over the whole map (no per-tile
shade, so no hex patchwork), wavy organic edges between different terrains that are identical
from both tiles, with tongues of color bleeding across, and small details
(grass tufts, umbrella pines and cypresses, rolling hills, rocky peaks with snow, sandy beaches
where land meets water, foam and wave lines on the coast, darker deep ocean). Tile outlines
are faint. Everything must stay smooth (60 fps) on a 40 × 40 map on a mid-range phone.

## Where the art comes from

All graphics are original work made for Poleis (no downloads). Origin and license of every
asset are listed in `ASSETS.md`.
