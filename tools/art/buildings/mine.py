"""mine - a rocky outcrop of the mountain standing directly on the map (grounded, docs/ART.md) at the
shared human scale: a craggy peak with a little snow, a cut rock face with a timber-framed tunnel
mouth lit by a lantern, short rails coming out of the dark with an ore tub heaped with copper and
tin ore, a grey spoil heap and a pile of sorted ore. The game draws the rock apron underneath (and
clears the mountain's own peaks inside the footprint).
Accent (owner colour): the banner beside the tunnel, the cloth on the lintel and the cover over a
crate of tools.

Two files (docs/ART.md "Mines and quarries dig into the real slope"):
    mine.svg        the icon (build menu, panels): the whole outcrop with its peak, as above
    mine.slope.svg  the map version: ONLY the works. The terrain cuts a vertical rock face into its
                    own massif (SLOPE_FACE below); the portal stands flush against it inside a
                    narrow rim of cut rock, rails, ore tub, spoil heap, ore pile and tool crate in
                    front. No outcrop, no peak, no snow."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_processing as lp  # noqa: E402
import lib_raw as raw  # noqa: E402
from iso import WOOD, f, poly  # noqa: E402

# world units; keep everything inside iso.GROUND_R = 58
PB = -6.0                 # portal plane (b) on the cut face of the outcrop
PA0, PA1 = -22.0, -12.0   # tunnel opening (a range): 10 wide
PH = 16.0                 # opening height (a door and a little more)
TRACK_A = -17.0           # track centre line
GAUGE = 5.0
# rock close to the map's mountains (src/render/theme.ts rockLight / rockShade), a little warmer
# than lib_raw.ROCK so the outcrop blends into the painted peaks around it
MROCK = {"hi": "#d8cebb", "lit": "#c4b9a6", "mid": "#a89c8a", "shade": "#8a7f71", "dark": "#6e655a", "deep": "#524b44"}

# --- mine.slope: the cut the TERRAIN draws (world units around the tile centre) -----------------
# A vertical rock face facing +b (toward the screen lower left, the warm lit side): its ground line
# runs along a from SLOPE_FACE_A[0] to SLOPE_FACE_A[1] at b = SLOPE_FACE_B, it rises SLOPE_FACE_H
# (at least across the portal rim) and runs out into the massif's slope at both ends.
SLOPE_FACE_B = -15.0
SLOPE_FACE_A = (-25.0, 5.0)
SLOPE_FACE_H = 28.0
SLOPE_OPEN = (-15.0, -5.0)    # tunnel opening in that face: a range (10 wide), z 0 .. PH (16)
SLOPE_TRACK_A = -10.0         # the rails run out of the tunnel toward +b along this a
# the icon's portal is drawn shifted so its posts stand with their backs flush on the face plane
PORTAL_SHIFT = (SLOPE_TRACK_A - TRACK_A, SLOPE_FACE_B - (PB - 1.2))
# the terrain's massif colours (src/render/theme.ts terrainPaint.mountains.faceColors, strata)
TROCK = {"hi": "#e8dfcc", "lit": "#dcd0b9", "mid": "#baac95", "shade": "#958873", "dark": "#766a5c", "deep": "#5a5046"}


def portal(c):
    """Timber-framed tunnel mouth on the plane b = PB."""
    W = WOOD
    # the dark tunnel: a rock-cut hole, glowing faintly inside
    hole = [(PA0 - 2.4, 0), (PA0 - 3, PH * 0.6), (PA0 - 1.6, PH + 2.4), (PA0 + 2.4, PH + 3.8), (PA1 - 1.6, PH + 4),
            (PA1 + 2, PH + 2.6), (PA1 + 3.2, PH * 0.55), (PA1 + 2.6, 0)]
    c.add(c.on(c.m_bface(PB - 0.5), f'<path d="{poly(hole)}" fill="#4a4646"/>'
               f'<path d="{poly([(x * 0.94 + (PA0 + PA1) / 2 * 0.06, y * 0.93) for x, y in hole])}" fill="#2e2b2c"/>'))
    glow = c.rad("tunnel", (PA0 + PA1) / 2 + 1.5, 2.5, 6, [(0, "#c9782e", 0.55), (0.6, "#3a2416", 0.5), (1, "#0e0a09", 0)])
    c.add(c.on(c.m_bface(PB - 0.3), f'<rect x="{f(PA0)}" y="0" width="{f(PA1 - PA0)}" height="{f(PH)}" fill="#120d0b"/>'
               f'<rect x="{f(PA0)}" y="0" width="{f(PA1 - PA0)}" height="{f(PH)}" fill="{glow}"/>'))
    # rails disappearing into the tunnel
    c.add(c.on(c.m_ground(1.5), "".join(f'<rect x="{f(ra - 0.4)}" y="{f(PB - 6)}" width="0.8" height="6" fill="#6b5a48" opacity="0.8"/>' for ra in (TRACK_A - GAUGE / 2, TRACK_A + GAUGE / 2))))
    # posts, lintel and knee braces
    for a in (PA0 - 0.8, PA1 + 0.8):
        iso.box(c, a - 1.2, a + 1.2, PB - 1.2, PB + 1.2, 0, PH, W["lit"], W["base"], W["dark"])
        c.add(c.on(c.m_bface(PB + 1.2), f'<path d="M{f(a - 0.5)},1.5V{f(PH - 1.5)}M{f(a + 0.4)},3V{f(PH - 3)}" stroke="{W["deep"]}" stroke-width="0.25" opacity="0.6"/>'))
    raw.log_a(c, PB + 0.2, PH + 1.6, PA0 - 3.2, PA1 + 3, 1.7, seed=12)
    for a, s in ((PA0 - 0.8, 1), (PA1 + 0.8, -1)):
        x0, y0 = c.P(a, PB + 1.3, PH - 4)
        x1, y1 = c.P(a + s * 3.4, PB + 1.3, PH + 0.4)
        c.add(f'<path d="M{f(x0)},{f(y0)}L{f(x1)},{f(y1)}" stroke="{W["dark"]}" stroke-width="1.1" stroke-linecap="round"/>'
              f'<path d="M{f(x0 - 0.2)},{f(y0 - 0.2)}L{f(x1 - 0.2)},{f(y1 - 0.2)}" stroke="{W["lit"]}" stroke-width="0.4"/>')
    # short owner cloth on the lintel, the lantern on the right post, a pick by the left post
    iso.drape_b(c, PB + 2, (PA0 + PA1) / 2 - 2.8, (PA0 + PA1) / 2 + 2.8, PH + 3.2, 6.5)
    x, y = c.P(PA1 + 2, PB + 1.4, PH - 1)
    raw.lantern(c, x, y, k=0.7, glow=12)
    x, y = c.P(PA0 - 2.4, PB + 2, 0)
    raw.pickaxe(c, x, y, k=0.75)


def outcrop(c):
    """The craggy mountain mass with a cut face where the tunnel goes in."""
    R = MROCK
    raw.boulder(c, 20, -34, 15, 13, 30, seed=16, pal=R, n=26, cone=0.2)
    raw.boulder(c, -14, -34, 28, 20, 54, seed=13, pal=R, n=34, cone=0.35, snow=45)
    raw.boulder(c, -40, -18, 12, 14, 32, seed=19, pal=R, n=24, cone=0.2)
    # the cut face around the tunnel and the shoulder of rock above it
    raw.rock_prism(c, [(-36, PB), (-2, PB), (3, -14), (-2, -28), (-30, -28), (-40, -15)], 0, 22, R, seed=1, zj=2.2)
    with c.at(0, 0, 20):
        raw.boulder(c, -22, -17, 14, 10, 12, seed=21, pal=R, n=22, cone=0.1)
        raw.boulder(c, -4, -18, 9, 8, 9, seed=22, pal=R, n=18, cone=0.1)
    raw.boulder(c, 14, -14, 10, 10, 16, seed=31, pal=R, n=22)
    raw.boulder(c, -44, 0, 7, 7, 10, seed=32, pal=R, n=16)
    iso.foot_tufts(c, [((-36, PB), (-26, PB)), ((-8, PB), (-2, PB)), ((10, -4), (24, -8))], n=6, seed=5, kind="dry", stones=2)


def tool_crate(c, a, b):
    """Wooden crate of tools and baskets under an owner-coloured cover."""
    iso.cast_shadow(c, [(a, b), (a + 9, b), (a + 9, b + 7), (a, b + 7)], [(a, b, 5.5), (a + 9, b, 5.5), (a + 9, b + 7, 5.5), (a, b + 7, 5.5)], opacity=0.36, sd=1.2)
    lp.timber(c, a, a + 9, b, b + 7, 0, 5.5)
    c.add(c.on(c.m_bface(b + 7), "".join(f'<rect x="{f(a + i * 2.25)}" y="0" width="0.35" height="5.5" fill="{WOOD["deep"]}" opacity="0.5"/>' for i in range(1, 4))))
    lp.tarp(c, a + 2.5, a + 9.5, b - 0.5, b + 7.5, 5.7, drop=2.8)
    x, y = c.P(a + 1.2, b + 3.5, 5.5)
    c.add(f'<path d="M{f(x)},{f(y)} l-1.2,-6" stroke="{WOOD["dark"]}" stroke-width="0.9" stroke-linecap="round"/>'
          f'<path d="M{f(x - 3.4)},{f(y - 6)} Q{f(x - 1.2)},{f(y - 7.4)} {f(x + 1.6)},{f(y - 6.4)}" fill="none" stroke="{raw.IRON["base"]}" stroke-width="1"/>')


def build_icon():
    c = iso.Canvas("mine")
    iso.ground(c)
    iso.ground_ao(c, [(-50, -30), (-10, -54), (30, -44), (34, -12), (36, 18), (8, 40), (-26, 34), (-50, 6)], grow=5, opacity=0.12)

    outcrop(c)
    portal(c)
    # banner beside the tunnel
    iso.banner_b(c, 0, -3, 0, height=28, width=6, drop=11)
    # track and ore tub
    raw.rails_b(c, TRACK_A, PB + 1.5, 34, gauge=GAUGE, step=3.6)
    with c.at(0, 0, 0):
        raw.ore_tub(c, TRACK_A, 20, gauge=GAUGE)
    # spoil heap of grey waste rock, sorted ore, loose stones
    x, y = c.P(22, 10, 0)
    iso.blob_shadow(c, 26, 10, 9, 0.35)
    raw.heap(c, x, y, 12, 9, MROCK, seed=21, n=20)
    raw.rubble(c, [(14, 20, 1.8, 31), (28, 22, 1.4, 32), (34, 4, 1.4, 34)], pal=MROCK)
    x, y = c.P(2, 30, 0)
    iso.blob_shadow(c, 4, 30, 5.5, 0.35)
    raw.ore_heap(c, x, y, 6.5, 4.8, seed=14, n=14)
    tool_crate(c, -42, 12)
    raw.rubble(c, [(-32, 26, 1.5, 36), (-8, 42, 1.2, 37)], pal=MROCK)
    return c


def cut_rim(c):
    """Narrow rim of freshly cut rock round the portal on the face plane, in the terrain's massif
    colours, with a soft outer edge so it blends into the rock face the terrain draws behind it."""
    b = SLOPE_FACE_B
    am = (SLOPE_OPEN[0] + SLOPE_OPEN[1]) / 2
    rim = [(am + dx, z) for dx, z in [(-12, 0), (-13.2, 7), (-11.6, 14), (-12.4, 20), (-8.5, 24.2), (-3.5, 25.6), (1.5, 24.8),
                                       (6.5, 26), (10.4, 22.6), (11.6, 15.5), (10.6, 8), (11.8, 0)]]
    T = TROCK
    # contact shadow on the ground along the foot of the face
    c.add(f'<path d="{poly([c.P(am - 13, b, 0), c.P(am + 12, b, 0), c.P(am + 13, b + 3, 0), c.P(am - 12, b + 2.4, 0)])}" fill="{iso.INK}" opacity="0.22" filter="{c.blur(1.2)}"/>')
    g = c.lin("rimg", 0, 0, 0, 26, [(0, T["shade"]), (0.3, T["mid"]), (1, T["mid"])])
    # the rim itself is soft-edged (no outline): the same tone as the terrain's face, darker at its foot
    c.add(c.on(c.m_bface(b), f'<path d="{poly(rim)}" fill="{g}" filter="{c.blur(1.2)}"/>'))
    inner = [(am + (x - am) * 0.88, z * 0.92) for x, z in rim]
    c.define("rimclip", f'<clipPath id="{c.id("rimclip")}"><path d="{poly(inner)}"/></clipPath>')
    lines = "".join(f"M{f(am - 14)},{f(z)} q6,{f(w)} 12,0 t12,0" for z, w in ((6.5, 0.8), (13, -0.7), (19.5, 0.6)))
    hatch = "".join(f"M{f(am + x)},{f(z)}l0.9,1.6" for x, z in ((-9.5, 4), (-8.6, 4.4), (-9.8, 10), (-8.9, 10.3), (-8, 17), (-7.1, 17.4),
                                                               (7.6, 5), (8.5, 5.3), (8.2, 12), (9.1, 12.4), (6, 19.5), (6.9, 19.8), (-2, 21.5), (-1.1, 21.8)))
    c.add(c.on(c.m_bface(b), f'<g clip-path="{c.url("rimclip")}">'
               f'<path d="{lines}" fill="none" stroke="{T["deep"]}" stroke-width="0.5" opacity="0.3"/>'
               f'<path d="{hatch}" stroke="{T["deep"]}" stroke-width="0.35" opacity="0.45"/></g>'))
    # a little scree where the rock was cut
    raw.rubble(c, [(am - 12, b + 2.6, 1.3, 41), (am + 9.5, b + 2.4, 1.1, 42), (am - 8, b + 4.6, 0.9, 43)], pal=TROCK)


def build_slope():
    """mine.slope: the works only, dug into the terrain's own massif (see SLOPE_FACE_*)."""
    c = iso.Canvas("mine", pid="mine-slope", stem="mine.slope")
    iso.ground(c)
    ta = SLOPE_TRACK_A
    iso.ground_ao(c, [(-40, -10), (6, -14), (34, -4), (34, 20), (8, 34), (-24, 32), (-42, 12)], grow=5, opacity=0.12)
    cut_rim(c)
    with c.at(*PORTAL_SHIFT):
        portal(c)
    # banner beside the tunnel
    iso.banner_b(c, 3, -12, 0, height=26, width=6, drop=11)
    # track and ore tub
    raw.rails_b(c, ta, PB + PORTAL_SHIFT[1] + 1.5, 26, gauge=GAUGE, step=3.6)
    raw.ore_tub(c, ta, 11, gauge=GAUGE)
    # spoil heap of waste rock (the massif's own stone), sorted ore, the tool crate, loose stones
    x, y = c.P(18, 2, 0)
    iso.blob_shadow(c, 22, 2, 9, 0.35)
    raw.heap(c, x, y, 12, 9, TROCK, seed=21, n=20)
    raw.rubble(c, [(12, 14, 1.6, 31), (26, 16, 1.3, 32), (32, -2, 1.3, 34)], pal=TROCK)
    x, y = c.P(4, 24, 0)
    iso.blob_shadow(c, 6, 24, 5.5, 0.35)
    raw.ore_heap(c, x, y, 6.5, 4.8, seed=14, n=14)
    tool_crate(c, -36, 2)
    raw.rubble(c, [(-28, 22, 1.4, 36), (-6, 36, 1.2, 37)], pal=TROCK)
    return c


def build():
    return [build_icon(), build_slope()]


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(p for cv in build() for p in cv.write(out)))
