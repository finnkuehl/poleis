"""marketplace - a paved market square: a long stoa (colonnade with shops) under a tiled roof
at the back, three stalls heaped with produce under big striped awnings, a marble fountain,
baskets and amphorae.
Accent (owner colour): base rim band and the striped awnings (the owner-colour showcase),
plus the door curtains of the stoa shops."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_civic as lc  # noqa: E402
from iso import f, poly  # noqa: E402
from lib_civic import rect  # noqa: E402

PAVE_R = 58
STOA = (-5, -33)
SA, SB = 44, 9.5        # half extents of the stoa floor (top step)
STEP_W, STEP_H = 2.4, 2.2
N_COL = 7
Z_COL = 20              # shaft height
RISE, T = 6.2, 3.6      # roof


def stoa(c):
    zst = 2 * STEP_H
    zsh = zst + Z_COL
    zab = zsh + 3.5
    sa0, sb0 = SA + STEP_W, SB + STEP_W
    bv = SB + 4.2
    tanp = RISE / bv
    iso.cast_shadow(c, [(sa * sa0, sb * sb0) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * (SA + 2), sb * bv, zab + 12) for sa in (-1, 1) for sb in (-1, 1)] + [(sa * (SA + 2), 0, zab + 20) for sa in (-1, 1)], opacity=0.42)
    iso.contact_ao(c, -sa0, sa0, -sb0, sb0, opacity=0.4)
    iso.marble_steps(c, SA, SB, 2, STEP_W, STEP_H, joint=9)
    # shaded floor of the walk
    c.add(c.on(c.m_ground(zst), rect(-SA + 1, -SB + 3, 2 * SA - 2, 2 * SB - 5.5, "#a9a497")))
    # back wall with three shop doors (curtains = ACCENT), in the shade of the roof
    bw = -SB + 3
    iso.lime_wall_b(c, bw, -SA + 1, SA - 1, zst, zab, mottle=6)
    g, cur, hems = [rect(-SA + 1, zst, 2 * SA - 2, zab - zst, "#4a4336", 0.4)], [], []
    fold = c.lin("curt", 0, 0, 1, 0, [(0, iso.ACCENT["mid"]), (0.3, iso.ACCENT["shade"]), (0.55, iso.ACCENT["mid"]), (0.8, iso.ACCENT["dark"]), (1, iso.ACCENT["shade"])], bbox=True)
    for x in (-32.5, -19.5, -6.5, 6.5, 19.5, 32.5):
        g.append(rect(x - 4.4, zst, 8.8, 15.6, "#8f8776") + rect(x - 3.4, zst, 6.8, 14.4, "#1c1611"))
        cur.append(f'<path d="M{f(x - 3.4)},{f(zst + 14.4)} L{f(x + 3.4)},{f(zst + 14.4)} L{f(x + 3.4)},{f(zst + 9.5)} Q{f(x)},{f(zst + 7.6)} {f(x - 3.4)},{f(zst + 4)}Z" fill="{fold}"/>')
    c.add(c.on(c.m_bface(bw), "".join(g)))
    c.accent(c.on(c.m_bface(bw), "".join(cur)))
    c.add(c.on(c.m_aface(SA - 1), rect(SB - 3 - 3, zst, 3, zab - zst, "#a9a8a2")))
    cols = [-SA + 4.5 + i * (2 * SA - 9) / (N_COL - 1) for i in range(N_COL)]
    cb = SB - 3.6
    for a in cols:
        iso.column_shadow(c, a, cb, zst, 2.6, length=7)
    for a in cols:
        iso.doric_column(c, a, cb, zst, zsh, 2.6, 2.2, cap=3.4)
    ea, eb = SA - 0.5, SB - 0.2
    zco = iso.entablature(c, ea, eb, zab, front_n=13, side_n=4, arch_h=4.2, frieze_h=4.6, cornice_h=2.2)
    # gable end and the tiled roof
    c.add(c.on(c.m_aface(ea + 1.5), f'<path d="{poly([(-eb - 1.5, zco), (0, zco + RISE - 0.6), (eb + 1.5, zco)])}" fill="#c4c6c3"/>'
               f'<circle cx="0" cy="{f(zco + 2.3)}" r="1.5" fill="#8f3d2a"/>'))
    iso.tile_roof_a(c, SA + 3, bv, zco + RISE + T, tanp, T=T, n=14, courses=3)


def build():
    c = iso.Canvas("marketplace")
    iso.base(c, seed=83, avoid=lambda a, b: a * a + b * b < (PAVE_R + 1) ** 2, tufts=40, flowers=8)
    iso.paving(c, PAVE_R, seed=29, slab=8.2)
    cx, cy = c.P(0, 0, 0)
    rxp = PAVE_R * 2 ** 0.5
    c.add(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rxp)}" ry="{f(rxp / 2)}" fill="none" stroke="#c9b27a" stroke-width="1.4"/>'
          f'<path d="M{f(cx - rxp)},{f(cy + 0.9)} A{f(rxp)},{f(rxp / 2)} 0 0 0 {f(cx + rxp)},{f(cy + 0.9)}" fill="none" stroke="#fff6dc" stroke-width="0.8" opacity="0.8"/>')
    with c.at(*STOA):
        stoa(c)

    # back row of stalls
    iso.amphora(c, -44, -6, k=0.9, shaded=False)
    with c.at(-26, 3):
        lc.stall(c, w=12, goods=0)
    lc.basket(c, -41, 12, 1.05, "#e8923c", "#f8c98a")
    with c.at(24, -1):
        lc.stall(c, w=12, goods=1)
    lc.basket(c, 8, 9, 1.0, "#6f8f3a", "#a9c56e")
    iso.amphora(c, 42, 6, k=0.95, shaded=False)
    iso.amphora(c, 46.5, 10, k=0.8, shaded=False)
    # front: a third stall and the fountain
    with c.at(-12, 36):
        lc.stall(c, w=12, goods=2)
    lc.basket(c, -30, 42, 1.1, "#d9463a", "#f08a6a")
    lc.basket(c, 6, 47, 1.0, "#7a2a4a", "#b0567a")
    with c.at(30, 31):
        lc.fountain(c, r=9.5)
    lc.sack(c, 12, 22, k=0.9)
    lc.crate(c, 47, -12, 3.6, 5.5)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
