"""farm - a small whitewashed farmhouse with a tiled roof, rows of golden standing wheat with
a scarecrow, a harvested strip with sheaves, a round haystack and grain sacks by the door.
Accent (owner colour): base rim band, the window shutters and the scarecrow's tunic."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_raw as raw  # noqa: E402
from iso import f  # noqa: E402

HOUSE = (-18, -27)        # farmhouse centre
A, B = 15, 10             # half extents of the walls
F = 4                     # stone footing
H = 26                    # wall height
R = 10                    # roof rise
AV, BV = A + 3, B + 4
TANP = R / B
ZR = H + R + 3.8
FIELD = (-2, 44, -10, 34)     # standing wheat (a0, a1, b0, b1)
STUBBLE = (-44, -10, 8, 38)   # harvested strip


def farmhouse(c):
    ze = ZR - BV * TANP
    iso.cast_shadow(c, [(sa * (A + 1), sb * (B + 1)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * AV, sb * BV, ze) for sa in (-1, 1) for sb in (-1, 1)] + [(sa * AV, 0, ZR + 2) for sa in (-1, 1)])
    iso.contact_ao(c, -A - 1.2, A + 1.2, -B - 1.2, B + 1.2)
    iso.stone_course(c, A + 1.2, B + 1.2, F, seed=5)
    iso.lime_wall_b(c, B, -A, A, F, H, seed=9, mottle=8)
    iso.lime_wall_a(c, A, -B, B, F, H, gable=R)
    iso.window_a(c, A, -4, 4, 14, 21)
    iso.door_b(c, B, 3, 12, F, F + 15)
    iso.window_b(c, B, -10.5, -4, 11, 17)
    iso.eave_shadow_b(c, B, -A, A, H)
    iso.tile_roof_a(c, AV, BV, ZR, TANP, n=9, courses=4)


def build():
    c = iso.Canvas("farm")
    ha, hb = HOUSE
    fa0, fa1, fb0, fb1 = FIELD
    sa0, sa1, sb0, sb1 = STUBBLE

    def covered(a, b):
        return ((ha - A - 3 < a < ha + A + 3 and hb - B - 3 < b < hb + B + 3)
                or (fa0 - 1 < a < fa1 + 1 and fb0 - 1 < b < fb1 + 1) or (sa0 - 1 < a < sa1 + 1 and sb0 - 1 < b < sb1 + 1))
    iso.base(c, seed=47, avoid=covered, tufts=60, flowers=12)
    # dirt track from the door down between the fields
    raw.ground_patch(c, -8, 6, 6, 30, "#c9a873", 0.75, seed=3, blur=1.4)
    raw.ground_patch(c, -10, -12, 10, 6, "#c9a873", 0.75, seed=4, blur=1.4)

    # haystack behind the field, then the house
    raw.haystack(c, 24, -30, r=10, h=22)
    with c.at(*HOUSE):
        farmhouse(c)
    raw.sack(c, ha - A - 1, hb + B + 4, k=0.9)
    raw.sack(c, ha - A + 3.5, hb + B + 5, k=0.8, lean=8)
    raw.sack(c, ha - A - 3.5, hb + B + 7.5, k=0.75, lean=-6)

    # harvested strip with stooks, standing wheat with the scarecrow
    raw.stubble(c, sa0, sa1, sb0, sb1)
    for i, (a, b) in enumerate([(-36, 14), (-22, 16), (-38, 28), (-24, 30), (-30, 21)]):
        raw.sheaf(c, a, b, k=0.9, seed=i)
    iso.cast_shadow(c, [(fa0, fb0), (fa1, fb0), (fa1, fb1), (fa0, fb1)], [(fa1, fb0, 7), (fa1, fb1, 7)], opacity=0.35, sd=1.6)
    iso.contact_ao(c, fa0, fa1, fb0, fb1, width=2.5, opacity=0.35)
    raw.wheat_field(c, fa0, fa1, fb0, fb1)
    x, y = c.P(24, 16, 6.5)
    raw.scarecrow(c, x, y + 1, k=1.05)
    # wheat ears in front of the scarecrow's pole
    c.add(f'<path d="M{f(x - 2)},{f(y + 1.5)}l-0.6,-3M{f(x + 0.4)},{f(y + 2)}l0.2,-3.4M{f(x + 2.2)},{f(y + 1.6)}l0.8,-2.8" stroke="{raw.WHEAT["lit"]}" stroke-width="1.1" stroke-linecap="round"/>')
    iso.cypress(c, -46, -20, h=40, seed=7)
    iso.rocks(c, [(54, -8, 2.2, 81), (50, -2, 1.5, 82)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
