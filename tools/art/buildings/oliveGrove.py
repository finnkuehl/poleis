"""oliveGrove - an olive grove standing directly on the map (grounded, docs/ART.md; the game draws
rows of dry grass over the whole tile, but no trees): five old, gnarled olive trees in loose rows
over the tile, the harvest under way at the front tree (a ladder in its crown, nets spread under
it and under its neighbour, baskets full of olives, a beating pole) and a small whitewashed tool
shed with jars at the back.
Accent (owner colour): the harvest nets and the painted shed door."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import math  # noqa: E402
import random  # noqa: E402

import iso  # noqa: E402
import lib_agri as ag  # noqa: E402
from iso import WOOD, f  # noqa: E402

# world units; trees spread over the tile in loose rows (screen rows), the shed at the back right.
# Human scale: door 16 x 9, person ~14; an old olive tree ~30 high.
def _w(x, y):
    """Screen offset (x right, y down, before the canvas scale) -> ground point (a, b)."""
    return (y + x / 2, y - x / 2)


# Trees in three loose screen rows; nothing stands in front of the shed's door.
TREES = [            # (a, b, size, seed)
    (*_w(-40, -26), 0.95, 5),     # back row, left and right of the shed
    (*_w(64, -24), 0.95, 2),
    (*_w(-64, 4), 1.05, 7),       # middle row, staggered
    (*_w(40, 4), 1.05, 1),
    (*_w(-12, 32), 1.12, 3),      # front: being harvested
]
HARVEST = 4                    # index of the tree with the ladder
SHED = _w(12, -28)             # tool shed centre (back middle)
A, B = 16, 9                   # shed half extents (32 x 18)
F, H, R, T = 3, 19, 7, 3.4
AV, BV = A + 2.6, B + 3.2
TANP = R / B
ZR = H + R + T


def shed(c):
    ze = ZR - BV * TANP
    iso.cast_shadow(c, [(sa * (A + 1), sb * (B + 1)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * AV, sb * BV, ze) for sa in (-1, 1) for sb in (-1, 1)] + [(sa * AV, 0, ZR + 2) for sa in (-1, 1)])
    iso.contact_ao(c, -A - 1, A + 1, -B - 1, B + 1)
    iso.box(c, -A - 1, A + 1, -B - 1, B + 1, 0, F, ag.FIELD["top"], ag.FIELD["mid"], ag.FIELD["shade"])
    iso.lime_wall_b(c, B, -A, A, F, H, seed=3, mottle=6)
    iso.lime_wall_a(c, A, -B, B, F, H, gable=R)
    iso.door_b(c, B, -4.5, 4.5, F, F + 16, accent=True)
    c.add(c.on(c.m_aface(A), f'<circle cx="0" cy="{f(H + 2.6)}" r="2" fill="#9c9a94"/><circle cx="0.15" cy="{f(H + 2.45)}" r="1.4" fill="#2e2a26"/>'))
    iso.eave_shadow_b(c, B, -A, A, H, depth=5)
    iso.tile_roof_a(c, AV, BV, ZR, TANP, T=T, n=8, courses=3)
    iso.foot_tufts(c, [((-A - 1, B + 1), (-6, B + 1)), ((6, B + 1), (A + 1, B + 1)), ((A + 1, B + 1), (A + 1, -B - 1))], n=7, seed=11, kind="dry", stones=2)


def nets(c, ta, tb, r, seed, rot=0.0):
    """A harvest net (owner colour) spread under a tree, with fallen olives on it."""
    rnd = random.Random(seed)
    corners = []
    for k in range(4):
        th = math.radians(rot + 45 + 90 * k)
        rr = r * rnd.uniform(0.9, 1.08)
        corners.append((ta + rr * math.cos(th), tb + rr * math.sin(th)))
    ag.ground_cloth(c, corners, seed=seed)
    ol = []
    for _ in range(16):
        u, v = rnd.random(), rnd.random()
        p0 = [corners[0][i] + (corners[1][i] - corners[0][i]) * u for i in (0, 1)]
        p1 = [corners[3][i] + (corners[2][i] - corners[3][i]) * u for i in (0, 1)]
        a, b = p0[0] + (p1[0] - p0[0]) * (0.1 + 0.8 * v), p0[1] + (p1[1] - p0[1]) * (0.1 + 0.8 * v)
        if math.hypot(a - ta, b - tb) < 4:
            continue
        x, y = c.P(a, b, 0.3)
        col = rnd.choice(["#3b3a24", "#4a3a4c", "#2f2a33", "#6f7d34", "#56623a"])
        ol.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="0.95" ry="0.7" fill="{col}"/><circle cx="{f(x - 0.3)}" cy="{f(y - 0.25)}" r="0.25" fill="#fff" opacity="0.45"/>')
    c.add("".join(ol))


def beating_pole(c, a, b):
    """A long cane for beating the olives off the branches, lying on the net."""
    p, q = c.P(a - 9, b + 5, 0.5), c.P(a + 9, b - 4, 0.5)
    c.add(f'<path d="M{f(p[0] + 0.8)},{f(p[1] + 0.6)} L{f(q[0] + 0.8)},{f(q[1] + 0.6)}" stroke="{iso.INK}" stroke-width="1.2" opacity="0.25"/>'
          f'<path d="M{f(p[0])},{f(p[1])} L{f(q[0])},{f(q[1])}" stroke="{WOOD["lit"]}" stroke-width="0.9" stroke-linecap="round"/>')


def build():
    c = iso.Canvas("oliveGrove")
    iso.ground(c)
    # nets on the ground first (under the harvested tree and its neighbour)
    ha, hb, _, _ = TREES[HARVEST]
    nets(c, ha + 1, hb + 1, 18, seed=3)
    na, nb, _, _ = TREES[2]
    nets(c, na + 2, nb + 2, 15, seed=8, rot=12)
    beating_pole(c, na + 4, nb + 9)

    def ladder(cc):
        ag.ladder(cc, cc.P(ha - 9, hb + 13, 0), cc.P(ha - 5, hb + 3.5, 25), width=4.6, rungs=6,
                  pal=ag.WICKER | {"mid": "#a8744a", "dark": "#5e3b22"}, rail=1.5)

    # everything standing, back to front (by a + b)
    items = [(a + b, "tree", i) for i, (a, b, _, _) in enumerate(TREES)] + [(SHED[0] + SHED[1] + B, "shed", None)]
    for _, kind, i in sorted(items):
        if kind == "shed":
            with c.at(*SHED):
                shed(c)
            iso.amphora(c, SHED[0] + A + 4.5, SHED[1] - 3, k=0.9)
            iso.amphora(c, SHED[0] + A + 4, SHED[1] + 3, k=0.75)
            continue
        a, b, k, seed = TREES[i]
        if i == HARVEST:
            ag.basket(c, a - 14, b + 6, k=1.0, contents="olives", seed=12)
        ag.grove_olive(c, a, b, k=k, seed=seed, before_crown=ladder if i == HARVEST else None, crown="dome")
        if i == 2:
            ag.basket(c, a + 9, b + 12, k=0.95, contents="olives", seed=14)
    ag.basket(c, ha + 4, hb + 15, k=1.05, contents="olives", seed=13)
    iso.pebbles(c, [(14, 4, 1.0, 1), (-24, -8, 1.1, 2)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
