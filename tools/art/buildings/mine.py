"""mine - a rugged grey mountain with a snowy peak; a timbered tunnel mouth with a lantern,
rails coming out of the dark and an ore tub heaped with copper and tin ore, a spoil heap.
Accent (owner colour): base rim band, the banner beside the tunnel and the short cloth on the
lintel."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_raw as raw  # noqa: E402
from iso import f, poly  # noqa: E402

PB = -4.0                 # portal plane (b) on the front of the mountain
PA0, PA1 = -27.0, -9.0    # tunnel opening (a range)
PH = 19.0                 # opening height
TRACK_A = -18.0           # track centre line


def portal(c):
    """Timber-framed tunnel mouth on the plane b = PB."""
    W = iso.WOOD
    # the dark tunnel: irregular rock-cut hole, glowing faintly inside
    hole = [(PA0 - 3.5, 0), (PA0 - 4.2, PH * 0.6), (PA0 - 2.4, PH + 3.2), (PA0 + 3, PH + 5.2), (PA1 - 2, PH + 5.6),
            (PA1 + 2.8, PH + 3.6), (PA1 + 4.4, PH * 0.55), (PA1 + 3.6, 0)]
    c.add(c.on(c.m_bface(PB - 0.6), f'<path d="{poly(hole)}" fill="#4a4646"/>'
               f'<path d="{poly([(x * 0.94 + (PA0 + PA1) / 2 * 0.06, y * 0.93) for x, y in hole])}" fill="#2e2b2c"/>'))
    glow = c.rad("tunnel", (PA0 + PA1) / 2 + 2, 3, 7, [(0, "#c9782e", 0.55), (0.6, "#3a2416", 0.5), (1, "#0e0a09", 0)])
    c.add(c.on(c.m_bface(PB - 0.3), f'<rect x="{f(PA0)}" y="0" width="{f(PA1 - PA0)}" height="{f(PH)}" fill="#120d0b"/>'
               f'<rect x="{f(PA0)}" y="0" width="{f(PA1 - PA0)}" height="{f(PH)}" fill="{glow}"/>'))
    # rails disappearing into the tunnel
    c.add(c.on(c.m_ground(1.5), "".join(f'<rect x="{f(ra - 0.5)}" y="{f(PB - 7)}" width="1" height="7" fill="#6b5a48" opacity="0.8"/>' for ra in (TRACK_A - 3.5, TRACK_A + 3.5))))
    # posts, lintel and knee braces
    for a in (PA0 - 1, PA1 + 1):
        iso.box(c, a - 1.5, a + 1.5, PB - 1.5, PB + 1.5, 0, PH, W["lit"], W["base"], W["dark"])
        c.add(c.on(c.m_bface(PB + 1.2), f'<path d="M{f(a - 0.6)},2V{f(PH - 2)}M{f(a + 0.5)},4V{f(PH - 4)}" stroke="{W["deep"]}" stroke-width="0.3" opacity="0.6"/>'))
    raw.log_a(c, PB + 0.2, PH + 2, PA0 - 4, PA1 + 3.6, 2.2, seed=12)
    for a, s in ((PA0 - 1, 1), (PA1 + 1, -1)):
        x0, y0 = c.P(a, PB + 1.3, PH - 5)
        x1, y1 = c.P(a + s * 4.5, PB + 1.3, PH + 0.6)
        c.add(f'<path d="M{f(x0)},{f(y0)}L{f(x1)},{f(y1)}" stroke="{W["dark"]}" stroke-width="1.5" stroke-linecap="round"/>'
              f'<path d="M{f(x0 - 0.3)},{f(y0 - 0.3)}L{f(x1 - 0.3)},{f(y1 - 0.3)}" stroke="{W["lit"]}" stroke-width="0.5"/>')
    # short owner cloth on the lintel, then the lantern on the right post
    iso.drape_b(c, PB + 2.5, (PA0 + PA1) / 2 - 3.6, (PA0 + PA1) / 2 + 3.6, PH + 4.4, 9)
    x, y = c.P(PA1 + 2.6, PB + 1.6, PH - 1)
    raw.lantern(c, x, y, k=0.95)
    x, y = c.P(PA0 - 2.8, PB + 2.2, 0)
    raw.pickaxe(c, x, y, k=0.9)


def build():
    c = iso.Canvas("mine")
    iso.base(c, seed=37, avoid=lambda a, b: a < 22 and b < 0 and a > -56, tufts=70, flowers=10)
    # trodden gravel in front of the tunnel and along the track
    raw.ground_patch(c, -14, 18, 22, 30, "#8d8478", 0.45, seed=7, blur=2.2)
    raw.ground_patch(c, -16, 6, 14, 12, "#7e766b", 0.4, seed=8, blur=1.6)

    # the outcrop: a broad craggy mass, a cut face around the tunnel, rocks framing it
    R = raw.ROCK
    raw.boulder(c, 22, -36, 17, 15, 30, seed=16, pal=R, n=26, cone=0.15)
    raw.boulder(c, -16, -38, 30, 22, 58, seed=13, pal=R, n=34, cone=0.25, snow=48)
    raw.boulder(c, -46, -22, 15, 18, 34, seed=19, pal=R, n=24, cone=0.15)
    raw.rock_prism(c, [(-38, PB), (2, PB), (6, -14), (0, -30), (-32, -30), (-42, -14)], 0, 26, R, seed=1, zj=2.5)
    with c.at(0, 0, 23):
        raw.boulder(c, -24, -18, 16, 12, 15, seed=21, pal=R, n=24, cone=0.1)
        raw.boulder(c, -3, -19, 11, 10, 11, seed=22, pal=R, n=20, cone=0.1)
    raw.boulder(c, 16, -14, 11, 12, 17, seed=31, pal=R, n=22)
    raw.boulder(c, -45, 0, 8, 8, 12, seed=32, pal=R, n=16)
    iso.base_tufts(c, [((-38, PB), (2, PB)), ((10, 0), (28, -4))], n=10, seed=5, hmax=3)

    portal(c)
    # banner beside the tunnel
    iso.banner_b(c, 2, 2, 0, height=34, width=7, drop=14)
    # track, ore tub and spoil
    raw.rails_b(c, TRACK_A, PB + 1.5, 46)
    raw.ore_tub(c, TRACK_A, 24)
    x, y = c.P(22, 14, 0)
    iso.blob_shadow(c, 26, 14, 11, 0.35)
    raw.heap(c, x, y, 15, 11, raw.ROCK, seed=21, n=22)
    raw.rubble(c, [(14, 22, 2.6, 31), (30, 24, 2, 32), (8, 30, 1.6, 33), (36, 6, 1.8, 34)])
    x, y = c.P(4, 36, 0)
    iso.blob_shadow(c, 7, 36, 7, 0.35)
    raw.ore_heap(c, x, y, 8.5, 6, seed=14, n=16)
    raw.rubble(c, [(-40, 18, 2.2, 35), (-34, 28, 1.6, 36), (-6, 46, 1.4, 37)])
    iso.rocks(c, [(54, -2, 2.4, 81), (44, 36, 1.8, 82)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
