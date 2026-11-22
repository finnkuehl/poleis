"""spearman - light infantry advancing: an exomis tunic in the owner colour (one shoulder bare),
a conical bronze pilos, a long spear levelled underhand and pointing up ahead, a small round
shield held forward. Accent (owner colour): token enamel, the tunic and the shield field."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import units_lib as U  # noqa: E402


def build():
    c = U.UnitCanvas("spearman")
    U.token(c, seed=7)
    x0, y0 = 63, 101
    U.ground_shadow(c, x0, y0, 18, length=22)
    F = U.Fig(c, x0, y0)
    # legs first (the tunic hem hangs over the thighs)
    lf = U.leg(F, [(5, -29), (8.8, -15.6), (12.4, -3.6)], [5, 3.9, 2.6], far=True)
    U.foot(F, (12.6, -2.8), (5.2, -0.2), far=True)
    ln = U.leg(F, [(-3.6, -28.6), (-9.6, -15.6), (-12.8, -3.4)], [5.3, 4.1, 2.8])
    U.foot(F, (-12.8, -2.6), (-20.6, 1))
    # far arm holding the spear at the hip (bare shoulder: the exomis leaves it free)
    U.bare_shoulder(F, [(2, -56), (10.6, -52.6)], [3.6, 4.6])
    U.limb(F, [(10.6, -52), (16.6, -41), (11, -34.6)], [4.6, 4.2, 3.7, 3.4, 2.8])
    # the exomis (owner colour) with a belt
    U.garment(F, [(-11, -55), (-4.4, -57.6), (1, -55.4), (6.6, -50.6), (11.4, -47), (13.4, -40), (14.6, -32), (16.8, -23.6), (8, -21.8), (-1, -22.6), (-9, -21.8), (-15, -23.6), (-13, -32), (-12.6, -42), (-13, -50)],
              accent=True, folds=["M-6,-38 C-7,-32 -8.6,-27 -10,-23.4", "M2,-37.6 C2,-32 2.4,-27 2.8,-23", "M9,-37.4 C10,-31 11.6,-27 13.4,-23.6", "M-4,-55 C-2,-50 1,-46 4,-43"],
              hem=[(-15, -23.2), (-7, -22.2), (0, -22.4), (8, -22), (16.8, -23.2)], legs=[lf, ln], neck=(-1.6, -56))
    U.belt(F, [(-12.8, -39.4), (0, -38.4), (13.4, -39.6)])
    U.spear(F, tip=(-50, -76), butt=(28, -22.4))
    U.fist(F, 10.6, -34.4, 3.5)
    # near arm to the shield, head in a pilos
    U.arm(F, [(-9, -53.4), (-13, -48), (-15.6, -44)], [4.8, 4.4, 4])
    U.neck(F, -1.6, -58, 4.2)
    U.face(F, -1.6, -68, 10.6, beard="short", hair=True)
    U.pilos(F, -1.6, -68.6, 10.8)
    U.round_shield(F, -19, -44, 9.6, 11.8, rot=-8)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "units")
    print("\n".join(build().write(out)))
