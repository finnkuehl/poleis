"""Shared pieces for the farmland buildings: fishery, oliveGrove, vineyard, winery.

Builds on iso.py (same projection, light and accent rules, see tools/art/README.md). Everything
here is drawn in world units around the current origin (use `c.at()` to move it); props are
placed by their ground point (a, b). Deterministic: only random.Random(seed).
"""
import math
import random

import iso
from iso import ACCENT, WOOD, ZS, f, poly, puff

# ---------------------------------------------------------------------------
# Extra materials (close to the palette in docs/ART.md)
# ---------------------------------------------------------------------------
# weathered, sun-bleached timber (fisher's hut, jetty, stakes)
DRIFT = {"hi": "#d8c4a0", "lit": "#c2a67c", "mid": "#a88a62", "shade": "#7d6a55", "dark": "#5a4a3a", "deep": "#3b3027"}
# straw thatch
STRAW = {"hi": "#f6e2a2", "lit": "#e6c477", "base": "#cfa65a", "shade": "#a17a3c", "dark": "#74552a", "deep": "#4f3a1c"}
# woven wicker (baskets)
WICKER = {"hi": "#f1d391", "lit": "#d9b26a", "base": "#b98b48", "shade": "#8a6430", "dark": "#5e4220"}
# dry fieldstone (terrace walls, the vat)
FIELD = {"top": "#e6dcc4", "lit": "#cdbf9f", "mid": "#b3a383", "shade": "#8a7d66", "dark": "#5f564a", "joint": "#3e372f"}
# grapes, must and wine (palette "Wine" #7a2a3a)
GRAPE = {"hi": "#b98aa8", "lit": "#7d4a7c", "base": "#57285a", "shade": "#3c1940", "dark": "#24102a", "bloom": "#ab9cc2"}
# vine / olive leaves (palette "Olive" #6f7d3a, "Olive dark" #4a5a26), a bit fresher for vines
VINE = {"hi": "#c4d77a", "lit": "#93b048", "base": "#6f8f34", "shade": "#4c6a26", "dark": "#33491b"}
# coastal water (palette "Turquoise" #3fb3b8, "Sea deep" #1e5f8a)
WATER = {"foam": "#f4fbf6", "shallow": "#7fd6cf", "lit": "#55c3c4", "base": "#3fb3b8", "deep": "#2a8fa8", "dark": "#1e6f8e"}


# ---------------------------------------------------------------------------
# Timber: poles, posts, plank walls, ladders
# ---------------------------------------------------------------------------
def pole(c, a, b, z0, z1, w=1.5, pal=DRIFT, cap=True):
    """Round wooden pole standing at (a, b) from z0 to z1 (screen-space drawing)."""
    x, y0 = c.P(a, b, z0)
    _, y1 = c.P(a, b, z1)
    out = [f'<rect x="{f(x - w / 2)}" y="{f(y1)}" width="{f(w)}" height="{f(y0 - y1)}" fill="{pal["mid"]}"/>',
           f'<rect x="{f(x - w / 2)}" y="{f(y1)}" width="{f(w * 0.4)}" height="{f(y0 - y1)}" fill="{pal["hi"]}" opacity="0.8"/>',
           f'<rect x="{f(x + w / 2 - w * 0.3)}" y="{f(y1)}" width="{f(w * 0.3)}" height="{f(y0 - y1)}" fill="{pal["dark"]}" opacity="0.7"/>']
    if cap:
        out.append(f'<ellipse cx="{f(x)}" cy="{f(y1)}" rx="{f(w / 2)}" ry="{f(w / 4)}" fill="{pal["hi"]}"/>')
    c.add("".join(out))


def post(c, a, b, z0, z1, s=0.9, pal=DRIFT):
    """Square timber post (half width s) as a tiny box."""
    iso.box(c, a - s, a + s, b - s, b + s, z0, z1, pal["hi"], pal["lit"], pal["shade"])


def plank_wall_b(c, b, a0, a1, z0, z1, pal=DRIFT, seed=1, board=3.2):
    """Lit left (+b) wall of vertical boards: tone per board, seams, a few knots, foot AO."""
    rnd = random.Random(seed)
    g = c.lin("pwL", 0, 0, 1, 0, [(0, pal["hi"]), (0.55, pal["lit"]), (1, pal["mid"])], bbox=True)
    out = [f'<rect x="{f(a0)}" y="{f(z0)}" width="{f(a1 - a0)}" height="{f(z1 - z0)}" fill="{g}"/>']
    seams, light = [], []
    x = a0
    while x < a1 - 0.6:
        w = min(board * rnd.uniform(0.8, 1.2), a1 - x)
        t = rnd.uniform(-1, 1)
        out.append(f'<rect x="{f(x)}" y="{f(z0)}" width="{f(w)}" height="{f(z1 - z0)}" fill="{"#fff" if t > 0 else pal["deep"]}" opacity="{f(abs(t) * 0.1)}"/>')
        if x + w < a1 - 0.6:
            seams.append(f"M{f(x + w)},{f(z0)}V{f(z1)}")
            light.append(f"M{f(x + w + 0.45)},{f(z0)}V{f(z1)}")
        if rnd.random() < 0.35:
            out.append(f'<ellipse cx="{f(x + w * 0.5)}" cy="{f(rnd.uniform(z0 + 3, z1 - 3))}" rx="0.45" ry="0.7" fill="{pal["dark"]}" opacity="0.55"/>')
        x += w
    out.append(f'<path d="{"".join(seams)}" stroke="{pal["deep"]}" stroke-width="0.5" opacity="0.6"/>'
               f'<path d="{"".join(light)}" stroke="{pal["hi"]}" stroke-width="0.4" opacity="0.5"/>')
    ao = c.lin("pwLao", 0, 0, 0, 1, [(0, "#2d2418", 0), (1, "#2d2418", 0.32)], bbox=True)
    out.append(f'<rect x="{f(a0)}" y="{f(z0)}" width="{f(a1 - a0)}" height="5" fill="{ao}"/>')
    c.add(c.on(c.m_bface(b), "".join(out)))


def plank_wall_a(c, a, b0, b1, z0, z1, gable=0.0, pal=DRIFT, seed=2, board=3.2):
    """Shaded right (+a) wall of vertical boards with an optional gable triangle (local x = -b)."""
    rnd = random.Random(seed)
    shape = [(-b1, z0), (-b0, z0), (-b0, z1)] + ([((-b0 - b1) / 2, z1 + gable)] if gable else []) + [(-b1, z1)]
    g = c.lin("pwR", 0, 1, 0, 0, [(0, pal["mid"]), (0.3, pal["shade"]), (1, pal["shade"])], bbox=True)
    out = [f'<path d="{poly(shape)}" fill="{g}"/>']
    seams = []
    x = -b1
    while x < -b0 - 0.6:
        w = min(board * rnd.uniform(0.8, 1.2), -b0 - x)
        if x + w < -b0 - 0.6:
            seams.append(f"M{f(x + w)},{f(z0)}V{f(z1 + gable * (1 - abs((x + w) - (-b0 - b1) / 2) / ((b1 - b0) / 2)))}")
        x += w
    out.append(f'<path d="{"".join(seams)}" stroke="{pal["deep"]}" stroke-width="0.5" opacity="0.55"/>')
    bounce = c.lin("pwRb", 0, 1, 0, 0, [(0, "#b8c98a", 0.3), (1, "#b8c98a", 0)], bbox=True)
    out.append(f'<rect x="{f(-b1)}" y="{f(z0)}" width="{f(b1 - b0)}" height="9" fill="{bounce}"/>'
               f'<rect x="{f(-b1)}" y="{f(z0)}" width="0.6" height="{f(z1 - z0)}" fill="{pal["lit"]}" opacity="0.5"/>')
    c.add(c.on(c.m_aface(a), "".join(out)))


def ladder(c, p0, p1, width=4.0, rungs=5, pal=DRIFT, rail=1.1):
    """Ladder in screen space from foot point p0 to top point p1 (both screen points)."""
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy)
    nx, ny = -dy / ln * width / 2, dx / ln * width / 2
    out = [f'<path d="M{f(x0 + nx * 1.6 + 1.2)},{f(y0 + 0.5)} L{f(x0 - nx * 1.6 + 1.2)},{f(y0 + 0.5)}" stroke="#1f2e15" stroke-width="1.6" opacity="0.3"/>']
    for s, col in ((-1, pal["dark"]), (1, pal["mid"])):
        out.append(f'<path d="M{f(x0 + s * nx)},{f(y0 + s * ny)} L{f(x1 + s * nx)},{f(y1 + s * ny)}" stroke="{col}" stroke-width="{f(rail)}" stroke-linecap="round"/>')
    for i in range(1, rungs + 1):
        t = i / (rungs + 1)
        cx, cy = x0 + dx * t, y0 + dy * t
        out.append(f'<path d="M{f(cx - nx)},{f(cy - ny)} L{f(cx + nx)},{f(cy + ny)}" stroke="{pal["lit"]}" stroke-width="{f(rail * 0.75)}"/>')
    c.add("".join(out))


# ---------------------------------------------------------------------------
# Thatch roof (ridge along a), like iso.tile_roof_a but straw
# ---------------------------------------------------------------------------
def thatch_roof_a(c, AV, BV, ZR, tanp, T=4.2, seed=4, pal=STRAW):
    """Straw gable roof with the ridge along a (at b=0). Front slope (+b) faces the viewer.
    AV: half length incl. overhang; BV: half depth incl. overhang; ZR: thatch top at the ridge.
    Returns the eave height (top of the thatch at the eave)."""
    rnd = random.Random(seed)
    ZE = ZR - BV * tanp
    if 1 - ZS * tanp > 0.02:   # the back slope shows as a sliver for low pitches
        c.add(c.on(c.m_slope_b(ZR, tanp, -1), f'<rect x="{f(-AV)}" y="{f(-BV)}" width="{f(2 * AV)}" height="{f(BV)}" fill="{pal["shade"]}"/>'))
    # front slope: layered courses of straw
    g = c.lin("thF", 0, 0, 0, 1, [(0, pal["hi"]), (0.35, pal["lit"]), (0.8, pal["base"]), (1, pal["shade"])], bbox=True)
    out = [f'<rect x="{f(-AV)}" y="0" width="{f(2 * AV)}" height="{f(BV)}" fill="{g}"/>']
    courses = 5
    lc = BV / courses
    dark, mid, light = [], [], []
    for j in range(courses):
        y0 = j * lc
        out.append(f'<rect x="{f(-AV)}" y="{f(y0 + lc - 1.1)}" width="{f(2 * AV)}" height="1.1" fill="{pal["dark"]}" opacity="0.38"/>')
        n = int(2 * AV / 0.9)
        for i in range(n):
            x = -AV + (i + rnd.uniform(0, 1)) * 2 * AV / n
            ln = rnd.uniform(lc * 0.55, lc * 1.05)
            yy = y0 + rnd.uniform(0, lc - ln * 0.6)
            r = rnd.random()
            seg = f"M{f(x)},{f(yy)}l{f(rnd.uniform(-0.3, 0.3))},{f(ln)}"
            (dark if r < 0.3 else light if r > 0.72 else mid).append(seg)
    out.append(f'<path d="{"".join(mid)}" stroke="{pal["base"]}" stroke-width="0.55" stroke-linecap="round" opacity="0.9"/>'
               f'<path d="{"".join(dark)}" stroke="{pal["dark"]}" stroke-width="0.5" stroke-linecap="round" opacity="0.55"/>'
               f'<path d="{"".join(light)}" stroke="{pal["hi"]}" stroke-width="0.5" stroke-linecap="round" opacity="0.85"/>')
    sheen = c.rad("thSheen", 0.25, 0.3, 0.75, [(0, "#fff4cf", 0.35), (1, "#fff4cf", 0)], bbox=True)
    out.append(f'<rect x="{f(-AV)}" y="0" width="{f(2 * AV)}" height="{f(BV)}" fill="{sheen}"/>'
               f'<rect x="{f(AV - 3)}" y="0" width="3" height="{f(BV)}" fill="{pal["dark"]}" opacity="0.22"/>')
    c.add(c.on(c.m_slope_b(ZR, tanp), "".join(out)))

    # front eave: thick ragged straw edge
    zb = ZE - T
    pts = [(-AV, ZE)]
    pts += [(AV, ZE), (AV, zb)]
    x = AV
    while x > -AV:
        x2 = max(-AV, x - rnd.uniform(1.2, 2.2))
        pts.append(((x + x2) / 2, zb - rnd.uniform(0.5, 1.6)))
        pts.append((x2, zb + rnd.uniform(-0.2, 0.3)))
        x = x2
    eg = c.lin("thE", 0, 1, 0, 0, [(0, pal["lit"]), (0.45, pal["base"]), (1, pal["shade"])], bbox=True)
    strokes = "".join(f"M{f(-AV + i * 2 * AV / 60 + rnd.uniform(-0.2, 0.2))},{f(ZE - 0.3)}l0,{f(-T + rnd.uniform(-0.6, 0.6))}" for i in range(60))
    c.add(c.on(c.m_bface(BV), f'<path d="{poly(pts)}" fill="{eg}"/>'
               f'<path d="{strokes}" stroke="{pal["dark"]}" stroke-width="0.4" opacity="0.5"/>'
               f'<rect x="{f(-AV)}" y="{f(ZE - 0.8)}" width="{f(2 * AV)}" height="0.8" fill="{pal["hi"]}" opacity="0.7"/>'))
    # right verge: the straw layer seen from the gable side
    v = [(-BV, ZE), (0, ZR), (BV, ZE), (BV, ZE - T), (0, ZR - T), (-BV, ZE - T)]
    vs = "".join(f"M{f(-BV + i * 2 * BV / 30)},{f(ZR - abs(-BV + i * 2 * BV / 30) * tanp - 0.2)}l0,{f(-T + 0.4)}" for i in range(31))
    c.add(c.on(c.m_aface(AV), f'<path d="{poly(v)}" fill="{pal["shade"]}"/>'
               f'<path d="{vs}" stroke="{pal["dark"]}" stroke-width="0.4" opacity="0.6"/>'
               f'<path d="M{f(-BV)},{f(ZE)} L0,{f(ZR)} L{f(BV)},{f(ZE)}" fill="none" stroke="{pal["lit"]}" stroke-width="0.9" stroke-linejoin="round"/>'))
    # ridge: a bound bundle of straw
    rg = c.lin("thR", 0, 1, 0, 0, [(0, pal["shade"]), (0.5, pal["base"]), (1, pal["hi"])], bbox=True)
    ties = "".join(f'<rect x="{f(-AV + i * 2 * AV / 7 - 0.5)}" y="{f(ZR - 1.4)}" width="1" height="3.6" fill="{WOOD["dark"]}" opacity="0.8"/>' for i in range(1, 7))
    c.add(c.on(c.m_bface(0), f'<rect x="{f(-AV - 0.6)}" y="{f(ZR - 1.4)}" width="{f(2 * AV + 1.2)}" height="3.6" rx="1.6" fill="{rg}"/>{ties}'))
    x, y = c.P(AV + 0.6, 0, ZR + 0.4)
    c.add(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="1.7" ry="2.2" fill="{pal["shade"]}"/><ellipse cx="{f(x + 0.2)}" cy="{f(y + 0.2)}" rx="1" ry="1.4" fill="{pal["dark"]}"/>')
    return ZE


# ---------------------------------------------------------------------------
# Baskets, fish, olives, grapes
# ---------------------------------------------------------------------------
def fish_shape(x, y, k=1.0, ang=0.0, flip=False):
    """One small silver fish in screen space (centre x, y; length ~7k)."""
    s = -1 if flip else 1
    return (f'<g transform="translate({f(x)} {f(y)}) rotate({f(ang)}) scale({f(s * k)} {f(k)})">'
            '<path d="M-3.6,0 C-2.2,-1.7 1.4,-1.8 3,0 C1.4,1.5 -2.2,1.5 -3.6,0Z" fill="#a9c3cd"/>'
            '<path d="M-3.4,-0.1 C-2,-1.4 1.3,-1.5 2.8,-0.1Z" fill="#e4f0f2"/>'
            '<path d="M2.6,0 L4.4,-1.3 L4.1,0 L4.4,1.3Z" fill="#7f9eae"/>'
            '<path d="M-3.4,0.2 C-2,1.1 1.2,1.2 2.6,0.3" fill="none" stroke="#5f7f90" stroke-width="0.35"/>'
            '<circle cx="-2.4" cy="-0.3" r="0.38" fill="#1d2b36"/></g>')


def basket(c, a, b, k=1.0, contents="fish", seed=3, z=0.0):
    """Woven wicker basket standing at (a, b, z), heaped with fish, olives or grapes."""
    x, y = c.P(a, b, z)
    rnd = random.Random(seed)
    W = WICKER
    rx, ry, h = 5.0 * k, 2.2 * k, 6.0 * k
    rb = rx * 0.82
    c.add(f'<ellipse cx="{f(x + 1.5 * k)}" cy="{f(y + 0.3)}" rx="{f(rx * 1.15)}" ry="{f(ry * 0.9)}" fill="#1f2e15" opacity="0.38" filter="{c.blur(0.45)}"/>')
    body = c.lin("wick", 0, 0, 1, 0, [(0, W["hi"]), (0.3, W["lit"]), (0.7, W["base"]), (1, W["shade"])], bbox=True)
    top = y - h
    out = [f'<path d="M{f(x - rx)},{f(top)} L{f(x - rb)},{f(y - ry * 0.4)} A{f(rb)},{f(ry * 0.8)} 0 0 0 {f(x + rb)},{f(y - ry * 0.4)} L{f(x + rx)},{f(top)} A{f(rx)},{f(ry)} 0 0 1 {f(x - rx)},{f(top)}Z" fill="{body}"/>']
    # weave: staggered dashes along front arcs
    for i in range(4):
        t = (i + 0.6) / 4.6
        yy = top + (y - ry * 0.4 - top) * t
        rr = rx + (rb - rx) * t
        dash = f"{f(1.4 * k)} {f(1.0 * k)}"
        out.append(f'<path d="M{f(x - rr)},{f(yy)} A{f(rr)},{f(ry * (1 - 0.2 * t))} 0 0 0 {f(x + rr)},{f(yy)}" fill="none" stroke="{W["dark"]}" stroke-width="{f(0.9 * k)}" stroke-dasharray="{dash}" stroke-dashoffset="{f(i % 2 * 1.2 * k)}" opacity="0.55"/>')
    out.append(f'<ellipse cx="{f(x)}" cy="{f(top)}" rx="{f(rx)}" ry="{f(ry)}" fill="{W["dark"]}"/>'
               f'<path d="M{f(x - rx)},{f(top)} A{f(rx)},{f(ry)} 0 0 0 {f(x + rx)},{f(top)}" fill="none" stroke="{W["hi"]}" stroke-width="{f(1.1 * k)}"/>')
    c.add("".join(out))
    heap = []
    if contents == "fish":
        for i in range(6):
            fx = x + rnd.uniform(-rx * 0.6, rx * 0.6)
            fy = top - rnd.uniform(0.2, 1.8) * k
            heap.append(fish_shape(fx, fy, 0.75 * k, rnd.uniform(-35, 35), rnd.random() < 0.5))
    elif contents in ("olives", "grapes"):
        cols = (["#3d4a1e", "#58682a", "#2e2430", "#4a3a44", "#7a8a3a"] if contents == "olives"
                else [GRAPE["shade"], GRAPE["base"], GRAPE["lit"], GRAPE["dark"]])
        for i in range(24 if contents == "olives" else 18):
            ang = rnd.uniform(0, math.pi * 2)
            rr = math.sqrt(rnd.random())
            px, py = x + math.cos(ang) * rr * rx * 0.85, top + math.sin(ang) * rr * ry * 0.8 - (1 - rr) * 2.2 * k
            r_ = (0.95 if contents == "olives" else 1.15) * k
            heap.append(f'<ellipse cx="{f(px)}" cy="{f(py)}" rx="{f(r_ * (1.2 if contents == "olives" else 1))}" ry="{f(r_)}" fill="{rnd.choice(cols)}"/>')
        for i in range(6):
            ang = rnd.uniform(math.pi, math.pi * 2)
            px, py = x + math.cos(ang) * rx * 0.4 - 0.4, top + math.sin(ang) * ry * 0.3 - 1.4 * k
            heap.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="{f(0.35 * k)}" fill="#fff" opacity="0.55"/>')
        if contents == "grapes":
            heap.append(f'<path d="M{f(x - 1)},{f(top - 2.6 * k)} q1.5,-2 3.6,-1.2 q-0.8,1.8 -3.6,1.2Z" fill="{VINE["lit"]}"/>')
    c.add("".join(heap))


# ---------------------------------------------------------------------------
# Dry-stone walls (terraces, enclosures)
# ---------------------------------------------------------------------------
def _mix(c1, c2, t):
    a_ = [int(c1[i:i + 2], 16) for i in (1, 3, 5)]
    b_ = [int(c2[i:i + 2], 16) for i in (1, 3, 5)]
    t = min(1.0, max(0.0, t))
    return "#" + "".join(f"{int(round(x + (y - x) * t)):02x}" for x, y in zip(a_, b_))


def _stones(x0, x1, z0, z1, rnd, rows, light):
    """Irregular stone blocks on a face (local x, y up); light 0 (shade) .. 1 (sunlit). Returns markup."""
    out = []
    rh = (z1 - z0) / rows
    for r in range(rows):
        x = x0 - rnd.uniform(0, 2.5)
        while x < x1:
            w = rnd.uniform(3.2, 6.2)
            xa, xb = max(x0, x + 0.25), min(x1, x + w - 0.25)
            if xb - xa > 0.6:
                ya, yb = z0 + r * rh + 0.25, z0 + (r + 1) * rh - 0.25
                tone = _mix("#5f564a", "#d6c8a8", light * 0.85 + rnd.uniform(-0.14, 0.14))
                out.append(f'<rect x="{f(xa)}" y="{f(ya)}" width="{f(xb - xa)}" height="{f(yb - ya)}" rx="0.9" fill="{tone}"/>'
                           f'<rect x="{f(xa + 0.3)}" y="{f(yb - 0.55)}" width="{f(xb - xa - 0.6)}" height="0.45" rx="0.2" fill="#fff" opacity="{f(0.15 + 0.35 * light)}"/>')
            x += w
    return "".join(out)


def dry_wall(c, m, x0, x1, z0, z1, light=0.8, seed=1, rows=2, shape=None):
    """Dry-stone wall face drawn in any vertical face transform m (local x, y = z up).
    shape: optional local polygon the wall is clipped to (e.g. a wall that tapers out)."""
    rnd = random.Random(seed)
    body = (f'<rect x="{f(x0)}" y="{f(z0)}" width="{f(x1 - x0)}" height="{f(z1 - z0)}" fill="#3e372f"/>'
            + _stones(x0, x1, z0, z1, rnd, rows, light)
            + f'<rect x="{f(x0)}" y="{f(z0)}" width="{f(x1 - x0)}" height="1.2" fill="#2d271d" opacity="0.3"/>')
    if shape:
        cid = c.define(f"wall{seed}", f'<clipPath id="{c.id(f"wall{seed}")}"><path d="{poly(shape)}"/></clipPath>')
        body = f'<g clip-path="{cid}">{body}</g>'
    c.add(c.on(m, body))


# ---------------------------------------------------------------------------
# Owner-colour cloth
# ---------------------------------------------------------------------------
def ground_cloth(c, corners, z=0.25, seed=5):
    """Harvest cloth spread flat on the ground (ACCENT). corners: 4 ground points (a, b) in order.
    Soft folds and a cream hem are art on top."""
    sp = [c.P(a, b, z) for a, b in corners]
    g = c.lin("gcloth", 0, 0, 1, 1, [(0, ACCENT["lit"]), (0.5, ACCENT["light"]), (1, ACCENT["mid"])], bbox=True)
    c.add(f'<path d="{poly([(x + 1.2, y + 0.8) for x, y in sp])}" fill="#1f2e15" opacity="0.3" filter="{c.blur(0.8)}"/>')
    c.accent(f'<path d="{poly(sp)}" fill="{g}"/>')
    rnd = random.Random(seed)
    folds = []
    for i in range(3):
        t = 0.25 + 0.25 * i + rnd.uniform(-0.05, 0.05)
        p0 = (sp[0][0] + (sp[1][0] - sp[0][0]) * t, sp[0][1] + (sp[1][1] - sp[0][1]) * t)
        p1 = (sp[3][0] + (sp[2][0] - sp[3][0]) * t, sp[3][1] + (sp[2][1] - sp[3][1]) * t)
        folds.append(f"M{f(p0[0])},{f(p0[1])} L{f(p1[0])},{f(p1[1])}")
    c.add(f'<path d="{"".join(folds)}" stroke="#1d2b36" stroke-width="0.8" opacity="0.16"/>'
          f'<path d="{poly(sp)}" fill="none" stroke="#f4ead2" stroke-width="0.7" stroke-dasharray="1.6 1.1" opacity="0.8"/>')


# ---------------------------------------------------------------------------
# Terraces
# ---------------------------------------------------------------------------
def round_terrace(c, ca, cb, rho, h, seed=1, rows=2, tufts=36, avoid=None):
    """Raised round grass terrace held by a dry-stone wall: centre (ca, cb), radius rho, height h.
    Draws the visible front half of the wall, the grass top and a grass lip over the wall."""
    rnd = random.Random(seed)
    lo, hi_ = -math.pi / 4, 3 * math.pi / 4

    def P(phi, z, r=rho):
        return c.P(ca + r * math.cos(phi), cb + r * math.sin(phi), z)

    n = 48
    phis = [lo + (hi_ - lo) * i / n for i in range(n + 1)]
    top = [P(p, h) for p in phis]
    bot = [P(p, 0) for p in phis[::-1]]
    c.add(f'<path d="{poly(top + bot)}" fill="#3e372f"/>')

    stones = []
    for r in range(rows):
        z0, z1 = r * h / rows + 0.3, (r + 1) * h / rows - 0.3
        phi = lo - rnd.uniform(0, 4) / rho
        while phi < hi_:
            dphi = rnd.uniform(3.4, 6.2) / rho
            p0, p1 = max(phi + 0.25 / rho, lo), min(phi + dphi - 0.25 / rho, hi_)
            if p1 - p0 > 0.6 / rho:
                pm = (p0 + p1) / 2
                t = ((math.sin(pm) - math.cos(pm)) / math.sqrt(2) + 1) / 2
                col = _mix("#5f564a", "#cdbb98", t * 0.85 + rnd.uniform(-0.15, 0.15))
                pts_ = [P(p0, z0), P(pm, z0 - 0.15), P(p1, z0), P(p1, z1), P(pm, z1 + 0.15), P(p0, z1)]
                stones.append(f'<path d="{poly(pts_)}" fill="{col}" stroke="{col}" stroke-width="0.6" stroke-linejoin="round"/>')
                if t > 0.35:
                    q0, q1 = P(p0 + 0.3 / rho, z1 - 0.2), P(p1 - 0.3 / rho, z1 - 0.2)
                    stones.append(f'<path d="M{f(q0[0])},{f(q0[1])} L{f(q1[0])},{f(q1[1])}" stroke="#fff" stroke-width="0.45" opacity="{f(0.2 + 0.35 * t)}"/>')
            phi += dphi
    c.add("".join(stones))
    # contact shadow at the foot of the wall
    c.add(f'<path d="M{" L".join(f"{f(x)},{f(y)}" for x, y in bot)}" fill="none" stroke="#1f2e15" stroke-width="1.6" opacity="0.4" filter="{c.blur(0.45)}"/>')
    # grass top
    x, y = c.P(ca, cb, h)
    rx = rho * math.sqrt(2)
    g = c.rad("terrTop", 0.35, 0.3, 0.8, [(0, "#c3df7c"), (0.5, "#a6cd62"), (1, "#88b44c")], bbox=True)
    c.add(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rx)}" ry="{f(rx / 2)}" fill="{g}"/>')
    # grass lip hanging over the wall
    outer = top
    inner = []
    for i, p in enumerate(phis[::-1]):
        drip = 1.4 + rnd.random() * 1.2 + (1.5 if rnd.random() < 0.15 else 0)
        px, py = P(p, h)
        inner.append((px, py + drip))
    lg = c.lin("terrLip", 0, 0, 1, 0, [(0, "#9cc85a"), (0.5, "#7eaa42"), (1, "#5d8530")], bbox=True)
    c.add(f'<path d="{poly(outer + inner)}" fill="{lg}"/>'
          f'<path d="M{" L".join(f"{f(px)},{f(py - 0.4)}" for px, py in top[4:-10])}" fill="none" stroke="#e4f3b0" stroke-width="0.8" opacity="0.6"/>')
    cid = c.define("terrClip" + str(seed), f'<clipPath id="{c.id("terrClip" + str(seed))}"><ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rx)}" ry="{f(rx / 2)}"/></clipPath>')
    tf = [f'<g clip-path="{cid}">']
    for _ in range(tufts):
        while True:
            ang = rnd.uniform(0, 2 * math.pi)
            rr = rho * math.sqrt(rnd.random()) * 0.95
            a, b = ca + rr * math.cos(ang), cb + rr * math.sin(ang)
            if avoid is None or not avoid(a, b):
                break
        tx, ty = c.P(a, b, h)
        tf.append(iso.grass_tuft(tx, ty, rnd.uniform(2.4, 3.8), "#6c9a38" if rnd.random() < 0.7 else "#c4e086", sw=0.8, op=0.8))
    tf.append("</g>")
    c.add("".join(tf))


# ---------------------------------------------------------------------------
# A gnarled grove olive (bigger and older than iso.olive_tree, with fruit)
# ---------------------------------------------------------------------------
def grove_olive(c, a, b, k=1.0, seed=1, olives=True, before_crown=None, crown="flat"):
    """Old olive tree with a twisted, split trunk and a broad silver crown hung with olives.
    before_crown(c): optional callback drawn after the trunk and before the crown (ladders).
    crown: "flat" (a broad, low crown) or "dome" (a taller, rounder, more irregular crown on
    longer limbs - the grounded olive grove, where the trees stand on the open field)."""
    x, y = c.P(a, b, 0)
    rnd = random.Random(seed)
    iso.blob_shadow(c, a + 14 * k, b - 3, 13 * k, 0.34)
    c.add(f'<ellipse cx="{f(x + 0.8)}" cy="{f(y + 0.4)}" rx="{f(5.5 * k)}" ry="{f(2 * k)}" fill="#24381a" opacity="0.5" filter="{c.blur(0.45)}"/>')
    tf = f"translate({f(x)} {f(y)}) scale({f(k)})"
    bark = c.lin("bark", 0, 0, 1, 0, [(0, "#bdb4a2"), (0.35, "#958a78"), (0.7, "#6d6354"), (1, "#4a4238")], bbox=True)
    s = 1 if seed % 2 else -1     # mirror the twist per tree
    trunk = (f'<g transform="{tf} scale({f(s * 1.2)} 1.1)">'
             # one broad, twisted trunk with a root flare, forking into limbs at the top
             '<path d="M-7,0.6 C-4.4,-0.8 -3.6,-3 -4.4,-5.6 C-5.4,-8.4 -5.4,-11 -3.8,-13.8 L-1.2,-15.6 L1.8,-15 L4.9,-14 '
             'C5.6,-11 4,-8.6 4.4,-6 C4.8,-3.4 5.4,-1.4 7.6,0.6 Q0.4,2.4 -7,0.6Z" fill="url(#BARK)"/>'
             # twisting furrows (dark) and sunlit ridges (light)
             '<path d="M-4,-0.6 C-1,-3.6 2.2,-6.2 0.8,-12.6 M-1.2,-0.2 C1.6,-3 3.6,-7 2.8,-13.4 M2.6,-0.4 C4,-2.6 3.4,-5 3.9,-8" fill="none" stroke="#3f382f" stroke-width="0.7" opacity="0.65"/>'
             '<path d="M-5,-1.6 C-3.6,-5.6 -5,-9.6 -3,-13.4 M-2.4,-1.4 C0,-4 1.2,-6.6 -0.2,-11.4" fill="none" stroke="#e2dccd" stroke-width="0.7" opacity="0.7"/>'
             # a small hollow and a burl
             '<path d="M-0.6,-0.8 C-1.4,-2.8 -0.6,-4.8 0.6,-5.8 C1.1,-3.8 1.2,-2.4 0.8,-0.8Z" fill="#2a241c"/>'
             '<ellipse cx="-3.4" cy="-8.6" rx="1.3" ry="1" fill="#6d6354"/><ellipse cx="-3.7" cy="-8.9" rx="0.6" ry="0.45" fill="#d4ccbb" opacity="0.8"/>'
             '</g>').replace("url(#BARK)", bark)
    c.add(trunk)
    # limbs into the crown
    limbs = [((-4.4 * s, -15), (-10 * s, -18), (-13.5 * s, -22), 3.2), ((-1.8 * s, -16), (-1.4 * s, -21), (-4 * s, -26), 2.8),
             ((5.2 * s, -16), (9 * s, -18.5), (13 * s, -21.5), 3.0), ((4.4 * s, -16), (4 * s, -21), (5.5 * s, -27), 2.4)]
    if crown == "dome":
        limbs = [((-4.4 * s, -15), (-10 * s, -19), (-12.5 * s, -26), 3.2), ((-1.8 * s, -16), (-2.4 * s, -23), (-4.5 * s, -31), 2.8),
                 ((5.2 * s, -16), (9.5 * s, -20), (12 * s, -25.5), 3.0), ((4.4 * s, -16), (3.6 * s, -23), (5 * s, -32), 2.4)]
    lm = []
    for (x0, y0), (x1, y1), (x2, y2), w in limbs:
        d = f"M{f(x + x0 * k)},{f(y + y0 * k)} Q{f(x + x1 * k)},{f(y + y1 * k)} {f(x + x2 * k)},{f(y + y2 * k)}"
        lm.append(f'<path d="{d}" fill="none" stroke="#7a6f5f" stroke-width="{f(w * k)}" stroke-linecap="round"/>'
                  f'<path d="{d}" fill="none" stroke="#c9c1b0" stroke-width="{f(w * k * 0.3)}" stroke-linecap="round" opacity="0.6" transform="translate({f(-0.4 * k)} 0)"/>')
    c.add("".join(lm))
    if before_crown:
        before_crown(c)
    # crown: overlapping silver-green clumps
    base_p = [(0, -29, 12.5, 6.8), (-11.5, -24, 9, 5.2), (11.5, -23.5, 9, 5.2), (-7, -33.5, 7.5, 4.4), (7, -33, 7.5, 4.4),
              (0, -22.5, 9.5, 4.6), (-17, -27.5, 5.8, 3.8), (17, -28, 5.8, 3.8)]
    if crown == "dome":
        # the first five carry the highlights: a high centre, two shoulders, two tufts on top
        base_p = [(0, -36, 11.5, 8.4), (-10.5 * s, -30, 9, 7), (10.5 * s, -29, 9, 7), (-6 * s, -43, 7.5, 5.6), (6.5 * s, -42, 7, 5.4),
                  (0, -26.5, 10, 6), (-15.5 * s, -25.5, 6.2, 5), (15 * s, -24.5, 6.4, 5), (1.5 * s, -48, 5.4, 3.8)]
    puffs = [(px + rnd.uniform(-1.2, 1.2), py + rnd.uniform(-1, 1), rx * rnd.uniform(0.92, 1.1), ry * rnd.uniform(0.92, 1.1), seed * 20 + i)
             for i, (px, py, rx, ry) in enumerate(base_p)]
    leaf = c.rad("gleaf", 0.36, 0.28, 0.85, [(0, "#c6d29c"), (0.5, "#8c9c5e"), (1, "#56663a")], bbox=True)
    c.add('<g fill="#34402a">' + "".join(f'<path d="{puff(x + (px + 1) * k, y + (py + 1.8) * k, rx * k, ry * k, n=9, seed=sd)}"/>' for px, py, rx, ry, sd in puffs) + "</g>")
    out = []
    for px, py, rx, ry, sd in sorted(puffs, key=lambda p: -p[1]):
        out.append(f'<path d="{puff(x + px * k, y + py * k, rx * k * 0.96, ry * k * 0.96, n=9, seed=sd)}" fill="{leaf}"/>'
                   f'<path d="{puff(x + (px + 0.6) * k, y + (py + ry * 0.55) * k, rx * 0.8 * k, ry * 0.32 * k, n=7, seed=sd + 7, bulge=1.2)}" fill="#55632f" opacity="0.45"/>')
    for px, py, rx, ry, sd in puffs[:5]:
        out.append(f'<path d="{puff(x + (px - rx * 0.25) * k, y + (py - ry * 0.35) * k, rx * 0.5 * k, ry * 0.4 * k, n=7, seed=sd + 50, bulge=1.35)}" fill="#e6ebcc" opacity="0.45"/>')
    c.add("".join(out))
    fl, ol = [], []
    for _ in range(26):
        px, py, rx, ry, sd = rnd.choice(puffs[:6])
        ang = rnd.uniform(math.pi, math.pi * 1.75)
        lx, ly = x + (px + rx * 0.8 * math.cos(ang)) * k, y + (py + ry * 0.8 * math.sin(ang)) * k
        fl.append(f'<ellipse cx="{f(lx)}" cy="{f(ly)}" rx="{f(1.4 * k)}" ry="{f(0.42 * k)}" transform="rotate({f(math.degrees(ang) + 90 + rnd.uniform(-25, 25))} {f(lx)} {f(ly)})" fill="#e9eecf" opacity="0.55"/>')
    if olives:
        for _ in range(12):
            px, py, rx, ry, sd = rnd.choice(puffs)
            ang = rnd.uniform(0.2 * math.pi, 0.8 * math.pi)
            ox_, oy_ = x + (px + rx * 0.72 * math.cos(ang)) * k, y + (py + ry * 0.7 * math.sin(ang)) * k
            col = rnd.choice(["#4e5a2a", "#5a4a5c", "#3f3946", "#7a8a3a"])
            ol.append(f'<ellipse cx="{f(ox_)}" cy="{f(oy_)}" rx="{f(0.7 * k)}" ry="{f(0.55 * k)}" fill="{col}"/>'
                      f'<circle cx="{f(ox_ - 0.22 * k)}" cy="{f(oy_ - 0.2 * k)}" r="{f(0.2 * k)}" fill="#fff" opacity="0.5"/>')
    c.add("".join(fl) + "".join(ol))


# ---------------------------------------------------------------------------
# Vines
# ---------------------------------------------------------------------------
def _g(v):
    """Short number for compact relative path data (1 decimal, no leading zero)."""
    t = f"{v:.1f}".rstrip("0").rstrip(".")
    t = t.replace("-0.", "-.") if t.startswith("-0.") else (t[1:] if t.startswith("0.") else t)
    return "0" if t in ("", "-0", "-") else t


GRAPE_RIM = [(-1.9, 0.6), (-0.8, -0.2), (0.6, -0.2), (1.8, 0.5), (2.1, 1.9), (1.4, 3.2), (0.9, 4.4), (0, 5.3), (-0.9, 4.3), (-1.5, 3.1), (-2.2, 1.8)]


def grape_small(x, y, k, url, seed=1, glints=None):
    """Compact hanging bunch in screen space: one scalloped outline (berry bumps); (x, y) = top.
    glints: optional list that collects the highlight dots (draw them once, see vine_row);
    without it the glints are part of the returned markup."""
    r = _g(0.95 * k)
    pts_ = [(px * k, py * k) for px, py in GRAPE_RIM]
    d = f"M{f(x + pts_[0][0])},{f(y + pts_[0][1])}"
    for (x0, y0), (x1, y1) in zip(pts_, pts_[1:] + pts_[:1]):
        d += f"a{r},{r} 0 0 1 {_g(x1 - x0)},{_g(y1 - y0)}"
    gl = f"M{f(x - 0.9 * k)},{f(y + 1.1 * k)}h.01M{f(x + 0.5 * k)},{f(y + 2.4 * k)}h.01M{f(x - 0.3 * k)},{f(y + 3.7 * k)}h.01"
    out = f'<path d="{d}Z" fill="{url}"/>'
    if glints is None:
        return out + f'<path d="{gl}" stroke="{GRAPE["bloom"]}" stroke-width="{f(0.8 * k)}" stroke-linecap="round" opacity="0.75"/>'
    glints.append(gl)
    return out


def vine_row(c, pos, x0, x1, z, seed=1, ribbon=True, foliage=(3.4, 10.2), stake_h=12.6, bunch_every=6.8):
    """A row of vines on stakes along a (from a = x0 to x1) at b = pos, standing on ground height z:
    gnarled trunks, stakes poking out of a leafy hedge (its leaf wall faces +b, lit) and dark grape
    bunches hanging below it. ribbon: an owner-colour ribbon tied to the end stake (ACCENT)."""
    rnd = random.Random(seed)
    zb, zt = z + foliage[0], z + foliage[1]
    s = pos
    sf = s + 1.3                       # front face of the hedge

    P, M = c.P, c.m_bface

    # soil strip + soft shadow under the row
    c.add(f'<path d="{poly([P(x0 - 1.5, s - 2.4, z), P(x1 + 2.5, s - 2.4, z), P(x1 + 3, s + 3.6, z), P(x0 - 1.5, s + 3.6, z)])}" fill="#7d5f36" opacity="0.4" filter="{c.blur(0.8)}"/>')
    # trunks and stakes (behind the hedge; their feet and tips show)
    trunks = []
    n_t = max(2, int((x1 - x0) / 4.6))
    for i in range(n_t + 1):
        x = x0 + (x1 - x0) * i / n_t + rnd.uniform(-0.6, 0.6)
        sx, y0 = P(x, s + 0.4, z)
        _, y1 = P(x, s + 0.4, zb + 0.8)
        wob = rnd.uniform(-1, 1)
        trunks.append(f"M{f(sx)},{f(y0)} C{f(sx + wob)},{f(y0 - (y0 - y1) * 0.4)} {f(sx - wob)},{f(y0 - (y0 - y1) * 0.7)} {f(sx + wob * 0.5)},{f(y1)}")
    c.add(f'<path d="{"".join(trunks)}" fill="none" stroke="{WOOD["dark"]}" stroke-width="1.15" stroke-linecap="round"/>')
    n_s = max(1, int((x1 - x0) / 10))
    stake_xs = [x0 + (x1 - x0) * i / n_s for i in range(n_s + 1)]
    st = []
    for x in stake_xs:
        sx, y0 = P(x, s, z)
        _, y1 = P(x, s, z + stake_h)
        st.append(f"M{f(sx)},{f(y0)}V{f(y1)}")
    c.add(f'<path d="{"".join(st)}" stroke="{DRIFT["mid"]}" stroke-width="1.2"/>'
          f'<path d="{"".join(st)}" stroke="{DRIFT["hi"]}" stroke-width="0.4" transform="translate(-0.4 0)"/>')
    # hedge: back layer (its top seen from above), then the front face
    top, bot = [], []
    n = max(4, int((x1 - x0) / 2.8))
    for i in range(n + 1):
        x = x0 - 0.8 + (x1 - x0 + 1.6) * i / n
        top.append((x, zt + rnd.uniform(-1.1, 1.0)))
        bot.append((x, zb + rnd.uniform(-0.6, 0.9)))

    def scallop(pts_, up):
        d = ""
        for (xa, ya), (xb, yb) in zip(pts_, pts_[1:]):
            d += f" Q{f((xa + xb) / 2)},{f((ya + yb) / 2 + (1.6 if up else -1.4))} {f(xb)},{f(yb)}"
        return d

    shape = (f"M{f(top[0][0])},{f(top[0][1])}" + scallop(top, True) + f" L{f(bot[-1][0])},{f(bot[-1][1])}"
             + scallop(bot[::-1], False) + "Z")
    back = c.lin("vineTop", 0, 0, 1, 1, [(0, VINE["hi"]), (1, VINE["base"])], bbox=True)
    front = c.lin("vineFront", 0, 0, 1, 1, [(0, VINE["lit"]), (0.4, VINE["base"]), (1, VINE["dark"])], bbox=True)
    c.add(c.on(M(s - 1.7), f'<path d="{shape}" fill="{back}" transform="translate(0 0.5)"/>'))
    lights = "".join(f"M{f(xa - 1.3)},{f(ya - 1.2)} q1.3,1.5 2.6,0" for i, (xa, ya) in enumerate(top[1:-1]) if i % 2 == 0)
    c.add(c.on(M(sf), f'<path d="{shape}" fill="{front}"/>'
               f'<path d="{lights}" fill="none" stroke="{VINE["hi"]}" stroke-width="1" stroke-linecap="round" opacity="0.7"/>'))
    # the shaded end of the hedge (+a)
    c.add(c.on(c.m_aface(x1 + 0.8), f'<path d="{poly([(-sf, bot[-1][1]), (-(s - 1.7), bot[-1][1] + 0.5), (-(s - 1.7), top[-1][1] + 0.5), (-sf, top[-1][1])])}" fill="{VINE["shade"]}"/>'))
    # grapes hanging under the foliage
    gr = c.rad("grape", 0.35, 0.25, 0.8, [(0, GRAPE["lit"]), (0.55, GRAPE["base"]), (1, GRAPE["dark"])], bbox=True)
    bunches, glints = [], []
    x = x0 + rnd.uniform(1, 4)
    while x < x1 - 1:
        sx, sy = P(x, sf + 0.2, zb + 1.3 + rnd.uniform(-0.4, 0.5))
        bunches.append(grape_small(sx, sy, rnd.uniform(0.72, 0.9), gr, glints=glints))
        x += bunch_every * rnd.uniform(0.7, 1.3)
    c.add("".join(bunches) + f'<path d="{"".join(glints)}" stroke="{GRAPE["bloom"]}" stroke-width="0.65" stroke-linecap="round" opacity="0.75"/>')
    if ribbon:
        x, y = P(stake_xs[-1], s, z + stake_h - 0.8)
        c.accent(f'<path d="M{f(x - 0.7)},{f(y - 1.1)} L{f(x + 0.7)},{f(y - 1.1)} Q{f(x + 3.5)},{f(y - 0.6)} {f(x + 6.8)},{f(y + 1.6)} L{f(x + 4.8)},{f(y + 2.1)} L{f(x + 6)},{f(y + 4)} Q{f(x + 2.8)},{f(y + 2.2)} {f(x + 0.7)},{f(y + 1.1)} L{f(x - 0.7)},{f(y + 1.1)}Z" fill="{ACCENT["light"]}"/>'
                 f'<path d="M{f(x + 0.7)},{f(y + 0.3)} Q{f(x + 3)},{f(y + 0.9)} {f(x + 4.8)},{f(y + 2.1)} L{f(x + 6)},{f(y + 4)} Q{f(x + 2.8)},{f(y + 2.2)} {f(x + 0.7)},{f(y + 1.1)}Z" fill="{ACCENT["shade"]}"/>')


# ---------------------------------------------------------------------------
# Pergola (grounded vineyard): a leafy vine roof on timber posts
# ---------------------------------------------------------------------------
def pergola(c, a0, a1, b0, b1, z, seed=1, pal=DRIFT, under=None, back_posts=True, bunches=5):
    """Vine pergola over the ground rectangle a0..a1 x b0..b1: timber posts, two beams along a
    and a leafy roof of vines at height z, with grape bunches hanging under its front (+b) edge
    and a dappled shadow on the ground. under(c): optional callback drawn after the back posts
    and before the front posts (benches, baskets standing under the pergola).
    back_posts=False: the back side rests on a wall (no posts there)."""
    rnd = random.Random(seed)
    # soft shadow of the leaf roof, falling to +a
    sh = [(a0, b0), (a1, b0), (a1, b1), (a0, b1)]
    iso.cast_shadow(c, sh, [(a, b, z) for a, b in sh], opacity=0.32, sd=1.6)
    if back_posts:
        for a in (a0 + 0.8, a1 - 0.8):
            pole(c, a, b0 + 0.8, 0, z - 0.6, w=1.7, pal=pal)
    if under:
        under(c)
    for a in (a0 + 0.8, a1 - 0.8):
        x, y = c.P(a, b1 - 0.8, 0)
        c.add(f'<ellipse cx="{f(x + 0.6)}" cy="{f(y + 0.3)}" rx="1.8" ry="0.7" fill="{iso.INK}" opacity="0.4" filter="{c.blur(0.45)}"/>')
        pole(c, a, b1 - 0.8, 0, z - 0.6, w=1.8, pal=pal)
    # beams along a (front and back), then cross poles along b
    for b in (b0 + 0.8, b1 - 0.8):
        p, q = c.P(a0 - 1.5, b, z - 0.4), c.P(a1 + 1.5, b, z - 0.4)
        c.add(f'<path d="M{f(p[0])},{f(p[1])} L{f(q[0])},{f(q[1])}" stroke="{pal["shade"]}" stroke-width="1.7" stroke-linecap="round"/>'
              f'<path d="M{f(p[0])},{f(p[1] - 0.5)} L{f(q[0])},{f(q[1] - 0.5)}" stroke="{pal["hi"]}" stroke-width="0.5" stroke-linecap="round" opacity="0.8"/>')
    n = max(3, int((a1 - a0) / 4.5))
    cross = []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        p, q = c.P(a, b0 - 1, z), c.P(a, b1 + 1, z)
        cross.append(f"M{f(p[0])},{f(p[1])} L{f(q[0])},{f(q[1])}")
    c.add(f'<path d="{"".join(cross)}" stroke="{pal["mid"]}" stroke-width="1" stroke-linecap="round"/>')
    # leaf roof: small vine-leaf clumps over the rectangle (gaps let the poles show), back to front
    clumps = []
    na, nb = max(3, int((a1 - a0) / 4.2)), max(2, int((b1 - b0) / 4.2))
    for i in range(na + 1):
        for j in range(nb + 1):
            if rnd.random() < 0.16 and 0 < i < na and 0 < j < nb:
                continue
            a = a0 + (a1 - a0) * (i + rnd.uniform(-0.3, 0.3)) / na
            b = b0 + (b1 - b0) * (j + rnd.uniform(-0.3, 0.3)) / nb
            clumps.append((a + b, a, b, rnd.uniform(2.7, 3.6), rnd.randrange(9999)))
    clumps.sort()
    leaf = c.rad("pergLeaf", 0.35, 0.3, 0.8, [(0, VINE["lit"]), (0.55, VINE["base"]), (1, VINE["shade"])], bbox=True)
    dark, lit, hi = [], [], []
    for _, a, b, r, sd in clumps:
        x, y = c.P(a, b, z + 1.2)
        dark.append(f'<path d="{puff(x + 0.5, y + 1.3, r * 1.12, r * 0.68, n=9, seed=sd, bulge=1.22)}"/>')
        lit.append(f'<path d="{puff(x, y, r, r * 0.6, n=9, seed=sd, bulge=1.22)}" fill="{leaf}"/>')
        hi.append(f'<path d="{puff(x - r * 0.3, y - r * 0.22, r * 0.42, r * 0.24, n=6, seed=sd + 3, bulge=1.3)}"/>')
    c.add(f'<g fill="{VINE["dark"]}">{"".join(dark)}</g>' + "".join(lit) + f'<g fill="{VINE["hi"]}" opacity="0.5">{"".join(hi)}</g>')
    # leaves trailing down the front edge, bunches hanging under it
    gr = c.rad("grape", 0.35, 0.25, 0.8, [(0, GRAPE["lit"]), (0.55, GRAPE["base"]), (1, GRAPE["dark"])], bbox=True)
    trail, bun, glints = [], [], []
    for i in range(int((a1 - a0) / 3) + 1):
        a = a0 + i * 3 + rnd.uniform(-0.6, 0.6)
        x, y = c.P(a, b1 + 0.8, z - rnd.uniform(0.5, 2.6))
        trail.append(f'<path d="{puff(x, y, rnd.uniform(1.6, 2.4), rnd.uniform(1.2, 1.7), n=6, seed=rnd.randrange(999))}"/>')
    for i in range(bunches):
        a = a0 + 2 + (a1 - a0 - 4) * (i + rnd.uniform(0.2, 0.8)) / bunches
        x, y = c.P(a, b1 + 0.4, z - 2.2)
        bun.append(grape_small(x, y, rnd.uniform(1.1, 1.3), gr, glints=glints))
    c.add(f'<g fill="{VINE["base"]}">{"".join(trail)}</g>' + "".join(bun)
          + f'<path d="{"".join(glints)}" stroke="{GRAPE["bloom"]}" stroke-width="0.7" stroke-linecap="round" opacity="0.75"/>')
