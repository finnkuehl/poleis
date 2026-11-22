"""vineyard - a sunny hillside planted with rows of vines on stakes, heavy with dark grapes:
the slope rises toward the back, rolls off to the left in a gentle shoulder with cypresses,
shows a cut of earth and rock on the right and stands on a dry-stone wall; the day's harvest
waits in front.
Accent (owner colour): base rim band, the ribbons tied to the row-end stakes and the cloth
spread for the harvest."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import math  # noqa: E402
import random  # noqa: E402

import iso  # noqa: E402
import lib_agri as ag  # noqa: E402
from iso import ZS, f, poly  # noqa: E402

HR = 61.5              # radius of the hill's footprint (inside the base)
BF = 22.0              # foot edge of the hill (b); the dry-stone wall stands there
ZF = 5.0               # height of the foot wall
TAN = 0.3              # main slope: rise per unit toward -b (back)
T2 = 0.62              # left shoulder: rise per unit toward +a
AL = -math.sqrt(HR ** 2 - BF ** 2)     # the shoulder starts at the front-left corner
ROWS = [13, 1.5, -10, -21.5, -33, -44.5]


def z_main(b):
    return ZF + (BF - b) * TAN


def z_flank(a):
    return (a - AL) * T2


def zh(a, b):
    """Ground height of the hill (the lower of the two planes)."""
    return min(z_main(b), z_flank(a))


def a_ridge(b):
    """a where the main slope meets the left shoulder."""
    return AL + z_main(b) / T2


def clip(pts_, fn):
    """Sutherland-Hodgman: keep the part of a convex polygon where the linear fn >= 0."""
    out = []
    for i, p in enumerate(pts_):
        q = pts_[(i + 1) % len(pts_)]
        fp, fq = fn(p), fn(q)
        if fp >= 0:
            out.append(p)
        if (fp >= 0) != (fq >= 0):
            t = fp / (fp - fq)
            out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out


def hill(c):
    rnd = random.Random(5)
    phi_f = math.asin(BF / HR)
    # right cut: earth with rock strata (curved, faces +a, in shade)
    n = 26
    rim = [(HR * math.cos(p), HR * math.sin(p)) for p in [-math.pi / 4 + (phi_f + math.pi / 4) * i / n for i in range(n + 1)]]
    top = [c.P(a, b, zh(a, b)) for a, b in rim]
    bot = [c.P(a, b, 0) for a, b in rim[::-1]]
    eg = c.lin("cut", 0, 0, 0, 1, [(0, "#8f6640"), (0.5, "#74502f"), (1, "#563821")], bbox=True)
    c.add(f'<path d="{poly(top + bot)}" fill="{eg}"/>')
    strata = ["M" + " L".join(f"{f(x)},{f(y)}" for x, y in [c.P(a, b, zh(a, b) * t) for a, b in rim]) for t in (0.33, 0.62)]
    rocks = []
    for _ in range(12):
        a, b = rim[rnd.randrange(1, n)]
        x, y = c.P(a, b, zh(a, b) * rnd.uniform(0.15, 0.8))
        r_ = rnd.uniform(1.2, 2.4)
        rocks.append(f'<path d="{iso.puff(x, y, r_ * 1.3, r_ * 0.8, n=6, seed=rnd.randrange(999), bulge=1.1)}" fill="{rnd.choice(["#8f877b", "#a39a8c", "#776f64"])}"/>'
                     f'<path d="M{f(x - r_ * 0.9)},{f(y - r_ * 0.4)} q{f(r_ * 0.8)},{f(-r_ * 0.6)} {f(r_ * 1.6)},0" fill="none" stroke="#d6cfc2" stroke-width="0.5" opacity="0.6"/>')
    ao = c.lin("cutao", 0, 0, 1, 0, [(0, "#2d1a0c", 0), (1, "#2d1a0c", 0.35)], bbox=True)
    c.add(f'<path d="{"".join(strata)}" fill="none" stroke="#3a2210" stroke-width="0.8" opacity="0.3"/>' + "".join(rocks)
          + f'<path d="{poly(top + bot)}" fill="{ao}"/>'
          f'<path d="M{" L".join(f"{f(x)},{f(y)}" for x, y in bot)}" fill="none" stroke="#1f2e15" stroke-width="1.6" opacity="0.45" filter="{c.blur(0.45)}"/>')

    # the two planes of the hill top, clipped from the footprint (disc and b < BF)
    foot = [(HR * math.cos(t), HR * math.sin(t)) for t in [math.pi - phi_f + (math.pi + 2 * phi_f) * i / 64 for i in range(65)]]
    ridge_fn = lambda p: z_flank(p[0]) - z_main(p[1])     # noqa: E731  >= 0: the main slope is the lower one
    main = clip(foot, ridge_fn)
    flank = clip(foot, lambda p: -ridge_fn(p))
    m_main = c.m_slope_b(ZF + BF * TAN, TAN)
    m_flank = f"matrix(1 {f(0.5 - ZS * T2)} -1 0.5 {f(c.ox)} {f(c.oy + ZS * T2 * AL)})"
    sg = c.lin("slope", 0, 0, 1, 0, [(0, "#d6b67c"), (0.55, "#c49e64"), (1, "#a9844e")], bbox=True)
    sv = c.lin("slopeV", 0, 0, 0, 1, [(0, "#fff8d0", 0.16), (0.5, "#fff8d0", 0), (1, "#2c4a1c", 0.1)], bbox=True)
    fg = c.lin("flank", 0, 1, 1, 0, [(0, "#d2e68e"), (0.6, "#dcebA4"), (1, "#c8de86")], bbox=True)
    c.add(c.on(m_main, f'<path d="{poly(main)}" fill="{sg}"/><path d="{poly(main)}" fill="{sv}"/>') + c.on(m_flank, f'<path d="{poly(flank)}" fill="{fg}"/>'))
    # tilled soil: furrows between the rows, pebbles, a few weeds
    furrows, peb = [], []
    for b in [BF - 3 - i * 3.8 for i in range(18)]:
        right = math.sqrt(max(0.0, (HR - 3) ** 2 - b * b))
        left = max(a_ridge(b) + 1.5, -right)
        if right - left > 4:
            a = left + rnd.uniform(0, 6)
            while a < right - 2:
                ln = min(rnd.uniform(4, 11), right - a)
                p0, p1 = c.P(a, b + rnd.uniform(-0.6, 0.6), z_main(b)), c.P(a + ln, b + rnd.uniform(-0.6, 0.6), z_main(b))
                furrows.append(f"M{f(p0[0])},{f(p0[1])} L{f(p1[0])},{f(p1[1])}")
                a += ln + rnd.uniform(2, 7)
    for _ in range(40):
        while True:
            a, b = rnd.uniform(-50, 58), rnd.uniform(-58, BF - 1)
            if a * a + b * b < (HR - 3) ** 2 and ridge_fn((a, b)) > 2:
                break
        x, y = c.P(a, b, z_main(b))
        peb.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rnd.uniform(0.6, 1.1))}" ry="0.45" fill="{rnd.choice(["#e9d6aa", "#8d6a42", "#f2e2bc"])}"/>')
    c.add(f'<path d="{"".join(furrows)}" stroke="#8a6638" stroke-width="0.7" stroke-linecap="round" opacity="0.3"/>' + "".join(peb))
    # soft crease along the ridge
    rb = [b for b in [BF - i * 2 for i in range(50)] if a_ridge(b) ** 2 + b * b < HR ** 2]
    ridge = [c.P(a_ridge(b), b, z_main(b)) for b in rb]
    c.add(f'<path d="M{" L".join(f"{f(x)},{f(y)}" for x, y in ridge)}" fill="none" stroke="#f0f8c8" stroke-width="1.6" opacity="0.45" filter="{c.blur(0.45)}"/>')
    # grass lip over the right cut + light on the crest
    lip_in = [(x, y + 1.6 + rnd.random() * 1.4) for x, y in top[::-1]]
    c.add(f'<path d="{poly(top + lip_in)}" fill="#7da544"/>'
          f'<path d="M{" L".join(f"{f(x)},{f(y - 0.3)}" for x, y in top)}" fill="none" stroke="#e4f3b0" stroke-width="0.8" opacity="0.6"/>')
    # tufts on the hill (more on the grassy shoulder)
    tf = []
    for i in range(44):
        while True:
            a, b = rnd.uniform(-60, 58), rnd.uniform(-60, BF - 2)
            if a * a + b * b < (HR - 3) ** 2 and (i < 10 or ridge_fn((a, b)) < 0):
                break
        x, y = c.P(a, b, zh(a, b))
        tf.append(iso.grass_tuft(x, y, rnd.uniform(2, 3.4), rnd.choice(["#7d9a3a", "#c8d88a", "#8fa94a", "#6c9a38"]), sw=0.75, op=0.8))
    c.add("".join(tf))


def foot_wall(c):
    """Dry-stone retaining wall along the foot of the hill; it tapers out at the left shoulder."""
    afr = math.sqrt(HR ** 2 - BF ** 2)
    shape = [(AL, 0), (afr, 0), (afr, ZF), (AL + ZF / T2, ZF)]
    ag.dry_wall(c, c.m_bface(BF), AL, afr, 0, ZF, light=0.9, seed=4, rows=2, shape=shape)
    c.add(c.on(c.m_bface(BF), f'<path d="M{f(AL)},0 L{f(AL + ZF / T2)},{f(ZF - 0.35)} L{f(afr)},{f(ZF - 0.35)}" fill="none" stroke="#efe6d2" stroke-width="0.7" opacity="0.8"/>'))
    iso.base_tufts(c, [((AL + 8, BF), (afr, BF))], n=16, seed=12, hmax=3.4)


def crest(c):
    """Cypresses on the shoulder and the crest of the hill."""
    for a, b, h, sd in ((-40, -26, 40, 7), (-14, -54, 52, 8)):
        with c.at(0, 0, zh(a, b)):
            iso.cypress(c, a, b, h=h, seed=sd)


def harvest(c):
    """In front of the hill: a cloth with cut bunches and baskets full of grapes."""
    gr = c.rad("grape", 0.35, 0.25, 0.8, [(0, ag.GRAPE["lit"]), (0.55, ag.GRAPE["base"]), (1, ag.GRAPE["dark"])], bbox=True)
    corners = [(-4, 30), (15, 28), (18, 43), (-1, 46)]
    ag.ground_cloth(c, corners, seed=7)
    rnd = random.Random(3)
    out = []
    for a, b in [(1, 34), (6, 33), (11, 34.5), (4, 39.5), (10, 40.5), (14, 37.5)]:
        x, y = c.P(a + rnd.uniform(-1, 1), b + rnd.uniform(-1, 1), 0.3)
        out.append(f'<g transform="rotate({f(rnd.uniform(-70, -40))} {f(x)} {f(y)})">' + ag.grape_small(x, y, 1.1, gr) + "</g>"
                   f'<path d="M{f(x - 1)},{f(y - 0.6)} q1.4,-1.8 3.4,-1.2 q-0.6,1.6 -3.4,1.2Z" fill="{ag.VINE["lit"]}"/>')
    c.add("".join(out))
    ag.basket(c, -14, 37, k=1.1, contents="grapes", seed=21)
    ag.basket(c, 28, 33, k=1.0, contents="grapes", seed=22)
    iso.amphora(c, 44, 26, k=0.8, shaded=False)
    ag.basket(c, 25, 47, k=0.85, contents="grapes", seed=23)


def build():
    c = iso.Canvas("vineyard")
    iso.base(c, seed=33, avoid=lambda a, b: (a * a + b * b < (HR + 1.5) ** 2 and b < BF + 2) or (-6 < a < 20 and 27 < b < 49),
             tufts=48, flowers=12)
    # the hill throws a soft shadow onto the grass at its right foot
    rim = [(HR * math.cos(t), HR * math.sin(t)) for t in [-math.pi / 2 + i * math.pi / 14 for i in range(10)]]
    iso.cast_shadow(c, rim, [(a, b, zh(a, b)) for a, b in rim], opacity=0.4)
    hill(c)
    crest(c)
    for i, b in enumerate(ROWS):
        right = math.sqrt(max(0.0, (HR - 6) ** 2 - b * b)) - 2
        left = max(a_ridge(b) + 4, -right)
        if right - left > 8:
            ag.vine_row(c, b, left, right, z_main(b), seed=10 + i)
    foot_wall(c)
    harvest(c)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
