# Poleis art generator (`tools/art/`)

All building and unit art of Poleis is **generated** by small Python 3 scripts (standard
library only) that print plain SVG. Style: isometric diorama miniatures, see `docs/ART.md`
("Chosen direction: V1" and "Grounded buildings"). Never edit the SVGs in
`public/assets/buildings/` or `public/assets/units/` by hand – edit the script and rebuild.

```
tools/art/
  iso.py            the shared library (projection, ground modes, light, materials, props, statues)
  units_lib.py      unit library on top of iso.py (bronze token, figure parts, animals, ships)
  buildings/<id>.py one script per building, named exactly like the id in src/data/
  units/<id>.py     one script per unit (see "Units" below)
  terrain/trees.py  the 13 tree and shrub sprites for forests and hills (see "Terrain trees" below)
  build_all.py      builds every script into public/assets/buildings/ and public/assets/units/
                    (a script's build() returns one Canvas or a list, e.g. the fishery variants)
  preview.py        review sheet: art + accent tinted in the four player colours, map sizes
```

## Run it

```sh
python3 tools/art/build_all.py                 # all buildings and units
python3 tools/art/build_all.py house hoplite   # only these ids
python3 tools/art/build_all.py trees           # the terrain trees -> public/assets/terrain/
python3 tools/art/buildings/house.py /tmp/out  # one script, into any folder

python3 tools/art/preview.py house temple --out /tmp/preview.svg
python3 tools/art/preview.py hoplite trireme --out /tmp/units.svg
qlmanage -t -s 1600 -o /tmp /tmp/preview.svg   # macOS: -> /tmp/preview.svg.png, open it
```

`build_all.py` prints each file with its size and warns above 150 KB. The scripts set
`sys.dont_write_bytecode`, so no `__pycache__` folders end up in the repo.

## Grounded buildings (and the old base)

Buildings **stand directly on the map** (docs/ART.md, "Grounded buildings"): the first call of a
building script is `iso.ground(c)`. It draws nothing – the ground stays **transparent**, and the
game paints the terrain and the building's ground patch (yard, paved plaza, forest clearing,
beach, fields) under it. The art contains only the building and its props, with their shadows:

- `iso.ground_ao(c, footprint)` first: a wide, very soft darkening around the whole group, so it
  sits *in* the ground instead of on top of it.
- `iso.cast_shadow(...)` and `iso.contact_ao(...)` for every volume, `iso.blob_shadow(...)` (or the
  props' own contact shadows) for every prop. In grounded mode all shadows are semi-transparent
  **ink** (`iso.INK` = `#1d2b36`), unclipped, so they read on earth, paving, sand and grass alike;
  the grass-green shadow colours of older helpers are repainted in ink automatically.
- `iso.foot_tufts(c, edges, kind=...)` and `iso.pebbles(c, items)`: a few tufts and pebbles right
  at the foot of the walls (`kind` = `"meadow"`, `"dry"`, `"beach"`, `"weeds"` for paving). Sparse –
  the foot of a wall, not a lawn.
- No grass disc, no earth side, no rim band, no painted ground (no paving, no water, no fields):
  the plaza around the agora and the temple, yards and aprons are the game's job. Keep the
  building and its props inside `iso.GROUND_R` (58 world units), a bit tighter than the old base,
  so everything sits on the game's ground patch.

**All 20 buildings are grounded:** `bakery`, `barracks`, `borderTower`, `cityCenter`, `farm`,
`fishery` (as direction variants, see below), `house`, `marketplace`, `mine`, `oilPress`,
`oliveGrove`, `quarry`, `sawmill`, `smelter`, `storehouse`, `temple`, `vineyard`, `winery`,
`wonder`, `woodcutter`. `iso.base()` (the old round diorama base with the owner-colour rim band)
is still in the library, but **no building uses it any more**. Units keep their round token
(`units_lib.token`).

What the art contains and what the game draws around it:

| Building | In the art | Drawn by the game |
|---|---|---|
| quarry, mine | the works themselves: cut terraces / rock outcrop, tunnel, crane, carts | only the apron (worked ground) under them |
| oliveGrove | the olive trees and the shed | the dry-grass parcels between them |
| vineyard | only the press hut, the pergola and the harvest | the vine rows across the tile |
| farm | farmhouse, haystacks, cart, well – **no fields** | the wheat fields across the tile |
| fishery | hut, short jetty, moored boat (one file per water direction) | beach, yard and the water – see "Direction variants" |
| cityCenter, temple | the building incl. its steps | the paved plaza |
| all others | the building and its props | a yard / clearing patch |

## Scale (one human scale for all buildings)

Doors, windows, people and props have the **same size on every building** (docs/ART.md,
"One human scale for all buildings"); buildings differ in footprint, by importance. World units:

| Size | Main body (longest side) | Buildings |
|---|---|---|
| Human scale | door **16 high × 9 wide**, window ~8 × 7, person ~14, one storey ~20 | all |
| Small | 32–44 | farmhouse, fisher's hut, woodcutter's cabin, vineyard/olive-grove shed, border tower (narrow but tall) |
| Modest | 44–54 | house (plus a courtyard wall, shed or pergola so the tile still feels lived in) |
| Medium | 50–64 | sawmill, bakery, oil press, winery, smelter, quarry/mine works |
| Large | 64–80 | storehouse, barracks, marketplace |
| Major | 70–90 | temple, city center (the city's heart, never smaller than the temple) |
| Monumental | up to the canvas | wonder |

Props at the same scale: amphora `k=0.6` (≈ 10 high; 0.5 for a small one), `pot(..., k=0.6)`,
baskets `k≈0.8–1`, sacks `k≈0.9`, crates `s≈4.5–5` (≈ 8 high), carts with wheels of radius 5–6.5,
haystacks ≈ 16–23 high, statues on pedestals at about twice life size (`figure(h=30)`).

Measured reference (the grounded buildings; world units, door = w × h):

| Building | Main body | Height (eave / top) | Door | Ground radius |
|---|---|---|---|---|
| house | 48 × 32, plus a 62 × 23 walled courtyard in front | 30 / 43 | 9 × 16 | 52 |
| farm (farmhouse) | 34 × 22, two haystacks, cart, well | 27 / 41 | 9 × 16 | 48 |
| woodcutter (cabin) | 32 × 40, log stack 29 × 22 | 24 / 39 | 9 × 16 | 54 |
| fishery (hut) | 34 × 22 on stilts (floor at 8), deck +5 | 28 / 43 | 9 × 16 | see "Direction variants" |
| storehouse | 76 × 34 | 29 / 41 | 9 × 16 | 53 |
| temple | 59 × 77 (bottom step) | 62 / 73 | 9 × 16 | 54 |
| cityCenter (tholos) | Ø 77 (bottom step) | 54 / 84 (+ finial) | 9 × 16 | 55 |
| sawmill (open shed) | 56 × 24 | 24 / 35 | open front | 55 |
| bakery | 50 × 30, roof room 20 × 11, oven Ø 24 | 27 / 41 | 9 × 16 | 50 |
| oilPress (press-house) | 36 × 28, lever beam 47 long | 26 / 38 | 9 × 16 | 54 |
| winery (hall) | 36 × 52, cellar arch 14 × 15 | 26 / 38 | 9 × 16 | 54 |
| smelter (furnace block) | 34 × 26, 50 with awning | 20 / 50 (chimney) | mouth 9 × 10 | 50 |
| quarry (cut) | 44 × 34, terraces 9 / 18 / 27, shed 22 × 14 | 18 / 31 (crane) | 9 × 16 | 56 |
| mine (outcrop) | about 64 wide, cut face 43 × 22 | 22 / 54 (peak) | tunnel 10 × 16 | 56 |
| barracks (fort corner) | hall 62 × 22, tower 18 × 18 × 46, 85 along a in total | ridge 38 | 9 × 16 | 52 |
| marketplace (stoa + stalls) | stoa 69 × 22, 7 Doric columns 22 high | ridge ~51 | 9 × 16 | 56 |
| wonder (gilded colossus) | podium 72 wide, figure ~70 high, torch ~128 | reaches canvas top | – | 56 |
| borderTower | plinth 42, shaft 33 → 26, 74 high, parapet 85 | flag ~117 | 9 × 16 | 40 |
| vineyard (press hut) | 32 × 20, pergola 13 × 14 | 21 / 32 | 9 × 16 | fields (keep r ~34 clear) |
| oliveGrove | 5 olive trees 40–48 high, shed 32 × 18 | ridge 29 | 9 × 16 | fields |

**Height order:** the wonder is the only building that reaches the top of the canvas; the border
tower (flag ~117) stops a little below it; then the city centre (84) above the temple (73); all
other buildings stay at one or two storeys (≤ 54, the mine's rock peak).

## Direction variants (the fishery; later the harbour)

A building that reaches into a neighbouring tile is drawn as **one scene per hex edge**, and the
game picks the version that points at the real water. `buildings/fishery.py` builds 7 files:

| File | What |
|---|---|
| `fishery.svg` (+ accent) | compact icon on the normal `0 0 256 256` canvas: hut, short jetty, boat, toward the south-east |
| `fishery.e0.svg` … `fishery.e5.svg` (+ accent) | the map versions; the jetty points along the screen angle **60° · e** (y down): 0 east, 1 south-east, 2 south-west, 3 west, 4 north-west, 5 north-east |

Canvas contract of a variant (the game relies on it):

- **Same user units and anchor as the normal building canvas:** the ground point under the tile
  centre is at (128, 176), 208 units = 0.92 × hex width (hex corner radius 130.5, apothem 113.0
  units). World → user: `(128 + 1.0815·(a − b), 176 + 0.5408·(a + b) − 1.3248·z)`.
- **Own tight viewBox** (both layers identical), rounded out to multiples of 8, may start at
  negative x / y. The root `<svg>` carries **`data-anchor="128 176"`**.
- Layout (the first fishery's compact scene, standing at the real shore; distances in user units
  from the tile centre toward the water edge, the shared edge is at 113): the hut is placed so its
  water-side corner is at 114 – its stilts reach just past the shore (wavy, ~95–125); a short
  jetty runs from the hut's deck to 150; the boat is moored right beside hut and jetty (hull
  119–175, inside the water tile); nets, traps, baskets and an amphora group on the land side
  close around the hut (all within 100). Stilts and posts beyond 110 get foam rings and
  reflections. The game's sandy yard belongs about 72 out (under the land part). Per direction
  `LAYOUT` in `fishery.py` sets where the jetty leaves the hut, which side the boat lies on, and
  the props. East / west jetties turn 14° toward the viewer, so the planks show instead of a
  fence-like edge.
- No painted water surface: only foam rings, the boat's waterline foam and soft shadows.

How it is built (reuse it for the harbour): `Canvas(asset_id, pid=..., stem="fishery.e0")`,
then set `c.viewbox = (x, y, w, h)` and `c.anchor_marker = True` before `write()`. Everything in
the scene is placed in world units from the screen direction (`screen_world(deg)` in
`fishery.py`); rotated parts are drawn from projected points (`c.P`), vertical planes at any
angle with `c.m_vplane(a, b, da, db)`. A small painter's sort (`Scene` in `fishery.py`) draws
ground-level things first, then every object by its depth `a + b`, so the jetty correctly passes
in front of or behind the hut. `Scene.viewbox()` fits the viewBox to the points the parts
register. `preview.py` reads each file's viewBox, so `preview.py fishery.e1` works.

## Two layers per asset (the accent rule)

Every script writes **two files with the same canvas**:

| File | Contains |
|---|---|
| `<id>.svg` | the art – everything that is not owner-coloured. Where accents are, it has **transparent holes**. |
| `<id>.accent.svg` | only the owner-coloured parts, in **neutral greys** with their light and shade. |

- Draw owner-coloured parts with `c.accent(markup)` instead of `c.add(markup)`, in the normal
  painter's order. Everything else is automatic: the library punches the holes into the art.
- Use only the greys in `iso.ACCENT` (`lit` = white = the pure player colour, `light`, `mid`,
  `shade`, `dark`, `deep`). The game multiplies them with the player colour (PixiJS
  `sprite.tint`), so an accent can never get *lighter* than the player colour. Highlights,
  gold trims, emblems and shadows **on top of** an accent are drawn as normal art *after* it.
- No blur filters inside accent markup (blur would make half-transparent holes).
- **In the game, draw the accent layer FIRST (tinted) and the art layer ON TOP.** Because the art
  has holes exactly where the accents are, anything in front of an accent (a tree in front of a
  shutter, a column in front of a banner) hides it automatically, and soft shadows painted later
  darken the tinted colour. The accent file is grown by ~0.7 px underneath, so no seam shows.
- The art file on its own shows the holes. Always look at both layers together
  (`preview.py`).
- What is an accent: on **grounded** buildings only **coloured details** – 2–4 per-building
  touches that read clearly at **40 px**: shutters, a painted door, awnings, banners, drapes, a
  painted tympanum / frieze / gable, a pennant, the cloth over a cart, a painted boat hull, a
  statue's crest/shield/cloak, sails. Prefer a few larger areas over many tiny ones (an awning in
  two shades of the owner colour, `awning_b(..., two_tone=True)`, reads better than thin
  shutters). (With the old `iso.base()`, unused now, the base rim band was an accent too.) Keep
  the main material (walls, roof, marble) neutral, so every building still
  reads as itself in all four colours (Tyrian purple, cinnabar, Aegean blue, gold).

## Canvas and anchor (fixed – the game relies on it)

- `viewBox="0 0 256 256"`. The **ground point under the building's centre** is at **(128, 176)**
  (the game puts it on the tile centre), and **208 canvas units** equal 0.92 × the hex width (the
  old base's width, x 24 → 232, kept as the scale reference). `iso.Canvas` handles this; never
  move the anchor or change the scale. (With the old `iso.base()` that point was the centre of
  the base's top ellipse.)
- You draw in **world units** around that point (`a = b = z = 0`). The canvas scales them by
  `iso.S` ≈ 1.08 px per unit around the anchor. The old base radius is `iso.BASE_R` = 68 units.
- Grounded: keep the building and its props inside `iso.GROUND_R` = 58 units (base mode: about
  60). The top of the canvas is about 130 units above the ground point, so tall things (towers,
  statues) fit, but stay inside the canvas. Cast shadows may reach a little beyond (onto the
  neighbouring tile), like real shadows.
- Legibility: the building must read at **40 px** (the whole image 40 px wide). Check it with
  `preview.py` (map strip at 40 px hexes). One clear silhouette, different from every other
  building, plus one bold colour.

## Projection, light, painter's order

True 2:1 dimetric projection. World axes on screen:

```
a -> (+1, +0.5)  down-right        visible faces: +b = "left" face (lit, warm mid tone)
b -> (-1, +0.5)  down-left                         +a = "right" face (cool shade)
z -> ( 0, -1.225) up                tops are the brightest
```

Light comes from the **upper left**; shadows fall to the lower right (+a). Draw back to front:
`ground()` (or the old `base()`) first, then `ground_ao`, cast shadows and contact AO on the
ground, then the building from its back parts to its front parts, props in front last. Things
further back have a smaller `a + b`.

**Faces are drawn flat in their own coordinates** and placed with one SVG matrix:

```python
c.add(c.on(c.m_bface(B), '<rect x="-10" y="5" width="20" height="30" fill="#f1e9d8"/>'))
```

| Transform | Plane | Local x, y |
|---|---|---|
| `c.m_ground(z)` | horizontal plane at height z | x = a, y = b |
| `c.m_bface(b)` | vertical plane b = const, faces +b (lit) | x = a, y = z (up) |
| `c.m_aface(a)` | vertical plane a = const, faces +a (shade) | x = −b, y = z (up) |
| `c.m_slope_b(zr, tanp, sign)` | roof plane, ridge along a at height zr | x = a, y = b |
| `c.m_slope_a(zr, tanp, sign)` | roof plane, ridge along b at height zr | x = a, y = b |

`c.P(a, b, z)` gives the screen point (for props, figures and anything drawn in screen space).
`with c.at(a, b, z):` moves the origin, so every helper can build an off-centre part:

```python
with c.at(-6, -14):          # the tholos stands behind the middle of the agora
    tholos(c)
```

## A minimal building script

```python
"""storehouse - ... Accent (owner colour): door drape + gable shutters."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402


def build():
    c = iso.Canvas("storehouse")                     # id = file name = id in src/data/
    A, B, H = 30, 20, 30
    iso.ground(c)                                    # grounded: transparent ground, ink shadows
    iso.ground_ao(c, [(sa * A, sb * B) for sa in (-1, 1) for sb in (-1, 1)])
    iso.cast_shadow(c, [(sa * A, sb * B) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * A, sb * B, H) for sa in (-1, 1) for sb in (-1, 1)])
    iso.contact_ao(c, -A, A, -B, B)
    iso.stone_course(c, A, B, 4)
    iso.lime_wall_b(c, B, -A, A, 4, H)
    iso.lime_wall_a(c, A, -B, B, 4, H, gable=10)
    iso.door_b(c, B, -6, 6, 4, 24)
    iso.drape_b(c, B, -16, -9, H - 7, 12)            # owner-coloured cloth (accent)
    iso.window_a(c, A, -5, 5, 14, 24)                # closed shutters (accent)
    iso.foot_tufts(c, [((-A, B), (A, B)), ((A, B), (A, -B))], n=8, kind="dry")
    iso.tile_roof_a(c, A + 3, B + 4, H + 10 + 3.8, 10 / B)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
```

## Library API (`iso.py`)

**Canvas**
- `Canvas(asset_id, pid=None, stem=None)` – one asset; `c.add(svg)` art, `c.accent(svg)` owner
  colour, `c.write(dir)` writes `<stem>.svg` + `<stem>.accent.svg` (stem = asset id by default).
  Direction variants: `c.viewbox = (x, y, w, h)`, `c.anchor_marker = True` (see above);
  `c.accent_layer = False` writes only the art file (terrain trees).
- `c.m_vplane(a, b, da, db)` – vertical plane through the ground point (a, b) containing the
  horizontal unit direction (da, db); local x along it, y up (a sail on a rotated boat).
- `c.P(a, b, z)`, `c.m_ground/m_bface/m_aface/m_slope_b/m_slope_a`, `c.on(transform, svg)`,
  `c.at(a, b, z)` – see above.
- `c.lin(name, x1, y1, x2, y2, stops, bbox=False)`, `c.rad(name, cx, cy, r, stops, bbox=False)` –
  gradients, return `url(#...)`. `stops` = `[(offset, colour[, opacity]), ...]`. With `bbox=True`
  the coordinates are fractions of the shape (one gradient for many shapes). Names are
  per-asset; the same name means the same gradient (the first definition wins).
- `c.blur(sd)` – url of a Gaussian blur filter (art only, keep it ≤ 3). `c.define(name, svg)` for
  any other `<defs>` entry. Only defs that are used end up in a file.

**Ground modes, light, ground**
- `ground(c)` – **grounded mode, always first** in every building script: draws nothing (transparent
  ground), sets `c.grounded`, so all shadows are ink and blur filters get a wider region (small
  props' soft shadows are not cut into boxes). Defines `c.url("top")` as a generous rectangle so
  helpers that clip to it still work. `GROUND_R` = 58: keep everything inside it.
- `ground_ao(c, footprint, grow=7, opacity=0.2, sd=3)` – wide, very soft AO around a group of
  ground points (draw it first). `INK` = `#1d2b36`, the shadow colour on the map.
- `foot_tufts(c, edges, n=10, seed, hmax, kind="meadow"|"dry"|"beach"|"weeds", stones=3)` – a few
  tufts and pebbles at the foot of walls; `pebbles(c, [(a, b, r, seed)])` – loose pebbles with their
  own contact shadow.
- `base(c, seed, avoid=None, tufts=90, flowers=16, top="grass")` – the **old** round base with the
  owner band; kept in the library, **no building uses it any more**. Defines the clip `c.url("top")`.
- `cast_shadow(c, footprint, tops, opacity=0.48, sd=2)` – projected soft shadow (base mode: green,
  clipped to the base top; grounded: ink at 0.72 × the opacity, unclipped).
- `contact_ao(c, a0, a1, b0, b1, z=0, width=4)` – dark soft band where a footprint meets the ground.
- `blob_shadow(c, a, b, r)`, `base_tufts(c, edges, n, seed, hmax)` – grass growing at the foot
  of a model (base mode; grounded buildings use `foot_tufts`).
- `flagstones(c, [(a, b, w, d, rot)])`, `paving(c, r, seed, avoid)`, `rocks(c, [(a, b, r, seed)])` –
  base mode ground details (grounded buildings leave the ground to the game).

**Solids and walls**
- `box(c, a0, a1, b0, b1, z0, z1, top, left, right, edge=None)` – any coloured block.
- `marble_steps(c, ha, hb, n, step_w, step_h)` → top height; `stone_course(c, ha, hb, h)`.
- `pedestal(c, a, b, ha, hb, h, top_z=0)` → top height.
- `lime_wall_b(c, b, a0, a1, z0, z1)`, `lime_wall_a(c, a, b0, b1, z0, z1, gable=0)`,
  `eave_shadow_b(c, b, a0, a1, z_eave)`.
- `door_b(c, b, x0, x1, z0, z1, accent=False)` (`accent=True`: painted door leaf in the owner
  colour), `window_b(c, b, x0, x1, z0, z1, shutters=True)` (open shutters = accent),
  `window_a(c, a, x0, x1, z0, z1)` (closed shutters = accent), `flowerbox_b(...)`.
- `cylinder(c, r, z0, z1, side_stops, top=None, name)`, `ring_front_arc(c, r, z)` – round parts.

**Roofs and classical parts**
- `tile_roof_a(c, AV, BV, ZR, tanp, T=3.8, n=12, courses=5, pal=TERRACOTTA)` – gable roof, ridge
  along a, big lit front slope (houses, stoas). Returns the eave height.
- `tile_roof_b(c, KA, KB, ZEAV, rise, rows=13, pal=TERRACOTTA)` – low gable, ridge along b, both
  slopes visible (temples). Returns the ridge height.
- `cone_roof(c, r, z_eave, rise, pal=TERRACOTTA)` – conical tile roof with a gilded finial.
- `pal=GOLD_TILES` gives a gilded roof.
- `doric_column(c, a, b, z0, z1, rb, rt, dark=False, cap=4.1)` → abacus top; `column_shadow(...)`.
- `entablature(c, ea, eb, z0, ka, kb, front_n, side_n, ..., metope_accent=False)` → cornice top
  (`metope_accent=True`: painted metopes in the owner colour, a band under the cornice).
- `pediment_b(c, ka, kb, zco, rise, tympanum_accent=True)`, `acroterion(c, a, b, z, k)`.

**Props** (`a, b` = ground position)
- `olive_tree(c, a, b, size)`, `cypress(c, a, b, h)`, `amphora(c, a, b, k, shaded)`,
  `pot(c, a, b)`, `altar(c, a, b)`, `brazier(c, a, b, z, k)`, `fire(c, x, y, k)`.
- Owner-coloured: `banner_b(c, a, b, z0, height, width, drop)`, `drape_b(c, b, a0, a1, z_top, drop)`,
  `drape_a(c, a, x0, x1, z_top, drop)`, `awning_b(c, a0, a1, b, z, depth, drop, stripes,
  two_tone=False)` (cream stripes; `two_tone=True`: all stripes in two shades of the owner colour).
- `figure(c, x, y, h, metal=BRONZE|GOLD, pose="spear"|"torch", accent_parts=("crest", "shield",
  "cloak"))` – a hoplite statue in screen space (feet at `c.P(...)` of its pedestal top).

**Palettes**: `MARBLE`, `LIME`, `TERRACOTTA`, `GOLD`, `GOLD_TILES`, `BRONZE`, `WOOD`, `ACCENT`
(close to the palette in `docs/ART.md`; add new colours there first).

## Shared helpers in the other libraries

The building libraries `lib_raw.py` (raw materials), `lib_processing.py` (workshops),
`lib_civic.py` (civic buildings) and `lib_agri.py` (farmland, coast) build on `iso.py`; their
module docstrings list everything. Reusable pieces worth knowing:

- `lib_raw.treadwheel_b(c, a, b, z, r, width=5, spokes=8, treads=22)` – the treadwheel of a crane
  (quarry; reusable for the harbour).
- `lib_processing.awning_a(c, b0, b1, a, z, depth, drop, stripes=7)` – a two-tone owner-colour
  awning sloping out of a +a (shaded) wall; `iso.awning_b` is the +b counterpart.
- `lib_civic.stall(..., two_tone=True)` – market stall whose awning is in two shades of the owner
  colour.
- `lib_agri.pergola(c, a0, a1, b0, b1, z, seed, pal, under=None, back_posts=True, bunches=5)` – a
  vine pergola on posts (`under(c)` draws what stands beneath it, between back and front posts).
- `lib_agri.grove_olive(..., crown="dome")` – an olive tree with a rounder, taller crown (default
  `"flat"`).
- `units_lib.person(c, x, y, h=14 * iso.ZS, ...)` also works on **building** canvases at the
  shared human scale (person ~14 world units): the barracks drill, the wonder's visitors.

## Rules for consistency

- Same light everywhere: lit tops, warm left faces, cool right faces, shadows to the lower right.
- No black outlines; edges come from value contrast and thin darker lines in the same hue.
- **Deterministic:** only `random.Random(seed)` – never the global `random` – so a rebuild gives the
  same file.
- File size: aim for < 150 KB per SVG (fewer tufts, fewer tile rows, fewer repeated details if
  needed). The game rasterises each SVG once.
- New reusable pieces go into `iso.py` (with a docstring); building-specific parts stay in the
  building's script.
- Before handing in: run `build_all.py`, look at `preview.py` (all four colours, 64 px and 40 px),
  and check the asset id matches `src/data/`. For grounded buildings also look at them on a plain
  meadow-green (`#9cc25a`) hexagon of the real size (pointy-top, hex width = 208 / 0.92 canvas
  units, centred on (128, 176)) – there is no plateau to hide a floating prop or a hard shadow edge.

## Slope versions (mine and quarry)

`buildings/mine.py` and `buildings/quarry.py` return **two canvases** each, like the fishery:

| File | Use |
|---|---|
| `<id>.svg` (+ accent) | the icon, and the quarry on plains |
| `<id>.slope.svg` (+ accent) | the map version on hills and mountains |

- Both use the normal `0 0 256 256` canvas; the slope version is built with
  `Canvas(id, pid="<id>-slope", stem="<id>.slope")`, so its gradient / filter ids stay unique.
- The slope versions show **only the works**. The game's terrain cuts the face into its own
  massif or hill, so the art has no hollow, outcrop, peak, snow, hill rock or rock terraces.
- **The cut geometry is a contract with the game's terrain** (`src/render/`): it is kept as
  constants – `SLOPE_FACE_B`, `SLOPE_FACE_A`, `SLOPE_FACE_H`, `SLOPE_OPEN`, `SLOPE_TRACK_A` in
  `mine.py` and `SLOPE_STEPS` in `quarry.py`. Change it there and in `src/render/` together.
  - mine: a vertical rock face on b = −15, facing +b, over a −25 … +5, 28 high; the tunnel
    opening is a −15 … −5, z 0 … 16; the rails run out of it toward +b along a = −10.
  - quarry: three stepped terraces with their fronts at b = −10, −20 and −30, each 9 high
    (tops at 9, 18, 27).
- The mine's cut rim uses the massif face colours of the game's terrain painter
  (`terrainPaint.mountains`), copied as the palette `TROCK` in `mine.py`; keep them in step.

## Terrain trees (`terrain/trees.py`)

Forests are dense woodland of drawn trees in the building style (docs/ART.md, "Hills and
mountains", bullet "Forests"); the same sprites dot the golden hills with olives and shrubs. The
game (`src/render/terrainArt.ts`) loads them by id and places them densely as overlapping
sprites, sorted back to front.

- Files: `public/assets/terrain/<id>.svg`, **one art layer, no accent file** (no owner colour;
  `Canvas.accent_layer = False`). All 13 come from one script, `terrain/trees.py` (Canvas id
  `trees`, the file name is the `stem`).
- Canvas: the **same world scale as the buildings** (`iso.S`, 208 units = 0.92 × hex width), so
  trees match the houses and temple. Each file has its own tight `viewBox` (multiples of 4) and
  **`data-anchor="128 176"`** on the root `<svg>`: the trunk foot (where the trunk meets the
  ground) is at (128, 176) user units, like a building's ground point.
- Sizes (world units; width = crown diameter, on screen × 1.41):

| Ids | Tree | Height | Width |
|---|---|---|---|
| `pine1` `pine2` `pine3` | umbrella pine: bare trunk forking into a flat, cushioned crown | 52, 58, 45 | 42, 46, 35 |
| `cypress1` `cypress2` | cypress: slim dark flame of small sprays | 52, 41 | 13, 11 |
| `oak1` `oak2` `oak3` | holm oak: short stout trunk, rounded dense crown (green, blue-green, warm) | 36, 31, 39 | 35, 31, 37 |
| `shrub1` `shrub2` `shrub3` | maquis: lentisk cushion, grey sage with lilac flowers, flowering broom | 10, 8, 13 | 17, 13, 19 |
| `olive1` `olive2` | wild olive: gnarled grey trunk, loose silvery crown | 27, 23 | 27, 24 |

- How a crown is built (`Tree.masses`): a dark silhouette of all leaf masses first (dark gaps and
  undersides), then the masses from the bottom (or back) up, each with a radial gradient lit from
  the upper left (`L` / `M` / `D` by its position in the crown), a lighter cap and a few glints.
  So overlapping trees read as one deep canopy. Every tree has a soft contact shadow at the foot
  and a short soft cast shadow to the lower right in ink.
- Keep each file small (< 20 KB; they are 5–18 KB): paths use one decimal (`n1`), masses have 6–7
  scallops, one gradient set per palette, two blur filters.
- Species helpers in `trees.py`: `umbrella_pine`, `cypress`, `holm_oak`, `shrub`, `wild_olive`;
  palettes in `PAL` (leaf) and `BARK` (trunks). Add a variant by adding a line to `build()` with
  a new id – and tell the game (`terrainArt.ts` lists the ids).

## Units (`units_lib.py`, `units/<id>.py`)

Units are **richer single figures** (docs/ART.md, "Units: richer single figures"): one big,
characterful painted miniature per unit in a 3/4 view facing screen-left, standing on an ornate
bronze token. `units_lib.py` builds on `iso.py` (it never changes it).

**Canvas (fixed – the game relies on it):** `viewBox="0 0 128 128"`, the token's top ellipse is
centred at **(64, 96)** and **88 px wide** (x 20 → 108); the game scales it to 0.62 × the hex
width. 1 world unit = 1 px. Figures may rise to the top of the canvas (crests, spear tips) and
ships overhang the token; measured extents: hoplite and horseman reach y ≈ 1–2, the trireme
spans x 4.5 → 121, the transport's sail tops out at y ≈ 19 and the trireme's at y ≈ 37 (the old
ships stayed below 32 / 54). The token itself is unchanged in size, so the HP bar under it is not
affected. Legibility check: **32 px** (the token 32 px wide).

**Token** (`token(c, top="bronze"|"water", seed)`, always first; defines the clip `c.url("top")`):
a soft drop shadow, a polished bronze side with an **enamel band** (accent) between bevelled lips
and small bronze studs, and a top with a bevelled lip, a broad **enamel ring** (accent) – at the
front it joins the side band into one thick owner-colour edge, which still reads at 32 px – an
embossed egg-and-dart ring and a polished inner field with lathe rings. Ships use
`top="water"`: a water field inside a twisted bronze rope rim.

| Unit | What it shows | Accent (owner colour) |
|---|---|---|
| scout | runner in full stride, felt petasos, staff, laced boots, linen tunic | flying chlamys, hat band |
| settler | bearded colonist with a staff leading a pack donkey (sacks, amphorae, bedroll, hoe) | his tunic, the donkey's blanket |
| spearman | advancing light infantryman, conical bronze pilos, long spear levelled up ahead | exomis tunic, small round shield field |
| archer | full draw with a recurved bow, quiver on the back, soft leather cap, boots | tunic with sleeves |
| hoplite | braced, big aspis with a sun blazon, spear overhand, crested Corinthian helmet, greaves | aspis field, crest, cloak |
| horseman | rider on a chestnut horse at the trot, Chalcidian helmet, javelin cocked to throw | saddle cloth, cloak, crest |
| transport | round-bellied merchant ship, braced square sail, amphorae and bales, helmsman | sail |
| trireme | sleek dark warship, three banks of oars, bronze ram, bow eye, aplustre, helmsman | sail, outrigger stripe, pennant |

**Unit API** (`units_lib.py`; the module docstring lists the sections)
- `UnitCanvas(id)` – an `iso.Canvas` on the unit canvas. The broadside frame `c.Pu(u, v, z)`,
  `c.m_front(v)`, `c.m_flat(z)`, `from_uv(u, v)` is still there for profiles.
- **Sculpting toolkit:** `Fig(c, x, y, k)` – a figure in screen space around its feet point;
  `F.tube(pts, ws, ramp)` (tapered limb / shaft with a cylinder gradient lit from the upper left;
  split automatically at sharp bends, one outline would fold over itself and leave a hole),
  `F.mass(d, fill)`, `F.paint_in(target_d, markup)` / `F.shade_on(...)` (cast shadows clipped to a
  part), `spline(points, closed)`, `fold(d)` (painted crease + lit ridge), `stroke`, `glint`.
  Ramps: 6-stop cylinder ramps (rim light → lit → base → shade → core → reflected), e.g.
  `SKIN_F` (figure skin; `SKIN` stays for `person()`), `LINEN`, `WOOL`, `LEATHER`, `BRONZE_R`,
  `WOOD_R`, `HAIR_R`, and `ACC_R` (accent greys, kept bright so the owner colour reads).
- **Figure parts** (local units, feet at y = 0, up is −y): `leg`, `foot`, `arm`, `limb` (one
  smooth tube shoulder → elbow → wrist), `fist`, `neck`, `face` (3/4 head, `beard=None|"short"|"full"`),
  `garment` (tunic / exomis with folds, an embroidered hem border and the hem's shadow on the
  legs – **draw the legs first**, the hem hangs over the thighs), `chiton_skirt`, `belt`, `cuff`,
  `cloak_back`, `cloak_border`, `pteruges`, `cuirass`, `shoulder_guard`, helmets and hats
  (`corinthian`, `chalcidian`, `pilos`, `petasos`, `scythian_cap`), weapons (`spear`, `staff`,
  `bow`, `arrow`, `quiver`), shields (`aspis(..., blazon="sun")`, `round_shield`).
- **Animals** (profile, facing left): `horse(c, x, y, k)` → anchor points (`seat`, `mouth`),
  `donkey(c, x, y, k)` + `pack_load(F)`.
- **Ships:** `Ship(c, L, W, hd, sheer_bow, sheer_stern, phi)` – a hull in a 3/4 view (bow toward
  the lower left, `phi` = the keel's turn in the ground plane); draw `water()`, `far_side()`,
  `deck()`, cargo (`amphora_at`, `bale_at`, `ship_sailor`), `mast()`, `sail(...)` (a braced square
  sail billowing toward the viewer, owner colour), `near_side(stops)`, `oar_bank(...)`, ornaments.
- `person(c, x, y, h, ...)` is the older, smaller figure kept unchanged for the **building** canvases
  (barracks drill, wonder visitors) – see "Shared helpers".

Rules for unit art: one bold owner-colour area per unit that reads at 32 px in all four player
colours; neutral details in bronze, wood, leather, linen and skin; legs before garments, cast
shadows only inside the part they fall on; no blur inside accent markup. Check with `preview.py`
(and look at the figures on meadow, hill and forest-floor tiles next to the house and temple).
