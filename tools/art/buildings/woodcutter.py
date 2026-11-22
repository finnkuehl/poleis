"""woodcutter - a small log cabin with its gable to the front and a shingle roof, standing directly
on the map (grounded, docs/ART.md; the game keeps the real forest around the tile, so only one
young pine here): a stacked pile of logs, a chopping block with an axe and split firewood, a
sawbuck, a felled trunk and a fresh stump.
Accent (owner colour): the painted front gable, the painted door, the closed window shutters and a
pennant on the gable."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_raw as raw  # noqa: E402
from iso import ACCENT, f, poly  # noqa: E402

HUT = (-9, -11)         # cabin centre (world units; keep everything inside iso.GROUND_R)
A, B = 16, 20           # half extents of the log walls (gable front along a, long side along b): 32 x 40
F = 2.2                 # fieldstone footing
H = 24                  # wall height (eave line)
D = 4.2                 # log course height
PILE = (10, 39, -14, 8)  # log stack: a0, a1, b0, b1 (end grain at b1)
KA, KB = A + 3.5, B + 2  # roof half extents incl. overhangs
RISE = 11.7             # roof rise above the eaves (rise / KA = 0.6 so the lit left slope shows)
TANP = RISE / KA
T = 2.2
ZEAV = H + T - (KA - A) * TANP + 1.2


def cabin(c):
    """The log cabin, drawn around its own origin (use c.at(HUT))."""
    zrid = ZEAV + RISE
    iso.cast_shadow(c, [(sa * (A + 2), sb * (B + 2)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * KA, sb * KB, ZEAV) for sa in (-1, 1) for sb in (-1, 1)] + [(0, sb * KB, zrid + 2) for sb in (-1, 1)], opacity=0.5)
    iso.contact_ao(c, -A - 1, A + 1, -B - 1, B + 1)
    iso.box(c, -A - 0.8, A + 0.8, -B - 0.8, B + 0.8, 0, F, "#cfc6b3", "#c4b9a3", "#8f877b")
    raw.log_wall_a(c, A, -B, B, F + D / 2, H, D)
    raw.log_wall_b(c, B, -A, A, F, H, D)
    # plank gable above the front wall
    zg = H + A * TANP
    # painted plank gable (owner colour), plank seams and the loft window are art on top
    gg = c.lin("gable", 0, H, 0, zg, [(0, ACCENT["mid"]), (1, ACCENT["lit"])])
    c.accent(c.on(c.m_bface(B), f'<path d="{poly([(-A, H), (0, zg), (A, H)])}" fill="{gg}"/>'))
    g = []
    for i in range(1, 7):
        x = -A + i * 2 * A / 7
        g.append(f'<rect x="{f(x - 0.25)}" y="{f(H)}" width="0.5" height="{f(zg - H)}" fill="#1d2b36" opacity="0.4"/>')
    # little hay-loft window in the gable
    g.append(f'<rect x="-2.6" y="{f(H + 2.4)}" width="5.2" height="5" fill="#2a1c12"/><rect x="-3.2" y="{f(H + 1.6)}" width="6.4" height="0.9" fill="{raw.LOGWALL["hi"]}"/>'
             f'<rect x="-2.6" y="{f(H + 6.4)}" width="5.2" height="1" fill="#1a110a" opacity="0.6"/>')
    g.append(f'<path d="{poly([(-A, H), (0, zg), (A, H), (A, H + 0.01), (0, zg - 3.5), (-A, H + 0.01)])}" fill="#2a1d13" opacity="0.3"/>')
    c.add(c.on(c.m_bface(B), "".join(g)))
    # door: dark frame (art) + painted leaf (accent) + iron straps (art on top)
    x0, x1, z0, z1 = -4.5, 4.5, F, F + 16      # door 9 x 16 (README "Scale")
    c.add(c.on(c.m_bface(B), f'<rect x="{f(x0 - 1.4)}" y="{f(z0)}" width="{f(x1 - x0 + 2.8)}" height="{f(z1 - z0 + 1.6)}" fill="{raw.LOGWALL["deep"]}"/>'
               f'<rect x="{f(x0 - 1.8)}" y="{f(z1 + 0.8)}" width="{f(x1 - x0 + 3.6)}" height="1.2" fill="{raw.LOGWALL["hi"]}"/>'))
    dg = c.lin("door", 0, 0, 1, 0, [(0, ACCENT["lit"]), (0.6, ACCENT["light"]), (1, ACCENT["mid"])], bbox=True)
    planks = "".join(f'<rect x="{f(x0 + i * (x1 - x0) / 3 - 0.25)}" y="{f(z0)}" width="0.5" height="{f(z1 - z0)}" fill="{ACCENT["shade"]}"/>' for i in (1, 2))
    c.accent(c.on(c.m_bface(B), f'<rect x="{f(x0)}" y="{f(z0)}" width="{f(x1 - x0)}" height="{f(z1 - z0)}" fill="{dg}"/>{planks}'))
    c.add(c.on(c.m_bface(B), "".join(f'<rect x="{f(x0)}" y="{f(zz)}" width="{f(x1 - x0)}" height="1" fill="#3b3430"/>' for zz in (z0 + 3, z1 - 4))
               + f'<circle cx="{f(x1 - 1.8)}" cy="{f(z0 + 7.5)}" r="0.9" fill="none" stroke="#3b3430" stroke-width="0.5"/>'
               f'<path d="{poly([(x0, z1), (x1, z1), (x1, z1 - 2.2), (x0 + 2, z1 - 2.2), (x0 + 2, z0)])}" fill="#1d1208" opacity="0.28"/>'))
    # small window with closed shutters (owner colour) on the long side
    c.add(c.on(c.m_aface(A), f'<rect x="-9" y="9.2" width="10" height="8.6" fill="{raw.LOGWALL_R["deep"]}"/>'))
    iso.window_a(c, A, -8.2, 0.2, 10, 17)
    # protruding log ends at the visible corners (alternating courses)
    r = D / 2 - 0.15
    z = F + D / 2
    k = 0
    while z < H - 0.5:
        if k % 2 == 0:
            raw.log_a(c, B - r, z, A - 1, A + 2.6, r, raw.LOGWALL, seed=k)           # front corner, front-wall log
            raw.log_a(c, -B + r, z, A - 1, A + 2.6, r, raw.LOGWALL, seed=k + 20)     # back corner, back-wall log
        else:
            raw.log_b(c, A - r, z, B - 1, B + 2.6, r, raw.LOGWALL, seed=k)            # front corner, side-wall log
            raw.log_b(c, -A + r, z, B - 1, B + 2.6, r, raw.LOGWALL, seed=k + 60)      # left corner, side-wall log
        z += D / 2
        k += 1
    raw.shingle_roof_b(c, KA, KB, ZEAV, RISE, pal=raw.SHINGLE_GREY)
    # pennant on the front apex
    x, y = c.P(0, KB + 1.2, zrid + 1.8)
    raw.pennant(c, x, y, length=15, height=7, pole=13)


def build():
    c = iso.Canvas("woodcutter")
    iso.ground(c)
    ha, hb = HUT
    a0, a1, b0, b1 = PILE
    # wide soft AO under the cabin, the log stack and the work place in front
    iso.ground_ao(c, [(ha - A - 3, hb - B - 3), (a1 + 2, b0), (a1 + 4, 30), (-26, 46), (ha - A - 3, hb + B + 3)], grow=6, opacity=0.14)

    # one young pine behind the cabin
    raw.pine(c, -40, -36, h=40, seed=12)

    with c.at(*HUT):
        cabin(c)

    # a big stack of logs beside the cabin, end grain toward the yard
    iso.cast_shadow(c, [(a0, b0), (a1, b0), (a1, b1), (a0, b1)], [(a0, b0, 17), (a1, b0, 5), (a0, b1, 17), (a1, b1, 5)], opacity=0.4, sd=1.6)
    iso.contact_ao(c, a0, a1, b0, b1, width=3, opacity=0.35)
    raw.log_pile_b(c, a0 + 2.7, b0, b1, 2.7, rows=(5, 4, 3, 2), seed=5)
    iso.foot_tufts(c, [((ha - A - 1, hb + B + 1), (ha - 6, hb + B + 1)), ((a1, b1), (a1, b0)), ((a0, b1), (a1, b1))],
                   n=12, seed=8, kind="meadow", stones=2)

    # fresh stump of a felled pine and the trunk lying in front
    raw.stump(c, -36, 22, 4.2, 5, seed=2)
    raw.chips(c, -34, 27, 5, n=8, seed=3)
    iso.blob_shadow(c, -6, 44, 16, 0.3)
    raw.log_a(c, 42, 4.4, -30, 8, 4.4, seed=31)
    for aa in (-18, -4):
        x, y = c.P(aa, 42 - 3.4, 8.2)
        c.add(f'<path d="M{f(x)},{f(y)} l-2.4,-3.2" stroke="{raw.BARK["base"]}" stroke-width="1.4" stroke-linecap="round"/>')

    # chopping block with the axe and split firewood
    raw.chips(c, 18, 26, 9, n=18, seed=9)
    iso.blob_shadow(c, 20, 24, 5, 0.35)
    raw.stump(c, 18, 24, 5, 6.5, seed=7)
    x, y = c.P(18, 24, 6.5)
    raw.axe(c, x - 1, y - 0.5, k=1.2)
    raw.log_a(c, 34, 1.4, 26, 32, 1.4, seed=41)
    raw.log_b(c, 30, 1.5, 22, 28, 1.5, seed=42)
    raw.log_a(c, 37, 1.4, 22, 27.5, 1.4, seed=43)
    sawbuck(c, 38, 22)
    iso.pebbles(c, [(46, -8, 1.6, 51), (44, -2, 1.1, 52)])
    return c


def sawbuck(c, a, b, length=12):
    """X-legged sawing trestle along a with a short log lying in it."""
    W = iso.WOOD
    iso.blob_shadow(c, a + 4, b, length * 0.45, 0.3)
    for aa in (a - length / 2 + 1.5, a + length / 2 - 1.5):
        for sb, col in ((-1, W["dark"]), (1, W["base"])):
            p, q = c.P(aa, b - 3.2 * sb, 0), c.P(aa, b + 1.6 * sb, 8.5)
            c.add(f'<path d="M{f(p[0])},{f(p[1])} L{f(q[0])},{f(q[1])}" stroke="{col}" stroke-width="1.4" stroke-linecap="round"/>')
    raw.log_a(c, b, 9.2, a - length / 2 - 2, a + length / 2 + 2.5, 2.3, seed=61)


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
