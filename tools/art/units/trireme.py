"""trireme - a sleek, low warship in a 3/4 view: three banks of oars dipping into the sea, a
bronze ram at the waterline, a painted eye at the bow, the curling stern (aplustre), a square
sail with a painted eye and a pennant in the owner colour, an owner-colour stripe along the
outrigger. Water token with a bronze rim.
Accent (owner colour): token enamel, the sail, the outrigger stripe and the pennant."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import units_lib as U  # noqa: E402
from units_lib import f  # noqa: E402


HULL = [(0, "#6a6460"), (0.35, "#46413c"), (0.75, "#2c2926"), (1, "#1c1a18")]


def build():
    c = U.UnitCanvas("trireme")
    U.token(c, top="water", seed=19)
    S = U.Ship(c, L=38, W=6.2, hd=7.2, sheer_bow=1.6, sheer_stern=12.0, phi=-19, ox=2, oy=3, fullness=3.4, bulwark=1.8, flare=0.9)
    S.water()
    # far bulwark, deck
    S.far_side(inner="#8a6a48")
    S.deck(col="#7a5634", planks=2)
    zd = lambda s: S.zg(s) - S.bw
    # mast and sail with a painted eye
    top = S.mast(-4, 50)
    sl = S.sail(-4, 45, 17, 12.5, beta=52, billow=3.8)
    S.rope(top, S.P(-S.L + 2, 0, S.zg(-S.L) + 1), sag=1.2)
    S.rope(top, S.P(S.L - 4, 0, S.zg(S.L - 4)), sag=1.2)
    # helmsman at the stern
    U.ship_sailor(c, *S.P(30, 0.6, zd(30)), h=13)
    # near side: dark hull, owner stripe on the outrigger, three banks of oars
    gun, wl = S.near_side(HULL, strakes=2)
    st = [S.P(s, S.beam(s) + 1.2, S.zg(s) - 0.4) for s in S.stations(22, -30, 28)] + [S.P(s, S.beam(s) + 1.2, S.zg(s) - 2.8) for s in reversed(S.stations(22, -30, 28))]
    sg = c.lin("stripe", st[0][0], 0, st[22][0], 0, [(0, U.ACCENT["lit"]), (0.6, U.ACCENT["lit"]), (1, U.ACCENT["light"])])
    c.accent(f'<path d="{U.poly(st)}" fill="{sg}"/>')
    c.add(U.stroke(S.line(st[:23]), "#f6e0b0", 0.6, 0.8) + U.stroke(S.line(st[23:]), "#1a1410", 0.6, 0.6)
          + "".join(f'<circle cx="{f(x)}" cy="{f(y)}" r="0.45" fill="#f3e6c4"/>' for x, y in [S.P(s, S.beam(s) + 1.3, S.zg(s) - 1.6) for s in S.stations(14, -30, 28)]))
    band = [S.P(s, S.beam(s) + 0.15, S.zg(s) - 3.4) for s in S.stations(24, -33, 31)]
    c.add(U.stroke(S.line(band), "#c9a274", 0.9, 0.8) + "".join(U.stroke(S.line([S.P(s, S.beam(s) + 0.15, S.zg(s) - 2.8), S.P(s + 1.2, S.beam(s + 1.2) + 0.15, S.zg(s + 1.2) - 4)]), "#c9a274", 0.5, 0.6) for s in S.stations(26, -32, 30)))
    S.oar_bank(-5.4, 12, -25, 23, 9, rake=3.8, w=0.75, col="#6a4a2c", splash=False)
    S.oar_bank(-3.6, 12, -26, 24.4, 11, rake=4.4, w=0.8, col="#7a5432", splash=False)
    S.oar_bank(-1.4, 12, -27, 23.6, 13, rake=5, w=0.85)
    # bronze ram, proembolion, painted eye
    r = [S.P(-S.L + 1, 0.8, 2.6), S.P(-S.L - 7.6, 0.4, 1.4), S.P(-S.L - 8, 0, 0.6), S.P(-S.L - 7.4, -0.4, -0.2), S.P(-S.L + 1, 0.4, -0.4)]
    rg = c.lin("ram", r[1][0], r[0][1], r[0][0], r[4][1], [(0, "#fff0c4"), (0.4, "#d9a35a"), (1, "#7a5226")])
    c.add(f'<path d="{U.poly(r)}" fill="{rg}"/>' + U.stroke(S.line([S.P(-S.L - 6, 0.5, 1.4), S.P(-S.L + 0.6, 0.9, 1.6)]), "#5a3a1b", 0.4, 0.8)
          + U.stroke(S.line([S.P(-S.L + 1, 0.6, 5), S.P(-S.L - 3, 0.4, 5.4)]), "#b07c40", 1.2))
    ex, ey = S.P(-S.L * 0.83, S.beam(-S.L * 0.83) + 0.3, 3.6)
    c.add(f'<ellipse cx="{f(ex)}" cy="{f(ey)}" rx="2.6" ry="1.4" fill="#f6f0e0"/><circle cx="{f(ex - 0.5)}" cy="{f(ey)}" r="1" fill="#1a1512"/><circle cx="{f(ex - 0.8)}" cy="{f(ey - 0.4)}" r="0.35" fill="#fff"/>')
    # stern: the aplustre fan curling forward, gilded tips; steering oar
    sx, sy = S.P(S.L, 0, S.zg(S.L))
    fan = "".join(U.stroke(f"M{f(sx - 2)},{f(sy + 1)} C{f(sx + 3 + i)},{f(sy - 4 - i)} {f(sx + 3 + i)},{f(sy - 11 - i * 2)} {f(sx - 1.6 + i * 0.6)},{f(sy - 13 - i * 2.4)}", "#2f2c29", 1.5) for i in range(3))
    c.add(fan + "".join(f'<circle cx="{f(sx - 1.6 + i * 0.6)}" cy="{f(sy - 13 - i * 2.4)}" r="1" fill="#f0c878"/>' for i in range(3)))
    o0 = S.P(S.L * 0.78, S.beam(S.L * 0.78) + 0.6, S.zg(S.L * 0.78) + 1)
    o1 = S.P(S.L * 0.9, S.beam(S.L * 0.78) + 5, -1.2)
    c.add(U.stroke(f"M{f(o0[0])},{f(o0[1])} L{f(o1[0])},{f(o1[1])}", "#3a2818", 1.4)
          + f'<ellipse cx="{f(o1[0])}" cy="{f(o1[1])}" rx="1.6" ry="3" transform="rotate(-20 {f(o1[0])} {f(o1[1])})" fill="#5e4028"/>')
    # owner pennant on a staff at the stern
    p0 = S.P(S.L - 8, 0, S.zg(S.L - 8))
    p1 = (p0[0], p0[1] - 22)
    c.add(U.stroke(f"M{f(p0[0])},{f(p0[1])} L{f(p1[0])},{f(p1[1])}", "#2f2c29", 1.0) + f'<circle cx="{f(p1[0])}" cy="{f(p1[1] - 0.8)}" r="1" fill="#f0c878"/>')
    x, y = p1
    pen = f"M{f(x)},{f(y + 0.6)} C{f(x + 5)},{f(y - 1)} {f(x + 9)},{f(y + 2)} {f(x + 14)},{f(y + 0.4)} L{f(x + 10.6)},{f(y + 3.4)} L{f(x + 13.4)},{f(y + 6)} C{f(x + 8)},{f(y + 6.4)} {f(x + 4.4)},{f(y + 4.4)} {f(x)},{f(y + 6.6)}Z"
    c.accent(f'<path d="{pen}" fill="{c.lin("pen", 0, 0, 1, 0, [(0, U.ACCENT["lit"]), (0.6, U.ACCENT["light"]), (1, U.ACCENT["mid"])], bbox=True)}"/>')
    c.add(U.stroke(f"M{f(x + 3)},{f(y + 2.2)} C{f(x + 7)},{f(y + 1.6)} {f(x + 9)},{f(y + 3.6)} {f(x + 12)},{f(y + 2.6)}", "#000", 0.6, 0.2))
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "units")
    print("\n".join(build().write(out)))
