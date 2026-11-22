"""transport - a broad, round-bellied merchant ship in a 3/4 view under a big square sail in the
owner colour (braced, billowing), amphorae, bales and sacks on deck, a swan-neck stern post,
a steering oar and a helmsman. Water token with a bronze rim.
Accent (owner colour): token enamel and the sail."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import units_lib as U  # noqa: E402
from units_lib import f  # noqa: E402


HULL = [(0, "#e0ae72"), (0.3, "#c08a52"), (0.65, "#946238"), (1, "#5e3c20")]


def build():
    c = U.UnitCanvas("transport")
    U.token(c, top="water", seed=17)
    S = U.Ship(c, L=29, W=12.4, hd=10.6, sheer_bow=5.0, sheer_stern=8.0, phi=-22, ox=-1, oy=3, fullness=2.0, bulwark=3.0, flare=0.8)
    S.water()
    S.far_side()
    S.deck()
    zd = lambda s: S.zg(s) - S.bw
    # cargo on deck, back to front
    for s, t, k in ((-17, -4, 0.55), (-13.6, -5.4, 0.58), (-15.6, -1, 0.6), (-12, -2, 0.6), (-16, 3, 0.58), (-12.4, 2.4, 0.6)):
        U.amphora_at(c, *S.P(s, t, zd(s)), k=k)
    for s, t in ((3.6, -4), (7.4, -3), (4.6, 1.6)):
        U.bale_at(c, *S.P(s, t, zd(s)), w=7.4, h=4.6)
    for s, t, k in ((13, -3, 0.56), (16.4, -1.6, 0.56), (13.6, 2, 0.6)):
        U.amphora_at(c, *S.P(s, t, zd(s)), k=k)
    # mast, sail, rigging
    top = S.mast(-1.5, 64)
    sl = S.sail(-1.5, 57, 21, 15.5, beta=50, billow=5.2)
    S.rope(top, S.P(-S.L + 1, 0, S.zg(-S.L) + 1), sag=1.5)
    S.rope(top, S.P(S.L - 2, 0, S.zg(S.L) + 3), sag=1.5)
    S.rope(sl["fl"], S.P(-9, 9, zd(-9) + 2), sag=0.6, op=0.6)
    S.rope(sl["fr"], S.P(12, -9, zd(12) + 2), sag=0.6, op=0.6)
    c.add(f'<path d="M{f(top[0])},{f(top[1] - 1)} l8,1.4 l-8,2Z" fill="#f3ead6"/>')
    # helmsman at the stern
    U.ship_sailor(c, *S.P(21, 2, zd(21)), h=15)
    # near side of the hull
    S.near_side(HULL, strakes=3)
    # painted cream band under the rail, stern post (swan neck), bow post, steering oar
    band = [S.P(s, S.beam(s) + 0.1, S.zg(s) - 1.6) for s in S.stations(24, -S.L * 0.9, S.L * 0.9)]
    c.add(U.stroke(S.line(band), "#f3e6c4", 1.2, 0.9) + U.stroke(S.line([(x, y + 1) for x, y in band]), "#4a2c16", 0.5, 0.5))
    sx, sy = S.P(S.L, 0, S.zg(S.L))
    c.add(U.stroke(f"M{f(sx - 1)},{f(sy + 1)} C{f(sx + 5)},{f(sy - 4)} {f(sx + 4)},{f(sy - 14)} {f(sx - 1)},{f(sy - 16)} C{f(sx - 4)},{f(sy - 16.6)} {f(sx - 5.4)},{f(sy - 13.6)} {f(sx - 3.6)},{f(sy - 12)}", "#5e3b22", 2.4)
          + U.stroke(f"M{f(sx - 0.6)},{f(sy)} C{f(sx + 4.2)},{f(sy - 4)} {f(sx + 3.2)},{f(sy - 13.4)} {f(sx - 1)},{f(sy - 15)}", "#c99a66", 0.8, 0.8)
          + f'<circle cx="{f(sx - 4.6)}" cy="{f(sy - 12.6)}" r="1.6" fill="#5e3b22"/><circle cx="{f(sx - 5.2)}" cy="{f(sy - 13.2)}" r="0.4" fill="#f6ecd4"/>')
    bx, by = S.P(-S.L, 0, S.zg(-S.L))
    c.add(U.stroke(f"M{f(bx + 1)},{f(by + 1)} C{f(bx - 2)},{f(by - 2)} {f(bx - 2.6)},{f(by - 5)} {f(bx - 1.4)},{f(by - 7)}", "#5e3b22", 2.0))
    o0 = S.P(S.L * 0.72, S.beam(S.L * 0.72) + 0.4, S.zg(S.L * 0.72) + 2.4)
    o1 = S.P(S.L * 0.86, S.beam(S.L * 0.72) + 4.6, -1.6)
    c.add(U.stroke(f"M{f(o0[0])},{f(o0[1])} L{f(o1[0])},{f(o1[1])}", "#4a2c16", 1.6)
          + f'<ellipse cx="{f(o1[0])}" cy="{f(o1[1])}" rx="1.8" ry="3.4" transform="rotate(-20 {f(o1[0])} {f(o1[1])})" fill="#7a5430"/>')
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "units")
    print("\n".join(build().write(out)))
