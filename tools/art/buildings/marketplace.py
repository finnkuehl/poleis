"""marketplace - the market of the polis, standing directly on the map (grounded, docs/ART.md; the
game paints the paved square): a long marble stoa (a colonnade with shops at its back wall) under
a tiled roof, three market stalls heaped with produce under big striped awnings, amphorae,
baskets, sacks, a loaded hand cart.
Accent (owner colour): the striped stall awnings (two shades of the owner colour), the painted
metopes of the stoa's frieze and the curtains in the shop doors."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_civic as lc  # noqa: E402
from iso import f, poly  # noqa: E402
from lib_civic import rect  # noqa: E402

# world units; keep everything inside iso.GROUND_R = 58. Human scale: door 16 x 9, person ~14.
STOA = (-5, -23)
SA, SB = 32, 8.5        # half extents of the stoa floor (top step): 64 x 17
STEP_W, STEP_H = 2.4, 2.2
N_COL = 7
Z_COL = 22              # shaft height (columns ~1.6 x a man)
RISE, T = 6.2, 3.6      # roof
SHOPS = (-22, -11, 0, 11, 22)   # shop doors in the back wall (9 wide, 16 high)


def stoa(c):
    zst = 2 * STEP_H
    zsh = zst + Z_COL
    zab = zsh + 3.5
    sa0, sb0 = SA + STEP_W, SB + STEP_W
    bv = SB + 4.2
    tanp = RISE / bv
    iso.cast_shadow(c, [(sa * sa0, sb * sb0) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * (SA + 2), sb * bv, zab + 12) for sa in (-1, 1) for sb in (-1, 1)] + [(sa * (SA + 2), 0, zab + 20) for sa in (-1, 1)], opacity=0.46)
    iso.contact_ao(c, -sa0, sa0, -sb0, sb0, opacity=0.45)
    iso.marble_steps(c, SA, SB, 2, STEP_W, STEP_H, joint=9)
    # shaded floor of the walk
    c.add(c.on(c.m_ground(zst), rect(-SA + 1, -SB + 3, 2 * SA - 2, 2 * SB - 5.5, "#a9a497")))
    # back wall with the shop doors (curtains = ACCENT), in the shade of the roof
    bw = -SB + 3
    iso.lime_wall_b(c, bw, -SA + 1, SA - 1, zst, zab, mottle=6)
    g, cur = [rect(-SA + 1, zst, 2 * SA - 2, zab - zst, "#4a4336", 0.4)], []
    fold = c.lin("curt", 0, 0, 1, 0, [(0, iso.ACCENT["mid"]), (0.3, iso.ACCENT["shade"]), (0.55, iso.ACCENT["mid"]), (0.8, iso.ACCENT["dark"]), (1, iso.ACCENT["shade"])], bbox=True)
    for x in SHOPS:
        g.append(rect(x - 4.5, zst, 9, 17.4, "#8f8776") + rect(x - 3.5, zst, 7, 16, "#1c1611"))
        cur.append(f'<path d="M{f(x - 3.5)},{f(zst + 16)} L{f(x + 3.5)},{f(zst + 16)} L{f(x + 3.5)},{f(zst + 10)} Q{f(x)},{f(zst + 8)} {f(x - 3.5)},{f(zst + 4.5)}Z" fill="{fold}"/>')
    c.add(c.on(c.m_bface(bw), "".join(g)))
    c.accent(c.on(c.m_bface(bw), "".join(cur)))
    # goods stacked in the shop fronts (jars and sacks against the back wall)
    with c.at(0, 0, zst):
        for x in (-16.5, 5.5, 16.5):
            iso.amphora(c, x - 1.5, bw + 2, k=0.62)
    c.add(c.on(c.m_aface(SA - 1), rect(SB - 3 - 3, zst, 3, zab - zst, "#a9a8a2")))
    cols = [-SA + 3.5 + i * (2 * SA - 7) / (N_COL - 1) for i in range(N_COL)]
    cb = SB - 3.4
    for a in cols:
        iso.column_shadow(c, a, cb, zst, 2.6, length=7)
    for a in cols:
        iso.doric_column(c, a, cb, zst, zsh, 2.6, 2.2, cap=3.4)
    ea, eb = SA - 0.5, SB - 0.2
    zco = iso.entablature(c, ea, eb, zab, front_n=11, side_n=4, arch_h=4.2, frieze_h=4.6, cornice_h=2.2, metope_accent=True)
    # gable end and the tiled roof
    c.add(c.on(c.m_aface(ea + 1.5), f'<path d="{poly([(-eb - 1.5, zco), (0, zco + RISE - 0.6), (eb + 1.5, zco)])}" fill="#c4c6c3"/>'
               f'<circle cx="0" cy="{f(zco + 2.3)}" r="1.5" fill="#8f3d2a"/>'))
    iso.tile_roof_a(c, SA + 3, bv, zco + RISE + T, tanp, T=T, n=14, courses=3)


def build():
    c = iso.Canvas("marketplace")
    iso.ground(c)
    iso.ground_ao(c, [(-38, -40), (38, -40), (44, 30), (-36, 40)], grow=6, opacity=0.1)
    with c.at(*STOA):
        stoa(c)

    # back row of stalls, then goods around them
    iso.cypress(c, -44, -18, h=40, seed=9)
    iso.amphora(c, -46, -2, k=0.9, shaded=False)
    iso.amphora(c, -42.5, 1.5, k=0.75, shaded=False)
    with c.at(-28, 6):
        lc.stall(c, w=10, d=3.6, z_aw=21, depth=12, drop=5, goods=0, two_tone=True)
    lc.crate(c, 36, -14, 3.4, 5.2)
    lc.sack(c, 41, -6, k=0.9)
    with c.at(10, 10):
        lc.stall(c, w=10, d=3.6, z_aw=21, depth=12, drop=5, goods=1, two_tone=True)
    lc.basket(c, -10, 19, 1.0, "#e8923c", "#f8c98a")
    iso.amphora(c, 36, 8, k=0.95, shaded=False)
    iso.amphora(c, 40.5, 12, k=0.8, shaded=False)
    # front: the third stall, baskets and a loaded hand cart
    with c.at(-14, 33):
        lc.stall(c, w=10, d=3.6, z_aw=21, depth=12, drop=5, goods=2, two_tone=True)
    lc.basket(c, -33, 38, 1.05, "#d9463a", "#f08a6a")
    lc.basket(c, 4, 45, 1.0, "#7a2a4a", "#b0567a")
    lc.hand_cart(c, 22, 30)
    iso.pebbles(c, [(38, 36, 1.0, 1), (-46, 20, 0.9, 2)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
