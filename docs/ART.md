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
(a painted seamless grass texture on meadows with drifts of poppies, chamomile and buttercups,
clover, lush and dry patches, stones and the odd shrub or lone tree; umbrella pines and
cypresses; golden hill country that fills its tiles and rolls into neighboring hills, with its
mounds placed between the road corridors so roads always run through valleys, faceted mountain massifs joined into ranges with snow, terraces under
buildings on slopes, sandy beaches where land meets water, foam and wave lines on the coast,
darker deep ocean). Hill shading uses three tiny shared textures (soft spot, mound shading,
rock-face gradient) stretched and tinted per shape; standing terrain (trees, massifs) is drawn in
one row layer per map row, sorted together with the buildings. Tile outlines
are faint. Everything must stay smooth (60 fps) on a 40 × 40 map on a mid-range phone.

### Hills and mountains (decided with the user after the grounded-buildings playtest)

- **Fill the whole tile and connect:** hills and mountains are no longer a few small shapes on a
  flat tile. They fill their tile and continue into neighboring tiles of the same kind (rolling
  hill country, mountain ranges with ridges and saddles from peak to peak), easing out toward
  other terrain.
- **Hills: golden Mediterranean** – sun-dried golden-green slopes, dark green maquis shrubs, a few
  olive trees, pale limestone rocks; lit from the upper left, shaded to the lower right.
- **Mountains: rocky ranges with snow** – big grey-brown faceted massifs with lit and shaded faces,
  strata, snow on the peaks, scree and boulders at the foot.
- **Buildings on slopes stand on a terrace:** the slope stays around the building (rising behind it);
  the building stands on a flat terrace cut into it with a small earth bank (hills) or stone edge
  (mountains) in front. A mine sits at the foot of its peak.
- **Mines and quarries dig into the real slope** (decided after the hills/mountains playtest): the
  mountain or hill stays whole; the game cuts a rock face (mine) or stepped terraces (quarry) into
  the terrain's own massif or hill, and the map art (`mine.slope.svg`, `quarry.slope.svg`) shows only
  the works: timber tunnel portal, rails, ore cart, spoil heap; crane, cut blocks, shed. No hollow
  and no second rock. `mine.svg` / `quarry.svg` stay as icons (and the quarry on plains).
- **Forests: dense woodland** of drawn trees in the building style (umbrella pines, cypresses, holm
  oaks; maquis shrubs and wild olives on hills): crowns overlap into a continuous canopy that fills
  the tile and joins neighboring forest tiles, with single trees and shrubs at the forest edge.
  Tree art lives in `public/assets/terrain/` (same world scale as the buildings, no owner color).
- **Units:** keep their token; trees and shrubs make room under it, the token sits on the ground
  with a soft shadow, and on a tile with a building the unit stands at the front of the tile.
- **Mine in a rock niche** (after the next playtest): the mountain's flanks reach forward on both
  sides of the mine, so the works sit in a niche cut into the massif; in front a scree slope with
  boulders, never a flat grey floor.
- **Coast mountains drop into the sea:** cliff faces plunge straight into the water with surf at
  their foot, no beach in front.
- **Towns share one ground** (the user compared both versions in the game and chose it):
  neighboring buildings of one owner form a town area with one continuous packed-earth ground
  (organic outer edge, soft rim, low dry-stone walls on some outer edges), lanes from the city
  center to the buildings, stone paving around the city center, and small gardens, wells or trees
  in some gaps. No separate round yards inside a town; single buildings keep their own yard.
  Fields next to a town fade into the town ground.
- **Fields on hills lie on top of the slopes:** a vineyard or olive grove on a hill does not flatten
  it; the hill keeps its rolling shape (no terrace bank), its light and shade show through the
  fields, and rows and trees follow the slopes.
- **Fields join only their own kind** (farm with farm, vineyard with vineyard); between different
  kinds a grass strip or hedge. The olive grove stands on green orchard grass, not on a sandy patch.
- **Roads: worn gravel tracks** that bend smoothly through the tiles (textured meshes, materials
  from small shared textures): a light gravel track on a darker compacted shoulder, two subtle wheel
  ruts lit from the upper left, one width; junctions merge into one worn place without ruts; dead
  ends and yard roads fade out; on hills the road is cut into the slope (lit and shaded banks with
  a sunlit lip); on and next to a city center limestone slab paving with edge stones, ending cleanly
  in the plaza, small hexagonal paved squares where paved roads meet, and a row of edge stones where
  paving turns into gravel.
- **Units: richer single figures:** one bigger, more detailed figure per unit with a strong pose,
  owner color on tunic, cloak and shield emblem, bronze helmet with crest, visible weapons, standing
  on an ornate bronze token with an owner-colored enamel ring.
- **Draw order:** terrain shapes and buildings are sorted together by row, so a mountain in front
  covers a building behind it and vice versa. Units stay on top.

### Seafaring and ocean (decided with the user at the start of M6)

- **Harbor:** drawn like the fishery, as one scene in 6 direction versions facing the real water
  (stone quay, crane, warehouse, amphorae); the game picks the version toward the coastal water.
- **Ocean: static, richer painting** – depth, wave patterns, sun glints, foam and reefs, painted
  once (no moving water for now; movement may come with the M7 animation step).
- **Ships** use the unit art (transport, trireme) on their water tokens; passengers show as a small
  marker on the ship.

## Where the art comes from

All graphics are original work made for Poleis (no downloads). Origin and license of every
asset are listed in `ASSETS.md`.
