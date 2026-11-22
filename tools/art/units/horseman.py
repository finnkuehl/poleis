"""horseman - a cavalryman on a proud chestnut horse at the trot (near foreleg raised): an
open-faced Chalcidian helmet with a crest, bronze cuirass, a javelin cocked back to throw, the
cloak streaming behind; owner-colour saddle cloth with a cream fringe.
Accent (owner colour): token enamel, the saddle cloth, the cloak and the crest."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import units_lib as U  # noqa: E402
from units_lib import f  # noqa: E402


def build():
    c = U.UnitCanvas("horseman")
    U.token(c, seed=15)
    hx, hy, hk = 66, 99, 1.08
    U.ground_shadow(c, hx + 2, hy, 34, length=14, depth=6)
    for fx, fy in ((-22.6, 0), (25, 0)):
        U.foot_shadow(c, hx + fx * hk, hy + fy, 3.6)
    # cloak first (it streams behind the rider, over the horse's croup)
    sx, sy = hx - 5 * hk, hy - 46.4 * hk
    R = U.Fig(c, sx, sy, 0.8)
    U.cloak_back(R, [(-1, -21), (6, -22), (13, -19), (21, -13), (29, -7.6), (35, -2.6), (30, -1), (33, 4), (25, 2.4), (24.6, 7.6), (17, 3), (9, -3), (3, -9)],
                 folds=["M5,-19 C12,-14 19,-9 26,-4", "M3,-15 C9,-10 14,-5 19,1"])
    h = U.horse(c, hx, hy, hk)
    # the rider (seat at the saddle)
    U.cuirass(R, [(-7.6, -21), (3.6, -22), (7, -18), (7.4, -10), (5.6, -3), (-6.6, -3), (-8.6, -11), (-8.6, -17)])
    U.pteruges(R, -7, 6, -4.4, 3.6, n=5)
    # far arm cocked back with the javelin
    U.limb(R, [(4.6, -18.6), (12.6, -22), (11.4, -31)], [4, 3.6, 3.2, 3, 2.5])
    U.spear(R, tip=(-38, -45), butt=(22, -25), w=1.0, blade=8.0, spike=3.0)
    U.fist(R, 11, -31.4, 3)
    # near thigh and leg along the flank
    U.leg(R, [(-2, -1), (-11, 6), (-8.6, 17)], [5, 3.8, 2.7])
    U.foot(R, (-8.4, 17.6), (-13.4, 22.4))
    # near arm holding the reins
    U.limb(R, [(-6.6, -18), (-12, -11), (-17, -9.6)], [4.2, 3.8, 3.3, 3, 2.6])
    mx, my = h["mouth"]
    R.art(U.stroke(f"M-18,-9.6 Q{f((mx - sx) / R.k * 0.5 - 6)},{f((my - sy) / R.k * 0.5 - 2)} {f((mx - sx) / R.k)},{f((my - sy) / R.k)}", "#2a1408", 1.0))
    U.fist(R, -17.6, -9.6, 2.9)
    U.neck(R, -2, -25.6, 3.6)
    U.face(R, -2, -33.6, 9.4, beard="short", hair=False, ear=False)
    U.chalcidian(R, -2, -34, 9.6)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "units")
    print("\n".join(build().write(out)))
