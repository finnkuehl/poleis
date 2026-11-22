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
                    own massif (SLOPE_FACE below) with the flanks reaching forward on both sides; in
                    that niche: a heavy timber portal flush against the face inside a narrow rim of cut
                    rock, lamplight in the tunnel, a lean-to tool shed against the face, a shaft with a
                    timber headframe and windlass, rails with two ore carts, an ore-sorting table, a
                    wheelbarrow, the spoil heap, an ore pile and the tool crate. No outcrop, no peak,
                    no snow. Accent here: also the pennant on the headframe."""
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
# the works of mine.slope stay in the rock niche the terrain leaves in front of the face: about
# a -30 .. +12 next to the face, widening toward the front to about 40 from the tile centre
SHAFT = (10.0, -6.0)          # shaft with the headframe over it, right of the portal
LEAN_TO = (-29.0, -20.0)      # a range of the lean-to tool shed against the face (left of the portal)
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


def portal_slope(c):
    """The heavy timber portal of mine.slope: posts with their backs flush on the face plane, a
    squared lintel with a log cap, knee braces and raking shores, lamplight inside the tunnel. The
    opening is exactly SLOPE_OPEN x 0 .. PH (the terrain's contract)."""
    W = WOOD
    fb = SLOPE_FACE_B
    a0, a1 = SLOPE_OPEN
    am = (a0 + a1) / 2
    ph = PH
    # broken dark rock round the frame
    hole = [(a0 - 3.8, 0), (a0 - 4.4, ph * 0.6), (a0 - 3, ph + 4.6), (a0 + 2, ph + 6.6), (a1 - 1.6, ph + 7), (a1 + 3.2, ph + 5.2),
            (a1 + 4.4, ph * 0.55), (a1 + 4, 0)]
    c.add(c.on(c.m_bface(fb + 0.2), f'<path d="{poly(hole)}" fill="#4a4646"/>'
               f'<path d="{poly([(am + (x - am) * 0.93, y * 0.93) for x, y in hole])}" fill="#2e2b2c"/>'))
    # the tunnel: dark, warm lamplight from inside
    glow = c.rad("tunnel2", am + 0.5, 3.5, 9.5, [(0, "#ffd27a", 0.8), (0.3, "#e08a36", 0.6), (0.7, "#4a2a16", 0.45), (1, "#0e0a09", 0)])
    c.add(c.on(c.m_bface(fb + 0.3), f'<rect x="{f(a0)}" y="0" width="{f(a1 - a0)}" height="{f(ph)}" fill="#120d0b"/>'
               f'<rect x="{f(a0)}" y="0" width="{f(a1 - a0)}" height="{f(ph)}" fill="{glow}"/>'
               f'<path d="M{f(a0)},{f(ph)} L{f(a1)},{f(ph)} L{f(a1)},{f(ph - 2.6)} L{f(a0 + 2.4)},{f(ph - 2.6)} L{f(a0 + 2.4)},0 L{f(a0)},0Z" fill="#0a0706" opacity="0.6"/>'))
    x, y = c.P(am - 1.2, fb - 1.2, ph - 5.5)
    raw.lantern(c, x, y, k=0.5, glow=9)
    # rails disappearing into the tunnel
    c.add(c.on(c.m_ground(1.5), "".join(f'<rect x="{f(ra - 0.4)}" y="{f(fb - 5)}" width="0.8" height="5" fill="#6b5a48" opacity="0.8"/>' for ra in (SLOPE_TRACK_A - GAUGE / 2, SLOPE_TRACK_A + GAUGE / 2))))
    # raking shores leaning on the face on both sides
    for sa, s_ in ((a0 - 2.6, -1), (a1 + 2.6, 1)):
        raw.timber(c, (sa + s_ * 4.5, fb + 5.5, 0), (sa + s_ * 0.4, fb + 1.2, ph - 3), w=1.6)
    # posts (2.6 square), their backs on the face
    for pa0, pa1 in ((a0 - 2.6, a0), (a1, a1 + 2.6)):
        iso.box(c, pa0, pa1, fb, fb + 2.6, 0, ph + 1, W["lit"], W["base"], W["dark"], edge="#c99a6a")
        c.add(c.on(c.m_bface(fb + 2.6), f'<path d="M{f(pa0 + 0.7)},1.5V{f(ph - 1)}M{f(pa0 + 1.7)},3V{f(ph - 3)}" stroke="{W["deep"]}" stroke-width="0.3" opacity="0.6"/>'))
    # squared lintel with a log cap on top
    iso.box(c, a0 - 4.2, a1 + 4.2, fb, fb + 3, ph + 1, ph + 4.2, W["lit"], W["base"], W["dark"], edge="#d8ab78")
    c.add(c.on(c.m_bface(fb + 3), f'<path d="M{f(a0 - 3.6)},{f(ph + 2.4)}H{f(a1 + 3.6)}" stroke="{W["deep"]}" stroke-width="0.3" opacity="0.5"/>'
               "".join(f'<circle cx="{f(xx)}" cy="{f(ph + 2.6)}" r="0.45" fill="#2d2a26"/>' for xx in (a0 - 1.3, a1 + 1.3))))
    raw.log_a(c, fb + 1.6, ph + 5.8, a0 - 5, a1 + 4.6, 1.6, seed=12)
    # knee braces
    for a, s_ in ((a0, 1), (a1, -1)):
        x0, y0 = c.P(a, fb + 2.2, ph - 4.5)
        x1, y1 = c.P(a + s_ * 3.6, fb + 2.2, ph + 1)
        c.add(f'<path d="M{f(x0)},{f(y0)}L{f(x1)},{f(y1)}" stroke="{W["dark"]}" stroke-width="1.5" stroke-linecap="round"/>'
              f'<path d="M{f(x0 - 0.25)},{f(y0 - 0.25)}L{f(x1 - 0.25)},{f(y1 - 0.25)}" stroke="{W["lit"]}" stroke-width="0.5"/>')
    # owner cloth on the lintel, a lantern on the right post, a pick by the left post
    iso.drape_b(c, fb + 3.2, am - 3, am + 3, ph + 3.6, 6.5)
    x, y = c.P(a1 + 1.3, fb + 2.8, ph - 1.5)
    raw.lantern(c, x, y, k=0.8, glow=13)
    x, y = c.P(a0 - 3.4, fb + 3.4, 0)
    raw.pickaxe(c, x, y, k=0.75)


def lean_to(c):
    """Small plank lean-to against the face (LEAN_TO), open to the front: tools, rope, baskets."""
    W = WOOD
    fb = SLOPE_FACE_B
    a0, a1 = LEAN_TO
    d, zb, zf = 7.0, 15.0, 11.0          # depth, roof height at the face and at the front
    b1 = fb + d
    iso.cast_shadow(c, [(a0, fb), (a1 + 1, fb), (a1 + 1, b1 + 1), (a0, b1 + 1)], [(a1 + 1, fb, zb), (a1 + 1, b1 + 1, zf), (a0, b1 + 1, zf)], opacity=0.36, sd=1.4)
    # inside: dark plank back wall on the rock, tools and a coil of rope
    lp.plank_wall_b(c, fb + 0.3, a0, a1, 0, zb, name="ltb", top="#2a1c12", bottom="#5a4030", pitch=2.4)
    c.add(c.on(c.m_ground(0.2), f'<rect x="{a0}" y="{fb}" width="{a1 - a0}" height="{d}" fill="#2a1a0e" opacity="0.3" filter="{c.blur(1)}"/>'))
    for i, ta in enumerate((a0 + 2, a0 + 3.6)):
        x0, y0 = c.P(ta, fb + 2.4, 0)
        x1, y1 = c.P(ta + 0.6, fb + 0.6, 12)
        c.add(f'<path d="M{f(x0)},{f(y0)} L{f(x1)},{f(y1)}" stroke="{W["base"]}" stroke-width="0.8"/>')
    x, y = c.P(a0 + 2.3, fb + 2.4, 0.4)
    c.add(f'<path d="M{f(x - 1.4)},{f(y)} l2.8,0 l-0.4,2.6 l-2,0Z" fill="{raw.IRON["base"]}"/>')          # shovel blade
    x, y = c.P(a0 + 6.5, fb + 0.8, 9)
    c.add(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="2.2" ry="2.2" fill="none" stroke="#8a6a40" stroke-width="0.9"/>'
          f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="1.4" ry="1.4" fill="none" stroke="#c9ab7a" stroke-width="0.5"/>')
    lp.basket(c, a0 + 6, fb + 4.6, 0.55, fill=("#5a524e", "#a0603a", "#2a2624"), seed=4, heap=1.2)
    # the side wall on the +a end (plank trapezoid) and the front posts
    zt = lambda b: zb + (zf - zb) * (b - fb) / d   # noqa: E731
    c.add(c.on(c.m_aface(a1), f'<path d="{poly([(-fb, 0), (-b1, 0), (-b1, zt(b1)), (-fb, zb)])}" fill="#7a5a3a"/>'
               + "".join(f'<rect x="{f(-fb - k * 2.33 - 0.2)}" y="0" width="0.4" height="{f(zt(fb + k * 2.33))}" fill="#3e2a1a" opacity="0.6"/>' for k in (1, 2))))
    for a in (a0 + 0.8, a1 - 0.8):
        lp.post(c, a, b1 - 0.8, 0, zf, 0.8)
    # plank roof sloping from the face to the front, with its front fascia
    p = [c.P(a0 - 1, fb, zb + 0.6), c.P(a1 + 1.2, fb, zb + 0.6), c.P(a1 + 1.2, b1 + 1.4, zf - 0.2), c.P(a0 - 1, b1 + 1.4, zf - 0.2)]
    c.add(f'<path d="{poly(p)}" fill="{raw.SHINGLE["lit"]}"/>')
    lines = ""
    for k in range(1, 5):
        t = k / 5
        q0 = c.P(a0 - 1 + (a1 - a0 + 2.2) * t, fb, zb + 0.6)
        q1 = c.P(a0 - 1 + (a1 - a0 + 2.2) * t, b1 + 1.4, zf - 0.2)
        lines += f"M{f(q0[0])},{f(q0[1])}L{f(q1[0])},{f(q1[1])}"
    c.add(f'<path d="{lines}" stroke="{raw.SHINGLE["shade"]}" stroke-width="0.4" opacity="0.8"/>')
    iso.box(c, a0 - 1, a1 + 1.2, b1 + 1.4, b1 + 1.9, zf - 1.4, zf - 0.2, W["lit"], W["base"], W["dark"])
    iso.box(c, a1 + 1.2, a1 + 1.7, fb, b1 + 1.9, zf - 1.4, zf - 0.2, W["lit"], W["base"], W["dark"])


def headframe(c):
    """Timber headframe over a shaft (SHAFT): an A-frame with a back leg against the face, a pulley
    wheel at the top, the rope down into the shaft with a hanging basket, and the windlass in
    front that winds it. An owner-colour pennant flies from the top."""
    W = WOOD
    sa, sb = SHAFT
    zt = 24.0
    apex = (sa, sb, zt)
    # the shaft: a timber collar round a dark square hole
    iso.contact_ao(c, sa - 4, sa + 4, sb - 4, sb + 4, width=2, opacity=0.35)
    c.add(c.on(c.m_ground(0.2), f'<rect x="{f(sa - 3)}" y="{f(sb - 3)}" width="6" height="6" fill="#0e0a09"/>'))
    for (x0, x1, y0, y1) in ((sa - 4, sa + 4, sb - 4, sb - 3), (sa - 4, sa - 3, sb - 3, sb + 3)):
        iso.box(c, x0, x1, y0, y1, 0, 1.4, W["base"], W["dark"], W["deep"])
    for (x0, x1, y0, y1) in ((sa - 4, sa + 4, sb + 3, sb + 4), (sa + 3, sa + 4, sb - 3, sb + 3)):
        iso.box(c, x0, x1, y0, y1, 0, 1.4, W["lit"], W["base"], W["dark"], edge="#c99a6a")
    # back leg (to the face), then the rope and its basket, then the two front legs
    raw.timber(c, (sa, SLOPE_FACE_B + 1, 0), apex, w=1.8, col=W["dark"], lit=W["base"])
    raw.rope(c, (sa, sb - 2, zt - 1), (sa, sb - 2, 9))
    x, y = c.P(sa, sb - 2, 9)
    c.add(f'<path d="M{f(x - 2.2)},{f(y)} L{f(x + 2.2)},{f(y)} L{f(x + 1.7)},{f(y + 3)} L{f(x - 1.7)},{f(y + 3)}Z" fill="{lp.BURLAP["base"]}"/>'
          f'<path d="M{f(x - 2.2)},{f(y)} L{f(x + 2.2)},{f(y)}" stroke="{lp.BURLAP["dark"]}" stroke-width="0.6"/>'
          f'<path d="M{f(x - 1.8)},{f(y)} Q{f(x)},{f(y - 2.6)} {f(x + 1.8)},{f(y)}" fill="none" stroke="#6e5638" stroke-width="0.5"/>')
    iso.blob_shadow(c, sa + 6, sb, 6, 0.3)
    raw.timber(c, (sa - 6, sb + 0.5, 0), apex, w=2)
    raw.timber(c, (sa + 6, sb + 0.5, 0), apex, w=2, col=W["dark"], lit=W["base"])
    raw.timber(c, (sa - 3.3, sb + 0.3, 11), (sa + 3.3, sb + 0.3, 11), w=1.2)
    # the pulley wheel at the top (plane a = sa) and the rope forward to the windlass
    c.add(c.on(c.m_aface(sa + 0.6), f'<g transform="translate({f(-sb)} {f(zt - 1)})"><circle r="2.6" fill="none" stroke="{W["deep"]}" stroke-width="1.1"/>'
               f'<circle r="2.6" fill="none" stroke="{W["base"]}" stroke-width="0.7"/><path d="M-2.4,0H2.4M0,-2.4V2.4" stroke="{W["base"]}" stroke-width="0.5"/>'
               f'<circle r="0.6" fill="{W["dark"]}"/></g>'))
    raw.rope(c, (sa, sb + 2.6, zt - 1), (sa, sb + 11, 6.2))
    x, y = c.P(*apex)
    raw.pennant(c, x, y - 0.6, length=9, height=4.2, pole=7)
    windlass(c, sa, sb + 11)


def windlass(c, a, b):
    """Windlass: a drum along a on two trestles, a crank on its right end."""
    W = WOOD
    iso.blob_shadow(c, a + 2, b, 6, 0.3)
    for aa in (a - 4,):
        raw.timber(c, (aa, b - 2.4, 0), (aa, b, 6.6), w=1.1, col=W["dark"], lit=W["base"])
        raw.timber(c, (aa, b + 2.4, 0), (aa, b, 6.6), w=1.1)
    raw.log_a(c, b, 6, a - 4.6, a + 4.6, 1.3, seed=8)
    for aa in (a + 4,):
        raw.timber(c, (aa, b - 2.4, 0), (aa, b, 6.6), w=1.1, col=W["dark"], lit=W["base"])
        raw.timber(c, (aa, b + 2.4, 0), (aa, b, 6.6), w=1.1)
    x0, y0 = c.P(a + 5, b, 6)
    c.add(f'<path d="M{f(x0)},{f(y0)} l1.6,0.8 l0,3" fill="none" stroke="{raw.IRON["dark"]}" stroke-width="0.8" stroke-linecap="round"/>')


def sorting_table(c, a0, a1, b0, b1):
    """Plank table where the ore is sorted into small heaps, baskets of ore beside it."""
    zt = lp.table(c, a0, a1, b0, b1, 6.4, th=1)
    for i, (t, seed) in enumerate(((0.25, 3), (0.55, 5), (0.82, 7))):
        x, y = c.P(a0 + (a1 - a0) * t, (b0 + b1) / 2, zt)
        raw.ore_heap(c, x, y, 2.4, 1.8, seed=seed, n=5)
    lp.basket(c, a1 + 2.6, b1 + 1.5, 0.62, fill=("#5a524e", "#a0603a", "#2a2624"), seed=9, heap=1.3)
    lp.basket(c, a0 + 1, b1 + 3.4, 0.56, fill=("#4f6a5e", "#7d4a32", "#2a2624"), seed=10, heap=1.2)


def wheelbarrow(c, a, b):
    """Wooden wheelbarrow along a, its wheel toward -a, heaped with ore."""
    W = WOOD
    iso.blob_shadow(c, a + 3, b, 6, 0.32)
    raw.wheel_b(c, a - 1, b + 2.4, 1.9, 1.9, dark=True)
    for bb in (b - 1.8, b + 1.8):
        raw.timber(c, (a - 1, b, 1.9), (a + 9, bb, 3.4), w=0.9)
        raw.timber(c, (a + 5.5, bb, 0), (a + 5.5, bb, 2.6), w=0.8, col=W["dark"])
    iso.box(c, a, a + 6.5, b - 2.2, b + 2.2, 2.4, 4.6, "#3a3230", W["base"], W["dark"], edge="#c99a6a")
    x, y = c.P(a + 3.2, b, 4.6)
    raw.ore_heap(c, x + 0.3, y + 1, 4, 2.6, seed=17, n=8)
    raw.wheel_b(c, a - 1, b + 2.6, 1.9, 1.9)


def build_slope():
    """mine.slope: the works only, in the niche the terrain cuts into its own massif (SLOPE_FACE_*)."""
    c = iso.Canvas("mine", pid="mine-slope", stem="mine.slope")
    iso.ground(c)
    ta = SLOPE_TRACK_A
    fb = SLOPE_FACE_B
    iso.ground_ao(c, [(-32, -14), (12, -14), (32, 0), (34, 20), (10, 36), (-20, 34), (-40, 16)], grow=5, opacity=0.13)
    cut_rim(c)
    iso.banner_b(c, -30, -5, 0, height=26, width=6, drop=11)
    lean_to(c)
    portal_slope(c)
    # track with two ore carts
    raw.rails_b(c, ta, fb + 2.6, 32, gauge=GAUGE, step=3.6)
    raw.ore_tub(c, ta, -2, gauge=GAUGE)
    headframe(c)
    # spoil heap of waste rock (the massif's own stone) on the right
    x, y = c.P(22, 8, 0)
    iso.blob_shadow(c, 26, 8, 9, 0.35)
    raw.heap(c, x, y, 12, 9, TROCK, seed=21, n=20)
    raw.rubble(c, [(14, 18, 1.5, 31), (30, 18, 1.2, 32), (32, 2, 1.2, 34)], pal=TROCK)
    # ore sorting on the left, the second cart, the sorted ore, a wheelbarrow, the tool crate
    sorting_table(c, -27, -18, 1, 6)
    tool_crate(c, -36, 12)
    raw.ore_tub(c, ta, 24, gauge=GAUGE)
    wheelbarrow(c, 9, 15)
    x, y = c.P(2, 30, 0)
    iso.blob_shadow(c, 4, 30, 5.5, 0.35)
    raw.ore_heap(c, x, y, 6.5, 4.8, seed=14, n=14)
    raw.rubble(c, [(-30, 32, 1.3, 36), (-4, 36, 1.1, 37), (16, 30, 1.2, 38)], pal=TROCK)
    return c


def build():
    return [build_icon(), build_slope()]


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(p for cv in build() for p in cv.write(out)))
