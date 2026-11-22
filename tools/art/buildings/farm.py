"""farm - a small whitewashed farmstead standing directly on the map (grounded, docs/ART.md): the
farmhouse with a tiled roof, two golden haystacks, a loaded farm cart, grain sacks by the door, a
stone well and a cypress. NO fields: the game draws the wheat fields across the whole tile.
Accent (owner colour): the painted door, the window shutters and the cloth over the cart's load."""
import sys

sys.dont_write_bytecode = True
import math  # noqa: E402
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_processing as lp  # noqa: E402
import lib_raw as raw  # noqa: E402
from iso import WOOD, f  # noqa: E402

# world units; keep everything inside iso.GROUND_R = 58
HOUSE = (-12, -16)        # farmhouse centre
A, B = 17, 11             # half extents of the walls: a small 34 x 22 farmhouse (README "Scale")
F = 4                     # stone footing
H = 27                    # wall height
R = 10.5                  # roof rise
AV, BV = A + 3, B + 4
TANP = R / B
ZR = H + R + 3.8
CART = (16, 22)           # cart bed centre; shafts toward +a


def farmhouse(c):
    ze = ZR - BV * TANP
    iso.cast_shadow(c, [(sa * (A + 1), sb * (B + 1)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * AV, sb * BV, ze) for sa in (-1, 1) for sb in (-1, 1)] + [(sa * AV, 0, ZR + 2) for sa in (-1, 1)])
    iso.contact_ao(c, -A - 1.2, A + 1.2, -B - 1.2, B + 1.2)
    iso.stone_course(c, A + 1.2, B + 1.2, F, seed=5)
    iso.lime_wall_b(c, B, -A, A, F, H, seed=9, mottle=8)
    iso.lime_wall_a(c, A, -B, B, F, H, gable=R)
    iso.window_a(c, A, -4, 4, 13, 20)
    iso.door_b(c, B, 3, 12, F, F + 16, accent=True)
    iso.window_b(c, B, -12, -4, 11, 18)
    iso.eave_shadow_b(c, B, -A, A, H)
    iso.box(c, 1.5, 13.5, B, B + 3, 0, 1.6, "#ebe5d6", "#c9c0ad", "#a49c8c")
    iso.foot_tufts(c, [((-A - 1.2, B + 1.2), (0, B + 1.2)), ((A + 1.2, B + 1.2), (A + 1.2, -B - 1.2))], n=10, seed=4, kind="dry", stones=3)
    iso.tile_roof_a(c, AV, BV, ZR, TANP, n=10, courses=4)


def farm_cart(c, a, b):
    """Two-wheeled farm cart (bed along a), heaped with sacks and sheaves under an owner-colour
    cloth; the shafts rest on the ground toward +a."""
    W = WOOD
    L, D, ZB, WR = 11, 6.2, 6.4, 6.4      # half length, half depth, bed height, wheel radius
    with c.at(a, b, 0):
        iso.cast_shadow(c, [(-L, -D), (L, -D), (L, D), (-L, D)], [(-L, -D, 13), (L, -D, 13), (L, D, 13), (-L, D, 13)], opacity=0.36, sd=1.4)
        iso.blob_shadow(c, 2, 0, 11, 0.3)
        raw.wheel_b(c, -1, -D - 0.8, WR, WR, dark=True)
        raw.timber(c, (L - 2, -D + 1.6, ZB + 0.4), (L + 14, -D + 1.6, 0.6), w=1.5)
        iso.box(c, -L, L, -D, D, ZB - 1.4, ZB, W["lit"], W["base"], W["dark"], edge="#c99a6a")
        # load: grain under an owner-colour cloth, a few ears sticking out at the back
        x, y = c.P(-L + 1.5, 0, ZB + 5)
        c.add(f'<path d="M{f(x)},{f(y)} l-3,-2.6 M{f(x + 1)},{f(y - 0.6)} l-2,-3.4 M{f(x + 2.2)},{f(y - 1)} l-0.6,-3.6" stroke="{raw.WHEAT["lit"]}" stroke-width="1.1" stroke-linecap="round"/>')
        lp.tarp(c, -L + 1.2, L - 1.2, -D + 1, D - 0.8, ZB + 6.5, drop=5)
        # rope over the cloth
        x0, y0 = c.P(-2, -D + 1, ZB + 6.5)
        x1, y1 = c.P(-2, D - 0.8, ZB + 6.5)
        x2, y2 = c.P(-2, D - 0.8, ZB + 1.5)
        c.add(f'<path d="M{f(x0)},{f(y0)} L{f(x1)},{f(y1)} L{f(x2)},{f(y2)}" fill="none" stroke="#e9dcc0" stroke-width="0.9"/>')
        # near side board, shaft and wheel
        iso.box(c, -L, L, D, D + 0.9, ZB - 1.4, ZB + 1.8, W["lit"], W["base"], W["dark"], edge="#d8ab78")
        c.add(c.on(c.m_bface(D + 0.9), "".join(f'<rect x="{f(-L + i * 4.4)}" y="{f(ZB - 1.4)}" width="0.4" height="3.2" fill="{W["deep"]}" opacity="0.6"/>' for i in range(1, 5))))
        raw.timber(c, (L - 2, D - 1.2, ZB + 0.4), (L + 14, D - 1.2, 0.6), w=1.5)
        raw.wheel_b(c, -1, D + 1.6, WR, WR)


def well(c, a, b, r=5.5, h=6.5):
    """Round fieldstone well with a timber frame, a rope and a wooden bucket."""
    W = WOOD
    iso.cast_shadow(c, [(a - r, b - r), (a + r, b - r), (a + r, b + r), (a - r, b + r)], [(a, b - 1, 16), (a, b + 1, 16), (a + r, b, h)], opacity=0.36, sd=1.4)
    iso.contact_ao(c, a - r, a + r * 0.6, b - r, b + r * 0.6, width=2.4, opacity=0.3)
    raw.timber(c, (a - r - 1, b, 0), (a - r - 1, b, 16.5), w=1.7)                 # back post
    with c.at(a, b, 0):
        iso.cylinder(c, r, 0, h, [(0, "#ece3d0"), (0.3, "#d8ccb4"), (0.7, "#ada28e"), (1, "#8a8070")], name="wellside")
        x, y = c.P(0, 0, h)
        rx = r * 2 ** 0.5
        out = [f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rx)}" ry="{f(rx / 2)}" fill="#e6dccb"/>',
               f'<ellipse cx="{f(x + 0.3)}" cy="{f(y + 0.2)}" rx="{f(rx * 0.74)}" ry="{f(rx * 0.37)}" fill="#2a241e"/>',
               f'<path d="M{f(x - rx * 0.74)},{f(y + 0.2)} A{f(rx * 0.74)},{f(rx * 0.37)} 0 0 1 {f(x + rx * 0.74)},{f(y + 0.2)}" fill="none" stroke="#5e5446" stroke-width="1.2" opacity="0.8"/>']
        # stone joints on the visible side
        for i, t in enumerate((0.12, 0.27, 0.42, 0.57, 0.72, 0.87)):
            th = math.pi * t
            px, py = x + rx * math.cos(th), y + rx / 2 * math.sin(th)
            out.append(f'<path d="M{f(px)},{f(py + (0.6 if i % 2 else 3.6))} l0,3.2" stroke="#6e6556" stroke-width="0.45" opacity="0.7"/>')
        out.append(f'<path d="M{f(x - rx)},{f(y + 4)} A{f(rx)},{f(rx / 2)} 0 0 0 {f(x + rx)},{f(y + 4)}" fill="none" stroke="#6e6556" stroke-width="0.45" opacity="0.6"/>')
        c.add("".join(out))
    raw.timber(c, (a - r - 1, b, 16), (a + r + 1, b, 16), w=1.6)                  # cross beam
    x, y = c.P(a + 0.5, b, 16)
    _, yb = c.P(a + 0.5, b, 9)
    c.add(f'<path d="M{f(x)},{f(y)} L{f(x)},{f(yb)}" stroke="#6e5638" stroke-width="0.6"/>'
          f'<path d="M{f(x - 2)},{f(yb)} L{f(x + 2)},{f(yb)} L{f(x + 1.6)},{f(yb + 3.4)} L{f(x - 1.6)},{f(yb + 3.4)}Z" fill="{W["base"]}"/>'
          f'<path d="M{f(x - 2)},{f(yb)} L{f(x - 0.8)},{f(yb)} L{f(x - 0.6)},{f(yb + 3.4)} L{f(x - 1.6)},{f(yb + 3.4)}Z" fill="{W["lit"]}"/>'
          f'<rect x="{f(x - 2)}" y="{f(yb + 1.2)}" width="4" height="0.6" fill="{W["deep"]}"/>')
    raw.timber(c, (a + r + 1, b, 0), (a + r + 1, b, 16.5), w=1.7)                 # front post


def build():
    c = iso.Canvas("farm")
    iso.ground(c)
    ha, hb = HOUSE
    # wide soft AO under the farmstead
    iso.ground_ao(c, [(ha - A - 2, hb - B - 2), (36, -36), (40, 30), (-30, 34), (ha - A - 2, hb + B + 6)], grow=6, opacity=0.13)

    iso.cypress(c, -42, -6, h=42, seed=7)
    # haystacks behind and beside the house
    raw.haystack(c, 22, -30, r=10.5, h=23)
    with c.at(*HOUSE):
        farmhouse(c)
    raw.haystack(c, 36, -8, r=7.5, h=16, seed=5)
    # sacks by the door
    raw.sack(c, ha - A + 2, hb + B + 4.5, k=0.9)
    raw.sack(c, ha - A + 6.5, hb + B + 5.5, k=0.8, lean=8)
    raw.sack(c, ha - A - 1.5, hb + B + 7.5, k=0.75, lean=-6)
    well(c, -30, 18)
    for i, (a, b) in enumerate([(30, 4), (38, 8)]):
        raw.sheaf(c, a, b, k=0.85, seed=i)
    farm_cart(c, *CART)
    iso.pebbles(c, [(-40, 12, 1.4, 81), (44, -20, 1.2, 82), (6, 40, 1.1, 83)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
