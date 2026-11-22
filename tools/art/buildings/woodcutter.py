"""woodcutter - a small log cabin with its gable to the front and a shingle roof, among tall
pines; a stacked pile of logs, a chopping block with an axe, a felled trunk and a fresh stump.
Accent (owner colour): base rim band, the painted door and a pennant on the gable."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_raw as raw  # noqa: E402
from iso import ACCENT, f, poly  # noqa: E402

HUT = (-9, -11)         # cabin centre on the base
A, B = 16, 20           # half extents of the log walls (gable front along a, long side along b)
F = 2.2                 # fieldstone footing
H = 24                  # wall height (eave line)
D = 4.2                 # log course height
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
    gg = c.lin("gable", 0, H, 0, zg, [(0, "#8a6440"), (1, "#a87b52")])
    g = [f'<path d="{poly([(-A, H), (0, zg), (A, H)])}" fill="{gg}"/>']
    for i in range(1, 7):
        x = -A + i * 2 * A / 7
        g.append(f'<rect x="{f(x - 0.25)}" y="{f(H)}" width="0.5" height="{f(zg - H)}" fill="#4a3322" opacity="0.6"/>')
    # little hay-loft window in the gable
    g.append(f'<rect x="-2.6" y="{f(H + 2.4)}" width="5.2" height="5" fill="#2a1c12"/><rect x="-3.2" y="{f(H + 1.6)}" width="6.4" height="0.9" fill="{raw.LOGWALL["hi"]}"/>'
             f'<rect x="-2.6" y="{f(H + 6.4)}" width="5.2" height="1" fill="#1a110a" opacity="0.6"/>')
    g.append(f'<path d="{poly([(-A, H), (0, zg), (A, H), (A, H + 0.01), (0, zg - 3.5), (-A, H + 0.01)])}" fill="#2a1d13" opacity="0.3"/>')
    c.add(c.on(c.m_bface(B), "".join(g)))
    # door: dark frame (art) + painted leaf (accent) + iron straps (art on top)
    x0, x1, z0, z1 = -4, 4, F, F + 14.5
    c.add(c.on(c.m_bface(B), f'<rect x="{f(x0 - 1.4)}" y="{f(z0)}" width="{f(x1 - x0 + 2.8)}" height="{f(z1 - z0 + 1.6)}" fill="{raw.LOGWALL["deep"]}"/>'
               f'<rect x="{f(x0 - 1.8)}" y="{f(z1 + 0.8)}" width="{f(x1 - x0 + 3.6)}" height="1.2" fill="{raw.LOGWALL["hi"]}"/>'))
    dg = c.lin("door", 0, 0, 1, 0, [(0, ACCENT["lit"]), (0.6, ACCENT["light"]), (1, ACCENT["mid"])], bbox=True)
    planks = "".join(f'<rect x="{f(x0 + i * (x1 - x0) / 3 - 0.25)}" y="{f(z0)}" width="0.5" height="{f(z1 - z0)}" fill="{ACCENT["shade"]}"/>' for i in (1, 2))
    c.accent(c.on(c.m_bface(B), f'<rect x="{f(x0)}" y="{f(z0)}" width="{f(x1 - x0)}" height="{f(z1 - z0)}" fill="{dg}"/>{planks}'))
    c.add(c.on(c.m_bface(B), "".join(f'<rect x="{f(x0)}" y="{f(zz)}" width="{f(x1 - x0)}" height="1" fill="#3b3430"/>' for zz in (z0 + 3, z1 - 4))
               + f'<circle cx="{f(x1 - 1.8)}" cy="{f(z0 + 7.5)}" r="0.9" fill="none" stroke="#3b3430" stroke-width="0.5"/>'
               f'<path d="{poly([(x0, z1), (x1, z1), (x1, z1 - 2.2), (x0 + 2, z1 - 2.2), (x0 + 2, z0)])}" fill="#1d1208" opacity="0.28"/>'))
    # small window with a propped shutter on the long side
    c.add(c.on(c.m_aface(A), f'<rect x="-6" y="10" width="6" height="5.4" fill="#22170f"/><rect x="-6.6" y="9.2" width="7.2" height="0.9" fill="{raw.LOGWALL_R["deep"]}"/>'))
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
    raw.pennant(c, x, y, length=11, height=5, pole=10)


def build():
    c = iso.Canvas("woodcutter")
    ha, hb = HUT
    iso.base(c, seed=17, avoid=lambda a, b: (ha - A - 3 < a < ha + A + 3 and hb - B - 3 < b < hb + B + 3), tufts=80)
    # worn earth yard with wood chips in front of the cabin
    raw.ground_patch(c, 4, 18, 26, 20, "#c4a26a", 0.55, seed=3, blur=2)
    raw.ground_patch(c, 4, 18, 15, 12, "#d8bb84", 0.55, seed=4, blur=1.6)

    # back row of pines
    raw.pine(c, -46, -24, h=70, seed=11)
    raw.pine(c, -12, -50, h=64, seed=12)
    raw.pine(c, 22, -46, h=52, seed=13)

    with c.at(*HUT):
        cabin(c)

    # log pile beside the cabin (ends toward the yard)
    iso.cast_shadow(c, [(14, -12), (14, 8), (32, -12), (32, 8)], [(14, -12, 12), (32, -12, 4), (14, 8, 12), (32, 8, 4)], opacity=0.4, sd=1.6)
    iso.contact_ao(c, 14, 32, -12, 8, width=3, opacity=0.35)
    raw.log_pile_b(c, 16.5, -12, 7, 2.6, rows=(4, 3, 2), seed=5)
    raw.pine(c, 40, -24, h=40, seed=15)

    raw.pine(c, -54, 10, h=46, seed=14)
    # fresh stump of a felled pine and the trunk lying in front
    raw.stump(c, -34, 28, 4.2, 5, seed=2)
    iso.blob_shadow(c, 2, 44, 18, 0.3)
    raw.log_a(c, 42, 4.4, -22, 18, 4.4, seed=31)
    for aa in (-10, 4):
        x, y = c.P(aa, 42 - 3.4, 8.2)
        c.add(f'<path d="M{f(x)},{f(y)} l-2.4,-3.2" stroke="{raw.BARK["base"]}" stroke-width="1.4" stroke-linecap="round"/>')

    # chopping block with the axe and split firewood
    raw.chips(c, 22, 24, 9, n=18, seed=9)
    iso.blob_shadow(c, 24, 22, 5, 0.35)
    raw.stump(c, 22, 22, 5, 6.5, seed=7)
    x, y = c.P(22, 22, 6.5)
    raw.axe(c, x - 1, y - 0.5, k=1.2)
    raw.log_a(c, 32, 1.4, 30, 36, 1.4, seed=41)
    raw.log_b(c, 34, 1.5, 20, 26, 1.5, seed=42)
    iso.base_tufts(c, [((ha - A - 1, hb + B + 1), (ha + A + 1, hb + B + 1)), ((ha + A + 1, hb + B + 1), (ha + A + 1, hb - B - 1))], n=12, seed=8)
    iso.rocks(c, [(56, -6, 2.6, 51), (52, 2, 1.6, 52)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
