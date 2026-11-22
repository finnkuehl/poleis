"""settler - a bearded colonist leading his laden pack donkey: two big sacks, amphorae, a rolled
bedroll and a hoe on a wooden pack frame over an owner-colour blanket; he walks ahead with a
staff, the lead rope in his hand. Accent (owner colour): token enamel, his tunic and the
donkey's blanket."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import units_lib as U  # noqa: E402
from units_lib import f  # noqa: E402


def build():
    c = U.UnitCanvas("settler")
    U.token(c, seed=13)
    # the donkey behind, to the right
    dx, dy = 85, 95
    U.ground_shadow(c, dx + 2, dy, 22, length=18, depth=5)
    d = U.donkey(c, dx, dy, k=1.02)
    U.pack_load(d["F"])
    # the settler in front, leading
    x0, y0 = 38, 103
    U.ground_shadow(c, x0, y0, 14, length=18)
    F = U.Fig(c, x0, y0)
    lf = U.leg(F, [(4.6, -27), (8, -14.6), (11.4, -3.6)], [4.8, 3.8, 2.6], far=True)
    U.foot(F, (11.6, -2.8), (4.4, -0.2), far=True)
    ln = U.leg(F, [(-3.6, -26.6), (-8.6, -14.6), (-11.6, -3.4)], [5.1, 4, 2.7])
    U.foot(F, (-11.6, -2.6), (-19.2, 1))
    # far arm reaching back with the lead rope
    U.limb(F, [(9.6, -50), (14.6, -41), (13.6, -33.4)], [4.4, 4, 3.6, 3.3, 2.8])
    hx, hy = F.P(13.2, -32)
    F.art(U.stroke(f"M13.2,-32 Q{f((hx + d['halter'][0]) / 2 - x0)},{f((hy + d['halter'][1]) / 2 - y0 + 6)} {f(d['halter'][0] - x0)},{f(d['halter'][1] - y0)}", "#8a6a46", 0.9))
    U.fist(F, 13.2, -32.4, 3.2)
    U.garment(F, [(-11, -53), (-4, -56.4), (4, -56), (10.6, -52.6), (12.4, -45), (12.8, -37), (13.6, -28), (15.2, -19.6), (6.6, -18.2), (-1.4, -19.2), (-9, -18.2), (-14, -19.8), (-12.6, -30), (-12.6, -42), (-12.8, -48)],
              accent=True, folds=["M-6,-36 C-7,-30 -8.6,-24 -10,-19.6", "M2,-36 C2.4,-30 2.6,-24 3,-19", "M8.6,-36 C9.6,-30 11.4,-24 13,-19.6", "M-2,-53 C-1,-48 0,-44 1,-40"],
              hem=[(-14, -19.6), (-7, -18.4), (0, -18.6), (7.6, -18.2), (15.2, -19.4)], legs=[lf, ln], neck=(-1.6, -54.4))
    U.belt(F, [(-12.6, -37.6), (0, -36.6), (12.8, -37.6)], col="#8a6a46")
    # near arm forward with the staff
    U.staff(F, (-21, -76), (-19, 1.4))
    U.limb(F, [(-9.4, -51), (-14.6, -44), (-19.4, -45)], [4.6, 4.2, 3.7, 3.3, 2.8])
    U.fist(F, -20.2, -45.6, 3.3)
    U.neck(F, -1.6, -56, 4.2)
    U.face(F, -1.6, -66.4, 10.6, beard="full", hair=True)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "units")
    print("\n".join(build().write(out)))
