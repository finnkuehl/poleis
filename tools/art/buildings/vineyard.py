"""vineyard - the vintner's press hut among the vines, standing directly on the map (grounded,
docs/ART.md; the game draws the vine rows over the whole tile): a small fieldstone hut under a
barrel-tile roof, a vine pergola heavy with grapes in front of it, the day's harvest on a cloth
and in wicker baskets, two big jars and a cypress.
Accent (owner colour): the painted door, the gable shutters and the harvest cloth."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import random  # noqa: E402

import iso  # noqa: E402
import lib_agri as ag  # noqa: E402
from iso import WOOD, f  # noqa: E402

# world units; keep everything compact (the vine rows of the tile show around it).
# Human scale: door 16 x 9, window ~8 x 7, person ~14, one storey ~20.
HUT = (-2, -16)        # hut centre
A, B = 16, 10          # half extents (32 x 20)
F = 3                  # footing
H = 21                 # wall height
R = 8                  # roof rise
T = 3.4
AV, BV = A + 3, B + 3.5
TANP = R / B
ZR = H + R + T
PERG = (-17, -4, -5.6, 8, 17)   # pergola a0, a1, b0, b1 (world, its back rests on the hut), leaf roof height


def hut(c):
    ze = ZR - BV * TANP
    iso.cast_shadow(c, [(sa * (A + 1), sb * (B + 1)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * AV, sb * BV, ze) for sa in (-1, 1) for sb in (-1, 1)] + [(sa * AV, 0, ZR + 2) for sa in (-1, 1)])
    iso.contact_ao(c, -A - 1, A + 1, -B - 1, B + 1)
    iso.box(c, -A - 1, A + 1, -B - 1, B + 1, 0, F, ag.FIELD["top"], ag.FIELD["mid"], ag.FIELD["shade"])
    # dry fieldstone walls, sunlit front and shaded gable
    ag.dry_wall(c, c.m_bface(B), -A, A, F, H, light=0.9, seed=4, rows=5)
    ag.dry_wall(c, c.m_aface(A), -B, B, F, H + R, light=0.35, seed=5, rows=7,
                shape=[(-B, F), (B, F), (B, H), (0, H + R), (-B, H)])
    iso.door_b(c, B, 2, 11, F, F + 16, accent=True)
    iso.window_a(c, A, -3.5, 3.5, 11, 18)
    iso.eave_shadow_b(c, B, -A, A, H, depth=5)
    iso.tile_roof_a(c, AV, BV, ZR, TANP, T=T, n=8, courses=3)


def harvest(c):
    """In front: a cloth with cut bunches, wicker baskets full of grapes, two jars."""
    gr = c.rad("grape", 0.35, 0.25, 0.8, [(0, ag.GRAPE["lit"]), (0.55, ag.GRAPE["base"]), (1, ag.GRAPE["dark"])], bbox=True)
    corners = [(8, 6), (25, 4), (27, 18), (10, 20)]
    ag.ground_cloth(c, corners, seed=7)
    rnd = random.Random(3)
    out = []
    for a, b in [(12, 9), (17, 8.5), (21.5, 9.5), (14, 14.5), (19.5, 15), (23.5, 13)]:
        x, y = c.P(a + rnd.uniform(-1, 1), b + rnd.uniform(-1, 1), 0.3)
        out.append(f'<g transform="rotate({f(rnd.uniform(-70, -40))} {f(x)} {f(y)})">' + ag.grape_small(x, y, 1.1, gr) + "</g>"
                   f'<path d="M{f(x - 1)},{f(y - 0.6)} q1.4,-1.8 3.4,-1.2 q-0.6,1.6 -3.4,1.2Z" fill="{ag.VINE["lit"]}"/>')
    c.add("".join(out))
    ag.basket(c, 32, 12, k=1.05, contents="grapes", seed=21)
    ag.basket(c, 4, 26, k=1.0, contents="grapes", seed=22)


def under_pergola(c):
    """A plank bench with baskets under the pergola."""
    W = WOOD
    a0, a1 = -15, -6
    b = -3.2
    for a in (a0 + 1, a1 - 3):
        iso.box(c, a, a + 2, b - 1.6, b + 1.6, 0, 5, "#d8cdb6", "#c7bba3", "#998f7f")
    iso.box(c, a0, a1, b - 2, b + 2, 5, 6.2, W["lit"], W["base"], W["dark"], edge="#c99a6a")
    ag.basket(c, -12, b, k=0.8, contents="grapes", seed=31, z=6.2)
    ag.basket(c, -7.6, b + 0.4, k=0.75, contents="grapes", seed=32, z=6.2)
    ag.basket(c, -9, 4.5, k=0.95, contents="grapes", seed=33)


def build():
    c = iso.Canvas("vineyard")
    iso.ground(c)
    ha, hb = HUT
    a0, a1, b0, b1, zp = PERG
    iso.ground_ao(c, [(ha - A - 2, hb - B - 2), (ha + A + 2, hb - B - 2), (28, 20), (a0 - 2, b1 + 2)], grow=6, opacity=0.12)
    iso.cypress(c, -30, -30, h=44, seed=5)
    with c.at(*HUT):
        hut(c)
        iso.foot_tufts(c, [((0, B + 1), (A + 1, B + 1)), ((A + 1, B + 1), (A + 1, -B - 1))], n=7, seed=9, kind="dry", stones=2)
    # jars against the hut's shaded gable
    iso.amphora(c, ha + A + 5, hb - 4, k=0.95)
    iso.amphora(c, ha + A + 4.5, hb + 2.5, k=0.8)
    harvest(c)
    ag.pergola(c, a0, a1, b0, b1, zp, seed=4, under=under_pergola, back_posts=False)
    iso.pebbles(c, [(30, 0, 1.1, 1), (-22, 14, 1.0, 2)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
