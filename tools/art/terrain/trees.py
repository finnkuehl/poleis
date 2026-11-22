"""trees - the terrain trees and shrubs (docs/ART.md "Hills and mountains", bullet "Forests"):
umbrella pines, cypresses, holm oaks, maquis shrubs and wild olives in the building style. The
game places them densely as sprites (overlapping crowns fill a forest tile and join the
neighbouring forest tiles; olives and shrubs dot the golden hills).

Files: public/assets/terrain/<id>.svg, one art layer each, no accent file (no owner colour).
Canvas contract: the same world scale as the buildings (iso.S, 208 units = 0.92 x hex width);
each file has its own tight viewBox (multiples of 4) and data-anchor="128 176" on the root
<svg>: the trunk foot, the ground point where the trunk meets the ground, is at (128, 176).

Each crown is built from clustered leaf masses: a dark silhouette first (so the lower part and
the gaps between masses are dark), then the masses from the bottom up, each with a radial
gradient lit from the upper left, a lighter cap and a few small highlights. Many overlapping
trees therefore read as one deep canopy. Sizes (world units) follow the shared human scale
(tools/art/README.md "Scale"); widths are crown diameters (on screen x 1.41).
"""
import sys

sys.dont_write_bytecode = True
import math  # noqa: E402
import os  # noqa: E402
import random  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
from iso import INK, ZS  # noqa: E402

R2 = math.sqrt(2)

# leaf palettes: deep (gaps), dark (undersides), base, lit, hi (sunlit tops), fleck (glints)
PAL = {
    "pine": {"deep": "#1c3520", "dark": "#2b4f27", "base": "#467532", "lit": "#73a044", "hi": "#a6c862", "fleck": "#d6e8a0"},
    "cypress": {"deep": "#12271a", "dark": "#1c3a24", "base": "#2f5530", "lit": "#4d773a", "hi": "#7ea053", "fleck": "#b4cc80"},
    "oak": {"deep": "#17301d", "dark": "#264725", "base": "#3d6a30", "lit": "#64923f", "hi": "#94ba5a", "fleck": "#c8dd8c"},
    "oak_dark": {"deep": "#12271b", "dark": "#1f3d27", "base": "#335c35", "lit": "#56844b", "hi": "#84ab6c", "fleck": "#b9d3a0"},   # blue-green holm oak
    "oak_warm": {"deep": "#1b3218", "dark": "#2d4e22", "base": "#487230", "lit": "#759f43", "hi": "#a6c65e", "fleck": "#d2e49a"},
    "pine_dark": {"deep": "#172f19", "dark": "#264823", "base": "#3c682e", "lit": "#628f3d", "hi": "#92b756", "fleck": "#cbdf98"},
    "olive": {"deep": "#3a4528", "dark": "#56623b", "base": "#7c8a56", "lit": "#a4ae7a", "hi": "#c9d0a4", "fleck": "#f0f2da"},
    "lentisk": {"deep": "#1f3a1e", "dark": "#2f5428", "base": "#4b7d33", "lit": "#77a847", "hi": "#a8cc68", "fleck": "#d8eba2"},
    "sage": {"deep": "#3b4a36", "dark": "#566a4c", "base": "#7f9470", "lit": "#a6b896", "hi": "#c8d6b8", "fleck": "#eef4e4"},
    "broom": {"deep": "#26401f", "dark": "#3a5f2a", "base": "#5e8a38", "lit": "#86b04a", "hi": "#b4d06a", "fleck": "#e2eea8"},
}
BARK = {
    "pine": ("#b47a4e", "#8a5634", "#5e3820", "#3e2414"),       # orange-brown plates (lit, base, shade, deep)
    "oak": ("#8a7258", "#64503c", "#45372a", "#2c231a"),
    "olive": ("#b9b09e", "#8c8270", "#625a4c", "#40392f"),       # silvery grey, gnarled
    "cypress": ("#8a6a4c", "#64492f", "#45311f", "#2c1e12"),
}


def n1(v):
    """One decimal is plenty for sprites (keeps the files small)."""
    s = f"{v:.1f}"
    return "0" if s in ("-0.0", "0.0") else (s[:-2] if s.endswith(".0") else s)


def blob(cx, cy, rx, ry, seed, n=7, bulge=1.22, jitter=0.14):
    """Scalloped leaf-mass outline (screen coords), like iso.puff but with one decimal."""
    rnd = random.Random(seed)
    angs = [2 * math.pi * (i + rnd.uniform(-jitter, jitter)) / n + rnd.uniform(0, 0.3) for i in range(n)]
    pp = [(cx + rx * math.cos(a) * rnd.uniform(0.88, 1.04), cy + ry * math.sin(a) * rnd.uniform(0.88, 1.04)) for a in angs]
    d = f"M{n1(pp[0][0])},{n1(pp[0][1])}"
    for i in range(n):
        a0, a1 = angs[i], angs[(i + 1) % n] + (2 * math.pi if i == n - 1 else 0)
        am = (a0 + a1) / 2
        b = bulge * rnd.uniform(0.94, 1.08)
        p1 = pp[(i + 1) % n]
        d += f"Q{n1(cx + rx * b * math.cos(am))},{n1(cy + ry * b * math.sin(am))} {n1(p1[0])},{n1(p1[1])}"
    return d + "Z"


class Tree:
    """One sprite: tracks the drawn extent (screen coords before the canvas scale) for the viewBox."""

    def __init__(self, tid, seed):
        c = iso.Canvas("trees", pid=tid, stem=tid)
        iso.ground(c)
        c.accent_layer = False
        c.anchor_marker = True
        self.c, self.tid = c, tid
        self.x, self.y = c.P(0, 0, 0)          # trunk foot
        self.rnd = random.Random(seed)
        self.ext = []

    def grow(self, x0, y0, x1, y1):
        self.ext.append((x0, y0, x1, y1))

    def finish(self, grid=4):
        S, cx, cy = iso.S, iso.BASE_CX, iso.BASE_CY
        x0 = min(e[0] for e in self.ext)
        y0 = min(e[1] for e in self.ext)
        x1 = max(e[2] for e in self.ext)
        y1 = max(e[3] for e in self.ext)
        ux0, uy0 = cx + S * (x0 - cx), cy + S * (y0 - cy)
        ux1, uy1 = cx + S * (x1 - cx), cy + S * (y1 - cy)
        vx = math.floor(ux0 / grid) * grid
        vy = math.floor(uy0 / grid) * grid
        self.c.viewbox = (vx, vy, math.ceil(ux1 / grid) * grid - vx, math.ceil(uy1 / grid) * grid - vy)
        return self.c

    # --- shadows ------------------------------------------------------------
    def shadows(self, cast_dx, cast_rx, cast_ry, cast_op=0.22, foot_rx=3.0, foot_op=0.42):
        """Short soft cast shadow to the lower right and a contact shadow at the trunk foot."""
        c, x, y = self.c, self.x, self.y
        sx, sy = x + cast_dx, y + cast_rx * 0.08
        c.add(f'<ellipse cx="{n1(sx)}" cy="{n1(sy)}" rx="{n1(cast_rx)}" ry="{n1(cast_ry)}" fill="{INK}" opacity="{cast_op}" filter="{c.blur(2.2)}"/>'
              f'<ellipse cx="{n1(x + foot_rx * 0.25)}" cy="{n1(y + 0.2)}" rx="{n1(foot_rx)}" ry="{n1(foot_rx * 0.42)}" fill="{INK}" opacity="{foot_op}" filter="{c.blur(0.6)}"/>')
        self.grow(sx - cast_rx - 7, sy - cast_ry - 7, sx + cast_rx + 7, sy + cast_ry + 7)

    # --- leaf masses -------------------------------------------------------
    def grads(self, pal):
        c, p = self.c, PAL[pal]
        return {
            "L": c.rad(pal + "L", 0.34, 0.28, 0.85, [(0, p["hi"]), (0.45, p["lit"]), (1, p["base"])], bbox=True),
            "M": c.rad(pal + "M", 0.34, 0.28, 0.85, [(0, p["lit"]), (0.5, p["base"]), (1, p["dark"])], bbox=True),
            "D": c.rad(pal + "D", 0.34, 0.28, 0.85, [(0, p["base"]), (0.55, p["dark"]), (1, p["deep"])], bbox=True),
        }

    def masses(self, items, pal, flecks=2, under=1.0, cap=True):
        """items: (x, y, rx, ry, tone 0..1, seed), drawn in the given order (bottom / back first).
        A dark silhouette of all masses goes first (dark gaps and undersides)."""
        c, p = self.c, PAL[pal]
        g = self.grads(pal)
        sil = "".join(blob(x + 0.5, y + 1.3 * under, rx * 1.04, ry * 1.06, sd) for x, y, rx, ry, t, sd in items)
        out = [f'<path d="{sil}" fill="{p["deep"]}"/>']
        hi, dk = [], []
        for x, y, rx, ry, t, sd in items:
            tone = "L" if t > 0.64 else ("M" if t > 0.34 else "D")
            out.append(f'<path d="{blob(x, y, rx, ry, sd)}" fill="{g[tone]}"/>')
            if cap and t > 0.4:
                out.append(f'<path d="{blob(x - rx * 0.22, y - ry * 0.26, rx * 0.55, ry * 0.46, sd + 7, n=6, bulge=1.3)}" fill="{p["hi"]}" opacity="{n1(0.2 + 0.4 * (t - 0.4))}"/>')
            rnd = random.Random(sd * 3 + 1)
            for _ in range(flecks if t > 0.45 else 0):
                fx = x + rx * rnd.uniform(-0.7, 0.2)
                fy = y + ry * rnd.uniform(-0.7, 0.1)
                hi.append(f"M{n1(fx)},{n1(fy)}l{n1(rnd.uniform(0.8, 1.6))},{n1(rnd.uniform(-0.7, -0.2))}")
            if t < 0.6:
                fx = x + rx * rnd.uniform(-0.2, 0.5)
                fy = y + ry * rnd.uniform(0.25, 0.6)
                dk.append(f"M{n1(fx)},{n1(fy)}l{n1(rnd.uniform(1, 2))},{n1(rnd.uniform(-0.4, 0.4))}")
            self.grow(x - rx * 1.35, y - ry * 1.35, x + rx * 1.35 + 0.6, y + ry * 1.35 + 1.4 * under)
        if hi:
            out.append(f'<path d="{"".join(hi)}" stroke="{p["fleck"]}" stroke-width="0.6" stroke-linecap="round" opacity="0.55"/>')
        if dk:
            out.append(f'<path d="{"".join(dk)}" stroke="{p["deep"]}" stroke-width="0.7" stroke-linecap="round" opacity="0.55"/>')
        c.add("".join(out))

    # --- trunks and branches ----------------------------------------------
    def limb(self, x0, y0, x1, y1, w0, w1, bark, bend=0.0):
        """A tapered, slightly curved limb from (x0, y0) to (x1, y1) with a lit left edge."""
        lit, base, shade, deep = BARK[bark]
        dx, dy = x1 - x0, y1 - y0
        ln = math.hypot(dx, dy) or 1
        nx, ny = -dy / ln, dx / ln
        if nx > 0:
            nx, ny = -nx, -ny                   # normal toward the lit (left) side
        mx, my = (x0 + x1) / 2 + nx * bend, (y0 + y1) / 2 + ny * bend
        pts_l = [(x0 + nx * w0 / 2, y0 + ny * w0 / 2), (mx + nx * (w0 + w1) / 4, my + ny * (w0 + w1) / 4), (x1 + nx * w1 / 2, y1 + ny * w1 / 2)]
        pts_r = [(x1 - nx * w1 / 2, y1 - ny * w1 / 2), (mx - nx * (w0 + w1) / 4, my - ny * (w0 + w1) / 4), (x0 - nx * w0 / 2, y0 - ny * w0 / 2)]
        body = (f"M{n1(pts_l[0][0])},{n1(pts_l[0][1])}Q{n1(pts_l[1][0])},{n1(pts_l[1][1])} {n1(pts_l[2][0])},{n1(pts_l[2][1])}"
                f"L{n1(pts_r[0][0])},{n1(pts_r[0][1])}Q{n1(pts_r[1][0])},{n1(pts_r[1][1])} {n1(pts_r[2][0])},{n1(pts_r[2][1])}Z")
        edge = (f"M{n1(x0 + nx * w0 * 0.3)},{n1(y0 + ny * w0 * 0.3)}Q{n1(mx + nx * (w0 + w1) * 0.15)},{n1(my + ny * (w0 + w1) * 0.15)} "
                f"{n1(x1 + nx * w1 * 0.3)},{n1(y1 + ny * w1 * 0.3)}")
        self.c.add(f'<path d="{body}" fill="{base}"/><path d="{body}" fill="{shade}" opacity="0.55" transform="translate({n1(-nx * w0 * 0.3)} {n1(-ny * w0 * 0.3)})"/>'
                   f'<path d="{edge}" fill="none" stroke="{lit}" stroke-width="{n1(max(0.5, w1 * 0.45))}" stroke-linecap="round"/>')
        self.grow(min(x0, x1, mx) - w0, min(y0, y1, my) - w0, max(x0, x1, mx) + w0, max(y0, y1, my) + w0)

    def foot(self, w, bark):
        """Root flare where the trunk meets the ground."""
        lit, base, shade, deep = BARK[bark]
        x, y = self.x, self.y
        self.c.add(f'<path d="M{n1(x - w * 1.1)},{n1(y + 0.3)}Q{n1(x - w * 0.5)},{n1(y - 0.4)} {n1(x - w * 0.45)},{n1(y - w * 0.9)}'
                   f'L{n1(x + w * 0.45)},{n1(y - w * 0.9)}Q{n1(x + w * 0.5)},{n1(y - 0.3)} {n1(x + w * 1.1)},{n1(y + 0.4)}Q{n1(x)},{n1(y + 1)} {n1(x - w * 1.1)},{n1(y + 0.3)}Z" fill="{shade}"/>')


# ---------------------------------------------------------------------------
# Species
# ---------------------------------------------------------------------------
def umbrella_pine(tid, h, d, seed, lean=0.0, forks=3, pal="pine"):
    """Stone pine: a tall bare trunk forking into a few limbs under a broad, flat, cushioned
    crown (height h, crown diameter d, world units)."""
    t = Tree(tid, seed)
    rnd = t.rnd
    x, y = t.x, t.y
    rx = d / 2 * R2                       # crown half width on screen
    ry = rx * 0.4                         # its top surface seen at 30 deg
    th = h * ZS * 0.14                    # crown thickness
    top = y - h * ZS
    cx, cy = x + lean, top + ry * 0.9     # centre of the crown's top surface
    t.shadows(rx * 0.55 + h * 0.18, rx * 0.95, rx * 0.36)
    # trunk and the forks up into the crown
    fy = cy + ry * 0.2 + th + (y - cy) * 0.28
    fx = x + lean * 0.55
    t.foot(2.4, "pine")
    t.limb(x, y, fx, fy, 3.6, 2.8, "pine", bend=lean * 0.15 + 0.8)
    ends = sorted([cx + rx * (-0.55 + 1.1 * (i + 0.5) / forks) + rnd.uniform(-2, 2) for i in range(forks)])
    for i, ex in enumerate(ends):
        t.limb(fx, fy + 1, ex, cy + ry * 0.35 + th * 0.4, 2.3, 1.2, "pine", bend=(ex - fx) * 0.12)
    # crown: the dark front rim (thickness) first, then the cushions of the top, back to front
    items = []
    n_rim = 7
    for i in range(n_rim):
        a = math.pi * (0.06 + 0.88 * (i + 0.5) / n_rim)
        mx, my = cx + rx * 0.84 * math.cos(a), cy + ry * 0.84 * math.sin(a) + th * 0.5
        r = rx * rnd.uniform(0.24, 0.3)
        items.append((mx, my, r, r * 0.6, 0.12 + 0.25 * (1 - math.cos(a)) / 2 * 0.6, seed * 31 + i))
    tops = []
    for i in range(15):
        while True:
            u, v = rnd.uniform(-1, 1), rnd.uniform(-1, 1)
            if u * u + v * v < 1:
                break
        mx, my = cx + u * rx * 0.74, cy + v * ry * 0.72
        r = rx * rnd.uniform(0.22, 0.3)
        tone = 0.62 - 0.32 * u - 0.28 * v + rnd.uniform(-0.08, 0.08)
        tops.append((mx, my - th * 0.2, r, r * 0.6, max(0.25, min(0.98, tone)), seed * 31 + 20 + i))
    # a few raised cushions make the top lumpy (the pine's tiers)
    for i in range(3):
        u = rnd.uniform(-0.6, 0.4)
        v = rnd.uniform(-0.7, 0.1)
        r = rx * rnd.uniform(0.2, 0.25)
        tops.append((cx + u * rx * 0.6, cy + v * ry * 0.6 - th * 0.75, r, r * 0.58, min(0.98, 0.85 - 0.25 * u), seed * 31 + 40 + i))
    items += sorted(tops, key=lambda m: m[1])
    t.masses(items, pal, flecks=2, under=0.8)
    return t.finish()


def cypress(tid, h, d, seed, bend=0.0):
    """Mediterranean cypress: a slim dark flame of small scale-like sprays (height h, width d)."""
    t = Tree(tid, seed)
    rnd = t.rnd
    x, y = t.x, t.y
    w = d / 2 * R2
    H = h * ZS
    t.shadows(w * 0.9 + h * 0.12, w * 1.5, w * 0.6, cast_op=0.2, foot_rx=w * 0.55)
    t.limb(x, y, x, y - 4.5, 2.2, 1.8, "cypress")

    def half(tt):                          # half width of the flame at 0 (foot) .. 1 (tip)
        return w * (math.sin(math.pi * min(1.0, 0.1 + tt * 1.05)) ** 0.5) * (1 - 0.62 * tt ** 1.4) + 0.8

    def xc(tt):
        return x + bend * tt * tt

    # the flame's dark core silhouette
    side = [(xc(tt) - half(tt), y - 3 - (H - 3) * tt) for tt in [i / 16 for i in range(17)]]
    rside = [(xc(tt) + half(tt), y - 3 - (H - 3) * tt) for tt in [i / 16 for i in range(16, -1, -1)]]
    core = "M" + " L".join(f"{n1(px)},{n1(py)}" for px, py in side + rside) + "Z"
    t.c.add(f'<path d="{core}" fill="{PAL["cypress"]["deep"]}"/>')
    items = []
    rows = max(8, int(H / 4.2))
    for i in range(rows):
        tt = (i + 0.4) / rows
        hw = half(tt)
        yy = y - 4 - (H - 6) * tt
        for k, (fx, tone) in enumerate(((-0.42, 0.78), (0.0, 0.5), (0.42, 0.2))):
            if hw < 3 and k != 1:
                continue
            r = max(1.6, hw * (0.62 if k == 1 else 0.58)) * rnd.uniform(0.9, 1.1)
            items.append((xc(tt) + fx * hw + rnd.uniform(-0.5, 0.5), yy + rnd.uniform(-0.8, 0.8), r, min(3.6, r * 0.8) * 1.1,
                          max(0.1, min(0.95, tone - 0.15 * tt + rnd.uniform(-0.08, 0.08))), seed * 53 + i * 3 + k))
    t.masses(items, "cypress", flecks=1, under=0.6, cap=False)
    # the sunlit left flank
    lflank = "M" + " L".join(f"{n1(xc(tt) - half(tt) * 0.62)},{n1(y - 5 - (H - 7) * tt)}" for tt in [0.12 + 0.8 * i / 10 for i in range(11)])
    t.c.add(f'<path d="{lflank}" fill="none" stroke="{PAL["cypress"]["hi"]}" stroke-width="0.9" stroke-linecap="round" opacity="0.5"/>')
    t.grow(x - w - 2, y - H - 2, x + w + bend + 2, y + 2)
    return t.finish()


def holm_oak(tid, h, d, seed, lean=0.0, lobes=17, pal="oak"):
    """Holm oak: a short stout trunk under a rounded, dense dark crown of many leaf masses."""
    t = Tree(tid, seed)
    rnd = t.rnd
    x, y = t.x, t.y
    Rx = d / 2 * R2
    z0 = h * 0.22                           # the crown starts this high
    Ry = (h - z0) * ZS / 2
    cx, cy = x + lean, y - z0 * ZS - Ry
    t.shadows(Rx * 0.45 + h * 0.2, Rx * 0.9, Rx * 0.38, foot_rx=3.4)
    t.foot(2.8, "oak")
    t.limb(x, y, x + lean * 0.6, cy + Ry * 0.35, 4.4, 3.0, "oak", bend=1.2)
    t.limb(x + lean * 0.4, cy + Ry * 0.6, cx - Rx * 0.45, cy + Ry * 0.05, 2.2, 1.2, "oak", bend=1)
    t.limb(x + lean * 0.5, cy + Ry * 0.5, cx + Rx * 0.4, cy, 2.0, 1.1, "oak", bend=-1)
    items = []
    for i in range(lobes):
        if i < 10:                           # outer ring
            a = 2 * math.pi * (i + rnd.uniform(-0.2, 0.2)) / 10 + 0.3
            rr = rnd.uniform(0.66, 0.78)
        elif i < 15:                         # inner masses
            a = 2 * math.pi * (i - 10 + rnd.uniform(-0.3, 0.3)) / 5
            rr = rnd.uniform(0.22, 0.4)
        else:                                # crowning masses
            a = -math.pi / 2 + rnd.uniform(-0.6, 0.4)
            rr = rnd.uniform(0.55, 0.7)
        u, v = rr * math.cos(a), rr * math.sin(a)
        r = Rx * rnd.uniform(0.3, 0.38)
        tone = 0.55 - 0.35 * u - 0.42 * v + rnd.uniform(-0.08, 0.08)
        items.append((cx + u * Rx, cy + v * Ry, r, r * 0.86, max(0.08, min(0.98, tone)), seed * 41 + i))
    items.sort(key=lambda m: -m[1])          # lower masses first, upper ones overlap them
    t.masses(items, pal, flecks=2, under=1.0)
    return t.finish()


def shrub(tid, h, d, seed, pal="lentisk", flowers=None, n=6):
    """Maquis shrub: a low cushion of leaf masses (lentisk, sage, flowering broom or cistus)."""
    t = Tree(tid, seed)
    rnd = t.rnd
    x, y = t.x, t.y
    Rx = d / 2 * R2
    H = h * ZS
    t.shadows(Rx * 0.35 + 2, Rx * 1.0, Rx * 0.4, cast_op=0.24, foot_rx=Rx * 0.75, foot_op=0.38)
    items = []
    for i in range(n):
        if i < n - 2:
            u = -0.62 + 1.24 * (i + 0.5) / (n - 2) + rnd.uniform(-0.08, 0.08)
            v = rnd.uniform(-0.1, 0.15)
            zz = H * 0.32
        else:
            u = rnd.uniform(-0.35, 0.3)
            v = 0
            zz = H * rnd.uniform(0.6, 0.72)
        r = Rx * rnd.uniform(0.42, 0.52) * (0.85 if i >= n - 2 else 1)
        tone = 0.6 - 0.4 * u - (0.25 if zz < H * 0.5 else -0.15) + rnd.uniform(-0.06, 0.06)
        items.append((x + u * Rx, y - zz + v * Rx * 0.3, r, min(r * 0.78, H * 0.42), max(0.1, min(0.95, tone)), seed * 17 + i))
    items.sort(key=lambda m: -m[1])
    t.masses(items, pal, flecks=2, under=0.6)
    if flowers:
        dots = []
        for mx, my, r, ry_, tone, sd in items:
            if tone > 0.4:
                rr = random.Random(sd)
                for _ in range(4):
                    dots.append((mx + r * rr.uniform(-0.7, 0.5), my + ry_ * rr.uniform(-0.8, 0.2)))
        col, hi = flowers
        t.c.add(f'<g fill="{col}">' + "".join(f'<circle cx="{n1(px)}" cy="{n1(py)}" r="0.9"/>' for px, py in dots) + "</g>"
                f'<g fill="{hi}">' + "".join(f'<circle cx="{n1(px - 0.3)}" cy="{n1(py - 0.3)}" r="0.4"/>' for px, py in dots[::2]) + "</g>")
    return t.finish()


def wild_olive(tid, h, d, seed, lean=0.0, groups=3):
    """Wild olive: a gnarled, twisting grey trunk that splits into limbs, each carrying a loose
    cluster of silvery leaf masses (with gaps where the branches show)."""
    t = Tree(tid, seed)
    rnd = t.rnd
    x, y = t.x, t.y
    Rx = d / 2 * R2
    z0 = h * 0.3
    Ry = (h - z0) * ZS / 2
    cx, cy = x + lean, y - z0 * ZS - Ry
    t.shadows(Rx * 0.45 + h * 0.2, Rx * 0.85, Rx * 0.36, cast_op=0.2, foot_rx=3.6)
    t.foot(3.2, "olive")
    sx, sy = x + lean * 0.3 - 1.5, y - z0 * ZS * 0.6
    t.limb(x, y, sx, sy, 5.6, 4.2, "olive", bend=2.4)
    centres = []
    for i in range(groups):
        u = -0.55 + 1.1 * (i + 0.5) / groups + rnd.uniform(-0.1, 0.1)
        v = rnd.uniform(-0.45, 0.05) - (0.35 if i == groups // 2 else 0)
        gx, gy = cx + u * Rx, cy + v * Ry
        centres.append((gx, gy))
        t.limb(sx, sy, gx, gy + Ry * 0.4, 3.2, 1.6, "olive", bend=(gx - sx) * 0.2 + 1.2)
    # knots on the trunk
    t.c.add(f'<ellipse cx="{n1(x - 0.6)}" cy="{n1(y - z0 * ZS * 0.3)}" rx="0.8" ry="1.1" fill="{BARK["olive"][3]}" opacity="0.7"/>'
            f'<ellipse cx="{n1(x + 0.9)}" cy="{n1(y - z0 * ZS * 0.5)}" rx="0.6" ry="0.8" fill="{BARK["olive"][3]}" opacity="0.6"/>')
    items = []
    for gi, (gx, gy) in enumerate(centres):
        for k in range(4):
            a = 2 * math.pi * (k + rnd.uniform(-0.2, 0.2)) / 4 + gi
            ox, oy = math.cos(a) * Rx * 0.2, math.sin(a) * Ry * 0.32
            r = Rx * rnd.uniform(0.3, 0.38) * (1.15 if groups == 2 else 1)
            u = (gx + ox - cx) / Rx
            v = (gy + oy - cy) / Ry
            items.append((gx + ox, gy + oy, r, r * 0.72, max(0.15, min(0.95, 0.6 - 0.3 * u - 0.35 * v + rnd.uniform(-0.1, 0.1))), seed * 23 + gi * 5 + k))
    items.sort(key=lambda m: -m[1])
    t.masses(items, "olive", flecks=4, under=0.9)
    return t.finish()


# ---------------------------------------------------------------------------
# The 13 sprites (ids: the game loads this list in src/render/terrainArt.ts)
# ---------------------------------------------------------------------------
def build():
    return [
        umbrella_pine("pine1", h=52, d=42, seed=1, lean=-2, forks=3),
        umbrella_pine("pine2", h=58, d=46, seed=2, lean=4, forks=3, pal="pine_dark"),
        umbrella_pine("pine3", h=45, d=35, seed=3, lean=-5, forks=2),
        cypress("cypress1", h=52, d=13, seed=4, bend=0.8),
        cypress("cypress2", h=41, d=11, seed=5, bend=-1.2),
        holm_oak("oak1", h=36, d=35, seed=6, lean=0.5),
        holm_oak("oak2", h=31, d=31, seed=7, lean=-1.5, lobes=16, pal="oak_dark"),
        holm_oak("oak3", h=39, d=37, seed=8, lean=1.5, lobes=17, pal="oak_warm"),
        shrub("shrub1", h=10, d=17, seed=9, pal="lentisk"),
        shrub("shrub2", h=8, d=13, seed=10, pal="sage", flowers=("#b79ad0", "#e4d6f0"), n=5),
        shrub("shrub3", h=13, d=19, seed=11, pal="broom", flowers=("#f2c534", "#fff1a0"), n=7),
        wild_olive("olive1", h=27, d=27, seed=12, lean=1.0, groups=3),
        wild_olive("olive2", h=23, d=24, seed=13, lean=-1.5, groups=2),
    ]


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "terrain")
    for canvas in build():
        print("\n".join(canvas.write(out)))
