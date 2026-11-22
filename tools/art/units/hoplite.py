"""hoplite - heavy infantry, the strongest-looking unit: braced stance in a 3/4 view, the big
round aspis in front with a painted field and a sun blazon, the long spear levelled overhand
over the shield, a crested Corinthian helmet, bronze greaves, a cloak behind the shoulders.
Accent (owner colour): token enamel, the aspis field, the horsehair crest and the cloak."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import units_lib as U  # noqa: E402


def build():
    c = U.UnitCanvas("hoplite")
    U.token(c, seed=5)
    x0, y0 = 62, 100
    U.ground_shadow(c, x0, y0, 19, length=26)
    F = U.Fig(c, x0, y0)

    # cloak hanging behind the far shoulder (owner colour)
    U.cloak_back(F, [(3, -56), (13.5, -55.5), (19, -50), (21.5, -40), (24.5, -29), (27, -21.5), (22, -19.6), (17.6, -22), (13.4, -19.8), (9, -24), (6.5, -40)],
                 folds=["M15,-50 C17,-42 19.5,-32 21.6,-23", "M10.6,-46 C11.6,-38 12.6,-30 13.6,-22.5"])
    # legs with greaves (the chiton and the leather strips hang over the thighs)
    lf = U.leg(F, [(5, -30), (8.5, -16), (10, -4)], [5, 3.9, 2.6], greave=True, far=True)
    F.paint_in(lf, f'<ellipse cx="-4" cy="-34" rx="17" ry="21" fill="{U.SHADE}"/>', 0.3, blur=1.6)   # the shield's shadow
    U.foot(F, (10.4, -3.2), (3.6, -0.4), far=True)
    ln = U.leg(F, [(-4, -30), (-8.4, -15.5), (-11, -3.4)], [5.4, 4.1, 2.8], greave=True)
    U.foot(F, (-10.8, -2.4), (-18.6, 1.2))
    # chiton hem, leather pteruges
    U.chiton_skirt(F, -12, 15.5, -28, -19.4)
    F.paint_in(lf, U.stroke("M2,-17.4 L14,-18", U.SHADE, 5, 0.16) + U.stroke("M2,-18.6 L14,-19.2", U.SHADE, 2.4, 0.3))
    F.paint_in(ln, U.stroke("M-14,-17.4 L-2,-17.8", U.SHADE, 5, 0.16) + U.stroke("M-14,-18.6 L-2,-19", U.SHADE, 2.4, 0.3))
    U.pteruges(F, -11.5, 15, -37, -24.6)
    # far arm raised overhand, gripping the spear above the shoulder
    U.arm(F, [(13, -51), (19, -54.6), (25, -57.4)], [4.9, 4.4, 3.7])
    U.arm(F, [(25, -57.4), (25.2, -64), (23.6, -71)], [3.7, 3.5, 2.8])
    U.spear(F, tip=(-56, -50), butt=(57, -85.5))
    U.fist(F, 23.4, -73.6, 3.7)
    U.cuirass(F, [(-12, -54), (11, -55), (16.6, -51), (17, -44), (14.4, -35.6), (-10.5, -36), (-12.5, -46)])
    U.shoulder_guard(F, [(6, -57.2), (14.4, -57.6), (18.6, -52), (13.6, -48.6)])
    # neck, head in a Corinthian helmet with a tall crest
    U.neck(F, -1.5, -58, 4.2)
    U.corinthian(F, -1, -68.5, 11.3, crest=True)
    # the aspis in front (painted field = owner colour, sun blazon)
    U.aspis(F, -10, -40, 17, 21.4, rot=-6, blazon="sun")
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "units")
    print("\n".join(build().write(out)))
