# Poleis art generator (`tools/art/`)

All building and unit art of Poleis is **generated** by small Python 3 scripts (standard
library only) that print plain SVG. Style: isometric diorama miniatures, see `docs/ART.md`
("Chosen direction: V1"). Never edit the SVGs in `public/assets/buildings/` or
`public/assets/units/` by hand – edit the script and rebuild.

```
tools/art/
  iso.py            the shared library (projection, base, light, materials, props, statues)
  units_lib.py      unit library on top of iso.py (token, people, horse, cart, ships)
  buildings/<id>.py one script per building, named exactly like the id in src/data/
  units/<id>.py     one script per unit (see "Units" below)
  build_all.py      builds every script into public/assets/buildings/ and public/assets/units/
  preview.py        review sheet: art + accent tinted in the four player colours, map sizes
```

## Run it

```sh
python3 tools/art/build_all.py                 # all buildings and units
python3 tools/art/build_all.py house hoplite   # only these ids
python3 tools/art/buildings/house.py /tmp/out  # one script, into any folder

python3 tools/art/preview.py house temple --out /tmp/preview.svg
python3 tools/art/preview.py hoplite trireme --out /tmp/units.svg
qlmanage -t -s 1600 -o /tmp /tmp/preview.svg   # macOS: -> /tmp/preview.svg.png, open it
```

`build_all.py` prints each file with its size and warns above 150 KB. The scripts set
`sys.dont_write_bytecode`, so no `__pycache__` folders end up in the repo.

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
- What is an accent: the **base rim band** (always, done by `iso.base`) plus 2–4 per-building
  touches: shutters, banners, drapes, awnings, a painted pediment, a statue's crest/shield/cloak,
  sails. Keep the main material (walls, roof, marble) neutral, so every building still reads as
  itself in all four colours (Tyrian purple, cinnabar, Aegean blue, gold).

## Canvas and anchor (fixed – the game relies on it)

- `viewBox="0 0 256 256"`. The centre of the base's top ellipse is at **(128, 176)**, the top
  ellipse is **208 px wide** (x 24 → 232). `iso.Canvas` handles this; never move or resize the base.
- You draw in **world units** around the base centre (`a = b = z = 0`). The canvas scales them by
  `iso.S` ≈ 1.08 px per unit around the anchor. The base radius is `iso.BASE_R` = 68 units.
- Keep the footprint inside a radius of about 60 units. The top of the canvas is about 130 units
  above the base centre, so tall things (towers, statues) fit, but stay inside the canvas.
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
the base first, then cast shadows and ambient occlusion on the ground, then the building from
its back parts to its front parts, props in front last. Things further back have a smaller
`a + b`.

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
"""storehouse - ... Accent (owner colour): base rim band + door drape."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402


def build():
    c = iso.Canvas("storehouse")                     # id = file name = id in src/data/
    A, B, H = 30, 20, 30
    iso.base(c, seed=5, avoid=lambda a, b: abs(a) < A + 3 and abs(b) < B + 3)
    iso.cast_shadow(c, [(sa * A, sb * B) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * A, sb * B, H) for sa in (-1, 1) for sb in (-1, 1)])
    iso.contact_ao(c, -A, A, -B, B)
    iso.stone_course(c, A, B, 4)
    iso.lime_wall_b(c, B, -A, A, 4, H)
    iso.lime_wall_a(c, A, -B, B, 4, H, gable=10)
    iso.door_b(c, B, -6, 6, 4, 24)
    iso.drape_b(c, B, -16, -9, H - 7, 12)            # owner-coloured cloth (accent)
    iso.tile_roof_a(c, A + 3, B + 4, H + 10 + 3.8, 10 / B)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
```

## Library API (`iso.py`)

**Canvas**
- `Canvas(asset_id)` – one asset; `c.add(svg)` art, `c.accent(svg)` owner colour,
  `c.write(dir)` writes `<id>.svg` + `<id>.accent.svg`.
- `c.P(a, b, z)`, `c.m_ground/m_bface/m_aface/m_slope_b/m_slope_a`, `c.on(transform, svg)`,
  `c.at(a, b, z)` – see above.
- `c.lin(name, x1, y1, x2, y2, stops, bbox=False)`, `c.rad(name, cx, cy, r, stops, bbox=False)` –
  gradients, return `url(#...)`. `stops` = `[(offset, colour[, opacity]), ...]`. With `bbox=True`
  the coordinates are fractions of the shape (one gradient for many shapes). Names are
  per-asset; the same name means the same gradient (the first definition wins).
- `c.blur(sd)` – url of a Gaussian blur filter (art only, keep it ≤ 3). `c.define(name, svg)` for
  any other `<defs>` entry. Only defs that are used end up in a file.

**Base, light, ground**
- `base(c, seed, avoid=None, tufts=90, flowers=16, top="grass")` – the round base with the owner
  band. **Always first.** Also defines the clip `c.url("top")` (grass top).
- `cast_shadow(c, footprint, tops, opacity=0.48, sd=2)` – projected soft shadow on the base top.
- `contact_ao(c, a0, a1, b0, b1, z=0, width=4)` – dark soft band where a footprint meets the ground.
- `blob_shadow(c, a, b, r)`, `base_tufts(c, edges, n, seed, hmax)` – grass growing at the foot
  of a model.
- `flagstones(c, [(a, b, w, d, rot)])`, `paving(c, r, seed, avoid)`, `rocks(c, [(a, b, r, seed)])`.

**Solids and walls**
- `box(c, a0, a1, b0, b1, z0, z1, top, left, right, edge=None)` – any coloured block.
- `marble_steps(c, ha, hb, n, step_w, step_h)` → top height; `stone_course(c, ha, hb, h)`.
- `pedestal(c, a, b, ha, hb, h, top_z=0)` → top height.
- `lime_wall_b(c, b, a0, a1, z0, z1)`, `lime_wall_a(c, a, b0, b1, z0, z1, gable=0)`,
  `eave_shadow_b(c, b, a0, a1, z_eave)`.
- `door_b(c, b, x0, x1, z0, z1)`, `window_b(c, b, x0, x1, z0, z1, shutters=True)` (open shutters
  = accent), `window_a(c, a, x0, x1, z0, z1)` (closed shutters = accent), `flowerbox_b(...)`.
- `cylinder(c, r, z0, z1, side_stops, top=None, name)`, `ring_front_arc(c, r, z)` – round parts.

**Roofs and classical parts**
- `tile_roof_a(c, AV, BV, ZR, tanp, T=3.8, n=12, courses=5, pal=TERRACOTTA)` – gable roof, ridge
  along a, big lit front slope (houses, stoas). Returns the eave height.
- `tile_roof_b(c, KA, KB, ZEAV, rise, rows=13, pal=TERRACOTTA)` – low gable, ridge along b, both
  slopes visible (temples). Returns the ridge height.
- `cone_roof(c, r, z_eave, rise, pal=TERRACOTTA)` – conical tile roof with a gilded finial.
- `pal=GOLD_TILES` gives a gilded roof.
- `doric_column(c, a, b, z0, z1, rb, rt, dark=False, cap=4.1)` → abacus top; `column_shadow(...)`.
- `entablature(c, ea, eb, z0, ka, kb, front_n, side_n, ...)` → cornice top.
- `pediment_b(c, ka, kb, zco, rise, tympanum_accent=True)`, `acroterion(c, a, b, z, k)`.

**Props** (`a, b` = ground position)
- `olive_tree(c, a, b, size)`, `cypress(c, a, b, h)`, `amphora(c, a, b, k, shaded)`,
  `pot(c, a, b)`, `altar(c, a, b)`, `brazier(c, a, b, z, k)`, `fire(c, x, y, k)`.
- Owner-coloured: `banner_b(c, a, b, z0, height, width, drop)`, `drape_b(c, b, a0, a1, z_top, drop)`,
  `drape_a(c, a, x0, x1, z_top, drop)`, `awning_b(c, a0, a1, b, z, depth, drop)`.
- `figure(c, x, y, h, metal=BRONZE|GOLD, pose="spear"|"torch", accent_parts=("crest", "shield",
  "cloak"))` – a hoplite statue in screen space (feet at `c.P(...)` of its pedestal top).

**Palettes**: `MARBLE`, `LIME`, `TERRACOTTA`, `GOLD`, `GOLD_TILES`, `BRONZE`, `WOOD`, `ACCENT`
(close to the palette in `docs/ART.md`; add new colours there first).

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
  and check the asset id matches `src/data/`.

## Units (`units_lib.py`, `units/<id>.py`)

Units are board-game figures on a small round **token**. `units_lib.py` builds on `iso.py`
(it never changes it) and has its own fixed canvas (docs/ART.md):

- `viewBox="0 0 128 128"`; the token's top ellipse is centred at **(64, 96)** and is **88 px
  wide** (x 20 → 108). The game scales the image so this width is 0.62 × the hex width.
- Here **1 world unit = 1 px** (`TOKEN_R` ≈ 31 units). The figure stands on the token centre and
  may rise to the top of the canvas (spear tips, sails, crests); ships may overhang the token.
- Legibility: **32 px** (the token 32 px wide, i.e. a 52 px hex). `preview.py` shows a 52 px strip.
- Accents: the token's rim band (automatic) + 1–3 owner touches (shield, crest, cloak, cap,
  saddle cloth, cart cover, sail, hull strake, pennant). Same accent rule as buildings.

```python
"""peltast - ... Accent (owner colour): token band + shield."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import units_lib as U  # noqa: E402


def build():
    c = U.UnitCanvas("peltast")          # id = file name = id in src/data/
    U.token(c, seed=3)                   # first; top="water" for ships
    x, y = c.P(0, 0, 0)                  # token centre = where the feet go
    U.ground_shadow(c, x, y, 10)
    U.person(c, x, y, h=70, helmet="pilos", hold="spear", shield="round", accents=("shield",))
    return c
```

**Unit API** (`units_lib.py`)
- `UnitCanvas(id)` – an `iso.Canvas` on the unit canvas; all iso helpers work on it. Extra:
  the **broadside frame** for profiles (ships, horses, carts): `c.Pu(u, v, z)` with `u` along the
  screen horizontal and `v` toward the viewer; `c.m_front(v)` (vertical plane facing the viewer,
  local x = u, y = z) and `c.m_flat(z)` (ground). `from_uv(u, v)` converts to `c.at(a, b)`.
- `token(c, top="grass"|"water", seed)` – always first; defines the clip `c.url("top")`.
- `ground_shadow(c, x, y, w, length)` – contact + cast shadow under a figure.
- `person(c, x, y, h=70, tunic=LINEN|WOOL|"accent", hem, armor=None|"cuirass",
  legs="bare"|"greaves", stride, beard, helmet=None|"corinthian"|"pilos"|"petasos"|"phrygian",
  cloak=None|material|"accent", cloak_flow, hold=None|"spear"|"staff"|"bow", shield=None|"aspis"|
  "round", quiver, accents=("shield", "crest", "cloak", "cap", "tunic"), wide=1.12)` – a painted
  miniature, front view, feet at (x, y). `h` is feet → top of the head.
- `horse(c, x, y, h, coat=HORSE_BAY|DONKEY, saddle, accents=("saddle",))` → seat point;
  `rider(c, seat_x, seat_y, h, accents=("cloak",))`.
- `cart(c, u0, u1, z0, z1, wheel_u, wheel_r, cover_h)` – two-wheeled cart with an owner cover.
- Ships: `ship_hull(c, L, W, hd, sheer_bow, sheer_stern, colours, deck)` → near gunwale points;
  `sail(c, u0, u1, z_foot, z_yard)` (owner colour), `oars(c, near, u_from, u_to, n)`,
  `ship_amphora(...)`, and the complete `transport_details` / `trireme_details`.
- Materials: `SKIN`, `LINEN`, `WOOL`, `LEATHER`, `FELT`, `METAL`, `CLOTH_ACCENT`, `HORSE_BAY`, `DONKEY`.

Silhouettes must differ at 32 px: hoplite = big round shield + crest; spearman = small shield +
conical cap; scout = wide hat + flying cloak; archer = drawn bow; settler = covered cart;
horseman = horse; transport = square sail; trireme = long low hull with oars.
