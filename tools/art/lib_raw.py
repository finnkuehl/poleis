"""Helpers for the raw-material buildings (woodcutter, quarry, mine, farm).

Built on top of iso.py (same projection, light and accent rules, see tools/art/README.md);
everything takes WORLD units like the iso helpers unless a docstring says "screen point".

    wood        log_a / log_b (lying logs with end grain), log_pile_b, stump, axe, chips, pine
    cabin       log_wall_b / log_wall_a (log-cabin walls), shingle_roof_b (front-gable roof)
    rock        boulder (faceted convex rock shaded by its facet normals, optional snow cap),
                rubble, rock_prism (vertical rock face), heap (mound of stones)
    quarry      terrace (cut limestone step), cut_face, stone_block, timber, rope, wheel_b, cart_a
    mine        rails_b, ore_tub, ore_heap, lantern, pickaxe
    farm        wheat_field, stubble, sheaf, haystack, scarecrow (tunic = ACCENT), sack
    misc        ground_patch (soft worn-earth patch), pennant (ACCENT flag), uid (gradient names)
"""
import math
import random

import iso
from iso import ACCENT, WOOD, ZS, f, hull, poly, puff

# ---------------------------------------------------------------------------
# Palettes (close to docs/ART.md: Wood, Wood dark, Stone grey, Wheat)
# ---------------------------------------------------------------------------
BARK = {"hi": "#b89068", "lit": "#94704b", "base": "#735236", "dark": "#4c3421", "deep": "#2f1f13"}
GRAIN_LIT = {"rim": "#6a4a2e", "outer": "#dcb27a", "inner": "#f3dba8", "ring": "#b5864f", "crack": "#8a6038"}
GRAIN_SHADE = {"rim": "#45301d", "outer": "#a98157", "inner": "#c49e70", "ring": "#86623e", "crack": "#5e4129"}
LOGWALL = {"hi": "#c99562", "lit": "#ab7748", "base": "#8a5a34", "dark": "#5e3b22", "deep": "#3e2514"}
LOGWALL_R = {"hi": "#9a7556", "lit": "#82603f", "base": "#6c4c32", "dark": "#4a3322", "deep": "#2e1f14"}
SHINGLE_GREY = {"hi": "#d8cfbd", "lit": "#b5aa96", "base": "#958a78", "shade": "#72695b", "dark": "#4f483e", "deep": "#302b25"}
SHINGLE = {"hi": "#c7a47a", "lit": "#a9845d", "base": "#8c6b4a", "shade": "#6a4f36", "dark": "#4a3626", "deep": "#2e2118"}
LIMESTONE = {"top": "#f6efdc", "left": "#ecdfc3", "left2": "#e0d0ae", "right": "#bdb3a0", "right2": "#a89e8c",
             "joint": "#a8977a", "hi": "#fffaf0", "dust": "#efe4c8"}
ROCK = {"hi": "#cfc8bc", "lit": "#a9a196", "mid": "#868076", "shade": "#64605d", "dark": "#48474b", "deep": "#302f35"}
WEATHERED = {"hi": "#d9cbae", "lit": "#bba889", "mid": "#9a886e", "shade": "#786b5e", "dark": "#5a5149", "deep": "#403b37"}
PALE_ROCK = {"hi": "#f3ead6", "lit": "#ddd1b8", "mid": "#c2b59b", "shade": "#9a948a", "dark": "#77736e", "deep": "#58575a"}
WHEAT = {"hi": "#fbe7a1", "lit": "#efcd6e", "base": "#d9b45a", "mid": "#c29a40", "shade": "#9a7630", "dark": "#6e5220"}
IRON = {"hi": "#e4e6e6", "lit": "#b9bfc2", "base": "#8c9396", "dark": "#4d5458"}


def uid(c, prefix):
    """Unique gradient name per canvas (iso gradients with the same name are shared)."""
    n = c.__dict__.setdefault("_raw_uid", {})
    n[prefix] = n.get(prefix, 0) + 1
    return f"{prefix}{n[prefix]}"


def _extremes(points, nx, ny):
    """The two points with the largest / smallest projection on (nx, ny)."""
    best = max(points, key=lambda p: p[0] * nx + p[1] * ny)
    worst = min(points, key=lambda p: p[0] * nx + p[1] * ny)
    return best, worst


# ---------------------------------------------------------------------------
# Logs
# ---------------------------------------------------------------------------
def _end_grain(r, pal, seed):
    """End grain of a cut log as face-local markup around (0, 0) (y up)."""
    rnd = random.Random(seed)
    out = [f'<circle r="{f(r)}" fill="{pal["rim"]}"/>',
           f'<circle r="{f(r * 0.84)}" fill="{pal["outer"]}"/>',
           f'<circle cx="{f(-r * 0.12)}" cy="{f(r * 0.1)}" r="{f(r * 0.6)}" fill="{pal["inner"]}" opacity="0.8"/>']
    for k in (0.62, 0.38):
        out.append(f'<circle r="{f(r * k)}" fill="none" stroke="{pal["ring"]}" stroke-width="{f(max(0.25, r * 0.06))}" opacity="0.7"/>')
    ang = rnd.uniform(0, 2 * math.pi)
    out.append(f'<path d="M0,0 L{f(r * 0.8 * math.cos(ang))},{f(r * 0.8 * math.sin(ang))}" stroke="{pal["crack"]}" stroke-width="{f(max(0.25, r * 0.07))}" opacity="0.8"/>'
               f'<circle r="{f(max(0.3, r * 0.1))}" fill="{pal["crack"]}"/>')
    return "".join(out)


def _log(c, axis, fixed, z, lo, hi_, r, bark, seed, cap):
    """Lying log. axis 'b': fixed = a, the log runs b in [lo, hi_], cap at b = hi_ (lit end).
    axis 'a': fixed = b, the log runs a in [lo, hi_], cap at a = hi_ (shaded end)."""
    n = 12 if r < 3 else 18
    if axis == "b":
        ring = lambda s, t: c.P(fixed + r * math.cos(t), s, z + r * math.sin(t))   # noqa: E731
        up = (-0.5, -1.0)          # screen perpendicular to the axis (-1, 0.5), pointing up
    else:
        ring = lambda s, t: c.P(s, fixed + r * math.cos(t), z + r * math.sin(t))   # noqa: E731
        up = (0.5, -1.0)
    front = [ring(hi_, 2 * math.pi * i / n) for i in range(n)]
    back = [ring(lo, 2 * math.pi * i / n) for i in range(n)]
    top, bot = _extremes(front, *up)
    g = c.lin(uid(c, "log"), top[0], top[1], bot[0], bot[1],
              [(0, bark["hi"]), (0.22, bark["lit"]), (0.55, bark["base"]), (0.85, bark["dark"]), (1, bark["deep"])])
    out = [f'<path d="{poly(hull(front + back))}" fill="{g}"/>']
    # bark furrows along the log (only on the visible upper half)
    rnd = random.Random(seed)
    nf = 0 if hi_ - lo < 6 else (3 if r < 3 else 5)
    d = ""
    for i in range(nf):
        t = math.pi * (0.15 + 0.7 * i / max(1, nf - 1)) + rnd.uniform(-0.1, 0.1)
        p0, p1 = ring(hi_, t), ring(lo + (hi_ - lo) * rnd.uniform(0, 0.3), t)
        d += f"M{f(p0[0])},{f(p0[1])}L{f(p1[0])},{f(p1[1])}"
    if d:
        out.append(f'<path d="{d}" stroke="{bark["deep"]}" stroke-width="0.45" opacity="0.4"/>')
    if hi_ - lo >= 3:
        p0, p1 = ring(hi_, math.pi * 0.55), ring(lo, math.pi * 0.55)
        out.append(f'<path d="M{f(p0[0])},{f(p0[1])} L{f(p1[0])},{f(p1[1])}" stroke="{bark["hi"]}" stroke-width="0.6" opacity="0.55"/>')
    c.add("".join(out))
    if cap:
        if axis == "b":
            c.add(c.on(c.m_bface(hi_), f'<g transform="translate({f(fixed)} {f(z)})">{_end_grain(r, GRAIN_LIT, seed)}</g>'))
        else:
            c.add(c.on(c.m_aface(hi_), f'<g transform="translate({f(-fixed)} {f(z)})">{_end_grain(r, GRAIN_SHADE, seed)}</g>'))


def log_b(c, a, z, b0, b1, r, bark=BARK, seed=1, cap=True):
    """Log lying along b (a, z fixed), end grain at b1 facing the lit front-left."""
    _log(c, "b", a, z, b0, b1, r, bark, seed, cap)


def log_a(c, b, z, a0, a1, r, bark=BARK, seed=1, cap=True):
    """Log lying along a (b, z fixed), end grain at a1 facing the shaded front-right."""
    _log(c, "a", b, z, a0, a1, r, bark, seed, cap)


def log_pile_b(c, a0, b0, b1, r, rows=(4, 3, 2, 1), seed=5):
    """Pyramid of logs along b, end grain toward +b. a0 = a of the left log centre (bottom row).
    Logs are drawn back (low a, low z) to front so each overlaps correctly."""
    logs = []
    for k, cnt in enumerate(rows):
        for i in range(cnt):
            a = a0 + r * k + 2 * r * i
            z = r + k * r * math.sqrt(3) * 0.98
            logs.append((a, z, k, i))
    rnd = random.Random(seed)
    for a, z, k, i in sorted(logs, key=lambda p: p[0] + 0.816 * p[1]):
        jitter = rnd.uniform(-1.6, 1.2)
        log_b(c, a, z, b0 + rnd.uniform(0, 2), b1 + jitter, r * rnd.uniform(0.92, 1.04), seed=seed * 10 + k * 4 + i)


def stump(c, a, b, r, h, seed=3, rings=True):
    """Tree stump / chopping block: bark cylinder with a lit cut top."""
    with c.at(a, b, 0):
        iso.cylinder(c, r, 0, h, [(0, BARK["hi"]), (0.25, BARK["lit"]), (0.6, BARK["base"]), (0.9, BARK["dark"]), (1, BARK["deep"])],
                     name=uid(c, "stump"))
        x, y = c.P(0, 0, h)
        rx = r * math.sqrt(2)
        rnd = random.Random(seed)
        out = [f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rx)}" ry="{f(rx / 2)}" fill="{GRAIN_LIT["rim"]}"/>',
               f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rx * 0.86)}" ry="{f(rx * 0.43)}" fill="{GRAIN_LIT["outer"]}"/>',
               f'<ellipse cx="{f(x - rx * 0.12)}" cy="{f(y - rx * 0.06)}" rx="{f(rx * 0.6)}" ry="{f(rx * 0.3)}" fill="{GRAIN_LIT["inner"]}"/>']
        if rings:
            for k in (0.62, 0.38, 0.18):
                out.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rx * k)}" ry="{f(rx * k / 2)}" fill="none" stroke="{GRAIN_LIT["ring"]}" stroke-width="0.4" opacity="0.7"/>')
        ang = rnd.uniform(0, math.pi)
        out.append(f'<path d="M{f(x)},{f(y)} L{f(x + rx * 0.8 * math.cos(ang))},{f(y + rx * 0.4 * math.sin(ang))}" stroke="{GRAIN_LIT["crack"]}" stroke-width="0.45"/>')
        # bark lines down the side
        for k in range(6):
            t = math.pi * (0.1 + 0.8 * k / 5)
            px = x + rx * math.cos(t)
            py = y + rx / 2 * math.sin(t)
            out.append(f'<path d="M{f(px)},{f(py + 0.6)} L{f(px + rnd.uniform(-0.3, 0.3))},{f(py + h * ZS - 0.2)}" stroke="{BARK["deep"]}" stroke-width="0.5" opacity="0.45"/>')
        c.add("".join(out))


def axe(c, x, y, k=1.0, flip=False):
    """Axe stuck in wood, blade buried at screen point (x, y), handle rising to the upper right."""
    s = -1 if flip else 1
    hx, hy = x + s * 9.5 * k, y - 10 * k
    c.add(f'<path d="M{f(x)},{f(y)} L{f(hx)},{f(hy)}" stroke="{WOOD["dark"]}" stroke-width="{f(1.7 * k)}" stroke-linecap="round"/>'
          f'<path d="M{f(x - 0.3 * s)},{f(y - 0.5)} L{f(hx - 0.3 * s)},{f(hy - 0.4)}" stroke="#d4a86e" stroke-width="{f(0.6 * k)}" stroke-linecap="round"/>'
          f'<path d="M{f(x - 3.4 * k)},{f(y + 0.6 * k)} L{f(x + 2.6 * k)},{f(y + 0.4 * k)} L{f(x + 2 * k)},{f(y - 2.6 * k)} L{f(x - 1.4 * k)},{f(y - 2.4 * k)}Z" fill="{IRON["base"]}"/>'
          f'<path d="M{f(x - 3.4 * k)},{f(y + 0.6 * k)} L{f(x - 1.4 * k)},{f(y - 2.4 * k)} L{f(x - 0.4 * k)},{f(y - 2.4 * k)} L{f(x - 2.2 * k)},{f(y + 0.6 * k)}Z" fill="{IRON["hi"]}"/>'
          f'<path d="M{f(x - 1.4 * k)},{f(y - 2.4 * k)} L{f(x + 2 * k)},{f(y - 2.6 * k)} L{f(x + 1.8 * k)},{f(y - 3.4 * k)} L{f(x - 1)},{f(y - 3.2 * k)}Z" fill="{IRON["dark"]}"/>')


# ---------------------------------------------------------------------------
# Log-cabin walls and a front-gable shingle roof
# ---------------------------------------------------------------------------
def log_wall_b(c, b, a0, a1, z0, z1, d=4.2, pal=LOGWALL):
    """Lit left (+b) wall of horizontal logs (running along a) with light chinking between them."""
    g = c.lin("lwb", 0, 0, 0, 1, [(0, pal["deep"]), (0.18, pal["dark"]), (0.55, pal["base"]), (0.85, pal["lit"]), (1, pal["hi"])], bbox=True)
    out = [f'<rect x="{f(a0)}" y="{f(z0)}" width="{f(a1 - a0)}" height="{f(z1 - z0)}" fill="#d9c7a2"/>']
    z = z0
    while z < z1 - 0.5:
        hh = min(d, z1 - z)
        out.append(f'<rect x="{f(a0)}" y="{f(z + 0.35)}" width="{f(a1 - a0)}" height="{f(hh - 0.7)}" rx="{f(min(1.6, hh / 2))}" fill="{g}"/>')
        z += d
    # knots and checks
    rnd = random.Random(int(a0 * 7 + b))
    for _ in range(int((a1 - a0) * (z1 - z0) / 70)):
        kx = rnd.uniform(a0 + 2, a1 - 2)
        kz = z0 + d * (rnd.randrange(int((z1 - z0) / d)) + 0.5)
        out.append(f'<ellipse cx="{f(kx)}" cy="{f(kz)}" rx="0.9" ry="0.6" fill="{pal["deep"]}" opacity="0.5"/>')
    ao = c.lin("lwbao", 0, z0, 0, z0 + 8, [(0, "#2e1f14", 0.35), (1, "#2e1f14", 0)])
    out.append(f'<rect x="{f(a0)}" y="{f(z0)}" width="{f(a1 - a0)}" height="8" fill="{ao}"/>')
    c.add(c.on(c.m_bface(b), "".join(out)))


def log_wall_a(c, a, b0, b1, z0, z1, d=4.2, gable=0.0, pal=LOGWALL_R):
    """Shaded right (+a) wall of logs (running along b); an optional plank gable on top."""
    g = c.lin("lwa", 0, 0, 0, 1, [(0, pal["deep"]), (0.18, pal["dark"]), (0.55, pal["base"]), (0.85, pal["lit"]), (1, pal["hi"])], bbox=True)
    out = [f'<rect x="{f(-b1)}" y="{f(z0)}" width="{f(b1 - b0)}" height="{f(z1 - z0)}" fill="#7f6f57"/>']
    z = z0
    while z < z1 - 0.5:
        hh = min(d, z1 - z)
        out.append(f'<rect x="{f(-b1)}" y="{f(z + 0.35)}" width="{f(b1 - b0)}" height="{f(hh - 0.7)}" rx="{f(min(1.6, hh / 2))}" fill="{g}"/>')
        z += d
    if gable:
        mid = (-b0 - b1) / 2
        tri = [(-b1, z1), (mid, z1 + gable), (-b0, z1)]
        out.append(f'<path d="{poly(tri)}" fill="#6e5a44"/>')
        nb = 6
        for i in range(1, nb):
            x = -b1 + i * (b1 - b0) / nb
            out.append(f'<rect x="{f(x - 0.25)}" y="{f(z1)}" width="0.5" height="{f(gable)}" fill="#3e2c1e" opacity="0.6"/>')
        out.append(f'<path d="{poly([(-b1, z1), (mid, z1 + gable), (-b0, z1), (-b0, z1 + 0.01), (mid, z1 + gable - 4), (-b1, z1 + 0.01)])}" fill="#2a1d13" opacity="0.3"/>')
    bounce = c.lin("lwab", 0, z0, 0, z0 + 12, [(0, "#c9d58f", 0.25), (1, "#c9d58f", 0)])
    out.append(f'<rect x="{f(-b1)}" y="{f(z0)}" width="{f(b1 - b0)}" height="12" fill="{bounce}"/>')
    c.add(c.on(c.m_aface(a), "".join(out)))


def _rects_path(rects):
    """One path made of many axis-aligned rectangles [(x, y, w, h)] (keeps files small)."""
    return "".join(f"M{f(x)},{f(y)}h{f(w)}v{f(h)}h{f(-w)}Z" for x, y, w, h in rects)


def shingle_roof_b(c, KA, KB, ZEAV, rise, T=2.2, courses=5, pal=SHINGLE, seed=9, ridge=True):
    """Wooden shingle gable roof with the ridge along b (at a=0): the gable faces the lit front
    (+b). The left (-a) slope catches the sun but is strongly foreshortened, so keep the pitch
    low (rise / KA around 0.6) if it should show. KA: half width at the eaves; KB: half length
    (incl. overhang); ZEAV: eave height. Returns the ridge height (top of the shingles)."""
    tanp = rise / KA
    ZRID = ZEAV + rise
    rnd = random.Random(seed)
    lc = KA / courses
    for sign in (-1, 1):
        lit = sign < 0
        x0 = -KA if lit else 0
        g = [f'<rect x="{f(x0)}" y="{f(-KB)}" width="{f(KA)}" height="{f(2 * KB)}" fill="{pal["lit"] if lit else pal["base"]}"/>']
        tones = {(True, 0): [], (True, 1): [], (False, 0): [], (False, 1): []}
        joints = ""
        for j in range(courses):
            xl = min(sign * j * lc, sign * (j + 1) * lc)
            y = -KB + (rnd.uniform(0, 2.4) if j % 2 else 0)
            while y < KB - 0.4:
                w = min(rnd.uniform(3.2, 5.2), KB - y)
                t = rnd.uniform(-1, 1)
                if abs(t) > 0.3:
                    tones[(t > 0, int(abs(t) > 0.7))].append((xl, y, lc, w))
                if y > -KB + 0.5:
                    joints += f"M{f(xl)},{f(y)}h{f(lc)}"
                y += w
        for (light, strong), rs in tones.items():
            if rs:
                g.append(f'<path d="{_rects_path(rs)}" fill="{"#fff1d6" if light else "#2e2118"}" opacity="{0.16 if strong else 0.08}"/>')
        g.append(f'<path d="{joints}" stroke="{pal["deep"]}" stroke-width="0.45" opacity="0.5"/>')
        # butt edge of each course: dark shadow line with a lit lip on its ridge side
        butts = [(sign * (j + 1) * lc - (0.9 if sign > 0 else 0), -KB, 0.9, 2 * KB) for j in range(courses)]
        lips = [(sign * (j + 1) * lc - (1.4 if sign > 0 else -0.9), -KB, 0.5, 2 * KB) for j in range(courses - 1)]
        g.append(f'<path d="{_rects_path(butts)}" fill="{pal["deep"]}" opacity="0.5"/>'
                 f'<path d="{_rects_path(lips)}" fill="{pal["hi"]}" opacity="0.4"/>')
        if not lit:
            sh = c.rad("shbsheen", KA * 0.25, KB * 0.3, KB * 1.2, [(0, "#ffe6c0", 0.22), (0.6, "#ffe6c0", 0.05), (1, "#ffe6c0", 0)])
            g.append(f'<rect x="0" y="{f(-KB)}" width="{f(KA)}" height="{f(2 * KB)}" fill="{sh}"/>')
        c.add(c.on(c.m_slope_a(ZRID, tanp, sign), "".join(g)))
    # right eave fascia (shade)
    c.add(c.on(c.m_aface(KA), f'<rect x="{f(-KB)}" y="{f(ZEAV - T)}" width="{f(2 * KB)}" height="{f(T)}" fill="{pal["dark"]}"/>'
               f'<rect x="{f(-KB)}" y="{f(ZEAV - 0.5)}" width="{f(2 * KB)}" height="0.5" fill="{pal["base"]}"/>'))
    # front rake: shingle edge, then barge boards under it that cross at the apex ("horns")
    bb, horn = 1.7, 2.6
    zl = lambda x: ZRID - T + tanp * x      # noqa: E731  left rake (rises toward the apex)
    zr = lambda x: ZRID - T - tanp * x      # noqa: E731  right rake
    rake = (f'<path d="{poly([(-KA, ZEAV), (0, ZRID), (KA, ZEAV), (KA, ZEAV - T), (0, ZRID - T), (-KA, ZEAV - T)])}" fill="{pal["dark"]}"/>'
            f'<path d="{poly([(-KA + 0.4, zl(-KA + 0.4)), (horn, zl(horn)), (horn, zl(horn) - bb), (-KA + 0.4, zl(-KA + 0.4) - bb)])}" fill="{WOOD["base"]}"/>'
            f'<path d="{poly([(KA + 0.4, zr(KA + 0.4)), (-horn, zr(-horn)), (-horn, zr(-horn) - bb), (KA + 0.4, zr(KA + 0.4) - bb)])}" fill="{WOOD["base"]}"/>'
            f'<path d="M{f(-KA + 0.4)},{f(zl(-KA + 0.4) - 0.3)} L{f(horn)},{f(zl(horn) - 0.3)}M{f(KA + 0.4)},{f(zr(KA + 0.4) - 0.3)} L{f(-horn)},{f(zr(-horn) - 0.3)}" stroke="#c99a6a" stroke-width="0.45"/>'
            f'<path d="M{f(-KA + 0.4)},{f(zl(-KA + 0.4) - bb)} L{f(0)},{f(zl(0) - bb)} L{f(KA + 0.4)},{f(zr(KA + 0.4) - bb)}" fill="none" stroke="#2e1f14" stroke-width="0.6" opacity="0.5"/>')
    c.add(c.on(c.m_bface(KB), rake))
    if ridge:
        log_b(c, 0, ZRID + 0.9, -KB - 0.5, KB + 1.2, 1.5, seed=seed)
    return ZRID


# ---------------------------------------------------------------------------
# Trees
# ---------------------------------------------------------------------------
def pine(c, a, b, h=56, w=None, seed=11, tiers=5, shadow=True):
    """Layered conifer: straight trunk, drooping tiers of needles, sunlit left flank."""
    x, y = c.P(a, b, 0)
    w = w or h * 0.3
    rnd = random.Random(seed)
    if shadow:
        iso.blob_shadow(c, a + h * 0.28, b - 1, w * 0.55, 0.3)
    c.add(f'<ellipse cx="{f(x + 0.6)}" cy="{f(y + 0.3)}" rx="{f(w * 0.28)}" ry="{f(w * 0.11)}" fill="#1f2e15" opacity="0.45" filter="{c.blur(0.45)}"/>'
          f'<path d="M{f(x - 1.6)},{f(y)} L{f(x - 0.8)},{f(y - h * 0.45)} L{f(x + 0.8)},{f(y - h * 0.45)} L{f(x + 1.6)},{f(y)}Z" fill="#5e4430"/>'
          f'<path d="M{f(x - 1.6)},{f(y)} L{f(x - 0.8)},{f(y - h * 0.45)} L{f(x - 0.2)},{f(y - h * 0.45)} L{f(x - 0.6)},{f(y)}Z" fill="#9a7656"/>')
    top = y - h
    g = c.lin(uid(c, "pine"), x - w, 0, x + w, 0, [(0, "#8fb158"), (0.3, "#5f8a3c"), (0.62, "#3b6330"), (1, "#213f22")])
    for i in reversed(range(tiers)):          # lower tiers first, upper skirts overlap them
        t0 = i / tiers
        ty = top + h * 0.78 * (t0 ** 1.05)               # tier apex
        by = top + h * (0.2 + 0.62 * (i + 1) / tiers)    # tier bottom
        hw = w * (0.35 + 0.65 * (i + 1) / tiers)
        sag = 1.6 + hw * 0.12
        d = (f"M{f(x)},{f(ty)} C{f(x + hw * 0.3)},{f(ty + (by - ty) * 0.4)} {f(x + hw * 0.8)},{f(by - sag)} {f(x + hw)},{f(by)} ")
        # scalloped lower edge from right to left
        n = 5
        for k in range(n):
            x1 = x + hw - 2 * hw * (k + 1) / n
            xm = x + hw - 2 * hw * (k + 0.5) / n
            d += f"Q{f(xm)},{f(by + sag * rnd.uniform(0.7, 1.2))} {f(x1)},{f(by - (0 if k == n - 1 else sag * 0.35))} "
        d += f"C{f(x - hw * 0.8)},{f(by - sag)} {f(x - hw * 0.3)},{f(ty + (by - ty) * 0.4)} {f(x)},{f(ty)}Z"
        c.add(f'<path d="{d}" fill="#1c331b" opacity="0.55" transform="translate(0.8 1.6)"/>'
              f'<path d="{d}" fill="{g}"/>')
        # needle strokes: light on the left flank, dark on the right
        out = []
        dl, dd = "", ""
        for _ in range(5 + i):
            u = rnd.uniform(-0.9, 0.9)
            v = rnd.uniform(0.35, 0.95)
            px = x + u * hw * v
            py = ty + (by - ty) * v
            seg = f"M{f(px)},{f(py - 1.6)}l{f(1.4 if u > 0 else -1.4)},1.8"
            if u < -0.15:
                dl += seg
            else:
                dd += seg
        for d_, col in ((dl, "#b4cf7a"), (dd, "#1e3a1e")):
            if d_:
                out.append(f'<path d="{d_}" stroke="{col}" stroke-width="0.6" stroke-linecap="round" opacity="0.65"/>')
        out.append(f'<path d="M{f(x - 0.4)},{f(ty + 1)} C{f(x - hw * 0.3)},{f(ty + (by - ty) * 0.45)} {f(x - hw * 0.7)},{f(by - sag * 1.2)} {f(x - hw * 0.9)},{f(by - 0.8)}" fill="none" stroke="#c6dc8e" stroke-width="0.7" opacity="0.55"/>')
        c.add("".join(out))


# ---------------------------------------------------------------------------
# Small things
# ---------------------------------------------------------------------------
def chips(c, a, b, r, n=14, seed=4):
    """Scattered light wood chips on the ground around (a, b)."""
    rnd = random.Random(seed)
    out = []
    for _ in range(n):
        ang = rnd.uniform(0, 2 * math.pi)
        rr = r * math.sqrt(rnd.random())
        x, y = c.P(a + rr * math.cos(ang), b + rr * math.sin(ang), 0)
        rot = rnd.uniform(-60, 60)
        out.append(f'<rect x="{f(x - 1)}" y="{f(y - 0.35)}" width="{f(rnd.uniform(1.4, 2.4))}" height="0.75" rx="0.3" fill="{rnd.choice(["#f0d6a4", "#e2bf86", "#c99a62"])}" transform="rotate({f(rot)} {f(x)} {f(y)})"/>')
    c.add("".join(out))


def ground_patch(c, a, b, ra, rb, colour, opacity=1.0, seed=1, blur=1.2):
    """Soft irregular patch on the grass (worn earth, gravel, dust), clipped to the base top."""
    x, y = c.P(a, b, 0)
    rx = (ra + rb) / 2 * math.sqrt(2)
    c.add(f'<g clip-path="{c.url("top")}"><path d="{puff(x, y, rx, rx / 2, n=11, seed=seed, bulge=1.12, jitter=0.18)}" fill="{colour}" opacity="{f(opacity)}" filter="{c.blur(blur)}"/></g>')


def pennant(c, x, y, length=10, height=4.5, pole=9, seed=1):
    """Short pole with a waving swallow-tail pennant (ACCENT) flying to the right.
    (x, y) = screen foot of the pole."""
    yt = y - pole
    c.add(f'<rect x="{f(x - 0.55)}" y="{f(yt)}" width="1.1" height="{f(pole)}" fill="{WOOD["dark"]}"/>'
          f'<rect x="{f(x - 0.55)}" y="{f(yt)}" width="0.4" height="{f(pole)}" fill="{WOOD["lit"]}"/>'
          f'<circle cx="{f(x)}" cy="{f(yt - 0.6)}" r="0.9" fill="{iso.GOLD["base"]}"/>')
    L, H = length, height
    d = (f"M{f(x + 0.5)},{f(yt)} C{f(x + L * 0.35)},{f(yt - 1.4)} {f(x + L * 0.65)},{f(yt + 1.2)} {f(x + L)},{f(yt + 0.2)} "
         f"L{f(x + L * 0.72)},{f(yt + H * 0.5)} L{f(x + L)},{f(yt + H * 0.95)} "
         f"C{f(x + L * 0.65)},{f(yt + H + 1)} {f(x + L * 0.35)},{f(yt + H - 1.2)} {f(x + 0.5)},{f(yt + H)}Z")
    fold = c.lin("pennant", 0, 0, 1, 0, [(0, ACCENT["light"]), (0.35, ACCENT["lit"]), (0.6, ACCENT["mid"]), (0.85, ACCENT["light"]), (1, ACCENT["shade"])], bbox=True)
    c.accent(f'<path d="{d}" fill="{fold}"/>')
    c.add(f'<path d="M{f(x + 0.5)},{f(yt + H)} C{f(x + L * 0.35)},{f(yt + H - 1.2)} {f(x + L * 0.65)},{f(yt + H + 1)} {f(x + L)},{f(yt + H * 0.95)}" fill="none" stroke="#1d2b36" stroke-width="0.6" opacity="0.25"/>')


# ---------------------------------------------------------------------------
# Rock: faceted convex boulders shaded by their facet normals
# ---------------------------------------------------------------------------
LIGHT = (-0.3, 0.45, 0.84)          # world light direction: tops lit, +b faces mid, +a faces shade
VIEW = (1.0, 1.0, 1.0 / ZS)         # toward the camera (projects to a single screen point)


def _sub(p, q):
    return (p[0] - q[0], p[1] - q[1], p[2] - q[2])


def _cross(u, v):
    return (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])


def _dot(u, v):
    return u[0] * v[0] + u[1] * v[1] + u[2] * v[2]


def _norm(u):
    m = math.sqrt(_dot(u, u)) or 1.0
    return (u[0] / m, u[1] / m, u[2] / m)


def hull3(points):
    """3D convex hull (brute force, fine for ~30 points): list of outward triangles (i, j, k)."""
    n = len(points)
    cen = tuple(sum(p[i] for p in points) / n for i in range(3))
    faces = []
    for i in range(n):
        for j in range(i + 1, n):
            for k in range(j + 1, n):
                nrm = _cross(_sub(points[j], points[i]), _sub(points[k], points[i]))
                if _dot(nrm, nrm) < 1e-9:
                    continue
                side = [_dot(nrm, _sub(points[m], points[i])) for m in range(n) if m not in (i, j, k)]
                if all(s <= 1e-7 for s in side) or all(s >= -1e-7 for s in side):
                    if _dot(nrm, _sub(cen, points[i])) > 0:
                        faces.append((i, k, j))
                    else:
                        faces.append((i, j, k))
    return faces


def _mix(c1, c2, t):
    a = [int(c1[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(c2[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(a[i] + (b[i] - a[i]) * t):02x}" for i in range(3))


def rock_colour(nrm, pal):
    """Facet colour from its normal: shade side cool and dark, lit tops bright and warm."""
    i = _dot(nrm, _norm(LIGHT))
    ramp = [(-0.5, pal["deep"]), (-0.15, pal["dark"]), (0.1, pal["shade"]), (0.35, pal["mid"]), (0.6, pal["lit"]), (0.95, pal["hi"])]
    if i <= ramp[0][0]:
        return ramp[0][1]
    for (t0, c0), (t1, c1) in zip(ramp, ramp[1:]):
        if i <= t1:
            return _mix(c0, c1, (i - t0) / (t1 - t0))
    return ramp[-1][1]


SNOW = {"deep": "#9fb0c2", "dark": "#aebdcc", "shade": "#c3cfdb", "mid": "#dfe6ee", "lit": "#f4f7fa", "hi": "#ffffff"}


def boulder(c, a, b, ra, rb, h, seed=1, pal=ROCK, n=16, flat_top=0.0, sink=0.0, ao=True, cracks=3, snow=None, cone=0.0):
    """Faceted convex rock standing on the ground at (a, b): half extents (ra, rb), height h.
    flat_top (0..1) squashes the upper points toward a plateau; sink lowers it into the ground;
    snow: facets whose centre lies above this height (and that face upward) get a snow cap;
    cone (0..1) blends the dome profile toward a cone (a mountain peak).
    Returns the list of screen points of its silhouette (for clipping or overlays)."""
    rnd = random.Random(seed)
    pts3 = []
    m = max(6, n // 2)
    for i in range(m):                                  # ground ring (slightly inset, irregular)
        t = 2 * math.pi * (i + rnd.uniform(-0.25, 0.25)) / m
        s = rnd.uniform(0.85, 1.0)
        pts3.append((a + ra * s * math.cos(t), b + rb * s * math.sin(t), -sink))
    for i in range(n - m):                              # upper shell
        t = rnd.uniform(0, 2 * math.pi)
        e = rnd.uniform(0.2, 1.0)                       # elevation 0..1
        dome = math.sqrt(max(0.0, 1 - e * e))
        rr = (dome * (1 - cone) + (1 - e) * cone) * rnd.uniform(0.75, 1.0) + 0.12
        z = h * (e if not flat_top else min(1.0, e * (1 + flat_top)))
        pts3.append((a + ra * rr * math.cos(t), b + rb * rr * math.sin(t), z * rnd.uniform(0.85, 1.0) - sink))
    pts3.append((a + rnd.uniform(-0.2, 0.2) * ra, b + rnd.uniform(-0.2, 0.2) * rb, h - sink))
    faces = hull3(pts3)
    vis = []
    for i, j, k in faces:
        p, q, r_ = pts3[i], pts3[j], pts3[k]
        nrm = _norm(_cross(_sub(q, p), _sub(r_, p)))
        if _dot(nrm, VIEW) > 1e-6:
            vis.append(((i, j, k), nrm))
    out = []
    scr = [c.P(*p) for p in pts3]
    for (i, j, k), nrm in vis:
        zc = (pts3[i][2] + pts3[j][2] + pts3[k][2]) / 3
        capped = snow is not None and zc >= snow and nrm[2] > 0.3
        col = rock_colour(nrm, SNOW if capped else pal)
        tone = rnd.uniform(-0.07, 0.07)                 # break up the flat facets a little
        col = _mix(col, "#ffffff" if tone > 0 else "#000000", abs(tone))
        d = poly([scr[i], scr[j], scr[k]])
        out.append(f'<path d="{d}" fill="{col}" stroke="{col}" stroke-width="0.35" stroke-linejoin="round"/>')
    sil = hull(scr)
    c.add("".join(out))
    if ao:
        ys = [p[1] for p in sil]
        y0, y1 = min(ys), max(ys)
        gid = uid(c, "rao")
        g = c.lin(gid, 0, y0, 0, y1, [(0, "#ffffff", 0.08), (0.45, "#ffffff", 0), (0.8, "#1d1a1a", 0.12), (1, "#1d1a1a", 0.4)])
        c.add(f'<path d="{poly(sil)}" fill="{g}"/>')
    # a few cracks on the lit facets
    lit = [(f_, nrm) for f_, nrm in vis if _dot(nrm, _norm(LIGHT)) > 0.3]
    d = ""
    for _ in range(min(cracks, len(lit))):
        (i, j, k), _n = rnd.choice(lit)
        p0 = scr[i]
        q = scr[j]
        w = rnd.uniform(0.3, 0.6)
        mx, my = p0[0] + (q[0] - p0[0]) * w, p0[1] + (q[1] - p0[1]) * w
        cx, cy = sum(scr[x][0] for x in (i, j, k)) / 3, sum(scr[x][1] for x in (i, j, k)) / 3
        d += f"M{f(mx)},{f(my)}L{f(cx + rnd.uniform(-1, 1))},{f(cy + rnd.uniform(-1, 1))}"
    if d:
        c.add(f'<path d="{d}" fill="none" stroke="{pal["deep"]}" stroke-width="0.5" opacity="0.45" stroke-linecap="round"/>')
    return sil


def rubble(c, items, pal=ROCK):
    """Small faceted stones: list of (a, b, r, seed)."""
    for a, b, r, seed in items:
        iso.blob_shadow(c, a + r * 0.6, b, r * 0.9, 0.3)
        boulder(c, a, b, r, r * 0.85, r * 0.9, seed=seed, pal=pal, n=9, ao=False, cracks=0)


# ---------------------------------------------------------------------------
# Dressed limestone: quarry terraces and blocks
# ---------------------------------------------------------------------------
def _joints(x0, x1, z0, z1, course, seed, wmin=6.0, wmax=11.0):
    """Block joint pattern of a cut stone face (face-local, y up): (course lines, joints)."""
    rnd = random.Random(seed)
    lines, joints = [], []
    z = z1
    k = 0
    while z - course > z0 + 1.5:
        z -= course
        lines.append(z)
    edges = [z1] + lines + [z0]
    for top, bot in zip(edges, edges[1:]):
        x = x0 + (rnd.uniform(0, wmin) if k % 2 else rnd.uniform(-1, 2))
        while x < x1 - 2:
            w = rnd.uniform(wmin, wmax)
            if x + w < x1 - 1.5 and x + w > x0 + 1.5:
                joints.append((x + w, bot, top))
            x += w
        k += 1
    return lines, joints


def cut_face(x0, x1, z0, z1, course, seed, lit=True, notches=0):
    """Markup of a quarried limestone face in face-local coords (fill, joints, tool marks)."""
    rnd = random.Random(seed + 100)
    L = LIMESTONE
    base_ = L["left"] if lit else L["right"]
    dark = "#8f7f62" if lit else "#6f6656"
    out = [f'<rect x="{f(x0)}" y="{f(z0)}" width="{f(x1 - x0)}" height="{f(z1 - z0)}" fill="{base_}"/>']
    lines, joints = _joints(x0, x1, z0, z1, course, seed)
    # per-block tone variation
    edges = [z1] + lines + [z0]
    tones = ""
    for top, bot in zip(edges, edges[1:]):
        xs = [x0] + sorted(j[0] for j in joints if abs(j[1] - bot) < 0.01) + [x1]
        for xa, xb in zip(xs, xs[1:]):
            if rnd.random() < 0.45:
                tones += f"M{f(xa)},{f(bot)}h{f(xb - xa)}v{f(top - bot)}h{f(xa - xb)}Z"
    if tones:
        out.append(f'<path d="{tones}" fill="{L["left2"] if lit else L["right2"]}" opacity="0.7"/>')
    d = "".join(f"M{f(x0)},{f(z)}H{f(x1)}" for z in lines) + "".join(f"M{f(x)},{f(bot)}V{f(top)}" for x, bot, top in joints)
    out.append(f'<path d="{d}" stroke="{dark}" stroke-width="0.6" opacity="0.75"/>')
    hi = "".join(f"M{f(x0)},{f(z - 0.55)}H{f(x1)}" for z in lines)
    out.append(f'<path d="{hi}" stroke="{L["hi"] if lit else "#d6cfc2"}" stroke-width="0.45" opacity="0.7"/>')
    # pick / chisel marks: short diagonal hatching in a few blocks
    hatch = ""
    for _ in range(int((x1 - x0) * (z1 - z0) / 60)):
        hx, hz = rnd.uniform(x0 + 1, x1 - 3), rnd.uniform(z0 + 1, z1 - 2)
        for i in range(3):
            hatch += f"M{f(hx + i * 0.9)},{f(hz)}l0.7,1.3"
    if hatch:
        out.append(f'<path d="{hatch}" stroke="{dark}" stroke-width="0.35" opacity="0.45"/>')
    # wedge slots where a block is being split off
    for _ in range(notches):
        z = rnd.choice(lines) if lines else (z0 + z1) / 2
        nx = rnd.uniform(x0 + 3, x1 - 9)
        out.append("".join(f'<rect x="{f(nx + i * 2.2)}" y="{f(z - 0.4)}" width="1" height="1.6" fill="#4a3f30" opacity="0.8"/>' for i in range(4)))
    ao = "#3b3426"
    out.append(f'<rect x="{f(x0)}" y="{f(z0)}" width="{f(x1 - x0)}" height="1.4" fill="{ao}" opacity="0.3"/>'
               f'<rect x="{f(x0)}" y="{f(z1 - 0.6)}" width="{f(x1 - x0)}" height="0.6" fill="{L["hi"] if lit else "#e3ddd0"}" opacity="0.9"/>')
    return "".join(out)


def terrace(c, a0, a1, b0, b1, z0, z1, course=7.0, seed=1, notches=1, top_fill=None):
    """One quarry terrace: a slab of limestone with cut +b (lit) and +a (shade) faces."""
    L = LIMESTONE
    c.add(c.on(c.m_ground(z1), f'<rect x="{f(a0)}" y="{f(b0)}" width="{f(a1 - a0)}" height="{f(b1 - b0)}" fill="{top_fill or L["top"]}"/>'))
    c.add(c.on(c.m_bface(b1), cut_face(a0, a1, z0, z1, course, seed, True, notches)))
    c.add(c.on(c.m_aface(a1), cut_face(-b1, -b0, z0, z1, course, seed + 7, False, 0)
               + f'<rect x="{f(-b1)}" y="{f(z0)}" width="0.7" height="{f(z1 - z0)}" fill="#f4eee0" opacity="0.6"/>'))


def stone_block(c, a, b, ha, hb, h, z0=0.0, seed=1, shadow=True):
    """Loose dressed block (centre a, b; half extents ha, hb; height h) with chisel marks."""
    if shadow:
        iso.cast_shadow(c, [(a + sa * ha, b + sb * hb) for sa in (-1, 1) for sb in (-1, 1)],
                        [(a + sa * ha, b + sb * hb, h + z0) for sa in (-1, 1) for sb in (-1, 1)], opacity=0.38, sd=1.2)
        if z0 == 0:
            iso.contact_ao(c, a - ha, a + ha, b - hb, b + hb, width=2, opacity=0.35)
    L = LIMESTONE
    rnd = random.Random(seed)
    tone = rnd.uniform(-0.05, 0.05)
    c.add(c.on(c.m_ground(z0 + h), f'<rect x="{f(a - ha)}" y="{f(b - hb)}" width="{f(2 * ha)}" height="{f(2 * hb)}" fill="{L["top"]}"/>'
               f'<rect x="{f(a - ha)}" y="{f(b - hb)}" width="{f(2 * ha)}" height="{f(2 * hb)}" fill="{"#fff" if tone > 0 else "#6b5b40"}" opacity="{f(abs(tone) * 3)}"/>'))
    hatch = "".join(f"M{f(a - ha + 1.5 + i * 1.6)},{f(z0 + h * 0.3)}l0.8,{f(h * 0.4)}" for i in range(int(ha * 1.1)))
    c.add(c.on(c.m_bface(b + hb), f'<rect x="{f(a - ha)}" y="{f(z0)}" width="{f(2 * ha)}" height="{f(h)}" fill="{L["left"]}"/>'
               f'<path d="{hatch}" stroke="#a8977a" stroke-width="0.35" opacity="0.6"/>'
               f'<rect x="{f(a - ha)}" y="{f(z0 + h - 0.5)}" width="{f(2 * ha)}" height="0.5" fill="{L["hi"]}"/>'
               f'<rect x="{f(a - ha)}" y="{f(z0)}" width="{f(2 * ha)}" height="0.9" fill="#3b3426" opacity="0.25"/>'))
    c.add(c.on(c.m_aface(a + ha), f'<rect x="{f(-b - hb)}" y="{f(z0)}" width="{f(2 * hb)}" height="{f(h)}" fill="{L["right"]}"/>'
               f'<rect x="{f(-b - hb)}" y="{f(z0 + h - 0.45)}" width="{f(2 * hb)}" height="0.45" fill="#e3ddd0"/>'
               f'<rect x="{f(-b - hb)}" y="{f(z0)}" width="0.5" height="{f(h)}" fill="#f4eee0" opacity="0.6"/>'))


def timber(c, p0, p1, w=1.6, col=None, lit=None):
    """Round timber pole between two world points (drawn in screen space with a lit edge)."""
    x0, y0 = c.P(*p0)
    x1, y1 = c.P(*p1)
    col = col or WOOD["base"]
    lit = lit or WOOD["lit"]
    dx, dy = x1 - x0, y1 - y0
    m = math.hypot(dx, dy) or 1
    ox, oy = -dy / m * w * 0.28, dx / m * w * 0.28       # offset toward the lit (left/upper) side
    if ox > 0:
        ox, oy = -ox, -oy
    c.add(f'<path d="M{f(x0)},{f(y0)}L{f(x1)},{f(y1)}" stroke="{WOOD["dark"]}" stroke-width="{f(w)}" stroke-linecap="round"/>'
          f'<path d="M{f(x0 + ox * 0.4)},{f(y0 + oy * 0.4)}L{f(x1 + ox * 0.4)},{f(y1 + oy * 0.4)}" stroke="{col}" stroke-width="{f(w * 0.6)}" stroke-linecap="round"/>'
          f'<path d="M{f(x0 + ox)},{f(y0 + oy)}L{f(x1 + ox)},{f(y1 + oy)}" stroke="{lit}" stroke-width="{f(w * 0.25)}" stroke-linecap="round" opacity="0.9"/>')


def rope(c, p0, p1, sag=0.0, w=0.55):
    """Hemp rope between two world points (optional sag in screen px)."""
    x0, y0 = c.P(*p0)
    x1, y1 = c.P(*p1)
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2 + sag
    c.add(f'<path d="M{f(x0)},{f(y0)}Q{f(mx)},{f(my)} {f(x1)},{f(y1)}" fill="none" stroke="#6e5638" stroke-width="{f(w)}"/>'
          f'<path d="M{f(x0 - 0.2)},{f(y0)}Q{f(mx - 0.2)},{f(my)} {f(x1 - 0.2)},{f(y1)}" fill="none" stroke="#c9ab7a" stroke-width="{f(w * 0.4)}" opacity="0.8"/>')


def wheel_b(c, a, b, z, r, spokes=6, dark=False):
    """Spoked cart wheel in the plane b (facing +b); dark=True for the far wheel."""
    rim = WOOD["dark"] if dark else WOOD["base"]
    rim_hi = WOOD["base"] if dark else WOOD["lit"]
    sp = "".join(f"M0,0L{f(r * 0.82 * math.cos(2 * math.pi * i / spokes + 0.3))},{f(r * 0.82 * math.sin(2 * math.pi * i / spokes + 0.3))}" for i in range(spokes))
    c.add(c.on(c.m_bface(b), f'<g transform="translate({f(a)} {f(z)})">'
               f'<circle r="{f(r)}" fill="none" stroke="{WOOD["deep"]}" stroke-width="{f(r * 0.32)}"/>'
               f'<circle r="{f(r)}" fill="none" stroke="{rim}" stroke-width="{f(r * 0.22)}"/>'
               f'<path d="M{f(-r * 0.7)},{f(r * 0.7)}A{f(r)},{f(r)} 0 0 1 {f(r * 0.7)},{f(r * 0.7)}" fill="none" stroke="{rim_hi}" stroke-width="{f(r * 0.08)}" transform="translate(0 {f(r * 0.05)})"/>'
               f'<path d="{sp}" stroke="{rim}" stroke-width="{f(r * 0.13)}"/>'
               f'<circle r="{f(r * 0.2)}" fill="{WOOD["dark"]}"/><circle r="{f(r * 0.09)}" fill="#2a2420"/></g>'))


def cart_a(c, a, b, load=None, seed=3):
    """Two-wheeled hand cart, bed along a, shafts toward +a resting on the ground.
    load(c, top_z) draws what lies on the bed (called with the cart's origin at the bed centre)."""
    W = WOOD
    with c.at(a, b, 0):
        iso.blob_shadow(c, 3, 0, 9, 0.35)
        wheel_b(c, 0, -5.4, 4.6, 4.6, dark=True)
        # shafts
        timber(c, (7, -3.4, 4.8), (17, -3.4, 0.6), w=1.2)
        iso.box(c, -8, 8, -4.6, 4.6, 4.2, 5.4, W["lit"], W["base"], W["dark"], edge="#c99a6a")
        c.add(c.on(c.m_bface(4.6), "".join(f'<rect x="{f(-8 + i * 3.2)}" y="4.2" width="0.35" height="1.2" fill="{W["deep"]}" opacity="0.6"/>' for i in range(1, 5))))
        if load:
            load(c, 5.4)
        # side board on the near side
        iso.box(c, -8, 8, 4.6, 5.4, 4.2, 7.2, W["lit"], W["base"], W["dark"], edge="#d8ab78")
        timber(c, (7, 4.4, 4.8), (17, 4.4, 0.6), w=1.2)
        wheel_b(c, 0, 5.8, 4.6, 4.6)


# ---------------------------------------------------------------------------
# Mining: rails, ore tub, lantern, pick
# ---------------------------------------------------------------------------
ORE = ["#5a524e", "#6e625a", "#7d4a32", "#a0603a", "#4f6a5e", "#3e3a3a"]


def rails_b(c, a, b0, b1, gauge=7.0, step=4.4, seed=2):
    """Mine track along b at centre a: wooden sleepers and two iron rails."""
    rnd = random.Random(seed)
    W = WOOD
    ha = gauge / 2 + 2.2
    b = b0
    while b < b1:
        jit = rnd.uniform(-0.6, 0.6)
        iso.box(c, a - ha + jit, a + ha + jit, b - 0.9, b + 0.9, 0, 0.9, W["lit"], W["base"], W["dark"])
        b += step
    for ra in (a - gauge / 2, a + gauge / 2):
        c.add(c.on(c.m_ground(1.5), f'<rect x="{f(ra - 0.5)}" y="{f(b0 - 1)}" width="1" height="{f(b1 - b0 + 1)}" fill="{IRON["lit"]}"/>'
                   f'<rect x="{f(ra - 0.5)}" y="{f(b0 - 1)}" width="0.35" height="{f(b1 - b0 + 1)}" fill="{IRON["hi"]}"/>'))
        c.add(c.on(c.m_aface(ra + 0.5), f'<rect x="{f(-b1)}" y="0.9" width="{f(b1 - b0 + 1)}" height="0.6" fill="{IRON["dark"]}"/>'))


def heap(c, x, y, rx, hgt, pal=ROCK, lumps=None, seed=5, n=18, ry=None):
    """Mound of loose stones / ore in screen space: foot centre (x, y), half width rx, height hgt.
    lumps: colours of the stones on the surface (default: the palette's rock tones)."""
    rnd = random.Random(seed)
    ry = ry if ry is not None else rx * 0.42
    lumps = lumps or [pal["lit"], pal["mid"], pal["mid"], pal["shade"]]
    gid = uid(c, "heap")
    g = c.lin(gid, x - rx, y - hgt, x + rx, y, [(0, pal["lit"]), (0.45, pal["mid"]), (1, pal["dark"])])
    d = (f"M{f(x - rx)},{f(y)} C{f(x - rx * 0.75)},{f(y - hgt * 0.75)} {f(x - rx * 0.3)},{f(y - hgt)} {f(x)},{f(y - hgt)} "
         f"C{f(x + rx * 0.35)},{f(y - hgt)} {f(x + rx * 0.8)},{f(y - hgt * 0.7)} {f(x + rx)},{f(y)} "
         f"A{f(rx)},{f(ry)} 0 0 1 {f(x - rx)},{f(y)}Z")
    out = [f'<path d="{d}" fill="{g}"/>']
    st = []
    for _ in range(n):
        u = rnd.uniform(-0.85, 0.85)
        top = y - hgt * (1 - u * u) ** 0.9
        bot = y + ry * math.sqrt(max(0, 1 - u * u)) * 0.8
        py = top + (bot - top) * rnd.random() ** 1.3
        st.append((py, x + u * rx, rnd.uniform(0.9, 1.8), rnd.choice(lumps)))
    for py, px, r, col in sorted(st):
        out.append(f'<ellipse cx="{f(px + r * 0.25)}" cy="{f(py + r * 0.3)}" rx="{f(r)}" ry="{f(r * 0.6)}" fill="#1d1a1a" opacity="0.25"/>'
                   f'<ellipse cx="{f(px)}" cy="{f(py)}" rx="{f(r)}" ry="{f(r * 0.72)}" fill="{col}"/>'
                   f'<ellipse cx="{f(px - r * 0.3)}" cy="{f(py - r * 0.3)}" rx="{f(r * 0.45)}" ry="{f(r * 0.28)}" fill="#ffffff" opacity="0.18"/>')
    c.add("".join(out))


ORE_PAL = {"hi": "#9a8a80", "lit": "#7a6a62", "mid": "#5e524e", "shade": "#46403e", "dark": "#2f2b2a", "deep": "#1f1c1c"}


def ore_heap(c, x, y, rx, hgt, seed=5, n=16):
    """Heap of ore (copper and tin: rusty, greenish and dark lumps) with a few glints."""
    heap(c, x, y, rx, hgt, ORE_PAL, lumps=ORE, seed=seed, n=n)
    rnd = random.Random(seed + 1)
    c.add("".join(f'<circle cx="{f(x + rnd.uniform(-rx * 0.6, rx * 0.6))}" cy="{f(y - rnd.uniform(0.2, 0.8) * hgt)}" r="0.5" fill="#ffe0a8"/>' for _ in range(5)))


def ore_tub(c, a, b, gauge=7.0):
    """Wooden mine tub on four iron wheels, running along b, heaped with ore."""
    W = WOOD
    ha, hb = gauge / 2 + 1.2, 5.2
    with c.at(a, b, 0):
        iso.blob_shadow(c, 3, 0, 7, 0.4)
        z0, z1 = 2.6, 9.6
        for bb in (-3.2, 3.2):        # far wheels (a = -gauge/2) peek out
            x, y = c.P(-gauge / 2, bb, 2.2)
            c.add(f'<circle cx="{f(x)}" cy="{f(y)}" r="2.2" fill="#2f2b28"/>')
        iso.box(c, -ha, ha, -hb, hb, z0, z1, "#3a3230", W["base"], W["dark"], edge="#c99a6a")
        # planks and iron bands
        c.add(c.on(c.m_bface(hb), f'<path d="M{f(-ha)},{f(z0 + 2.4)}H{f(ha)}M{f(-ha)},{f(z0 + 4.8)}H{f(ha)}" stroke="{W["deep"]}" stroke-width="0.4" opacity="0.6"/>'
                   + "".join(f'<rect x="{f(x - 0.6)}" y="{f(z0)}" width="1.2" height="{f(z1 - z0)}" fill="{IRON["dark"]}"/><rect x="{f(x - 0.6)}" y="{f(z0)}" width="0.4" height="{f(z1 - z0)}" fill="{IRON["lit"]}"/>' for x in (-ha + 1.4, ha - 1.4))
                   + f'<rect x="{f(-ha)}" y="{f(z1 - 1)}" width="{f(2 * ha)}" height="1" fill="{IRON["base"]}"/>'))
        c.add(c.on(c.m_aface(ha), f'<path d="M{f(-hb)},{f(z0 + 2.4)}H{f(hb)}M{f(-hb)},{f(z0 + 4.8)}H{f(hb)}" stroke="{W["deep"]}" stroke-width="0.4" opacity="0.6"/>'
                   + "".join(f'<rect x="{f(x - 0.6)}" y="{f(z0)}" width="1.2" height="{f(z1 - z0)}" fill="{IRON["dark"]}"/>' for x in (-hb + 1.4, hb - 1.4))
                   + f'<rect x="{f(-hb)}" y="{f(z1 - 1)}" width="{f(2 * hb)}" height="1" fill="{IRON["base"]}"/>'))
        x, y = c.P(0, 0, z1)
        ore_heap(c, x + 0.5, y + 2.2, ha * 1.6, 6.5, seed=9, n=18)
        for bb in (-3.2, 3.2):        # near wheels on the +a side
            c.add(c.on(c.m_aface(ha + 0.3), f'<circle cx="{f(-bb)}" cy="2.2" r="2.3" fill="#3b3734"/><circle cx="{f(-bb)}" cy="2.2" r="1.5" fill="{IRON["base"]}"/><circle cx="{f(-bb)}" cy="2.2" r="0.6" fill="#2a2624"/>'))


def lantern(c, x, y, k=1.0, glow=14):
    """Small hanging bronze lantern with a warm glow; (x, y) = screen point of its hook."""
    g = c.rad(uid(c, "lglow"), x, y + 4 * k, glow * k, [(0, "#ffe7a6", 0.75), (0.35, "#ffc061", 0.32), (1, "#ff9a3c", 0)])
    c.add(f'<circle cx="{f(x)}" cy="{f(y + 4 * k)}" r="{f(glow * k)}" fill="{g}"/>'
          f'<path d="M{f(x)},{f(y)} L{f(x)},{f(y + 1.3 * k)}" stroke="#3b3430" stroke-width="0.5"/>'
          f'<path d="M{f(x - 1.6 * k)},{f(y + 2 * k)} L{f(x + 1.6 * k)},{f(y + 2 * k)} L{f(x + 2 * k)},{f(y + 6.4 * k)} L{f(x - 2 * k)},{f(y + 6.4 * k)}Z" fill="#ffd27a"/>'
          f'<path d="M{f(x - 1.6 * k)},{f(y + 2 * k)} L{f(x + 1.6 * k)},{f(y + 2 * k)} L{f(x)},{f(y + 0.9 * k)}Z" fill="{iso.BRONZE["base"]}"/>'
          f'<path d="M{f(x - 2.2 * k)},{f(y + 6.4 * k)} L{f(x + 2.2 * k)},{f(y + 6.4 * k)} L{f(x + 1.6 * k)},{f(y + 7.4 * k)} L{f(x - 1.6 * k)},{f(y + 7.4 * k)}Z" fill="{iso.BRONZE["shade"]}"/>'
          f'<path d="M{f(x)},{f(y + 2 * k)} L{f(x)},{f(y + 6.4 * k)}" stroke="{iso.BRONZE["shade"]}" stroke-width="0.5"/>'
          f'<ellipse cx="{f(x)}" cy="{f(y + 4.6 * k)}" rx="{f(0.7 * k)}" ry="{f(1.1 * k)}" fill="#fff6d8"/>')


def pickaxe(c, x, y, k=1.0):
    """Pickaxe leaning against a wall: handle foot at screen (x, y), head up to the right."""
    hx, hy = x + 3.2 * k, y - 13 * k
    c.add(f'<path d="M{f(x)},{f(y)} L{f(hx)},{f(hy)}" stroke="{WOOD["dark"]}" stroke-width="{f(1.3 * k)}" stroke-linecap="round"/>'
          f'<path d="M{f(x - 0.3)},{f(y - 0.4)} L{f(hx - 0.3)},{f(hy)}" stroke="{WOOD["lit"]}" stroke-width="{f(0.45 * k)}"/>'
          f'<path d="M{f(hx - 5 * k)},{f(hy + 2.4 * k)} Q{f(hx)},{f(hy - 2.2 * k)} {f(hx + 5.2 * k)},{f(hy + 1.6 * k)} L{f(hx + 4.6 * k)},{f(hy + 2.4 * k)} Q{f(hx)},{f(hy - 0.4 * k)} {f(hx - 4.4 * k)},{f(hy + 3.2 * k)}Z" fill="{IRON["base"]}"/>'
          f'<path d="M{f(hx - 5 * k)},{f(hy + 2.4 * k)} Q{f(hx)},{f(hy - 2.2 * k)} {f(hx + 5.2 * k)},{f(hy + 1.6 * k)}" fill="none" stroke="{IRON["hi"]}" stroke-width="0.4"/>')


# ---------------------------------------------------------------------------
# Rock ledge: an irregular prism with vertical sides (a cut rock face, a cliff step)
# ---------------------------------------------------------------------------
def rock_prism(c, foot, z0, z1, pal=ROCK, seed=1, top=None, tufts=0, snow=False, cracks=2, zj=1.2):
    """One rock ledge: vertical sides on a convex footprint [(a, b)] from z0 to z1 (each top
    corner jittered by up to zj), shaded per side by its normal, with a lit top.
    top: fill of the top (default from the palette); tufts: grass tufts on the top; snow: snowy top."""
    rnd = random.Random(seed)
    n = len(foot)
    ca = sum(p[0] for p in foot) / n
    cb = sum(p[1] for p in foot) / n
    zt = [z1 + rnd.uniform(-zj, zj) for _ in range(n)]
    over = c.lin("ledge", 0, 0, 0, 1, [(0, "#ffffff", 0.14), (0.25, "#ffffff", 0), (0.75, "#1d1a1a", 0.1), (1, "#1d1a1a", 0.32)], bbox=True)
    out, crack = [], ""
    for i in range(n):
        p, q = foot[i], foot[(i + 1) % n]
        na, nb = q[1] - p[1], -(q[0] - p[0])            # one of the two normals
        if na * (p[0] - ca) + nb * (p[1] - cb) < 0:
            na, nb = -na, -nb                            # make it point outward
        if na + nb <= 0:
            continue                                     # faces away from the camera
        nrm = _norm((na, nb, 0.0))
        col = rock_colour(nrm, pal)
        quad = [c.P(p[0], p[1], z0), c.P(q[0], q[1], z0), c.P(q[0], q[1], zt[(i + 1) % n]), c.P(p[0], p[1], zt[i])]
        d = poly(quad)
        out.append(f'<path d="{d}" fill="{col}" stroke="{col}" stroke-width="0.3"/><path d="{d}" fill="{over}"/>')
        # lit lip along the top edge, vertical cracks
        out.append(f'<path d="M{f(quad[3][0])},{f(quad[3][1] + 0.5)}L{f(quad[2][0])},{f(quad[2][1] + 0.5)}" stroke="{_mix(col, "#ffffff", 0.35)}" stroke-width="0.7"/>')
        L = math.hypot(q[0] - p[0], q[1] - p[1])
        for _ in range(int(L / 9) + (1 if cracks and L > 6 else 0)):
            t = rnd.uniform(0.15, 0.85)
            x, y = c.P(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, z0)
            hgt = (z1 - z0) * rnd.uniform(0.35, 0.85) * ZS
            yt = y - (z1 - z0) * ZS * rnd.uniform(0.9, 1.0)
            crack += f"M{f(x)},{f(yt + 0.8)}l{f(rnd.uniform(-1, 1))},{f(hgt * 0.5)}l{f(rnd.uniform(-1, 1))},{f(hgt * 0.5)}"
    if crack:
        out.append(f'<path d="{crack}" fill="none" stroke="{pal["deep"]}" stroke-width="0.5" opacity="0.4" stroke-linecap="round"/>')
    tp = [c.P(p[0], p[1], zt[i]) for i, p in enumerate(foot)]
    tcol = top or (SNOW["lit"] if snow else rock_colour((0.0, 0.0, 1.0), pal))
    out.append(f'<path d="{poly(tp)}" fill="{tcol}"/>')
    if snow:
        out.append(f'<path d="{poly(tp)}" fill="url(#{c.id("snowtop")})"/>')
        c.rad("snowtop", 0.3, 0.3, 0.9, [(0, "#ffffff", 0.9), (0.6, "#ffffff", 0), (1, "#9fb0c2", 0.35)], bbox=True)
    c.add("".join(out))
    if tufts:
        g = []
        for _ in range(tufts):
            u, v = rnd.random(), rnd.random()
            i = rnd.randrange(n)
            p, q = foot[i], foot[(i + 1) % n]
            # a point near the front half of the top, between the centre and an edge
            ta, tb = ca + (p[0] + (q[0] - p[0]) * u - ca) * (0.4 + 0.5 * v), cb + (p[1] + (q[1] - p[1]) * u - cb) * (0.4 + 0.5 * v)
            x, y = c.P(ta, tb, z1)
            g.append(iso.grass_tuft(x, y, rnd.uniform(2, 3.4), rnd.choice(["#6c9a38", "#86b447", "#5f8f30"]), sw=0.75))
        c.add("".join(g))
    return tp


# ---------------------------------------------------------------------------
# Farm: wheat rows, stubble, sheaves, haystack, scarecrow, sacks
# ---------------------------------------------------------------------------
def wheat_field(c, a0, a1, b0, b1, h=6.5, pitch=4.2, seed=3):
    """Standing grain as one soft block: a golden top striped by its rows (running along b),
    stalk faces at the lit front (+b) and the shaded side (+a), ears fringing the top edges."""
    rnd = random.Random(seed)
    Wt = WHEAT
    # side (+a, shade) and front (+b, lit) stalk faces
    side_g = c.lin("wside", 0, 0, 0, 1, [(0, "#6b5a26"), (0.45, Wt["shade"]), (1, Wt["mid"])], bbox=True)
    front_g = c.lin("wfront", 0, 0, 0, 1, [(0, "#8a7434"), (0.4, Wt["mid"]), (1, Wt["lit"])], bbox=True)
    st = "".join(f"M{f(-b1 + t)},0.4V{f(h - rnd.uniform(0.3, 1.2))}" for t in [i * 1.1 for i in range(1, int((b1 - b0) / 1.1))])
    c.add(c.on(c.m_aface(a1), f'<rect x="{f(-b1)}" y="0" width="{f(b1 - b0)}" height="{f(h)}" fill="{side_g}"/>'
               f'<path d="{st}" stroke="#4e4018" stroke-width="0.4" opacity="0.5"/>'))
    st = "".join(f"M{f(a0 + t)},0.4V{f(h - rnd.uniform(0.3, 1.2))}" for t in [i * 1.1 for i in range(1, int((a1 - a0) / 1.1))])
    c.add(c.on(c.m_bface(b1), f'<rect x="{f(a0)}" y="0" width="{f(a1 - a0)}" height="{f(h)}" fill="{front_g}"/>'
               f'<path d="{st}" stroke="#6e5a22" stroke-width="0.4" opacity="0.55"/>'))
    # top: rows as soft stripes, furrow shadows, scattered ears
    top_g = c.rad("wtop", 0.25, 0.3, 0.95, [(0, Wt["hi"]), (0.55, Wt["lit"]), (1, Wt["base"])], bbox=True)
    rows_hi, furrows, ears = [], "", ""
    a = a0 + pitch * 0.5
    while a < a1 - 0.5:
        rows_hi.append((a - pitch * 0.32, b0, pitch * 0.28, b1 - b0))
        furrows += f"M{f(a + pitch * 0.5)},{f(b0)}V{f(b1)}"
        a += pitch
    for _ in range(int((a1 - a0) * (b1 - b0) / 9)):
        ea, eb = rnd.uniform(a0 + 0.5, a1 - 0.5), rnd.uniform(b0 + 0.5, b1 - 0.5)
        ears += f"M{f(ea)},{f(eb)}l0.9,-0.6"
    c.add(c.on(c.m_ground(h), f'<rect x="{f(a0)}" y="{f(b0)}" width="{f(a1 - a0)}" height="{f(b1 - b0)}" fill="{top_g}"/>'
               f'<path d="{_rects_path(rows_hi)}" fill="#fff4c4" opacity="0.55"/>'
               f'<path d="{furrows}" stroke="{Wt["shade"]}" stroke-width="1.2" opacity="0.6"/>'
               f'<path d="{ears}" stroke="{Wt["dark"]}" stroke-width="0.45" stroke-linecap="round" opacity="0.35"/>'))
    # fringe of ears standing up along the front and side top edges
    fr = ""
    frs = ""
    a = a0 + 0.6
    while a < a1:
        x, y = c.P(a, b1, h)
        fr += f"M{f(x)},{f(y + 0.6)}l{f(rnd.uniform(-0.5, 0.2))},{f(-rnd.uniform(1.6, 2.6))}"
        a += rnd.uniform(0.9, 1.4)
    b = b0 + 0.6
    while b < b1:
        x, y = c.P(a1, b, h)
        frs += f"M{f(x)},{f(y + 0.6)}l{f(rnd.uniform(-0.2, 0.5))},{f(-rnd.uniform(1.6, 2.6))}"
        b += rnd.uniform(0.9, 1.4)
    c.add(f'<path d="{fr}" stroke="{Wt["lit"]}" stroke-width="1.1" stroke-linecap="round"/>'
          f'<path d="{frs}" stroke="{Wt["base"]}" stroke-width="1.1" stroke-linecap="round"/>')
    # a few red poppies peeking out along the front edge
    pop = ""
    for _ in range(int((a1 - a0) / 7)):
        x, y = c.P(rnd.uniform(a0 + 2, a1 - 2), b1, h + rnd.uniform(0.6, 1.8))
        pop += f'<circle cx="{f(x)}" cy="{f(y)}" r="0.95" fill="#d8392f"/><circle cx="{f(x - 0.3)}" cy="{f(y - 0.3)}" r="0.35" fill="#ff8a6a"/>'
    c.add(pop)


def stubble(c, a0, a1, b0, b1, seed=4):
    """Harvested field: pale stubble rows on brown earth."""
    rnd = random.Random(seed)
    c.add(c.on(c.m_ground(0), f'<rect x="{f(a0)}" y="{f(b0)}" width="{f(a1 - a0)}" height="{f(b1 - b0)}" rx="2" fill="#b89462"/>'
               f'<rect x="{f(a0)}" y="{f(b0)}" width="{f(a1 - a0)}" height="{f(b1 - b0)}" rx="2" fill="url(#{c.id("stubg")})"/>'))
    c.rad("stubg", 0.3, 0.3, 0.9, [(0, "#f2d999", 0.35), (1, "#6e5220", 0.25)], bbox=True)
    rows = ""
    hi = ""
    a = a0 + 1.6
    while a < a1 - 1:
        b = b0 + 1
        while b < b1 - 1:
            x, y = c.P(a + rnd.uniform(-0.3, 0.3), b, 0)
            hgt = rnd.uniform(1.2, 2)
            rows += f"M{f(x)},{f(y)}l{f(rnd.uniform(-0.3, 0.3))},{f(-hgt)}"
            if rnd.random() < 0.4:
                hi += f"M{f(x + 0.6)},{f(y)}l0.2,{f(-hgt * 0.8)}"
            b += 2.2
        a += 3.6
    c.add(f'<path d="{rows}" stroke="#7a5e2e" stroke-width="0.5" stroke-linecap="round"/>'
          f'<path d="{hi}" stroke="#f4dc9c" stroke-width="0.45" stroke-linecap="round"/>')


def sheaf(c, a, b, k=1.0, seed=1):
    """Stook of grain sheaves: a golden bundle tied at the waist, ears fanned out on top."""
    x, y = c.P(a, b, 0)
    iso.blob_shadow(c, a + 4 * k, b, 3.4 * k, 0.35)
    rnd = random.Random(seed)
    g = c.lin("sheaf", 0, 0, 1, 0, [(0, WHEAT["hi"]), (0.4, WHEAT["lit"]), (0.75, WHEAT["base"]), (1, WHEAT["shade"])], bbox=True)
    body = (f"M{f(x - 4.2 * k)},{f(y)} L{f(x - 1.6 * k)},{f(y - 7 * k)} L{f(x - 3.6 * k)},{f(y - 12 * k)} "
            f"Q{f(x)},{f(y - 15.5 * k)} {f(x + 3.6 * k)},{f(y - 12 * k)} L{f(x + 1.6 * k)},{f(y - 7 * k)} L{f(x + 4.2 * k)},{f(y)} "
            f"Q{f(x)},{f(y + 1.4 * k)} {f(x - 4.2 * k)},{f(y)}Z")
    st = "".join(f"M{f(x + t * 3.6 * k)},{f(y - 0.4)}L{f(x + t * 1.4 * k)},{f(y - 7 * k)}" for t in (-0.8, -0.4, 0, 0.4, 0.8))
    st += "".join(f"M{f(x + t * 1.4 * k)},{f(y - 7 * k)}L{f(x + t * 3.2 * k)},{f(y - 12 * k)}" for t in (-0.8, -0.3, 0.2, 0.7))
    ears = "".join(f'<ellipse cx="{f(x + rnd.uniform(-3, 3) * k)}" cy="{f(y - rnd.uniform(11.5, 14.5) * k)}" rx="{f(0.7 * k)}" ry="{f(1.5 * k)}" fill="{WHEAT["mid"]}" transform="rotate({f(rnd.uniform(-35, 35))} {f(x)} {f(y - 13 * k)})"/>' for _ in range(7))
    c.add(f'<path d="{body}" fill="{g}"/><path d="{st}" stroke="{WHEAT["shade"]}" stroke-width="0.4" opacity="0.7"/>{ears}'
          f'<path d="M{f(x - 1.7 * k)},{f(y - 7 * k)} Q{f(x)},{f(y - 6.2 * k)} {f(x + 1.7 * k)},{f(y - 7 * k)}" fill="none" stroke="{WOOD["dark"]}" stroke-width="{f(0.9 * k)}"/>')


def haystack(c, a, b, r=10, h=24, seed=2):
    """Round haystack around a pole: golden dome with straw strokes and a darker weathered cap."""
    x, y = c.P(a, b, 0)
    rx = r * math.sqrt(2)
    ry = rx / 2
    iso.blob_shadow(c, a + h * 0.35, b - 1, r * 0.9, 0.35)
    hh = h * ZS
    g = c.lin(uid(c, "hay"), x - rx, 0, x + rx, 0, [(0, WHEAT["hi"]), (0.3, WHEAT["lit"]), (0.65, WHEAT["base"]), (1, WHEAT["shade"])])
    d = (f"M{f(x - rx)},{f(y)} C{f(x - rx * 1.05)},{f(y - hh * 0.55)} {f(x - rx * 0.55)},{f(y - hh * 0.95)} {f(x)},{f(y - hh)} "
         f"C{f(x + rx * 0.55)},{f(y - hh * 0.95)} {f(x + rx * 1.05)},{f(y - hh * 0.55)} {f(x + rx)},{f(y)} A{f(rx)},{f(ry)} 0 0 1 {f(x - rx)},{f(y)}Z")
    rnd = random.Random(seed)
    st = ""
    for _ in range(40):
        u = rnd.uniform(-0.9, 0.9)
        v = rnd.uniform(0.05, 0.9)
        px = x + u * rx * (1 - v * v * 0.7)
        py = y - hh * v + ry * 0.6 * math.sqrt(max(0, 1 - u * u)) * (1 - v)
        st += f"M{f(px)},{f(py)}l{f(u * 1.2)},{f(1.6)}"
    c.add(f'<path d="M{f(x - 0.6)},{f(y - hh - 5)} L{f(x + 0.6)},{f(y - hh - 5)} L{f(x + 0.6)},{f(y - hh + 2)} L{f(x - 0.6)},{f(y - hh + 2)}Z" fill="{WOOD["dark"]}"/>'
          f'<path d="{d}" fill="{g}"/>'
          f'<path d="{st}" stroke="{WHEAT["shade"]}" stroke-width="0.45" opacity="0.55" stroke-linecap="round"/>'
          f'<path d="M{f(x - rx * 0.62)},{f(y - hh * 0.78)} Q{f(x)},{f(y - hh * 0.62)} {f(x + rx * 0.62)},{f(y - hh * 0.78)}" fill="none" stroke="{WHEAT["dark"]}" stroke-width="0.6" opacity="0.5"/>'
          f'<path d="M{f(x - rx * 0.8)},{f(y - hh * 0.2)} C{f(x - rx * 0.85)},{f(y - hh * 0.6)} {f(x - rx * 0.45)},{f(y - hh * 0.88)} {f(x - rx * 0.1)},{f(y - hh * 0.95)}" fill="none" stroke="#fff4cc" stroke-width="0.9" opacity="0.6"/>'
          f'<path d="M{f(x - rx)},{f(y)} A{f(rx)},{f(ry)} 0 0 0 {f(x + rx)},{f(y)}" fill="none" stroke="#6e5220" stroke-width="1.2" opacity="0.35"/>')


def scarecrow(c, x, y, k=1.0):
    """Scarecrow standing at screen point (x, y): stick cross, straw hat, tunic in ACCENT."""
    W = WOOD
    c.add(f'<path d="M{f(x)},{f(y)} L{f(x)},{f(y - 24 * k)}" stroke="{W["dark"]}" stroke-width="{f(1.3 * k)}"/>'
          f'<path d="M{f(x - 0.35)},{f(y)} L{f(x - 0.35)},{f(y - 24 * k)}" stroke="{W["lit"]}" stroke-width="{f(0.4 * k)}"/>'
          f'<path d="M{f(x - 9 * k)},{f(y - 18.5 * k)} L{f(x + 9 * k)},{f(y - 17 * k)}" stroke="{W["dark"]}" stroke-width="{f(1.2 * k)}" stroke-linecap="round"/>')
    # tunic (owner colour) with sleeves along the arm stick
    tun = (f"M{f(x - 8.4 * k)},{f(y - 19.6 * k)} L{f(x + 8.4 * k)},{f(y - 18.2 * k)} L{f(x + 8.2 * k)},{f(y - 15.6 * k)} L{f(x + 3.6 * k)},{f(y - 15.8 * k)} "
           f"L{f(x + 4.4 * k)},{f(y - 8 * k)} Q{f(x + 0.4 * k)},{f(y - 6.6 * k)} {f(x - 4.2 * k)},{f(y - 8.2 * k)} L{f(x - 3.4 * k)},{f(y - 16.4 * k)} "
           f"L{f(x - 8.2 * k)},{f(y - 16.8 * k)}Z")
    g = c.lin("tunic", 0, 0, 1, 0, [(0, ACCENT["lit"]), (0.45, ACCENT["light"]), (0.8, ACCENT["mid"]), (1, ACCENT["shade"])], bbox=True)
    c.accent(f'<path d="{tun}" fill="{g}"/>')
    c.add(f'<path d="M{f(x - 3.8 * k)},{f(y - 11 * k)} L{f(x + 4 * k)},{f(y - 10.6 * k)}" stroke="{W["dark"]}" stroke-width="{f(0.8 * k)}"/>'
          f'<path d="M{f(x + 1.2 * k)},{f(y - 15.8 * k)} L{f(x + 1.6 * k)},{f(y - 7.4 * k)}" stroke="#1d2b36" stroke-width="{f(0.5 * k)}" opacity="0.25"/>')
    # straw tufts at the cuffs and the hem
    tuft = "".join(f"M{f(x + sx * k)},{f(y + sy * k)}l{f(dx * k)},{f(dy * k)}" for sx, sy, dx, dy in
                   [(-8.4, -18, -1.6, 0.6), (-8.4, -18, -1.4, 1.6), (8.4, -16.8, 1.6, 0.4), (8.4, -16.8, 1.2, 1.8), (-2, -7.8, -0.4, 2), (1, -7.2, 0.3, 2.2), (3.4, -7.8, 0.8, 1.8)])
    c.add(f'<path d="{tuft}" stroke="{WHEAT["lit"]}" stroke-width="{f(0.6 * k)}" stroke-linecap="round"/>')
    # sack head and straw hat
    c.add(f'<circle cx="{f(x)}" cy="{f(y - 22.4 * k)}" r="{f(2.8 * k)}" fill="#d8c49a"/><circle cx="{f(x + 0.8 * k)}" cy="{f(y - 22 * k)}" r="{f(2 * k)}" fill="#bca77a" opacity="0.6"/>'
          f'<ellipse cx="{f(x)}" cy="{f(y - 24.6 * k)}" rx="{f(6 * k)}" ry="{f(1.8 * k)}" fill="{WHEAT["base"]}"/>'
          f'<path d="M{f(x - 2.8 * k)},{f(y - 24.8 * k)} Q{f(x - 2.6 * k)},{f(y - 28.4 * k)} {f(x)},{f(y - 28.6 * k)} Q{f(x + 2.6 * k)},{f(y - 28.4 * k)} {f(x + 2.8 * k)},{f(y - 24.8 * k)}Z" fill="{WHEAT["lit"]}"/>'
          f'<ellipse cx="{f(x - 1.6 * k)}" cy="{f(y - 25 * k)}" rx="{f(3 * k)}" ry="{f(0.8 * k)}" fill="{WHEAT["hi"]}" opacity="0.7"/>'
          f'<path d="M{f(x - 2.8 * k)},{f(y - 25.2 * k)} Q{f(x)},{f(y - 24.4 * k)} {f(x + 2.8 * k)},{f(y - 25.2 * k)}" fill="none" stroke="{WOOD["dark"]}" stroke-width="{f(0.6 * k)}"/>')


def sack(c, a, b, k=1.0, lean=0.0):
    """Linen grain sack standing on the ground."""
    x, y = c.P(a, b, 0)
    iso.blob_shadow(c, a + 3 * k, b, 3 * k, 0.35)
    g = c.lin("sack", 0, 0, 1, 0, [(0, "#f3e8cf"), (0.45, "#e0cfa8"), (1, "#a8946c")], bbox=True)
    c.add(f'<g transform="translate({f(x)} {f(y)}) rotate({f(lean)}) scale({f(k)})">'
          f'<path d="M-4.2,0 C-5.2,-3 -4.8,-7 -2.6,-9 L-1.6,-10.6 L1.8,-10.6 L2.8,-9 C5,-7 5.2,-3 4.2,0 Q0,1.4 -4.2,0Z" fill="{g}"/>'
          f'<path d="M-1.8,-10.4 L-2.6,-12.2 M0,-10.6 L0,-12.8 M1.8,-10.4 L2.6,-12" stroke="#cbb88e" stroke-width="0.8" stroke-linecap="round"/>'
          f'<path d="M-2.4,-9.2 Q0,-8.4 2.6,-9.2" fill="none" stroke="#8a7650" stroke-width="0.7"/>'
          f'<path d="M-3,-6 C-3.4,-4 -3.2,-2 -2.4,-0.6" fill="none" stroke="#fffaf0" stroke-width="0.6" opacity="0.7"/></g>')
