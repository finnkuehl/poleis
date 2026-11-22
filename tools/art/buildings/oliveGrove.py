"""oliveGrove - three old, gnarled olive trees on a dry-stone terrace: two on the raised terrace,
one in front where the harvest is going on (a ladder in the crown, a cloth spread under the tree,
baskets full of olives), with stone steps and a little roadside shrine.
Accent (owner colour): base rim band, the harvest cloth and the ribbon tied round the shrine."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import math  # noqa: E402
import random  # noqa: E402

import iso  # noqa: E402
import lib_agri as ag  # noqa: E402
from iso import ACCENT, MARBLE, f, poly  # noqa: E402

TERR = (-14, -14)      # terrace centre (a, b)
RHO, TH = 42, 11       # terrace radius and wall height
T1 = (-38, -3)         # back-left tree (on the terrace)
T2 = (-4, -40)         # back-right tree (on the terrace)
T3 = (38, 16)          # front tree (lower level, being harvested)
SHRINE = (-2, 45)
K = 1.3                # tree size


def on_terrace(a, b, margin=0.0):
    return math.hypot(a - TERR[0], b - TERR[1]) < RHO + margin


def steps(c):
    """Three rough stone steps up the terrace wall (lit side)."""
    F = ag.FIELD
    a0, a1 = -8, 0
    for i in range(3):
        z0, z1 = i * TH / 3, (i + 1) * TH / 3
        b1 = 27.5 + (3 - i) * 2.6
        iso.box(c, a0, a1, 26.5, b1, z0, z1, "#cdbf9f", "#b3a383", "#8a7d66", edge="#e6dcc4")
        c.add(c.on(c.m_bface(b1), f'<rect x="{a0 + 2.6 + i}" y="{f(z0)}" width="0.5" height="{f(z1 - z0)}" fill="{F["joint"]}" opacity="0.6"/>'))


def shrine(c, a, b):
    """Small stone pillar shrine with a gabled niche; an owner-colour ribbon tied round it."""
    F = ag.FIELD
    iso.cast_shadow(c, [(a - 3.5, b - 3.5), (a + 3.5, b - 3.5), (a + 3.5, b + 3.5), (a - 3.5, b + 3.5)],
                    [(a + sa * 3.2, b + sb * 3.2, 19) for sa in (-1, 1) for sb in (-1, 1)], opacity=0.36, sd=1.2)
    iso.contact_ao(c, a - 3.5, a + 3.5, b - 3.5, b + 3.5, width=2.2, opacity=0.35)
    iso.box(c, a - 3.5, a + 3.5, b - 3.5, b + 3.5, 0, 1.6, F["top"], F["lit"], F["shade"], edge="#fff")
    iso.box(c, a - 2.6, a + 2.6, b - 2.6, b + 2.6, 1.6, 11, MARBLE["top"], MARBLE["left"], MARBLE["right"])
    # niche block with a tiny gable
    iso.box(c, a - 3.2, a + 3.2, b - 3.2, b + 3.2, 11, 17, MARBLE["top"], MARBLE["left"], MARBLE["right"], edge="#fff")
    c.add(c.on(c.m_bface(b + 3.2), f'<rect x="{f(a - 1.8)}" y="12.2" width="3.6" height="4" fill="#5a5148"/>'
               f'<rect x="{f(a - 1.8)}" y="15.4" width="3.6" height="0.8" fill="#2d2721" opacity="0.6"/>'
               f'<path d="M{f(a - 0.5)},12.2 L{f(a + 0.5)},12.2 L{f(a + 0.4)},14.6 Q{f(a)},15.4 {f(a - 0.4)},14.6Z" fill="{iso.GOLD["base"]}"/>'))
    c.add(c.on(c.m_bface(b + 3.2), f'<path d="{poly([(a - 3.8, 17), (a + 3.8, 17), (a, 19.6)])}" fill="{iso.TERRACOTTA["lit"]}"/>'
               f'<path d="M{f(a - 3.8)},17 L{f(a)},19.6 L{f(a + 3.8)},17" fill="none" stroke="{iso.TERRACOTTA["hi"]}" stroke-width="0.5"/>'))
    c.add(c.on(c.m_aface(a + 3.2), f'<rect x="{f(-b - 3.2)}" y="17" width="6.4" height="0.6" fill="{iso.TERRACOTTA["shade"]}"/>'))
    x, y = c.P(a, b, 19.6)
    c.add(f'<path d="M{f(x)},{f(y)} L{f(x + 6.4)},{f(y + 3.2)} L{f(x + 6.4)},{f(y + 4.2)} L{f(x)},{f(y + 1)}Z" fill="{iso.TERRACOTTA["shade"]}"/>')
    # ribbon round the pillar (both visible faces) with two tails on the front
    zr = 7.5
    c.accent(c.on(c.m_bface(b + 2.6), f'<rect x="{f(a - 2.6)}" y="{f(zr)}" width="5.2" height="1.6" fill="{ACCENT["light"]}"/>'
                  f'<path d="M{f(a - 0.6)},{f(zr + 0.2)} L{f(a - 1.8)},{f(zr - 5.2)} L{f(a - 0.6)},{f(zr - 4.4)} L{f(a + 0.2)},{f(zr - 5.6)} L{f(a + 0.6)},{f(zr + 0.2)}Z" fill="{ACCENT["lit"]}"/>')
             + c.on(c.m_aface(a + 2.6), f'<rect x="{f(-b - 2.6)}" y="{f(zr)}" width="5.2" height="1.6" fill="{ACCENT["shade"]}"/>'))
    c.add(c.on(c.m_bface(b + 2.6), f'<rect x="{f(a - 2.6)}" y="{f(zr)}" width="5.2" height="0.4" fill="#1d2b36" opacity="0.25"/>'
               f'<circle cx="{f(a)}" cy="{f(zr + 0.8)}" r="0.7" fill="{iso.GOLD["lit"]}"/>'))
    # offering: a small bowl of olives and a lamp at the foot
    x, y = c.P(a + 1, b + 5.5, 0)
    c.add(f'<ellipse cx="{f(x + 0.8)}" cy="{f(y + 0.4)}" rx="3" ry="1.2" fill="#1f2e15" opacity="0.35"/>'
          f'<path d="M{f(x - 2.6)},{f(y - 1.6)} Q{f(x)},{f(y + 1.2)} {f(x + 2.6)},{f(y - 1.6)}Z" fill="{iso.TERRACOTTA["base"]}"/>'
          f'<ellipse cx="{f(x)}" cy="{f(y - 1.6)}" rx="2.6" ry="0.9" fill="#3a2a1c"/>'
          + "".join(f'<circle cx="{f(x + dx)}" cy="{f(y - 1.9 + dy)}" r="0.65" fill="{col}"/>' for dx, dy, col in [(-1, 0, "#3b3a24"), (0.2, -0.3, "#4a3a4c"), (1.2, 0.1, "#6f7d34"), (-0.3, 0.3, "#2f2a33")]))


def harvest(c):
    """Cloth spread under the front tree, with fallen olives on it."""
    ta, tb = T3
    corners = [(ta - 12, tb - 9), (ta + 11, tb - 12), (ta + 12, tb + 10), (ta - 10, tb + 12)]
    ag.ground_cloth(c, corners, seed=3)
    rnd = random.Random(8)
    ol = []
    for _ in range(26):
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


def build():
    c = iso.Canvas("oliveGrove")
    sa, sb = SHRINE

    def avoid(a, b):
        return (on_terrace(a, b, 3) or math.hypot(a - T3[0], b - T3[1]) < 15 or math.hypot(a - sa, b - sb) < 6
                or (-9 < a < 1 and 26 < b < 37))

    iso.base(c, seed=27, avoid=avoid, tufts=80, flowers=14)
    # terrace shadow on the lower ground (falls to +a)
    ring = [(TERR[0] + RHO * math.cos(t), TERR[1] + RHO * math.sin(t)) for t in [i * math.pi / 12 for i in range(24)]]
    iso.cast_shadow(c, ring, [(a, b, TH) for a, b in ring], opacity=0.4)
    ag.round_terrace(c, TERR[0], TERR[1], RHO, TH, seed=5,
                     avoid=lambda a, b: math.hypot(a - T1[0], b - T1[1]) < 8 or math.hypot(a - T2[0], b - T2[1]) < 8)
    steps(c)
    with c.at(0, 0, TH):
        # baskets and a jar on the terrace, between the old trees
        ag.grove_olive(c, *T2, k=K, seed=2)
        ag.basket(c, -24, -24, k=0.9, contents="olives", seed=11)
        ag.grove_olive(c, *T1, k=K * 1.04, seed=1)
        iso.amphora(c, -16, 10, k=0.8, shaded=False)
    harvest(c)
    shrine(c, sa, sb)

    def ladder(cc):
        ag.ladder(cc, cc.P(T3[0] - 8, T3[1] + 15, 0), cc.P(T3[0] - 5, T3[1] + 4.5, 26), width=5, rungs=6, pal=ag.WICKER | {"mid": "#a8744a", "dark": "#5e3b22"}, rail=1.6)

    ag.grove_olive(c, *T3, k=K, seed=3, before_crown=ladder)
    ag.basket(c, 16, 36, k=1.05, contents="olives", seed=12)
    ag.basket(c, 25, 41, k=0.9, contents="olives", seed=13)
    iso.rocks(c, [(52, -8, 2.6, 61), (56, -2, 1.7, 62), (-52, 30, 2.0, 63)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
