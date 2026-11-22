"""house - whitewashed Aegean house with a barrel-tile gable roof.
Accent (owner colour): base rim band + window shutters."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
from iso import f  # noqa: E402

# geometry (world units; the base radius is 68)
A, B = 40, 26          # half length (a) and half depth (b) of the walls
F = 5                  # stone foundation course height
H = 47                 # wall height (eave line)
R = 14                 # roof rise (~28 deg, the back slope shows as a sliver)
T = 3.8                # tile layer thickness
AV, BV = A + 3.5, B + 5  # roof half extents incl. overhangs
TANP = R / B
ZR = H + R + T


def build():
    c = iso.Canvas("house")
    iso.base(c, seed=11, avoid=lambda a, b: -A - 3 < a < A + 3 and -B - 3 < b < B + 3)

    ze = ZR - BV * TANP
    iso.cast_shadow(c, [(sa * (A + 1), sb * (B + 1)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * AV, sb * BV, ze) for sa in (-1, 1) for sb in (-1, 1)] + [(sa * AV, 0, ZR + 2) for sa in (-1, 1)])
    iso.contact_ao(c, -A - 1.2, A + 1.2, -B - 1.2, B + 1.2)
    iso.flagstones(c, [(15.5, 33.5, 8, 6.2, 8), (13.5, 42, 7, 6, -10), (16.5, 50.5, 7.5, 6, 14), (13, 59, 6, 5, 0)])

    iso.stone_course(c, A + 1.2, B + 1.2, F)
    iso.lime_wall_b(c, B, -A, A, F, H)
    iso.lime_wall_a(c, A, -B, B, F, H, gable=R)

    # gable: closed shutters + round vent
    iso.window_a(c, A, -5, 5, 22, 31.5)
    c.add(c.on(c.m_aface(A), f'<circle cx="0" cy="{H + 8}" r="3.1" fill="#9c9a94"/><circle cx="0.2" cy="{H + 7.8}" r="2.2" fill="#2e2a26"/>'))

    # front: door, window with open shutters, eave shadow
    iso.door_b(c, B, 9.5, 21, F, F + 25)
    iso.window_b(c, B, -27, -16.5, 21, 32)
    iso.eave_shadow_b(c, B, -A, A, H)

    # threshold step
    iso.box(c, 7.5, 23, B, B + 3.6, 0, 1.8, "#ebe5d6", "#c9c0ad", "#a49c8c")

    # beam ends poking out of the gable under the rake
    for bb in (0, -14, 14):
        zz = H + R - abs(bb) * TANP - 2.8
        c.add(c.on(c.m_ground(zz + 2.6), f'<rect x="{A}" y="{f(bb - 1.4)}" width="3.2" height="2.8" fill="#9a6a40"/>'))
        c.add(c.on(c.m_bface(bb + 1.4), f'<rect x="{A}" y="{f(zz)}" width="3.2" height="2.6" fill="#6e4628"/>'))
        c.add(c.on(c.m_aface(A + 3.2), f'<rect x="{f(-bb - 1.4)}" y="{f(zz)}" width="2.8" height="2.6" fill="#4a2e19"/>'))

    iso.base_tufts(c, [((-A - 1.2, B + 1.2), (6, B + 1.2)), ((A + 1.2, B + 1.2), (A + 1.2, -B - 1.2))], n=16, seed=8)
    iso.tile_roof_a(c, AV, BV, ZR, TANP, T=T)

    # props
    iso.rocks(c, [(58, -16, 3.2, 41), (53.5, -23.5, 2.2, 42), (62, -8, 1.6, 43)])
    iso.flowerbox_b(c, B, -28.5, -15, 13.5, 17.5)
    iso.amphora(c, A + 5.2, 9)
    iso.pot(c, 29, B + 5.5)
    iso.olive_tree(c, -34, 40, size=1.1)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
