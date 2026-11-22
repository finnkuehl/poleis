"""scout - a light runner in full stride, leaning forward: a wide felt petasos, a short chlamys
flying out behind, a traveller's staff, laced boots, a linen tunic.
Accent (owner colour): token enamel, the flying cloak and the hat band."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import units_lib as U  # noqa: E402


def build():
    c = U.UnitCanvas("scout")
    U.token(c, seed=9)
    x0, y0 = 62, 101
    U.ground_shadow(c, x0 + 4, y0, 20, length=24)
    F = U.Fig(c, x0, y0)
    # the short cloak flying out behind (owner colour)
    U.cloak_back(F, [(-3, -58), (6, -59.6), (16, -58.4), (25, -55.4), (33, -50), (38.4, -44.6), (32, -43.6), (35.6, -38), (28, -37.6), (29.6, -31.6), (21, -34), (12, -39.6), (5, -47)],
                 folds=["M8,-56 C16,-53 24,-47 31,-42", "M6,-52 C12,-47 18,-41 24,-36.6", "M4,-48.6 C9,-44 13,-40 18,-35.6"])
    U.cloak_border(F, [(38.4, -44.6), (32, -43.6), (35.6, -38), (28, -37.6), (29.6, -31.6), (21, -34)])
    # far leg (right) pushing off behind, toes on the ground
    lf = U.leg(F, [(3.4, -30.6), (10.6, -19), (18.6, -10.4)], [5, 3.9, 2.6], far=True, boot=True)
    U.foot(F, (18.8, -9.6), (13.6, -0.4), far=True, boot=True)
    # far arm swinging forward with the staff
    U.limb(F, [(7, -52.6), (-4, -47), (-19.6, -46.6)], [4.4, 4, 3.5, 3.2, 2.7])
    U.staff(F, (-30, -90), (-11, -8))
    U.fist(F, -20.4, -46.6, 3.3)
    # near leg (left) reaching forward
    ln = U.leg(F, [(-5, -30.4), (-14.6, -20.4), (-22.4, -10.6)], [5.4, 4.1, 2.8], boot=True)
    U.foot(F, (-22.8, -9.8), (-30.4, -8.6), boot=True)
    # linen tunic, belt
    U.garment(F, [(-13, -54.6), (-6, -58), (2, -58), (8.8, -55), (10.4, -47), (10.6, -39), (12.4, -31.4), (15, -24.6), (6.6, -23.4), (-1.6, -24.6), (-9.4, -24), (-15.6, -26.4), (-14, -34), (-14.6, -43), (-15, -50)],
              folds=["M-7,-38 C-8.6,-32 -10.6,-28 -12.6,-25.4", "M1,-38 C1.6,-32 2.4,-28 3.6,-24.4", "M7.6,-38 C9,-32 11,-28 13,-25"],
              hem=[(-15.6, -26), (-8, -24.4), (0, -24.4), (7, -23.6), (15, -24.2)], legs=[lf, ln], neck=(-5.6, -56), border="#b5523b")
    U.belt(F, [(-14.4, -40), (-2, -39.2), (10.6, -40)])
    # near arm swinging back, elbow up behind
    U.limb(F, [(-9.6, -53), (0.4, -45.4), (8.4, -50.6)], [4.7, 4.3, 3.8, 3.4, 3])
    U.fist(F, 9.4, -51.6, 3.2)
    # head with the petasos
    U.neck(F, -5.6, -58, 4.1)
    U.face(F, -6.4, -68, 10.4, hair=True)
    U.petasos(F, -6.4, -70, 10.2, tilt=-10, accent_band=True)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "units")
    print("\n".join(build().write(out)))
