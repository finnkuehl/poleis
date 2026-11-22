"""lib_civic - shared pieces for the civic and military buildings (storehouse, borderTower,
barracks, marketplace). Builds on iso.py and follows the same rules (docs/ART.md, V1):
world units, light from the upper left, painter's order, owner colour only via c.accent().

Pieces: ashlar stone walls and wall blocks, a tapered round stone tower with merlons, a waving
flag, round hoplite shields on walls, and yard props (sacks, crates, baskets, a hand cart,
a fountain, a market stall).
"""
import math
import random

import iso
from iso import ACCENT, BRONZE, GOLD, WOOD, ZS, f, hull, poly

SQ2 = math.sqrt(2)

# Warm limestone, matching iso.stone_course.
STONE = {"top": "#ece5d5", "lit": "#ded4bf", "mid": "#c9bea7", "right": "#a8a093", "deep": "#8d867a",
         "joint": "#7b7163", "hi": "#f7f2e7", "dark": "#5f594f"}
BURLAP = {"hi": "#efdfbb", "lit": "#dcc79c", "base": "#bfa574", "shade": "#94794c", "dark": "#6a5433"}


def _id(prefix, *vals):
    """Unique gradient name from numbers (gradient names are per asset, first definition wins)."""
    return prefix + "_".join(f(v).replace(".", "p").replace("-", "m") for v in vals)


def rect(x, y, w, h, fill, op=None):
    o = f' opacity="{f(op)}"' if op is not None else ""
    return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" fill="{fill}"{o}/>'


# ---------------------------------------------------------------------------
# Ashlar stone walls
# ---------------------------------------------------------------------------
def _courses(x0, x1, z0, z1, course, rnd, joint, hi, tone_k=2.0):
    out = []
    n = max(1, round((z1 - z0) / course))
    ch = (z1 - z0) / n
    for k in range(n):
        y = z0 + k * ch
        x = x0 - rnd.uniform(0, 6)
        while x < x1:
            w = rnd.uniform(6.5, 11)
            xa, xb = max(x, x0), min(x + w, x1)
            if xb - xa > 0.8:
                tone = rnd.uniform(-0.07, 0.07)
                out.append(rect(xa, y, xb - xa, ch, "#fff" if tone > 0 else "#5a5040", abs(tone) * tone_k))
                if xb < x1 - 0.5:
                    out.append(rect(xb - 0.3, y, 0.6, ch, joint, 0.6))
            x += w
        out.append(rect(x0, y + ch - 0.5, x1 - x0, 0.5, hi, 0.7))
        if k:
            out.append(rect(x0, y - 0.25, x1 - x0, 0.5, joint, 0.5))
    return out


def ashlar_b(c, b, a0, a1, z0, z1, course=4.6, seed=1, ao=True):
    """Lit left (+b) wall of limestone blocks in courses."""
    rnd = random.Random(seed)
    g = c.lin(_id("asL", a0, a1), a0, 0, a1, 0, [(0, STONE["lit"]), (1, STONE["mid"])])
    out = [rect(a0, z0, a1 - a0, z1 - z0, g)] + _courses(a0, a1, z0, z1, course, rnd, STONE["joint"], STONE["hi"])
    if ao:
        g2 = c.lin(_id("asLao", z0), 0, z0, 0, z0 + 6, [(0, "#4b4436", 0.3), (1, "#4b4436", 0)])
        out.append(rect(a0, z0, a1 - a0, 6, g2))
    c.add(c.on(c.m_bface(b), "".join(out)))


def ashlar_a(c, a, b0, b1, z0, z1, course=4.6, seed=2, ao=True):
    """Shaded right (+a) wall of limestone blocks (local x = -b)."""
    rnd = random.Random(seed)
    x0, x1 = -b1, -b0
    g = c.lin(_id("asR", x0, x1), x0, 0, x1, 0, [(0, STONE["right"]), (1, STONE["deep"])])
    out = [rect(x0, z0, x1 - x0, z1 - z0, g)] + _courses(x0, x1, z0, z1, course, rnd, "#5d564b", "#c9c2b4", 1.4)
    if ao:
        g2 = c.lin(_id("asRb", z0), 0, z0, 0, z0 + 9, [(0, "#c9d58f", 0.3), (1, "#c9d58f", 0)])
        g3 = c.lin(_id("asRao", z0), 0, z0, 0, z0 + 5, [(0, "#2d271d", 0.35), (1, "#2d271d", 0)])
        out.append(rect(x0, z0, x1 - x0, 9, g2) + rect(x0, z0, x1 - x0, 5, g3))
    c.add(c.on(c.m_aface(a), "".join(out)))


def wall_block(c, a0, a1, b0, b1, z0, z1, seed=1, course=4.6, ao=True):
    """A free-standing stone wall / pier: top, lit +b face, shaded +a face."""
    c.add(c.on(c.m_ground(z1), rect(a0, b0, a1 - a0, b1 - b0, STONE["top"])))
    ashlar_b(c, b1, a0, a1, z0, z1, course, seed, ao)
    ashlar_a(c, a1, b0, b1, z0, z1, course, seed + 1, ao)


def merlons_a_run(c, a0, a1, b0, b1, z, n, w=4.0, h=3.4):
    """n merlons along a wall running in the a direction (wall thickness b0..b1)."""
    step = (a1 - a0 - w) / max(1, n - 1)
    for i in range(n):
        x = a0 + i * step
        iso.box(c, x, x + w, b0, b1, z, z + h, STONE["top"], STONE["lit"], STONE["right"], edge=STONE["hi"])


def merlons_b_run(c, a0, a1, b0, b1, z, n, w=4.0, h=3.4):
    """n merlons along a wall running in the b direction (wall thickness a0..a1), back to front."""
    step = (b1 - b0 - w) / max(1, n - 1)
    for i in range(n):
        y = b0 + i * step
        iso.box(c, a0, a1, y, y + w, z, z + h, STONE["top"], STONE["lit"], STONE["right"], edge=STONE["hi"])


# ---------------------------------------------------------------------------
# Round stone tower
# ---------------------------------------------------------------------------
TOWER_SIDE = [(0, "#d9cfba"), (0.16, "#efe7d5"), (0.4, "#dcd2bd"), (0.68, "#b0a898"), (0.9, "#8c867b"), (1, "#9a9485")]


def round_tower(c, r0, r1, z0, z1, courses=14, seed=3, name="tw", blocks=7):
    """Tapered round tower shaft of ashlar (radius r0 at z0 -> r1 at z1) around the origin."""
    rnd = random.Random(seed)
    x, yb = c.P(0, 0, z0)
    _, yt = c.P(0, 0, z1)
    R0, R1 = r0 * SQ2, r1 * SQ2
    g = c.lin(name, x - R0, 0, x + R0, 0, TOWER_SIDE)
    shape = (f"M{f(x - R1)},{f(yt)} L{f(x - R0)},{f(yb)} A{f(R0)},{f(R0 / 2)} 0 0 0 {f(x + R0)},{f(yb)} "
             f"L{f(x + R1)},{f(yt)} A{f(R1)},{f(R1 / 2)} 0 0 1 {f(x - R1)},{f(yt)}Z")
    out = [f'<path d="{shape}" fill="{g}"/>']

    def rad(t):
        return R0 + (R1 - R0) * t

    def pt(th, t):
        return (x + rad(t) * math.cos(th), yb + (yt - yb) * t + rad(t) / 2 * math.sin(th))

    lines, hi, patches = [], [], []
    for k in range(courses):
        t0, t1 = k / courses, (k + 1) / courses
        off = rnd.uniform(0, math.pi / blocks)
        ths = [off + i * math.pi / blocks for i in range(-1, blocks + 1)]
        for i, th in enumerate(ths):
            if 0.06 < th < math.pi - 0.06:
                p, q = pt(th, t0), pt(th, t1)
                lines.append(f"M{f(p[0])},{f(p[1])} L{f(q[0])},{f(q[1])}")
            if i + 1 < len(ths) and rnd.random() < 0.45:
                ta, tb = max(0.0, th), min(math.pi, ths[i + 1])
                if tb - ta > 0.12:
                    quad = [pt(ta, t0), pt((ta + tb) / 2, t0), pt(tb, t0), pt(tb, t1), pt((ta + tb) / 2, t1), pt(ta, t1)]
                    tone = rnd.uniform(-0.1, 0.1)
                    patches.append(f'<path d="{poly(quad)}" fill="{"#fff" if tone > 0 else "#4f4739"}" opacity="{f(abs(tone) * 1.5)}"/>')
        if k:
            R = rad(t0)
            y = yb + (yt - yb) * t0
            lines.append(f"M{f(x - R)},{f(y)} A{f(R)},{f(R / 2)} 0 0 0 {f(x + R)},{f(y)}")
            hi.append(f"M{f(x - R)},{f(y + 0.55)} A{f(R)},{f(R / 2)} 0 0 0 {f(x)},{f(y + R / 2 + 0.55)}")
    out.append("".join(patches))
    out.append(f'<path d="{" ".join(lines)}" fill="none" stroke="{STONE["joint"]}" stroke-width="0.5" opacity="0.55"/>')
    out.append(f'<path d="{" ".join(hi)}" fill="none" stroke="#fffaf0" stroke-width="0.45" opacity="0.55"/>')
    # foot AO
    ao = c.lin(name + "ao", 0, yb - 9, 0, yb + R0 / 2, [(0, "#3d352a", 0), (1, "#3d352a", 0.4)])
    out.append(f'<path d="{shape}" fill="{ao}"/>')
    c.add("".join(out))


def ring_band(c, r, z0, z1, fill, opacity=1.0):
    """Front half of a cylindrical band (radius r, z0..z1) as one filled path - for AO and trims."""
    x, y0 = c.P(0, 0, z0)
    _, y1 = c.P(0, 0, z1)
    R = r * SQ2
    c.add(f'<path d="M{f(x - R)},{f(y1)} L{f(x - R)},{f(y0)} A{f(R)},{f(R / 2)} 0 0 0 {f(x + R)},{f(y0)} L{f(x + R)},{f(y1)} '
          f'A{f(R)},{f(R / 2)} 0 0 1 {f(x - R)},{f(y1)}Z" fill="{fill}" opacity="{f(opacity)}"/>')


def round_merlons(c, r_out, r_in, z0, z1, n, part):
    """Merlons standing on a round parapet. part: "back" (draw before whatever stands on the
    platform) or "front" (draw after it)."""
    x, y0 = c.P(0, 0, z0)
    _, y1 = c.P(0, 0, z1)
    items = []
    for i in range(n):
        th = 2 * math.pi * (i + 0.5) / n
        s = math.sin(th)
        if (part == "back") != (s < -0.05):
            continue
        items.append((s, th))
    items.sort()
    d = math.pi / n * 0.56
    out = []
    for s, th in items:
        def sector(y):
            o = [(x + r_out * SQ2 * math.cos(th + d * k / 2), y + r_out * SQ2 / 2 * math.sin(th + d * k / 2)) for k in (-2, -1, 0, 1, 2)]
            i_ = [(x + r_in * SQ2 * math.cos(th + d * k / 2), y + r_in * SQ2 / 2 * math.sin(th + d * k / 2)) for k in (2, 1, 0, -1, -2)]
            return o + i_
        bot, top = sector(y0), sector(y1)
        lit = -math.cos(th)                       # +1 on the left (sunny) side
        if part == "back":
            side = "#9d968a" if lit > 0 else "#b9b1a1"   # we look at the inner faces
        else:
            side = "#e6ddc9" if lit > 0.35 else ("#cfc5af" if lit > -0.3 else "#a09989")
        out.append(f'<path d="{poly(hull(bot + top))}" fill="{side}"/><path d="{poly(top)}" fill="{STONE["top"]}"/>')
    c.add("".join(out))


# ---------------------------------------------------------------------------
# Flags and shields (owner colour)
# ---------------------------------------------------------------------------
def flag(c, a, b, z0, height, w=20, h=12, wave=2.4, pole=1.5, emblem=True):
    """Pole with a swallow-tailed flag flying to the right (screen space). The cloth is ACCENT."""
    x, y = c.P(a, b, z0)
    _, yt = c.P(a, b, z0 + height)
    c.add(rect(x - pole / 2, yt, pole, y - yt, WOOD["base"]) + rect(x - pole / 2, yt, pole * 0.4, y - yt, WOOD["lit"])
          + f'<circle cx="{f(x)}" cy="{f(yt - 1.2)}" r="{f(pole)}" fill="{GOLD["base"]}"/><circle cx="{f(x - 0.45)}" cy="{f(yt - 1.6)}" r="{f(pole * 0.4)}" fill="{GOLD["hi"]}"/>')
    x0, t = x + pole / 2, yt + 1.2
    cloth = (f"M{f(x0)},{f(t)} C{f(x0 + w * 0.3)},{f(t - wave)} {f(x0 + w * 0.6)},{f(t + wave)} {f(x0 + w)},{f(t + 0.6)} "
             f"L{f(x0 + w * 0.8)},{f(t + h * 0.52)} L{f(x0 + w)},{f(t + h + 0.6)} "
             f"C{f(x0 + w * 0.6)},{f(t + h + wave)} {f(x0 + w * 0.3)},{f(t + h - wave)} {f(x0)},{f(t + h)}Z")
    fold = c.lin("flagfold", 0, 0, 1, 0, [(0, ACCENT["light"]), (0.2, ACCENT["lit"]), (0.42, ACCENT["mid"]), (0.62, ACCENT["lit"]), (0.85, ACCENT["shade"]), (1, ACCENT["mid"])], bbox=True)
    c.accent(f'<path d="{cloth}" fill="{fold}"/>'
             f'<path d="M{f(x0)},{f(t + h)} C{f(x0 + w * 0.3)},{f(t + h - wave)} {f(x0 + w * 0.6)},{f(t + h + wave)} {f(x0 + w)},{f(t + h + 0.6)} L{f(x0 + w * 0.93)},{f(t + h - 1.6)} C{f(x0 + w * 0.6)},{f(t + h + wave - 2.2)} {f(x0 + w * 0.3)},{f(t + h - wave - 2.2)} {f(x0)},{f(t + h - 2.2)}Z" fill="{ACCENT["dark"]}" opacity="0.45"/>')
    if emblem:
        ex, ey = x0 + w * 0.36, t + h * 0.5 - wave * 0.15
        c.add(f'<circle cx="{f(ex)}" cy="{f(ey)}" r="{f(h * 0.2)}" fill="none" stroke="{GOLD["lit"]}" stroke-width="{f(h * 0.075)}"/>'
              f'<path d="M{f(x0)},{f(t + 0.35)} C{f(x0 + w * 0.3)},{f(t - wave + 0.35)} {f(x0 + w * 0.6)},{f(t + wave + 0.35)} {f(x0 + w)},{f(t + 0.95)}" fill="none" stroke="{GOLD["lit"]}" stroke-width="0.7"/>')


def _shield(r, shaded):
    ry = r * 0.92
    face = ACCENT["mid"] if shaded else ACCENT["lit"]
    acc = (f'<ellipse cx="0" cy="0" rx="{f(r)}" ry="{f(ry)}" fill="{face}"/>'
           f'<path d="M{f(-r * 0.7)},{f(-ry * 0.7)} A{f(r)},{f(ry)} 0 0 1 {f(r * 0.7)},{f(-ry * 0.7)} A{f(r * 1.25)},{f(ry * 1.25)} 0 0 0 {f(-r * 0.7)},{f(-ry * 0.7)}Z" fill="{ACCENT["dark"]}" opacity="0.4"/>')
    rim = BRONZE["base"] if shaded else BRONZE["lit"]
    hi = BRONZE["lit"] if shaded else BRONZE["hi"]
    art = (f'<ellipse cx="0" cy="0" rx="{f(r * 0.88)}" ry="{f(ry * 0.88)}" fill="none" stroke="{rim}" stroke-width="{f(r * 0.24)}"/>'
           f'<path d="M{f(-r * 0.88)},0 A{f(r * 0.88)},{f(ry * 0.88)} 0 0 0 0,{f(ry * 0.88)}" fill="none" stroke="{hi}" stroke-width="{f(r * 0.1)}"/>'
           f'<circle cx="0" cy="0" r="{f(r * 0.2)}" fill="{rim}"/>')
    return acc, art


def shield_b(c, b, a, z, r=4.2):
    """Round hoplite shield hanging on a lit +b wall. Face = ACCENT, bronze rim and boss = art."""
    acc, art = _shield(r, False)
    m = c.m_bface(b)
    c.add(c.on(m, f'<ellipse cx="{f(a + 0.9)}" cy="{f(z - 0.9)}" rx="{f(r)}" ry="{f(r * 0.92)}" fill="#3d352a" opacity="0.35"/>'))
    c.accent(c.on(m, f'<g transform="translate({f(a)} {f(z)})">{acc}</g>'))
    c.add(c.on(m, f'<g transform="translate({f(a)} {f(z)})">{art}</g>'))


def shield_a(c, a, b, z, r=4.2):
    """Round hoplite shield hanging on a shaded +a wall (at world b)."""
    acc, art = _shield(r, True)
    m = c.m_aface(a)
    c.add(c.on(m, f'<ellipse cx="{f(-b + 0.9)}" cy="{f(z - 0.9)}" rx="{f(r)}" ry="{f(r * 0.92)}" fill="#2a251d" opacity="0.4"/>'))
    c.accent(c.on(m, f'<g transform="translate({f(-b)} {f(z)})">{acc}</g>'))
    c.add(c.on(m, f'<g transform="translate({f(-b)} {f(z)})">{art}</g>'))


def shield_screen(c, x, y, r=4.2, squash=0.8):
    """Round shield in screen space (on a curved wall or carried by a dummy)."""
    acc, art = _shield(r, False)
    t = f'translate({f(x)} {f(y)}) scale({f(squash)} -1)'
    c.add(f'<ellipse cx="{f(x + 1)}" cy="{f(y + 1)}" rx="{f(r * squash)}" ry="{f(r * 0.92)}" fill="#3d352a" opacity="0.35"/>')
    c.accent(f'<g transform="{t}">{acc}</g>')
    c.add(f'<g transform="{t}">{art}</g>')


# ---------------------------------------------------------------------------
# Yard props
# ---------------------------------------------------------------------------
def sack(c, a, b, z=0.0, k=1.0, lying=False, shadow=True):
    """Burlap sack, standing (tied neck) or lying."""
    x, y = c.P(a, b, z)
    g = c.lin("sack", 0, 0, 1, 0, [(0, BURLAP["hi"]), (0.35, BURLAP["lit"]), (0.75, BURLAP["base"]), (1, BURLAP["shade"])], bbox=True)
    out = ""
    if shadow:
        out += f'<ellipse cx="{f(x + 1.6 * k)}" cy="{f(y + 0.2)}" rx="{f(5.2 * k)}" ry="{f(1.8 * k)}" fill="#1f2e15" opacity="0.35" filter="{c.blur(0.45)}"/>'
    if lying:
        body = ('<path d="M-5.6,-0.6 C-6.2,-3.6 -3.8,-5.4 0,-5.3 C3.6,-5.2 5.4,-4.4 6.6,-3.4 L7.6,-4 L7.5,-0.8 L6.4,-1.6 C5,0.2 -4.2,0.8 -5.6,-0.6Z" fill="%s"/>'
                '<path d="M-4.4,-3.2 C-2.5,-4.6 1.5,-4.7 4,-3.9" fill="none" stroke="%s" stroke-width="0.7" opacity="0.8"/>'
                '<path d="M6.3,-3.5 L6.3,-1.5" stroke="%s" stroke-width="0.7"/>') % (g, BURLAP["hi"], BURLAP["dark"])
    else:
        body = ('<path d="M-4.2,0 C-5.6,-2.4 -5,-7 -2.4,-8.6 L-1.6,-10.8 L1.9,-10.6 L2.4,-8.5 C5.2,-7 5.6,-2.2 4.1,0 C2,0.9 -2.2,0.9 -4.2,0Z" fill="%s"/>'
                '<path d="M-2.5,-8.6 L2.4,-8.5" stroke="%s" stroke-width="0.9"/>'
                '<path d="M-3.4,-6 C-4,-4 -3.6,-2 -3,-1" fill="none" stroke="%s" stroke-width="0.7" opacity="0.8"/>'
                '<path d="M1,-7.4 C2.4,-5.4 2.6,-3 1.8,-0.8" fill="none" stroke="%s" stroke-width="0.6" opacity="0.5"/>') % (g, BURLAP["dark"], BURLAP["hi"], BURLAP["shade"])
    c.add(out + f'<g transform="translate({f(x)} {f(y)}) scale({f(k)})">{body}</g>')


def crate(c, a, b, s=5.0, h=None, z=0.0):
    """Wooden crate (half size s) with plank lines and corner battens."""
    h = h or s * 1.6
    iso.box(c, a - s, a + s, b - s, b + s, z, z + h, "#c79763", WOOD["lit"], WOOD["dark"], edge="#e2b98a")
    lines = "".join(rect(a - s, z + h * k / 3 - 0.2, 2 * s, 0.45, WOOD["deep"], 0.55) for k in (1, 2))
    c.add(c.on(c.m_bface(b + s), lines + rect(a - s, z, 1.1, h, WOOD["base"]) + rect(a + s - 1.1, z, 1.1, h, WOOD["base"])))
    lines = "".join(rect(-b - s, z + h * k / 3 - 0.2, 2 * s, 0.45, "#24150b", 0.55) for k in (1, 2))
    c.add(c.on(c.m_aface(a + s), lines + rect(-b - s, z, 1.1, h, WOOD["deep"]) + rect(-b + s - 1.1, z, 1.1, h, WOOD["deep"])))


def tarp(c, a, b, s, z, drop=4.0):
    """Owner-coloured cloth thrown over a crate of half size s whose top is at height z."""
    e = s + 0.7
    c.accent(c.on(c.m_ground(z + 0.3), rect(a - e, b - e, 2 * e, 2 * e, ACCENT["lit"]))
             + c.on(c.m_bface(b + e), f'<path d="M{f(a - e)},{f(z + 0.3)} L{f(a + e)},{f(z + 0.3)} L{f(a + e)},{f(z - drop)} L{f(a + e * 0.3)},{f(z - drop + 1.5)} L{f(a - e * 0.4)},{f(z - drop - 0.6)} L{f(a - e)},{f(z - drop + 1)}Z" fill="{ACCENT["light"]}"/>')
             + c.on(c.m_aface(a + e), f'<path d="M{f(-b - e)},{f(z + 0.3)} L{f(-b + e)},{f(z + 0.3)} L{f(-b + e)},{f(z - drop + 1)} L{f(-b)},{f(z - drop - 0.5)} L{f(-b - e)},{f(z - drop)}Z" fill="{ACCENT["shade"]}"/>'))
    c.add(c.on(c.m_bface(b + e), rect(a - e, z - 0.5, 2 * e, 0.6, GOLD["lit"], 0.9))
          + c.on(c.m_aface(a + e), rect(-b - e, z - 0.5, 2 * e, 0.6, GOLD["mid"], 0.9)))


def basket(c, a, b, k=1.0, goods="#d9463a", hi="#f08a6a", z=0.0):
    """Wicker basket heaped with fruit (goods = fruit colour)."""
    x, y = c.P(a, b, z)
    g = c.lin("bask", 0, 0, 1, 0, [(0, "#e2bd7c"), (0.5, "#c0965a"), (1, "#8a6234")], bbox=True)
    dots = "".join(f'<circle cx="{f(dx)}" cy="{f(dy)}" r="1.25" fill="{goods}"/><circle cx="{f(dx - 0.4)}" cy="{f(dy - 0.4)}" r="0.45" fill="{hi}"/>'
                   for dx, dy in [(-2.2, -5.2), (0, -5.9), (2.2, -5.2), (-1.1, -6.6), (1.2, -6.7), (0, -7.4)])
    c.add(f'<ellipse cx="{f(x + 1)}" cy="{f(y + 0.2)}" rx="{f(4.4 * k)}" ry="{f(1.6 * k)}" fill="#1f2e15" opacity="0.3" filter="{c.blur(0.45)}"/>'
          f'<g transform="translate({f(x)} {f(y)}) scale({f(k)})">'
          f'<path d="M-3,0 C-2,0.9 2,0.9 3,0 L4,-5 C2,-3.9 -2,-3.9 -4,-5Z" fill="{g}"/>'
          f'<ellipse cx="0" cy="-5" rx="4" ry="1.5" fill="#6e4a26"/>{dots}'
          f'<path d="M-3.6,-3.4 C-1.5,-2.4 1.5,-2.4 3.6,-3.4 M-3.3,-1.7 C-1.5,-0.8 1.5,-0.8 3.3,-1.7" fill="none" stroke="#7a5429" stroke-width="0.5" opacity="0.7"/></g>')


def hand_cart(c, a, b, load=True):
    """Two-wheeled hand cart standing along the a axis, shafts resting on the ground toward +a."""
    W = WOOD
    iso.blob_shadow(c, a + 6, b + 1, 9, 0.34)
    hb = 5.0
    # far wheel (only its lower rim shows under the body)
    c.add(c.on(c.m_bface(b - hb - 0.6), f'<ellipse cx="{f(a - 1)}" cy="5.4" rx="5.6" ry="5.2" fill="none" stroke="{W["deep"]}" stroke-width="1.5"/>'))
    # shafts toward +a, resting on the ground
    for sb, col in ((-hb + 0.8, W["dark"]), (hb - 0.8, W["lit"])):
        p, q = c.P(a + 8, b + sb, 8.2), c.P(a + 23, b + sb, 0.8)
        c.add(f'<path d="M{f(p[0])},{f(p[1])} L{f(q[0])},{f(q[1])}" stroke="{col}" stroke-width="1.5" stroke-linecap="round"/>')
    iso.box(c, a - 9, a + 8, b - hb, b + hb, 6.6, 11.6, "#c79763", W["lit"], W["dark"], edge="#e2b98a")
    c.add(c.on(c.m_bface(b + hb), "".join(rect(a - 9 + i * 3.4, 6.6, 0.45, 5, W["deep"], 0.5) for i in range(1, 5)) + rect(a - 9, 6.6, 17, 0.9, W["dark"], 0.6)))
    if load:
        sack(c, a - 4.5, b - 1, 11.6, 0.95, shadow=False)
        sack(c, a + 2.5, b - 1.5, 11.6, 0.9, shadow=False)
        sack(c, a - 1, b + 2.2, 11.6, 0.85, lying=True, shadow=False)
    # near wheel
    spokes = "".join(f'<path d="M{f(a - 1)},5.4 L{f(a - 1 + 5.2 * math.cos(t))},{f(5.4 + 4.8 * math.sin(t))}" stroke="{W["dark"]}" stroke-width="0.8"/>' for t in [i * math.pi / 3 for i in range(6)])
    c.add(c.on(c.m_bface(b + hb + 0.9), f'<ellipse cx="{f(a - 1)}" cy="5.4" rx="5.4" ry="5" fill="#d9b98a" opacity="0.25"/>{spokes}'
               f'<ellipse cx="{f(a - 1)}" cy="5.4" rx="5.6" ry="5.2" fill="none" stroke="{W["base"]}" stroke-width="1.7"/>'
               f'<path d="M{f(a - 6.6)},5.4 A5.6,5.2 0 0 0 {f(a - 1)},10.6" fill="none" stroke="#c99a6a" stroke-width="0.6" transform="translate(0 0)"/>'
               f'<ellipse cx="{f(a - 1)}" cy="5.4" rx="1.3" ry="1.2" fill="{BRONZE["base"]}"/>'))


def fountain(c, r=9.0):
    """Round marble fountain basin with a centre bowl and falling water (around the origin)."""
    M = iso.MARBLE
    x, y = c.P(0, 0, 0)
    c.add(f'<ellipse cx="{f(x + 3)}" cy="{f(y + 1)}" rx="{f(r * SQ2 + 3)}" ry="{f(r * SQ2 / 2 + 1.5)}" fill="#3d3628" opacity="0.32" filter="{c.blur(1.2)}"/>')
    iso.cylinder(c, r, 0, 4.6, [(0, "#f6f2e8"), (0.35, "#e8e2d4"), (0.75, "#bfc1bd"), (1, "#a6a9a8")], top=M["top"], name="fnt")
    c.add(f'<path d="{iso.ring_front_arc(c, r, 4.6, 0.3)}" fill="none" stroke="#fff" stroke-width="0.7" opacity="0.9"/>')
    xw, yw = c.P(0, 0, 4.2)
    rw = (r - 1.7) * SQ2
    water = c.rad("fwater", xw - rw * 0.3, yw - rw * 0.2, rw * 1.2, [(0, "#a9e3ea"), (0.5, "#5bb9cc"), (1, "#2f86a6")])
    c.add(f'<ellipse cx="{f(xw)}" cy="{f(yw)}" rx="{f(rw)}" ry="{f(rw / 2)}" fill="#8f918c"/>'
          f'<ellipse cx="{f(xw)}" cy="{f(yw + 0.9)}" rx="{f(rw - 0.6)}" ry="{f(rw / 2 - 0.7)}" fill="{water}"/>'
          f'<path d="M{f(xw - rw * 0.55)},{f(yw + 0.2)} A{f(rw * 0.6)},{f(rw * 0.28)} 0 0 1 {f(xw + rw * 0.1)},{f(yw - rw * 0.2)}" fill="none" stroke="#e9fbff" stroke-width="0.8" opacity="0.8"/>')
    iso.cylinder(c, 1.5, 4, 12.5, [(0, "#f6f2e8"), (0.5, "#dcd7ca"), (1, "#a6a9a8")], name="fntp")
    xb, yb = c.P(0, 0, 12.5)
    c.add(f'<path d="M{f(xb - 5.6)},{f(yb - 1)} C{f(xb - 4)},{f(yb + 2.6)} {f(xb + 4)},{f(yb + 2.6)} {f(xb + 5.6)},{f(yb - 1)}Z" fill="#cfcabd"/>'
          f'<ellipse cx="{f(xb)}" cy="{f(yb - 1)}" rx="5.6" ry="2.2" fill="{M["top"]}"/>'
          f'<ellipse cx="{f(xb)}" cy="{f(yb - 0.8)}" rx="4.4" ry="1.5" fill="#6cc3d4"/>'
          f'<path d="M{f(xb - 4.6)},{f(yb - 0.4)} Q{f(xb - 6.4)},{f(yb + 5)} {f(xb - 6)},{f(yw + 0.5)} M{f(xb + 4.6)},{f(yb - 0.4)} Q{f(xb + 6.4)},{f(yb + 5)} {f(xb + 6)},{f(yw + 1)} M{f(xb)},{f(yb + 0.8)} L{f(xb)},{f(yw + 3)}" fill="none" stroke="#dff7fb" stroke-width="0.9" stroke-linecap="round" opacity="0.9"/>'
          f'<path d="M{f(xb)},{f(yb - 1.2)} L{f(xb)},{f(yb - 5)}" stroke="#eafcff" stroke-width="1.1" stroke-linecap="round"/>'
          f'<circle cx="{f(xb)}" cy="{f(yb - 5.4)}" r="1.1" fill="#f4feff"/>')


def stall(c, w=11.0, d=4.0, z_aw=19.0, depth=13.0, drop=5.0, stripes=6, goods=0, two_tone=False):
    """Market stall around the origin: wooden counter (half width w, half depth d) heaped with
    goods, four posts and a big striped awning (ACCENT) sloping toward the viewer.
    two_tone=True: the awning stripes are two shades of the owner colour (iso.awning_b), so the
    stall reads in the owner colour at map size (grounded marketplace)."""
    W = WOOD
    iso.blob_shadow(c, 8, 1, w * 0.9, 0.34)
    back = -d - 2.5
    for a in (-w, w):                                    # back posts
        x, y = c.P(a, back, 0)
        _, yt = c.P(a, back, z_aw)
        c.add(rect(x - 0.6, yt, 1.2, y - yt, W["deep"]))
    iso.box(c, -w + 1, w - 1, -d, d, 0, 6.2, "#c79763", W["lit"], W["dark"], edge="#e2b98a")
    c.add(c.on(c.m_bface(d), "".join(rect(-w + 1 + i * 3.6, 0, 0.45, 6.2, W["deep"], 0.5) for i in range(1, int((2 * w - 2) / 3.6) + 1))))
    palettes = [[("#d9463a", "#f08a6a"), ("#e8b53c", "#f8dc8a"), ("#6f8f3a", "#a9c56e"), ("#7a2a4a", "#b0567a")],
                [("#e8923c", "#f8c98a"), ("#6f8f3a", "#a9c56e"), ("#d9463a", "#f08a6a"), ("#e8d9b0", "#fff8e4")],
                [("#7a2a4a", "#b0567a"), ("#e8b53c", "#f8dc8a"), ("#c9683c", "#eea27c"), ("#6f8f3a", "#a9c56e")]]
    pal = palettes[goods % 3]
    n = 4
    for i in range(n):                                   # heaps of produce on the counter
        col, hi = pal[i % len(pal)]
        x, y = c.P(-w + 3.2 + i * (2 * w - 6.4) / (n - 1), 0, 6.2)
        c.add(f'<ellipse cx="{f(x)}" cy="{f(y - 1.2)}" rx="2.9" ry="2.1" fill="{col}"/><ellipse cx="{f(x - 0.8)}" cy="{f(y - 2)}" rx="1.3" ry="0.8" fill="{hi}"/>')
    zf = z_aw - drop
    fr = back + depth
    for a in (-w, w):                                    # front posts
        x, y = c.P(a, fr - 1, 0)
        _, yt = c.P(a, fr - 1, zf)
        c.add(rect(x - 0.65, yt, 1.3, y - yt, W["base"]) + rect(x - 0.65, yt, 0.5, y - yt, W["lit"]))
    # shade under the awning on the counter top
    c.add(c.on(c.m_ground(6.3), rect(-w + 1, -d, 2 * w - 2, 2 * d, "#2a1c10", 0.22)))
    iso.awning_b(c, -w - 1.5, w + 1.5, back, z_aw, depth=depth, drop=drop, stripes=stripes, two_tone=two_tone)
