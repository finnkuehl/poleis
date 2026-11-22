"""Poleis art library: isometric diorama miniatures (docs/ART.md, "Chosen direction: V1").

Python 3, standard library only. Every asset script builds a `Canvas`, draws into it with the
helpers below (painter's order: back to front) and writes two SVG layers:

    <id>.svg         the art (colour-neutral parts) - with transparent holes where accents are
    <id>.accent.svg  only the owner-coloured parts, in neutral greys with their light and shade

The game draws the accent layer FIRST (tinted with the player colour) and the art layer on top.
Because the art has holes exactly where the accents are, anything painted in front of an accent
(a tree over a shutter, a column over a banner) automatically hides it, and soft shadows painted
later automatically darken the tinted colour.

Projection: true 2:1 dimetric ("isometric"). World axes:
    a -> screen (+1, +0.5)   down-right
    b -> screen (-1, +0.5)   down-left
    z -> screen (0, -ZS)     up
Visible vertical faces: +b ("left", warm mid tone) and +a ("right", cool shade).
Light comes from the upper left of the screen; shadows fall to the lower right (+a).
"""
import math
import os
import random
from contextlib import contextmanager

# ---------------------------------------------------------------------------
# Fixed canvas + anchor (the game relies on these, see docs/ART.md)
# ---------------------------------------------------------------------------
ZS = 1.225                     # vertical scale so cubes look like cubes in 2:1 dimetric
BUILDING_CANVAS = 256          # viewBox 0 0 256 256
BASE_CX, BASE_CY = 128, 176    # centre of the base's top ellipse (on the tile centre)
BASE_W = 208                   # width of the base's top ellipse (x 24 -> 232)
BASE_R = 68.0                  # base radius in world units (all geometry is in world units)
S = (BASE_W / 2) / (BASE_R * math.sqrt(2))   # world unit -> canvas px (about 1.08)
BASE_H = 21.0                  # side height of the base (world units)
BAND_H = 13.5                  # owner-colour rim band at the bottom of the side (world units)

# Neutral greys for the accent layer. The game multiplies them with the player colour
# (PixiJS sprite.tint), so white = the pure player colour and darker greys = its shade.
ACCENT = {
    "lit": "#ffffff",
    "light": "#e6e6e6",
    "mid": "#c4c4c4",
    "shade": "#9a9a9a",
    "dark": "#747474",
    "deep": "#4e4e4e",
}

# ---------------------------------------------------------------------------
# Palette (materials). Keep new colours close to docs/ART.md.
# ---------------------------------------------------------------------------
MARBLE = {"top": "#f8f5ed", "left": "#ebe6d9", "right": "#bfc2c1", "deep": "#a3a6a7",
          "hi": "#ffffff", "joint": "#9d978a"}
LIME = {"lit": "#fbf6ea", "mid": "#f1e9d8", "end": "#e6dcc7"}
TERRACOTTA = {"hi": "#f0a27a", "lit": "#de7d55", "base": "#c05a3c", "shade": "#8f3d2a",
              "dark": "#5a2216", "deep": "#3a140c", "lip": "#f5b08a"}
GOLD = {"hi": "#fff0c4", "lit": "#f0c878", "base": "#d9a640", "mid": "#c48b3e", "shade": "#8a5d28",
        "dark": "#5e3b12", "lip": "#fff2c8"}
GOLD_TILES = {"hi": "#fff2c0", "lit": "#f2cd72", "base": "#d6a43c", "shade": "#a0711f",
              "dark": "#6b4612", "deep": "#3f2a0a", "lip": "#fff0c0"}
BRONZE = {"hi": "#f6d39a", "lit": "#d9a35a", "base": "#b0793a", "shade": "#7a5226",
          "dark": "#4e3216", "patina": "#3e7d6b"}
WOOD = {"lit": "#a8744a", "base": "#8a5a34", "dark": "#5e3b22", "deep": "#3e2514"}
GRASS_SHADOW = "#2c4a1c"


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
def f(v):
    """Compact number formatting for SVG output."""
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def pts(ps):
    return " ".join(f"{f(x)},{f(y)}" for x, y in ps)


def poly(ps):
    """Closed path through screen (or face-local) points."""
    return "M" + " L".join(f"{f(x)},{f(y)}" for x, y in ps) + "Z"


def hull(points):
    """Convex hull (monotone chain) of 2D points."""
    p = sorted(set((round(x, 3), round(y, 3)) for x, y in points))
    if len(p) <= 2:
        return p

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower, upper = [], []
    for q in p:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], q) <= 0:
            lower.pop()
        lower.append(q)
    for q in reversed(p):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], q) <= 0:
            upper.pop()
        upper.append(q)
    return lower[:-1] + upper[:-1]


def puff(cx, cy, rx, ry, n=9, seed=1, bulge=1.28, jitter=0.12):
    """Closed scalloped 'cloud' outline (screen coords) for foliage, rocks, smoke."""
    rnd = random.Random(seed)
    angs = [2 * math.pi * (i + rnd.uniform(-jitter, jitter)) / n for i in range(n)]
    pp = [(cx + rx * math.cos(a) * rnd.uniform(0.9, 1.05), cy + ry * math.sin(a) * rnd.uniform(0.9, 1.05))
          for a in angs]
    d = f"M{f(pp[0][0])},{f(pp[0][1])}"
    for i in range(n):
        a0, a1 = angs[i], angs[(i + 1) % n] + (2 * math.pi if i == n - 1 else 0)
        am = (a0 + a1) / 2
        b = bulge * rnd.uniform(0.95, 1.08)
        p1 = pp[(i + 1) % n]
        d += f" Q{f(cx + rx * b * math.cos(am))},{f(cy + ry * b * math.sin(am))} {f(p1[0])},{f(p1[1])}"
    return d + "Z"


def stops(st):
    out = []
    for s in st:
        o, col = s[0], s[1]
        op = s[2] if len(s) > 2 else None
        out.append(f'<stop offset="{f(o)}" stop-color="{col}"' + (f' stop-opacity="{f(op)}"' if op is not None else "") + "/>")
    return "".join(out)


# ---------------------------------------------------------------------------
# Canvas
# ---------------------------------------------------------------------------
class Canvas:
    """One asset. Draw with `add()` (art) and `accent()` (owner colour) in painter's order.

    All coordinates handed to the helpers are WORLD units around the base centre (a=b=z=0);
    the canvas scales them by `S` around the fixed anchor (128, 176).
    """

    def __init__(self, asset_id, pid=None):
        self.asset_id = asset_id
        self.pid = (pid or asset_id) + "-"
        self.ox, self.oy = BASE_CX, BASE_CY
        self.size = BUILDING_CANVAS
        self.scale = S
        self._defs = {}
        self._items = []          # ("art" | "accent", markup)

    # --- projection -------------------------------------------------------
    @contextmanager
    def at(self, a=0.0, b=0.0, z=0.0):
        """Temporarily move the world origin, so any helper can draw an off-centre part:
            with c.at(-2, -30):   # the stoa stands at the back of the base
                iso.marble_steps(c, 36, 11, 2, 2.6, 2.6)
        """
        ox, oy = self.ox, self.oy
        self.ox, self.oy = ox + (a - b), oy + (a + b) * 0.5 - z * ZS
        try:
            yield self
        finally:
            self.ox, self.oy = ox, oy

    def P(self, a, b, z=0.0):
        """World point -> screen point (before the canvas scale; use inside the drawing)."""
        return (self.ox + (a - b), self.oy + (a + b) * 0.5 - z * ZS)

    # --- plane transforms: draw flat 2D shapes in face-local coordinates -
    def m_ground(self, z=0.0):
        """Horizontal plane at height z. Local (x=a, y=b)."""
        return f"matrix(1 0.5 -1 0.5 {f(self.ox)} {f(self.oy - z * ZS)})"

    def m_bface(self, b):
        """Vertical plane b=const, facing +b (the lit 'left' face). Local (x=a, y=z), y up."""
        return f"matrix(1 0.5 0 {-ZS} {f(self.ox - b)} {f(self.oy + b / 2)})"

    def m_aface(self, a):
        """Vertical plane a=const, facing +a (the shaded 'right' face). Local (x=-b, y=z), y up."""
        return f"matrix(1 -0.5 0 {-ZS} {f(self.ox + a)} {f(self.oy + a / 2)})"

    def m_slope_b(self, zr, tanp, sign=1):
        """Roof plane through a ridge along a (at b=0, height zr) falling toward sign*b.
        Local (x=a, y=b): front slope uses y in [0, depth], back slope (sign=-1) y in [-depth, 0]."""
        return f"matrix(1 0.5 -1 {f(0.5 + sign * ZS * tanp)} {f(self.ox)} {f(self.oy - ZS * zr)})"

    def m_slope_a(self, zr, tanp, sign=1):
        """Roof plane through a ridge along b (at a=0, height zr) falling toward sign*a.
        Local (x=a, y=b): right slope x in [0, half], left slope (sign=-1) x in [-half, 0]."""
        return f"matrix(1 {f(0.5 + sign * ZS * tanp)} -1 0.5 {f(self.ox)} {f(self.oy - ZS * zr)})"

    def on(self, transform, markup):
        """Wrap markup in a face transform: c.add(c.on(c.m_bface(B), '<rect .../>'))."""
        return f'<g transform="{transform}">{markup}</g>'

    # --- emit -------------------------------------------------------------
    def add(self, markup):
        """Art layer element(s)."""
        self._items.append(("art", markup))

    def accent(self, markup):
        """Owner-colour element(s): neutral greys only (see ACCENT), no blur filters."""
        self._items.append(("accent", markup))

    def id(self, name):
        return f"{self.pid}{name}"

    def url(self, name):
        return f"url(#{self.pid}{name})"

    def define(self, name, markup):
        """Register a <defs> entry (gradient, clipPath, filter...) once under its id."""
        self._defs.setdefault(self.id(name), markup)
        return self.url(name)

    def lin(self, name, x1, y1, x2, y2, st, bbox=False):
        """Linear gradient. bbox=True: coordinates are fractions of the shape's bounding box."""
        units = "" if bbox else ' gradientUnits="userSpaceOnUse"'
        return self.define(name, f'<linearGradient id="{self.id(name)}"{units} x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}">{stops(st)}</linearGradient>')

    def rad(self, name, cx, cy, r, st, bbox=False, fx=None, fy=None):
        units = "" if bbox else ' gradientUnits="userSpaceOnUse"'
        fxy = f' fx="{f(fx)}" fy="{f(fy)}"' if fx is not None else ""
        return self.define(name, f'<radialGradient id="{self.id(name)}"{units} cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}"{fxy}>{stops(st)}</radialGradient>')

    def blur(self, sd):
        """url() of a Gaussian blur filter (stdDeviation in world units). Art layer only."""
        name = "blur" + f(sd).replace(".", "_")
        return self.define(name, f'<filter id="{self.id(name)}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="{f(sd)}"/></filter>')

    # --- output -----------------------------------------------------------
    def _wrap(self, body):
        return (f'<g transform="translate({BASE_CX} {BASE_CY}) scale({f(self.scale)}) '
                f'translate({-BASE_CX} {-BASE_CY})">{body}</g>')

    def _with_defs(self, body):
        used, todo = set(), [body]
        while todo:
            text = todo.pop()
            for did, markup in self._defs.items():
                if did not in used and f"#{did})" in text:
                    used.add(did)
                    todo.append(markup)
        defs = "".join(m for did, m in self._defs.items() if did in used)
        return (f"<defs>{defs}</defs>" if defs else "") + body

    def _head(self, layer):
        what = "art" if layer == "art" else "owner-colour accent (tint with the player colour, draw BELOW the art)"
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.size} {self.size}">'
                f"<!-- Poleis {self.asset_id}: {what}. Original work for Poleis, CC0 1.0. "
                f"Generated by tools/art - edit the script, not this file. -->")

    def art_svg(self):
        black = self.define("blk", f'<filter id="{self.id("blk")}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"/></filter>')
        g, run, k = "", [], 0

        def flush_accent(markup):
            nonlocal g, k
            k += 1
            mid = self.id(f"hole{k}")
            self._defs[mid] = (
                f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="4000" height="4000">'
                f'<rect x="-2000" y="-2000" width="4000" height="4000" fill="#fff"/>'
                f'<g filter="{black}">{markup}</g></mask>')
            g = f'<g mask="url(#{mid})">{g}</g>'

        for kind, markup in self._items:
            if kind == "art":
                if run:
                    flush_accent("".join(run))
                    run = []
                g += markup
            else:
                run.append(markup)
        if run:
            flush_accent("".join(run))
        return self._head("art") + self._with_defs(self._wrap(g)) + "</svg>\n"

    def accent_svg(self):
        body = "".join(m for kind, m in self._items if kind == "accent")
        # grow the accent by ~0.7 px so no seam shows through the anti-aliased hole edges
        # (dilated copy underneath, the crisp original on top, so fine dark lines survive)
        dil = self.define("dil", f'<filter id="{self.id("dil")}" x="-5%" y="-5%" width="110%" height="110%"><feMorphology in="SourceGraphic" operator="dilate" radius="0.7" result="grown"/><feMerge><feMergeNode in="grown"/><feMergeNode in="SourceGraphic"/></feMerge></filter>')
        return self._head("accent") + self._with_defs(f'<g filter="{dil}">{self._wrap(body)}</g>') + "</svg>\n"

    def write(self, out_dir):
        os.makedirs(out_dir, exist_ok=True)
        paths = []
        for name, text in ((f"{self.asset_id}.svg", self.art_svg()), (f"{self.asset_id}.accent.svg", self.accent_svg())):
            path = os.path.join(out_dir, name)
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(text)
            paths.append(path)
        return paths


# ---------------------------------------------------------------------------
# Light: cast shadows, ambient occlusion, contact shadows
# ---------------------------------------------------------------------------
SHX, SHY = 0.46, 0.04   # cast-shadow offset on the ground per unit of height (world units)


def cast_shadow(c, footprint, tops, opacity=0.48, sd=2.0):
    """Soft cast shadow of a volume on the grass, clipped to the base top.
    footprint: ground (a, b) points; tops: (a, b, z) points of the roof/top outline."""
    proj = [(a + SHX * z, b + SHY * z) for a, b, z in tops]
    sp = [c.P(a, b, 0) for a, b in hull(list(footprint) + proj)]
    c.add(f'<g clip-path="{c.url("top")}"><path d="{poly(sp)}" fill="{GRASS_SHADOW}" opacity="{f(opacity)}" filter="{c.blur(sd)}"/></g>')


def contact_ao(c, a0, a1, b0, b1, z=0.0, width=4.0, opacity=0.45):
    """Dark soft band on the ground hugging the visible (+b and +a) edges of a footprint."""
    w = width
    ao = [c.P(a0, b1, z), c.P(a1, b1, z), c.P(a1, b0, z), c.P(a1 + w, b0, z), c.P(a1 + w, b1 + w, z), c.P(a0 - w * 0.4, b1 + w, z)]
    c.add(f'<path d="{poly(ao)}" fill="#24381a" opacity="{f(opacity)}" filter="{c.blur(1.6)}"/>')
    c.add(f'<path d="{poly([c.P(a0, b1, z), c.P(a1, b1, z), c.P(a1, b0, z)])}" fill="none" stroke="#1f2e15" stroke-width="1.6" opacity="{f(opacity)}" filter="{c.blur(0.45)}"/>')


def blob_shadow(c, a, b, r, opacity=0.3, dx=0.0):
    """Small soft elliptical shadow on the ground (props, trees)."""
    x, y = c.P(a, b, 0)
    c.add(f'<ellipse cx="{f(x + dx)}" cy="{f(y)}" rx="{f(r * 1.45)}" ry="{f(r * 0.6)}" fill="{GRASS_SHADOW}" opacity="{f(opacity)}" filter="{c.blur(1.6)}"/>')


def grass_tuft(x, y, hgt, col, sw=0.85, op=None):
    o = f' opacity="{f(op)}"' if op else ""
    return (f'<path d="M{f(x - 0.6)},{f(y)} q{f(-0.4)},{f(-hgt * 0.5)} {f(-1.6)},{f(-hgt * 0.78)} '
            f'M{f(x)},{f(y)} q{f(0.1)},{f(-hgt * 0.6)} {f(0.35)},{f(-hgt)} '
            f'M{f(x + 0.6)},{f(y)} q{f(0.5)},{f(-hgt * 0.4)} {f(1.6)},{f(-hgt * 0.68)}" '
            f'stroke="{col}" stroke-width="{f(sw)}" stroke-linecap="round" fill="none"{o}/>')


def base_tufts(c, edges, n=14, seed=3, hmax=4.4):
    """Grass tufts standing in front of base edges, so a model 'grows' out of the ground.
    edges: list of ((a0, b0), (a1, b1)) ground segments (usually the +b and +a footprint edges)."""
    rnd = random.Random(seed)
    out = []
    for _ in range(n):
        (a0, b0), (a1, b1) = rnd.choice(edges)
        t = rnd.random()
        x, y = c.P(a0 + (a1 - a0) * t + 0.8, b0 + (b1 - b0) * t + 0.8, 0)
        out.append(grass_tuft(x, y, rnd.uniform(2.4, hmax), rnd.choice(["#5f8f30", "#6c9a38", "#86b447", "#a9d066"])))
    c.add("".join(out))


# ---------------------------------------------------------------------------
# The round diorama base (grass top, earth side, owner-colour rim band)
# ---------------------------------------------------------------------------
def base(c, seed=7, avoid=None, tufts=90, flowers=16, top="grass"):
    """Draw the base. Must be the first thing drawn. Defines the clip id 'top' (grass top).

    avoid(a, b) -> True for ground points covered by the building (no tufts there).
    top: "grass" (default) or "paved" (agora flagstones; draw extra paving yourself on top).
    """
    rnd = random.Random(seed)
    cx, cy = c.P(0, 0, 0)
    rx = BASE_R * math.sqrt(2)
    ry = rx / 2
    h, band = BASE_H, BAND_H

    # soft drop shadow on the map (kept inside the canvas)
    c.add(f'<ellipse cx="{f(cx + 5)}" cy="{f(cy + h + 1)}" rx="{f(rx * 0.98)}" ry="{f(ry * 0.88)}" fill="#1d2b36" opacity="0.2" filter="{c.blur(3)}"/>')

    def band_path(y0, y1, inset=0.0):
        return (f"M{f(cx - rx + inset)},{f(cy + y0)} A{f(rx - inset)},{f(ry)} 0 0 0 {f(cx + rx - inset)},{f(cy + y0)} "
                f"L{f(cx + rx - inset)},{f(cy + y1)} A{f(rx - inset)},{f(ry)} 0 0 1 {f(cx - rx + inset)},{f(cy + y1)}Z")

    def arc(y, inset=0.0, ryy=None):
        return f"M{f(cx - rx + inset)},{f(cy + y)} A{f(rx - inset)},{f(ryy or ry)} 0 0 0 {f(cx + rx - inset)},{f(cy + y)}"

    # earth side (only above the band)
    earth = c.lin("earth", cx - rx, 0, cx + rx, 0, [(0, "#b98a5a"), (0.22, "#a7774b"), (0.55, "#8d6039"), (0.85, "#6f4628"), (1, "#5d3a21")])
    c.add(f'<path d="{band_path(0, h - band + 0.5)}" fill="{earth}"/>')
    c.add(f'<path d="{arc(h * 0.3)}" fill="none" stroke="#4a2c16" stroke-width="0.8" opacity="0.2"/>')
    peb = []
    for _ in range(18):
        th = rnd.uniform(0.12, math.pi - 0.12)
        yy = rnd.uniform(3.8, h - band - 1.2)
        s = rnd.uniform(0.6, 1.3)
        col = "#d1ad80" if math.cos(th) < 0.2 else "#9d7752"
        peb.append(f'<ellipse cx="{f(cx + rx * math.cos(th))}" cy="{f(cy + ry * math.sin(th) + yy)}" rx="{f(s * 1.3)}" ry="{f(s * 0.75)}" fill="{col}" opacity="0.75"/>')
    c.add("".join(peb))

    # owner-colour rim band (accent layer)
    own = c.lin("own", cx - rx, 0, cx + rx, 0, [(0, ACCENT["lit"]), (0.3, ACCENT["light"]), (0.6, ACCENT["mid"]), (0.86, ACCENT["shade"]), (1, ACCENT["dark"])])
    c.accent(f'<path d="{band_path(h - band, h)}" fill="{own}"/>'
             f'<path d="{band_path(h - 2.2, h)}" fill="{ACCENT["deep"]}" opacity="0.35"/>')
    # art over the band: bevel highlight on top, contact line where the earth meets it
    c.add(f'<path d="{arc(h - band + 0.9, 0.6)}" fill="none" stroke="#ffffff" stroke-width="1.2" opacity="0.45"/>'
          f'<path d="{arc(h - band - 0.1)}" fill="none" stroke="#2c1a0e" stroke-width="1" opacity="0.4"/>')

    # top surface
    if top == "paved":
        topfill = c.rad("grass", cx - rx * 0.35, cy - ry * 0.55, rx * 1.25, [(0, "#f1e2b8"), (0.5, "#e6d29e"), (1, "#d2bb82")])
    else:
        topfill = c.rad("grass", cx - rx * 0.35, cy - ry * 0.55, rx * 1.25, [(0, "#bddb76"), (0.45, "#a3cb5f"), (0.8, "#8fbb4f"), (1, "#7aa842")])
    c.add(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="{topfill}"/>')
    c.define("top", f'<clipPath id="{c.id("top")}"><ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}"/></clipPath>')

    # grass lip hanging over the earth edge
    n = 60
    outer = [(cx + rx * math.cos(math.pi - math.pi * i / n), cy + ry * math.sin(math.pi - math.pi * i / n)) for i in range(n + 1)]
    inner = []
    for i in range(n, -1, -1):
        th = math.pi - math.pi * i / n
        drip = 2.2 + rnd.random() * 1.6 + (2.0 if rnd.random() < 0.18 else 0)
        inner.append((cx + rx * math.cos(th), cy + ry * math.sin(th) + drip * (0.4 + 0.6 * math.sin(th))))
    lip = c.lin("lip", cx - rx, 0, cx + rx, 0, [(0, "#8fbe4e"), (0.5, "#76a23e"), (1, "#557b2c")])
    c.add(f'<path d="{poly(outer + inner)}" fill="{lip}"/>')
    c.add(f'<path d="M{f(cx - rx + 2)},{f(cy + 1.2)} A{f(rx - 2)},{f(ry - 1)} 0 0 0 {f(cx + rx * 0.55)},{f(cy + ry * 0.83)}" fill="none" stroke="#dcefa2" stroke-width="1.1" opacity="0.65"/>')
    c.add(f'<path d="M{f(cx - rx + 1.2)},{f(cy)} A{f(rx - 1.2)},{f(ry - 0.8)} 0 0 1 {f(cx + rx - 1.2)},{f(cy)}" fill="none" stroke="#e8f5b8" stroke-width="1" opacity="0.55"/>')

    # texture: tufts and flowers (deterministic scatter, not under the building)
    g = [f'<g clip-path="{c.url("top")}">']

    def spot(maxr):
        while True:
            ang = rnd.uniform(0, 2 * math.pi)
            rr = BASE_R * math.sqrt(rnd.random()) * maxr
            a, b = rr * math.cos(ang), rr * math.sin(ang)
            if avoid is None or not avoid(a, b):
                return a, b

    for _ in range(tufts):
        x, y = c.P(*spot(0.96), 0)
        col = "#6c9a38" if rnd.random() < 0.72 else "#c4e086"
        g.append(grass_tuft(x, y, rnd.uniform(2.6, 4.2), col, sw=0.8, op=0.8))
    for _ in range(flowers):
        x, y = c.P(*spot(0.92), 0)
        g.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="1.15" fill="{rnd.choice(["#fffaf0", "#fffaf0", "#f6d65a", "#f3b8c8"])}"/>')
    g.append("</g>")
    c.add("".join(g))


# ---------------------------------------------------------------------------
# Generic solids
# ---------------------------------------------------------------------------
def box(c, a0, a1, b0, b1, z0, z1, top, left, right, edge=None):
    """Axis-aligned box: top face, left (+b) face and right (+a) face. Fills may be url()s.
    edge: optional highlight colour for the lit top-front edge."""
    c.add(c.on(c.m_ground(z1), f'<rect x="{f(a0)}" y="{f(b0)}" width="{f(a1 - a0)}" height="{f(b1 - b0)}" fill="{top}"/>'))
    c.add(c.on(c.m_bface(b1), f'<rect x="{f(a0)}" y="{f(z0)}" width="{f(a1 - a0)}" height="{f(z1 - z0)}" fill="{left}"/>'
               + (f'<rect x="{f(a0)}" y="{f(z1 - 0.5)}" width="{f(a1 - a0)}" height="0.5" fill="{edge}" opacity="0.85"/>' if edge else "")))
    c.add(c.on(c.m_aface(a1), f'<rect x="{f(-b1)}" y="{f(z0)}" width="{f(b1 - b0)}" height="{f(z1 - z0)}" fill="{right}"/>'))


def marble_steps(c, ha, hb, n, step_w, step_h, joint=7.5):
    """n marble steps; the TOP step has half extents (ha, hb). Returns the top height."""
    sl = c.lin("stL", 0, 0, 1, 0, [(0, "#f1ece0"), (1, "#ddd6c6")], bbox=True)
    sr = c.lin("stR", 0, 0, 1, 0, [(0, "#b4b6b3"), (1, "#a2a5a4")], bbox=True)
    for k in range(n):
        xa, xb = ha + (n - 1 - k) * step_w, hb + (n - 1 - k) * step_w
        z0, z1 = k * step_h, (k + 1) * step_h
        c.add(c.on(c.m_ground(z1), f'<rect x="{f(-xa)}" y="{f(-xb)}" width="{f(2 * xa)}" height="{f(2 * xb)}" fill="{MARBLE["top"]}"/>'))
        g = [f'<rect x="{f(-xa)}" y="{f(z0)}" width="{f(2 * xa)}" height="{f(step_h)}" fill="{sl}"/>']
        m = max(1, int(2 * xa / joint))
        for i in range(1, m):
            g.append(f'<rect x="{f(-xa + i * 2 * xa / m + (1.6 if k % 2 else 0))}" y="{f(z0)}" width="0.45" height="{f(step_h)}" fill="{MARBLE["joint"]}" opacity="0.55"/>')
        g.append(f'<rect x="{f(-xa)}" y="{f(z1 - 0.55)}" width="{f(2 * xa)}" height="0.55" fill="#fff" opacity="0.85"/>'
                 f'<rect x="{f(-xa)}" y="{f(z0)}" width="{f(2 * xa)}" height="0.9" fill="#5d574b" opacity="0.28"/>')
        c.add(c.on(c.m_bface(xb), "".join(g)))
        g = [f'<rect x="{f(-xb)}" y="{f(z0)}" width="{f(2 * xb)}" height="{f(step_h)}" fill="{sr}"/>']
        m = max(1, int(2 * xb / joint))
        for i in range(1, m):
            g.append(f'<rect x="{f(-xb + i * 2 * xb / m + (1.6 if k % 2 else 0))}" y="{f(z0)}" width="0.45" height="{f(step_h)}" fill="#7d7b74" opacity="0.55"/>')
        g.append(f'<rect x="{f(-xb)}" y="{f(z1 - 0.5)}" width="{f(2 * xb)}" height="0.5" fill="#dcddd8" opacity="0.8"/>'
                 f'<rect x="{f(-xb)}" y="{f(z0)}" width="{f(2 * xb)}" height="0.9" fill="#3d3a33" opacity="0.3"/>')
        c.add(c.on(c.m_aface(xa), "".join(g)))
        if k < n - 1:
            ia, ib = xa - step_w, xb - step_w
            c.add(f'<path d="{poly([c.P(-ia, ib, z1), c.P(ia, ib, z1), c.P(ia, -ib, z1), c.P(ia + 1.4, -ib, z1), c.P(ia + 1.4, ib + 1.4, z1), c.P(-ia, ib + 1.4, z1)])}" fill="#6b665a" opacity="0.32" filter="{c.blur(0.45)}"/>')
    return n * step_h


def stone_course(c, ha, hb, h, seed=3):
    """Foundation course of uneven stone blocks around a footprint with half extents (ha, hb)."""
    rnd = random.Random(seed)
    fl = c.lin("fdL", -ha, 0, ha, 0, [(0, "#d9d0bd"), (1, "#c3b9a5")])
    fr = c.lin("fdR", -hb, 0, hb, 0, [(0, "#a8a094"), (1, "#958d82")])
    c.add(c.on(c.m_ground(h), f'<rect x="{f(-ha)}" y="{f(-hb)}" width="{f(2 * ha)}" height="{f(2 * hb)}" fill="#e9e2d2"/>'))
    blk = [f'<rect x="{f(-ha)}" y="0" width="{f(2 * ha)}" height="{f(h)}" fill="{fl}"/>']
    x = -ha
    while x < ha - 0.5:
        w = min(rnd.uniform(6, 11), ha - x)
        tone = rnd.uniform(-0.06, 0.06)
        blk.append(f'<rect x="{f(x)}" y="0" width="{f(w)}" height="{f(h)}" fill="{"#fff" if tone > 0 else "#5a5040"}" opacity="{f(abs(tone) * 2.2)}"/>'
                   f'<rect x="{f(x)}" y="{f(h - 0.7)}" width="{f(w)}" height="0.7" fill="#f6f1e6" opacity="0.8"/>')
        if x + w < ha - 0.5:
            blk.append(f'<rect x="{f(x + w - 0.35)}" y="0" width="0.7" height="{f(h)}" fill="#7d7364" opacity="0.7"/>')
        x += w
    blk.append(f'<rect x="{f(-ha)}" y="0" width="{f(2 * ha)}" height="1.4" fill="#3d3628" opacity="0.25"/>')
    c.add(c.on(c.m_bface(hb), "".join(blk)))
    blk = [f'<rect x="{f(-hb)}" y="0" width="{f(2 * hb)}" height="{f(h)}" fill="{fr}"/>']
    x = -hb
    while x < hb - 0.5:
        w = min(rnd.uniform(6, 10), hb - x)
        blk.append(f'<rect x="{f(x)}" y="{f(h - 0.6)}" width="{f(w)}" height="0.6" fill="#c9c2b4" opacity="0.8"/>')
        if x + w < hb - 0.5:
            blk.append(f'<rect x="{f(x + w - 0.35)}" y="0" width="0.7" height="{f(h)}" fill="#6a6156" opacity="0.7"/>')
        x += w
    blk.append(f'<rect x="{f(-hb)}" y="0" width="{f(2 * hb)}" height="1.4" fill="#2d271d" opacity="0.3"/>')
    c.add(c.on(c.m_aface(ha), "".join(blk)))


# ---------------------------------------------------------------------------
# Walls (whitewashed lime) and openings
# ---------------------------------------------------------------------------
def lime_wall_b(c, b, a0, a1, z0, z1, seed=5, mottle=14):
    """Lit left (+b) wall in warm whitewash, with mottling and foot AO."""
    rnd = random.Random(seed)
    g = c.lin("wL", a0, 0, a1, 0, [(0, LIME["lit"]), (0.6, LIME["mid"]), (1, LIME["end"])])
    out = [f'<rect x="{f(a0)}" y="{f(z0)}" width="{f(a1 - a0)}" height="{f(z1 - z0)}" fill="{g}"/>']
    for _ in range(mottle):
        out.append(f'<ellipse cx="{f(rnd.uniform(a0 + 3, a1 - 3))}" cy="{f(rnd.uniform(z0 + 3, z1 - 4))}" rx="{f(rnd.uniform(2, 5))}" ry="{f(rnd.uniform(1, 2.5))}" fill="#d8c9a8" opacity="0.13"/>')
    ao = c.lin("wLao", 0, z0, 0, z0 + 9, [(0, "#6d604a", 0.28), (1, "#6d604a", 0)])
    out.append(f'<rect x="{f(a0)}" y="{f(z0)}" width="{f(a1 - a0)}" height="9" fill="{ao}"/>')
    c.add(c.on(c.m_bface(b), "".join(out)))


def lime_wall_a(c, a, b0, b1, z0, z1, gable=0.0):
    """Shaded right (+a) wall: cool shade, warm-green bounce at the foot, optional gable rise."""
    g = c.lin("wR", 0, z0, 0, z1 + gable, [(0, "#d3c7b1"), (0.35, "#c3bfb6"), (1, "#b2b5bb")])
    shape = [(-b1, z0), (-b0, z0), (-b0, z1)] + ([((-b0 - b1) / 2, z1 + gable)] if gable else []) + [(-b1, z1)]
    bounce = c.lin("wRb", 0, z0, 0, z0 + 16, [(0, "#c9d58f", 0.35), (1, "#c9d58f", 0)])
    ao = c.lin("wRao", 0, z0, 0, z0 + 8, [(0, "#4b4436", 0.25), (1, "#4b4436", 0)])
    out = [f'<path d="{poly(shape)}" fill="{g}"/>',
           f'<rect x="{f(-b1)}" y="{f(z0)}" width="{f(b1 - b0)}" height="16" fill="{bounce}"/>',
           f'<rect x="{f(-b1)}" y="{f(z0)}" width="{f(b1 - b0)}" height="8" fill="{ao}"/>',
           f'<rect x="{f(-b1)}" y="{f(z0)}" width="0.7" height="{f(z1 - z0)}" fill="#e9e4da" opacity="0.55"/>']
    if gable:
        mid = (-b0 - b1) / 2
        out.append(f'<path d="{poly([(-b1, z1), (mid, z1 + gable), (-b0, z1), (-b0, z1 - 4), (mid, z1 + gable - 5), (-b1, z1 - 4)])}" fill="#3c3f4a" opacity="0.28" filter="{c.blur(0.45)}"/>')
    c.add(c.on(c.m_aface(a), "".join(out)))


def eave_shadow_b(c, b, a0, a1, z_eave, depth=10):
    """Shadow band + AO on a left wall right under an eave."""
    ao = c.lin("eaveao", 0, z_eave - 5, 0, z_eave + 1, [(0, "#3d352a", 0), (1, "#3d352a", 0.35)])
    c.add(c.on(c.m_bface(b), f'<rect x="{f(a0)}" y="{f(z_eave - depth)}" width="{f(a1 - a0)}" height="{f(depth + 1)}" fill="#6f6553" opacity="0.2"/>'
               f'<rect x="{f(a0)}" y="{f(z_eave - 5)}" width="{f(a1 - a0)}" height="6" fill="{ao}"/>'))


def door_b(c, b, x0, x1, z0, z1, reveal=2.4, frame="#e7dfcd"):
    """Recessed plank door with a stone frame and lintel on a left (+b) wall."""
    out = [f'<rect x="{f(x0 - 2)}" y="{f(z0)}" width="{f(x1 - x0 + 4)}" height="{f(z1 - z0 + 3.4)}" fill="{frame}"/>',
           f'<rect x="{f(x0 - 3)}" y="{f(z1 + 1)}" width="{f(x1 - x0 + 6)}" height="2.6" fill="#efe9db"/>',
           f'<rect x="{f(x0 - 3)}" y="{f(z1 + 1)}" width="{f(x1 - x0 + 6)}" height="0.6" fill="#b9ae98"/>']
    g = c.lin("door", x0, 0, x1, 0, [(0, "#9b673d"), (1, "#7e5030")])
    out.append(f'<rect x="{f(x0)}" y="{f(z0)}" width="{f(x1 - x0)}" height="{f(z1 - z0)}" fill="{g}"/>')
    pw = (x1 - x0) / 3
    for i in range(1, 3):
        out.append(f'<rect x="{f(x0 + i * pw - 0.25)}" y="{f(z0)}" width="0.5" height="{f(z1 - z0)}" fill="#4f301b"/>'
                   f'<rect x="{f(x0 + i * pw + 0.25)}" y="{f(z0)}" width="0.45" height="{f(z1 - z0)}" fill="#b98756" opacity="0.6"/>')
    for by in (z0 + 5, z1 - 7):
        out.append(f'<rect x="{f(x0)}" y="{f(by)}" width="{f(x1 - x0)}" height="1.7" fill="#6a4226"/>'
                   f'<rect x="{f(x0)}" y="{f(by + 1.7)}" width="{f(x1 - x0)}" height="0.45" fill="#c08e5c" opacity="0.6"/>')
        for i in range(3):
            out.append(f'<circle cx="{f(x0 + pw * (i + 0.5))}" cy="{f(by + 0.85)}" r="0.45" fill="#2d2a26"/>')
    out.append(f'<circle cx="{f(x1 - 3)}" cy="{f(z0 + 12)}" r="1.25" fill="none" stroke="{BRONZE["lit"]}" stroke-width="0.55"/>')
    d = reveal
    out.append(f'<path d="{poly([(x0, z0), (x0, z1), (x0 + d, z1), (x0 + d, z0 + d / ZS)])}" fill="#b4a993"/>')
    out.append(f'<path d="{poly([(x0 + d, z1), (x1, z1), (x1, z1 - 3.2), (x0 + d + 2.4, z1 - 3.2), (x0 + d + 2.4, z0 + d / ZS + 0.8), (x0 + d, z0 + d / ZS)])}" fill="#24140a" opacity="0.38"/>')
    c.add(c.on(c.m_bface(b), "".join(out)))


def shutter_panel(x, y0, w, h, side="left"):
    """One louvred shutter in ACCENT greys (face-local coords, y up)."""
    lit = side == "left"
    base_ = ACCENT["mid"] if lit else ACCENT["shade"]
    out = [f'<rect x="{f(x)}" y="{f(y0)}" width="{f(w)}" height="{f(h)}" fill="{base_}"/>',
           f'<rect x="{f(x)}" y="{f(y0)}" width="0.7" height="{f(h)}" fill="{ACCENT["lit"]}"/>',
           f'<rect x="{f(x + w - 0.6)}" y="{f(y0)}" width="0.6" height="{f(h)}" fill="{ACCENT["dark"]}"/>']
    n = max(3, int(h / 1.6))
    for i in range(n):
        yy = y0 + 1.1 + i * (h - 1.6) / n
        out.append(f'<rect x="{f(x + 0.8)}" y="{f(yy)}" width="{f(w - 1.5)}" height="0.55" fill="{ACCENT["dark"]}"/>'
                   f'<rect x="{f(x + 0.8)}" y="{f(yy + 0.55)}" width="{f(w - 1.5)}" height="0.35" fill="{ACCENT["lit"]}" opacity="0.8"/>')
    return "".join(out)


def window_b(c, b, x0, x1, z0, z1, reveal=2.4, shutters=True):
    """Window on a left (+b) wall: frame, dark glass, reveal, sill, open shutters (ACCENT)."""
    d = reveal
    g = c.lin("win", 0, z0, 0, z1, [(0, "#3c4a58"), (1, "#222c37")])
    out = [f'<rect x="{f(x0 - 1.2)}" y="{f(z0 - 1.2)}" width="{f(x1 - x0 + 2.4)}" height="{f(z1 - z0 + 2.4)}" fill="#ebe3d2"/>',
           f'<rect x="{f(x0)}" y="{f(z0)}" width="{f(x1 - x0)}" height="{f(z1 - z0)}" fill="{g}"/>',
           f'<rect x="{f((x0 + x1) / 2 + 0.8)}" y="{f(z0)}" width="0.7" height="{f(z1 - z0)}" fill="#5e3b22" opacity="0.8"/>',
           f'<rect x="{f(x0)}" y="{f(z0 + (z1 - z0) * 0.6)}" width="{f(x1 - x0)}" height="0.6" fill="#5e3b22" opacity="0.6"/>',
           f'<path d="{poly([(x0, z0), (x0, z1), (x0 + d, z1), (x0 + d, z0 + d / ZS)])}" fill="#b9af9c"/>',
           f'<path d="{poly([(x0, z0), (x1, z0), (x1, z0 + d / ZS), (x0 + d, z0 + d / ZS)])}" fill="#efe8d9"/>',
           f'<rect x="{f(x0 - 2.2)}" y="{f(z0 - 2.6)}" width="{f(x1 - x0 + 4.4)}" height="1.6" fill="#d5ccb9"/>',
           f'<rect x="{f(x0 - 2.2)}" y="{f(z0 - 1.2)}" width="{f(x1 - x0 + 4.4)}" height="0.5" fill="#fbf8ef"/>']
    sw = (x1 - x0) / 2
    for sx in (x0 - sw - 0.6, x1 + 0.6):
        out.append(f'<rect x="{f(sx + 0.9)}" y="{f(z0 - 0.9)}" width="{f(sw)}" height="{f(z1 - z0)}" fill="#4d4638" opacity="0.18"/>')
    c.add(c.on(c.m_bface(b), "".join(out)))
    if shutters:
        c.accent(c.on(c.m_bface(b), "".join(shutter_panel(sx, z0, sw, z1 - z0) for sx in (x0 - sw - 0.6, x1 + 0.6))))


def window_a(c, a, x0, x1, z0, z1):
    """Small window with closed shutters (ACCENT) on a right (+a) wall; local x = -b."""
    c.add(c.on(c.m_aface(a), f'<rect x="{f(x0 - 1)}" y="{f(z0 - 1.6)}" width="{f(x1 - x0 + 2)}" height="1.6" fill="#a7a49c"/>'))
    w = (x1 - x0) / 2
    c.accent(c.on(c.m_aface(a), shutter_panel(x0, z0, w - 0.15, z1 - z0, "right") + shutter_panel(x0 + w + 0.15, z0, w - 0.15, z1 - z0, "right")
                  + f'<rect x="{f(x0 + w - 0.3)}" y="{f(z0)}" width="0.6" height="{f(z1 - z0)}" fill="{ACCENT["deep"]}"/>'))


# ---------------------------------------------------------------------------
# Roofs (barrel tiles)
# ---------------------------------------------------------------------------
def tile_roof_a(c, AV, BV, ZR, tanp, T=3.8, n=12, courses=5, pal=TERRACOTTA, seed=99):
    """Gable roof with the ridge along a (at b=0). Front slope faces the viewer (lit).
    AV: half length incl. gable overhang; BV: half depth incl. eave overhang;
    ZR: height of the tile top at the ridge; tanp: rise per unit of b; T: tile thickness.
    Draws: back slope sliver, front slope with barrel tiles, eave tile ends, right verge, ridge."""
    pitch = 2 * AV / n
    wc = pitch * 0.56
    ZE = ZR - BV * tanp
    # back slope (visible as a sliver for pitches below ~39 deg)
    rb = c.lin("rb", -AV, 0, AV, 0, [(0, "#b9583c" if pal is TERRACOTTA else pal["base"]), (1, pal["shade"])])
    covb = c.lin("covb", 0, 0, 1, 0, [(0, pal["lit"]), (0.3, pal["base"]), (1, pal["shade"])], bbox=True)
    s = [f'<rect x="{f(-AV)}" y="{f(-BV)}" width="{f(2 * AV)}" height="{f(BV)}" fill="{rb}"/>']
    for i in range(n):
        xc = -AV + pitch * (i + 0.5)
        s.append(f'<rect x="{f(xc + wc / 2)}" y="{f(-BV)}" width="{f(pitch * 0.2)}" height="{f(BV)}" fill="{pal["dark"]}" opacity="0.35"/>'
                 f'<rect x="{f(xc - wc / 2)}" y="{f(-BV)}" width="{f(wc)}" height="{f(BV)}" fill="{covb}"/>')
    for j in range(1, courses):
        s.append(f'<rect x="{f(-AV)}" y="{f(-j * BV / courses)}" width="{f(2 * AV)}" height="1.1" fill="{pal["dark"]}" opacity="0.35"/>')
    s.append(f'<rect x="{f(-AV)}" y="{f(-BV)}" width="0.9" height="{f(BV)}" fill="{pal["lip"]}" opacity="0.7"/>'
             f'<rect x="{f(-AV)}" y="{f(-BV)}" width="{f(2 * AV)}" height="1.2" fill="{pal["lip"]}" opacity="0.5"/>')
    c.add(c.on(c.m_slope_b(ZR, tanp, -1), "".join(s)))

    # front slope
    rf = c.lin("rf", -AV, 0, AV, 0, [(0, "#cf6a45" if pal is TERRACOTTA else pal["lit"]), (0.5, pal["base"]), (1, "#a94b33" if pal is TERRACOTTA else pal["shade"])])
    cov = c.lin("cov", 0, 0, 1, 0, [(0, pal["hi"]), (0.22, pal["lit"]), (0.6, pal["base"]), (1, pal["shade"])], bbox=True)
    lc = BV / courses
    s = [f'<rect x="{f(-AV)}" y="0" width="{f(2 * AV)}" height="{f(BV)}" fill="{rf}"/>']
    for j in range(1, courses):
        s.append(f'<rect x="{f(-AV)}" y="{f(j * lc)}" width="{f(2 * AV)}" height="0.8" fill="{pal["deep"]}" opacity="0.35"/>'
                 f'<rect x="{f(-AV)}" y="{f(j * lc - 0.6)}" width="{f(2 * AV)}" height="0.6" fill="{pal["lip"]}" opacity="0.35"/>')
    rv = random.Random(seed)
    for i in range(n):
        xc = -AV + pitch * (i + 0.5)
        x0 = xc - wc / 2
        s.append(f'<rect x="{f(x0 + wc)}" y="0" width="{f(pitch * 0.2)}" height="{f(BV)}" fill="{pal["dark"]}" opacity="0.4"/>'
                 f'<rect x="{f(x0)}" y="0" width="{f(wc)}" height="{f(BV)}" fill="{cov}"/>')
        for j in range(1, courses + 1):
            y = j * lc
            s.append(f'<path d="M{f(x0)},{f(y - 0.9)} Q{f(xc)},{f(y + 0.9)} {f(x0 + wc)},{f(y - 0.9)} L{f(x0 + wc)},{f(y - 0.3)} Q{f(xc)},{f(y + 1.6)} {f(x0)},{f(y - 0.3)}Z" fill="{pal["lip"]}" opacity="0.75"/>')
            if j < courses:
                s.append(f'<path d="M{f(x0)},{f(y - 0.3)} Q{f(xc)},{f(y + 1.6)} {f(x0 + wc)},{f(y - 0.3)} L{f(x0 + wc)},{f(y + 0.9)} Q{f(xc)},{f(y + 2.6)} {f(x0)},{f(y + 0.9)}Z" fill="{pal["dark"]}" opacity="0.5"/>')
        for j in range(courses):
            t = rv.uniform(-1, 1)
            s.append(f'<rect x="{f(x0)}" y="{f(j * lc + 0.6)}" width="{f(wc)}" height="{f(lc - 0.6)}" fill="{"#ffe2c8" if t > 0 else "#4a1a10"}" opacity="{f(abs(t) * (0.16 if t > 0 else 0.2))}"/>')
    sheen = c.rad("sheen", -AV * 0.55, BV * 0.15, AV * 1.1, [(0, "#ffd9b0", 0.32), (0.6, "#ffd9b0", 0.08), (1, "#ffd9b0", 0)])
    shade = c.lin("eaveshade", 0, 0, 0, BV, [(0, "#4a1a10", 0), (0.7, "#4a1a10", 0), (1, "#4a1a10", 0.18)])
    s.append(f'<rect x="{f(-AV)}" y="0" width="{f(2 * AV)}" height="{f(BV)}" fill="{sheen}"/>'
             f'<rect x="{f(-AV)}" y="0" width="{f(2 * AV)}" height="{f(BV)}" fill="{shade}"/>'
             f'<rect x="{f(-AV)}" y="0" width="0.9" height="{f(BV)}" fill="#f7c09f" opacity="0.8"/>')
    c.add(c.on(c.m_slope_b(ZR, tanp), "".join(s)))

    # front eave: fascia + round tile ends
    e = [f'<rect x="{f(-AV)}" y="{f(ZE - T)}" width="{f(2 * AV)}" height="{f(T)}" fill="{pal["shade"]}"/>',
         f'<rect x="{f(-AV)}" y="{f(ZE - T)}" width="{f(2 * AV)}" height="0.7" fill="{pal["deep"]}" opacity="0.6"/>']
    for i in range(n):
        xc = -AV + pitch * (i + 0.5)
        rr = wc / 2
        e.append(f'<path d="M{f(xc - rr)},{f(ZE - 0.6)} A{f(rr)},{f(rr * 0.95)} 0 0 0 {f(xc + rr)},{f(ZE - 0.6)}Z" fill="{pal["lit"]}"/>'
                 f'<path d="M{f(xc - rr + 0.8)},{f(ZE - 0.6)} A{f(rr - 0.8)},{f(rr * 0.95 - 0.8)} 0 0 0 {f(xc + rr - 0.8)},{f(ZE - 0.6)}Z" fill="{pal["deep"]}"/>')
    c.add(c.on(c.m_bface(BV), "".join(e)))

    # right verge (edge of the tile layer seen from the gable side)
    v = [f'<path d="{poly([(-BV, ZE), (0, ZR), (BV, ZE), (BV, ZE - T), (0, ZR - T), (-BV, ZE - T)])}" fill="{pal["shade"]}"/>',
         f'<path d="M{f(-BV)},{f(ZE)} L0,{f(ZR)} L{f(BV)},{f(ZE)}" fill="none" stroke="{pal["base"]}" stroke-width="1.3" stroke-linejoin="round"/>',
         f'<path d="M{f(-BV)},{f(ZE - T)} L{f(-BV)},{f(ZE + 0.6)} Q{f(-BV + 2.2)},{f(ZE + 2.6)} {f(-BV + 4.2)},{f(ZE + 0.2)} L{f(-BV + 4.2)},{f(ZE - T)}Z" fill="{pal["base"]}"/>',
         f'<path d="M{f(-BV + 0.7)},{f(ZE - T + 0.6)} L{f(-BV + 0.7)},{f(ZE)} Q{f(-BV + 2.2)},{f(ZE + 1.6)} {f(-BV + 3.5)},{f(ZE - 0.2)} L{f(-BV + 3.5)},{f(ZE - T + 0.6)}Z" fill="{pal["deep"]}"/>']
    for sgn in (-1, 1):
        for j in range(1, courses):
            bb = j * BV / courses
            v.append(f'<rect x="{f(sgn * bb - 0.35)}" y="{f(ZR - bb * tanp - T)}" width="0.7" height="{f(T)}" fill="{pal["deep"]}" opacity="0.55"/>')
    c.add(c.on(c.m_aface(AV), "".join(v)))

    # ridge cap
    rg = c.lin("ridge", 0, ZR + 2.2, 0, ZR - 1.2, [(0, pal["hi"]), (0.5, pal["base"]), (1, pal["shade"])])
    r = [f'<rect x="{f(-AV - 0.5)}" y="{f(ZR - 1.2)}" width="{f(2 * AV + 1)}" height="3.4" rx="1.3" fill="{rg}"/>']
    seg = (2 * AV + 1) / 9
    for i in range(1, 9):
        xx = -AV - 0.5 + i * seg
        r.append(f'<rect x="{f(xx)}" y="{f(ZR - 1.2)}" width="0.6" height="3.4" fill="{pal["dark"]}" opacity="0.55"/>'
                 f'<rect x="{f(xx - 0.6)}" y="{f(ZR - 1)}" width="0.6" height="3" fill="{pal["hi"]}" opacity="0.6"/>')
    c.add(c.on(c.m_bface(0), "".join(r)))
    x, y = c.P(AV + 0.5, 0, ZR + 0.5)
    c.add(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="1.5" ry="2.1" fill="{pal["shade"]}"/><ellipse cx="{f(x + 0.2)}" cy="{f(y + 0.2)}" rx="0.85" ry="1.4" fill="{pal["deep"]}"/>')
    return ZE


def tile_roof_b(c, KA, KB, ZEAV, rise, rows=13, courses=4, pal=TERRACOTTA, seed=77, antefix=True):
    """Low gable roof with the ridge along b (at a=0): both slopes visible (temple / stoa).
    KA: half width at the eaves; KB: half length; ZEAV: tile top at the eaves; rise: ridge rise.
    Returns the ridge height. Draw the front pediment afterwards (pediment_b)."""
    tanp = rise / KA
    ZRID = ZEAV + rise
    pitch = 2 * KB / rows
    wc = pitch * 0.55
    rv = random.Random(seed)
    tl = c.lin("tL", 0, 1, 0, 0, [(0, pal["hi"]), (0.3, pal["lit"]), (0.75, pal["base"]), (1, pal["shade"])], bbox=True)
    tr = c.lin("tR", 0, 1, 0, 0, [(0, pal["lit"]), (0.3, pal["base"]), (0.75, pal["shade"]), (1, pal["dark"])], bbox=True)
    for sign, fill, cov, sop in ((-1, pal["lit"] if pal is not TERRACOTTA else "#c86444", tl, 0.3), (1, pal["base"] if pal is not TERRACOTTA else "#a9492f", tr, 0.4)):
        x0 = 0 if sign > 0 else -KA
        g = [f'<rect x="{f(x0)}" y="{f(-KB)}" width="{f(KA)}" height="{f(2 * KB)}" fill="{fill}"/>']
        for j in range(1, courses):
            g.append(f'<rect x="{f(j * KA / courses * sign - 0.4)}" y="{f(-KB)}" width="0.8" height="{f(2 * KB)}" fill="{pal["dark"]}" opacity="0.3"/>')
        for i in range(rows):
            yc = -KB + pitch * (i + 0.5)
            g.append(f'<rect x="{f(x0)}" y="{f(yc - wc / 2 - pitch * 0.2)}" width="{f(KA)}" height="{f(pitch * 0.2)}" fill="{pal["deep"]}" opacity="{f(sop)}"/>'
                     f'<rect x="{f(x0)}" y="{f(yc - wc / 2)}" width="{f(KA)}" height="{f(wc)}" fill="{cov}"/>')
            for j in range(courses):
                tv = rv.uniform(-1, 1)
                xa = j * KA / courses * sign
                g.append(f'<rect x="{f(min(xa, xa + sign * KA / courses))}" y="{f(yc - wc / 2)}" width="{f(KA / courses)}" height="{f(wc)}" fill="{"#ffe2c8" if tv > 0 else "#4a1a10"}" opacity="{f(abs(tv) * (0.16 if tv > 0 else 0.2))}"/>')
            for j in range(1, courses + 1):
                xx = j * KA / courses * sign
                lip = 0.9 * sign
                g.append(f'<path d="M{f(xx - lip)},{f(yc - wc / 2)} Q{f(xx + lip)},{f(yc)} {f(xx - lip)},{f(yc + wc / 2)} L{f(xx - lip * 0.3)},{f(yc + wc / 2)} Q{f(xx + lip * 1.7)},{f(yc)} {f(xx - lip * 0.3)},{f(yc - wc / 2)}Z" fill="{pal["lip"]}" opacity="0.6"/>')
        if sign > 0:
            sh = c.rad("tsheen", KA * 0.2, -KB * 0.2, KB * 1.1, [(0, "#ffd9b0", 0.26), (0.6, "#ffd9b0", 0.06), (1, "#ffd9b0", 0)])
            g.append(f'<rect x="0" y="{f(-KB)}" width="{f(KA)}" height="{f(2 * KB)}" fill="{sh}"/>')
        c.add(c.on(c.m_slope_a(ZRID, tanp, sign), "".join(g)))
        if sign < 0 and antefix:
            a_ = []
            for i in range(rows):
                yc = -KB + pitch * (i + 0.5)
                a_.append(f'<path d="M{f(-yc - 1.1)},{f(ZEAV - 0.5)} L{f(-yc - 1.1)},{f(ZEAV + 0.6)} Q{f(-yc)},{f(ZEAV + 2.1)} {f(-yc + 1.1)},{f(ZEAV + 0.6)} L{f(-yc + 1.1)},{f(ZEAV - 0.5)}Z" fill="{pal["shade"]}"/>')
            c.add(c.on(c.m_aface(-KA), "".join(a_)))
    rdg = c.lin("rdg", 0, ZRID + 2, 0, ZRID - 1, [(0, pal["hi"]), (0.5, pal["base"]), (1, pal["shade"])])
    c.add(c.on(c.m_aface(0), f'<rect x="{f(-KB)}" y="{f(ZRID - 1)}" width="{f(2 * KB)}" height="2.8" rx="1.1" fill="{rdg}"/>'))
    TT = 1.8
    g = [f'<rect x="{f(-KB)}" y="{f(ZEAV - TT)}" width="{f(2 * KB)}" height="{f(TT)}" fill="{pal["shade"]}"/>']
    if antefix:
        for i in range(rows):
            x = -(-KB + pitch * (i + 0.5))
            g.append(f'<path d="M{f(x - 1.3)},{f(ZEAV - 0.4)} L{f(x - 1.3)},{f(ZEAV + 0.9)} Q{f(x)},{f(ZEAV + 2.8)} {f(x + 1.3)},{f(ZEAV + 0.9)} L{f(x + 1.3)},{f(ZEAV - 0.4)}Z" fill="{pal["base"]}"/>'
                     f'<path d="M{f(x)},{f(ZEAV - 0.2)} L{f(x - 0.7)},{f(ZEAV + 1.2)} M{f(x)},{f(ZEAV - 0.2)} L{f(x)},{f(ZEAV + 1.8)} M{f(x)},{f(ZEAV - 0.2)} L{f(x + 0.7)},{f(ZEAV + 1.2)}" stroke="#f1d9b0" stroke-width="0.3" stroke-linecap="round" opacity="0.6"/>')
    c.add(c.on(c.m_aface(KA), "".join(g)))
    return ZRID


# ---------------------------------------------------------------------------
# Round solids: cylinders and cone roofs (towers, tholoi, wells, lighthouses)
# ---------------------------------------------------------------------------
def cylinder(c, r, z0, z1, side, top=None, name="cyl"):
    """Vertical cylinder of radius r around the origin (use c.at() to move it).
    side: list of gradient stops across the visible side (left = lit); top: fill or None."""
    x, y0 = c.P(0, 0, z0)
    _, y1 = c.P(0, 0, z1)
    rx = r * math.sqrt(2)
    ry = rx / 2
    g = c.lin(name, x - rx, 0, x + rx, 0, side)
    c.add(f'<path d="M{f(x - rx)},{f(y1)} L{f(x - rx)},{f(y0)} A{f(rx)},{f(ry)} 0 0 0 {f(x + rx)},{f(y0)} L{f(x + rx)},{f(y1)} A{f(rx)},{f(ry)} 0 0 1 {f(x - rx)},{f(y1)}Z" fill="{g}"/>')
    if top:
        c.add(f'<ellipse cx="{f(x)}" cy="{f(y1)}" rx="{f(rx)}" ry="{f(ry)}" fill="{top}"/>')


def ring_front_arc(c, r, z, inset=0.0):
    """Path of the visible (front) half of a ring of radius r at height z."""
    x, y = c.P(0, 0, z)
    rx = r * math.sqrt(2) - inset
    return f"M{f(x - rx)},{f(y)} A{f(rx)},{f(rx / 2)} 0 0 0 {f(x + rx)},{f(y)}"


def cone_roof(c, r, z_eave, rise, pal=TERRACOTTA, tiles=26, courses=4, finial=True):
    """Conical barrel-tile roof (eave radius r at height z_eave, apex rise above it)."""
    x, ye = c.P(0, 0, z_eave)
    rx = r * math.sqrt(2)
    ry = rx / 2
    hA = rise * ZS
    ax, ay = x, ye - hA
    st = max(-1.0, -ry / hA) if hA > ry else -1.0
    t0 = math.asin(st)                       # right tangent point
    t1 = math.pi - t0                        # left tangent point (going through the front)
    def pt(t, s=1.0):
        return (x + rx * s * math.cos(t), ye - hA * (1 - s) + ry * s * math.sin(t))
    n = 40
    arc = [pt(t1 - (t1 - t0) * i / n) for i in range(n + 1)]   # left tangent -> front -> right tangent
    g = c.lin("cone", x - rx, 0, x + rx, 0, [(0, pal["lit"]), (0.35, pal["base"]), (0.8, pal["shade"]), (1, pal["dark"])])
    silhouette = poly([(ax, ay)] + arc)
    c.add(f'<path d="{silhouette}" fill="{g}"/>')
    clip = "cone" + f(x).replace(".", "_") + "_" + f(ye).replace(".", "_")
    c.define(clip, f'<clipPath id="{c.id(clip)}"><path d="{silhouette}"/></clipPath>')
    out = [f'<g clip-path="{c.url(clip)}">']
    # cover-tile rows converging on the apex (only the visible front part of the cone)
    nvis = max(3, round(tiles * (t1 - t0) / (2 * math.pi)))
    vis = [t0 + (t1 - t0) * (i + 0.5) / nvis for i in range(nvis)]
    for t in vis:
        dt = math.pi / tiles * 0.5
        p1, p2 = pt(t - dt), pt(t + dt)
        light = math.cos(t + 0.6)            # tiles facing the upper left catch the sun
        col = pal["hi"] if light < -0.2 else pal["lit"]
        out.append(f'<path d="M{f(ax)},{f(ay)} L{f(p1[0])},{f(p1[1])} L{f(p2[0])},{f(p2[1])}Z" fill="{col}" opacity="{f(0.35 + 0.3 * max(0, -light))}"/>')
        q = pt(t + dt * 1.6)
        out.append(f'<path d="M{f(ax)},{f(ay)} L{f(p2[0])},{f(p2[1])} L{f(q[0])},{f(q[1])}Z" fill="{pal["dark"]}" opacity="0.35"/>')
    # courses: concentric arcs
    for j in range(1, courses + 1):
        s_ = j / (courses + 0.4)
        ptsj = [pt(t1 - (t1 - t0) * i / n, s_) for i in range(n + 1)]
        out.append(f'<path d="M{" L".join(f"{f(px)},{f(py)}" for px, py in ptsj)}" fill="none" stroke="{pal["deep"]}" stroke-width="0.8" opacity="0.4"/>'
                   f'<path d="M{" L".join(f"{f(px)},{f(py - 0.7)}" for px, py in ptsj)}" fill="none" stroke="{pal["lip"]}" stroke-width="0.6" opacity="0.5"/>')
    sh = c.rad("conesheen", ax - rx * 0.35, ay + hA * 0.5, rx, [(0, "#ffd9b0", 0.3), (1, "#ffd9b0", 0)])
    out.append(f'<path d="{silhouette}" fill="{sh}"/></g>')
    # eave edge: thickness + tile ends
    out.append(f'<path d="M{" L".join(f"{f(px)},{f(py)}" for px, py in arc)} L{" L".join(f"{f(px)},{f(py + 2.2)}" for px, py in reversed(arc))}Z" fill="{pal["shade"]}"/>')
    for t in vis:
        if 0.35 < t < math.pi - 0.35:          # tile ends only where the eave faces the viewer
            px, py = pt(t)
            out.append(f'<ellipse cx="{f(px)}" cy="{f(py + 0.7)}" rx="1.1" ry="0.85" fill="{pal["lit"]}"/><ellipse cx="{f(px)}" cy="{f(py + 0.9)}" rx="0.6" ry="0.45" fill="{pal["deep"]}"/>')
    c.add("".join(out))
    if finial:
        c.add(f'<ellipse cx="{f(ax)}" cy="{f(ay + 0.6)}" rx="2.6" ry="1.2" fill="{GOLD["shade"]}"/>'
              f'<path d="M{f(ax - 1.8)},{f(ay)} Q{f(ax - 2.2)},{f(ay - 4)} {f(ax)},{f(ay - 7.5)} Q{f(ax + 2.2)},{f(ay - 4)} {f(ax + 1.8)},{f(ay)}Z" fill="{GOLD["base"]}"/>'
              f'<path d="M{f(ax - 1.2)},{f(ay - 0.4)} Q{f(ax - 1.6)},{f(ay - 3.6)} {f(ax)},{f(ay - 7)}" fill="none" stroke="{GOLD["hi"]}" stroke-width="0.7"/>')
    return ay


# ---------------------------------------------------------------------------
# Classical architecture: Doric column, entablature, pediment
# ---------------------------------------------------------------------------
def doric_column(c, ca, cb, z0, z1, rb=3.0, rt=2.5, dark=False, cap=4.1):
    """Fluted Doric column (shaft z0..z1, then echinus + abacus). Returns the abacus top z."""
    col = c.lin("col", 0, 0, 1, 0, [(0, "#d6d4cb"), (0.14, "#fbfaf4"), (0.36, "#f1eee4"), (0.62, "#c9cac5"), (0.86, "#a7aaab"), (1, "#b8b6ae")], bbox=True)
    colD = c.lin("colD", 0, 0, 1, 0, [(0, "#b9b8b0"), (0.18, "#d9d7cf"), (0.5, "#bdbfbb"), (0.85, "#929698"), (1, "#a09f99")], bbox=True)
    grad = colD if dark else col
    x, yb = c.P(ca, cb, z0)
    _, yt = c.P(ca, cb, z1)
    rxb, rxt = rb * math.sqrt(2), rt * math.sqrt(2)
    ryb = rxb / 2
    out = [f'<ellipse cx="{f(x + 0.8)}" cy="{f(yb + 0.6)}" rx="{f(rxb + 0.8)}" ry="{f(ryb + 0.4)}" fill="#3e3a32" opacity="0.35" filter="{c.blur(0.45)}"/>']
    mid = (yb + yt) / 2
    out.append(f'<path d="M{f(x - rxb)},{f(yb)} Q{f(x - (rxb + rxt) / 2 - 0.35)},{f(mid)} {f(x - rxt)},{f(yt)} L{f(x + rxt)},{f(yt)} Q{f(x + (rxb + rxt) / 2 + 0.35)},{f(mid)} {f(x + rxb)},{f(yb)} A{f(rxb)},{f(ryb)} 0 0 1 {f(x - rxb)},{f(yb)}Z" fill="{grad}"/>')
    for k in range(1, 10):
        th = -math.pi / 2 + k * math.pi / 10
        s, vis = math.sin(th), math.cos(th)
        out.append(f'<path d="M{f(x + rxb * s)},{f(yb + ryb * vis * 0.9)} L{f(x + rxt * s)},{f(yt + 0.5)}" stroke="#6f726f" stroke-width="0.45" opacity="{f(0.22 + 0.18 * vis)}"/>')
        if s < 0.2:
            out.append(f'<path d="M{f(x + rxb * s - 0.5)},{f(yb + ryb * vis * 0.9)} L{f(x + rxt * s - 0.45)},{f(yt + 0.5)}" stroke="#fff" stroke-width="0.4" opacity="{f(0.35 * vis)}"/>')
    out.append(f'<path d="M{f(x - rxt)},{f(yt + 2)} A{f(rxt)},{f(rxt / 2)} 0 0 0 {f(x + rxt)},{f(yt + 2)}" fill="none" stroke="#7d7f7c" stroke-width="0.5" opacity="0.6"/>')
    zec = z1 + 1.9
    _, ye = c.P(ca, cb, zec)
    rxe = (cap - 0.2) * math.sqrt(2)
    out.append(f'<path d="M{f(x - rxt)},{f(yt)} C{f(x - rxt - 1)},{f(yt - 0.6)} {f(x - rxe)},{f(ye + 1.4)} {f(x - rxe)},{f(ye)} L{f(x + rxe)},{f(ye)} C{f(x + rxe)},{f(ye + 1.4)} {f(x + rxt + 1)},{f(yt - 0.6)} {f(x + rxt)},{f(yt)} A{f(rxt)},{f(rxt / 2)} 0 0 1 {f(x - rxt)},{f(yt)}Z" fill="{grad}"/>'
               f'<path d="M{f(x - rxe)},{f(ye)} A{f(rxe)},{f(rxe / 2)} 0 0 0 {f(x + rxe)},{f(ye)}" fill="{grad}"/>'
               f'<path d="M{f(x - rxe + 0.6)},{f(ye + 0.4)} A{f(rxe)},{f(rxe / 2)} 0 0 0 {f(x + rxe - 0.6)},{f(ye + 0.4)}" fill="none" stroke="#fff" stroke-width="0.5" opacity="{0.25 if dark else 0.6}"/>')
    c.add("".join(out))
    zab = zec + 1.6
    s = cap
    c.add(c.on(c.m_bface(cb + s), f'<rect x="{f(ca - s)}" y="{f(zec)}" width="{f(2 * s)}" height="{f(zab - zec)}" fill="{"#cfcbc0" if dark else MARBLE["left"]}"/>'))
    c.add(c.on(c.m_aface(ca + s), f'<rect x="{f(-cb - s)}" y="{f(zec)}" width="{f(2 * s)}" height="{f(zab - zec)}" fill="{"#9a9d9e" if dark else MARBLE["right"]}"/>'))
    return zab


def column_shadow(c, ca, cb, z, rb=3.0, length=10):
    """Short soft shadow of a column on the floor, falling toward +a."""
    p = [c.P(ca, cb - rb, z), c.P(ca + length, cb - rb * 0.8, z), c.P(ca + length, cb + rb * 0.8, z), c.P(ca, cb + rb, z)]
    c.add(f'<path d="{poly(p)}" fill="#3e3b35" opacity="0.38" filter="{c.blur(0.45)}"/>')


def entablature(c, ea, eb, z0, ka=None, kb=None, front_n=7, side_n=11, triglyph="#2d4f78", red="#a8432f",
                arch_h=5.2, frieze_h=5.4, cornice_h=2.6):
    """Architrave + triglyph frieze + projecting cornice on the +b (front) and +a (side) faces.
    (ea, eb): half extents of the architrave faces; (ka, kb): of the cornice (default +1.5).
    Returns the cornice top z."""
    ka = ka if ka is not None else ea + 1.5
    kb = kb if kb is not None else eb + 1.5
    zar, zfr = z0 + arch_h, z0 + arch_h + frieze_h
    zco = zfr + cornice_h
    enl = c.lin("enL", -ea, 0, ea, 0, [(0, "#f3efe4"), (1, "#e2dccd")])
    enr = c.lin("enR", -eb, 0, eb, 0, [(0, "#c4c6c3"), (1, "#b3b6b5")])
    for front in (True, False):
        x0, x1 = (-ea, ea) if front else (-eb, eb)
        n = front_n if front else side_n
        trig = triglyph if front else "#203a5a"
        g = [f'<rect x="{f(x0)}" y="{f(z0)}" width="{f(x1 - x0)}" height="{f(zfr - z0)}" fill="{enl if front else enr}"/>',
             f'<rect x="{f(x0)}" y="{f(z0 + arch_h / 2)}" width="{f(x1 - x0)}" height="0.4" fill="#8c877b" opacity="0.45"/>',
             f'<rect x="{f(x0)}" y="{f(zar - 0.9)}" width="{f(x1 - x0)}" height="0.9" fill="#fff" opacity="0.55"/>',
             f'<rect x="{f(x0)}" y="{f(zar - 1.3)}" width="{f(x1 - x0)}" height="0.4" fill="#6f6a60" opacity="0.4"/>']
        tw = 2.7
        for i in range(n):
            xc = x0 + tw / 2 + i * (x1 - x0 - tw) / (n - 1)
            g.append(f'<rect x="{f(xc - tw / 2)}" y="{f(zar)}" width="{f(tw)}" height="{f(frieze_h)}" fill="{trig}"/>')
            for gx in (-0.45, 0.45):
                g.append(f'<rect x="{f(xc + gx - 0.18)}" y="{f(zar + 0.6)}" width="0.36" height="{f(frieze_h - 1.4)}" fill="#7fa0c8" opacity="0.7"/>')
            g.append(f'<rect x="{f(xc - tw / 2)}" y="{f(zar - 2.2)}" width="{f(tw)}" height="0.8" fill="#9c968a" opacity="0.7"/>')
        g.append(f'<rect x="{f(x0)}" y="{f(zfr - 0.7)}" width="{f(x1 - x0)}" height="0.7" fill="{red}"/>')
        g.append(f'<rect x="{f(x0)}" y="{f(zfr - 1.6)}" width="{f(x1 - x0)}" height="1.6" fill="#2d2a26" opacity="0.22"/>')
        c.add(c.on(c.m_bface(eb) if front else c.m_aface(ea), "".join(g)))
    c.add(c.on(c.m_bface(kb), f'<rect x="{f(-ka)}" y="{f(zfr)}" width="{f(2 * ka)}" height="{f(cornice_h)}" fill="#f2eee3"/>'
               f'<rect x="{f(-ka)}" y="{f(zfr)}" width="{f(2 * ka)}" height="0.6" fill="#8f8a7f" opacity="0.6"/>'
               f'<rect x="{f(-ka)}" y="{f(zco - 0.6)}" width="{f(2 * ka)}" height="0.6" fill="#fff"/>'))
    c.add(c.on(c.m_aface(ka), f'<rect x="{f(-kb)}" y="{f(zfr)}" width="{f(2 * kb)}" height="{f(cornice_h)}" fill="#c9cbc8"/>'
               f'<rect x="{f(-kb)}" y="{f(zfr)}" width="{f(2 * kb)}" height="0.6" fill="#6b6d6b" opacity="0.6"/>'
               f'<rect x="{f(-kb)}" y="{f(zco - 0.5)}" width="{f(2 * kb)}" height="0.5" fill="#e8e8e2"/>'))
    return zco


def pediment_b(c, ka, kb, zco, rise, sculpture=True, tympanum_accent=True, sima=TERRACOTTA["base"]):
    """Front gable (plane b=kb): painted tympanum (ACCENT by default), sculpture group,
    marble raking cornice with a terracotta sima, gilded acroteria."""
    apex = zco + rise
    tri = poly([(-ka, zco), (ka, zco), (0, apex)])
    if tympanum_accent:
        ty = c.lin("tym", 0, zco, 0, apex, [(0, ACCENT["shade"]), (1, ACCENT["light"])])
        c.accent(c.on(c.m_bface(kb), f'<path d="{tri}" fill="{ty}"/>'))
    else:
        ty = c.lin("tymB", 0, zco, 0, apex, [(0, "#24507c"), (1, "#3a6d9e")])
        c.add(c.on(c.m_bface(kb), f'<path d="{tri}" fill="{ty}"/>'))
    g = []
    if sculpture:
        g.append(f'<ellipse cx="0" cy="{f(zco + 3.4)}" rx="2.3" ry="2.3" fill="{BRONZE["base"]}"/><ellipse cx="-0.35" cy="{f(zco + 3.75)}" rx="1.7" ry="1.7" fill="{GOLD["base"]}"/><ellipse cx="-0.8" cy="{f(zco + 4.3)}" rx="0.6" ry="0.6" fill="{GOLD["hi"]}"/>')
        for fx, fh, fw in [(-4.6, 6.4, 1.25), (-8.6, 4.8, 1.2), (-12.8, 3.2, 1.25), (-17, 1.6, 1.6), (4.6, 6.4, 1.25), (8.6, 4.8, 1.2), (12.8, 3.2, 1.25), (17, 1.6, 1.6)]:
            fh = fh * rise / 11
            body = f"M{f(fx - fw)},{f(zco)} C{f(fx - fw)},{f(zco + fh * 0.7)} {f(fx - fw * 0.55)},{f(zco + fh)} {f(fx)},{f(zco + fh)} C{f(fx + fw * 0.55)},{f(zco + fh)} {f(fx + fw)},{f(zco + fh * 0.7)} {f(fx + fw)},{f(zco)}Z"
            lit = f"M{f(fx - fw)},{f(zco)} C{f(fx - fw)},{f(zco + fh * 0.7)} {f(fx - fw * 0.55)},{f(zco + fh)} {f(fx)},{f(zco + fh)} L{f(fx - fw * 0.1)},{f(zco)}Z"
            g.append(f'<path d="{body}" fill="#cfcabd"/><path d="{lit}" fill="#f4f0e6"/>')
            if fh > 2.5:
                g.append(f'<circle cx="{f(fx)}" cy="{f(zco + fh + 0.75)}" r="{f(fw * 0.62)}" fill="#ece7da"/>')
    g.append(f'<path d="{poly([(-ka + 2.8, zco), (0, apex - 2.0), (ka - 2.8, zco), (ka - 3.6, zco), (0, apex - 2.9), (-ka + 3.6, zco)])}" fill="#10233a" opacity="0.4"/>'
             f'<rect x="{f(-ka)}" y="{f(zco)}" width="{f(2 * ka)}" height="0.8" fill="#1d2b36" opacity="0.3"/>')
    rk_out = [(-ka - 0.6, zco - 0.2), (0, apex + 0.2), (ka + 0.6, zco - 0.2)]
    rk_in = [(ka - 2.8, zco), (0, apex - 2.0), (-ka + 2.8, zco)]
    g.append(f'<path d="{poly(rk_out + rk_in)}" fill="#f1ede2"/>'
             f'<path d="M{f(-ka + 2.8)},{f(zco)} L0,{f(apex - 2)} L{f(ka - 2.8)},{f(zco)}" fill="none" stroke="#8f8a7f" stroke-width="0.5" opacity="0.7"/>')
    sima_out = [(-ka - 0.8, zco + 1.4), (0, apex + 1.9), (ka + 0.8, zco + 1.4)]
    sima_in = [(ka + 0.6, zco - 0.2), (0, apex + 0.2), (-ka - 0.6, zco - 0.2)]
    g.append(f'<path d="{poly(sima_out + sima_in)}" fill="{sima}"/>'
             f'<path d="M{f(-ka - 0.7)},{f(zco + 0.6)} L0,{f(apex + 1.05)} L{f(ka + 0.7)},{f(zco + 0.6)}" fill="none" stroke="#f1d9b0" stroke-width="0.35" stroke-dasharray="0.9 0.9"/>'
             f'<path d="M{f(-ka - 0.8)},{f(zco + 1.4)} L0,{f(apex + 1.9)} L{f(ka + 0.8)},{f(zco + 1.4)}" fill="none" stroke="#fff" stroke-width="0.5" opacity="0.35"/>')
    c.add(c.on(c.m_bface(kb), "".join(g)))
    acroterion(c, 0, kb, apex + 1.9, 1.0)
    acroterion(c, -ka - 0.4, kb, zco + 1.4, 0.65)
    acroterion(c, ka + 0.4, kb, zco + 1.4, 0.65)
    return apex


def acroterion(c, a, b, z, k=1.0):
    """Gilded palmette ornament standing on a roof corner (plane b)."""
    g = [f'<path d="M{f(a - 1.4 * k)},{f(z)} L{f(a + 1.4 * k)},{f(z)} L{f(a + 0.6 * k)},{f(z + 1.2 * k)} L{f(a - 0.6 * k)},{f(z + 1.2 * k)}Z" fill="{GOLD["shade"]}"/>']
    for ang in (-55, -28, 0, 28, 55):
        r = (3.6 if ang == 0 else 3.0) * k
        th = math.radians(90 - ang)
        ex, ey = a + r * math.cos(th), z + 1.2 * k + r * math.sin(th)
        g.append(f'<path d="M{f(a)},{f(z + 1.2 * k)} Q{f(a + (ex - a) * 0.3 - 0.7 * k)},{f(z + 1.2 * k + (ey - z) * 0.6)} {f(ex)},{f(ey)} Q{f(a + (ex - a) * 0.6 + 0.7 * k)},{f(z + 1.2 * k + (ey - z) * 0.3)} {f(a)},{f(z + 1.2 * k)}Z" fill="{GOLD["lit"] if ang <= 0 else GOLD["mid"]}"/>')
    g.append(f'<circle cx="{f(a)}" cy="{f(z + 1.3 * k)}" r="{f(0.7 * k)}" fill="{GOLD["lit"]}"/>')
    c.add(c.on(c.m_bface(b), "".join(g)))


# ---------------------------------------------------------------------------
# Ground details
# ---------------------------------------------------------------------------
def flagstones(c, stones, z=1.0):
    """Stepping stones: list of (a, b, w, d, rotation_deg) in world units."""
    for a, b, w, d, rot in stones:
        r = f'<rect x="{f(-w / 2)}" y="{f(-d / 2)}" width="{f(w)}" height="{f(d)}" rx="2" transform="translate({f(a)} {f(b)}) rotate({f(rot)})"'
        c.add(c.on(c.m_ground(0), f'{r} fill="#9e9584"/>') + c.on(c.m_ground(z), f'{r} fill="#e4ddcd"/>'))


def paving(c, r, seed=12, avoid=None, slab=7.0):
    """Agora paving: irregular sandstone slabs on the ground inside radius r (world units)."""
    rnd = random.Random(seed)
    rxp = r * math.sqrt(2)
    cx, cy = c.P(0, 0, 0)
    c.add(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rxp)}" ry="{f(rxp / 2)}" fill="#cdb684"/>')
    out = []
    n = int(2 * r / slab) + 1
    for i in range(n):
        for j in range(n):
            a = -r + (i + 0.5) * slab + (slab / 2 if j % 2 else 0)
            b = -r + (j + 0.5) * slab
            if a * a + b * b > (r - slab * 0.4) ** 2 or (avoid and avoid(a, b)):
                continue
            w, d = slab - 0.7, slab - 0.7
            tone = rnd.choice(["#efe0b6", "#ebdaab", "#e6d4a2", "#f1e4bf", "#e9d7a8"])
            out.append(f'<rect x="{f(a - w / 2)}" y="{f(b - d / 2)}" width="{f(w)}" height="{f(d)}" rx="0.8" fill="{tone}"/>')
    c.add(c.on(c.m_ground(0), f'<g>{"".join(out)}</g>'))


def rocks(c, items):
    """Small rocks: list of (a, b, r, seed)."""
    for a, b, r_, seed in items:
        x, y = c.P(a, b, 0)
        c.add(f'<ellipse cx="{f(x + r_ * 0.9)}" cy="{f(y + 0.4)}" rx="{f(r_ * 1.5)}" ry="{f(r_ * 0.55)}" fill="#1f2e15" opacity="0.35" filter="{c.blur(0.45)}"/>'
              f'<path d="{puff(x, y - r_ * 0.45, r_ * 1.2, r_ * 0.75, n=6, seed=seed, bulge=1.12, jitter=0.2)}" fill="#8f877b"/>'
              f'<path d="{puff(x - r_ * 0.3, y - r_ * 0.7, r_ * 0.7, r_ * 0.4, n=5, seed=seed + 3, bulge=1.1)}" fill="#c4bdb0"/>')


# ---------------------------------------------------------------------------
# Props
# ---------------------------------------------------------------------------
def olive_tree(c, a, b, size=1.0, seed=5):
    """Olive tree: grey gnarled trunk, one broad silver-green crown."""
    x, y = c.P(a, b, 0)
    k = size
    rnd = random.Random(seed)
    blob_shadow(c, a + 11 * k, b - 2, 10 * k, 0.32)
    c.add(f'<ellipse cx="{f(x + 0.6)}" cy="{f(y + 0.4)}" rx="{f(4 * k)}" ry="{f(1.6 * k)}" fill="#24381a" opacity="0.45" filter="{c.blur(0.45)}"/>')
    tr = c.lin("trunk" + str(seed), x - 4 * k, 0, x + 4 * k, 0, [(0, "#a9a08f"), (0.45, "#827767"), (1, "#51483c")])
    c.add(f'<path d="M{f(x - 3.6 * k)},{f(y)} C{f(x - 1.4 * k)},{f(y - 5 * k)} {f(x - 4.4 * k)},{f(y - 9 * k)} {f(x - 3 * k)},{f(y - 13 * k)} L{f(x + 0.6 * k)},{f(y - 13.5 * k)} C{f(x - 0.2 * k)},{f(y - 9 * k)} {f(x + 3 * k)},{f(y - 5 * k)} {f(x + 3.4 * k)},{f(y)} Q{f(x)},{f(y + 1.3 * k)} {f(x - 3.6 * k)},{f(y)}Z" fill="{tr}"/>')
    for p0, p1, p2, w, col in [((-2.2, -12.5), (-7, -15), (-10.5, -19), 2.1, "#7d7262"), ((-0.8, -13), (0.5, -18), (-1.2, -24), 1.9, "#8b806f"), ((0, -12), (5.5, -14), (9.5, -18.5), 1.9, "#5e5547")]:
        c.add(f'<path d="M{f(x + p0[0] * k)},{f(y + p0[1] * k)} Q{f(x + p1[0] * k)},{f(y + p1[1] * k)} {f(x + p2[0] * k)},{f(y + p2[1] * k)}" fill="none" stroke="{col}" stroke-width="{f(w * k)}" stroke-linecap="round"/>')
    c.add(f'<path d="M{f(x - 2.8 * k)},{f(y - 1)} C{f(x - 1 * k)},{f(y - 5 * k)} {f(x - 3.6 * k)},{f(y - 9 * k)} {f(x - 2.4 * k)},{f(y - 12.5 * k)}" fill="none" stroke="#cfc7b5" stroke-width="{f(0.7 * k)}" opacity="0.8"/>')
    leaf = c.rad("leaf", 0.36, 0.28, 0.85, [(0, "#c3cc98"), (0.5, "#8f9d63"), (1, "#62703c")], bbox=True)
    puffs = [(0.5, -27.5, 11, 6.2, 11), (-10, -22.5, 7.8, 4.8, 12), (10.5, -22, 8, 4.8, 13), (-6.5, -30.5, 6.5, 3.8, 14), (6.5, -30.5, 6.4, 3.8, 15), (0, -21.5, 8, 4, 16)]
    c.add(f'<g fill="#3e4a26">' + "".join(f'<path d="{puff(x + (px + 0.9) * k, y + (py + 1.6) * k, rx * k, ry * k, n=9, seed=sd)}"/>' for px, py, rx, ry, sd in puffs) + "</g>")
    for px, py, rx, ry, sd in sorted(puffs, key=lambda p: -p[1]):
        c.add(f'<path d="{puff(x + px * k, y + py * k, rx * k * 0.96, ry * k * 0.96, n=9, seed=sd)}" fill="{leaf}"/>'
              f'<path d="{puff(x + (px + 0.6) * k, y + (py + ry * 0.55) * k, rx * 0.8 * k, ry * 0.32 * k, n=7, seed=sd + 7, bulge=1.2)}" fill="#55632f" opacity="0.45"/>')
    for px, py, rx, ry, sd in puffs[:5]:
        c.add(f'<path d="{puff(x + (px - rx * 0.25) * k, y + (py - ry * 0.35) * k, rx * 0.5 * k, ry * 0.4 * k, n=7, seed=sd + 50, bulge=1.35)}" fill="#d2d9ab" opacity="0.5"/>')
    fl = []
    for _ in range(22):
        px, py, rx, ry, sd = rnd.choice(puffs[:5])
        ang = rnd.uniform(math.pi, math.pi * 1.7)
        lx, ly = x + (px + rx * 0.8 * math.cos(ang)) * k, y + (py + ry * 0.8 * math.sin(ang)) * k
        fl.append(f'<ellipse cx="{f(lx)}" cy="{f(ly)}" rx="{f(1.4 * k)}" ry="{f(0.42 * k)}" transform="rotate({f(math.degrees(ang) + 90 + rnd.uniform(-25, 25))} {f(lx)} {f(ly)})" fill="#e6ebcb" opacity="0.55"/>')
    c.add("".join(fl))


def cypress(c, a, b, h=46, seed=31):
    """Mediterranean cypress: slim dark flame with a sunlit left flank."""
    x, y = c.P(a, b, 0)
    blob_shadow(c, a + 16, b - 1, 6, 0.3)
    c.add(f'<ellipse cx="{f(x + 0.5)}" cy="{f(y + 0.3)}" rx="3.2" ry="1.3" fill="#1f2e15" opacity="0.45" filter="{c.blur(0.45)}"/>'
          f'<rect x="{f(x - 0.9)}" y="{f(y - 5)}" width="1.8" height="5.2" fill="#5e4a36"/>')
    top, w = y - h, 6.2
    cy_ = c.lin("cyp" + str(seed), x - w, 0, x + w, 0, [(0, "#7f9a4c"), (0.35, "#56723a"), (0.7, "#35502a"), (1, "#24391f")])
    c.add(f'<path d="M{f(x)},{f(top)} C{f(x + w * 0.55)},{f(top + h * 0.25)} {f(x + w * 1.05)},{f(top + h * 0.6)} {f(x + w * 0.7)},{f(y - 6)} Q{f(x)},{f(y - 3.2)} {f(x - w * 0.7)},{f(y - 6)} C{f(x - w * 1.05)},{f(top + h * 0.6)} {f(x - w * 0.55)},{f(top + h * 0.25)} {f(x)},{f(top)}Z" fill="{cy_}"/>')
    rnd = random.Random(seed)
    out = []
    for i in range(14):
        t = 0.12 + 0.8 * i / 13
        yy = top + h * t
        half = w * (0.35 + 0.65 * math.sin(math.pi * min(1, t * 1.05)) ** 0.8) * 0.9
        for side in (-1, 1):
            xx = x + side * half * rnd.uniform(0.45, 0.85)
            out.append(f'<path d="M{f(xx - 1.6)},{f(yy)} Q{f(xx)},{f(yy - 2.2)} {f(xx + 1.6)},{f(yy)}" fill="none" stroke="{"#9ab463" if side < 0 else "#22361c"}" stroke-width="0.8" stroke-linecap="round" opacity="{0.7 if side < 0 else 0.55}"/>')
    out.append(f'<path d="M{f(x - 0.6)},{f(top + 3)} C{f(x - w * 0.5)},{f(top + h * 0.3)} {f(x - w * 0.75)},{f(top + h * 0.6)} {f(x - w * 0.5)},{f(y - 8)}" fill="none" stroke="#c2d38e" stroke-width="0.9" opacity="0.6"/>')
    c.add("".join(out))


def amphora(c, a, b, k=1.0, shaded=True):
    """Terracotta amphora standing on the ground (shaded=True: it stands in a cast shadow)."""
    x, y = c.P(a, b, 0)
    c.add(f'<ellipse cx="{f(x + 1)}" cy="{f(y + 0.3)}" rx="{f(4 * k)}" ry="{f(1.5 * k)}" fill="#1f2e15" opacity="0.4" filter="{c.blur(0.45)}"/>')
    g = c.lin("amph" + ("s" if shaded else "l"), -4, 0, 4, 0, [(0, "#b0603f" if shaded else "#d27a52"), (0.4, "#94472f" if shaded else "#b5523b"), (1, "#5e2a1b" if shaded else "#7d3626")])
    body = ("M-0.8,0 C-3,-3 -4.4,-8 -3.6,-11.5 C-3,-13.5 -1.6,-14 -1.2,-15 L-1.3,-17.5 L1.3,-17.5 L1.2,-15 "
            "C1.6,-14 3,-13.5 3.6,-11.5 C4.4,-8 3,-3 0.8,0Z")
    c.add(f'<g transform="translate({f(x)} {f(y)}) scale({f(k)})">'
          f'<path d="{body}" fill="{g}"/>'
          '<path d="M-1.4,-15.5 C-4,-16 -4.2,-13.5 -3.2,-12.3" fill="none" stroke="#7d3a26" stroke-width="0.9"/>'
          '<path d="M1.4,-15.5 C4,-16 4.2,-13.5 3.2,-12.3" fill="none" stroke="#5e2a1b" stroke-width="0.9"/>'
          '<ellipse cx="0" cy="-17.5" rx="1.6" ry="0.6" fill="#3a1a10"/>'
          '<path d="M-2.6,-10 C-3,-7 -2,-4 -1,-2" fill="none" stroke="#e39a73" stroke-width="0.6" opacity="0.7"/>'
          '<rect x="-3.8" y="-10.5" width="7.6" height="0.6" fill="#2d140c" opacity="0.4"/></g>')


def pot(c, a, b, plant="basil"):
    """Terracotta pot with a basil bush."""
    x, y = c.P(a, b, 0)
    blob_shadow(c, a + 3, b + 0.5, 3.2, 0.3)
    g = c.lin("pot", -5, 0, 5, 0, [(0, "#d77a52"), (0.45, "#b5523b"), (1, "#7d3626")])
    out = [f'<g transform="translate({f(x)} {f(y)})">',
           f'<path d="M-4.6,-8 L4.6,-8 L3.4,0 Q0,1.6 -3.4,0Z" fill="{g}"/>',
           '<ellipse cx="0" cy="-8" rx="5" ry="2" fill="#c86a45"/><ellipse cx="0" cy="-7.8" rx="3.9" ry="1.4" fill="#4a2e1a"/>',
           '<rect x="-4.4" y="-6.2" width="8.8" height="0.6" fill="#7d3626" opacity="0.6"/>']
    for dx, dy, rr, col in [(-3.2, -10.5, 3.2, "#4f7a26"), (2.8, -10.8, 3.3, "#4f7a26"), (0, -13.6, 3.6, "#5f8f2e"), (-2.4, -12.4, 2.8, "#79aa3c"), (1.6, -13.2, 2.6, "#86b846"), (-1.2, -15.4, 2.2, "#9cca58"), (3.4, -12.2, 2.0, "#5f8f2e"), (-0.6, -11.2, 2.4, "#6c9c34")]:
        out.append(f'<circle cx="{f(dx)}" cy="{f(dy)}" r="{f(rr)}" fill="{col}"/>')
    for dx, dy in [(-1.8, -14.6), (0.6, -16.2), (-3.3, -12.0), (1.8, -13.8)]:
        out.append(f'<circle cx="{f(dx)}" cy="{f(dy)}" r="0.75" fill="#c9e78f"/>')
    out.append("</g>")
    c.add("".join(out))


def flowerbox_b(c, b, x0, x1, z0, z1, depth=3.2, seed=21):
    """Window box with red geraniums on a left (+b) wall."""
    c.add(c.on(c.m_ground(z1), f'<rect x="{f(x0)}" y="{f(b)}" width="{f(x1 - x0)}" height="{f(depth)}" fill="#4a2e1a"/>'))
    c.add(c.on(c.m_bface(b + depth), f'<rect x="{f(x0)}" y="{f(z0)}" width="{f(x1 - x0)}" height="{f(z1 - z0)}" fill="#c2603f"/><rect x="{f(x0)}" y="{f(z1 - 0.7)}" width="{f(x1 - x0)}" height="0.7" fill="#e48b63"/><rect x="{f(x0)}" y="{f(z0)}" width="{f(x1 - x0)}" height="0.8" fill="#7d3626" opacity="0.7"/>'))
    c.add(c.on(c.m_aface(x1), f'<rect x="{f(-b - depth)}" y="{f(z0)}" width="{f(depth)}" height="{f(z1 - z0)}" fill="#8a3b2a"/>'))
    c.add(c.on(c.m_bface(b), f'<rect x="{f(x0 + 1.2)}" y="{f(z0 - 2.2)}" width="{f(x1 - x0)}" height="2.6" fill="#5a4c38" opacity="0.2" filter="{c.blur(0.45)}"/>'))
    rnd = random.Random(seed)
    out = []
    for i in range(11):
        x, y = c.P(x0 + 0.8 + i * (x1 - x0 - 1.6) / 10, b + depth * rnd.uniform(0.3, 0.8), z1 + 0.5)
        r_ = rnd.uniform(1.6, 2.3)
        out.append(f'<circle cx="{f(x + 0.6)}" cy="{f(y + 0.4)}" r="{f(r_)}" fill="#3f6b22"/><circle cx="{f(x)}" cy="{f(y - 0.2)}" r="{f(r_ * 0.85)}" fill="#6a9e36"/>')
    for i in range(7):
        x, y = c.P(x0 + 1.5 + i * (x1 - x0 - 3) / 6, b + depth * 0.5, z1 + 3 + rnd.uniform(-0.6, 0.8))
        out.append(f'<circle cx="{f(x + 0.4)}" cy="{f(y + 0.4)}" r="1.35" fill="#8e1c22"/><circle cx="{f(x)}" cy="{f(y)}" r="1.15" fill="#e0393a"/><circle cx="{f(x - 0.35)}" cy="{f(y - 0.4)}" r="0.45" fill="#ff8f7a"/>')
    c.add("".join(out))


def fire(c, x, y, k=1.0):
    """Small offering fire with a warm glow (screen point = top of the fire bowl)."""
    glow = c.rad("fire" + f(x).replace(".", "_"), x, y - 3 * k, 9 * k, [(0, "#ffd27a", 0.55), (1, "#ff9a3c", 0)])
    c.add(f'<circle cx="{f(x)}" cy="{f(y - 3 * k)}" r="{f(9 * k)}" fill="{glow}"/>'
          f'<g transform="translate({f(x)} {f(y)}) scale({f(k)})">'
          '<path d="M-2.6,0 Q-3,-4 -0.6,-7.5 Q-0.4,-4.5 0.8,-4 Q1.4,-6 1.2,-8.5 Q3.6,-4 2.6,0Z" fill="#f08a2e"/>'
          '<path d="M-1.3,0 Q-1.4,-2.6 -0.2,-4.4 Q0.4,-2.6 1,-3 Q1.8,-1.4 1.3,0Z" fill="#ffd66e"/></g>')


def altar(c, a, b):
    """Small marble altar with an offering fire."""
    ha, hb, hz = 4.2, 3.0, 5.0
    c.add(c.on(c.m_ground(hz), f'<rect x="{f(a - ha)}" y="{f(b - hb)}" width="{f(2 * ha)}" height="{f(2 * hb)}" fill="{MARBLE["top"]}"/>'))
    c.add(c.on(c.m_bface(b + hb), f'<rect x="{f(a - ha)}" y="0" width="{f(2 * ha)}" height="{hz}" fill="#e6e0d2"/><rect x="{f(a - ha)}" y="{f(hz - 1.2)}" width="{f(2 * ha)}" height="0.5" fill="#a8432f"/><rect x="{f(a - ha)}" y="0" width="{f(2 * ha)}" height="0.8" fill="#5d574b" opacity="0.3"/>'))
    c.add(c.on(c.m_aface(a + ha), f'<rect x="{f(-b - hb)}" y="0" width="{f(2 * hb)}" height="{hz}" fill="#b9bbb8"/><rect x="{f(-b - hb)}" y="{f(hz - 1.2)}" width="{f(2 * hb)}" height="0.5" fill="#7d2f22"/>'))
    x, y = c.P(a, b, hz)
    c.add(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="4.2" ry="1.9" fill="#3a2a22"/>')
    fire(c, x, y)


def banner_b(c, a, b, z0, height=34, width=7, drop=14, seed=1):
    """Pole with a crossbar and a hanging banner facing +b. The cloth is ACCENT.
    (a, b, z0): foot of the pole; drop: banner length; width along a."""
    x, y = c.P(a, b, z0)
    _, yt = c.P(a, b, z0 + height)
    blob_shadow(c, a + 6, b, 3, 0.28)
    c.add(f'<rect x="{f(x - 0.75)}" y="{f(yt)}" width="1.5" height="{f(y - yt)}" fill="{WOOD["base"]}"/>'
          f'<rect x="{f(x - 0.75)}" y="{f(yt)}" width="0.55" height="{f(y - yt)}" fill="{WOOD["lit"]}"/>'
          f'<circle cx="{f(x)}" cy="{f(yt - 1.2)}" r="1.5" fill="{GOLD["base"]}"/><circle cx="{f(x - 0.45)}" cy="{f(yt - 1.6)}" r="0.6" fill="{GOLD["hi"]}"/>')
    zt = z0 + height - 2.5
    # crossbar along a
    c.add(c.on(c.m_bface(b), f'<rect x="{f(a - width / 2 - 1)}" y="{f(zt)}" width="{f(width + 2)}" height="1" fill="{WOOD["dark"]}"/>'))
    # cloth: hangs from the bar, swallow-tail end, soft folds
    x0, x1 = a - width / 2, a + width / 2
    cloth = poly([(x0, zt), (x1, zt), (x1, zt - drop), (a, zt - drop + 2.6), (x0, zt - drop)])
    fold = c.lin("fold", 0, 0, 1, 0, [(0, ACCENT["lit"]), (0.3, ACCENT["light"]), (0.5, ACCENT["mid"]), (0.7, ACCENT["light"]), (1, ACCENT["shade"])], bbox=True)
    c.accent(c.on(c.m_bface(b), f'<path d="{cloth}" fill="{fold}"/>'
                  f'<rect x="{f(x0)}" y="{f(zt - 2)}" width="{f(width)}" height="1.2" fill="{ACCENT["dark"]}" opacity="0.5"/>'))
    # art on top of the cloth: gold border stripe + a small gold emblem, soft shading
    c.add(c.on(c.m_bface(b), f'<path d="M{f(x0)},{f(zt - drop)} L{f(a)},{f(zt - drop + 2.6)} L{f(x1)},{f(zt - drop)}" fill="none" stroke="{GOLD["lit"]}" stroke-width="0.6"/>'
               f'<circle cx="{f(a)}" cy="{f(zt - drop * 0.45)}" r="1.5" fill="none" stroke="{GOLD["lit"]}" stroke-width="0.55"/>'
               f'<rect x="{f(x1 - 1.4)}" y="{f(zt - drop)}" width="1.4" height="{f(drop)}" fill="#1d2b36" opacity="0.18"/>'))


def awning_b(c, a0, a1, b, z, depth=6, drop=3.5, stripes=6):
    """Striped market awning sloping out from a wall plane b toward +b. Cloth is ACCENT;
    every second stripe is cream (art), so it reads as a striped canvas in any player colour."""
    tanp = drop / depth
    # sloped canvas through (a, b, z) falling toward +b: local (x=a, y=b')
    m = f"matrix(1 0.5 -1 {f(0.5 + ZS * tanp)} {f(c.ox)} {f(c.oy - ZS * (z + b * tanp))})"
    w = (a1 - a0) / stripes
    acc = [f'<rect x="{f(a0)}" y="{f(b)}" width="{f(a1 - a0)}" height="{f(depth)}" fill="{ACCENT["light"]}"/>']
    art = []
    for i in range(stripes):
        if i % 2:
            art.append(f'<rect x="{f(a0 + i * w)}" y="{f(b)}" width="{f(w)}" height="{f(depth)}" fill="#f4ead2"/>')
    art.append(f'<rect x="{f(a0)}" y="{f(b)}" width="{f(a1 - a0)}" height="{f(depth)}" fill="url(#{c.id("awsh")})"/>')
    c.lin("awsh", 0, b, 0, b + depth, [(0, "#1d2b36", 0.18), (0.4, "#1d2b36", 0), (1, "#fff", 0.12)])
    c.accent(c.on(m, "".join(acc)))
    c.add(c.on(m, "".join(art)))
    # scalloped valance hanging at the front edge (plane b+depth)
    zf = z - drop
    sc = []
    for i in range(stripes):
        x = a0 + i * w
        sc.append(f'<path d="M{f(x)},{f(zf)} L{f(x + w)},{f(zf)} L{f(x + w)},{f(zf - 1.2)} Q{f(x + w / 2)},{f(zf - 2.8)} {f(x)},{f(zf - 1.2)}Z" fill="{ACCENT["mid"] if i % 2 == 0 else "#000"}"/>')
    c.accent(c.on(c.m_bface(b + depth), "".join(s for i, s in enumerate(sc) if i % 2 == 0)))
    c.add(c.on(c.m_bface(b + depth), "".join(s.replace('fill="#000"', 'fill="#e9dcc0"') for i, s in enumerate(sc) if i % 2 == 1)))


def drape_b(c, b, a0, a1, z_top, drop, tails=True):
    """Owner-colour cloth hanging flat on a wall plane b (facing +b), e.g. on a pedestal.
    Cloth is ACCENT; a gold hem and a soft shadow are art on top."""
    am = (a0 + a1) / 2
    shape = [(a0, z_top), (a1, z_top), (a1, z_top - drop)] + ([(am, z_top - drop + 2.4)] if tails else []) + [(a0, z_top - drop)]
    fold = c.lin("fold", 0, 0, 1, 0, [(0, ACCENT["lit"]), (0.3, ACCENT["light"]), (0.5, ACCENT["mid"]), (0.7, ACCENT["light"]), (1, ACCENT["shade"])], bbox=True)
    c.add(c.on(c.m_bface(b), f'<path d="{poly([(x + 0.9, y - 0.9) for x, y in shape])}" fill="#1d2b36" opacity="0.2" filter="{c.blur(0.45)}"/>'))
    c.accent(c.on(c.m_bface(b), f'<path d="{poly(shape)}" fill="{fold}"/>'))
    hem = shape[2:] if tails else shape[2:4]
    c.add(c.on(c.m_bface(b), f'<path d="M{" L".join(f"{f(x)},{f(y + 0.4)}" for x, y in hem)}" fill="none" stroke="{GOLD["lit"]}" stroke-width="0.7"/>'
               f'<rect x="{f(a0)}" y="{f(z_top - 1.2)}" width="{f(a1 - a0)}" height="1.2" fill="{GOLD["base"]}"/>'))


def drape_a(c, a, x0, x1, z_top, drop, tails=True):
    """Like drape_b, but on a right-face plane a (facing +a, in shade). x is the local -b."""
    xm = (x0 + x1) / 2
    shape = [(x0, z_top), (x1, z_top), (x1, z_top - drop)] + ([(xm, z_top - drop + 2.4)] if tails else []) + [(x0, z_top - drop)]
    fold = c.lin("foldR", 0, 0, 1, 0, [(0, ACCENT["mid"]), (0.35, ACCENT["shade"]), (0.6, ACCENT["dark"]), (0.8, ACCENT["shade"]), (1, ACCENT["dark"])], bbox=True)
    c.add(c.on(c.m_aface(a), f'<path d="{poly([(x + 0.9, y - 0.9) for x, y in shape])}" fill="#1d2b36" opacity="0.2" filter="{c.blur(0.45)}"/>'))
    c.accent(c.on(c.m_aface(a), f'<path d="{poly(shape)}" fill="{fold}"/>'))
    hem = shape[2:] if tails else shape[2:4]
    c.add(c.on(c.m_aface(a), f'<path d="M{" L".join(f"{f(x)},{f(y + 0.4)}" for x, y in hem)}" fill="none" stroke="{GOLD["mid"]}" stroke-width="0.7"/>'
               f'<rect x="{f(x0)}" y="{f(z_top - 1.2)}" width="{f(x1 - x0)}" height="1.2" fill="{GOLD["shade"]}"/>'))


def brazier(c, a, b, z=0.0, k=1.0):
    """Bronze tripod brazier with fire."""
    x, y = c.P(a, b, z)
    g = c.lin("braz", 0, 0, 1, 0, [(0, BRONZE["hi"]), (0.4, BRONZE["base"]), (1, BRONZE["dark"])], bbox=True)
    c.add(f'<ellipse cx="{f(x + 1)}" cy="{f(y + 0.4)}" rx="{f(4 * k)}" ry="{f(1.5 * k)}" fill="#1d2b36" opacity="0.3" filter="{c.blur(0.45)}"/>'
          f'<g transform="translate({f(x)} {f(y)}) scale({f(k)})">'
          f'<path d="M-3,0 L-1.2,-9 M3,0 L1.2,-9 M0,0.8 L0,-9" stroke="{BRONZE["shade"]}" stroke-width="0.9" stroke-linecap="round"/>'
          f'<path d="M-4.4,-12 L4.4,-12 Q3.6,-8.4 0,-8.2 Q-3.6,-8.4 -4.4,-12Z" fill="{g}"/>'
          f'<ellipse cx="0" cy="-12" rx="4.4" ry="1.3" fill="#3a2a22"/></g>')
    fire(c, x, y - 12 * k, 0.8 * k)


# ---------------------------------------------------------------------------
# Statues (bronze / gold figures drawn in screen space)
# ---------------------------------------------------------------------------
def figure(c, x, y, h, metal=BRONZE, pose="spear", accent_parts=("crest", "shield"), seed=1):
    """Standing hoplite statue facing the viewer, feet at screen point (x, y).
    h: height from the feet to the top of the helmet (canvas-local units, before the canvas
    scale); the crest adds ~10 %, a raised torch ~45 %, the spear ~30 %.
    pose: "spear" (spear upright, shield on the left arm) or "torch" (torch raised high).
    accent_parts: parts in the owner colour, any of "crest", "shield", "cloak"."""
    k = h / 100.0
    tf = f"translate({f(x)} {f(y)}) scale({f(k)})"
    met = c.lin("metal" + metal["base"][1:], 0, 0, 1, 0, [(0, metal["hi"]), (0.18, metal["lit"]), (0.5, metal["base"]), (0.82, metal["shade"]), (1, metal["dark"])], bbox=True)
    acc = c.lin("figacc", 0, 0, 1, 0, [(0, ACCENT["lit"]), (0.45, ACCENT["light"]), (0.8, ACCENT["shade"]), (1, ACCENT["dark"])], bbox=True)
    hi, dk = metal["hi"], metal["dark"]

    def part(d, accent=False, extra=""):
        if accent:
            c.accent(f'<g transform="{tf}"><path d="{d}" fill="{acc}"/></g>')
            if extra:
                c.add(f'<g transform="{tf}">{extra}</g>')
        else:
            c.add(f'<g transform="{tf}"><path d="{d}" fill="{met}"/>{extra}</g>')

    # cloak hanging behind the shoulders down to the calves
    part("M-12,-71 C-16,-58 -17,-36 -14.5,-16 L-8,-14 L9,-14 L15.5,-17 C18,-36 17,-58 12,-71Z", accent="cloak" in accent_parts,
         extra='<path d="M-5,-60 C-7,-44 -7,-28 -6,-15 M5,-60 C7,-44 8,-28 8,-15" fill="none" stroke="#000" stroke-width="1.1" opacity="0.22"/>')
    # legs with greaves: left leg relaxed and a little forward, right leg carries the weight
    part("M-9,-42 L-1.6,-42 C-1.4,-34 -1.6,-28 -2.4,-24 C-1.6,-16 -2.2,-8 -3,-2 L-1.8,1.5 L-10.4,1.5 L-9.2,-2 C-10.6,-9 -11.2,-17 -9.8,-24 C-10.8,-29 -10.4,-36 -9,-42Z",
         extra=f'<path d="M-9.4,-22 C-10.2,-15 -9.8,-8 -8.8,-3" fill="none" stroke="{hi}" stroke-width="1" opacity="0.75"/><path d="M-9.6,-24.5 L-3,-24.5" stroke="{dk}" stroke-width="0.9" opacity="0.5"/>')
    part("M0.4,-42 L9,-42 C10,-36 10.2,-30 9.2,-25 C10.2,-18 9.6,-9 8.8,-2 L10,0 L1.2,0 L2.2,-2 C1.2,-9 0.8,-17 1.6,-25 C0.6,-30 0.2,-36 0.4,-42Z",
         extra=f'<path d="M2.2,-23 C1.6,-16 1.8,-9 2.6,-3" fill="none" stroke="{hi}" stroke-width="0.8" opacity="0.5"/><path d="M2,-25.5 L8.8,-25.5" stroke="{dk}" stroke-width="0.9" opacity="0.5"/>')
    # skirt of leather strips (pteruges)
    part("M-9.5,-51 L9.5,-51 L11.8,-39 L-11.8,-39Z",
         extra="".join(f'<rect x="{f(-11 + i * 2.75)}" y="-50" width="0.45" height="11" fill="{dk}" opacity="0.55"/>' for i in range(1, 8)))
    # muscle cuirass
    part("M-12.5,-72 C-13.5,-64 -11.5,-56 -9.5,-51 L9.5,-51 C11.5,-56 13.5,-64 12.5,-72 C6,-75 -6,-75 -12.5,-72Z",
         extra=f'<path d="M-6.5,-65 C-3.5,-62.5 3.5,-62.5 6.5,-65 M0,-63 L0,-53.5 M-5,-57.5 C-2,-56 2,-56 5,-57.5" fill="none" stroke="{dk}" stroke-width="0.8" opacity="0.55"/>'
               f'<path d="M-11.6,-70 C-12.4,-63 -11,-57 -9.6,-52.5" fill="none" stroke="{hi}" stroke-width="1.2" opacity="0.85"/>'
               f'<rect x="-10" y="-52.5" width="20" height="2" fill="{dk}" opacity="0.5"/>')
    # neck + head in a Corinthian helmet
    part("M-2.6,-79 L2.6,-79 L3.2,-73 L-3.2,-73Z")
    part("M-6,-80.5 C-6.6,-88 -4,-93 0.4,-93 C5,-93 7,-88 6.4,-80.5 C5.6,-77.6 3.8,-77 3,-78.6 L2.6,-82.6 L-2.2,-82.6 L-2.6,-78.6 C-3.6,-77 -5.4,-77.6 -6,-80.5Z",
         extra=f'<path d="M-2.2,-82.6 L-2.2,-87 M2.6,-82.6 L2.6,-87" stroke="{dk}" stroke-width="0.9" opacity="0.75"/>'
               f'<path d="M-5.2,-83 C-5.4,-88.5 -3,-91.6 0.2,-91.8" fill="none" stroke="{hi}" stroke-width="1" opacity="0.85"/>')
    # crest: horsehair arc running front to back
    part("M-4,-92 C-6,-101 2,-104.5 9,-100.5 C11.6,-97.5 11.6,-93 10,-89.5 C9,-94 5.6,-96.6 0,-94.6Z", accent="crest" in accent_parts,
         extra='<path d="M-3,-95 C0,-100 5.5,-101 9,-97.6" fill="none" stroke="#fff" stroke-width="0.8" opacity="0.35"/>' if "crest" in accent_parts else "")
    # right arm (screen left)
    if pose == "torch":
        part("M-12.5,-71.5 C-16.5,-78 -18,-88 -16.5,-99 L-12,-99.5 C-12.6,-90 -11.4,-82 -8.5,-74Z",
             extra=f'<path d="M-15.6,-80 C-16.6,-87 -16.2,-93 -15.4,-98" fill="none" stroke="{hi}" stroke-width="0.9" opacity="0.8"/>')
        glow = c.rad("tglow", 0.5, 0.5, 0.5, [(0, "#ffe08a", 0.8), (1, "#ff9a3c", 0)], bbox=True)
        c.add(f'<g transform="{tf}"><path d="M-16.6,-116 L-11.6,-116 L-13,-99 L-15.2,-99Z" fill="{metal["shade"]}"/><path d="M-16.6,-116 L-14.6,-116 L-14.6,-99 L-15.2,-99Z" fill="{hi}" opacity="0.7"/>'
              f'<path d="M-18,-116 L-10.2,-116 L-11.4,-119.5 L-16.8,-119.5Z" fill="{metal["base"]}"/>'
              f'<circle cx="-14.1" cy="-127" r="15" fill="{glow}"/>'
              '<path d="M-18.5,-119.5 Q-20.2,-127 -15.4,-135 Q-15,-128.4 -13,-128 Q-11.8,-131.6 -12.6,-138 Q-7.6,-128.6 -9.8,-119.5Z" fill="#f08a2e"/>'
              '<path d="M-16.6,-119.5 Q-17.2,-124 -14.8,-128.4 Q-13.8,-124.2 -12.8,-125.2 Q-11.4,-123 -11.8,-119.5Z" fill="#ffd66e"/></g>')
        part("M-17.8,-101 C-18.2,-97.4 -12.2,-96.6 -11.6,-100 C-11.4,-102.6 -17.4,-103.6 -17.8,-101Z")
    else:
        c.add(f'<g transform="{tf}"><rect x="-17.2" y="-124" width="1.6" height="125" fill="{WOOD["dark"]}"/><rect x="-17.2" y="-124" width="0.55" height="125" fill="{WOOD["lit"]}"/>'
              f'<path d="M-16.4,-134 L-14,-124.5 L-16.4,-122.5 L-18.8,-124.5Z" fill="{metal["lit"]}"/><path d="M-16.4,-134 L-14,-124.5 L-16.4,-122.5Z" fill="{metal["shade"]}"/></g>')
        part("M-12.5,-71.5 C-15.5,-66 -17,-61 -17.4,-57.5 L-13.4,-56 C-12.8,-60 -11.4,-65 -8.5,-69Z",
             extra=f'<path d="M-14.8,-66 C-15.8,-63 -16.4,-60.5 -16.6,-58.6" fill="none" stroke="{hi}" stroke-width="0.9" opacity="0.8"/>')
        part("M-19.4,-59 C-19.6,-55.4 -14,-54.6 -13.4,-58 C-13.2,-60.6 -19,-61.6 -19.4,-59Z")
    # shield on the left arm (screen right): round hoplon seen slightly from the side
    if "shield" in accent_parts:
        sg = c.rad("shieldg", 0.35, 0.3, 0.8, [(0, ACCENT["lit"]), (0.6, ACCENT["mid"]), (1, ACCENT["dark"])], bbox=True)
        c.accent(f'<g transform="{tf}"><ellipse cx="11.5" cy="-55" rx="9.6" ry="12.4" fill="{sg}"/></g>')
        c.add(f'<g transform="{tf}"><ellipse cx="11.5" cy="-55" rx="9.6" ry="12.4" fill="none" stroke="{metal["base"]}" stroke-width="1.9"/>'
              f'<path d="M3.6,-60 A9.6,12.4 0 0 1 9,-67" fill="none" stroke="{hi}" stroke-width="0.8" opacity="0.85"/>'
              f'<circle cx="11.5" cy="-55" r="2.6" fill="{metal["lit"]}"/><circle cx="10.9" cy="-55.6" r="1" fill="{hi}"/></g>')
    else:
        c.add(f'<g transform="{tf}"><ellipse cx="11.5" cy="-55" rx="9.6" ry="12.4" fill="{met}"/>'
              f'<ellipse cx="11.5" cy="-55" rx="7" ry="9.2" fill="none" stroke="{dk}" stroke-width="0.8" opacity="0.5"/>'
              f'<circle cx="11.5" cy="-55" r="2.4" fill="{metal["lit"]}"/></g>')
    if metal is BRONZE:
        # a hint of verdigris in the folds
        c.add(f'<g transform="{tf}" opacity="0.35"><path d="M7,-50 L8,-40 M-4,-24 L-4.4,-14 M5,-24 L5.6,-12" stroke="{BRONZE["patina"]}" stroke-width="1.4" stroke-linecap="round"/></g>')


def pedestal(c, a, b, ha, hb, h, top_z=0.0, inscription=True):
    """Marble pedestal block with mouldings (for statues). Returns its top height."""
    z0, z1 = top_z, top_z + h
    box(c, a - ha - 1, a + ha + 1, b - hb - 1, b + hb + 1, z0, z0 + 1.6, MARBLE["top"], MARBLE["left"], MARBLE["right"], edge="#fff")
    box(c, a - ha, a + ha, b - hb, b + hb, z0 + 1.6, z1 - 1.6, MARBLE["top"], MARBLE["left"], MARBLE["right"])
    box(c, a - ha - 1, a + ha + 1, b - hb - 1, b + hb + 1, z1 - 1.6, z1, MARBLE["top"], MARBLE["left"], MARBLE["right"], edge="#fff")
    if inscription:
        c.add(c.on(c.m_bface(b + hb), "".join(f'<rect x="{f(a - ha + 1.2 + i * (2 * ha - 2.4) / 5)}" y="{f(z0 + h * 0.5)}" width="{f((2 * ha - 2.4) / 5 - 0.8)}" height="0.5" fill="#8d877b" opacity="0.7"/>' for i in range(5))))
    return z1
