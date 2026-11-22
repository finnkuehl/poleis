"""Shared parts for the processing buildings (sawmill, bakery, oilPress, smelter).

Builds on `iso.py` (same projection, light and painter's order). Everything here follows the
rules in tools/art/README.md: world units around the base centre, light from the upper left,
no black outlines, owner colour only through `c.accent()` in `iso.ACCENT` greys, and random
numbers only from `random.Random(seed)`.
"""
import math
import random

import iso
from iso import ACCENT, WOOD, ZS, f, poly

# ---------------------------------------------------------------------------
# Palettes (close to docs/ART.md: warm limestone, pale sawn timber, fired clay)
# ---------------------------------------------------------------------------
STONE = {"top": "#e2dccd", "l0": "#d6cdb9", "l1": "#bfb5a0", "r0": "#99958c", "r1": "#85827b",
         "jl": "#7d7361", "jr": "#55524c", "hi": "#f4efe2"}
SOOT = {"top": "#b9b2a4", "l0": "#aaa192", "l1": "#8f8778", "r0": "#6f6c66", "r1": "#5b5954",
        "jl": "#544c40", "jr": "#3a3835", "hi": "#cfc8ba"}
PLANK = {"top": "#f6e2ae", "left": "#e6c98c", "right": "#b99458", "line": "#9a7440", "hi": "#fff3cf"}
CLAY = {"hi": "#f6cfa2", "lit": "#e3ab7c", "base": "#c98a5c", "shade": "#96603e", "dark": "#633a24"}
BARK = {"lit": "#b08a60", "base": "#8a6a48", "dark": "#5e452c", "end": "#edd5a2", "ring": "#c39f66"}
STEEL = {"hi": "#f4f7f8", "base": "#c9d2d6", "shade": "#8d989e", "dark": "#5a646a"}
BURLAP = {"lit": "#ecd8a6", "base": "#d0b27c", "shade": "#9a7c4e", "dark": "#6e5632"}


# ---------------------------------------------------------------------------
# Stone masonry
# ---------------------------------------------------------------------------
def _masonry(x0, x1, y0, y1, rnd, fill, joint, hi, row=4.4, wmin=4.5, wmax=9.0, tone=0.13):
    """Coursed rubble blocks filling a face rectangle (face-local coordinates, y up)."""
    out = [f'<rect x="{f(x0)}" y="{f(y0)}" width="{f(x1 - x0)}" height="{f(y1 - y0)}" fill="{fill}"/>']
    y, k = y0, 0
    while y < y1 - 0.4:
        h = min(row * rnd.uniform(0.85, 1.15), y1 - y)
        if y1 - (y + h) < 1.4:
            h = y1 - y
        x = x0 - (rnd.uniform(1, 4) if k % 2 else 0)
        while x < x1 - 0.3:
            w = rnd.uniform(wmin, wmax)
            xa, xb = max(x, x0), min(x + w, x1)
            if xb - xa > 0.8:
                t = rnd.uniform(-1, 1)
                out.append(f'<rect x="{f(xa)}" y="{f(y)}" width="{f(xb - xa)}" height="{f(h)}" fill="{"#fff" if t > 0 else "#3a3226"}" opacity="{f(abs(t) * tone)}"/>')
                if xb < x1 - 0.3:
                    out.append(f'<rect x="{f(xb - 0.3)}" y="{f(y)}" width="0.55" height="{f(h)}" fill="{joint}" opacity="0.6"/>')
            x += w
        out.append(f'<rect x="{f(x0)}" y="{f(y + h - 0.45)}" width="{f(x1 - x0)}" height="0.45" fill="{hi}" opacity="0.5"/>'
                   f'<rect x="{f(x0)}" y="{f(y)}" width="{f(x1 - x0)}" height="0.45" fill="{joint}" opacity="0.5"/>')
        y += h
        k += 1
    return "".join(out)


def stone_wall_b(c, b, a0, a1, z0, z1, seed=1, pal=STONE, row=4.4, ao=True):
    """Lit left (+b) face of a rubble stone wall."""
    key = pal["l0"][1:]
    g = c.lin("psL" + key, 0, 0, 1, 0, [(0, pal["l0"]), (1, pal["l1"])], bbox=True)
    out = _masonry(a0, a1, z0, z1, random.Random(seed), g, pal["jl"], pal["hi"], row=row)
    if ao:
        sh = c.lin("psLao" + f(z0).replace(".", "_").replace("-", "m"), 0, z0, 0, z0 + 7, [(0, "#3d3628", 0.3), (1, "#3d3628", 0)])
        out += f'<rect x="{f(a0)}" y="{f(z0)}" width="{f(a1 - a0)}" height="7" fill="{sh}"/>'
    c.add(c.on(c.m_bface(b), out))


def stone_wall_a(c, a, b0, b1, z0, z1, seed=2, pal=STONE, row=4.4, ao=True):
    """Shaded right (+a) face of a rubble stone wall (b0 < b1)."""
    key = pal["r0"][1:]
    g = c.lin("psR" + key, 0, 0, 0, 1, [(0, pal["r1"]), (1, pal["r0"])], bbox=True)
    out = _masonry(-b1, -b0, z0, z1, random.Random(seed), g, pal["jr"], pal["top"], row=row, tone=0.09)
    if ao:
        sh = c.lin("psRao" + f(z0).replace(".", "_").replace("-", "m"), 0, z0, 0, z0 + 12, [(0, "#c9d58f", 0.28), (1, "#c9d58f", 0)])
        out += f'<rect x="{f(-b1)}" y="{f(z0)}" width="{f(b1 - b0)}" height="12" fill="{sh}"/>'
        out += f'<rect x="{f(-b1)}" y="{f(z0)}" width="0.6" height="{f(z1 - z0)}" fill="{pal["hi"]}" opacity="0.5"/>'
    c.add(c.on(c.m_aface(a), out))


def stone_box(c, a0, a1, b0, b1, z0, z1, seed=1, pal=STONE, row=4.4, top=True, ao=True):
    """Rubble stone block: top face plus both visible masonry faces."""
    if top:
        c.add(c.on(c.m_ground(z1), f'<rect x="{f(a0)}" y="{f(b0)}" width="{f(a1 - a0)}" height="{f(b1 - b0)}" fill="{pal["top"]}"/>'))
    stone_wall_b(c, b1, a0, a1, z0, z1, seed, pal, row, ao)
    stone_wall_a(c, a1, b0, b1, z0, z1, seed + 100, pal, row, ao)


def arch(x0, x1, y0, y1):
    """Round-topped opening as a path in face-local coordinates (y up)."""
    r = (x1 - x0) / 2
    ys = y1 - r
    return f"M{f(x0)},{f(y0)} L{f(x0)},{f(ys)} A{f(r)},{f(r)} 0 0 0 {f(x1)},{f(ys)} L{f(x1)},{f(y0)}Z"


def fire_mouth(c, transform, x0, x1, y0, y1, name="mouth", frame="#8f8778", frame_w=2.2, hot=1.0):
    """Glowing furnace/oven mouth on a face: stone arch frame, dark throat, fire glow, embers."""
    xm = (x0 + x1) / 2
    g = c.rad(name, xm, y0 + (y1 - y0) * 0.18, (y1 - y0) * 0.95,
              [(0, "#fff3b0"), (0.28, "#ffc24a"), (0.6, "#f0701e"), (1, "#5a160a")])
    out = [f'<path d="{arch(x0 - frame_w, x1 + frame_w, y0, y1 + frame_w)}" fill="{frame}"/>',
           f'<path d="{arch(x0 - frame_w, x1 + frame_w, y0, y1 + frame_w)}" fill="none" stroke="#fff" stroke-width="0.5" opacity="0.35"/>',
           f'<path d="{arch(x0, x1, y0, y1)}" fill="#2a120a"/>',
           f'<path d="{arch(x0, x1, y0, y1)}" fill="{g}" opacity="{f(hot)}"/>']
    # flames
    w = x1 - x0
    out.append(f'<path d="M{f(x0 + w * 0.12)},{f(y0)} Q{f(x0 + w * 0.2)},{f(y0 + (y1 - y0) * 0.45)} {f(x0 + w * 0.34)},{f(y0 + (y1 - y0) * 0.62)} '
               f'Q{f(x0 + w * 0.4)},{f(y0 + (y1 - y0) * 0.3)} {f(xm)},{f(y0 + (y1 - y0) * 0.78)} '
               f'Q{f(x0 + w * 0.62)},{f(y0 + (y1 - y0) * 0.32)} {f(x0 + w * 0.72)},{f(y0 + (y1 - y0) * 0.55)} '
               f'Q{f(x0 + w * 0.82)},{f(y0 + (y1 - y0) * 0.3)} {f(x0 + w * 0.88)},{f(y0)}Z" fill="#ffe58a" opacity="0.9"/>')
    c.add(c.on(transform, "".join(out)))


def ground_glow(c, a, b, r, name="gglow", strength=0.55):
    """Warm light spilling on the ground (ellipse in the ground plane)."""
    g = c.rad(name, a, b, r, [(0, "#ffb347", strength), (0.5, "#ff8a2c", strength * 0.45), (1, "#ff8a2c", 0)])
    c.add(c.on(c.m_ground(0.2), f'<circle cx="{f(a)}" cy="{f(b)}" r="{f(r)}" fill="{g}"/>'))


# ---------------------------------------------------------------------------
# Timber
# ---------------------------------------------------------------------------
def timber(c, a0, a1, b0, b1, z0, z1, pal=WOOD, edge="#c99a6a"):
    """Squared timber (post, beam, board)."""
    iso.box(c, a0, a1, b0, b1, z0, z1, pal["lit"], pal["base"], pal["dark"], edge=edge)


def post(c, a, b, z0, z1, w=1.5, pal=WOOD):
    timber(c, a - w, a + w, b - w, b + w, z0, z1, pal)


def plank_wall_b(c, b, a0, a1, z0, z1, name="pwb", top="#4a3220", bottom="#8f6a44", pitch=4.0):
    """Board wall seen on a +b plane (use dark tones for the inside of a shed)."""
    g = c.lin(name, 0, z0, 0, z1, [(0, bottom), (1, top)])
    out = [f'<rect x="{f(a0)}" y="{f(z0)}" width="{f(a1 - a0)}" height="{f(z1 - z0)}" fill="{g}"/>']
    x = a0 + pitch
    while x < a1 - 0.5:
        out.append(f'<rect x="{f(x)}" y="{f(z0)}" width="0.5" height="{f(z1 - z0)}" fill="#2a1a0e" opacity="0.45"/>')
        x += pitch
    c.add(c.on(c.m_bface(b), "".join(out)))


def plank_wall_a(c, a, b0, b1, z0, z1, name="pwa", top="#33221a", bottom="#6e5036", pitch=4.0):
    """Board wall seen on a +a plane (shaded side)."""
    g = c.lin(name, 0, z0, 0, z1, [(0, bottom), (1, top)])
    out = [f'<rect x="{f(-b1)}" y="{f(z0)}" width="{f(b1 - b0)}" height="{f(z1 - z0)}" fill="{g}"/>']
    x = -b1 + pitch
    while x < -b0 - 0.5:
        out.append(f'<rect x="{f(x)}" y="{f(z0)}" width="0.5" height="{f(z1 - z0)}" fill="#1e120a" opacity="0.45"/>')
        x += pitch
    c.add(c.on(c.m_aface(a), "".join(out)))


def plank_stack(c, a0, a1, b0, b1, z0, n=5, th=2.0, seed=1, pal=PLANK, per_row=3):
    """Stack of pale sawn planks lying along a. Returns the top height."""
    rnd = random.Random(seed)
    z = z0
    for i in range(n):
        da = rnd.uniform(-1.4, 1.4)
        db = rnd.uniform(-0.5, 0.5)
        x0, x1, y0, y1 = a0 + da, a1 + da, b0 + db, b1 + db
        iso.box(c, x0, x1, y0, y1, z, z + th, pal["top"], pal["left"], pal["right"], edge=pal["hi"])
        w = (y1 - y0) / per_row
        ends = "".join(f'<rect x="{f(-y1 + k * w - 0.2)}" y="{f(z)}" width="0.45" height="{f(th)}" fill="{pal["line"]}" opacity="0.7"/>' for k in range(1, per_row))
        ends += f'<rect x="{f(-y1)}" y="{f(z)}" width="{f(y1 - y0)}" height="0.4" fill="{pal["line"]}" opacity="0.55"/>'
        c.add(c.on(c.m_aface(x1), ends))
        c.add(c.on(c.m_bface(y1), f'<rect x="{f(x0)}" y="{f(z)}" width="{f(x1 - x0)}" height="0.4" fill="{pal["line"]}" opacity="0.6"/>'))
        if i == n - 1:
            lines = "".join(f'<rect x="{f(x0)}" y="{f(y0 + k * w - 0.2)}" width="{f(x1 - x0)}" height="0.4" fill="{pal["line"]}" opacity="0.45"/>' for k in range(1, per_row))
            c.add(c.on(c.m_ground(z + th), lines))
        z += th
    return z


def log_b(c, a, b0, b1, z, r, pal=BARK, rings=True):
    """Log lying along b (axis at height z); its sawn end faces +b (lit)."""
    t0 = math.atan2(ZS, -1)

    def pt(t, b):
        return c.P(a + r * math.cos(t), b, z + r * math.sin(t))
    body = [pt(t0, b0), pt(t0, b1), pt(t0 + math.pi, b1), pt(t0 + math.pi, b0)]
    th = math.pi / 2 + 0.25
    c.add(c.on(c.m_bface(b0), f'<circle cx="{f(a)}" cy="{f(z)}" r="{f(r)}" fill="{pal["base"]}"/>'))
    c.add(f'<path d="{poly(body)}" fill="{pal["base"]}"/>'
          f'<path d="{poly([pt(t0 + math.pi, b0), pt(t0 + math.pi, b1), pt(t0 + math.pi - 0.9, b1), pt(t0 + math.pi - 0.9, b0)])}" fill="{pal["dark"]}" opacity="0.7"/>'
          f'<path d="M{f(pt(th, b0)[0])},{f(pt(th, b0)[1])} L{f(pt(th, b1)[0])},{f(pt(th, b1)[1])}" stroke="{pal["lit"]}" stroke-width="{f(r * 0.38)}" opacity="0.8"/>')
    end = (f'<circle cx="{f(a)}" cy="{f(z)}" r="{f(r)}" fill="{pal["dark"]}"/>'
           f'<circle cx="{f(a)}" cy="{f(z)}" r="{f(r * 0.84)}" fill="{pal["end"]}"/>')
    if rings:
        end += (f'<circle cx="{f(a)}" cy="{f(z)}" r="{f(r * 0.55)}" fill="none" stroke="{pal["ring"]}" stroke-width="{f(r * 0.1)}"/>'
                f'<circle cx="{f(a)}" cy="{f(z)}" r="{f(r * 0.22)}" fill="{pal["ring"]}"/>')
    c.add(c.on(c.m_bface(b1), end))


def log_a(c, b, a0, a1, z, r, pal=BARK, rings=True):
    """Log lying along a (axis at height z); its sawn end faces +a (shade)."""
    t0 = math.atan2(ZS, 1)

    def pt(t, a):
        return c.P(a, b - r * math.cos(t), z + r * math.sin(t))
    body = [pt(t0, a0), pt(t0, a1), pt(t0 + math.pi, a1), pt(t0 + math.pi, a0)]
    th = math.pi / 2 + 0.55
    c.add(c.on(c.m_aface(a0), f'<circle cx="{f(-b)}" cy="{f(z)}" r="{f(r)}" fill="{pal["base"]}"/>'))
    c.add(f'<path d="{poly(body)}" fill="{pal["base"]}"/>'
          f'<path d="{poly([pt(t0 + math.pi, a0), pt(t0 + math.pi, a1), pt(t0 + math.pi + 0.9, a1), pt(t0 + math.pi + 0.9, a0)])}" fill="{pal["dark"]}" opacity="0.7"/>'
          f'<path d="M{f(pt(th, a0)[0])},{f(pt(th, a0)[1])} L{f(pt(th, a1)[0])},{f(pt(th, a1)[1])}" stroke="{pal["lit"]}" stroke-width="{f(r * 0.45)}" opacity="0.85"/>')
    end = (f'<circle cx="{f(-b)}" cy="{f(z)}" r="{f(r)}" fill="{pal["dark"]}"/>'
           f'<circle cx="{f(-b)}" cy="{f(z)}" r="{f(r * 0.84)}" fill="#cdb27c"/>')
    if rings:
        end += (f'<circle cx="{f(-b)}" cy="{f(z)}" r="{f(r * 0.55)}" fill="none" stroke="#a5834e" stroke-width="{f(r * 0.1)}"/>'
                f'<circle cx="{f(-b)}" cy="{f(z)}" r="{f(r * 0.22)}" fill="#a5834e"/>')
    c.add(c.on(c.m_aface(a1), end))


def table(c, a0, a1, b0, b1, z, th=1.4, pal=WOOD):
    """Simple wooden table / bench: four legs and a board. Returns the top height."""
    for a, b in ((a0 + 1, b0 + 1), (a1 - 1, b0 + 1), (a0 + 1, b1 - 1), (a1 - 1, b1 - 1)):
        post(c, a, b, 0, z - th, 0.7, pal)
    c.add(c.on(c.m_ground(0.2), f'<rect x="{f(a0 + 2)}" y="{f(b0 + 1)}" width="{f(a1 - a0)}" height="{f(b1 - b0)}" fill="#1f2e15" opacity="0.3" filter="{c.blur(0.9)}"/>'))
    timber(c, a0, a1, b0, b1, z - th, z, pal)
    return z


# ---------------------------------------------------------------------------
# Cloth, sacks, baskets
# ---------------------------------------------------------------------------
def tarp(c, a0, a1, b0, b1, z, drop=4.0):
    """Owner-coloured cloth thrown over a stack: top plus two hanging flaps (ACCENT)."""
    c.accent(c.on(c.m_ground(z), f'<rect x="{f(a0)}" y="{f(b0)}" width="{f(a1 - a0)}" height="{f(b1 - b0)}" fill="{ACCENT["lit"]}"/>'))
    n = max(3, int((a1 - a0) / 4))
    w = (a1 - a0) / n
    d = f"M{f(a0)},{f(z)} L{f(a1)},{f(z)} L{f(a1)},{f(z - drop)}"
    for i in range(n):
        d += f" Q{f(a1 - (i + 0.5) * w)},{f(z - drop - 1.6)} {f(a1 - (i + 1) * w)},{f(z - drop)}"
    c.accent(c.on(c.m_bface(b1), f'<path d="{d}Z" fill="{ACCENT["light"]}"/>'))
    n2 = max(2, int((b1 - b0) / 4))
    w2 = (b1 - b0) / n2
    d2 = f"M{f(-b1)},{f(z)} L{f(-b0)},{f(z)} L{f(-b0)},{f(z - drop)}"
    for i in range(n2):
        d2 += f" Q{f(-b0 - (i + 0.5) * w2)},{f(z - drop - 1.6)} {f(-b0 - (i + 1) * w2)},{f(z - drop)}"
    c.accent(c.on(c.m_aface(a1), f'<path d="{d2}Z" fill="{ACCENT["shade"]}"/>'))
    # art on top: folds, a pale rope across
    folds = "".join(f'<rect x="{f(a0 + (i + 0.5) * w)}" y="{f(z - drop)}" width="0.5" height="{f(drop)}" fill="#1d2b36" opacity="0.2"/>' for i in range(n))
    c.add(c.on(c.m_bface(b1), folds + f'<rect x="{f(a0)}" y="{f(z - 0.5)}" width="{f(a1 - a0)}" height="0.5" fill="#fff" opacity="0.4"/>'))
    am = (a0 + a1) / 2
    c.add(c.on(c.m_ground(z), f'<rect x="{f(am - 0.5)}" y="{f(b0)}" width="1" height="{f(b1 - b0)}" fill="#e9dcc0"/>'
               f'<rect x="{f(a0)}" y="{f(b0)}" width="{f(a1 - a0)}" height="{f(b1 - b0)}" fill="url(#{c.id("tarpsh")})"/>'))
    c.lin("tarpsh", a0, 0, a1, 0, [(0, "#fff", 0.12), (1, "#1d2b36", 0.16)])
    c.add(c.on(c.m_bface(b1), f'<rect x="{f(am - 0.5)}" y="{f(z - drop)}" width="1" height="{f(drop)}" fill="#e9dcc0"/>'))


SACK = ("M-5,0 C-7.6,-2 -7.2,-9 -4,-12 L-2.5,-13 C-3.6,-14.6 -3.2,-16.2 -2,-16.8 L2.6,-16.4 "
        "C3.4,-15.4 3.2,-14 2.2,-13 L4,-12 C7.2,-9 7.6,-2 5,0 Q0,1.6 -5,0Z")


def sack(c, a, b, k=1.0, accent=False, z=0.0, shadow=True):
    """Tied grain sack (screen-space figure standing at ground point a, b)."""
    x, y = c.P(a, b, z)
    tf = f"translate({f(x)} {f(y)}) scale({f(k)})"
    if shadow:
        c.add(f'<ellipse cx="{f(x + 2.5 * k)}" cy="{f(y + 0.3)}" rx="{f(7 * k)}" ry="{f(2.4 * k)}" fill="#1f2e15" opacity="0.38" filter="{c.blur(0.6)}"/>')
    if accent:
        g = c.lin("sackacc", 0, 0, 1, 0, [(0, ACCENT["lit"]), (0.45, ACCENT["light"]), (0.8, ACCENT["shade"]), (1, ACCENT["dark"])], bbox=True)
        c.accent(f'<g transform="{tf}"><path d="{SACK}" fill="{g}"/></g>')
        c.add(f'<g transform="{tf}"><path d="M-2.8,-13 Q0,-12 2.5,-13" fill="none" stroke="#f1e2bc" stroke-width="1.1" stroke-linecap="round"/>'
              '<path d="M-3.4,-9.5 C-4.6,-7 -4.6,-4 -3.6,-1.6" fill="none" stroke="#fff" stroke-width="0.9" opacity="0.4" stroke-linecap="round"/>'
              '<path d="M3,-10 C4.6,-7 4.6,-3.4 3.4,-1" fill="none" stroke="#1d2b36" stroke-width="1" opacity="0.25" stroke-linecap="round"/></g>')
    else:
        g = c.lin("sackbur", 0, 0, 1, 0, [(0, BURLAP["lit"]), (0.45, BURLAP["base"]), (0.85, BURLAP["shade"]), (1, BURLAP["dark"])], bbox=True)
        c.add(f'<g transform="{tf}"><path d="{SACK}" fill="{g}"/>'
              f'<path d="M-2.8,-13 Q0,-12 2.5,-13" fill="none" stroke="{BURLAP["dark"]}" stroke-width="1" stroke-linecap="round"/>'
              '<path d="M-3.4,-9.5 C-4.6,-7 -4.6,-4 -3.6,-1.6" fill="none" stroke="#fff8dc" stroke-width="0.9" opacity="0.6" stroke-linecap="round"/>'
              f'<path d="M-1,-9 L-0.6,-2 M1.6,-9.4 L2,-2.4" fill="none" stroke="{BURLAP["shade"]}" stroke-width="0.45" opacity="0.6"/></g>')


def basket(c, a, b, k=1.0, fill=("#3d3152", "#5a6b2c", "#2c2a3a"), seed=3, heap=1.0):
    """Woven basket heaped with small round things (olives by default)."""
    x, y = c.P(a, b, 0)
    rnd = random.Random(seed)
    g = c.lin("bask", 0, 0, 1, 0, [(0, "#e2c184"), (0.5, "#c19a58"), (1, "#7e5c2e")], bbox=True)
    out = [f'<ellipse cx="{f(x + 2 * k)}" cy="{f(y + 0.3)}" rx="{f(8 * k)}" ry="{f(2.6 * k)}" fill="#1f2e15" opacity="0.38" filter="{c.blur(0.6)}"/>',
           f'<g transform="translate({f(x)} {f(y)}) scale({f(k)})">',
           f'<path d="M-6.4,-7 L6.4,-7 L5,0 Q0,2 -5,0Z" fill="{g}"/>']
    for i in range(1, 4):
        out.append(f'<path d="M{f(-6.4 + i * 0.35)},{f(-7 + i * 1.8)} Q0,{f(-5.2 + i * 1.8 + 0.9)} {f(6.4 - i * 0.35)},{f(-7 + i * 1.8)}" fill="none" stroke="#6e4e26" stroke-width="0.45" opacity="0.7"/>')
    for i in range(-2, 3):
        out.append(f'<path d="M{f(i * 2.3)},-6.5 L{f(i * 1.8)},0.6" stroke="#f1d9a4" stroke-width="0.4" opacity="0.5"/>')
    out.append('<ellipse cx="0" cy="-7" rx="6.6" ry="2.4" fill="#8a6634"/>')
    out.append(f'<ellipse cx="0" cy="-7" rx="5.6" ry="1.9" fill="{fill[2]}"/>')
    for _ in range(int(16 * heap)):
        px = rnd.uniform(-4.6, 4.6)
        py = -7.2 - rnd.uniform(0, 2.6 * heap) * (1 - abs(px) / 5.5)
        col = rnd.choice(fill[:2])
        out.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="1.15" fill="{col}"/><circle cx="{f(px - 0.35)}" cy="{f(py - 0.4)}" r="0.35" fill="#fff" opacity="0.45"/>')
    out.append('<path d="M-6.6,-7 A6.6,2.4 0 0 0 6.6,-7" fill="none" stroke="#f1d9a4" stroke-width="0.6" opacity="0.8"/></g>')
    c.add("".join(out))


# ---------------------------------------------------------------------------
# Smoke, piles, metal
# ---------------------------------------------------------------------------
def smoke(c, x, y, k=1.0, seed=1, n=5, tone="#f1eee8", shade="#b9b4ac", drift=1.0, rise=7.5, op=0.85):
    """Rising puffs of smoke from screen point (x, y), drifting with the wind to the right."""
    rnd = random.Random(seed)
    for i in range(n):
        cx = x + drift * (i ** 1.35) * 2.4 * k + rnd.uniform(-1, 1) * k
        cy = y - (i + 0.4) * rise * k
        r = (3.2 + i * 1.5) * k
        o = op * (1 - i / (n + 0.6))
        c.add(f'<path d="{iso.puff(cx + r * 0.25, cy + r * 0.3, r * 1.05, r * 0.8, n=7, seed=seed * 10 + i, bulge=1.3)}" fill="{shade}" opacity="{f(o * 0.75)}"/>'
              f'<path d="{iso.puff(cx, cy, r, r * 0.78, n=7, seed=seed * 10 + i + 50, bulge=1.3)}" fill="{tone}" opacity="{f(o)}"/>')


def heap(c, a, b, r, cols, seed=1, h=0.75, shadow=True, chunks=14, sparks=0):
    """Loose heap of lumps (charcoal, ore, sawdust): cols = (dark, base, light)."""
    rnd = random.Random(seed)
    x, y = c.P(a, b, 0)
    rx = r * 1.35
    out = []
    if shadow:
        out.append(f'<ellipse cx="{f(x + r * 0.5)}" cy="{f(y + 0.5)}" rx="{f(rx * 1.15)}" ry="{f(rx * 0.45)}" fill="#1f2e15" opacity="0.4" filter="{c.blur(0.9)}"/>')
    out.append(f'<path d="M{f(x - rx)},{f(y)} Q{f(x - rx * 0.5)},{f(y - r * h * 1.9)} {f(x)},{f(y - r * h * 2)} Q{f(x + rx * 0.55)},{f(y - r * h * 1.8)} {f(x + rx)},{f(y)} Q{f(x)},{f(y + rx * 0.42)} {f(x - rx)},{f(y)}Z" fill="{cols[1]}"/>'
               f'<path d="M{f(x)},{f(y - r * h * 2)} Q{f(x + rx * 0.55)},{f(y - r * h * 1.8)} {f(x + rx)},{f(y)} Q{f(x + rx * 0.5)},{f(y + rx * 0.3)} {f(x + rx * 0.15)},{f(y + rx * 0.36)}Z" fill="{cols[0]}" opacity="0.6"/>')
    for i in range(chunks):
        t = rnd.random()
        px = x + rnd.uniform(-1, 1) * rx * (0.9 - 0.75 * t)
        py = y + rx * 0.3 - t * (r * h * 2 + rx * 0.2)
        s = rnd.uniform(0.9, 1.7) * r / 8
        col = cols[2] if px < x + rnd.uniform(-2, 2) else cols[0]
        out.append(f'<path d="M{f(px - s)},{f(py)} L{f(px - s * 0.2)},{f(py - s)} L{f(px + s)},{f(py - s * 0.3)} L{f(px + s * 0.4)},{f(py + s * 0.6)}Z" fill="{col}" opacity="0.85"/>')
    for i in range(sparks):
        px = x + rnd.uniform(-0.6, 0.6) * rx
        py = y - rnd.uniform(0.1, 1.2) * r * h
        out.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="0.7" fill="#ff9a3c"/>')
    c.add("".join(out))


def ingots(c, a, b, rows=(3, 2, 1), w=7.0, d=3.4, h=2.2, pal=None):
    """Pyramid of bronze ingots lying along a."""
    pal = pal or iso.BRONZE
    z = 0.0
    x, y = c.P(a + 3, b, 0)
    c.add(f'<ellipse cx="{f(x)}" cy="{f(y + 1)}" rx="{f(w * 1.1)}" ry="{f(d * rows[0] * 0.55)}" fill="#1f2e15" opacity="0.4" filter="{c.blur(0.9)}"/>')
    for n in rows:
        for i in range(n):
            b0 = b + (i - n / 2) * (d + 0.5)
            iso.box(c, a - w / 2, a + w / 2, b0, b0 + d, z, z + h, "#eab868", "#c98a42", pal["shade"], edge=pal["hi"])
        z += h


def stump(c, a, b, r=5.0, h=5.0, axe=True):
    """Chopping block: a short trunk section, optionally with an axe stuck in it."""
    with c.at(a, b):
        iso.blob_shadow(c, 4, 0, r * 0.9, 0.34)
        iso.cylinder(c, r, 0, h, [(0, BARK["lit"]), (0.45, BARK["base"]), (1, BARK["dark"])], top=BARK["end"], name="stump")
        x, y = c.P(0, 0, h)
        c.add(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(r * 0.85)}" ry="{f(r * 0.42)}" fill="none" stroke="{BARK["ring"]}" stroke-width="0.7"/>'
              f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(r * 0.35)}" ry="{f(r * 0.18)}" fill="{BARK["ring"]}"/>')
        if axe:
            c.add(f'<path d="M{f(x + 1)},{f(y - 1)} L{f(x + 11)},{f(y - 15)}" stroke="{WOOD["base"]}" stroke-width="1.5" stroke-linecap="round"/>'
                  f'<path d="M{f(x + 1.4)},{f(y - 1.6)} L{f(x + 10.6)},{f(y - 14.6)}" stroke="#c99a6a" stroke-width="0.5" stroke-linecap="round"/>'
                  f'<path d="M{f(x - 3.4)},{f(y - 1.2)} L{f(x + 0.2)},{f(y - 6.4)} L{f(x + 3.6)},{f(y - 3.6)} L{f(x + 0.8)},{f(y + 0.6)}Z" fill="{STEEL["base"]}"/>'
                  f'<path d="M{f(x - 3.4)},{f(y - 1.2)} L{f(x + 0.2)},{f(y - 6.4)} L{f(x + 0.9)},{f(y - 5.8)} L{f(x - 2.4)},{f(y - 0.8)}Z" fill="{STEEL["hi"]}"/>')


def sheaf(c, a, b, z=0.0, k=1.0, seed=1):
    """Standing sheaf of wheat tied in the middle (screen-space figure)."""
    rnd = random.Random(seed)
    x, y = c.P(a, b, z)
    out = [f'<ellipse cx="{f(x + 2 * k)}" cy="{f(y + 0.2)}" rx="{f(5 * k)}" ry="{f(1.8 * k)}" fill="#3a3220" opacity="0.3"/>',
           f'<path d="M{f(x - 4.4 * k)},{f(y)} L{f(x - 1.5 * k)},{f(y - 7 * k)} L{f(x - 4.6 * k)},{f(y - 13.5 * k)} L{f(x + 4.6 * k)},{f(y - 13.5 * k)} L{f(x + 1.5 * k)},{f(y - 7 * k)} L{f(x + 4.4 * k)},{f(y)}Z" fill="#d9a83e"/>',
           f'<path d="M{f(x - 4.4 * k)},{f(y)} L{f(x - 1.5 * k)},{f(y - 7 * k)} L{f(x - 4.6 * k)},{f(y - 13.5 * k)} L{f(x - 0.6 * k)},{f(y - 13.5 * k)} L{f(x - 0.2 * k)},{f(y - 7 * k)} L{f(x - 1 * k)},{f(y)}Z" fill="#f2cf6a"/>']
    for i in range(7):
        px = x + (-4.4 + i * 1.47) * k
        out.append(f'<ellipse cx="{f(px)}" cy="{f(y - (13.6 + rnd.uniform(0, 1.6)) * k)}" rx="{f(0.9 * k)}" ry="{f(2.1 * k)}" fill="{"#f6dc8a" if i < 4 else "#e0b44c"}" transform="rotate({f((i - 3) * 9)} {f(px)} {f(y - 13.6 * k)})"/>')
    out.append(f'<rect x="{f(x - 1.9 * k)}" y="{f(y - 7.8 * k)}" width="{f(3.8 * k)}" height="{f(1.5 * k)}" fill="#8a6a34"/>')
    c.add("".join(out))
