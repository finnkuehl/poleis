"""archer - drawing a recurved bow at full draw, a quiver with fletched arrows on the back, a soft
pointed leather cap, laced boots, a belted tunic in the owner colour.
Accent (owner colour): token enamel and the tunic."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import units_lib as U  # noqa: E402


def build():
    c = U.UnitCanvas("archer")
    U.token(c, seed=11)
    x0, y0 = 66, 101
    U.ground_shadow(c, x0, y0, 18, length=22)
    F = U.Fig(c, x0, y0)
    # quiver on the back (behind everything)
    U.quiver(F, (6, -36), (15.6, -74), r=3.6)
    # legs in laced boots, braced
    lf = U.leg(F, [(5, -29), (9.6, -16), (12.6, -4.2)], [5, 3.9, 2.7], far=True, boot=True)
    U.foot(F, (12.8, -3.4), (5.4, -0.4), far=True, boot=True)
    ln = U.leg(F, [(-3.8, -28.6), (-8.8, -16), (-11.6, -3.4)], [5.3, 4.1, 2.8], boot=True)
    U.foot(F, (-11.6, -2.6), (-19.4, 0.8), boot=True)
    # draw arm (far): elbow raised high, hand at the jaw
    U.arm(F, [(10, -53), (16.6, -56.6), (22.4, -59)], [4.6, 4.2, 3.6], accent=True)
    U.cuff(F, (22.4, -59), (16.6, -56.6), 3.6)
    U.arm(F, [(22.4, -59), (15, -61.4), (6.6, -62.6)], [3.4, 3.1, 2.7])
    U.fist(F, 4.8, -62.6, 3.2)
    # bow, string drawn to the hand, arrow
    U.bow(F, (-35, -62.4), (-31.4, -92), (-31.4, -33), string_to=(4.6, -62.6))
    U.arrow(F, (4, -62.6), (-45, -62.4))
    # tunic (owner colour) and belt
    U.garment(F, [(-10.6, -55), (-3.6, -57.6), (4, -57), (10.8, -54.6), (13, -47), (13.4, -39), (14.6, -31), (16, -23.6), (7, -22), (-1, -22.8), (-8.6, -22), (-14.4, -23.6), (-12.6, -32), (-12.4, -42), (-12.8, -50)],
              accent=True, folds=["M-6,-37.6 C-7,-32 -8.6,-27 -10,-23.4", "M2,-37.4 C2.4,-32 2.6,-27 3,-23", "M9,-37.6 C10,-31 11.4,-27 13,-23.6", "M-2,-54 C-1,-50 0,-46 1,-42"],
              hem=[(-14.4, -23.2), (-7, -22.2), (0, -22.4), (8, -22), (16, -23.2)], legs=[lf, ln], neck=(-1.6, -56.4))
    U.belt(F, [(-12.6, -39.6), (0, -38.6), (13.4, -39.6)])
    # head in a soft cap
    U.neck(F, -1.6, -58.2, 4.2)
    U.face(F, -1.6, -68.4, 10.6, beard="short", hair=True, ear=False)
    U.scythian_cap(F, -1.6, -68.4, 10.6)
    # bow arm (near), extended to the grip
    U.arm(F, [(-8.6, -54.6), (-14, -56.6), (-18.6, -58)], [4.8, 4.4, 3.9], accent=True)
    U.cuff(F, (-18.6, -58), (-14, -56.6), 3.9)
    U.arm(F, [(-18.6, -58), (-25.6, -60.2), (-32.4, -61.8)], [3.5, 3.3, 2.8])
    U.fist(F, -34.6, -62.4, 3.4)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "units")
    print("\n".join(build().write(out)))
