"""Poleis art library for UNITS (board-game figures on a round bronze token). Builds on iso.py.

Units use their own fixed canvas (docs/ART.md): viewBox 0 0 128 128, the token's top ellipse is
centred at (64, 96) and 88 px wide. Here 1 world unit = 1 px (the token radius is TOKEN_R).

Two frames are available:
  * the normal iso frame of iso.py (c.P, c.m_ground, c.m_bface, c.m_aface ...)
  * the BROADSIDE frame (u, v, z): u runs along the screen horizontal (world direction a-b),
    v points at the viewer (a+b). Profiles - ships, horses, carts - are drawn in it:
        screen x = ox + SQ2 * u,   screen y = oy + v / SQ2 - ZS * z
    c.m_front(v): vertical plane facing the viewer (local x=u, y=z up);  c.m_flat(z): ground.
Figures (people, animals) are drawn in screen space around their feet point (class Fig).

The accent rule is the same as for buildings: c.accent() for owner-coloured parts (greys from
iso.ACCENT), drawn in painter's order; the art gets holes; the game draws the accent UNDER the art.

Contents
  UnitCanvas, from_uv, grad              canvas and frames
  person()                               the small building-scale person (barracks drill, wonder)
  sculpting toolkit                      Fig, tube(), shaded masses, cylinder gradients, cast shadows
  token()                                the ornate bronze token with the owner-colour enamel band
  heads, helmets, hands, feet, shields   the parts of the unit figures (3/4 view, facing left)
  donkey(), horse()                      animals in profile, facing left
  Ship                                   3/4-view hulls (transport, trireme)
"""
import math
import random

import iso
from iso import ACCENT, BRONZE, INK, WOOD, ZS, f, poly

UNIT_CANVAS = 128
TOKEN_CX, TOKEN_CY = 64, 96     # centre of the token's top ellipse
TOKEN_W = 88                    # width of the token's top ellipse (x 20 -> 108)
SQ2 = math.sqrt(2)
TOKEN_R = TOKEN_W / 2 / SQ2     # token radius in world units (1 unit = 1 px)
TOKEN_H = 8.5                   # side height of the token
TOKEN_LIP = 1.6                 # bronze lip at the top of the side; below it the enamel band

# materials (bbox gradients across a part: lit left -> shaded right)
# (0: warm rim light, then lit, base, cool shade, core shadow, 1: cool reflected light)
SKIN = [(0, "#ffe6c8"), (0.1, "#f6cca2"), (0.42, "#dca77c"), (0.78, "#a8735e"), (0.93, "#7c5248"), (1, "#97767a")]
LINEN = [(0, "#ffffff"), (0.1, "#fbf6e8"), (0.42, "#ece2ca"), (0.78, "#b9b5aa"), (0.93, "#8e8e90"), (1, "#a9adb6")]
WOOL = [(0, "#ecc596"), (0.1, "#cb9e6a"), (0.42, "#a57749"), (0.78, "#74523e"), (0.93, "#4f382c"), (1, "#6b5a5c")]
LEATHER = [(0, "#e2ad74"), (0.1, "#c08a55"), (0.42, "#9c6a3c"), (0.78, "#6e4830"), (0.93, "#4a3020"), (1, "#665050")]
FELT = [(0, "#fff1c4"), (0.1, "#f1dca2"), (0.42, "#d8b56c"), (0.78, "#a88b5a"), (0.93, "#7c6644"), (1, "#958670")]
METAL = [(0, "#fff2cc"), (0.1, "#f0c67c"), (0.42, "#c69048"), (0.78, "#865a34"), (0.93, "#523622"), (1, "#7d6c62")]
CLOTH_ACCENT = [(0, ACCENT["lit"]), (0.12, ACCENT["lit"]), (0.45, ACCENT["light"]), (0.8, ACCENT["shade"]), (0.94, ACCENT["dark"]), (1, ACCENT["mid"])]
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


def from_uv(u, v):
    """Broadside offset (u, v) -> iso world (a, b), e.g. for c.at(*from_uv(9, -9))."""
    return ((u + v) / SQ2, (v - u) / SQ2)


# ---------------------------------------------------------------------------
# People (chunky painted miniatures), drawn in screen space; feet at (x, y), h = feet -> head top
# ---------------------------------------------------------------------------
# Local figure units: feet at y=0, top of the head at y=-100. Proportions of a board-game
# miniature: big head (~1/4), broad shoulders, thick limbs - they read at a 32 px token.
LLEG = "M-12,-33 L-2,-33 C-1.6,-24 -2,-14 -2.6,-5 L-1.2,0 L-13.4,0 L-12.4,-5 C-13.4,-14 -13.6,-24 -12,-33Z"
RLEG = "M3,-33 L13,-33 C14.4,-24 14.2,-14 13.4,-5 L14.6,0 L2.4,0 L3.6,-5 C3,-14 2.6,-24 3,-33Z"
LGREAVE = "M-13.4,-21 C-13.8,-14 -13.2,-8 -12.6,-3.6 L-2.4,-3.6 C-2,-9 -1.8,-15 -2.2,-21Z"
RGREAVE = "M2.9,-21 C2.7,-15 2.9,-9 3.3,-3.6 L13.6,-3.6 C14.2,-9 14.4,-15 14,-21Z"
LSANDAL = "M-15,2 L-0.4,2 L-1.4,-3.2 L-13.6,-3.2Z"
RSANDAL = "M1.4,2 L16,2 L14.8,-3.2 L2.6,-3.2Z"
TUNIC = "M-15.5,-67 C-18,-58 -16,-46 -18.5,{hem} C-8,{hem2} 9,{hem2} 19.5,{hem} C17,-46 19,-58 16.5,-67 C9,-71 -8,-71 -15.5,-67Z"
CUIRASS = "M-17,-67.5 C-18.6,-58 -16,-50 -13.6,-44.6 L14.6,-44.6 C17,-50 19.6,-58 18,-67.5 C9,-71.6 -8,-71.6 -17,-67.5Z"
SKIRT = "M-13.8,-45 L14.8,-45 L18,-30.5 L-17,-30.5Z"
CLOAK = "M-16,-68 C-22,-56 -24,-36 -21,-17 L-8,-15 L10,-15 L22,-18 C25,-36 23,-56 17,-68Z"
CLOAK_FLOW = "M-14,-69 C-6,-73.4 10,-73.4 17,-68.6 C28,-64.6 40,-55.6 50,-40 C42,-41 37,-36 31,-28 C27,-38 22,-46 15,-50 L-10,-52Z"
NECK = "M-5,-72 L6,-72 L6.8,-65 L-5.8,-65Z"
FACE = '<ellipse cx="0.5" cy="-83" rx="11" ry="12.6" fill="{skin}"/>'
HAIR_CAP = "M-11.2,-81 C-12.6,-94 -5,-99.6 1,-99.6 C8,-99.6 13.4,-94 12.2,-81 C10.6,-88 6,-91.6 0.6,-91.6 C-4.6,-91.6 -9.4,-88.6 -11.2,-81Z"
BEARD = "M-9.6,-80 C-10,-72 -4.6,-67.2 0.6,-67.2 C6,-67.2 10.8,-72 10.4,-80 C7.6,-76.6 4,-75.6 0.6,-75.6 C-2.8,-75.6 -6.8,-76.6 -9.6,-80Z"
CORINTHIAN = "M-12.4,-77 C-13.6,-92 -7,-100.4 1,-100.4 C9,-100.4 15.2,-92 13.8,-77 C12.2,-70.6 8,-69.2 6.4,-72.4 L5.6,-79.6 L-3.4,-79.6 L-4.4,-72.4 C-6.4,-69.2 -10.8,-70.6 -12.4,-77Z"
CREST = "M-10,-101 C-11,-114 6,-121 19,-112.6 C23,-108 23,-99.6 19.6,-92.6 C16.6,-101 10,-106.4 0,-104.2 C-4.4,-103.6 -7.6,-102.4 -10,-101Z"
PILOS = "M-12.6,-82 C-12.2,-95 -6,-107 1,-113 C8,-107 14.2,-95 13.8,-82 C6,-86.4 -4.8,-86.4 -12.6,-82Z"
PHRYGIAN = "M-12.2,-79 C-13.8,-94 -7,-104 2.6,-105.6 C11,-107 16.6,-102 13,-96 C11.8,-94.2 13,-88 12.8,-79 C12.6,-72 11.6,-69 9.8,-68 L8.8,-80 C3.4,-84.4 -3.4,-84.4 -8.4,-80 L-9.4,-68 C-11.2,-69 -12.2,-72 -12.2,-79Z"


def person(c, x, y, h=80, *, tunic=LINEN, hem=-30, armor=None, legs="bare", stride=0.0,
           beard=True, helmet=None, cloak=None, cloak_flow=False, hold=None, shield=None,
           quiver=False, accents=(), wide=1.15, seed=1):
    """A chunky board-game miniature seen from the front, feet at screen point (x, y).

    h: feet -> top of the head in px (the head is ~1/4 of it; crests, hats, spears rise above).
    tunic: a material stop list (LINEN, WOOL ...) or "accent"; hem: tunic hem height (-30 knee).
    armor: None | "cuirass" (bronze muscle cuirass + leather skirt).
    legs: "bare" | "greaves". stride: 0 standing .. 1 striding (legs apart).
    helmet: None | "corinthian" (+ tall crest) | "pilos" | "petasos" | "phrygian".
    cloak: None | material list | "accent";  cloak_flow: blown out to the right (running).
    hold: None | "spear" | "staff" | "bow".  shield: None | "aspis" (huge) | "round" (small).
    quiver: arrows on the back. accents: names of parts in the owner colour:
            "cloak", "crest", "shield", "cap" (helmet/hat), "tunic".
    wide: horizontal stretch for chunky proportions.
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

    rim = "#fff4dc"
    # behind the body: cloak, quiver
    if cloak is not None:
        cf = mat(cloak, "ucloak")
        if cloak_flow:
            part(CLOAK_FLOW, cf, "cloak", '<path d="M18,-64 C27,-58 35,-50 42,-41 M13,-58 C20,-52 25,-46 29,-37" fill="none" stroke="#000" stroke-width="1.6" opacity="0.2"/>'
                 f'<path d="M-6,-71.6 C6,-73.4 14,-71 22,-66" fill="none" stroke="{rim}" stroke-width="1.4" opacity="0.6"/>')
        else:
            part(CLOAK, cf, "cloak", '<path d="M-9,-56 C-11,-42 -11,-28 -10,-16 M10,-56 C12,-42 13,-28 12,-16" fill="none" stroke="#000" stroke-width="1.6" opacity="0.2"/>')
    if quiver:
        lt = grad(c, "uleather", LEATHER)
        art(f'<path d="M12,-48 L21,-90 L28.4,-88 L19.6,-46Z" fill="{lt}"/>'
            '<path d="M21.6,-90 L20.4,-99 M24.6,-89.4 L25,-100 M27.4,-88.6 L29.6,-98" stroke="#6b4423" stroke-width="1.1"/>'
            '<path d="M19,-99 L21.2,-104 L22.4,-98.4Z M23.6,-100 L25.6,-105.4 L26.4,-99.8Z M28,-98 L31,-102.6 L30.8,-97.4Z" fill="#f2ead6"/>'
            '<path d="M14,-52 L22.4,-88" stroke="#000" stroke-width="1.2" opacity="0.2"/>')
    # legs (striding: left leg swings out, right leg back)
    rot_l, rot_r = 13 * stride, -7 * stride
    for d, sandal, greave, rot, pivot in ((LLEG, LSANDAL, LGREAVE, rot_l, (-7, -33)), (RLEG, RSANDAL, RGREAVE, rot_r, (8, -33))):
        g = [f'<g transform="rotate({f(rot)} {pivot[0]} {pivot[1]})">', f'<path d="{d}" fill="{skin}"/>']
        if legs == "greaves":
            g.append(f'<path d="{greave}" fill="{metal}"/>')
        g.append(f'<path d="{sandal}" fill="#5e3b22"/><path d="{sandal}" fill="none" stroke="#8a5a34" stroke-width="0.8" opacity="0.7"/>')
        g.append("</g>")
        art("".join(g))
    # tunic, armour (with AO on the legs under the hem)
    art(f'<rect x="-14" y="{f(hem)}" width="29" height="7" fill="#2b1a10" opacity="0.18"/>')
    part(TUNIC.format(hem=hem, hem2=hem + 2), mat(tunic, "utunic"), "tunic",
         f'<rect x="-17.4" y="-49.6" width="35.6" height="3.4" fill="#6a4426"/><rect x="-17.4" y="-49.6" width="35.6" height="0.9" fill="#a8744a"/>'
         f'<path d="M-9,-45 C-9.6,-40 -10,{hem + 5} -10.6,{hem + 1.5} M1,-45 L1.2,{hem + 1.5} M10,-45 C10.6,-40 11,{hem + 5} 11.6,{hem + 1.5}" fill="none" stroke="#000" stroke-width="1.2" opacity="0.16"/>'
         f'<path d="M-15,-64 C-16.6,-56 -15.4,-48 -17,-34" fill="none" stroke="{rim}" stroke-width="1.4" opacity="0.55"/>')
    if armor == "cuirass":
        lt = grad(c, "uleather", LEATHER)
        art(f'<path d="{SKIRT}" fill="{lt}"/>' + "".join(f'<rect x="{f(-15.6 + i * 3.8)}" y="-44" width="0.8" height="13.4" fill="#3e2514" opacity="0.6"/>' for i in range(1, 9)))
        art(f'<path d="{CUIRASS}" fill="{metal}"/>'
            f'<path d="M-9,-62 C-4.6,-58.6 5.6,-58.6 10,-62 M0.5,-60 L0.5,-47 M-7,-53 C-2.6,-51 3.6,-51 8,-53" fill="none" stroke="{BRONZE["dark"]}" stroke-width="1.1" opacity="0.5"/>'
            f'<path d="M-15.6,-65 C-16.8,-57 -15,-50 -13.2,-46" fill="none" stroke="{rim}" stroke-width="1.6" opacity="0.8"/>'
            f'<rect x="-14.6" y="-46.6" width="29.2" height="2.4" fill="{BRONZE["dark"]}" opacity="0.5"/>')
    # arms + held items
    if hold == "bow":
        wood = "#6b4423"
        art(f'<path d="M-14.5,-66.6 C-22,-67 -30,-66.4 -36,-65 L-36,-58 C-30,-59 -22,-59.6 -14,-59Z" fill="{skin}"/>'
            f'<path d="M13,-67 C21,-69.6 28,-67 30.4,-62 C26,-58.6 16,-58.4 6,-60.6 L6,-66Z" fill="{skin}"/>'
            f'<path d="M-36,-99 C-54,-84 -54,-39 -36,-24" fill="none" stroke="{wood}" stroke-width="4.2" stroke-linecap="round"/>'
            f'<path d="M-37.4,-96 C-51.6,-82 -51.6,-41 -37.4,-27" fill="none" stroke="#c08a55" stroke-width="1.3" opacity="0.85"/>'
            '<path d="M-36,-99 L5,-63 L-36,-24" fill="none" stroke="#f3ead0" stroke-width="0.9"/>'
            '<path d="M-48,-62.6 L9,-62.6" stroke="#7a5a3a" stroke-width="1.6"/><path d="M-53,-62.6 L-46.6,-65.6 L-46.6,-59.6Z" fill="#b0793a"/>'
            '<path d="M5,-62.6 L11.6,-66.4 M5,-62.6 L11.6,-58.8" stroke="#c8392f" stroke-width="1.8"/>'
            f'<circle cx="-37.4" cy="-61.6" r="4.8" fill="{skin}"/><circle cx="5" cy="-63" r="4.6" fill="{skin}"/>')
    else:
        if hold in ("spear", "staff"):
            top = -113 if hold == "spear" else -104
            art(f'<rect x="-23.2" y="{top}" width="3.6" height="{f(-top + 2)}" fill="{WOOD["dark"]}"/><rect x="-23.2" y="{top}" width="1.3" height="{f(-top + 2)}" fill="#c99a6a"/>')
            if hold == "spear":
                art(f'<path d="M-21.4,-125 C-18.4,-119 -17.6,-115 -18.4,-111.6 L-21.4,-109.6 L-24.4,-111.6 C-25.2,-115 -24.4,-119 -21.4,-125Z" fill="{BRONZE["lit"]}"/>'
                    f'<path d="M-21.4,-125 C-18.4,-119 -17.6,-115 -18.4,-111.6 L-21.4,-109.6Z" fill="{BRONZE["shade"]}"/>')
            else:
                art(f'<circle cx="-21.4" cy="{top}" r="3.6" fill="{WOOD["base"]}"/><circle cx="-22.6" cy="{top - 1}" r="1.3" fill="#c99a6a"/>')
        art(f'<path d="M-15.5,-66 C-21,-63 -24,-56 -25,-48 L-17.6,-46 C-17,-52 -15,-58 -11.5,-62Z" fill="{skin}"/>'
            f'<path d="M-16.6,-64.4 C-20.8,-61 -23,-55 -23.8,-49" fill="none" stroke="{rim}" stroke-width="1.2" opacity="0.7"/>'
            f'<circle cx="-21.4" cy="-46.6" r="4.8" fill="{skin}"/>'
            f'<path d="M16.5,-66 C22,-63 25,-56 26,-48 L18.6,-46 C18,-52 16,-58 12.5,-62Z" fill="{skin}"/>'
            f'<circle cx="22.4" cy="-46.6" r="4.6" fill="{skin}"/>')
    # neck + big head
    art(f'<path d="{NECK}" fill="{skin}"/>' + FACE.format(skin=skin)
        + f'<ellipse cx="11.6" cy="-82" rx="2.2" ry="3.4" fill="#b47a5e"/>'
        '<ellipse cx="-4" cy="-84.4" rx="1.5" ry="1.2" fill="#2a1d14"/><ellipse cx="5.2" cy="-84.4" rx="1.5" ry="1.2" fill="#2a1d14"/>'
        '<path d="M-6.6,-88 L-2,-88.8 M3,-88.8 L7.6,-88" stroke="#4a3222" stroke-width="1.1" stroke-linecap="round"/>'
        '<path d="M1.2,-83 L-0.4,-78.4 L2,-78" fill="none" stroke="#a46a46" stroke-width="1"/>'
        f'<path d="M-9.6,-88 C-10.6,-82 -9.6,-76 -6.6,-72.6" fill="none" stroke="{rim}" stroke-width="1.3" opacity="0.6"/>'
        '<ellipse cx="0.5" cy="-69" rx="10" ry="2.6" fill="#2b1a10" opacity="0.2"/>')
    if beard:
        art(f'<path d="{BEARD}" fill="{HAIR}"/><path d="M-7,-76 C-5,-71 -2,-69 0.6,-68.6" fill="none" stroke="{HAIR_HI}" stroke-width="1"/>')
    else:
        art('<path d="M-2.4,-75 C-0.6,-74 2.2,-74 3.8,-75" fill="none" stroke="#a46a46" stroke-width="0.9"/>')
    if helmet in (None, "petasos"):
        art(f'<path d="{HAIR_CAP}" fill="{HAIR}"/><path d="M-9.4,-85 C-9.4,-92 -4.6,-96.6 1,-96.8" fill="none" stroke="{HAIR_HI}" stroke-width="1.4"/>')
    if helmet == "corinthian":
        art(f'<path d="{CORINTHIAN}" fill="{metal}"/>'
            '<ellipse cx="-3.8" cy="-84.6" rx="3.2" ry="1.9" fill="#1d140e"/><ellipse cx="6.6" cy="-84.6" rx="3.2" ry="1.9" fill="#1d140e"/>'
            f'<path d="M-10.6,-80 C-11.4,-90 -6,-97.6 1,-98" fill="none" stroke="{rim}" stroke-width="1.6" opacity="0.85"/>'
            f'<path d="M-12.4,-77 C-10.8,-71 -7,-70 -4.4,-72.4" fill="none" stroke="{BRONZE["dark"]}" stroke-width="0.9" opacity="0.6"/>')
        part(CREST, grad(c, "ucrest", [(0, "#ff8a6a"), (0.1, "#e0503e"), (0.6, "#b23a30"), (1, "#6a2020")]), "crest",
             '<path d="M-7,-104 C-2,-113 10,-115.6 17.6,-108" fill="none" stroke="#fff" stroke-width="1.3" opacity="0.4"/>'
             '<path d="M-5,-103.6 C0,-107 8,-108 14,-104 M-3,-102 C3,-104 9,-104.6 15,-100" fill="none" stroke="#000" stroke-width="0.8" opacity="0.18"/>'
             f'<path d="M-1.4,-100.2 L-0.4,-104.4 L3,-104.2 L2.4,-100.2Z" fill="{BRONZE["shade"]}"/>')
    elif helmet == "pilos":
        part(PILOS, metal, "cap", f'<path d="M-13.2,-82.8 C-5,-87.6 6,-87.6 14.4,-82.8 L14,-80 C6,-84.6 -5,-84.6 -12.8,-80Z" fill="{BRONZE["shade"]}"/>'
             f'<path d="M-9.6,-86 C-8.6,-96 -4,-105 0.6,-109.6" fill="none" stroke="{rim}" stroke-width="1.6" opacity="0.9"/>')
    elif helmet == "petasos":
        felt = grad(c, "ufelt", FELT)
        brim = '<ellipse cx="0.6" cy="-92" rx="24" ry="6.2" fill="{f}"/><path d="M-9.6,-92 C-9.8,-100 -4.6,-104.4 0.8,-104.4 C6.6,-104.4 11.6,-100 11.2,-92Z" fill="{f}"/>'
        if "cap" in accents:
            c.accent(f'<g transform="{tf}"><g transform="rotate(-6 0.6 -92)">{brim.format(f=acc)}</g></g>')
        else:
            art(f'<g transform="rotate(-6 0.6 -92)">{brim.format(f=felt)}</g>')
        art('<g transform="rotate(-6 0.6 -92)"><path d="M-9.6,-94 C-3,-96.4 5,-96.4 11.2,-94 L11.2,-91.6 C5,-93.8 -3,-93.8 -9.6,-91.6Z" fill="#6a4426"/>'
            f'<path d="M-22.4,-93 C-12,-97.4 8,-98 24.4,-93.2" fill="none" stroke="{rim}" stroke-width="1.2" opacity="0.8"/>'
            '<path d="M-20,-89.2 C-8,-86 10,-86 22,-89.4" fill="none" stroke="#000" stroke-width="1.2" opacity="0.2"/></g>')
    elif helmet == "phrygian":
        part(PHRYGIAN, acc if "cap" in accents else grad(c, "uwool", WOOL), "cap",
             f'<path d="M-9.6,-88 C-8.6,-97 -3,-102 4,-103.4" fill="none" stroke="{rim}" stroke-width="1.4" opacity="0.6"/>'
             '<path d="M-8.4,-80 C-3.4,-84.4 3.4,-84.4 8.8,-80" fill="none" stroke="#000" stroke-width="1.1" opacity="0.3"/>')
    # shield in front
    if shield:
        cx_, cy_, rx_, ry_ = (9, -50, 24.5, 27.5) if shield == "aspis" else (21, -48, 11.5, 13.5)
        art(f'<ellipse cx="{f(cx_ + 2.4)}" cy="{f(cy_ + 2)}" rx="{rx_}" ry="{ry_}" fill="#1d140e" opacity="0.22"/>')
        if "shield" in accents:
            sg = c.rad("ushield", 0.32, 0.28, 0.85, [(0, ACCENT["lit"]), (0.45, ACCENT["light"]), (0.8, ACCENT["shade"]), (1, ACCENT["dark"])], bbox=True)
            c.accent(f'<g transform="{tf}"><ellipse cx="{cx_}" cy="{cy_}" rx="{rx_}" ry="{ry_}" fill="{sg}"/></g>')
        else:
            art(f'<ellipse cx="{cx_}" cy="{cy_}" rx="{rx_}" ry="{ry_}" fill="{metal}"/>')
        rw = 4.2 if shield == "aspis" else 2.6
        art(f'<ellipse cx="{cx_}" cy="{cy_}" rx="{f(rx_ - rw / 2)}" ry="{f(ry_ - rw / 2)}" fill="none" stroke="{BRONZE["base"]}" stroke-width="{rw}"/>'
            f'<path d="M{f(cx_ - rx_ * 0.86)},{f(cy_ - ry_ * 0.36)} A{rx_},{ry_} 0 0 1 {f(cx_ - rx_ * 0.18)},{f(cy_ - ry_ * 0.97)}" fill="none" stroke="{rim}" stroke-width="{f(rw * 0.45)}" opacity="0.9"/>'
            f'<path d="M{f(cx_ + rx_ * 0.92)},{f(cy_ + ry_ * 0.22)} A{rx_},{ry_} 0 0 1 {f(cx_ + rx_ * 0.18)},{f(cy_ + ry_ * 0.97)}" fill="none" stroke="{BRONZE["dark"]}" stroke-width="{f(rw * 0.55)}" opacity="0.85"/>')
        if shield == "aspis":
            # painted emblem in cream: a bold chevron
            art(f'<path d="M{f(cx_ - 10)},{f(cy_ + 11)} L{f(cx_)},{f(cy_ - 12)} L{f(cx_ + 10)},{f(cy_ + 11)}" fill="none" stroke="#f4ead2" stroke-width="5" stroke-linejoin="round" opacity="0.95"/>'
                f'<path d="M{f(cx_ - 10)},{f(cy_ + 11)} L{f(cx_)},{f(cy_ - 12)} L{f(cx_ + 10)},{f(cy_ + 11)}" fill="none" stroke="#000" stroke-width="1" stroke-linejoin="round" opacity="0.12" transform="translate(1 1)"/>')
        else:
            art(f'<circle cx="{cx_}" cy="{cy_}" r="3.4" fill="{BRONZE["lit"]}"/><circle cx="{f(cx_ - 1)}" cy="{f(cy_ - 1)}" r="1.2" fill="{rim}"/>')



# ---------------------------------------------------------------------------
# Sculpting toolkit for the unit figures (screen space, light from the upper left)
# ---------------------------------------------------------------------------
# Unit figures are chunky painted miniatures in a 3/4 view, facing screen-left. Every part is a
# soft volume: a gradient across it from its lit edge (toward LIGHT) to its shaded edge, with a
# warm rim light, a cool core shadow and a little reflected light (the 6-stop ramps below), plus
# cast shadows of the parts in front (clipped to the part) and a few painted folds and glints.
LIGHT = (-0.6, -0.8)        # unit vector pointing TOWARD the light (screen space, y down)
RIM = "#fff4dc"             # warm rim light
SHADE = "#2a1a10"           # warm shadow ink on figures (cast shadows, creases)

# cylinder ramps across a part: lit edge -> shaded edge
# (0 rim light, 0.1 lit, 0.42 base, 0.78 shade, 0.93 core shadow, 1 reflected light)
BRONZE_R = [(0, "#fff4d2"), (0.1, "#f6d48e"), (0.38, "#d49e55"), (0.7, "#9a6631"), (0.9, "#5a3a1b"), (1, "#8a6a4c")]
BRONZE_DK = [(0, "#e8c48a"), (0.12, "#c99450"), (0.42, "#a06c34"), (0.75, "#6e4622"), (0.92, "#432a14"), (1, "#6a5040")]
# figure skin: like SKIN, but the reflected light at the shaded edge stays warm (a cool mauve edge
# reads as see-through against the bronze token)
SKIN_F = [(0, "#fcdcb8"), (0.1, "#efbd8e"), (0.42, "#d3996c"), (0.76, "#a06848"), (0.92, "#744632"), (1, "#885a40")]
HAIR_R = [(0, "#8a6446"), (0.15, "#6a4a32"), (0.5, "#4a3222"), (0.85, "#2e1e14"), (1, "#3e3030")]
WOOD_R = [(0, "#e0b484"), (0.15, "#b98552"), (0.5, "#8a5a34"), (0.85, "#57361e"), (1, "#6e5444")]
ACC_R = [(0, ACCENT["lit"]), (0.25, ACCENT["lit"]), (0.55, ACCENT["light"]), (0.82, ACCENT["mid"]), (0.95, ACCENT["shade"]), (1, ACCENT["light"])]


def _uid(c, prefix):
    """A fresh gradient / clip name on this canvas."""
    c._ucount = getattr(c, "_ucount", 0) + 1
    return f"{prefix}{c._ucount}"


def _unit(x, y):
    n = math.hypot(x, y) or 1.0
    return x / n, y / n


def _bend(a, b, e):
    """Angle (degrees) between the two segments a->b and b->e."""
    u = _unit(b[0] - a[0], b[1] - a[1])
    v = _unit(e[0] - b[0], e[1] - b[1])
    return math.degrees(math.acos(max(-1.0, min(1.0, u[0] * v[0] + u[1] * v[1]))))


def curve(points):
    """Catmull-Rom spline segments through points (no leading M): ' C... C...'."""
    n = len(points)
    out = []
    for i in range(n - 1):
        p0, p1, p2, p3 = points[max(i - 1, 0)], points[i], points[i + 1], points[min(i + 2, n - 1)]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        out.append(f" C{f(c1[0])},{f(c1[1])} {f(c2[0])},{f(c2[1])} {f(p2[0])},{f(p2[1])}")
    return "".join(out)


def spline(points, closed=False):
    """Smooth path through points (closed: a soft blob)."""
    if closed:
        n = len(points)
        pts_ = [points[-1]] + list(points) + [points[0], points[1]]
        out = [f"M{f(points[0][0])},{f(points[0][1])}"]
        for i in range(1, n + 1):
            p0, p1, p2, p3 = pts_[i - 1], pts_[i], pts_[i + 1], pts_[i + 2]
            c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
            c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
            out.append(f" C{f(c1[0])},{f(c1[1])} {f(c2[0])},{f(c2[1])} {f(p2[0])},{f(p2[1])}")
        return "".join(out) + "Z"
    return f"M{f(points[0][0])},{f(points[0][1])}" + curve(points)


def _tangents(pts):
    n = len(pts)
    return [_unit(pts[min(i + 1, n - 1)][0] - pts[max(i - 1, 0)][0], pts[min(i + 1, n - 1)][1] - pts[max(i - 1, 0)][1]) for i in range(n)]


def tube_d(pts, ws, caps=(True, True)):
    """Closed outline of a tapered tube along pts with half widths ws (round caps)."""
    tg = _tangents(pts)
    left = [(p[0] - t[1] * w, p[1] + t[0] * w) for p, t, w in zip(pts, tg, ws)]
    right = [(p[0] + t[1] * w, p[1] - t[0] * w) for p, t, w in zip(pts, tg, ws)]
    d = f"M{f(left[0][0])},{f(left[0][1])}" + curve(left)
    we, ws0 = ws[-1], ws[0]
    d += (f" A{f(we)},{f(we)} 0 0 0 {f(right[-1][0])},{f(right[-1][1])}" if caps[1] else f" L{f(right[-1][0])},{f(right[-1][1])}")
    d += curve(right[::-1])
    d += (f" A{f(ws0)},{f(ws0)} 0 0 0 {f(left[0][0])},{f(left[0][1])}Z" if caps[0] else "Z")
    return d


def across(c, p0, p1, ramp):
    """userSpaceOnUse linear gradient from p0 (lit edge) to p1 (shaded edge)."""
    return c.lin(_uid(c, "x"), p0[0], p0[1], p1[0], p1[1], ramp)


def lit_normal(t):
    """Of the two normals of the direction t, the one facing the light."""
    n = (-t[1], t[0])
    return n if n[0] * LIGHT[0] + n[1] * LIGHT[1] >= 0 else (-n[0], -n[1])


def cyl(c, pts, ws, ramp):
    """Cylinder gradient for a tube along pts (taken across its middle)."""
    i = len(pts) // 2
    if len(pts) % 2 == 0:
        p = ((pts[i - 1][0] + pts[i][0]) / 2, (pts[i - 1][1] + pts[i][1]) / 2)
        w = (ws[i - 1] + ws[i]) / 2
        t = _unit(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    else:
        p, w = pts[i], ws[i]
        t = _tangents(pts)[i]
    n = lit_normal(t)
    return across(c, (p[0] + n[0] * w * 1.04, p[1] + n[1] * w * 1.04), (p[0] - n[0] * w * 1.04, p[1] - n[1] * w * 1.04), ramp)


def blob_grad(c, ramp, name, cx=0.34, cy=0.28, r=0.8):
    """Shared radial bbox gradient for round volumes (head, hand, boss), lit upper left."""
    return c.rad(name, cx, cy, r, [(0, ramp[1][1]), (0.32, ramp[2][1]), (0.72, ramp[3][1]), (1, ramp[4][1])], bbox=True)


def cloth_grad(c, ramp, name, x1=0.0, y1=0.15, x2=1.0, y2=0.85):
    """Shared linear bbox gradient for draped cloth and flat masses, lit from the left."""
    return c.lin(name, x1, y1, x2, y2, ramp, bbox=True)


class Fig:
    """A figure drawn in screen space around its feet point (x, y): local units are px * k.
    art() / acc() add markup in the figure's frame; clip() / shade_on() paint cast shadows."""

    def __init__(self, c, x, y, k=1.0):
        self.c, self.x, self.y, self.k = c, x, y, k
        self.tf = f"translate({f(x)} {f(y)})" + (f" scale({f(k)})" if k != 1 else "")

    def g(self, markup):
        return f'<g transform="{self.tf}">{markup}</g>'

    def art(self, markup):
        self.c.add(self.g(markup))

    def acc(self, markup):
        self.c.accent(self.g(markup))

    def put(self, markup, accent=False):
        (self.acc if accent else self.art)(markup)

    def P(self, x, y):
        """Local point -> canvas point."""
        return (self.x + x * self.k, self.y + y * self.k)

    def clip(self, d):
        cid = _uid(self.c, "k")
        return self.c.define(cid, f'<clipPath id="{self.c.id(cid)}"><path d="{d}"/></clipPath>')

    def shade_on(self, target_d, shadow_d, op=0.28, col=SHADE, blur=0.8):
        """A soft cast shadow (shadow_d) painted only inside the part target_d."""
        flt = f' filter="{self.c.blur(blur)}"' if blur else ""
        self.art(f'<g clip-path="{self.clip(target_d)}"><path d="{shadow_d}" fill="{col}" opacity="{f(op)}"{flt}/></g>')

    def paint_in(self, target_d, markup, op=1.0, blur=None):
        """Any markup (strokes, shapes) painted only inside the part target_d, optionally soft."""
        flt = f' filter="{self.c.blur(blur)}"' if blur else ""
        self.art(f'<g clip-path="{self.clip(target_d)}"><g opacity="{f(op)}"{flt}>{markup}</g></g>')

    def tube(self, pts, ws, ramp, accent=False, extra="", caps=(True, True)):
        """A shaded limb / shaft / strap along pts; returns its outline. At a sharp bend the
        tube is split in two (one outline would fold over itself and leave a hole)."""
        for i in range(1, len(pts) - 1):
            if _bend(pts[i - 1], pts[i], pts[i + 1]) > 48:
                self.tube(pts[:i + 1], ws[:i + 1], ramp, accent, caps=(caps[0], True))
                return self.tube(pts[i:], ws[i:], ramp, accent, extra, caps=(True, caps[1]))
        d = tube_d(pts, ws, caps)
        self.put(f'<path d="{d}" fill="{cyl(self.c, pts, ws, ramp)}"/>', accent)
        if extra:
            self.art(extra)
        return d

    def mass(self, d, fill, accent=False, extra=""):
        """Any shaded shape (fill is a gradient url or colour); returns d."""
        self.put(f'<path d="{d}" fill="{fill}"/>', accent)
        if extra:
            self.art(extra)
        return d


def stroke(d, col, w, op=1.0, cap="round"):
    return f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{f(w)}" stroke-linecap="{cap}" stroke-linejoin="round"' + (f' opacity="{f(op)}"' if op < 1 else "") + "/>"


def fold(d, w=1.0, dark=0.22, light=0.32, dx=-0.6, dy=-0.5):
    """A painted cloth fold: a dark crease with a lit ridge beside it (toward the light)."""
    return (f'<path d="{d}" fill="none" stroke="{SHADE}" stroke-width="{f(w)}" stroke-linecap="round" opacity="{f(dark)}"/>'
            f'<path d="{d}" transform="translate({f(dx)} {f(dy)})" fill="none" stroke="#fff" stroke-width="{f(w * 0.7)}" stroke-linecap="round" opacity="{f(light)}"/>')


def glint(x, y, r=0.8, op=0.9, col="#fffaf0"):
    return f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{col}" opacity="{f(op)}"/>'


def ellipse_d(cx, cy, rx, ry, rot=0.0, n=0):
    """Ellipse as a path (for clip paths and outlines), rotated by rot degrees."""
    a = math.radians(rot)
    ca, sa = math.cos(a), math.sin(a)
    p = lambda t: (cx + rx * math.cos(t) * ca - ry * math.sin(t) * sa, cy + rx * math.cos(t) * sa + ry * math.sin(t) * ca)
    pts_ = [p(2 * math.pi * i / 24) for i in range(24)]
    return spline(pts_, closed=True)


def ground_shadow(c, x, y, w, length=None, opacity=0.42, depth=None):
    """Contact shadow under a figure standing at screen point (x, y), plus a soft cast shadow
    falling to the lower right on the token (clipped to its top). w = half width of the footprint."""
    length = length if length is not None else w * 1.6
    depth = depth if depth is not None else w * 0.34 + 0.6
    c.add(f'<g clip-path="{c.url("top")}">'
          f'<ellipse cx="{f(x + length * 0.55)}" cy="{f(y + 1.6)}" rx="{f(w + length * 0.6)}" ry="{f(depth + 2)}" fill="{INK}" opacity="{f(opacity * 0.5)}" filter="{c.blur(1.8)}"/>'
          f'<ellipse cx="{f(x + 0.8)}" cy="{f(y + 0.4)}" rx="{f(w)}" ry="{f(depth)}" fill="{INK}" opacity="{f(opacity)}" filter="{c.blur(0.8)}"/></g>')


def foot_shadow(c, x, y, w, opacity=0.5):
    """Small dark contact shadow right under one foot / hoof."""
    c.add(f'<ellipse cx="{f(x + 0.6)}" cy="{f(y + 0.3)}" rx="{f(w)}" ry="{f(w * 0.4)}" fill="{INK}" opacity="{f(opacity)}" filter="{c.blur(0.5)}"/>')


# ---------------------------------------------------------------------------
# Token: an ornate bronze disc with an owner-colour enamel band
# ---------------------------------------------------------------------------
def _band(cx, cy, rx, ry, y0, y1):
    """The front strip of the token's side between the heights y0 and y1 below the top."""
    return (f"M{f(cx - rx)},{f(cy + y0)} A{f(rx)},{f(ry)} 0 0 0 {f(cx + rx)},{f(cy + y0)} "
            f"L{f(cx + rx)},{f(cy + y1)} A{f(rx)},{f(ry)} 0 0 1 {f(cx - rx)},{f(cy + y1)}Z")


def _front_arc(cx, cy, rx, ry, y=0.0):
    return f"M{f(cx - rx)},{f(cy + y)} A{f(rx)},{f(ry)} 0 0 0 {f(cx + rx)},{f(cy + y)}"


def token(c, top="bronze", seed=3, eggs=30):
    """Draw the unit token - always first; defines the clip c.url("top") (the top ellipse).

    The token is a thick bronze disc: a soft drop shadow, a side wall with an enamel band in the
    owner colour (accent) between two bevelled bronze lips with small bronze studs, and a top with
    a bevelled rim, an embossed egg-and-dart ring and a polished inner field.
    top="water": ships - a water-coloured field inside a narrower bronze rim."""
    rnd = random.Random(seed)
    cx, cy = c.P(0, 0, 0)
    rx, ry = TOKEN_W / 2, TOKEN_W / 4
    h = TOKEN_H
    # soft drop shadow on the map
    c.add(f'<ellipse cx="{f(cx + 2.5)}" cy="{f(cy + h - 0.5)}" rx="{f(rx * 1.0)}" ry="{f(ry * 0.92)}" fill="{INK}" opacity="0.3" filter="{c.blur(1.8)}"/>'
          f'<ellipse cx="{f(cx + 1)}" cy="{f(cy + h - 0.2)}" rx="{f(rx * 0.97)}" ry="{f(ry * 0.86)}" fill="{INK}" opacity="0.3" filter="{c.blur(0.7)}"/>')
    # side wall: polished bronze (bright streak on the lit left, dark to the right)
    side = c.lin("tside", cx - rx, 0, cx + rx, 0, [(0, "#7a5328"), (0.08, "#d6a45e"), (0.2, "#fbe2a8"), (0.3, "#e0ae64"), (0.55, "#a8743a"), (0.8, "#6a4420"), (0.94, "#4a2e14"), (1, "#6e5238")])
    c.add(f'<path d="{_band(cx, cy, rx, ry, 0, h)}" fill="{side}"/>')
    # enamel band (owner colour)
    e0, e1 = TOKEN_LIP, h - 1.9
    enamel = c.lin("tenamel", cx - rx, 0, cx + rx, 0, [(0, ACCENT["mid"]), (0.12, ACCENT["lit"]), (0.4, ACCENT["lit"]), (0.7, ACCENT["light"]), (0.92, ACCENT["mid"]), (1, ACCENT["shade"])])
    c.accent(f'<path d="{_band(cx, cy, rx, ry, e0, e1)}" fill="{enamel}"/>')
    # enamel gloss, cloison edges, bronze studs
    gl = c.lin("tgloss", cx - rx, 0, cx + rx, 0, [(0, "#fff", 0), (0.18, "#fff", 0.55), (0.3, "#fff", 0.15), (0.6, "#fff", 0.08), (1, "#fff", 0)])
    studs = []
    for i in range(13):
        th = math.radians(8 + i * (164 / 12))
        sx, sy = cx - rx * math.cos(th), cy + ry * math.sin(th) + (e0 + e1) / 2
        lit = 1 - i / 12
        studs.append(f'<circle cx="{f(sx + 0.25)}" cy="{f(sy + 0.3)}" r="1.15" fill="#3a2410" opacity="0.45"/>'
                     f'<circle cx="{f(sx)}" cy="{f(sy)}" r="1.05" fill="{"#f3cf86" if lit > 0.55 else ("#c99450" if lit > 0.25 else "#8a5a2c")}"/>'
                     + (f'<circle cx="{f(sx - 0.35)}" cy="{f(sy - 0.35)}" r="0.4" fill="#fff8e0"/>' if lit > 0.3 else ""))
    c.add(f'<path d="{_band(cx, cy, rx, ry, e0 + 0.2, e0 + 1.4)}" fill="{gl}"/>'
          f'<path d="{_front_arc(cx, cy, rx, ry, e0)}" fill="none" stroke="#4a2e14" stroke-width="0.5" opacity="0.7"/>'
          f'<path d="{_front_arc(cx, cy, rx, ry, e1)}" fill="none" stroke="#4a2e14" stroke-width="0.6" opacity="0.8"/>'
          f'<path d="{_front_arc(cx, cy, rx, ry, e1 + 0.6)}" fill="none" stroke="#f6d496" stroke-width="0.5" opacity="0.6"/>'
          f'<path d="{_band(cx, cy, rx, ry, h - 0.9, h)}" fill="#2e1c0c" opacity="0.45"/>' + "".join(studs))
    # top: bevelled outer lip (bright at the back left, dark at the front right)
    lip = c.lin("tlip", cx - rx * 0.7, cy - ry, cx + rx * 0.7, cy + ry, [(0, "#fff0c4"), (0.3, "#e6b86e"), (0.6, "#b07a3c"), (1, "#6e4620")])
    c.add(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="{lip}"/>'
          f'<path d="M{f(cx - rx + 0.3)},{f(cy + 0.4)} A{f(rx - 0.3)},{f(ry - 0.2)} 0 0 0 {f(cx + rx * 0.2)},{f(cy + ry - 0.15)}" fill="none" stroke="#fff3cc" stroke-width="0.8" opacity="0.85"/>')
    c.define("top", f'<clipPath id="{c.id("top")}"><ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}"/></clipPath>')
    if top == "water":
        r_in = rx - 4.2
        c.add(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx - 2)}" ry="{f(ry - 1)}" fill="#7a4e24"/>'
              f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx - 2.4)}" ry="{f(ry - 1.2)}" fill="none" stroke="#f6d496" stroke-width="0.6" opacity="0.7"/>')
        _rope(c, cx, cy, rx - 3.1, n=46)
        wat = c.rad("water", cx - rx * 0.3, cy - ry * 0.6, rx * 1.15, [(0, "#9be6dc"), (0.4, "#55c4c4"), (0.8, "#2f9fb2"), (1, "#25839c")])
        c.add(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(r_in)}" ry="{f(r_in / 2)}" fill="{wat}"/>'
              f'<path d="M{f(cx - r_in)},{f(cy)} A{f(r_in)},{f(r_in / 2)} 0 0 1 {f(cx + r_in)},{f(cy)}" fill="none" stroke="#123f52" stroke-width="1.6" opacity="0.35"/>')
        g = [f'<g clip-path="{c.url("top")}">']
        for _ in range(18):
            ang = rnd.uniform(0, 2 * math.pi)
            rr = (r_in / SQ2) * math.sqrt(rnd.random()) * 0.88
            x, y = c.P(rr * math.cos(ang), rr * math.sin(ang), 0)
            w = rnd.uniform(2.6, 5.4)
            g.append(f'<path d="M{f(x - w)},{f(y)} q{f(w / 2)},{f(-1.3)} {f(w)},0 q{f(w / 2)},{f(1.3)} {f(w)},0" fill="none" stroke="#ffffff" stroke-width="0.7" opacity="{f(rnd.uniform(0.3, 0.65))}"/>')
        g.append("</g>")
        c.add("".join(g))
        return
    # enamel ring inlaid in the top (owner colour), between the outer lip and a bronze bead
    re_o, re_i = rx - 1.7, rx - 10.2
    ering = c.lin("tering", cx - rx, cy - ry, cx + rx, cy + ry, [(0, ACCENT["lit"]), (0.45, ACCENT["lit"]), (0.8, ACCENT["light"]), (1, ACCENT["mid"])])
    c.add(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(re_o + 0.5)}" ry="{f(re_o / 2 + 0.25)}" fill="#4a2e14"/>')
    c.accent(f'<path d="M{f(cx - re_o)},{f(cy)} A{f(re_o)},{f(re_o / 2)} 0 1 0 {f(cx + re_o)},{f(cy)} A{f(re_o)},{f(re_o / 2)} 0 1 0 {f(cx - re_o)},{f(cy)}Z '
             f'M{f(cx - re_i)},{f(cy)} A{f(re_i)},{f(re_i / 2)} 0 1 1 {f(cx + re_i)},{f(cy)} A{f(re_i)},{f(re_i / 2)} 0 1 1 {f(cx - re_i)},{f(cy)}Z" fill="{ering}" fill-rule="evenodd"/>')
    eg = c.lin("tergl", cx - rx, cy - ry, cx + rx, cy + ry, [(0, "#fff", 0.5), (0.3, "#fff", 0.12), (0.6, "#fff", 0), (1, "#000", 0.12)])
    c.add(f'<path d="M{f(cx - re_o)},{f(cy)} A{f(re_o)},{f(re_o / 2)} 0 1 0 {f(cx + re_o)},{f(cy)} A{f(re_o)},{f(re_o / 2)} 0 1 0 {f(cx - re_o)},{f(cy)}Z '
          f'M{f(cx - re_i)},{f(cy)} A{f(re_i)},{f(re_i / 2)} 0 1 1 {f(cx + re_i)},{f(cy)} A{f(re_i)},{f(re_i / 2)} 0 1 1 {f(cx - re_i)},{f(cy)}Z" fill="{eg}" fill-rule="evenodd"/>'
          f'<path d="M{f(cx - re_o + 1)},{f(cy - 0.6)} A{f(re_o - 1)},{f(re_o / 2 - 0.6)} 0 0 1 {f(cx + re_o * 0.2)},{f(cy - re_o / 2 + 0.5)}" fill="none" stroke="#fff" stroke-width="0.9" opacity="0.55"/>')
    # embossed egg-and-dart ring (in the ground plane of the top)
    r_o, r_i = (re_i - 1.0) / SQ2, (re_i - 6.6) / SQ2          # ring in world units
    r_m = (r_o + r_i) / 2
    c.add(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(re_i)}" ry="{f(re_i / 2)}" fill="#f2c87e"/>'
          f'<ellipse cx="{f(cx)}" cy="{f(cy + 0.2)}" rx="{f(r_o * SQ2)}" ry="{f(r_o / SQ2)}" fill="#8a5a2a"/>'
          f'<path d="M{f(cx - r_o * SQ2)},{f(cy + 0.2)} A{f(r_o * SQ2)},{f(r_o / SQ2)} 0 0 1 {f(cx + r_o * SQ2)},{f(cy + 0.2)}" fill="none" stroke="#3e260f" stroke-width="0.7" opacity="0.6"/>')
    eggf = c.lin("tegg", -r_o, -r_o * 0.3, r_o, r_o * 0.3, [(0, "#ffe7ae"), (0.35, "#e2ad62"), (0.7, "#b07a3c"), (1, "#80542a")])
    sh, body, hi, darts = [], [], [], []
    for i in range(eggs):
        ph = 2 * math.pi * i / eggs
        a, b = r_m * math.cos(ph), r_m * math.sin(ph)
        rot = f(math.degrees(ph))
        sh.append(f'<ellipse cx="{f(a + 0.4)}" cy="{f(b + 0.1)}" rx="1.6" ry="1.1" transform="rotate({rot} {f(a + 0.4)} {f(b + 0.1)})"/>')
        body.append(f'<ellipse cx="{f(a)}" cy="{f(b)}" rx="1.45" ry="1" transform="rotate({rot} {f(a)} {f(b)})"/>')
        hi.append(f'<ellipse cx="{f(a - 0.4)}" cy="{f(b - 0.2)}" rx="0.7" ry="0.45" transform="rotate({rot} {f(a - 0.4)} {f(b - 0.2)})"/>')
        pd = ph + math.pi / eggs
        darts.append(f"M{f((r_m - 1.2) * math.cos(pd))},{f((r_m - 1.2) * math.sin(pd))} L{f((r_m + 1.4) * math.cos(pd))},{f((r_m + 1.4) * math.sin(pd))}")
    c.add(c.on(c.m_ground(0), f'<g fill="#3a2410" opacity="0.55">{"".join(sh)}</g><g fill="{eggf}">{"".join(body)}</g>'
               f'<g fill="#fff6d8" opacity="0.6">{"".join(hi)}</g>'
               f'<path d="{" ".join(darts)}" stroke="#3e260f" stroke-width="0.45" opacity="0.7"/>'))
    # groove + bead, then the polished inner field with lathe rings
    ri = r_i * SQ2
    field = c.rad("tfield", cx - ri * 0.35, cy - ri * 0.3, ri * 1.1, [(0, "#d9a862"), (0.35, "#b07c40"), (0.75, "#7e5428"), (1, "#5e3c1c")])
    c.add(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(ri)}" ry="{f(ri / 2)}" fill="#3e260f" opacity="0.8"/>'
          f'<ellipse cx="{f(cx)}" cy="{f(cy + 0.3)}" rx="{f(ri - 0.7)}" ry="{f(ri / 2 - 0.4)}" fill="#f0c67c"/>'
          f'<ellipse cx="{f(cx)}" cy="{f(cy + 0.5)}" rx="{f(ri - 1.6)}" ry="{f(ri / 2 - 0.8)}" fill="{field}"/>')
    rings = "".join(f'<ellipse cx="{f(cx)}" cy="{f(cy + 0.5)}" rx="{f(rr)}" ry="{f(rr / 2)}" fill="none" stroke="{col}" stroke-width="0.4" opacity="{op}"/>'
                    for rr, col, op in ((ri - 4, "#ffe2a6", 0.35), (ri - 9, "#3e260f", 0.25), (ri - 14, "#ffe2a6", 0.25)))
    sheen = c.rad("tsheen", 0.3, 0.3, 0.6, [(0, "#fff0c8", 0.55), (1, "#fff0c8", 0)], bbox=True)
    c.add(rings + f'<ellipse cx="{f(cx - ri * 0.3)}" cy="{f(cy - ri * 0.12)}" rx="{f(ri * 0.55)}" ry="{f(ri * 0.22)}" fill="{sheen}"/>')


def _rope(c, cx, cy, r, n=46):
    """A twisted bronze rope moulding on the token rim (screen ellipse radius r)."""
    out = []
    for i in range(n):
        th = 2 * math.pi * i / n
        x, y = cx + r * math.cos(th), cy + r / 2 * math.sin(th)
        lit = 0.5 - 0.5 * math.cos(th + math.pi / 4)
        col = "#f6d496" if lit < 0.35 else ("#cf9a52" if lit < 0.7 else "#8a5a2c")
        out.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="1.5" ry="0.75" transform="rotate({f(math.degrees(th) + 60)} {f(x)} {f(y)})" fill="{col}"/>')
    c.add("".join(out))


# ---------------------------------------------------------------------------
# Figure parts (3/4 view, facing screen-left; local figure units, feet at y = 0, up is -y)
# ---------------------------------------------------------------------------
def _pts_scale(pts, cx, cy, k):
    return [(cx + x * k, cy + y * k) for x, y in pts]


def _mix(p, q, t):
    return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)


def arm(F, pts, ws, ramp=SKIN_F, accent=False):
    """A bare arm (or sleeve, accent=True) along pts with half widths ws."""
    d = F.tube(pts, ws, ACC_R if accent else ramp, accent=accent)
    t = _tangents(pts)[0]
    n = lit_normal(t)
    p = _mix(pts[0], pts[-1], 0.35)
    w = ws[0] * 0.55
    F.art(stroke(f"M{f(pts[0][0] + n[0] * w)},{f(pts[0][1] + n[1] * w)} L{f(p[0] + n[0] * w)},{f(p[1] + n[1] * w)}", RIM, 0.8, 0.35))
    return d


def limb(F, joints, ws, ramp=SKIN_F, accent=False):
    """A whole arm / leg as ONE smooth tube through its joints (no seam at the elbow / knee):
    joints = [root, bend, end], ws = 5 half widths (root, mid, bend, mid, end)."""
    a, b, e = joints
    pts = [a, _mix(a, b, 0.5), b, _mix(b, e, 0.5), e]
    d = F.tube(pts, ws, ACC_R if accent else ramp, accent=accent)
    n = lit_normal(_tangents(pts)[1])
    F.art(stroke(spline([(p[0] + n[0] * w * 0.6, p[1] + n[1] * w * 0.6) for p, w in zip(pts[:3], ws[:3])]), RIM, 0.8, 0.3))
    return d


def fist(F, x, y, r, ramp=SKIN_F):
    """A clenched fist (round volume with knuckle creases)."""
    g = blob_grad(F.c, ramp, "fist" + ramp[2][1][1:])
    F.art(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(r * 1.08)}" ry="{f(r * 0.94)}" fill="{g}"/>'
          + stroke(f"M{f(x - r * 0.55)},{f(y - r * 0.15)} q{f(r * 0.3)},{f(r * 0.32)} {f(r * 0.62)},{f(r * 0.06)} q{f(r * 0.3)},{f(r * 0.3)} {f(r * 0.6)},{f(-r * 0.04)}", "#8a5440", 0.55, 0.6)
          + f'<ellipse cx="{f(x - r * 0.4)}" cy="{f(y - r * 0.42)}" rx="{f(r * 0.34)}" ry="{f(r * 0.22)}" fill="#fff0dc" opacity="0.55"/>')


def leg(F, pts, ws, greave=False, far=False, ramp=SKIN_F, boot=False):
    """A bare leg hip -> knee -> ankle (optionally with a bronze greave or a leather boot):
    one smooth tube with the swell of the thigh and the calf."""
    hip, knee_, ank = pts
    tp = [hip, _mix(hip, knee_, 0.45), knee_, _mix(knee_, ank, 0.38), ank]
    tw = [ws[0], ws[0] * 0.98, ws[1], ws[1] * 1.08, ws[2]]
    d = F.tube(tp, tw, ramp)
    knee = pts[1]
    n = lit_normal(_tangents(pts)[1])
    F.art(f'<ellipse cx="{f(knee[0] + n[0] * ws[1] * 0.35)}" cy="{f(knee[1])}" rx="{f(ws[1] * 0.4)}" ry="{f(ws[1] * 0.55)}" fill="#fff0dc" opacity="0.16"/>'
          + stroke(spline([(pts[0][0] + n[0] * ws[0] * 0.7, pts[0][1] + 2), (knee[0] + n[0] * ws[1] * 0.75, knee[1]), (pts[2][0] + n[0] * ws[2] * 0.7, pts[2][1] - 1)]), RIM, 0.8, 0.32))
    if greave:
        top = _mix(pts[1], pts[0], 0.16)
        mid = _mix(pts[1], pts[2], 0.42)
        gp = [top, mid, _mix(pts[1], pts[2], 0.96)]
        gw = [ws[1] * 1.12, ws[1] * 1.14, ws[2] * 1.15]
        gd = F.tube(gp, gw, BRONZE_R, caps=(True, False))
        nn = lit_normal(_tangents(gp)[1])
        F.art(stroke(spline([(gp[0][0] + nn[0] * gw[0] * 0.5, gp[0][1] + 1.5), (gp[1][0] + nn[0] * gw[1] * 0.55, gp[1][1]), (gp[2][0] + nn[0] * gw[2] * 0.45, gp[2][1] - 0.8)]), "#fff6dc", 0.9, 0.85)
              + stroke(spline([(gp[0][0] - nn[0] * gw[0] * 0.15, gp[0][1] + 2.5), (gp[1][0] - nn[0] * gw[1] * 0.2, gp[1][1]), (gp[2][0] - nn[0] * gw[2] * 0.15, gp[2][1] - 1)]), "#5a3a1b", 0.6, 0.35)
              + f'<ellipse cx="{f(top[0] + nn[0] * gw[0] * 0.25)}" cy="{f(top[1] + 1.4)}" rx="{f(gw[0] * 0.55)}" ry="{f(gw[0] * 0.42)}" fill="#fff3d0" opacity="0.45"/>'
              + stroke(f"M{f(top[0] - gw[0] * 0.8)},{f(top[1] + 3.2)} Q{f(top[0])},{f(top[1] + 4.6)} {f(top[0] + gw[0] * 0.85)},{f(top[1] + 3)}", "#5a3a1b", 0.5, 0.45)
              + glint(gp[1][0] + nn[0] * gw[1] * 0.45, gp[1][1] - 1.5, 0.7))
    if boot:
        bp = [_mix(pts[1], pts[2], 0.3), _mix(pts[1], pts[2], 0.7), pts[2]]
        F.tube(bp, [ws[1] * 1.14, ws[2] * 1.42, ws[2] * 1.28], LEATHER, caps=(False, True))
        F.art(stroke(f"M{f(bp[0][0] - ws[1])},{f(bp[0][1] + 0.6)} L{f(bp[0][0] + ws[1])},{f(bp[0][1] + 0.2)}", "#3e2514", 0.9, 0.6))
    if far:
        F.art(f'<path d="{d}" fill="{SHADE}" opacity="0.16"/>')
    return d


def neck(F, x, y, w, ramp=SKIN_F):
    """Short neck below the head (x, y = top centre)."""
    F.tube([(x, y), (x + 0.4, y + 5)], [w, w * 1.08], ramp, caps=(False, False))
    F.art(f'<ellipse cx="{f(x + 0.8)}" cy="{f(y + 0.8)}" rx="{f(w * 1.1)}" ry="{f(w * 0.5)}" fill="{SHADE}" opacity="0.35"/>')


def chiton_skirt(F, x0, x1, ytop, yhem, ramp=LINEN, accent=False, folds=6):
    """The skirt of a short chiton / tunic hanging below the belt or the armour."""
    w = x1 - x0
    hem = [(x1 + 1.2, yhem - 0.5)]
    for i in range(folds + 1):
        t = 1 - i / folds
        hem.append((x0 - 1 + (w + 2.2) * t, yhem + (0.9 if i % 2 else -0.2)))
    d = spline([(x0, ytop), (x0 + w * 0.5, ytop - 0.4), (x1, ytop)], False) + " L" + " L".join(f"{f(px)},{f(py)}" for px, py in hem) + "Z"
    F.mass(d, cloth_grad(F.c, ACC_R if accent else ramp, "skirt" + ("acc" if accent else ramp[2][1][1:])), accent)
    lines = "".join(fold(f"M{f(x0 + w * t + 0.4)},{f(ytop + 1)} L{f(x0 + w * t + (t - 0.5) * 2.4)},{f(yhem - 0.3)}", 0.8, 0.2, 0.3) for t in [(i + 0.5) / folds for i in range(folds)])
    F.art(lines + f'<path d="M{f(x0)},{f(ytop)} L{f(x1)},{f(ytop)} L{f(x1)},{f(ytop + 2.4)} L{f(x0)},{f(ytop + 2.4)}Z" fill="{SHADE}" opacity="0.22"/>')
    return d


def pteruges(F, x0, x1, ytop, ybot, n=7):
    """The armour's skirt of leather strips (two rows), with dark gaps and lit edges."""
    g = cloth_grad(F.c, LEATHER, "pter", 0, 0, 1, 0.3)
    out = []
    for row, (yt, yb, off) in enumerate(((ytop + (ybot - ytop) * 0.25, ybot, 0.5), (ytop, ytop + (ybot - ytop) * 0.62, 0))):
        w = (x1 - x0) / n
        for i in range(n):
            sx = x0 + (i + off) * w - (w * 0.5 if off else 0)
            if sx + w > x1 + 1:
                continue
            spread = (i - n / 2) * 0.25
            out.append(f'<path d="M{f(sx + 0.3)},{f(yt)} L{f(sx + w - 0.3)},{f(yt)} L{f(sx + w - 0.2 + spread)},{f(yb - 1)} Q{f(sx + w / 2 + spread)},{f(yb + 0.9)} {f(sx + 0.2 + spread)},{f(yb - 1)}Z" fill="{g}"/>'
                       f'<path d="M{f(sx + 0.7)},{f(yt + 0.5)} L{f(sx + 0.7 + spread)},{f(yb - 1.2)}" stroke="#f0c48e" stroke-width="0.6" opacity="0.6"/>'
                       f'<circle cx="{f(sx + w / 2 + spread * 0.8)}" cy="{f(yb - 1.6)}" r="0.45" fill="#f0c67c"/>')
        out.append(f'<rect x="{f(x0)}" y="{f(yt)}" width="{f(x1 - x0)}" height="1.4" fill="{SHADE}" opacity="0.35"/>')
    F.art("".join(out))


def cuirass(F, pts, ramp=BRONZE_R):
    """A bronze muscle cuirass from a closed outline (shoulders -> waist)."""
    d = spline(pts, closed=True)
    g = F.c.rad("cuir", 0.3, 0.25, 0.9, [(0, ramp[1][1]), (0.35, ramp[2][1]), (0.75, ramp[3][1]), (1, ramp[4][1])], bbox=True)
    x0 = min(p[0] for p in pts)
    x1 = max(p[0] for p in pts)
    y0 = min(p[1] for p in pts)
    y1 = max(p[1] for p in pts)
    w, h = x1 - x0, y1 - y0
    F.mass(d, g)
    F.art(stroke(f"M{f(x0 + w * 0.2)},{f(y0 + h * 0.3)} Q{f(x0 + w * 0.4)},{f(y0 + h * 0.45)} {f(x0 + w * 0.55)},{f(y0 + h * 0.33)} Q{f(x0 + w * 0.7)},{f(y0 + h * 0.45)} {f(x0 + w * 0.88)},{f(y0 + h * 0.3)}", "#5a3a1b", 0.8, 0.5)
          + stroke(f"M{f(x0 + w * 0.55)},{f(y0 + h * 0.4)} L{f(x0 + w * 0.56)},{f(y1 - 2)}", "#5a3a1b", 0.7, 0.4)
          + stroke(f"M{f(x0 + 1.4)},{f(y0 + 2)} Q{f(x0 - 0.4)},{f(y0 + h * 0.5)} {f(x0 + 1.6)},{f(y1 - 1)}", "#fff6dc", 1.1, 0.75)
          + f'<rect x="{f(x0 + 1)}" y="{f(y1 - 1.6)}" width="{f(w - 2)}" height="1.6" fill="#5a3a1b" opacity="0.45"/>')
    return d


def shoulder_guard(F, pts, accent=False, ramp=BRONZE_R):
    """A rounded shoulder piece (bronze, or a linen flap in the owner colour)."""
    d = spline(pts, closed=True)
    fill = cloth_grad(F.c, ACC_R, "accflap") if accent else F.c.rad("shg", 0.3, 0.25, 0.9, [(0, ramp[1][1]), (0.4, ramp[2][1]), (0.8, ramp[3][1]), (1, ramp[4][1])], bbox=True)
    F.mass(d, fill, accent)
    p0, p1 = pts[0], pts[1]
    F.art(stroke(f"M{f(p0[0] + 0.6)},{f(p0[1] + 0.8)} Q{f((p0[0] + p1[0]) / 2)},{f(p0[1] - 0.6)} {f(p1[0] - 0.8)},{f(p1[1] + 0.6)}", "#fff6dc", 0.8, 0.75))
    return d


def spear(F, tip, butt, w=1.25, blade=11.0, spike=4.0):
    """A long spear: ash shaft, leaf-shaped bronze head at `tip`, bronze butt spike at `butt`."""
    ux, uy = _unit(butt[0] - tip[0], butt[1] - tip[1])
    nx, ny = -uy, ux
    b0 = (tip[0] + ux * blade, tip[1] + uy * blade)
    s0 = (butt[0] - ux * spike, butt[1] - uy * spike)
    F.tube([b0, s0], [w, w * 1.05], WOOD_R, caps=(False, False))
    # leaf blade with a midrib, socket ring
    wb = w * 2.3
    p = lambda t, s: (tip[0] + ux * blade * t + nx * s, tip[1] + uy * blade * t + ny * s)
    bl = spline([p(0, 0), p(0.3, wb * 0.75), p(0.62, wb), p(0.9, w * 0.8), p(1.05, 0), p(0.9, -w * 0.8), p(0.62, -wb), p(0.3, -wb * 0.75)], closed=True)
    g = across(F.c, p(0.5, wb if lit_normal((ux, uy)) == (nx, ny) else -wb), p(0.5, -wb if lit_normal((ux, uy)) == (nx, ny) else wb), BRONZE_R)
    m0, m1 = p(0.05, 0), p(1, 0)
    F.art(f'<path d="{bl}" fill="{g}"/>' + stroke(f"M{f(m0[0])},{f(m0[1])} L{f(m1[0])},{f(m1[1])}", "#6e4622", 0.5, 0.7)
          + stroke(f"M{f(p(0.25, wb * 0.4)[0])},{f(p(0.25, wb * 0.4)[1])} L{f(p(0.7, wb * 0.55)[0])},{f(p(0.7, wb * 0.55)[1])}", "#fffaf0", 0.5, 0.8))
    r0, r1 = p(1.02, w * 1.25), p(1.02, -w * 1.25)
    F.art(stroke(f"M{f(r0[0])},{f(r0[1])} L{f(r1[0])},{f(r1[1])}", "#8a5a2c", 1.3))
    # butt spike (sauroter)
    q = lambda t, s: (s0[0] + ux * spike * t + nx * s, s0[1] + uy * spike * t + ny * s)
    sp = poly([q(0, w * 1.15), q(0.35, w * 1.05), q(1, 0.2), q(1, -0.2), q(0.35, -w * 1.05), q(0, -w * 1.15)])
    F.art(f'<path d="{sp}" fill="{across(F.c, q(0.4, w), q(0.4, -w), BRONZE_DK)}"/>')


def staff(F, top, bottom, w=1.2, knob=True):
    """A wooden staff (traveller's or herdsman's), knob at the top."""
    F.tube([top, bottom], [w, w * 1.1], WOOD_R)
    if knob:
        F.art(f'<circle cx="{f(top[0])}" cy="{f(top[1])}" r="{f(w * 1.6)}" fill="{blob_grad(F.c, WOOD_R, "knob")}"/>')


def cloak_back(F, pts, folds=(), accent=True, ramp=WOOL):
    """A cloak hanging (or flying) behind the figure: soft folds, owner colour by default."""
    d = spline(pts, closed=True)
    g = cloth_grad(F.c, ACC_R if accent else ramp, "cloakacc" if accent else "cloak" + ramp[2][1][1:], 0, 0.1, 1, 0.9)
    F.mass(d, g, accent)
    F.art("".join(fold(fd, 1.3, 0.24, 0.3) for fd in folds))
    return d


# --- heads ------------------------------------------------------------------
def face(F, hx, hy, r, ramp=SKIN_F, beard=None, hair=True, hair_col=HAIR_R, brow=True, ear=True):
    """A head in 3/4 view facing left: skull, nose on the left contour, near eye, ear on the
    right, hair at the back. beard: None | "short" | "full". Returns the head outline."""
    k = r / 10.0
    P = lambda pts: _pts_scale(pts, hx, hy, k)
    skull = spline(P([(-8.6, -4), (-6, -9), (0, -10.6), (6.4, -8.6), (9.6, -3), (9.4, 3.4), (6.6, 8.2), (1.6, 10.6), (-3.6, 10.2), (-7.4, 7.6), (-9, 4.6), (-9.4, 2.4), (-10.6, 1.4), (-9.4, 0), (-9.2, -1.8)]), closed=True)
    g = blob_grad(F.c, ramp, "head" + ramp[2][1][1:], 0.3, 0.3, 0.85)
    F.art(f'<path d="{skull}" fill="{g}"/>')
    if hair:
        hp = spline(P([(-8.8, -3.6), (-7.6, -8), (-2, -11.4), (5, -10.8), (9.8, -6), (10.8, 0), (9.6, 5.8), (6.4, 7.2), (5.2, 2.6), (3.2, -1.6), (-1, -4.2), (-5.6, -4.4)]), closed=True)
        hg = blob_grad(F.c, hair_col, "hair" + hair_col[2][1][1:], 0.3, 0.2, 0.9)
        F.art(f'<path d="{hp}" fill="{hg}"/>' + stroke(spline(P([(-6.4, -6.6), (-2, -9.6), (3.6, -9.6)])), "#a07a58", 0.9 * k, 0.7)
              + stroke(spline(P([(2, -6.4), (5.6, -4.6), (7.6, -0.4)])), "#2a1a10", 0.7 * k, 0.5))
    if ear:
        ex, ey = hx + 4.4 * k, hy + 1 * k
        F.art(f'<ellipse cx="{f(ex)}" cy="{f(ey)}" rx="{f(1.9 * k)}" ry="{f(2.7 * k)}" fill="#c48a66"/><path d="M{f(ex - 0.6 * k)},{f(ey - 1.4 * k)} q{f(1.2 * k)},{f(1.2 * k)} 0,{f(2.6 * k)}" fill="none" stroke="#8a5440" stroke-width="{f(0.6 * k)}"/>')
    # eye, brow, nose shadow, mouth
    F.art(f'<ellipse cx="{f(hx - 4.4 * k)}" cy="{f(hy - 0.6 * k)}" rx="{f(1.3 * k)}" ry="{f(1.5 * k)}" fill="#2a1d14"/>'
          f'<circle cx="{f(hx - 4.8 * k)}" cy="{f(hy - 1.1 * k)}" r="{f(0.45 * k)}" fill="#fff"/>'
          + (stroke(f"M{f(hx - 7.4 * k)},{f(hy - 3.4 * k)} Q{f(hx - 4.6 * k)},{f(hy - 4.8 * k)} {f(hx - 1.8 * k)},{f(hy - 3.6 * k)}", "#4a3222", 1.0 * k, 0.9) if brow else "")
          + stroke(f"M{f(hx - 9.4 * k)},{f(hy + 0.2 * k)} Q{f(hx - 8.2 * k)},{f(hy + 2.2 * k)} {f(hx - 7)},{f(hy + 2.6 * k)}", "#9a5e44", 0.8 * k, 0.7)
          + f'<ellipse cx="{f(hx - 2.4 * k)}" cy="{f(hy + 3 * k)}" rx="{f(2.4 * k)}" ry="{f(1.6 * k)}" fill="#e88a70" opacity="0.35"/>'
          + stroke(f"M{f(hx - 7.6 * k)},{f(hy + 5.4 * k)} q{f(1.6 * k)},{f(0.6 * k)} {f(2.8 * k)},{f(0.2 * k)}", "#8a4a38", 0.8 * k, 0.8)
          + stroke(spline(P([(-8.2, -3.6), (-9, 0.6), (-8, 6.4), (-5, 9.4)])), RIM, 0.9 * k, 0.6))
    if beard:
        bd = [(-9.2, 3.6), (-8.8, 8.6), (-6, 12.4), (-1.4, 13.6) if beard == "full" else (-2, 11.8), (3, 11.6) if beard == "full" else (2.6, 10.6), (6.2, 8), (6.6, 4.4), (4.2, 5.4), (1, 7.2), (-3.4, 7), (-6.6, 5)]
        bdd = spline(P(bd), closed=True)
        F.art(f'<path d="{bdd}" fill="{blob_grad(F.c, hair_col, "beard" + hair_col[2][1][1:], 0.3, 0.2, 0.9)}"/>'
              + stroke(spline(P([(-7.4, 6.4), (-6.6, 9.6), (-3.6, 11.6)])), "#a07a58", 0.7 * k, 0.7)
              + stroke(f"M{f(hx - 7.6 * k)},{f(hy + 5.6 * k)} q{f(1.6 * k)},{f(0.6 * k)} {f(2.8 * k)},{f(0.2 * k)}", "#2a1a10", 0.8 * k, 0.9))
    return skull


def corinthian(F, hx, hy, r, crest=True, crest_accent=True, crest_style="tall"):
    """Head in a bronze Corinthian helmet (3/4 view facing left) with a horsehair crest.
    The crest is owner colour when crest_accent."""
    k = r / 11.0
    P = lambda pts: _pts_scale(pts, hx, hy, k)
    c = F.c
    if crest:
        # crest behind the helmet top: tall horsehair fan from the brow to the nape
        cp = P([(-8.4, -12), (-10.2, -18.6), (-6.4, -25.4), (2, -28.2), (10.6, -25), (16, -17.6), (18.2, -9), (18, -2.6), (15.4, -4.8), (13.4, -10.4), (9.4, -14.6), (2, -16.2), (-4.4, -14.6)])
        cd = spline(cp, closed=True)
        F.mass(cd, cloth_grad(c, ACC_R if crest_accent else BRONZE_DK, "crest" + ("a" if crest_accent else "b"), 0.1, 0, 0.9, 1), crest_accent)
        strands = "".join(stroke(spline(P(s)), SHADE, 0.6 * k, 0.28) for s in (
            [(-6.6, -15.6), (-6.8, -21.6), (-1.4, -25.6), (6.6, -25), (12.6, -19.6), (15.6, -11), (16.4, -3)],
            [(-3.8, -15.4), (-3, -20.6), (2.4, -23), (8.6, -21.6), (13, -15.6), (14.6, -8)],
            [(0, -16), (1.6, -19.4), (6.6, -19.6), (10.6, -16.6)]))
        F.art(strands + stroke(spline(P([(-8.6, -14.6), (-8.4, -20.6), (-3.6, -25.6), (3, -26.8)])), "#fff", 1.1 * k, 0.45)
              + f'<path d="{cd}" fill="none" stroke="{SHADE}" stroke-width="{f(0.5 * k)}" opacity="0.25"/>')
        # crest holder
        F.art(f'<path d="{poly(P([(-4, -11.6), (6.6, -11.8), (7.6, -14.4), (-4.6, -14.2)]))}" fill="#8a5a2c"/>')
    outline = P([(-11.6, -3), (-10.4, -8.4), (-5.2, -11.9), (1, -12.7), (7.2, -11), (10.8, -6.4), (11.8, -0.6), (11.2, 3.4), (12.6, 7.6), (14.6, 10.8), (11.4, 11), (8.2, 8.8), (5.8, 7), (4.6, 9.8), (2.2, 12.6), (-3, 13.6), (-7.4, 13.2), (-8.9, 9), (-9.6, 4.6), (-11.6, 2.8), (-12.9, 0.6)])
    hd = spline(outline, closed=True)
    g = c.rad("helm", 0.32, 0.22, 0.85, [(0, "#fff3d0"), (0.18, "#f2cc84"), (0.45, "#cf9a52"), (0.78, "#8e5c2c"), (1, "#5a3a1b")], bbox=True)
    F.art(f'<path d="{hd}" fill="{g}"/>')
    # eye opening and the slit between the cheek guards (dark), the face inside
    eye = spline(P([(-12.4, -1.2), (-9.4, -3.4), (-5.6, -3.6), (-3, -2.2), (-5, -0.4), (-9, 0.2)]), closed=True)
    slit = spline(P([(-11.4, 1.6), (-9.6, 2.6), (-9.6, 7.4), (-8.6, 12.6), (-10.2, 12.4), (-10.6, 7.4)]), closed=True)
    F.art(f'<path d="{eye}" fill="#21160e"/><path d="{slit}" fill="#2a1a10"/>'
          f'<ellipse cx="{f(hx - 7.6 * k)}" cy="{f(hy - 1.6 * k)}" rx="{f(1 * k)}" ry="{f(0.8 * k)}" fill="#e8d0b0" opacity="0.8"/>')
    # brow ridge, nose guard, rim band, neck-guard flare, highlights
    F.art(stroke(spline(P([(-12.2, -2.6), (-8.4, -5.2), (-3.6, -4.8), (0.6, -2.6)])), "#fff4d6", 1.0 * k, 0.8)
          + stroke(spline(P([(-12, -0.6), (-8.6, -1.8), (-4, -1.4)])), "#5a3a1b", 0.7 * k, 0.5)
          + stroke(spline(P([(-8.2, 12), (-3, 12.4), (1.6, 11.4), (4, 8.6), (5.8, 6), (8.4, 7.8), (11.6, 9.9), (13.8, 10.4)])), "#5a3a1b", 1.1 * k, 0.6)
          + "".join(glint(*P([(px, py)])[0], 0.42 * k, 0.8, "#fff2c8") for px, py in ((-6, 11.2), (-1.4, 11.4), (2.4, 10), (9.6, 9.2)))
          + stroke(spline(P([(3.6, 6.2), (7.4, 3.8), (9.6, -1)])), "#5a3a1b", 0.8 * k, 0.4)
          + stroke(spline(P([(-9.2, -7.4), (-5, -10.6), (0.6, -11.6)])), "#fffaf0", 1.3 * k, 0.9)
          + glint(*P([(-6.4, -8.4)])[0], 0.9 * k, 0.95))
    # a tuft of beard below the cheek guards
    F.art(f'<path d="{spline(P([(-9.6, 12.4), (-6.4, 12.6), (-6.8, 15.4), (-9.2, 16)]), closed=True)}" fill="#3e2a1c"/>')
    return hd


def aspis(F, cx, cy, rx, ry, rot=-6.0, blazon="sun", rim=2.8):
    """The big round hoplite shield in 3/4 view: bronze rim, painted field (owner colour) with a
    cream blazon, the bowl's depth showing as a crescent on the right."""
    c = F.c
    # bowl depth (behind) and soft shadow on the body
    F.art(f'<ellipse cx="{f(cx + 3.4)}" cy="{f(cy + 0.8)}" rx="{f(rx)}" ry="{f(ry)}" transform="rotate({f(rot)} {f(cx + 3.4)} {f(cy + 0.8)})" fill="#4a2e14"/>'
          f'<ellipse cx="{f(cx + 2.6)}" cy="{f(cy + 0.6)}" rx="{f(rx)}" ry="{f(ry)}" transform="rotate({f(rot)} {f(cx + 2.6)} {f(cy + 0.6)})" fill="#7a5226"/>')
    rimg = c.lin("aspisrim", 0.1, 0, 0.9, 1, [(0, "#fff0c4"), (0.25, "#e4b26a"), (0.6, "#a8743a"), (1, "#5e3c1c")], bbox=True)
    F.art(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" transform="rotate({f(rot)} {f(cx)} {f(cy)})" fill="{rimg}"/>')
    fx, fy = rx - rim, ry - rim
    fg = c.rad("aspisf", 0.36, 0.3, 0.8, [(0, ACCENT["lit"]), (0.5, ACCENT["lit"]), (0.82, ACCENT["light"]), (1, ACCENT["mid"])], bbox=True)
    F.acc(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(fx)}" ry="{f(fy)}" transform="rotate({f(rot)} {f(cx)} {f(cy)})" fill="{fg}"/>')
    # rim mouldings and light
    tf = f'transform="rotate({f(rot)} {f(cx)} {f(cy)})"'
    F.art(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(fx + 0.2)}" ry="{f(fy + 0.2)}" {tf} fill="none" stroke="#4a2e14" stroke-width="0.7" opacity="0.7"/>'
          f'<g {tf}><path d="M{f(cx - rx + 0.7)},{f(cy - 1)} A{f(rx - 0.7)},{f(ry - 0.7)} 0 0 1 {f(cx + rx * 0.35)},{f(cy - ry + 0.9)}" fill="none" stroke="#fffaf0" stroke-width="0.9" opacity="0.9"/>'
          f'<path d="M{f(cx + rx - 0.9)},{f(cy + 2)} A{f(rx - 0.9)},{f(ry - 0.9)} 0 0 1 {f(cx - rx * 0.3)},{f(cy + ry - 1)}" fill="none" stroke="#3a2410" stroke-width="1" opacity="0.55"/>'
          + "".join(f'<circle cx="{f(cx + (rx - rim / 2) * math.cos(t))}" cy="{f(cy + (ry - rim / 2) * math.sin(t))}" r="0.5" fill="{"#fff6d8" if math.cos(t + 0.8) < 0 else "#5a3a1b"}" opacity="0.8"/>' for t in [i * math.pi / 9 for i in range(18)])
          + "</g>")
    # blazon
    if blazon == "sun":
        pts_ = []
        for i in range(32):
            a = -math.pi / 2 + i * math.pi / 16
            r = (0.62 if i % 4 == 0 else 0.5) if i % 2 == 0 else 0.2
            pts_.append((r * math.cos(a), r * math.sin(a)))
        star = poly([(x * fy, y * fy) for x, y in pts_])
        sx = rx / ry
        g = f'transform="translate({f(cx)} {f(cy)}) rotate({f(rot)}) scale({f(sx)} 1)"'
        F.art(f'<g {g}><path d="{star}" fill="#3a2410" opacity="0.3" transform="translate(0.8 0.8)"/><path d="{star}" fill="#f6ecd4"/>'
              f'<circle r="{f(fy * 0.17)}" fill="#f6ecd4"/><circle r="{f(fy * 0.12)}" fill="#d9a35a"/><circle cx="{f(-fy * 0.04)}" cy="{f(-fy * 0.04)}" r="{f(fy * 0.05)}" fill="#fff6d8"/></g>')
    # gloss on the painted field
    F.art(f'<g {tf}><path d="M{f(cx - fx * 0.82)},{f(cy - fy * 0.1)} A{f(fx * 0.85)},{f(fy * 0.85)} 0 0 1 {f(cx - fx * 0.05)},{f(cy - fy * 0.85)} A{f(fx * 0.95)},{f(fy * 1.05)} 0 0 0 {f(cx - fx * 0.82)},{f(cy - fy * 0.1)}Z" fill="#fff" opacity="0.22"/></g>')
    return ellipse_d(cx, cy, rx, ry, rot)


def foot(F, ankle, toe, boot=False, far=False, ramp=SKIN_F, h=2.6):
    """A foot in a leather sandal (or a laced boot) from the ankle to the toe tip, at any angle
    (flat on the ground, heel raised, pointing down in a running stride)."""
    ax, ay = ankle
    dx, dy = toe[0] - ax, toe[1] - ay
    mirror = dx < 0
    dist = math.hypot(dx, dy)
    L = math.sqrt(max(dist * dist - h * h, 4.0))
    ang = math.degrees(math.atan2(dy, abs(dx)) - math.atan2(h, L))
    tf = f"translate({f(ax)} {f(ay)})" + (" scale(-1 1)" if mirror else "") + f" rotate({f(ang)})"
    shape = spline([(1.5, -1.0), (L * 0.5, h * 0.25), (L - 0.8, h - 1.7), (L + 0.2, h - 0.3), (L * 0.55, h + 0.3), (-2.2, h + 0.15), (-3.0, h - 1.3), (-2.4, -1.0)], closed=True)
    g = cloth_grad(F.c, LEATHER if boot else ramp, ("bootg" if boot else "footg") + ramp[2][1][1:], 0, 0, 0.9, 1)
    out = [f'<path d="{shape}" fill="{g}"/>', stroke(f"M-2.8,{f(h + 0.3)} Q{f(L * 0.4)},{f(h + 1.1)} {f(L + 0.5)},{f(h)}", "#3e2514", 1.3)]
    if boot:
        out.append(stroke(f"M-2.6,{f(-0.6)} L1.8,-1.4", "#3e2514", 0.8, 0.7) + stroke(f"M0.2,{f(h * 0.2)} L{f(L * 0.45)},{f(h * 0.1)}", "#e2ad74", 0.6, 0.6))
    else:
        out.append(stroke("M-2.4,0.4 L2.2,-0.6", "#5e3b22", 0.8, 0.9) + stroke(f"M{f(L * 0.42)},{f(h * 0.15)} L{f(L * 0.5)},{f(h + 0.1)}", "#5e3b22", 0.7, 0.85))
    out.append(stroke(f"M0.4,-0.9 Q{f(L * 0.5)},{f(h * 0.05)} {f(L - 0.9)},{f(h - 1.6)}", RIM, 0.6, 0.45))
    if far:
        out.append(f'<path d="{shape}" fill="{SHADE}" opacity="0.15"/>')
    F.art(f'<g transform="{tf}">{"".join(out)}</g>')


def garment(F, pts, accent=False, ramp=LINEN, folds=(), name="garm", hem=None, border="#f3e6c4", legs=(), neck=None):
    """A tunic / chiton / exomis body from a closed outline, cloth-shaded, with painted folds.
    hem: points along the hem - a darker underside, an embroidered border band (border colour,
    None for none) and a soft shadow of the hem on the legs (legs = their outlines; draw the
    legs BEFORE the garment so the hem hangs over the thighs). neck: (x, y) of the neck base -
    the head's soft shadow on the shoulders."""
    d = spline(pts, closed=True)
    g = cloth_grad(F.c, ACC_R if accent else ramp, name + ("acc" if accent else ramp[2][1][1:]), 0, 0.1, 1, 0.9)
    F.mass(d, g, accent)
    F.art("".join(fold(fd, 1.1, 0.22, 0.3) for fd in folds))
    if hem:
        F.paint_in(d, stroke(spline(hem), SHADE, 2.4), 0.3, blur=0.6)
        if border:
            up = [(x, y - 1.7) for x, y in hem]
            F.paint_in(d, stroke(spline(up), border, 1.5, 0.95) + stroke(spline([(x, y - 0.65) for x, y in up]), SHADE, 0.45, 0.5)
                       + stroke(spline([(x, y + 0.75) for x, y in up]), SHADE, 0.45, 0.5))
            n = int(abs(hem[-1][0] - hem[0][0]) / 2.6)
            dots = []
            for i in range(n + 1):
                t = i / n
                j = min(int(t * (len(up) - 1)), len(up) - 2)
                tt = t * (len(up) - 1) - j
                px, py = up[j][0] + (up[j + 1][0] - up[j][0]) * tt, up[j][1] + (up[j + 1][1] - up[j][1]) * tt
                dots.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="0.42" fill="#7a3a2a"/>')
            F.paint_in(d, "".join(dots), 0.8)
        for ld in legs:
            F.paint_in(ld, stroke(spline([(x, y + 2.6) for x, y in hem]), SHADE, 5.0, 0.16) + stroke(spline([(x, y + 1.4) for x, y in hem]), SHADE, 2.4, 0.28))
    if neck:
        nx, ny = neck
        F.paint_in(d, f'<ellipse cx="{f(nx + 2)}" cy="{f(ny + 1.6)}" rx="7" ry="3.4" fill="{SHADE}"/>', 0.3, blur=1.2)
    return d


def belt(F, pts, w=1.5, col="#6a4426"):
    """A leather belt / girdle along pts with a lit upper edge and a bronze buckle."""
    F.art(stroke(spline(pts), col, w * 2) + stroke(spline([(x, y - w * 0.6) for x, y in pts]), "#b07c4a", 0.6, 0.9))
    mx, my = pts[len(pts) // 2]
    F.art(f'<rect x="{f(mx - 1.3)}" y="{f(my - 1.6)}" width="2.6" height="3.2" rx="0.6" fill="#d9a35a"/><rect x="{f(mx - 1.3)}" y="{f(my - 1.6)}" width="1" height="3.2" fill="#fff2cc" opacity="0.7"/>')


def bare_shoulder(F, pts, ws):
    """Bare skin of a shoulder / chest (exomis leaves one shoulder bare)."""
    return F.tube(pts, ws, SKIN_F)


def pilos(F, hx, hy, r, accent=False):
    """Conical bronze pilos helmet over a face (3/4 view, facing left)."""
    k = r / 10.0
    P = lambda pts: _pts_scale(pts, hx, hy, k)
    cone = spline(P([(-10.8, -3.4), (-9.6, -9), (-6, -16), (-1.4, -22.6), (1.4, -24.4), (3.2, -22.4), (7.6, -15.6), (10.6, -8.4), (11.6, -3.2), (6, -5.6), (-4, -5.6)]), closed=True)
    g = F.c.rad("pilosg", 0.3, 0.3, 0.85, [(0, "#fff3d0"), (0.2, "#f0c67c"), (0.5, "#c99048"), (0.85, "#82552a"), (1, "#5a3a1b")], bbox=True)
    F.mass(cone, cloth_grad(F.c, ACC_R, "pilacc") if accent else g, accent)
    rim = spline(P([(-11.4, -3.4), (-6, -6.4), (1, -6.8), (7, -6), (12, -3.2), (11.8, -1.4), (6.4, -3.8), (0.6, -4.6), (-5.6, -4.2), (-11.2, -1.6)]), closed=True)
    F.art(f'<path d="{rim}" fill="#8a5a2c"/>' + stroke(spline(P([(-11, -3), (-5.8, -5.8), (1, -6.2), (7, -5.4), (11.6, -3)])), "#f6d496", 0.8 * k, 0.8)
          + stroke(spline(P([(-8, -8.6), (-5, -14.6), (-0.8, -21)])), "#fffaf0", 1.2 * k, 0.85) + glint(*P([(-6.2, -11.6)])[0], 0.8 * k, 0.9)
          + stroke(spline(P([(4.6, -18.4), (8, -11.6), (9.8, -6.4)])), "#4e3216", 0.8 * k, 0.35))
    return cone


def petasos(F, hx, hy, r, tilt=-8.0, ramp=FELT, accent_band=False):
    """The wide-brimmed traveller's hat (felt), seen a little from above, tilted forward."""
    k = r / 10.0
    c = F.c
    t = f'transform="translate({f(hx)} {f(hy)}) rotate({f(tilt)}) scale({f(k)})"'
    brim_g = c.lin("brim", 0, 0, 1, 1, [(0, ramp[1][1]), (0.45, ramp[2][1]), (1, ramp[3][1])], bbox=True)
    crown_g = blob_grad(c, ramp, "crown" + ramp[2][1][1:], 0.3, 0.25, 0.85)
    F.art(f'<g {t}><ellipse cx="0.6" cy="-6.2" rx="19.6" ry="6.6" fill="{SHADE}" opacity="0.25" transform="translate(1 2)"/>'
          f'<ellipse cx="0.6" cy="-6.2" rx="19.6" ry="6.6" fill="{brim_g}"/>'
          f'<ellipse cx="0.6" cy="-6.2" rx="19.6" ry="6.6" fill="none" stroke="{ramp[0][1]}" stroke-width="0.9" opacity="0.7" stroke-dasharray="20 120"/>'
          f'<path d="M-17,-3.2 Q0.6,3.6 18.6,-3.6" fill="none" stroke="{ramp[4][1]}" stroke-width="1.2" opacity="0.6"/>'
          f'<path d="M-7.6,-7.6 C-8,-14.6 -3.4,-17.4 1,-17.4 C6,-17.4 9.8,-14.6 9.4,-7.6 C6,-5.6 -4.4,-5.6 -7.6,-7.6Z" fill="{crown_g}"/>'
          f'<path d="M-6,-10.6 C-5.6,-14 -2.4,-15.8 0.6,-16" fill="none" stroke="#fff" stroke-width="1" opacity="0.55"/></g>')
    band = f'<g {t}><path d="M-7.7,-8.6 C-4,-6.6 6,-6.6 9.5,-8.6 L9.4,-6.6 C6,-4.8 -4,-4.8 -7.6,-6.6Z" fill="{grad(c, "uacc", CLOTH_ACCENT) if accent_band else "#6a4426"}"/></g>'
    if accent_band:
        F.c.accent(F.g(band))
    else:
        F.art(band)


def scythian_cap(F, hx, hy, r, ramp=LEATHER, accent=False):
    """Soft pointed cap (kyrbasia) with the tip flopping forward and lappets over the ears."""
    k = r / 10.0
    P = lambda pts: _pts_scale(pts, hx, hy, k)
    cap = spline(P([(-10.6, -2.4), (-10.8, -8), (-9.8, -12.4), (-11.4, -15.6), (-14.6, -17), (-13, -20.4), (-6.4, -22.4), (0.6, -21.4), (6.6, -17.4), (10, -11), (11.2, -4), (11.6, 3), (10.8, 9.4), (7.8, 12.6), (5.4, 8), (4.6, 1.4), (0.4, -3.4), (-5.6, -4.6)]), closed=True)
    F.mass(cap, cloth_grad(F.c, ACC_R if accent else ramp, "scyth" + ("a" if accent else ramp[2][1][1:]), 0, 0, 1, 1), accent)
    F.art(stroke(spline(P([(-9.2, -6.6), (-8.2, -12.6), (-7.4, -18.6), (-3, -22.4), (2, -22)])), "#fff", 1.0 * k, 0.4)
          + stroke(spline(P([(-9.6, -15.6), (-7, -17.6), (-3, -18.4)])), SHADE, 0.9 * k, 0.4)
          + stroke(spline(P([(-10, -3.6), (-4, -5.6), (2.6, -4.4), (5.6, -1.2)])), SHADE, 1.0 * k, 0.35)
          + stroke(spline(P([(3, -16.6), (7, -11), (8.4, -3), (8.6, 6)])), SHADE, 0.8 * k, 0.25)
          + stroke(spline(P([(-10.4, -5.4), (-3.6, -7.4), (3.6, -6.6), (9.6, -3.4)])), "#d9a35a", 0.9 * k, 0.8)
          + fold(spline(P([(-4, -6), (-2.6, -11), (0.6, -15.4)])), 0.8 * k, 0.22, 0.25) + fold(spline(P([(3, -5), (5.4, -9), (6.4, -13)])), 0.8 * k, 0.22, 0.25))
    return cap


def round_shield(F, cx, cy, rx, ry, rot=-8.0, accent=True):
    """A small round shield (light infantry): painted field (owner colour), bronze rim and boss."""
    c = F.c
    tf = f'transform="rotate({f(rot)} {f(cx)} {f(cy)})"'
    F.art(f'<ellipse cx="{f(cx + 1.8)}" cy="{f(cy + 0.5)}" rx="{f(rx)}" ry="{f(ry)}" transform="rotate({f(rot)} {f(cx + 1.8)} {f(cy + 0.5)})" fill="#5e3c1c"/>')
    rimg = c.lin("aspisrim", 0.1, 0, 0.9, 1, [(0, "#fff0c4"), (0.25, "#e4b26a"), (0.6, "#a8743a"), (1, "#5e3c1c")], bbox=True)
    F.art(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" {tf} fill="{rimg}"/>')
    fx, fy = rx - 1.9, ry - 1.9
    fg = c.rad("aspisf", 0.36, 0.3, 0.8, [(0, ACCENT["lit"]), (0.5, ACCENT["lit"]), (0.82, ACCENT["light"]), (1, ACCENT["mid"])], bbox=True)
    F.put(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(fx)}" ry="{f(fy)}" {tf} fill="{fg if accent else rimg}"/>', accent)
    boss = blob_grad(c, BRONZE_R, "boss")
    F.art(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(fx + 0.2)}" ry="{f(fy + 0.2)}" {tf} fill="none" stroke="#4a2e14" stroke-width="0.6" opacity="0.7"/>'
          f'<g {tf}><path d="M{f(cx - rx + 0.6)},{f(cy - 1)} A{f(rx - 0.6)},{f(ry - 0.6)} 0 0 1 {f(cx + rx * 0.3)},{f(cy - ry + 0.7)}" fill="none" stroke="#fffaf0" stroke-width="0.8" opacity="0.9"/>'
          + "".join(f'<circle cx="{f(cx + fx * 0.62 * math.cos(t))}" cy="{f(cy + fy * 0.62 * math.sin(t))}" r="0.55" fill="#f6ecd4"/>' for t in [i * math.pi / 4 for i in range(8)])
          + f'<ellipse cx="{f(cx + 0.4)}" cy="{f(cy + 0.5)}" rx="{f(fx * 0.32)}" ry="{f(fy * 0.32)}" fill="#3a2410" opacity="0.4"/>'
          f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(fx * 0.3)}" ry="{f(fy * 0.3)}" fill="{boss}"/>'
          + glint(cx - fx * 0.1, cy - fy * 0.12, 0.6) +
          f'<path d="M{f(cx - fx * 0.8)},{f(cy - fy * 0.1)} A{f(fx * 0.85)},{f(fy * 0.85)} 0 0 1 {f(cx - fx * 0.05)},{f(cy - fy * 0.85)} A{f(fx * 0.95)},{f(fy * 1.05)} 0 0 0 {f(cx - fx * 0.8)},{f(cy - fy * 0.1)}Z" fill="#fff" opacity="0.2"/></g>')
    return ellipse_d(cx, cy, rx, ry, rot)


def bow(F, grip, top, bottom, string_to=None, w=1.4):
    """A recurved composite bow: grip, limb tips; string drawn back to string_to (or straight)."""
    gx, gy = grip
    bulge = -5.5
    up = [top, (top[0] - 2.4, top[1] + 3), ((top[0] + gx) / 2 + bulge, (top[1] + gy) / 2), (gx, gy)]
    dn = [(gx, gy), ((bottom[0] + gx) / 2 + bulge, (bottom[1] + gy) / 2), (bottom[0] - 2.4, bottom[1] - 3), bottom]
    s_to = string_to or ((top[0] + bottom[0]) / 2 + 1, gy)
    F.art(stroke(f"M{f(top[0])},{f(top[1])} L{f(s_to[0])},{f(s_to[1])} L{f(bottom[0])},{f(bottom[1])}", "#f6ecd2", 0.6, 0.95))
    for limb in (up, dn):
        F.art(stroke(spline(limb), "#4a2c16", w * 2.1) + stroke(spline(limb), "#a8744a", w * 0.9, 0.9)
              + stroke(spline([(x - 0.5, y) for x, y in limb]), "#e8c08a", w * 0.4, 0.8))
    F.art(f'<rect x="{f(gx - 1.6)}" y="{f(gy - 3)}" width="3.2" height="6" rx="1" fill="#2e1c10"/>'
          + glint(top[0], top[1], 0.9, 1, "#d9a35a") + glint(bottom[0], bottom[1], 0.9, 1, "#d9a35a"))


def arrow(F, nock, head, fletch=True):
    """An arrow from the nock to the bronze head."""
    ux, uy = _unit(head[0] - nock[0], head[1] - nock[1])
    nx, ny = -uy, ux
    F.art(stroke(f"M{f(nock[0])},{f(nock[1])} L{f(head[0])},{f(head[1])}", "#8a6440", 1.0))
    hp = poly([(head[0] + ux * 3.2, head[1] + uy * 3.2), (head[0] + nx * 1.3, head[1] + ny * 1.3), (head[0] - ux * 0.6, head[1] - uy * 0.6), (head[0] - nx * 1.3, head[1] - ny * 1.3)])
    F.art(f'<path d="{hp}" fill="#c99450"/>')
    if fletch:
        fx, fy = nock[0] + ux * 1.2, nock[1] + uy * 1.2
        F.art(f'<path d="M{f(fx)},{f(fy)} l{f(ux * 4 + nx * 1.6)},{f(uy * 4 + ny * 1.6)} l{f(-nx * 1.6)},{f(-ny * 1.6)}Z" fill="#c8392f"/>'
              f'<path d="M{f(fx)},{f(fy)} l{f(ux * 4 - nx * 1.6)},{f(uy * 4 - ny * 1.6)} l{f(nx * 1.6)},{f(ny * 1.6)}Z" fill="#f2ead6"/>')


def quiver(F, bottom, top, r=3.6, arrows=4):
    """A leather quiver slung on the back, arrows sticking out at the top."""
    ux, uy = _unit(top[0] - bottom[0], top[1] - bottom[1])
    nx, ny = -uy, ux
    out = []
    for i in range(arrows):
        s = (i - (arrows - 1) / 2) * r * 0.5
        bx, by = top[0] + nx * s, top[1] + ny * s
        ex, ey = bx + ux * (6 + (i % 2) * 2) + nx * s * 0.3, by + uy * (6 + (i % 2) * 2) + ny * s * 0.3
        out.append(stroke(f"M{f(bx)},{f(by)} L{f(ex)},{f(ey)}", "#7a5a3a", 0.8)
                   + f'<path d="M{f(ex - ux * 3.6)},{f(ey - uy * 3.6)} l{f(ux * 4 + nx * 1.4)},{f(uy * 4 + ny * 1.4)} l{f(-nx * 2.8)},{f(-ny * 2.8)}Z" fill="{"#f2ead6" if i % 2 else "#c8392f"}"/>')
    F.art("".join(out))
    F.tube([bottom, top], [r * 0.9, r], LEATHER, caps=(True, False))
    F.art(f'<ellipse cx="{f(top[0])}" cy="{f(top[1])}" rx="{f(r)}" ry="{f(r * 0.45)}" transform="rotate({f(math.degrees(math.atan2(ny, nx)))} {f(top[0])} {f(top[1])})" fill="#3e2514"/>'
          + "".join(stroke(f"M{f(bottom[0] + ux * d_ + nx * r * 0.9)},{f(bottom[1] + uy * d_ + ny * r * 0.9)} L{f(bottom[0] + ux * d_ - nx * r * 0.9)},{f(bottom[1] + uy * d_ - ny * r * 0.9)}", "#d9a35a", 0.8, 0.9)
                    for d_ in (3, math.hypot(top[0] - bottom[0], top[1] - bottom[1]) - 3)))


# ---------------------------------------------------------------------------
# Animals in profile, facing screen-left (local units: hooves at y = 0, x grows toward the tail)
# ---------------------------------------------------------------------------
HORSE_LEG = [(0, "#d89a62"), (0.12, "#b8743e"), (0.42, "#8e5026"), (0.78, "#5e3014"), (0.93, "#3e1e0a"), (1, "#6a4434")]
HORSE_R = [(0, "#f6c088"), (0.12, "#dc9658"), (0.42, "#ad6632"), (0.78, "#743d1a"), (0.93, "#4a250e"), (1, "#7a5242")]
DONKEY_R = [(0, "#e6dccc"), (0.12, "#c9bcaa"), (0.42, "#9d9080"), (0.78, "#6e6458"), (0.93, "#4c443c"), (1, "#7a726a")]
SACK_R = [(0, "#fffaf0"), (0.12, "#f2e6cc"), (0.42, "#dccba6"), (0.78, "#a8946e"), (0.93, "#7a6a4e"), (1, "#9a9080")]


def _animal_leg(F, pts, ws, ramp, hoof_col="#2a1d14", sock=None, far=False):
    """One animal leg (upper -> joint -> fetlock -> hoof point) with a hoof and optional sock."""
    d = F.tube(pts, ws, ramp)
    hx, hy = pts[-1]
    ux, uy = _unit(pts[-1][0] - pts[-2][0], pts[-1][1] - pts[-2][1])
    w = ws[-1] * 1.25
    hoof = poly([(hx - uy * w - ux * 0.6, hy + ux * w - uy * 0.6), (hx + uy * w - ux * 0.6, hy - ux * w - uy * 0.6), (hx + uy * w * 1.15 + ux * 2.6, hy - ux * w * 1.15 + uy * 2.6), (hx - uy * w * 1.15 + ux * 2.6, hy + ux * w * 1.15 + uy * 2.6)])
    if sock:
        sp = [_mix(pts[-2], pts[-1], 0.35), pts[-1]]
        F.tube(sp, [ws[-2] * 0.98 + 0.05, ws[-1] * 1.02], sock, caps=(True, False))
    F.art(f'<path d="{hoof}" fill="{hoof_col}"/>' + stroke(f"M{f(hx - uy * w + ux * 2.2)},{f(hy + ux * w + uy * 2.2)} L{f(hx + uy * w + ux * 2.2)},{f(hy - ux * w + uy * 2.2)}", "#6a5040", 0.6, 0.8))
    if far:
        F.art(f'<path d="{d}" fill="#1a1008" opacity="0.22"/>')
    return d


def horse(c, x, y, k=1.0, ramp=HORSE_R, leg_ramp=HORSE_LEG, mane="#2b1a10", saddle=True, saddle_accent=True):
    """A proud horse mid-stride (trot: near fore and far hind raised), facing left. (x, y) = the
    ground point under the middle of the body. Returns a dict of anchor points in canvas
    coordinates: seat, mouth (for the reins), flank (where a rider's leg hangs)."""
    F = Fig(c, x, y, k)
    dark = "#3a2214"
    sock = [(0, "#ffffff"), (0.2, "#f6f0e4"), (0.6, "#dcd2c0"), (1, "#a49a8a")]
    # far legs (behind the body, darker)
    _animal_leg(F, [(-19, -29), (-21.4, -17.6), (-22, -8.6), (-22.6, -1.6)], [4.4, 2.9, 2.2, 2.4], leg_ramp, far=True)
    _animal_leg(F, [(16, -32), (23.4, -19.6), (25.2, -13.6), (21.6, -6.6), (19.6, -3.4)], [5.8, 4, 2.9, 2.2, 2.4], leg_ramp, far=True)
    # tail
    tail = spline([(25.6, -44), (31, -42.6), (36.4, -35), (38.6, -25), (36, -15.6), (33.4, -12), (34, -20), (31.6, -28), (28, -35), (24.4, -39)], closed=True)
    F.art(f'<path d="{tail}" fill="{blob_grad(c, HAIR_R, "tail")}"/>' + stroke("M28.6,-40 C33,-35 35,-27 34.6,-17", "#7a5a40", 0.7, 0.7) + stroke("M27,-38 C30.6,-32 32,-26 31.6,-19", "#140c06", 0.6, 0.5))
    # near legs (their tops tuck under the body)
    _animal_leg(F, [(-17, -32), (-23.6, -21.6), (-27, -17.8), (-25, -11), (-27.6, -6.6)], [4.8, 3.6, 2.9, 2.2, 2.4], leg_ramp, sock=sock)
    _animal_leg(F, [(18, -33), (26.4, -19), (27.8, -12.6), (25.6, -5.6), (25, -1.4)], [6, 4.2, 3, 2.2, 2.4], leg_ramp, sock=sock)
    # body barrel
    body = spline([(-22, -44.4), (-10, -45.4), (2, -43.4), (14, -44.6), (22, -46), (27.4, -41.6), (28.6, -33.6), (24.6, -26.6), (14, -23.6), (0, -22.6), (-14, -24), (-22, -26.6), (-28.6, -31.4), (-28.6, -38.6)], closed=True)
    bg = c.rad("hbody" + ramp[2][1][1:], 0.3, 0.22, 0.85, [(0, ramp[1][1]), (0.35, ramp[2][1]), (0.78, ramp[3][1]), (1, ramp[4][1])], bbox=True)
    F.art(f'<path d="{body}" fill="{bg}"/>')
    # neck and head
    neck = spline([(-16, -46.6), (-20.6, -53.6), (-26.6, -62.4), (-33.4, -70.4), (-40.6, -66), (-42, -58), (-39.6, -48), (-34.6, -38.6), (-29.6, -32.6), (-24, -38)], closed=True)
    ng = c.rad("hneck" + ramp[2][1][1:], 0.25, 0.25, 0.9, [(0, ramp[1][1]), (0.4, ramp[2][1]), (0.85, ramp[3][1]), (1, ramp[4][1])], bbox=True)
    F.art(f'<path d="{neck}" fill="{ng}"/>')
    hs, (hpx, hpy) = 1.14, (-35.0, -66.0)
    htf = f'transform="translate({f(hpx)} {f(hpy)}) scale({f(hs)}) translate({f(-hpx)} {f(-hpy)})"'
    HP = lambda px, py: (hpx + (px - hpx) * hs, hpy + (py - hpy) * hs)
    head_parts = []
    hart = head_parts.append
    head = spline([(-33.6, -71.4), (-38.6, -72.6), (-43.4, -68.6), (-47.6, -61), (-51, -54.4), (-51.4, -49.6), (-48, -47.2), (-44, -49.4), (-41.4, -54.6), (-38.6, -60.4), (-34, -65.6)], closed=True)
    hart(f'<path d="{head}" fill="{ng}"/>')
    # ears, forelock, mane
    for ex0, tip, col in (((-35.4, -70), (-34, -78.6), ramp[3][1]), ((-37.4, -70.6), (-37.4, -79.4), ramp[2][1])):
        hart(f'<path d="M{f(ex0[0] - 1.6)},{f(ex0[1])} Q{f(tip[0] - 1.8)},{f(tip[1] + 4)} {f(tip[0])},{f(tip[1])} Q{f(tip[0] + 1.2)},{f(tip[1] + 4.6)} {f(ex0[0] + 1.6)},{f(ex0[1] + 0.6)}Z" fill="{col}"/>')
    mane_d = spline([(-33.6, -72.2), (-29.6, -66.4), (-25, -59.4), (-20.6, -52.8), (-15.6, -46.6), (-13.6, -47.8), (-18.4, -55), (-23, -62.6), (-27.4, -69.4), (-30.8, -73.2)], closed=True)
    hart(f'<path d="{mane_d}" fill="{mane}"/>' + stroke("M-31.6,-70.4 C-29,-65 -25.6,-58.6 -20.6,-51", "#6a4a30", 0.8, 0.8)
          + f'<path d="M-36.4,-71.4 Q-41,-70 -41.6,-65.6 Q-39,-68 -36,-68.6Z" fill="{mane}"/>')
    # face: blaze, eye, nostril, mouth
    hart(f'<path d="M-42.4,-67.6 C-44.6,-63 -47.6,-57 -49.8,-52 L-48.8,-51.2 C-46.6,-56 -44,-62 -41.6,-66.8Z" fill="#f6efe2" opacity="0.9"/>'
          '<ellipse cx="-40.8" cy="-64.4" rx="1.4" ry="1.2" fill="#140c06"/><circle cx="-41.2" cy="-64.8" r="0.45" fill="#fff"/>'
          '<ellipse cx="-49.6" cy="-52" rx="1" ry="0.75" fill="#2a1408"/>' + stroke("M-51,-49.4 Q-49,-48.6 -46.8,-49.6", "#3a1c0c", 0.6, 0.7)
          + stroke("M-39.2,-61 C-41.2,-56.6 -43,-52.6 -43.8,-50", "#3a1c0c", 0.7, 0.3)
          + stroke("M-34.4,-66 C-36.4,-60 -39,-54 -40.6,-50", "#3a1c0c", 1.2, 0.2))
    F.art(f'<g {htf}>{"".join(head_parts)}</g>')
    # muscle definition and light
    F.art(stroke("M-25,-42 C-21,-37 -20,-32 -21,-27", "#3a1c0c", 1.0, 0.25) + stroke("M17,-42 C21,-38 23,-33 22,-28", "#3a1c0c", 1.0, 0.25)
          + stroke("M-20,-26 C-8,-23.4 6,-23 18,-25", "#2a1408", 1.6, 0.25) + stroke("M-23,-43.4 C-12,-44.6 2,-42.6 20,-44.6", "#fff4dc", 1.0, 0.45)
          + stroke("M-28,-38 C-31,-46 -33,-55 -36.6,-63", "#fff4dc", 0.8, 0.35))
    seat = F.P(-5, -46.4)
    if saddle:
        cloth = spline([(-15.4, -46.6), (-4, -47.4), (9.4, -46.4), (10.4, -40), (8.6, -33.6), (-2, -32.4), (-13.6, -33.6), (-16.4, -40)], closed=True)
        F.mass(cloth, cloth_grad(c, ACC_R if saddle_accent else WOOL, "saddle" + ("a" if saddle_accent else "w"), 0, 0, 1, 1), saddle_accent)
        F.art(stroke("M-13.6,-33.8 C-6,-32.2 2,-32.2 8.6,-33.8", "#f3e6c4", 1.4) + "".join(f'<path d="M{f(xx)},{f(-33.4 + abs(xx + 2) * 0.012)} l-0.6,2.6 l1.2,0Z" fill="#f3e6c4"/>' for xx in range(-13, 9, 2))
              + stroke("M-14.6,-44 C-6,-45 2,-45 9.6,-44", "#fff", 0.9, 0.35) + stroke("M-1,-46 C-1.6,-41 -1.6,-37 -1.4,-33", SHADE, 1.0, 0.25))
    # bridle with a bronze disc, reins
    F.art(f'<g {htf}>' + stroke("M-37,-70.6 C-40.4,-64 -45,-57 -48.8,-51.6", "#2a1408", 0.8) + stroke("M-36.8,-62.6 C-40.6,-61.2 -44.4,-59 -47,-56", "#2a1408", 0.7)
          + '<circle cx="-41.4" cy="-60.4" r="1.3" fill="#d9a35a"/><circle cx="-41.8" cy="-60.8" r="0.45" fill="#fff2cc"/></g>')
    return {"seat": seat, "mouth": F.P(*HP(-47.4, -51.4)), "flank": F.P(-6, -38), "F": F}


def donkey(c, x, y, k=1.0, ramp=DONKEY_R, blanket_accent=True):
    """A pack donkey walking left, laden: an owner-colour blanket, a wooden pack frame, two big
    sacks, amphorae, a hoe and a rolled bedroll on top. Returns anchor points (halter)."""
    F = Fig(c, x, y, k)
    # far legs
    _animal_leg(F, [(-13, -17), (-15.4, -9), (-16.4, -1.4)], [3, 2, 1.8], ramp, far=True)
    _animal_leg(F, [(12, -18), (16, -9), (14, -1.4)], [3.8, 2.1, 1.8], ramp, far=True)
    # tail
    F.art(stroke("M20.6,-27 C24,-24 25.4,-19 24.6,-13", "#5a5048", 1.4) + f'<path d="M23.4,-15 C26,-13 26.6,-9.6 25,-8 C23.4,-9.4 22.6,-12 23.4,-15Z" fill="#2e2620"/>')
    body = spline([(-13.6, -30), (-2, -29), (10, -29.6), (18, -31), (22, -26.6), (21.6, -20), (14, -15.6), (0, -15), (-12, -15.6), (-18.4, -19.6), (-19, -25.6)], closed=True)
    bg = c.rad("dbody", 0.3, 0.22, 0.85, [(0, ramp[1][1]), (0.35, ramp[2][1]), (0.78, ramp[3][1]), (1, ramp[4][1])], bbox=True)
    F.art(f'<path d="{body}" fill="{bg}"/>' + f'<path d="M-16,-19 C-6,-15.4 8,-15 18,-18 C12,-15 -6,-14.4 -16,-19Z" fill="#e6dccc" opacity="0.6"/>')
    neck = spline([(-12, -30.6), (-17, -35), (-21, -39.6), (-25.4, -38.6), (-26.4, -33), (-22, -26), (-18.6, -22)], closed=True)
    ng = c.rad("dneck", 0.25, 0.25, 0.9, [(0, ramp[1][1]), (0.4, ramp[2][1]), (0.85, ramp[3][1]), (1, ramp[4][1])], bbox=True)
    F.art(f'<path d="{neck}" fill="{ng}"/>')
    head = spline([(-20.6, -41), (-25.4, -42), (-29.6, -38), (-33.6, -32), (-34.2, -28.4), (-31.4, -26.6), (-27.6, -28.6), (-24.6, -32.6), (-21, -36)], closed=True)
    F.art(f'<path d="{head}" fill="{ng}"/>' + f'<path d="M-30.6,-35 C-33,-32 -34.4,-29.4 -33.6,-27.6 C-32,-26.6 -29.6,-27.4 -28.4,-29.2 C-28.6,-31.6 -29.6,-33.6 -30.6,-35Z" fill="#e6dccc"/>'
          '<ellipse cx="-26.6" cy="-37" rx="1.1" ry="0.95" fill="#140c06"/><circle cx="-26.9" cy="-37.3" r="0.35" fill="#fff"/><ellipse cx="-33" cy="-29.6" rx="0.7" ry="0.5" fill="#2a2018"/>')
    # long ears
    for e0, tip, col in (((-21.4, -41), (-16, -52), ramp[3][1]), ((-23.4, -41.4), (-21.6, -53.6), ramp[2][1])):
        F.art(f'<path d="M{f(e0[0] - 1.4)},{f(e0[1] + 0.6)} Q{f(tip[0] - 2.6)},{f(tip[1] + 3)} {f(tip[0])},{f(tip[1])} Q{f(tip[0] + 2.2)},{f(tip[1] + 4)} {f(e0[0] + 1.8)},{f(e0[1] + 0.4)}Z" fill="{col}"/>'
              f'<path d="M{f(e0[0] - 0.2)},{f(e0[1] - 0.6)} Q{f(tip[0] - 0.8)},{f(tip[1] + 3.6)} {f(tip[0] + 0.2)},{f(tip[1] + 1.4)}" fill="none" stroke="#3a322c" stroke-width="0.8" opacity="0.6"/>')
    F.art(stroke("M-20.6,-40 C-18,-37 -15,-33.6 -12,-31", "#2e2620", 1.6) + stroke("M-27.6,-38 L-31.6,-31 M-24.6,-33.6 L-30.4,-31", "#3e2a1c", 0.8)
          + stroke("M-6,-29.6 L-6.6,-18", "#3a322c", 1.1, 0.4))
    # near legs
    _animal_leg(F, [(-9.6, -17.6), (-10, -9), (-8.6, -1.4)], [3.1, 2.1, 1.8], ramp)
    _animal_leg(F, [(15.6, -19), (19.4, -9.6), (18.4, -1.4)], [3.9, 2.1, 1.8], ramp)
    # pack: blanket (owner colour), frame, far sack top, bedroll, amphorae, hoe, near sack
    bl = spline([(-12.6, -31.6), (0, -32.4), (13.4, -31.4), (14.4, -25), (12.6, -20.4), (0, -19.6), (-11.6, -20.4), (-13.6, -26)], closed=True)
    F.mass(bl, cloth_grad(c, ACC_R if blanket_accent else WOOL, "blanket" + ("a" if blanket_accent else "w"), 0, 0, 1, 1), blanket_accent)
    F.art(stroke("M-11.6,-20.6 C-4,-19.4 6,-19.4 12.6,-20.6", "#f3e6c4", 1.2) + stroke("M-11.2,-22.4 C-4,-21.2 6,-21.2 12.4,-22.4", "#5a2a1a", 0.6, 0.45)
          + "".join(f'<rect x="{f(xx)}" y="-20.2" width="0.9" height="2" fill="#f3e6c4"/>' for xx in range(-11, 13, 2)))
    return {"halter": F.P(-29, -31), "F": F, "pack": F.P(0, -32)}


def pack_load(F, sack_far=(-1, -41), sack_near=(0, -27)):
    """Load on top of the donkey (drawn in the donkey's frame F after donkey())."""
    c = F.c
    sg = blob_grad(c, SACK_R, "sack", 0.3, 0.25, 0.85)
    # far sack top, bedroll, amphorae, hoe
    F.art(f'<ellipse cx="{f(sack_far[0] + 1)}" cy="{f(sack_far[1])}" rx="9.6" ry="5" fill="{sg}"/>')
    F.tube([(-10, -36.6), (10, -38)], [3.4, 3.4], WOOL)
    F.art(stroke("M-6,-39.6 L-6.4,-33.4 M6,-40.6 L5.8,-34.6", "#4a2c16", 0.9, 0.8) + f'<ellipse cx="10.4" cy="-38" rx="1.6" ry="3.2" fill="#6a4a30"/><ellipse cx="10.4" cy="-38" rx="0.8" ry="1.8" fill="#4a3020"/>')
    for ax, ay, rot in ((-9.6, -40.6, -14), (-4.6, -42.6, -6)):
        F.art(f'<g transform="translate({f(ax)} {f(ay)}) rotate({f(rot)}) scale(0.62)">'
              f'<path d="M-0.8,0 C-3.4,-3 -4.8,-8 -4,-11.6 C-3.4,-13.6 -1.8,-14.2 -1.4,-15.2 L-1.5,-17.6 L1.5,-17.6 L1.4,-15.2 C1.8,-14.2 3.4,-13.6 4,-11.6 C4.8,-8 3.4,-3 0.8,0Z" fill="{blob_grad(c, [(0, "#f6b48c"), (0.12, "#e28a62"), (0.42, "#b85a3c"), (0.78, "#7e3624"), (0.93, "#5a2216"), (1, "#7a4a3a")], "amph", 0.3, 0.3, 0.9)}"/>'
              '<path d="M-1.6,-15.6 C-4.4,-16 -4.6,-13.4 -3.4,-12.2 M1.6,-15.6 C4.4,-16 4.6,-13.4 3.4,-12.2" fill="none" stroke="#7d3a26" stroke-width="1"/>'
              '<ellipse cx="0" cy="-17.6" rx="1.7" ry="0.6" fill="#3a1a10"/><path d="M-2.6,-10 C-3,-7 -2,-4 -1,-2" fill="none" stroke="#ffd0b0" stroke-width="0.8" opacity="0.7"/>'
              '<rect x="-3.8" y="-10.6" width="7.6" height="0.7" fill="#2d140c" opacity="0.4"/></g>')
    F.tube([(4, -36), (16.4, -56)], [0.9, 0.9], WOOD_R)
    F.art(f'<path d="M14.6,-56.6 L20.4,-54.4 L19.6,-52.6 L15.6,-53.6Z" fill="{across(c, (16, -57), (17, -52), BRONZE_DK)}"/>')
    # ropes and the near sack
    F.art(f'<ellipse cx="{f(sack_near[0])}" cy="{f(sack_near[1])}" rx="10.4" ry="7.6" fill="{sg}"/>'
          + fold(f"M{f(sack_near[0] - 6)},{f(sack_near[1] - 4)} C{f(sack_near[0] - 3)},{f(sack_near[1] - 1)} {f(sack_near[0] + 2)},{f(sack_near[1] + 1)} {f(sack_near[0] + 6)},{f(sack_near[1] + 4)}", 0.8, 0.25, 0.4)
          + stroke(f"M{f(sack_near[0] - 9)},{f(sack_near[1] - 2.4)} C{f(sack_near[0] - 3)},{f(sack_near[1] - 1)} {f(sack_near[0] + 4)},{f(sack_near[1] - 1)} {f(sack_near[0] + 10)},{f(sack_near[1] - 2.6)}", "#8a6a46", 1.0)
          + stroke(f"M{f(sack_near[0] - 1)},{f(sack_near[1] - 7.4)} L{f(sack_near[0] - 1.4)},{f(sack_near[1] + 7.4)}", "#8a6a46", 0.9, 0.8)
          + stroke("M-11,-34.6 C-6,-33 6,-33.6 12,-35.4", "#8a6a46", 1.0))


def chalcidian(F, hx, hy, r, crest=True, crest_accent=True):
    """Open-faced bronze Chalcidian helmet with cheek pieces and a horsehair crest (3/4 left).
    Draw after face(..., hair=False, ear=False)."""
    k = r / 10.0
    P = lambda pts: _pts_scale(pts, hx, hy, k)
    c = F.c
    if crest:
        cp = P([(-7, -11.6), (-8.6, -17.4), (-4.6, -23.4), (2.4, -25.4), (9.6, -22.6), (14.4, -16), (16.6, -8.6), (16.2, -2.4), (13.6, -4.4), (12, -10), (8.4, -13.6), (2, -15), (-3.6, -13.6)])
        cd = spline(cp, closed=True)
        F.mass(cd, cloth_grad(c, ACC_R if crest_accent else BRONZE_DK, "crest" + ("a" if crest_accent else "b"), 0.1, 0, 0.9, 1), crest_accent)
        F.art("".join(stroke(spline(P(s)), SHADE, 0.6 * k, 0.28) for s in ([(-5.4, -14.4), (-5.6, -19.6), (-0.6, -23), (6.6, -22.4), (11.6, -17.6), (14, -10)], [(-2, -14.6), (-0.6, -18.6), (4.6, -20), (9.6, -16.6), (12, -10.6)]))
              + stroke(spline(P([(-7.4, -13.6), (-7, -19), (-2.6, -23.4), (3, -24.4)])), "#fff", 1.0 * k, 0.45)
              + f'<path d="{poly(P([(-3.4, -10.6), (6, -10.8), (6.8, -13.2), (-4, -13)]))}" fill="#8a5a2c"/>')
    dome = spline(P([(-10.4, -1.6), (-10.2, -7), (-5.4, -11.2), (1, -12), (7, -10.2), (10.6, -5.6), (11.4, 0.4), (11, 5.4), (12.2, 9.6), (8.6, 9.4), (6.4, 5.4), (5, 1.6), (2.4, -0.6), (-1.6, -1.6), (-5.6, -1.4), (-8, -0.6)]), closed=True)
    g = c.rad("helm", 0.32, 0.22, 0.85, [(0, "#fff3d0"), (0.18, "#f2cc84"), (0.45, "#cf9a52"), (0.78, "#8e5c2c"), (1, "#5a3a1b")], bbox=True)
    F.art(f'<path d="{dome}" fill="{g}"/>')
    cheek = spline(P([(-1.6, -1.2), (2.4, -0.4), (4.6, 2.4), (4, 7.4), (1.4, 10.6), (-2.6, 10.4), (-3.4, 6), (-3, 1.6)]), closed=True)
    F.art(f'<path d="{cheek}" fill="{g}"/>' + stroke(spline(P([(-3, 1.6), (-3.4, 6), (-2.6, 10.2)])), "#5a3a1b", 0.7 * k, 0.6)
          + stroke(spline(P([(-10.6, -2.2), (-6, -3.4), (-1.4, -2.6), (3, -0.8)])), "#fff4d6", 0.9 * k, 0.8)
          + stroke(spline(P([(-10.2, -0.8), (-6, -1.8), (-1.6, -1.2)])), "#5a3a1b", 0.7 * k, 0.5)
          + f'<path d="{poly(P([(-9.6, -2), (-8.4, -2.2), (-8.6, 2.4), (-9.8, 2)]))}" fill="#c48a48"/>'
          + stroke(spline(P([(-8.6, -6.6), (-4.6, -10), (1, -10.8)])), "#fffaf0", 1.2 * k, 0.9) + glint(*P([(-6, -7.6)])[0], 0.85 * k, 0.95)
          + stroke(spline(P([(5.6, 3), (8, 6.4), (11.6, 8.8)])), "#5a3a1b", 0.8 * k, 0.5))
    return dome


# ---------------------------------------------------------------------------
# Ships in a 3/4 view (bow toward the lower left)
# ---------------------------------------------------------------------------
class Ship:
    """A hull on the unit canvas. Ship frame: s along the keel (bow at s = -L), t across the
    beam (t > 0 = the near side, toward the viewer), z up. The ship axis is turned phi degrees
    from the screen horizontal in the ground plane (negative: the bow comes toward the viewer).
    Draw in this order: water(), far_side() / deck(), cargo, mast() / sail(), near_side(), oars,
    ornaments."""

    def __init__(self, c, L, W, hd, sheer_bow, sheer_stern, phi=-22.0, ox=0.0, oy=0.0, fullness=2.2, bulwark=2.6, flare=0.84):
        self.c, self.L, self.W, self.hd = c, L, W, hd
        self.sb, self.ss = sheer_bow, sheer_stern
        a = math.radians(phi)
        self.cs, self.sn = math.cos(a), math.sin(a)
        self.x0, self.y0 = c.P(0, 0, 0)
        self.x0 += ox
        self.y0 += oy
        self.full, self.bw, self.flare = fullness, bulwark, flare

    def P(self, s, t, z=0.0):
        u = s * self.cs - t * self.sn
        v = s * self.sn + t * self.cs
        return (self.x0 + SQ2 * u, self.y0 + v / SQ2 - ZS * z)

    def beam(self, s):
        t = min(1.0, abs(s) / self.L)
        return self.W * max(0.0, 1 - t ** self.full) ** 0.6

    def zg(self, s):
        t = s / self.L
        return self.hd + (self.sb if t < 0 else self.ss) * abs(t) ** 2.4

    def stations(self, n=28, s0=None, s1=None):
        s0 = -self.L if s0 is None else s0
        s1 = self.L if s1 is None else s1
        return [s0 + (s1 - s0) * i / n for i in range(n + 1)]

    def line(self, pts):
        return "M" + " L".join(f"{f(x)},{f(y)}" for x, y in pts)

    # --- water ----------------------------------------------------------------
    def water(self):
        """Soft hull shadow on the water, the wake and the bow wave (on the token's water)."""
        c = self.c
        ss = self.stations(20)
        wl = [self.P(s * 0.96, self.beam(s) * self.flare + 1.5, 0) for s in ss] + [self.P(s * 0.96, -self.beam(s) * self.flare - 1, 0) for s in reversed(ss)]
        sh = [(x + 3, y + 2.4) for x, y in wl]
        c.add(f'<g clip-path="{c.url("top")}"><path d="{poly(sh)}" fill="#0c3c50" opacity="0.32" filter="{c.blur(1.6)}"/></g>')
        # wake behind the stern
        x1, y1 = self.P(self.L * 0.95, 0, 0)
        out = []
        for i, (dt, op) in enumerate(((3, 0.55), (-3, 0.45), (6, 0.3), (-6, 0.25))):
            xa, ya = self.P(self.L * 0.9, dt * 0.6, 0)
            xb, yb = self.P(self.L * 1.25 + abs(dt) * 1.4, dt * 1.8, 0)
            out.append(stroke(f"M{f(xa)},{f(ya)} Q{f((xa + xb) / 2)},{f((ya + yb) / 2 + 0.8)} {f(xb)},{f(yb)}", "#f2fffc", 0.9, op))
        c.add(f'<g clip-path="{c.url("top")}">{"".join(out)}</g>')

    # --- hull -----------------------------------------------------------------
    def far_side(self, inner="#c9a274", n=28):
        """The inner face of the far bulwark (seen over the deck)."""
        ss = self.stations(n)
        top = [self.P(s, -self.beam(s), self.zg(s)) for s in ss]
        low = [self.P(s, -self.beam(s) * 0.9, self.zg(s) - self.bw) for s in reversed(ss)]
        self.c.add(f'<path d="{poly(top + low)}" fill="{inner}"/>' + stroke(self.line(top), "#f3ddb4", 0.7, 0.8))

    def deck(self, col="#9a7046", planks=4, n=28):
        """The deck between the bulwarks, with plank seams."""
        ss = self.stations(n, -self.L * 0.98, self.L * 0.98)
        near = [self.P(s, self.beam(s) * 0.9, self.zg(s) - self.bw) for s in ss]
        far = [self.P(s, -self.beam(s) * 0.9, self.zg(s) - self.bw) for s in reversed(ss)]
        dg = self.c.lin("deck" + col[1:], near[0][0], 0, near[-1][0], 0, [(0, "#c99a66"), (0.5, col), (1, "#6e4c2c")])
        seams = "".join(stroke(self.line([self.P(s, self.beam(s) * 0.9 * (2 * j / (planks + 1) - 1), self.zg(s) - self.bw) for s in ss]), "#4a3018", 0.4, 0.45) for j in range(1, planks + 1))
        self.c.add(f'<path d="{poly(near + far)}" fill="{dg}"/>' + seams)

    def near_side(self, stops, strakes=3, n=30, wale=None):
        """The outer face of the near side, from the gunwale to the waterline, planked; a bright
        rail on the gunwale and foam at the waterline. Returns (gunwale, waterline) points."""
        c = self.c
        ss = self.stations(n)
        gun = [(s, self.beam(s), self.zg(s)) for s in ss]
        wl = [(s * 0.97, self.beam(s) * self.flare, 0.0) for s in ss]
        G = [self.P(*p) for p in gun]
        Wp = [self.P(*p) for p in wl]
        side = c.lin("hside" + stops[0][1][1:], G[0][0], 0, G[-1][0], 0, stops)
        c.add(f'<path d="{poly(G + Wp[::-1])}" fill="{side}"/>')
        # darker toward the water, a teal reflection at the waterline
        vg = c.lin("hvert", 0, 0, 0, 1, [(0, "#000", 0), (0.55, "#000", 0.12), (0.88, "#0a2a36", 0.35), (1, "#5fc6c6", 0.35)], bbox=True)
        c.add(f'<path d="{poly(G + Wp[::-1])}" fill="{vg}"/>')
        for j in range(1, strakes + 1):
            t = j / (strakes + 1)
            ln = [self.P(g[0] + (w[0] - g[0]) * t, g[1] + (w[1] - g[1]) * t, g[2] + (w[2] - g[2]) * t) for g, w in zip(gun, wl)]
            c.add(stroke(self.line(ln), "#000", 0.5, 0.28) + stroke(self.line([(x - 0.3, y - 0.6) for x, y in ln]), "#fff", 0.4, 0.14))
        c.add(stroke(self.line(G), "#f6deb0", 1.0, 0.85) + stroke(self.line([(x, y + 1.2) for x, y in G]), "#2a1a0c", 0.6, 0.35))
        c.add(stroke(self.line(Wp[1:-1]), "#f2fffc", 1.4, 0.9))
        # bow wave
        bx, by = self.P(-self.L * 0.96, 0, 0)
        c.add(f'<path d="M{f(bx - 1)},{f(by - 1)} q-3,2 -2,4.4 q2.6,-0.6 4.6,-0.6 q-1.4,-1.6 -2.6,-3.8Z" fill="#f2fffc" opacity="0.85"/>'
              + stroke(f"M{f(bx + 1)},{f(by + 1.6)} q4,2.4 9,2.2", "#f2fffc", 0.9, 0.7))
        return gun, wl

    # --- rig ------------------------------------------------------------------
    def mast(self, s, z_top, w=1.2):
        x0, y0 = self.P(s, 0, self.zg(s) - self.bw)
        x1, y1 = self.P(s, 0, z_top)
        self.c.add(f'<path d="M{f(x0 - w)},{f(y0)} L{f(x1 - w * 0.7)},{f(y1)} L{f(x1 + w * 0.7)},{f(y1)} L{f(x0 + w)},{f(y0)}Z" fill="{across(self.c, (x0 - w, y0), (x0 + w, y0), WOOD_R)}"/>'
                   f'<rect x="{f(x1 - 1.6)}" y="{f(y1 - 1.6)}" width="3.2" height="2.6" rx="0.6" fill="#5e3b22"/>')
        return (x1, y1)

    def sail(self, s, z_yard, z_foot, half, beta=45.0, billow=4.0, accent=True, seams=3, brails=5, emblem=None):
        """A square sail hanging from a braced yard (beta degrees off the keel), billowing toward
        the viewer. The cloth is owner colour; brails, seams and the yard are art on top."""
        c = self.c
        b = math.radians(beta)
        ys, yt = math.cos(b), math.sin(b)
        ns, nt = -yt, ys                     # sail normal toward the bow / near side

        def S(a, h):
            bil = billow * (1 - a * a * 0.85) * math.sin(math.pi * (0.15 + 0.85 * h)) * (0.4 + 0.6 * h)
            rise = 2.2 * a * a * h
            return self.P(s + ys * a * half * (1 - 0.05 * h) + ns * bil, yt * a * half * (1 - 0.05 * h) + nt * bil, z_yard - h * (z_yard - z_foot) + rise)

        N = 8
        top = [S(-1 + 2 * i / N, 0) for i in range(N + 1)]
        right = [S(1, i / N) for i in range(1, N + 1)]
        foot = [S(1 - 2 * i / N, 1) for i in range(1, N + 1)]
        left = [S(-1, 1 - i / N) for i in range(1, N)]
        shape = poly(top + right + foot + left)
        sg = c.lin(_uid(c, "sail"), top[0][0], top[0][1], foot[0][0], foot[0][1], [(0, ACCENT["lit"]), (0.4, ACCENT["lit"]), (0.75, ACCENT["light"]), (1, ACCENT["mid"])])
        if accent:
            c.accent(f'<path d="{shape}" fill="{sg}"/>')
        else:
            c.add(f'<path d="{shape}" fill="{c.lin(_uid(c, "sailn"), top[0][0], 0, top[-1][0], 0, LINEN)}"/>')
        # light: a soft sheen on the bulge (left), shade on the far side, seams and brails
        sheen = [S(-0.85, 0.15), S(-0.2, 0.2), S(0.1, 0.6), S(-0.3, 0.9), S(-0.85, 0.8)]
        out = [f'<path d="{spline(sheen, closed=True)}" fill="#fff" opacity="0.09"/>']
        dk = [S(0.55, 0.05), S(1, 0.05), S(1, 0.95), S(0.6, 0.95), S(0.75, 0.5)]
        out.append(f'<path d="{spline(dk, closed=True)}" fill="{SHADE}" opacity="0.14"/>')
        for i in range(1, brails + 1):
            a = -1 + 2 * i / (brails + 1)
            out.append(stroke(self.line([S(a, h / 8) for h in range(9)]), "#3a2a1e", 0.5, 0.3))
        for j in range(1, seams + 1):
            h = j / (seams + 1)
            out.append(stroke(self.line([S(-1 + 2 * i / 8, h) for i in range(9)]), "#3a2a1e", 0.45, 0.25))
            out.append("".join(f'<circle cx="{f(S(-1 + 2 * i / (brails + 1), h)[0])}" cy="{f(S(-1 + 2 * i / (brails + 1), h)[1])}" r="0.5" fill="#d9c49a" opacity="0.8"/>' for i in range(1, brails + 1)))
        out.append(stroke(self.line(foot), "#3a2a1e", 0.6, 0.35))
        if emblem == "eye":
            ex, ey = S(0, 0.5)
            out.append(f'<ellipse cx="{f(ex)}" cy="{f(ey)}" rx="5.4" ry="3" fill="#f6ecd4"/><circle cx="{f(ex - 0.4)}" cy="{f(ey)}" r="2.1" fill="#2a1a10"/><circle cx="{f(ex - 1)}" cy="{f(ey - 0.7)}" r="0.6" fill="#fff"/>')
        c.add("".join(out))
        # the yard
        y0 = self.P(s - ys * half * 1.12, -yt * half * 1.12, z_yard + 0.6)
        y1 = self.P(s + ys * half * 1.12, yt * half * 1.12, z_yard + 0.6)
        c.add(stroke(f"M{f(y0[0])},{f(y0[1])} L{f(y1[0])},{f(y1[1])}", "#4a2c16", 2.0) + stroke(f"M{f(y0[0])},{f(y0[1] - 0.5)} L{f(y1[0])},{f(y1[1] - 0.5)}", "#c99a66", 0.6, 0.8))
        return {"tl": top[0], "tr": top[-1], "fl": foot[-1], "fr": foot[0], "S": S}

    def rope(self, p0, p1, sag=1.0, op=0.7, w=0.5):
        mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + sag
        self.c.add(stroke(f"M{f(p0[0])},{f(p0[1])} Q{f(mx)},{f(my)} {f(p1[0])},{f(p1[1])}", "#3e2a1a", w, op))

    # --- fittings ---------------------------------------------------------------
    def oar_bank(self, z_rel, n, s0, s1, reach, rake=4.0, side=1, w=0.8, col="#8a6038", ports=True, splash=True):
        """A bank of oars: from ports on one side (side=1 near, -1 far) down to the water."""
        out = []
        for i in range(n):
            s = s0 + (s1 - s0) * (i + 0.5) / n
            b = self.beam(s)
            zp = self.zg(s) + z_rel
            x0, y0 = self.P(s, side * (b + 0.2), zp)
            x1, y1 = self.P(s + rake, side * (b + reach), -0.4)
            out.append(stroke(f"M{f(x0)},{f(y0)} L{f(x1)},{f(y1)}", col, w))
            ux, uy = _unit(x1 - x0, y1 - y0)
            out.append(f'<path d="M{f(x1 - ux * 3)},{f(y1 - uy * 3)} L{f(x1 + 0.9)},{f(y1 - 0.2)} L{f(x1 + 0.4)},{f(y1 + 0.9)}Z" fill="{col}"/>')
            if side > 0:
                if splash:
                    out.append(f'<path d="M{f(x1 - 1.6)},{f(y1 + 0.6)} q1.6,-1 3.2,0" fill="none" stroke="#f2fffc" stroke-width="0.6" opacity="0.6"/>')
                if ports:
                    out.append(f'<ellipse cx="{f(x0)}" cy="{f(y0)}" rx="0.9" ry="0.6" fill="#140c06" opacity="0.8"/>')
        self.c.add("".join(out))


TERRA_R = [(0, "#f6b48c"), (0.12, "#e28a62"), (0.42, "#b85a3c"), (0.78, "#7e3624"), (0.93, "#5a2216"), (1, "#7a4a3a")]


def amphora_at(c, x, y, k=0.6, rot=0.0):
    """A terracotta amphora standing at screen point (x, y) (k = 1: about 18 px tall)."""
    c.add(f'<g transform="translate({f(x)} {f(y)}) rotate({f(rot)}) scale({f(k)})">'
          f'<ellipse cx="1" cy="0.2" rx="4.2" ry="1.4" fill="{INK}" opacity="0.35"/>'
          f'<path d="M-0.8,0 C-3.4,-3 -4.8,-8 -4,-11.6 C-3.4,-13.6 -1.8,-14.2 -1.4,-15.2 L-1.5,-17.6 L1.5,-17.6 L1.4,-15.2 C1.8,-14.2 3.4,-13.6 4,-11.6 C4.8,-8 3.4,-3 0.8,0Z" fill="{blob_grad(c, TERRA_R, "amph", 0.3, 0.3, 0.9)}"/>'
          '<path d="M-1.6,-15.6 C-4.4,-16 -4.6,-13.4 -3.4,-12.2 M1.6,-15.6 C4.4,-16 4.6,-13.4 3.4,-12.2" fill="none" stroke="#7d3a26" stroke-width="1"/>'
          '<ellipse cx="0" cy="-17.6" rx="1.7" ry="0.6" fill="#3a1a10"/><path d="M-2.6,-10 C-3,-7 -2,-4 -1,-2" fill="none" stroke="#ffd0b0" stroke-width="0.8" opacity="0.7"/>'
          '<rect x="-3.8" y="-10.6" width="7.6" height="0.7" fill="#2d140c" opacity="0.4"/></g>')


def bale_at(c, x, y, w=7.0, h=4.6, col=SACK_R):
    """A corded bale of cloth / wool (screen space, bottom centre at (x, y))."""
    g = blob_grad(c, col, "bale" + col[2][1][1:], 0.3, 0.25, 0.9)
    c.add(f'<ellipse cx="{f(x + 1)}" cy="{f(y)}" rx="{f(w * 0.55)}" ry="1.2" fill="{INK}" opacity="0.3"/>'
          f'<rect x="{f(x - w / 2)}" y="{f(y - h)}" width="{f(w)}" height="{f(h)}" rx="{f(h * 0.42)}" fill="{g}"/>'
          + stroke(f"M{f(x - w * 0.12)},{f(y - h)} L{f(x - w * 0.12)},{f(y)} M{f(x - w / 2)},{f(y - h * 0.5)} L{f(x + w / 2)},{f(y - h * 0.5)}", "#8a6a46", 0.7, 0.9))


def ship_sailor(c, x, y, h=15.0, accent=False):
    """A tiny sailor on deck (screen space, feet at (x, y)): tunic, bare legs, a round head."""
    F = Fig(c, x, y, h / 40.0)
    F.tube([(-2.6, -12), (-3.4, 0)], [2.2, 1.8], SKIN_F)
    F.tube([(2.6, -12), (3, 0)], [2.2, 1.8], SKIN_F)
    garment(F, [(-6.6, -27), (0, -29.6), (6.6, -27), (7.6, -18), (8, -10), (0, -9), (-8, -10), (-7.6, -18)], accent=accent, ramp=LINEN, name="sail_t")
    F.tube([(6, -26), (10, -18), (12, -13)], [2.4, 2.1, 1.9], SKIN_F)
    face(F, -0.4, -34.6, 6.4, beard="short", hair=True, brow=False)


def cuff(F, end, toward, w, col="#f3e6c4"):
    """An embroidered border band around the end of a sleeve (end = the sleeve's end point)."""
    ux, uy = _unit(toward[0] - end[0], toward[1] - end[1])
    nx, ny = -uy, ux
    p = (end[0] + ux * 1.4, end[1] + uy * 1.4)
    F.art(stroke(f"M{f(p[0] + nx * w)},{f(p[1] + ny * w)} L{f(p[0] - nx * w)},{f(p[1] - ny * w)}", col, 1.4, 0.95)
          + stroke(f"M{f(p[0] + nx * w + ux * 0.9)},{f(p[1] + ny * w + uy * 0.9)} L{f(p[0] - nx * w + ux * 0.9)},{f(p[1] - ny * w + uy * 0.9)}", SHADE, 0.45, 0.5))


def cloak_border(F, edge, col="#f3e6c4"):
    """A cream border band along the free edge of a cloak."""
    F.art(stroke(spline([(x - 0.6, y - 0.9) for x, y in edge]), col, 1.1, 0.85))

