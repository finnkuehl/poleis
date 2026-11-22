"""Poleis art library for UNITS (board-game figures on a round token). Builds on iso.py.

Units use their own fixed canvas (docs/ART.md): viewBox 0 0 128 128, the token's top ellipse is
centred at (64, 96) and 88 px wide. Here 1 world unit = 1 px (the token radius is TOKEN_R).

Two frames are available:
  * the normal iso frame of iso.py (c.P, c.m_ground, c.m_bface, c.m_aface ...)
  * the BROADSIDE frame (u, v, z): u runs along the screen horizontal (world direction a-b),
    v points at the viewer (a+b). Profiles - ships, horses, carts - are drawn in it:
        screen x = ox + SQ2 * u,   screen y = oy + v / SQ2 - ZS * z
    c.m_front(v): vertical plane facing the viewer (local x=u, y=z up);  c.m_flat(z): ground.
Figures (people, animals) are drawn in screen space around their feet point, like iso.figure.

The accent rule is the same as for buildings: c.accent() for owner-coloured parts (greys from
iso.ACCENT), drawn in painter's order; the art gets holes; the game draws the accent UNDER the art.
"""
import math
import random

import iso
from iso import ACCENT, BRONZE, GOLD, WOOD, ZS, f, poly, puff

UNIT_CANVAS = 128
TOKEN_CX, TOKEN_CY = 64, 96     # centre of the token's top ellipse
TOKEN_W = 88                    # width of the token's top ellipse (x 20 -> 108)
SQ2 = math.sqrt(2)
TOKEN_R = TOKEN_W / 2 / SQ2     # token radius in world units (1 unit = 1 px)
TOKEN_H = 8.5                   # side height of the token
TOKEN_LIP = 1.6                 # grass lip at the top of the side; the rest is the owner band

# materials (bbox gradients across a part: lit left -> shaded right)
SKIN = [(0, "#f6d3ad"), (0.25, "#e8b48a"), (0.6, "#c98f66"), (0.9, "#9c6644"), (1, "#7f5238")]
LINEN = [(0, "#fffdf6"), (0.25, "#f3ebd8"), (0.6, "#ddd1b6"), (0.9, "#b3a688"), (1, "#9a8e72")]
WOOL = [(0, "#c49866"), (0.3, "#a57749"), (0.7, "#7f5634"), (1, "#5a3a22")]
LEATHER = [(0, "#c08a55"), (0.3, "#9c6a3c"), (0.7, "#774c2a"), (1, "#56351c")]
FELT = [(0, "#f1dca2"), (0.4, "#d8b56c"), (0.8, "#b08a48"), (1, "#8f6c34")]
METAL = [(0, BRONZE["hi"]), (0.18, BRONZE["lit"]), (0.5, BRONZE["base"]), (0.82, BRONZE["shade"]), (1, BRONZE["dark"])]
CLOTH_ACCENT = [(0, ACCENT["lit"]), (0.35, ACCENT["light"]), (0.7, ACCENT["shade"]), (1, ACCENT["dark"])]
HAIR = "#4a3222"
HAIR_HI = "#7a5a40"


class UnitCanvas(iso.Canvas):
    """iso.Canvas on the unit canvas (128 px, token centre (64, 96), 1 world unit = 1 px)."""

    def __init__(self, asset_id, pid=None):
        super().__init__(asset_id, pid)
        self.ox, self.oy = TOKEN_CX, TOKEN_CY
        self.size = UNIT_CANVAS
        self.scale = 1.0

    def _wrap(self, body):
        return f"<g>{body}</g>"

    # broadside frame ----------------------------------------------------
    def Pu(self, u, v, z=0.0):
        """Broadside point: u along the screen horizontal, v toward the viewer, z up."""
        return (self.ox + SQ2 * u, self.oy + v / SQ2 - ZS * z)

    def m_front(self, v=0.0):
        """Vertical plane facing the viewer at depth v. Local (x=u, y=z), y up."""
        return f"matrix({f(SQ2)} 0 0 {-ZS} {f(self.ox)} {f(self.oy + v / SQ2)})"

    def m_flat(self, z=0.0):
        """Horizontal plane in broadside coordinates. Local (x=u, y=v)."""
        return f"matrix({f(SQ2)} 0 0 {f(1 / SQ2)} {f(self.ox)} {f(self.oy - ZS * z)})"


def grad(c, name, st):
    """Shared bbox gradient across a part (lit left)."""
    return c.lin(name, 0, 0, 1, 0, st, bbox=True)


# ---------------------------------------------------------------------------
# Token (round base): grass or water top, owner band on the side
# ---------------------------------------------------------------------------
def token(c, top="grass", seed=3, tufts=26, flowers=5):
    """Draw the unit token. Must be the first thing drawn. Defines the clip c.url("top")."""
    rnd = random.Random(seed)
    cx, cy = c.P(0, 0, 0)
    rx, ry = TOKEN_W / 2, TOKEN_W / 4
    h = TOKEN_H

    def band(y0, y1):
        return (f"M{f(cx - rx)},{f(cy + y0)} A{f(rx)},{f(ry)} 0 0 0 {f(cx + rx)},{f(cy + y0)} "
                f"L{f(cx + rx)},{f(cy + y1)} A{f(rx)},{f(ry)} 0 0 1 {f(cx - rx)},{f(cy + y1)}Z")

    def arc(y, inset=0.0):
        return f"M{f(cx - rx + inset)},{f(cy + y)} A{f(rx - inset)},{f(ry)} 0 0 0 {f(cx + rx - inset)},{f(cy + y)}"

    c.add(f'<ellipse cx="{f(cx + 3)}" cy="{f(cy + h - 1)}" rx="{f(rx * 0.98)}" ry="{f(ry * 0.9)}" fill="#1d2b36" opacity="0.22" filter="{c.blur(1.6)}"/>')
    own = c.lin("own", cx - rx, 0, cx + rx, 0, [(0, ACCENT["lit"]), (0.3, ACCENT["light"]), (0.6, ACCENT["mid"]), (0.86, ACCENT["shade"]), (1, ACCENT["dark"])])
    c.accent(f'<path d="{band(0.5, h)}" fill="{own}"/><path d="{band(h - 1.4, h)}" fill="{ACCENT["deep"]}" opacity="0.35"/>')
    c.add(f'<path d="{arc(TOKEN_LIP + 0.8, 0.5)}" fill="none" stroke="#fff" stroke-width="0.8" opacity="0.5"/>')

    if top == "water":
        wat = c.rad("water", cx - rx * 0.35, cy - ry * 0.6, rx * 1.2, [(0, "#8fe0d8"), (0.45, "#4fc0c2"), (0.85, "#2f9fb0"), (1, "#25879e")])
        c.add(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="{wat}"/>')
        c.define("top", f'<clipPath id="{c.id("top")}"><ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}"/></clipPath>')
        # rim of foam + wave glints
        c.add(f'<path d="{arc(0.2)}" fill="none" stroke="#e9fbf8" stroke-width="1.6" opacity="0.85"/>'
              f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx - 0.8)}" ry="{f(ry - 0.5)}" fill="none" stroke="#dff7f3" stroke-width="0.8" opacity="0.55"/>')
        g = [f'<g clip-path="{c.url("top")}">']
        for _ in range(16):
            ang = rnd.uniform(0, 2 * math.pi)
            rr = TOKEN_R * math.sqrt(rnd.random()) * 0.9
            x, y = c.P(rr * math.cos(ang), rr * math.sin(ang), 0)
            w = rnd.uniform(3, 6)
            g.append(f'<path d="M{f(x - w)},{f(y)} q{f(w / 2)},{f(-1.4)} {f(w)},0 q{f(w / 2)},{f(1.4)} {f(w)},0" fill="none" stroke="#ffffff" stroke-width="0.7" opacity="{f(rnd.uniform(0.35, 0.7))}"/>')
        g.append("</g>")
        c.add("".join(g))
        return
    # grass lip (drips over the band), grass top
    n = 44
    outer = [(cx + rx * math.cos(math.pi - math.pi * i / n), cy + ry * math.sin(math.pi - math.pi * i / n)) for i in range(n + 1)]
    inner = []
    for i in range(n, -1, -1):
        th = math.pi - math.pi * i / n
        drip = TOKEN_LIP + rnd.random() * 0.9 + (0.9 if rnd.random() < 0.2 else 0)
        inner.append((cx + rx * math.cos(th), cy + ry * math.sin(th) + drip * (0.4 + 0.6 * math.sin(th))))
    lip = c.lin("lip", cx - rx, 0, cx + rx, 0, [(0, "#8fbe4e"), (0.5, "#76a23e"), (1, "#557b2c")])
    gr = c.rad("grass", cx - rx * 0.35, cy - ry * 0.55, rx * 1.25, [(0, "#bddb76"), (0.45, "#a3cb5f"), (0.8, "#8fbb4f"), (1, "#7aa842")])
    c.add(f'<path d="{poly(outer + inner)}" fill="{lip}"/>'
          f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="{gr}"/>'
          f'<path d="M{f(cx - rx + 1.2)},{f(cy + 0.6)} A{f(rx - 1.2)},{f(ry - 0.6)} 0 0 0 {f(cx + rx * 0.5)},{f(cy + ry * 0.85)}" fill="none" stroke="#dcefa2" stroke-width="0.9" opacity="0.6"/>'
          f'<path d="M{f(cx - rx + 0.8)},{f(cy)} A{f(rx - 0.8)},{f(ry - 0.5)} 0 0 1 {f(cx + rx - 0.8)},{f(cy)}" fill="none" stroke="#e8f5b8" stroke-width="0.8" opacity="0.55"/>')
    c.define("top", f'<clipPath id="{c.id("top")}"><ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}"/></clipPath>')
    g = [f'<g clip-path="{c.url("top")}">']
    for _ in range(tufts):
        ang = rnd.uniform(0, 2 * math.pi)
        rr = TOKEN_R * (0.45 + 0.55 * math.sqrt(rnd.random())) * 0.95
        x, y = c.P(rr * math.cos(ang), rr * math.sin(ang), 0)
        g.append(iso.grass_tuft(x, y, rnd.uniform(1.8, 3), "#6c9a38" if rnd.random() < 0.7 else "#c4e086", sw=0.6, op=0.8))
    for _ in range(flowers):
        ang = rnd.uniform(0, 2 * math.pi)
        rr = TOKEN_R * (0.55 + 0.4 * rnd.random())
        x, y = c.P(rr * math.cos(ang), rr * math.sin(ang), 0)
        g.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="0.8" fill="{rnd.choice(["#fffaf0", "#f6d65a", "#f3b8c8"])}"/>')
    g.append("</g>")
    c.add("".join(g))


def ground_shadow(c, x, y, w, length=None, opacity=0.38):
    """Contact shadow under a figure standing at screen point (x, y), plus a soft cast shadow
    falling to the lower right (clipped to the token top). w = half width of the footprint."""
    length = length if length is not None else w * 1.6
    c.add(f'<g clip-path="{c.url("top")}">'
          f'<ellipse cx="{f(x + length * 0.55)}" cy="{f(y + 1.2)}" rx="{f(w + length * 0.6)}" ry="{f(w * 0.32 + 1)}" fill="#1f3315" opacity="{f(opacity * 0.55)}" filter="{c.blur(1.4)}"/>'
          f'<ellipse cx="{f(x + 0.8)}" cy="{f(y + 0.4)}" rx="{f(w)}" ry="{f(w * 0.34 + 0.6)}" fill="#1f3315" opacity="{f(opacity)}" filter="{c.blur(0.7)}"/></g>')


# ---------------------------------------------------------------------------
# People (painted miniatures), drawn in screen space; feet at (x, y), height h = feet -> head top
# ---------------------------------------------------------------------------
LLEG = "M-9,-42 L-1.6,-42 C-1.4,-34 -1.6,-28 -2.4,-24 C-1.6,-16 -2.2,-8 -3,-2 L-1.8,1.5 L-10.4,1.5 L-9.2,-2 C-10.6,-9 -11.2,-17 -9.8,-24 C-10.8,-29 -10.4,-36 -9,-42Z"
RLEG = "M0.4,-42 L9,-42 C10,-36 10.2,-30 9.2,-25 C10.2,-18 9.6,-9 8.8,-2 L10,0 L1.2,0 L2.2,-2 C1.2,-9 0.8,-17 1.6,-25 C0.6,-30 0.2,-36 0.4,-42Z"
LGREAVE = "M-10.4,-23 C-11,-16 -10.5,-8 -9.4,-3 L-3.2,-3 C-2.4,-9 -2,-16 -2.6,-23Z"
RGREAVE = "M1.7,-24 C1.1,-17 1.5,-9 2.3,-3 L8.9,-3 C9.7,-9 10.1,-17 9.3,-24Z"
LSANDAL = "M-10.8,1.6 L-1.5,1.6 L-2.3,-1.6 L-9.7,-1.6Z"
RSANDAL = "M0.9,0.4 L10.3,0.4 L9.1,-2 L1.9,-2Z"
TUNIC = "M-11.5,-73 C-13.5,-62 -12,-50 -13.5,{hem} C-6,{hem2} 6,{hem2} 13.5,{hem} C12,-50 13.5,-62 11.5,-73 C6,-76 -6,-76 -11.5,-73Z"
CUIRASS = "M-12.5,-72 C-13.5,-64 -11.5,-56 -9.5,-51 L9.5,-51 C11.5,-56 13.5,-64 12.5,-72 C6,-75 -6,-75 -12.5,-72Z"
SKIRT = "M-9.5,-51 L9.5,-51 L11.8,-39 L-11.8,-39Z"
CLOAK = "M-12,-73 C-15.5,-62 -17,-46 -15.5,-30 L-6,-28 L8,-28 L16,-31 C18,-46 17,-62 12,-73Z"
CLOAK_FLOW = "M-11,-74 C-4,-77.5 8,-77.5 13,-73.5 C21,-70 30,-63 37,-52 C31,-52.5 27.5,-49 23.5,-43 C21,-50 17,-56 12,-58 L-8,-60Z"
NECK = "M-2.6,-79 L2.6,-79 L3.2,-73 L-3.2,-73Z"
HAIR_CAP = "M-6.6,-85 C-7.4,-93 -3.4,-96 0.6,-96 C5.2,-96 7.6,-92.5 6.9,-85.5 C6,-89.5 3.5,-91.2 0.4,-91.2 C-3,-91.2 -5.6,-89.4 -6.6,-85Z"
BEARD = "M-5.2,-84 C-5.4,-79.5 -2.4,-76.6 0.4,-76.6 C3.4,-76.6 6,-79.5 5.8,-84 C4.2,-82 2.2,-81.4 0.4,-81.4 C-1.6,-81.4 -3.6,-82 -5.2,-84Z"
CORINTHIAN = "M-7,-80.5 C-7.6,-88.6 -4.6,-94 0.4,-94 C5.4,-94 8,-88.6 7.4,-80.5 C6.4,-77 4.2,-76.4 3.2,-78.4 L2.8,-83 L-2.2,-83 L-2.6,-78.4 C-3.8,-76.4 -6,-77 -7,-80.5Z"
CREST = "M-3,-93 C-6,-106 6,-110.5 13.5,-103 C16.5,-99 16,-92 13.2,-86.5 C11.6,-92.6 7,-98.4 0,-95.4Z"
PILOS = "M-7.2,-86 C-7,-93 -3.6,-100.6 0.5,-103.6 C4.6,-100.6 8,-93 7.6,-86 C3,-88.6 -2.6,-88.6 -7.2,-86Z"
PHRYGIAN = "M-7,-84 C-8,-93 -4.2,-98.8 1.6,-99.8 C6.4,-100.8 9.6,-98 7.4,-94.4 C6.8,-93.2 7.4,-89.6 7.4,-84 C7.2,-80 6.6,-78 5.6,-77.2 L5,-84.6 C2,-87 -2,-87 -4.8,-84.6 L-5.4,-77.2 C-6.4,-78 -7,-80 -7,-84Z"


def person(c, x, y, h=70, *, tunic=LINEN, hem=-37, armor=None, legs="bare", stride=0.0,
           beard=True, helmet=None, cloak=None, cloak_flow=False, hold=None, shield=None,
           quiver=False, accents=(), wide=1.12, seed=1):
    """A standing/walking person seen from the front, feet at screen point (x, y).

    tunic: a material stop list (LINEN, WOOL ...) or "accent"; hem: tunic hem height (-37 knee).
    armor: None | "cuirass" (bronze muscle cuirass + leather skirt).
    legs: "bare" | "greaves". stride: 0 standing .. 1 striding (legs apart).
    helmet: None | "corinthian" | "pilos" | "petasos" | "phrygian".
    cloak: None | material list | "accent";  cloak_flow: blown out to the right (running).
    hold: None | "spear" | "staff" | "bow".  shield: None | "aspis" (big) | "round" (small).
    quiver: arrows on the back. accents: names of parts in the owner colour:
            "cloak", "crest", "shield", "cap" (helmet/hat), "tunic".
    wide: horizontal stretch - chunky board-game proportions read better at 32 px.
    """
    k = h / 100.0
    tf = f"translate({f(x)} {f(y)}) scale({f(k * wide)} {f(k)})"
    acc = grad(c, "uacc", CLOTH_ACCENT)
    skin = grad(c, "uskin", SKIN)
    metal = grad(c, "umetal", METAL)

    def mat(m, name):
        return acc if m == "accent" else grad(c, name, m)

    def part(d, fill, name=None, extra=""):
        if name and name in accents:
            c.accent(f'<g transform="{tf}"><path d="{d}" fill="{acc}"/></g>')
            if extra:
                c.add(f'<g transform="{tf}">{extra}</g>')
        else:
            c.add(f'<g transform="{tf}"><path d="{d}" fill="{fill}"/>{extra}</g>')

    def art(markup):
        c.add(f'<g transform="{tf}">{markup}</g>')

    # behind the body: cloak, quiver
    if cloak is not None:
        cf = mat(cloak, "ucloak")
        if cloak_flow:
            part(CLOAK_FLOW, cf, "cloak", '<path d="M14,-70 C20,-64 25,-58 29,-51 M10,-66 C14,-60 17,-55 20,-47" fill="none" stroke="#000" stroke-width="1" opacity="0.2"/>')
        else:
            part(CLOAK, cf, "cloak", '<path d="M-5,-62 C-7,-48 -7,-36 -6,-29 M5,-62 C7,-48 8,-36 8,-29" fill="none" stroke="#000" stroke-width="1" opacity="0.2"/>')
    if quiver:
        lt = grad(c, "uleather", LEATHER)
        art(f'<path d="M8,-58 L13.5,-86 L18,-85 L13,-57Z" fill="{lt}"/>'
            '<path d="M13.6,-86 L12.6,-93 M15,-86 L15.2,-94 M16.6,-85.6 L18,-92.6" stroke="#6b4423" stroke-width="0.7"/>'
            '<path d="M11.6,-93 L13.2,-96 L13.8,-92.4Z M14.4,-94 L15.8,-97.2 L16,-93.6Z M17.2,-92.6 L19.2,-95.6 L18.8,-92Z" fill="#f2ead6"/>')
    # legs (striding: left leg swings out, right leg back)
    rot_l, rot_r = 14 * stride, -7 * stride
    for d, sandal, greave, rot, pivot in ((LLEG, LSANDAL, LGREAVE, rot_l, (-5, -42)), (RLEG, RSANDAL, RGREAVE, rot_r, (5, -42))):
        g = [f'<g transform="rotate({f(rot)} {pivot[0]} {pivot[1]})">', f'<path d="{d}" fill="{skin}"/>']
        if legs == "greaves":
            g.append(f'<path d="{greave}" fill="{metal}"/>')
        g.append(f'<path d="{sandal}" fill="#5e3b22"/>')
        g.append("</g>")
        art("".join(g))
    art('<path d="M-9.6,-22 C-10.4,-15 -10,-8 -9,-3" fill="none" stroke="#fff" stroke-width="0.9" opacity="0.35"/>')
    # tunic, armour
    tunic_d = TUNIC.format(hem=hem, hem2=hem + 1.5)
    part(tunic_d, mat(tunic, "utunic"), "tunic", f'<rect x="-12" y="-54" width="24" height="2.2" fill="#6a4426"/>'
         f'<path d="M-6,-51 C-6.5,-45 -7,{hem + 4} -7.5,{hem + 1} M0,-51 L0.2,{hem + 1} M6,-51 C6.5,-45 7,{hem + 4} 7.5,{hem + 1}" fill="none" stroke="#000" stroke-width="0.8" opacity="0.18"/>')
    if armor == "cuirass":
        lt = grad(c, "uleather", LEATHER)
        art(f'<path d="{SKIRT}" fill="{lt}"/>' + "".join(f'<rect x="{f(-11 + i * 2.75)}" y="-50" width="0.45" height="11" fill="#3e2514" opacity="0.6"/>' for i in range(1, 8)))
        art(f'<path d="{CUIRASS}" fill="{metal}"/>'
            f'<path d="M-6.5,-65 C-3.5,-62.5 3.5,-62.5 6.5,-65 M0,-63 L0,-53.5 M-5,-57.5 C-2,-56 2,-56 5,-57.5" fill="none" stroke="{BRONZE["dark"]}" stroke-width="0.8" opacity="0.55"/>'
            f'<path d="M-11.6,-70 C-12.4,-63 -11,-57 -9.6,-52.5" fill="none" stroke="{BRONZE["hi"]}" stroke-width="1.2" opacity="0.85"/>')
    # arms + held items
    if hold == "bow":
        wood = "#6b4423"
        art(f'<path d="M-11.5,-73 C-16,-73.4 -22,-73 -27.5,-72 L-27.5,-67.6 C-22,-68.2 -16,-68.4 -11,-67.6Z" fill="{skin}"/>'
            f'<path d="M8,-73.6 C13,-75.6 18.6,-74.6 21,-71.6 C18.4,-69.4 12,-69 5.6,-70.6 L5.6,-73.6Z" fill="{skin}"/>'
            f'<path d="M-27,-97 C-37.6,-86 -37.6,-56 -27,-45" fill="none" stroke="{wood}" stroke-width="2.4" stroke-linecap="round"/>'
            f'<path d="M-27.6,-95 C-36.4,-85 -36.4,-57 -27.6,-47" fill="none" stroke="#a8744a" stroke-width="0.8" opacity="0.8"/>'
            '<path d="M-27,-97 L4.6,-72 L-27,-45" fill="none" stroke="#efe6cc" stroke-width="0.55"/>'
            '<path d="M-34,-72 L7,-72" stroke="#7a5a3a" stroke-width="0.9"/><path d="M-36.6,-72 L-33,-73.8 L-33,-70.2Z" fill="#b0793a"/>'
            '<path d="M3,-72 L8,-74.4 M3,-72 L8,-69.6" stroke="#c8392f" stroke-width="1"/>'
            f'<ellipse cx="-28.6" cy="-69.8" rx="2.6" ry="2.8" fill="{skin}"/><ellipse cx="4.6" cy="-72" rx="2.6" ry="2.6" fill="{skin}"/>')
    else:
        if hold in ("spear", "staff"):
            top = -112 if hold == "spear" else -100
            art(f'<rect x="-17.2" y="{top}" width="1.7" height="{f(-top + 1)}" fill="{WOOD["dark"]}"/><rect x="-17.2" y="{top}" width="0.6" height="{f(-top + 1)}" fill="{WOOD["lit"]}"/>')
            if hold == "spear":
                art(f'<path d="M-16.35,-124 L-13.8,-112.5 L-16.35,-110 L-18.9,-112.5Z" fill="{BRONZE["lit"]}"/><path d="M-16.35,-124 L-13.8,-112.5 L-16.35,-110Z" fill="{BRONZE["shade"]}"/>')
            else:
                art(f'<circle cx="-16.35" cy="{top}" r="2.2" fill="{WOOD["base"]}"/><circle cx="-17" cy="{top - 0.6}" r="0.8" fill="{WOOD["lit"]}"/>')
        art(f'<path d="M-12.5,-71.5 C-15.5,-66 -17,-61 -17.4,-57.5 L-13.4,-56 C-12.8,-60 -11.4,-65 -8.5,-69Z" fill="{skin}"/>'
            f'<path d="M-19.4,-59 C-19.6,-55.4 -14,-54.6 -13.4,-58 C-13.2,-60.6 -19,-61.6 -19.4,-59Z" fill="{skin}"/>'
            f'<path d="M8.5,-69 C11.4,-65 12.8,-60 13.4,-56 L17.4,-57.5 C17,-61 15.5,-66 12.5,-71.5Z" fill="{skin}"/>'
            f'<path d="M13.4,-58 C13.6,-54.6 19.2,-54.8 19.4,-58.4 C19.2,-61 13.6,-61 13.4,-58Z" fill="{skin}"/>')
    # neck + head
    art(f'<path d="{NECK}" fill="{skin}"/><ellipse cx="0.3" cy="-86" rx="6.3" ry="7.5" fill="{skin}"/>'
        f'<ellipse cx="6.2" cy="-85.6" rx="1.2" ry="2" fill="#b47a54"/>'
        '<ellipse cx="-2.3" cy="-86.6" rx="0.8" ry="0.55" fill="#2a1d14"/><ellipse cx="2.9" cy="-86.6" rx="0.8" ry="0.55" fill="#2a1d14"/>'
        '<path d="M0.6,-86 L-0.4,-82.6 L1.2,-82.4" fill="none" stroke="#a46a46" stroke-width="0.6"/>')
    if beard:
        art(f'<path d="{BEARD}" fill="{HAIR}"/>')
    if helmet in (None, "petasos"):
        art(f'<path d="{HAIR_CAP}" fill="{HAIR}"/><path d="M-5.4,-87.6 C-5.4,-91 -2.6,-93.6 0.6,-93.8" fill="none" stroke="{HAIR_HI}" stroke-width="0.9"/>')
    if helmet == "corinthian":
        art(f'<path d="{CORINTHIAN}" fill="{metal}"/>'
            f'<path d="M-6,-83.5 C-6.2,-89 -3.4,-92.4 0.2,-92.6" fill="none" stroke="{BRONZE["hi"]}" stroke-width="1" opacity="0.9"/>'
            '<path d="M-2.2,-83 L-2.4,-88 M2.8,-83 L2.8,-88" stroke="#2a1d14" stroke-width="1"/>')
        part(CREST, grad(c, "ucrest", [(0, "#e0503e"), (0.6, "#b23a30"), (1, "#7a2420")]), "crest",
             '<path d="M-2,-96.4 C1,-102.4 7,-104 12,-100" fill="none" stroke="#fff" stroke-width="0.8" opacity="0.4"/>'
             f'<path d="M-1,-93.2 L0,-96 L2,-95.8 L1.6,-93.4Z" fill="{BRONZE["shade"]}"/>')
    elif helmet == "pilos":
        part(PILOS, metal, "cap", f'<path d="M-7.6,-86.6 C-3,-89.4 3.4,-89.4 8,-86.6 L7.8,-84.8 C3.4,-87.4 -3,-87.4 -7.4,-84.8Z" fill="{BRONZE["shade"]}"/>'
             f'<path d="M-5.6,-88 C-5,-94 -2.2,-99.4 0.3,-101.6" fill="none" stroke="{BRONZE["hi"]}" stroke-width="0.9" opacity="0.9"/>')
    elif helmet == "petasos":
        felt = grad(c, "ufelt", FELT)
        hat = (f'<g transform="rotate(-7 0.4 -91)"><ellipse cx="0.4" cy="-90.6" rx="14" ry="3.6" fill="{felt}"/>'
               f'<path d="M-5.6,-90.6 C-5.7,-95.8 -2.6,-98 0.5,-98 C3.9,-98 6.7,-95.8 6.5,-90.6Z" fill="{felt}"/>'
               '<path d="M-5.6,-91.8 C-2,-93.2 3,-93.2 6.5,-91.8 L6.5,-90.4 C3,-91.6 -2,-91.6 -5.6,-90.4Z" fill="#6a4426"/>'
               '<path d="M-13,-91.4 C-8,-93.6 4,-94 13.6,-91.6" fill="none" stroke="#fff6d8" stroke-width="0.7" opacity="0.7"/></g>')
        if "cap" in accents:
            c.accent(f'<g transform="{tf}"><g transform="rotate(-7 0.4 -91)"><ellipse cx="0.4" cy="-90.6" rx="14" ry="3.6" fill="{acc}"/><path d="M-5.6,-90.6 C-5.7,-95.8 -2.6,-98 0.5,-98 C3.9,-98 6.7,-95.8 6.5,-90.6Z" fill="{acc}"/></g></g>')
        else:
            art(hat)
    elif helmet == "phrygian":
        part(PHRYGIAN, acc if "cap" in accents else grad(c, "uwool", WOOL), "cap",
             '<path d="M-5.6,-90 C-5,-95 -1.6,-97.8 2.6,-98.6" fill="none" stroke="#fff" stroke-width="0.8" opacity="0.45"/>'
             '<path d="M-4.8,-84.6 C-2,-87 2,-87 5,-84.6" fill="none" stroke="#000" stroke-width="0.7" opacity="0.3"/>')
    # shield in front
    if shield:
        cx_, cy_, rx_, ry_ = (8, -54, 15.5, 19) if shield == "aspis" else (12.5, -55, 8.6, 10.2)
        if "shield" in accents:
            sg = c.rad("ushield", 0.35, 0.3, 0.8, [(0, ACCENT["lit"]), (0.6, ACCENT["mid"]), (1, ACCENT["dark"])], bbox=True)
            c.accent(f'<g transform="{tf}"><ellipse cx="{cx_}" cy="{cy_}" rx="{rx_}" ry="{ry_}" fill="{sg}"/></g>')
        else:
            art(f'<ellipse cx="{cx_}" cy="{cy_}" rx="{rx_}" ry="{ry_}" fill="{metal}"/>')
        rim = 2.4 if shield == "aspis" else 1.6
        art(f'<ellipse cx="{cx_}" cy="{cy_}" rx="{rx_}" ry="{ry_}" fill="none" stroke="{BRONZE["base"]}" stroke-width="{rim}"/>'
            f'<path d="M{f(cx_ - rx_ * 0.82)},{f(cy_ - ry_ * 0.4)} A{rx_},{ry_} 0 0 1 {f(cx_ - rx_ * 0.2)},{f(cy_ - ry_ * 0.97)}" fill="none" stroke="{BRONZE["hi"]}" stroke-width="{f(rim * 0.45)}"/>'
            f'<path d="M{f(cx_ + rx_ * 0.9)},{f(cy_ + ry_ * 0.25)} A{rx_},{ry_} 0 0 1 {f(cx_ + rx_ * 0.2)},{f(cy_ + ry_ * 0.97)}" fill="none" stroke="{BRONZE["dark"]}" stroke-width="{f(rim * 0.5)}" opacity="0.8"/>')
        if shield == "aspis":
            # painted emblem in cream: a stylised lambda-like chevron, and a boss
            art(f'<path d="M{f(cx_ - 6)},{f(cy_ + 7)} L{f(cx_)},{f(cy_ - 8)} L{f(cx_ + 6)},{f(cy_ + 7)}" fill="none" stroke="#f4ead2" stroke-width="2.4" stroke-linejoin="round" opacity="0.92"/>')
        else:
            art(f'<circle cx="{cx_}" cy="{cy_}" r="2" fill="{BRONZE["lit"]}"/><circle cx="{f(cx_ - 0.5)}" cy="{f(cy_ - 0.5)}" r="0.7" fill="{BRONZE["hi"]}"/>')


# ---------------------------------------------------------------------------
# Animals and vehicles (profile, facing screen-left)
# ---------------------------------------------------------------------------
HORSE_BAY = [(0, "#c58a52"), (0.3, "#a06a3a"), (0.7, "#7a4c28"), (1, "#563318")]
DONKEY = [(0, "#bdb3a4"), (0.3, "#9d9284"), (0.7, "#7a7064"), (1, "#5a5248")]


def horse(c, x, y, h=40, coat=HORSE_BAY, mane="#2b1c12", saddle=True, accents=("saddle",), gait=0.5):
    """Horse in profile facing left, hooves at screen y, body centred on x. h = withers height.
    saddle: draws a saddle cloth (ACCENT if 'saddle' in accents). Returns the seat point (x, y)."""
    k = h / 60.0
    tf = f"translate({f(x)} {f(y)}) scale({f(k)})"
    body = grad(c, "uhorse" + coat[1][1][1:], coat)
    dark = coat[-1][1]

    def art(m):
        c.add(f'<g transform="{tf}">{m}</g>')

    def leg(x0, lift, far):
        col = dark if far else body
        bend = lift * 6
        d = (f"M{f(x0 - 4.6)},-38 C{f(x0 - 4.8)},-28 {f(x0 - 3 - bend * 0.4)},-19 {f(x0 - 2.8 - bend)},{f(-9 - lift * 2)} "
             f"L{f(x0 - 3 - bend)},{f(-1.8 - lift * 4)} L{f(x0 + 2 - bend)},{f(-1.8 - lift * 4)} "
             f"L{f(x0 + 1.8 - bend)},{f(-9 - lift * 2)} C{f(x0 + 2.4 - bend * 0.4)},-19 {f(x0 + 4.4)},-28 {f(x0 + 4.8)},-38Z")
        hoof = f'<path d="M{f(x0 - 3.2 - bend)},{f(-2 - lift * 4)} L{f(x0 + 2.2 - bend)},{f(-2 - lift * 4)} L{f(x0 + 2.6 - bend)},{f(0.6 - lift * 4)} L{f(x0 - 3.6 - bend)},{f(0.6 - lift * 4)}Z" fill="#2a1d14"/>'
        knee = f'<ellipse cx="{f(x0 - 0.6 - bend * 0.6)}" cy="{f(-17 - lift)}" rx="2.6" ry="1.4" fill="#000" opacity="0.14"/>'
        art(f'<path d="{d}" fill="{col}"/>{hoof}{knee}')

    # far legs first (darker), then body, then near legs
    leg(-16, gait * 0.2, True)
    leg(20, 0, True)
    # tail
    art(f'<path d="M27,-46 C35,-44 38,-34 36,-20 C33,-26 30,-32 26,-38Z" fill="{mane}"/>')
    # body barrel + neck + head
    art(f'<path d="M-25,-49 C-25,-60 -12,-62.4 4,-61.6 C19,-61.6 31,-58.6 31,-46.6 C31,-36.6 23,-31 10,-31 L-12,-31 C-21,-31 -25,-39 -25,-49Z" fill="{body}"/>'
        f'<path d="M-22,-52 C-26,-60 -30,-70 -33,-78 L-27,-82 C-22,-74 -16,-66 -10,-58Z" fill="{body}"/>'
        f'<path d="M-33,-78 C-35,-82 -33,-86 -29,-86.5 C-27,-86.6 -25,-85 -24.6,-83 L-36,-68 C-38.6,-66.8 -41.6,-67.6 -42,-70.4 C-42.2,-72.6 -38,-76 -33,-78Z" fill="{body}"/>'
        f'<path d="M-28.6,-86.4 L-27.6,-92 L-25,-86" fill="{body}"/>'
        f'<path d="M-29.6,-86 L-30.6,-91 L-28,-86.4" fill="{dark}"/>'
        f'<ellipse cx="-31.6" cy="-79.4" rx="1" ry="0.8" fill="#1a110b"/>'
        f'<ellipse cx="-40.4" cy="-70" rx="0.8" ry="0.6" fill="#1a110b"/>'
        f'<path d="M-26.6,-84.6 C-22,-78 -18,-70 -12.4,-61 C-16,-63 -19.6,-67 -22,-71 C-24,-75 -26.4,-80 -27.6,-83.6Z" fill="{mane}"/>'
        f'<path d="M-22,-58 C-12,-60.6 6,-60.8 22,-58" fill="none" stroke="#fff" stroke-width="1.1" opacity="0.28"/>'
        f'<path d="M-14,-35 C-2,-33.4 12,-33.4 22,-36" fill="none" stroke="#000" stroke-width="1.4" opacity="0.22"/>')
    if saddle:
        sc = "M-8,-61.4 L14,-61.4 L13,-46 C8,-44.6 -4,-44.6 -8,-46Z"
        if "saddle" in accents:
            c.accent(f'<g transform="{tf}"><path d="{sc}" fill="{grad(c, "uacc", CLOTH_ACCENT)}"/></g>')
        else:
            art(f'<path d="{sc}" fill="{grad(c, "uwool", WOOL)}"/>')
        art(f'<path d="M-8,-46 C-4,-44.6 8,-44.6 13,-46" fill="none" stroke="{GOLD["lit"]}" stroke-width="0.9"/>'
            f'<path d="M-8,-61.4 L14,-61.4" stroke="#000" stroke-width="0.8" opacity="0.25"/>')
    leg(-20, gait, False)
    leg(16, 0.15, False)
    # bridle
    art('<path d="M-33.4,-78.6 L-40,-69.6 M-31,-84 L-34.6,-77" stroke="#3e2514" stroke-width="0.9"/>')
    return (x + 2 * k, y - 58.5 * k)


def rider(c, x, y, h=34, accents=("cloak",), helmet="crest"):
    """Rider seated on a horse, facing left (profile), seat at screen point (x, y).
    Holds a javelin raised; cloak streams behind (ACCENT if 'cloak' in accents)."""
    k = h / 50.0
    tf = f"translate({f(x)} {f(y)}) scale({f(k)})"
    skin = grad(c, "uskin", SKIN)
    metal = grad(c, "umetal", METAL)
    tun = grad(c, "utunic", LINEN)

    def art(m):
        c.add(f'<g transform="{tf}">{m}</g>')

    cloak = "M2,-40 C10,-40 18,-34 24,-22 C19,-23 16,-20 13,-15 C11,-22 8,-28 2,-30Z"
    if "cloak" in accents:
        c.accent(f'<g transform="{tf}"><path d="{cloak}" fill="{grad(c, "uacc", CLOTH_ACCENT)}"/></g>')
    else:
        art(f'<path d="{cloak}" fill="{grad(c, "ucloak", WOOL)}"/>')
    # javelin (behind the arm), leg, torso, arm, head
    art(f'<path d="M-24,-62 L8,-12" stroke="{WOOD["dark"]}" stroke-width="1.3"/><path d="M-27.4,-67.4 L-22.6,-62.6 L-24.6,-60.6Z" fill="{BRONZE["lit"]}"/>'
        f'<path d="M-4,-2 C-6,4 -7,12 -9,20 L-4.4,21 C-2.4,13 0.6,6 2.6,0Z" fill="{skin}"/><path d="M-10.4,19.6 L-3.6,19.6 L-4,22.6 L-11.4,22.6Z" fill="#5e3b22"/>'
        f'<path d="M-7,0 C-8,-6 -7,-14 -6,-18 L6,-18 C7,-12 7,-6 6,0 C3,2 -4,2 -7,0Z" fill="{tun}"/>'
        f'<path d="M-6.4,-17 C-7,-26 -6,-32 -3,-36 L5,-36 C7,-31 7.4,-24 6.4,-17Z" fill="{metal}"/>'
        f'<path d="M-5.6,-20 C-6,-26 -5.2,-31 -2.6,-34.6" fill="none" stroke="{BRONZE["hi"]}" stroke-width="0.9"/>'
        f'<path d="M-3,-33 C-8,-34 -13,-38 -17,-43 L-14,-46 C-11,-42 -6,-39 0,-38Z" fill="{skin}"/>'
        f'<circle cx="-16.6" cy="-45.4" r="2.2" fill="{skin}"/>'
        f'<path d="M-2,-38 L3,-38 L3.4,-34 L-2.4,-34Z" fill="{skin}"/>'
        f'<ellipse cx="0" cy="-43" rx="5.2" ry="6" fill="{skin}"/>'
        f'<ellipse cx="-3.4" cy="-43.6" rx="0.6" ry="0.5" fill="#2a1d14"/>')
    if helmet == "crest":
        art(f'<path d="M-5.6,-41 C-6.4,-47 -3.6,-50.6 0.6,-50.6 C4.8,-50.6 6.6,-47.6 6,-42 L6.4,-38 L3,-37.6 L2.6,-41.6 L-2,-42 L-2.2,-39 Z" fill="{metal}"/>'
            '<path d="M-4.6,-42.4 C-4.8,-47 -2.4,-49.6 0.6,-49.8" fill="none" stroke="#fff3cf" stroke-width="0.8" opacity="0.8"/>')
        crest = "M-4,-49.6 C-3,-57 8,-59 13,-52 C14,-49 13,-45 11,-42 C9.6,-47 5,-50.6 -1,-50.4Z"
        if "crest" in accents:
            c.accent(f'<g transform="{tf}"><path d="{crest}" fill="{grad(c, "uacc", CLOTH_ACCENT)}"/></g>')
        else:
            art(f'<path d="{crest}" fill="{grad(c, "ucrest", [(0, "#e0503e"), (0.6, "#b23a30"), (1, "#7a2420")])}"/>')


def cart(c, u0, u1, z0, z1, wheel_u, wheel_r, cover_h, accents=("cover",)):
    """Two-wheeled cart in profile (broadside), box from u0..u1 at z0..z1, wheel at wheel_u,
    an arched canvas cover of height cover_h (ACCENT if 'cover' in accents). v = 0 is its middle."""
    W = WOOD
    wv = 6.0
    # far wheel hint, box (top, front side), near wheel
    xw, yw = c.Pu(wheel_u, -wv, wheel_r)
    c.add(f'<ellipse cx="{f(xw)}" cy="{f(yw)}" rx="{f(wheel_r * SQ2)}" ry="{f(wheel_r * ZS)}" fill="none" stroke="{W["deep"]}" stroke-width="2"/>')
    c.add(c.on(c.m_flat(z1), f'<rect x="{f(u0)}" y="{f(-wv)}" width="{f(u1 - u0)}" height="{f(2 * wv)}" fill="#6b4a2c"/>'))
    side = grad(c, "ucartside", [(0, W["lit"]), (0.5, W["base"]), (1, W["dark"])])
    c.add(c.on(c.m_front(wv), f'<rect x="{f(u0)}" y="{f(z0)}" width="{f(u1 - u0)}" height="{f(z1 - z0)}" fill="{side}"/>'
               + "".join(f'<rect x="{f(u0)}" y="{f(z0 + i * (z1 - z0) / 3)}" width="{f(u1 - u0)}" height="0.4" fill="{W["deep"]}" opacity="0.6"/>' for i in range(1, 3))
               + f'<rect x="{f(u0)}" y="{f(z1 - 0.6)}" width="{f(u1 - u0)}" height="0.6" fill="#d9a878"/>'))
    # canvas cover: sweep arch slices from the far side to the near side
    w2 = (u1 - u0) / 2
    um = (u0 + u1) / 2
    arch = f"M{f(um - w2 - 0.6)},{f(z1)} C{f(um - w2 - 0.6)},{f(z1 + cover_h * 1.2)} {f(um + w2 + 0.6)},{f(z1 + cover_h * 1.2)} {f(um + w2 + 0.6)},{f(z1)}Z"
    cov = c.lin("ucover", um - w2, 0, um + w2, 0, CLOTH_ACCENT)
    slices = 7
    for i in range(slices):
        v = -wv + 2 * wv * i / (slices - 1)
        m = c.on(c.m_front(v), f'<path d="{arch}" fill="{cov}"/>')
        if "cover" in accents:
            c.accent(m)
        else:
            c.add(m)
    # hoops + shading lines on the cover (art on top)
    for t in (0.18, 0.5, 0.82):
        uu = um - w2 + 2 * w2 * t
        c.add(c.on(c.m_front(wv), f'<path d="M{f(uu)},{f(z1)} L{f(uu)},{f(z1 + cover_h * (0.72 + 0.18 * math.sin(math.pi * t)))}" stroke="#000" stroke-width="0.8" opacity="0.18"/>'))
    c.add(c.on(c.m_front(wv), f'<path d="M{f(um - w2 + 1)},{f(z1 + cover_h * 0.5)} C{f(um - w2 + 1)},{f(z1 + cover_h * 0.95)} {f(um - 2)},{f(z1 + cover_h * 0.98)} {f(um)},{f(z1 + cover_h * 0.9)}" fill="none" stroke="#fff" stroke-width="0.9" opacity="0.35"/>'))
    # near wheel with spokes
    xw, yw = c.Pu(wheel_u, wv + 1.2, wheel_r)
    sp = "".join(f'<path d="M{f(wheel_u)},{f(wheel_r)} L{f(wheel_u + (wheel_r - 1) * math.cos(a))},{f(wheel_r + (wheel_r - 1) * math.sin(a))}" stroke="{W["dark"]}" stroke-width="0.9"/>' for a in [i * math.pi / 3 for i in range(6)])
    c.add(c.on(c.m_front(wv + 1.2), f'<circle cx="{f(wheel_u)}" cy="{f(wheel_r)}" r="{f(wheel_r)}" fill="none" stroke="{W["base"]}" stroke-width="1.8"/>'
               f'<circle cx="{f(wheel_u)}" cy="{f(wheel_r)}" r="{f(wheel_r - 0.4)}" fill="none" stroke="{W["lit"]}" stroke-width="0.5" stroke-dasharray="3 6"/>{sp}'
               f'<circle cx="{f(wheel_u)}" cy="{f(wheel_r)}" r="1.4" fill="{W["deep"]}"/>'))


# ---------------------------------------------------------------------------
# Ships (broadside: the hull runs along u)
# ---------------------------------------------------------------------------
def hull_points(L, W, hd, sheer_bow, sheer_stern, v_sign=1, z=None, shrink=1.0):
    """Gunwale / waterline points along the hull (u from bow -L to stern +L)."""
    out = []
    n = 24
    for i in range(n + 1):
        t = -1 + 2 * i / n
        w = W * shrink * (1 - abs(t) ** 2.2) ** 0.6
        if z is None:
            zz = hd + (sheer_bow if t < 0 else sheer_stern) * abs(t) ** 2.4
        else:
            zz = z
        out.append((L * t, v_sign * w, zz))
    return out


def ship_hull(c, L, W, hd, sheer_bow=4, sheer_stern=7, colours=None, deck="#8a6a46", strakes=3):
    """Hull in broadside view: deck seen from above + the near side (toward the viewer).
    colours: side gradient stops (default warm timber). Returns the gunwale points (near side)."""
    colours = colours or [(0, "#b9884f"), (0.4, "#946638"), (1, "#5e3b22")]
    near = hull_points(L, W, hd, sheer_bow, sheer_stern, 1)
    far = hull_points(L, W, hd, sheer_bow, sheer_stern, -1)
    water = hull_points(L * 0.94, W, hd, 0, 0, 1, z=0, shrink=0.75)
    P = c.Pu
    # water shadow + wake
    c.add(f'<g clip-path="{c.url("top")}"><path d="{poly([P(u + 3, v + 3, 0) for u, v, _ in water] + [P(u + 3, -v + 2, 0) for u, v, _ in reversed(water)])}" fill="#0f4a62" opacity="0.35" filter="{c.blur(1.4)}"/></g>')
    # deck (inside the gunwale outline) + far bulwark inner face
    c.add(f'<path d="{poly([P(u, v, z) for u, v, z in near] + [P(u, v, z) for u, v, z in reversed(far)])}" fill="{deck}"/>')
    c.add(f'<path d="{poly([P(u, v, z) for u, v, z in far] + [P(u, v, z - 2.2) for u, v, z in reversed(far)])}" fill="#c9a274"/>')
    side = c.lin("uhull" + colours[0][1][1:], P(-L, 0)[0], 0, P(L, 0)[0], 0, colours)
    c.add(f'<path d="{poly([P(u, v, z) for u, v, z in near] + [P(u, v, z) for u, v, z in reversed(water)])}" fill="{side}"/>')
    # strakes (planking lines) following the sheer
    for j in range(1, strakes + 1):
        s = j / (strakes + 1)
        ln = [P(u1 * 1 + (u2 - u1) * s, v1 + (v2 - v1) * s, z1 + (z2 - z1) * s) for (u1, v1, z1), (u2, v2, z2) in zip(near, water + [water[-1]])]
        c.add(f'<path d="M{" L".join(f"{f(px)},{f(py)}" for px, py in ln)}" fill="none" stroke="#000" stroke-width="0.5" opacity="0.25"/>')
    c.add(f'<path d="M{" L".join(f"{f(px)},{f(py)}" for px, py in [P(u, v, z) for u, v, z in near])}" fill="none" stroke="#e9c89a" stroke-width="0.8" opacity="0.8"/>')
    # foam at the waterline
    c.add(f'<path d="M{" L".join(f"{f(px)},{f(py)}" for px, py in [P(u, v, 0) for u, v, _ in water])}" fill="none" stroke="#f2fffc" stroke-width="1.3" opacity="0.85" stroke-linecap="round"/>')
    return near


def sail(c, u0, u1, z_foot, z_yard, billow=3.0, v=0.0, accent=True):
    """Square linen sail hanging from a yard, seen from the side, billowing toward the viewer.
    Cloth is ACCENT by default; brails, yard and seams are art on top."""
    shape = (f"M{f(u0)},{f(z_yard)} L{f(u1)},{f(z_yard)} C{f(u1 + billow)},{f(z_yard - (z_yard - z_foot) * 0.4)} {f(u1 + billow * 0.6)},{f(z_foot + 2)} {f(u1 + 0.6)},{f(z_foot)} "
             f"Q{f((u0 + u1) / 2)},{f(z_foot - billow)} {f(u0 - 0.6)},{f(z_foot)} C{f(u0 - billow * 0.6)},{f(z_foot + 2)} {f(u0 - billow)},{f(z_yard - (z_yard - z_foot) * 0.4)} {f(u0)},{f(z_yard)}Z")
    sg = c.lin("usail", 0, 0, 1, 0, [(0, ACCENT["light"]), (0.3, ACCENT["lit"]), (0.65, ACCENT["mid"]), (1, ACCENT["shade"])], bbox=True)
    if accent:
        c.accent(c.on(c.m_front(v), f'<path d="{shape}" fill="{sg}"/>'))
    else:
        c.add(c.on(c.m_front(v), f'<path d="{shape}" fill="{grad(c, "ulinen", LINEN)}"/>'))
    lines = "".join(f'<path d="M{f(u0 + (u1 - u0) * t)},{f(z_yard)} L{f(u0 + (u1 - u0) * t)},{f(z_foot - billow * math.sin(math.pi * t) * 0.9)}" stroke="#000" stroke-width="0.45" opacity="0.18"/>' for t in (0.2, 0.4, 0.6, 0.8))
    c.add(c.on(c.m_front(v), lines + f'<path d="M{f(u0 - 1.5)},{f(z_yard)} L{f(u1 + 1.5)},{f(z_yard)}" stroke="{WOOD["dark"]}" stroke-width="1.4" stroke-linecap="round"/>'
               f'<path d="M{f(u0)},{f(z_yard - 1.4)} L{f(u1)},{f(z_yard - 1.4)}" stroke="#fff" stroke-width="0.6" opacity="0.5"/>'))


def oars(c, near, u_from, u_to, n, depth=9, rows=2):
    """Rows of oars dipping into the water from the near side of a hull."""
    out = []
    pts_ = [p for p in near if u_from <= p[0] <= u_to]
    if not pts_:
        return
    for r in range(rows):
        for i in range(n):
            t = (i + 0.5 + r * 0.5) / n
            u = u_from + (u_to - u_from) * t
            # gunwale height at u (nearest point)
            gu, gv, gz = min(near, key=lambda p: abs(p[0] - u))
            x0, y0 = c.Pu(u, gv, gz - 4.4 - r * 1.6)
            x1, y1 = c.Pu(u + 2.2, gv + depth + r * 2, 0)
            out.append(f'<path d="M{f(x0)},{f(y0)} L{f(x1)},{f(y1)}" stroke="#7a5432" stroke-width="0.9"/>'
                       f'<path d="M{f(x1 - 1.4)},{f(y1 + 0.2)} q1.4,-1 2.8,0" fill="none" stroke="#f2fffc" stroke-width="0.6" opacity="0.8"/>')
    c.add("".join(out))


def from_uv(u, v):
    """Broadside offset (u, v) -> iso world (a, b), e.g. for c.at(*from_uv(9, -9))."""
    return ((u + v) / SQ2, (v - u) / SQ2)


def ship_amphora(c, u, v, z, k=0.42):
    """Small amphora standing on a deck at broadside point (u, v, z)."""
    a, b = from_uv(u, v)
    with c.at(0, 0, z):
        iso.amphora(c, a, b, k=k, shaded=False)


def transport_details(c, near, L=26, hd=8):
    """Cargo, mast, square sail (ACCENT), rigging, stern post and steering oar of the transport."""
    W_ = WOOD
    # cargo: bales and amphorae on deck
    for u in (-17, -13.5, 8, 11.5, 15):
        ship_amphora(c, u, -1.5 if u < 0 else 1.0, hd - 1.5)
    for u, w_, hh in ((-6.5, 6, 4.2), (2.5, 5, 3.6)):
        c.add(c.on(c.m_front(0), f'<rect x="{f(u - w_ / 2)}" y="{f(hd - 1)}" width="{f(w_)}" height="{f(hh)}" rx="1.4" fill="#e4d6b4"/>'
                   f'<rect x="{f(u - w_ / 2)}" y="{f(hd - 1)}" width="{f(w_ * 0.35)}" height="{f(hh)}" rx="1.2" fill="#f6eedb"/>'
                   f'<path d="M{f(u - w_ / 2)},{f(hd + hh / 2)} L{f(u + w_ / 2)},{f(hd + hh / 2)}" stroke="#8a6a46" stroke-width="0.6"/>'))
    # mast (behind the sail), stays
    zt = 52
    xm0, ym0 = c.Pu(-1, 0, hd)
    xm1, ym1 = c.Pu(-1, 0, zt)
    xb, yb = c.Pu(-L + 1, 0, hd + 5)
    xs, ys = c.Pu(L - 3, 0, hd + 9)
    c.add(f'<path d="M{f(xm1)},{f(ym1 + 1)} L{f(xb)},{f(yb)} M{f(xm1)},{f(ym1 + 1)} L{f(xs)},{f(ys)}" stroke="#5e4630" stroke-width="0.5" opacity="0.8"/>'
          f'<rect x="{f(xm0 - 1)}" y="{f(ym1)}" width="2" height="{f(ym0 - ym1)}" fill="{W_["dark"]}"/><rect x="{f(xm0 - 1)}" y="{f(ym1)}" width="0.7" height="{f(ym0 - ym1)}" fill="{W_["lit"]}"/>')
    sail(c, -15, 13, hd + 10, zt - 5, billow=3.6)
    # pennant at the masthead (art: neutral linen)
    c.add(f'<path d="M{f(xm1)},{f(ym1)} l8,1.6 l-8,1.8Z" fill="#f3ead6"/>')
    # curved stern post (swan neck) and the bow post
    c.add(c.on(c.m_front(0), f'<path d="M{L - 2},{hd + 8} C{L + 3},{hd + 11} {L + 4},{hd + 18} {L},{hd + 20} C{L - 3},{hd + 21} {L - 4},{hd + 18} {L - 2},{hd + 17}" fill="none" stroke="{W_["dark"]}" stroke-width="2.2" stroke-linecap="round"/>'
               f'<path d="M{-L + 1},{hd + 4} C{-L - 1},{hd + 6} {-L - 1.6},{hd + 8} {-L - 0.6},{hd + 9.5}" fill="none" stroke="{W_["dark"]}" stroke-width="1.8" stroke-linecap="round"/>'))
    # steering oar on the near quarter
    x0, y0 = c.Pu(L - 7, 7, hd + 6)
    x1, y1 = c.Pu(L - 1, 12, -1)
    c.add(f'<path d="M{f(x0)},{f(y0)} L{f(x1)},{f(y1)}" stroke="{W_["dark"]}" stroke-width="1.3"/><ellipse cx="{f(x1)}" cy="{f(y1)}" rx="1.6" ry="3" transform="rotate(-25 {f(x1)} {f(y1)})" fill="{W_["base"]}"/>')


def trireme_details(c, near, L=37, W=6, hd=7):
    """Owner stripe + shields (ACCENT), ram, eye, aplustre, steering oar and two banks of oars."""
    P = c.Pu
    # owner-colour wale stripe under the near gunwale
    stripe = [P(u, v, z - 0.4) for u, v, z in near[1:-1]] + [P(u, v, z - 3.8) for u, v, z in reversed(near[1:-1])]
    st = c.lin("ustripe", P(-L, 0)[0], 0, P(L, 0)[0], 0, [(0, ACCENT["lit"]), (0.5, ACCENT["light"]), (1, ACCENT["shade"])])
    c.accent(f'<path d="{poly(stripe)}" fill="{st}"/>')
    # bronze ram at the waterline + cutwater
    ram = c.lin("uram", 0, 0, 1, 0, [(0, BRONZE["hi"]), (0.5, BRONZE["base"]), (1, BRONZE["dark"])], bbox=True)
    c.add(c.on(c.m_front(0.5), f'<path d="M{-L + 2},3.4 L{-L - 6.5},1.4 L{-L - 6},0.4 L{-L + 2},-0.6Z" fill="{ram}"/>'
               f'<path d="M{-L + 2},2.2 L{-L - 5},1.2" stroke="{BRONZE["dark"]}" stroke-width="0.4"/>'))
    c.add(c.on(c.m_front(0), f'<path d="M{-L + 0.6},{hd + 2.4} C{-L - 1.6},{hd + 3.6} {-L - 2.6},{hd + 5.4} {-L - 2},{hd + 7.4}" fill="none" stroke="#2a2826" stroke-width="1.6" stroke-linecap="round"/>'))
    # aplustre: the fan-shaped curl of the stern, gilded tips
    st_z = hd + 11
    c.add(c.on(c.m_front(0), f'<path d="M{L - 3},{st_z - 1} C{L + 3},{st_z + 2} {L + 5},{st_z + 9} {L + 1},{st_z + 12} M{L - 3.4},{st_z - 1.2} C{L + 1},{st_z + 2} {L + 2},{st_z + 7} {L - 0.6},{st_z + 9.4} M{L - 3.8},{st_z - 1.4} C{L - 1},{st_z + 1.6} {L - 0.6},{st_z + 5} {L - 2.4},{st_z + 6.6}" fill="none" stroke="#2f2c29" stroke-width="1.5" stroke-linecap="round"/>'
               f'<circle cx="{L + 1}" cy="{st_z + 12}" r="1" fill="{GOLD["lit"]}"/><circle cx="{f(L - 0.6)}" cy="{f(st_z + 9.4)}" r="0.9" fill="{GOLD["lit"]}"/><circle cx="{f(L - 2.4)}" cy="{f(st_z + 6.6)}" r="0.8" fill="{GOLD["lit"]}"/>'))
    # owner pennant streaming from a staff on the stern (ACCENT)
    xs0, ys0 = P(L - 9, 0, hd + 9)
    xs1, ys1 = P(L - 9, 0, hd + 26)
    c.add(f'<path d="M{f(xs0)},{f(ys0)} L{f(xs1)},{f(ys1)}" stroke="#2f2c29" stroke-width="1.1"/><circle cx="{f(xs1)}" cy="{f(ys1 - 0.8)}" r="1" fill="{GOLD["lit"]}"/>')
    pen = f"M{f(xs1)},{f(ys1 + 0.6)} C{f(xs1 + 6)},{f(ys1 - 1)} {f(xs1 + 10)},{f(ys1 + 2)} {f(xs1 + 15)},{f(ys1 + 0.6)} L{f(xs1 + 11.5)},{f(ys1 + 3.4)} L{f(xs1 + 14.4)},{f(ys1 + 6)} C{f(xs1 + 9)},{f(ys1 + 6.4)} {f(xs1 + 5)},{f(ys1 + 4.4)} {f(xs1)},{f(ys1 + 6.6)}Z"
    c.accent(f'<path d="{pen}" fill="{c.lin("upen", 0, 0, 1, 0, [(0, ACCENT["lit"]), (0.6, ACCENT["light"]), (1, ACCENT["shade"])], bbox=True)}"/>')
    c.add(f'<path d="M{f(xs1 + 3)},{f(ys1 + 2.2)} C{f(xs1 + 7)},{f(ys1 + 1.6)} {f(xs1 + 9)},{f(ys1 + 3.6)} {f(xs1 + 12)},{f(ys1 + 2.6)}" fill="none" stroke="#000" stroke-width="0.6" opacity="0.2"/>')
    # painted eye near the bow
    t = -0.84
    w = W * (1 - abs(t) ** 2.2) ** 0.6
    ex, ey = P(L * t, w, 2.6)
    c.add(f'<ellipse cx="{f(ex)}" cy="{f(ey)}" rx="2.6" ry="1.3" fill="#f6f0e0"/><circle cx="{f(ex - 0.3)}" cy="{f(ey)}" r="0.95" fill="#1a1512"/><circle cx="{f(ex - 0.6)}" cy="{f(ey - 0.4)}" r="0.3" fill="#fff"/>')
    # marines' shields hung along the rail (ACCENT) with bronze rims
    sg = c.rad("ushield", 0.35, 0.3, 0.8, [(0, ACCENT["lit"]), (0.6, ACCENT["mid"]), (1, ACCENT["dark"])], bbox=True)
    acc, rims = [], []
    for i in range(9):
        u = -22 + 44 * i / 8
        gu, gv, gz = min(near, key=lambda p: abs(p[0] - u))
        sx, sy = P(u, gv + 0.4, gz + 1.2)
        acc.append(f'<ellipse cx="{f(sx)}" cy="{f(sy)}" rx="3.3" ry="3" fill="{sg}"/>')
        rims.append(f'<ellipse cx="{f(sx)}" cy="{f(sy)}" rx="3.3" ry="3" fill="none" stroke="{BRONZE["base"]}" stroke-width="0.8"/><circle cx="{f(sx - 0.3)}" cy="{f(sy - 0.3)}" r="0.7" fill="{BRONZE["lit"]}"/>')
    c.accent("".join(acc))
    c.add("".join(rims))
    # steering oar + two banks of oars
    x0, y0 = P(L - 6, 5, hd + 5)
    x1, y1 = P(L - 1, 10, -1)
    c.add(f'<path d="M{f(x0)},{f(y0)} L{f(x1)},{f(y1)}" stroke="#4a3220" stroke-width="1.2"/><ellipse cx="{f(x1)}" cy="{f(y1)}" rx="1.4" ry="2.8" transform="rotate(-25 {f(x1)} {f(y1)})" fill="#6b4a2c"/>')
    oars(c, near, -26, 26, 14, depth=9, rows=2)
