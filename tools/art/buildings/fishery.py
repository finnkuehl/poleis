"""fishery - a fisher's hut on stilts with a thatched roof on the shore, a long wooden jetty and a
moored fishing boat with a lateen sail and a painted eye; nets drying on poles, fish baskets,
wicker traps, shells and beach grass (docs/ART.md "Grounded buildings": no painted water, no
cove - the game draws the water, the beach and the sandy yard).

Files (all built by this script):
    fishery.svg          the compact icon on the normal 256 canvas (jetty toward the south-east)
    fishery.e0 ... e5    the map versions, one per hex edge e: the jetty points along the screen
                         angle 60 deg * e (y down: 0 east, 1 south-east, 2 south-west, 3 west,
                         4 north-west, 5 north-east). The game picks the one whose jetty reaches
                         into the real neighbouring water tile. Same user units and anchor as the
                         normal canvas (ground point under the tile centre at (128, 176), 208
                         units = 0.92 x hex width), each with its own tight viewBox and
                         data-anchor="128 176" on the root <svg>.
Layout of a map version (the first design's compact scene, standing at the real shore): the hut
stands so that its water-side corner is 114 units from the tile centre toward the edge (its
stilts reach just past the shore, ~95-125), a short jetty runs from its deck to 150 units, the boat
is moored right beside them (hull 118-165 units out), nets / traps / baskets / an amphora group
on the land side close around the hut (all within 100 units). Stilts and posts beyond 110 units
get foam rings. The game's sandy yard should be centred about 72 units out.
Accent (owner colour): the boat's sail and hull stripe, the cloth in the hut's doorway, the
propped window shutter and the pennant on the roof ridge."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import math  # noqa: E402
import random  # noqa: E402

import iso  # noqa: E402
import lib_agri as ag  # noqa: E402
import lib_raw as raw  # noqa: E402
from iso import ACCENT, WOOD, f, poly  # noqa: E402

# hut (placed with c.at()), local half extents and heights; world units
HA, HB = 17, 11        # wall half length (a) / half depth (b): a small 34 x 22 hut (README "Scale")
ZF = 8                 # floor (deck top) height: the hut stands on stilts
HW = 28                # wall top
RISE = 11              # gable rise
TANP = RISE / HB
T = 4.2                # thatch thickness
DECK_B = HB + 5        # the hut's deck reaches out in front of the door (+b)
ZTOP = HW + RISE + T   # ridge height

# map versions (user units = the normal building canvas; "along" = from the tile centre toward
# the water edge, the shared edge is at 113)
S = iso.S
APO = 113.0            # hex apothem: tile centre -> middle of an edge (0.5 * 208 / 0.92)
HUT_EDGE = 114.0       # the hut's water-side corner stands here: its stilts reach just past the shore
JETTY_END = 150.0      # the short jetty ends here, inside the water tile
BOAT_AT = 138.0        # the moored boat's centre
WATER_FROM = 110.0     # stilts and posts beyond this stand in water (foam rings, reflections);
                       # the real shore is wavy, ~95-125
JW, JZ = 3.6, 4.0      # jetty half width and deck height (world units)
JH, HEAD_L = 8.0, 9.0  # optional T-head platform at the outer end: half width and length
BOAT_L, BOAT_HW = 16.5, 5.4   # boat half length and half beam (world units)
# a jetty running exactly sideways (east / west) would show its planks edge-on like a fence,
# so it turns a little toward the viewer (screen degrees, y down); it still reaches the water
JETTY_TILT = {0: 14, 3: -14}
# per edge, in world units relative to the hut centre (a, b):
#   attach  where the jetty leaves the hut (a point on the deck / the hut's water side)
#   side    which side of the jetty the boat lies on (+1 = the side toward the viewer)
#   swing   how far the bow turns away from the jetty (degrees), so the sail shows broadside
#   shift   slide the hut along the shore (user units, + = clockwise along the edge)
#   boat_at, boat_gap   optional: the boat's centre toward the edge (default BOAT_AT) and extra
#           distance from the jetty (world units)
#   props   (kind, a, b, size) on the visible land side, close around the hut
LAYOUT = {
    0: dict(attach=(HA + 1.5, -6), side=-1, swing=0, shift=0,
            props=[("net", -33, 20, 1), ("amphora", -22, 25, 0.6), ("trap", -8, 31, 1), ("trap", 2, 37, 0.85),
                   ("basket", 6, 24, 1), ("basket", 14, 28, 0.85), ("oars", -6, 42, 1)]),
    1: dict(attach=(HA + 1.5, DECK_B - 3), side=-1, swing=15, shift=0, boat_at=147, boat_gap=4,
            props=[("net", -34, 8, 1), ("amphora", -28, 21, 0.6), ("trap", -14, 30, 1), ("trap", -3, 36, 0.85),
                   ("basket", 0, 25, 1), ("basket", -38, 22, 0.85)]),
    2: dict(attach=(-2, DECK_B), side=-1, swing=15, shift=0,
            props=[("net", 38, -12, 1), ("amphora", 28, 0, 0.6), ("trap", 36, 2, 1), ("trap", 47, -4, 0.85),
                   ("basket", 52, 6, 0.85), ("basket", 22, -16, 1)]),
    3: dict(attach=(-HA - 1.5, DECK_B - 3), side=-1, swing=0, shift=0,
            props=[("net", 34, -4, 1), ("amphora", 26, 12, 0.6), ("trap", 26, 25, 1), ("trap", 14, 31, 0.85),
                   ("basket", 4, 26, 1), ("basket", 36, 18, 0.85), ("oars", 18, 38, 1)]),
    4: dict(attach=(-HA - 1.5, DECK_B - 3), side=1, swing=15, shift=0,
            props=[("net", 36, -4, 1), ("amphora", 26, 14, 0.6), ("trap", 22, 26, 1), ("trap", 10, 32, 0.85),
                   ("basket", -2, 27, 1), ("basket", 36, 12, 0.85), ("oars", 6, 40, 1)]),
    5: dict(attach=(HA + 1.5, -HB + 1), side=1, swing=15, shift=0,
            props=[("net", -32, 21, 1), ("amphora", -20, 27, 0.6), ("trap", -6, 32, 1), ("trap", 6, 36, 0.85),
                   ("basket", 10, 24, 1), ("basket", 22, 21, 0.85), ("oars", -36, 32, 1)]),
}


# ---------------------------------------------------------------------------
# Direction geometry
# ---------------------------------------------------------------------------
def edge_dir(e):
    """Screen unit vector of hex edge e (y down)."""
    th = math.radians(60 * e)
    return math.cos(th), math.sin(th)


def screen_world(deg):
    """World (a, b) displacement for one user unit along the screen angle deg (y down)."""
    cx, cy = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return (cx + 2 * cy) / (2 * S), (2 * cy - cx) / (2 * S)


def edge_world(e):
    """World (a, b) displacement for one user unit along screen direction e."""
    return screen_world(60 * e)


def user_pt(a, b, z=0.0):
    """World point -> user units of the building canvas."""
    return iso.BASE_CX + S * (a - b), iso.BASE_CY + S * ((a + b) / 2 - iso.ZS * z)


def along(e, a, b):
    """How far a ground point lies from the tile centre toward edge e (user units)."""
    cx, cy = edge_dir(e)
    x, y = user_pt(a, b)
    return (x - iso.BASE_CX) * cx + (y - iso.BASE_CY) * cy


def toward_viewer(d):
    """Ground unit vector perpendicular to d that faces the viewer (a + b > 0)."""
    p = (-d[1], d[0])
    return p if p[0] + p[1] > 0 else (d[1], -d[0])


def lightness(n):
    """0 = a vertical face looking +a (cool shade) ... 1 = looking +b (lit)."""
    return max(0.0, min(1.0, (n[1] - n[0] + 1.4142) / 2.8284))


def exit_t(o, d, box):
    """Distance from o along d until it leaves the box (a0, a1, b0, b1)."""
    a0, a1, b0, b1 = box
    ts = []
    for v, lo, hi, dv in ((o[0], a0, a1, d[0]), (o[1], b0, b1, d[1])):
        if abs(dv) > 1e-9:
            ts.append(((hi if dv > 0 else lo) - v) / dv)
    return min(ts)


def screen_dist(q, o, d, L):
    """Distance on screen (user units) from the ground point q to the jetty's centre line
    o -> o + L d; props closer than about a prop's height would stand on the jetty."""
    x, y = user_pt(*q)
    x0, y0 = user_pt(*o)
    x1, y1 = user_pt(o[0] + L * d[0], o[1] + L * d[1])
    dx, dy = x1 - x0, y1 - y0
    t = max(0.0, min(1.0, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - x0 - t * dx, y - y0 - t * dy)


class Scene:
    """Collects the drawing of one fishery: ground-level things first, then every object sorted
    back to front by its depth (a + b), and the points that fix the viewBox."""

    def __init__(self, c, e, water_from=WATER_FROM):
        self.c, self.e, self.water_from = c, e, water_from
        self.ground, self.items, self.pts = [], [], []

    def add(self, depth, fn):
        self.items.append((depth, fn))

    def extent(self, *pts):
        self.pts.extend(pts)

    def draw(self):
        for fn in self.ground:
            fn()
        for _, fn in sorted(self.items, key=lambda t: t[0]):
            fn()

    def viewbox(self, margin=5.0, grid=8):
        xs, ys = zip(*(user_pt(*p) for p in self.pts))
        x0 = math.floor((min(xs) - margin) / grid) * grid
        y0 = math.floor((min(ys) - margin) / grid) * grid
        x1 = math.ceil((max(xs) + margin) / grid) * grid
        y1 = math.ceil((max(ys) + margin) / grid) * grid
        return (x0, y0, x1 - x0, y1 - y0)


# ---------------------------------------------------------------------------
# Fisher's hut on stilts
# ---------------------------------------------------------------------------
def hut(c):
    D = ag.DRIFT
    a0, a1, b0, b1 = -HA - 1.5, HA + 1.5, -HB - 1.5, DECK_B
    ZR = HW + RISE + T
    AV, BV = HA + 3, HB + 4
    ze = ZR - BV * TANP
    iso.cast_shadow(c, [(a0, b0), (a1, b0), (a1, b1), (a0, b1)],
                    [(sa * AV, sb * BV, ze) for sa in (-1, 1) for sb in (-1, 1)] + [(sa * AV, 0, ZR) for sa in (-1, 1)], opacity=0.42)
    # dark ground under the floor
    c.add(f'<path d="{poly([c.P(a0, b0, 0), c.P(a1, b0, 0), c.P(a1 + 3, b1, 0), c.P(a0, b1, 0)])}" fill="#203018" opacity="0.5" filter="{c.blur(1.6)}"/>')
    # stilts: back row first
    stilts = [(sa, sb) for sa in (a0 + 1, 0, a1 - 1) for sb in (b0 + 1, HB, b1 - 1)]
    for sa, sb in sorted(stilts, key=lambda p: p[0] + p[1]):
        ag.post(c, sa, sb, 0, ZF - 1.4, s=0.95)
    # floor platform with planks
    iso.box(c, a0, a1, b0, b1, ZF - 1.6, ZF, D["lit"], D["mid"], D["shade"], edge=D["hi"])
    planks = "".join(f'<rect x="{f(a0)}" y="{f(b0 + i * 2.2)}" width="{f(a1 - a0)}" height="0.35" fill="{D["dark"]}" opacity="0.55"/>' for i in range(1, int((b1 - b0) / 2.2)))
    c.add(c.on(c.m_ground(ZF), planks))
    # AO where the walls stand on the floor
    iso.contact_ao(c, -HA, HA, -HB, HB, z=ZF, width=2.6, opacity=0.4)
    ag.plank_wall_b(c, HB, -HA, HA, ZF, HW, seed=3)
    ag.plank_wall_a(c, HA, -HB, HB, ZF, HW, gable=RISE, seed=4)
    # corner posts of the frame
    for a_ in (-HA, HA):
        c.add(c.on(c.m_bface(HB), f'<rect x="{f(a_ - 1.1)}" y="{f(ZF)}" width="2.2" height="{f(HW - ZF)}" fill="{D["shade"] if a_ > 0 else D["mid"]}"/>'
                   f'<rect x="{f(a_ - 1.1)}" y="{f(ZF)}" width="0.6" height="{f(HW - ZF)}" fill="{D["hi"]}" opacity="0.6"/>'))
    c.add(c.on(c.m_bface(HB), f'<rect x="{-HA}" y="{f(HW - 2)}" width="{2 * HA}" height="2" fill="{D["mid"]}"/><rect x="{-HA}" y="{f(HW - 2)}" width="{2 * HA}" height="0.5" fill="{D["dark"]}" opacity="0.6"/>'))
    # doorway with an owner-colour cloth drawn to one side
    dx0, dx1, dz1 = 2, 11, ZF + 16           # door 9 x 16 (README "Scale")
    c.add(c.on(c.m_bface(HB), f'<rect x="{f(dx0 - 1)}" y="{f(ZF)}" width="{f(dx1 - dx0 + 2)}" height="{f(dz1 - ZF + 1.4)}" fill="{D["dark"]}"/>'
               f'<rect x="{f(dx0)}" y="{f(ZF)}" width="{f(dx1 - dx0)}" height="{f(dz1 - ZF)}" fill="#1c140e"/>'
               f'<rect x="{f(dx0)}" y="{f(dz1 - 3)}" width="{f(dx1 - dx0)}" height="3" fill="#000" opacity="0.3"/>'))
    cloth = [(dx0, dz1), (dx1, dz1), (dx1 - 1.2, dz1 - 5), (dx0 + 5, ZF + 7), (dx0 + 3.5, ZF + 1.2), (dx0, ZF + 0.8)]
    cg = c.lin("doorcloth", 0, 0, 1, 0, [(0, ACCENT["lit"]), (0.4, ACCENT["light"]), (0.75, ACCENT["mid"]), (1, ACCENT["shade"])], bbox=True)
    c.accent(c.on(c.m_bface(HB), f'<path d="{poly(cloth)}" fill="{cg}"/>'))
    c.add(c.on(c.m_bface(HB), f'<path d="M{f(dx0 + 1.6)},{f(dz1)} L{f(dx0 + 3.8)},{f(ZF + 4)} M{f(dx0 + 3.6)},{f(dz1)} L{f(dx0 + 4.8)},{f(ZF + 8.5)}" stroke="#1d2b36" stroke-width="0.6" opacity="0.25"/>'
               f'<path d="M{f(dx0 + 5)},{f(ZF + 7.3)} l-1.8,-0.6" stroke="{WOOD["dark"]}" stroke-width="0.8"/>'
               f'<rect x="{f(dx0 - 1.5)}" y="{f(dz1)}" width="{f(dx1 - dx0 + 3)}" height="1.6" fill="{D["mid"]}"/>'
               f'<rect x="{f(dx0 - 1.5)}" y="{f(dz1)}" width="{f(dx1 - dx0 + 3)}" height="0.45" fill="{D["dark"]}"/>'))
    # small window with a propped shutter, and a round vent in the gable
    c.add(c.on(c.m_bface(HB), f'<rect x="-11" y="{f(ZF + 5)}" width="8" height="7" fill="{D["dark"]}"/><rect x="-10.3" y="{f(ZF + 5.6)}" width="6.6" height="5.8" fill="#1c140e"/>'
))
    # window shutter (owner colour), hinged at the bottom and hanging open under the window
    shutter = f'M-11.4,{f(ZF + 4.6)} L-2.6,{f(ZF + 4.6)} L-2.9,{f(ZF + 0.6)} L-11.1,{f(ZF + 0.6)}Z'
    c.accent(c.on(c.m_bface(HB), f'<path d="{shutter}" fill="{ACCENT["light"]}"/>'))
    c.add(c.on(c.m_bface(HB), f'<path d="M-11.4,{f(ZF + 4.6)} L-2.6,{f(ZF + 4.6)}" stroke="{D["dark"]}" stroke-width="0.6"/>'
               f'<path d="M-8.4,{f(ZF + 4.4)} L-8.5,{f(ZF + 0.8)} M-5.6,{f(ZF + 4.4)} L-5.7,{f(ZF + 0.8)}" stroke="#1d2b36" stroke-width="0.4" opacity="0.35"/>'
               f'<path d="M-11.1,{f(ZF + 0.6)} L-2.9,{f(ZF + 0.6)}" stroke="#1d2b36" stroke-width="0.5" opacity="0.3"/>'))
    c.add(c.on(c.m_aface(HA), f'<rect x="-3.5" y="{f(ZF + 5)}" width="7" height="6.5" fill="#2a2119"/><rect x="-3.5" y="{f(ZF + 11.5)}" width="7" height="0.7" fill="{D["lit"]}" opacity="0.6"/>'
               f'<circle cx="0" cy="{f(HW + 4.5)}" r="1.9" fill="#2a2119"/>'))
    # a string of drying fish under the eave on the shaded side
    x0, y0 = c.P(HA + 0.6, -6, HW - 1.5)
    x1, y1 = c.P(HA + 0.6, 6, HW - 1.5)
    fish = [f'<path d="M{f(x0)},{f(y0)} Q{f((x0 + x1) / 2)},{f((y0 + y1) / 2 + 2)} {f(x1)},{f(y1)}" fill="none" stroke="{D["deep"]}" stroke-width="0.4"/>']
    for i in range(5):
        t = (i + 0.5) / 5
        px, py = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + 2 * 4 * t * (1 - t)
        fish.append(f'<g transform="translate({f(px)} {f(py + 3.2)}) rotate(90)">' + ag.fish_shape(0, 0, 0.62).replace("#e4f0f2", "#c7d3d6") + "</g>")
    c.add("".join(fish))
    # ladder from the deck down to the ground
    ag.ladder(c, c.P(-6, b1 + 4.2, 0), c.P(-6, b1 - 0.2, ZF), width=3.6, rungs=3)
    ag.thatch_roof_a(c, AV, BV, ZR, TANP, T=T, seed=6)
    # a coil of rope and an oar on the deck
    x, y = c.P(9, b1 - 2.2, ZF)
    c.add(f'<ellipse cx="{f(x + 0.6)}" cy="{f(y + 0.3)}" rx="3.2" ry="1.4" fill="#2d2418" opacity="0.35"/>'
          + "".join(f'<ellipse cx="{f(x)}" cy="{f(y - i * 0.55)}" rx="{f(2.8 - i * 0.35)}" ry="{f(1.25 - i * 0.15)}" fill="none" stroke="{"#d9c08a" if i % 2 else "#b49560"}" stroke-width="0.8"/>' for i in range(4)))


# ---------------------------------------------------------------------------
# Jetty (rotated to any direction: projected planks, posts as small cylinders)
# ---------------------------------------------------------------------------
def jetty(sc, o, d, L, seed=9, head=False):
    """Plank jetty from the ground point o along the unit direction d, L world units long, with a
    wider T-head platform at its outer end. Returns (posts, W, us, deck_props): post positions
    (u, v) in jetty coordinates, the point function W(u, v) -> (a, b), the section ends and a
    dict {section: [draw functions]} for things standing on the deck."""
    c, e = sc.c, sc.e
    D = ag.DRIFT
    p = toward_viewer(d)

    def W(u, v):
        return (o[0] + u * d[0] + v * p[0], o[1] + u * d[1] + v * p[1])

    def Pp(u, v, z):
        a, b = W(u, v)
        return c.P(a, b, z)

    def wet(u, v):
        return along(e, *W(u, v)) > sc.water_from

    uh = L - HEAD_L if head else L
    n = max(2, round(uh / 9.0))
    us = [uh * i / n for i in range(n + 1)] + ([L] if head else [])
    widths = [JW] * n + ([JH] if head else [])    # half width of each section; a head is the last
    posts = []
    for i, u in enumerate(us):
        for hw_ in sorted({JW if i < n + 1 else JH, JH if (head and i >= n) else JW}):
            for v in (-(hw_ - 0.8), hw_ - 0.8):
                posts.append((u, v))
    if head:
        for u in (us[n], L):                       # middle posts of the head
            posts.append((u, 0.0))
    posts = sorted(set(posts))
    hwmax = JH if head else JW
    for u, v in ((0, -JW), (0, JW), (uh, -hwmax), (uh, hwmax), (L, -hwmax), (L, hwmax)):
        a, b = W(u, v)
        sc.extent((a, b, -1), (a, b, JZ + 4), (a + 3, b, 0))

    def ground():
        # soft shadow of the deck on the beach / water, falling a little toward +a
        for u0, u1, hw_ in ((0, uh, JW), (uh, L, JH)) if head else ((0, L, JW),):
            sh = [(a + iso.SHX * JZ, b + iso.SHY * JZ) for a, b in (W(u0, -hw_), W(u1, -hw_), W(u1, hw_), W(u0, hw_))]
            c.add(f'<path d="{poly([c.P(a, b, 0) for a, b in sh])}" fill="{iso.INK}" opacity="0.28" filter="{c.blur(1.0)}"/>')
        for u, v in posts:
            a, b = W(u, v)
            x, y = c.P(a, b, 0)
            if wet(u, v):
                c.add(f'<rect x="{f(x - 0.9)}" y="{f(y)}" width="1.8" height="3.6" fill="#1e5a6e" opacity="0.28"/>'
                      f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="3" ry="1.1" fill="none" stroke="#e9fbf6" stroke-width="0.65" opacity="0.85"/>'
                      f'<path d="M{f(x - 5)},{f(y + 1.6)} q2.5,-0.9 5,0" fill="none" stroke="#e9fbf6" stroke-width="0.45" opacity="0.5"/>')
            else:
                c.add(f'<ellipse cx="{f(x + 0.9)}" cy="{f(y + 0.25)}" rx="2.1" ry="0.8" fill="{iso.INK}" opacity="0.38"/>')

    sc.ground.append(ground)
    side = D["mid"] if lightness(p) > 0.55 else D["shade"]
    end_col = D["mid"] if lightness(d) > 0.55 else D["shade"]
    start_col = D["mid"] if lightness((-d[0], -d[1])) > 0.55 else D["shade"]
    rnd = random.Random(seed)
    tones = [rnd.choice([D["hi"], D["lit"], D["lit"], D["mid"], D["lit"]]) for _ in range(400)]
    TH = 1.8                                       # deck thickness (the visible side face)

    def post(u, v, top):
        a, b = W(u, v)
        ag.pole(c, a, b, -0.4, top, w=2.0)

    def face(u0, u1, v, col):
        return f'<path d="{poly([Pp(u0, v, JZ), Pp(u1, v, JZ), Pp(u1, v, JZ - TH), Pp(u0, v, JZ - TH)])}" fill="{col}"/>'

    def end_face(u, hw_, col):
        return f'<path d="{poly([Pp(u, -hw_, JZ), Pp(u, hw_, JZ), Pp(u, hw_, JZ - TH), Pp(u, -hw_, JZ - TH)])}" fill="{col}"/>'

    last_i = len(widths) - 1

    def section(i):
        u0, u1, hw_ = us[i], us[i + 1], widths[i]
        is_head = head and i == n
        last = i == last_i
        top = JZ + (3.6 if is_head else (2.6 if last else 0.9))
        mine = [(u, v) for u, v in posts if (u0 <= u < u1 or (last and u == u1)) and abs(v) <= hw_]
        for u, v in mine:
            if v < -0.1:
                post(u, v, top)
        # under the deck: a diagonal brace between the near posts where the jetty stands in water
        if wet(u1, hw_) and not is_head:
            pa_, pb_ = Pp(u0, hw_ - 0.8, JZ - TH), Pp(u1, hw_ - 0.8, 0.3)
            c.add(f'<path d="M{f(pa_[0])},{f(pa_[1])} L{f(pb_[0])},{f(pb_[1])}" stroke="{D["dark"]}" stroke-width="1.1"/>')
        # deck: dark underlay (shows in the gaps), the near side face and the beam under it
        c.add(f'<path d="{poly([Pp(u0, -hw_, JZ - 0.6), Pp(u1, -hw_, JZ - 0.6), Pp(u1, hw_, JZ - 0.6), Pp(u0, hw_, JZ - 0.6)])}" fill="{D["dark"]}"/>'
              + face(u0, u1, hw_, side)
              + f'<path d="{poly([Pp(u0, hw_ - 0.6, JZ - TH), Pp(u1, hw_ - 0.6, JZ - TH), Pp(u1, hw_ - 0.6, JZ - TH - 1.4), Pp(u0, hw_ - 0.6, JZ - TH - 1.4)])}" fill="{D["dark"]}"/>')
        if is_head:                                # the head's side faces toward the narrow part
            for v0, v1 in ((JW, JH), (-JH, -JW)):
                if d[0] + d[1] < 0:
                    c.add(f'<path d="{poly([Pp(u0, v0, JZ), Pp(u0, v1, JZ), Pp(u0, v1, JZ - TH), Pp(u0, v0, JZ - TH)])}" fill="{start_col}"/>')
        # cross planks
        out = []
        u = u0
        k = int(u0 * 7) % 300
        while u < u1 - 0.3:
            w_ = min(1.8 + (k % 3) * 0.25, u1 - u)
            out.append(f'<path d="{poly([Pp(u, -hw_, JZ), Pp(u + w_ - 0.26, -hw_, JZ), Pp(u + w_ - 0.26, hw_, JZ), Pp(u, hw_, JZ)])}" fill="{tones[k % 400]}"/>')
            u += w_
            k += 1
        c.add("".join(out))
        x0, y0 = Pp(u0, hw_, JZ)
        x1, y1 = Pp(u1, hw_, JZ)
        c.add(f'<path d="M{f(x0)},{f(y0)} L{f(x1)},{f(y1)}" stroke="{D["hi"]}" stroke-width="0.55" opacity="0.9"/>')
        if last and d[0] + d[1] > 0:
            c.add(end_face(u1, hw_, end_col))
        if i == 0 and d[0] + d[1] < 0:
            c.add(end_face(u0, hw_, start_col))
        for fn in deck_props.get(i, []):
            fn()
        for u, v in mine:
            if v >= -0.1:
                post(u, v, top)
        if last:                                   # bollard caps on the outer posts
            for u, v in mine:
                if abs(v) > 1:
                    x, y = c.P(*W(u, v), top)
                    c.add(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="1.5" ry="0.75" fill="{D["hi"]}"/>')

    deck_props = {}
    for i in range(len(widths)):
        a, b = W((us[i] + us[i + 1]) / 2, 0)
        sc.add(a + b, lambda i=i: section(i))
    return posts, W, us, deck_props


# ---------------------------------------------------------------------------
# Moored fishing boat (any direction)
# ---------------------------------------------------------------------------
def boat(sc, ca, cb, d, L=BOAT_L, HWB=BOAT_HW, mast=True):
    """Fishing boat afloat, centred at (ca, cb), bow toward the unit direction d: painted eye,
    owner-colour stripe under the gunwale and a lateen sail in the boat's own vertical plane
    (mast=False: an open rowing boat without mast and sail, used by the harbor). Returns (W, gz): the boat's point
    function W(u, v, z) (u = -1 stern ... 1 bow) and its gunwale height gz(u)."""
    c = sc.c
    p = toward_viewer(d)

    def W(u, v, z):
        return c.P(ca + u * L * d[0] + v * p[0], cb + u * L * d[1] + v * p[1], z)

    def hw(u):
        return HWB * max(0.0, 1 - abs(u) ** 2.4) ** 0.55

    def gz(u):
        return 3.4 + 3.2 * abs(u) ** 3 + (1.2 * u ** 4 if u > 0 else 0)

    n = 28
    us = [-1 + 2 * i / n for i in range(n + 1)]
    near = [W(u, hw(u), gz(u)) for u in us]
    far = [W(u, -hw(u), gz(u)) for u in us]
    wl = [W(u * 0.86, hw(u) * 0.86, 0) for u in us]
    wlf = [W(u * 0.86, -hw(u) * 0.86, 0) for u in us]
    for u, z in ((-1.05, 0), (1.05, 0), (-0.55, 44 if mast else 8), (0, 44 if mast else 8), (0.95, 10)):
        for v in (-HWB, HWB):
            sc.extent((ca + u * L * d[0] + v * p[0], cb + u * L * d[1] + v * p[1], z))

    def ground():
        cx, cy = W(0, 0, 0)
        sh = [(cx + (x - cx) * 1.3 + 3, cy + (y - cy) * 1.45 + 0.8) for x, y in iso.hull(wl + wlf)]
        c.add(f'<path d="{poly(sh)}" fill="#0d4a5c" opacity="0.32" filter="{c.blur(1.6)}"/>')

    sc.ground.append(ground)
    lit = lightness(p)

    def draw():
        c.add(f'<path d="{poly(iso.hull(near + far + wl + wlf))}" fill="{WOOD["dark"]}"/>')
        hg = c.lin("hull", 0, 0, 1, 0, [(0, "#6a4227"), (0.3, WOOD["lit"]), (0.75, WOOD["base"]), (1, WOOD["dark"])], bbox=True)
        c.add(f'<path d="{poly(near + wl[::-1])}" fill="{hg}"/>')
        if lit < 0.45:
            c.add(f'<path d="{poly(near + wl[::-1])}" fill="#1d2b36" opacity="{f(0.35 * (0.45 - lit) / 0.45 + 0.08)}"/>')

        def lerp(pa, pb, t):
            return [(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t) for (x0, y0), (x1, y1) in zip(pa, pb)]

        strake = lerp(near, wl, 0.62)
        c.add(f'<path d="M{" L".join(f"{f(x)},{f(y)}" for x, y in strake[2:-2])}" fill="none" stroke="{WOOD["deep"]}" stroke-width="0.5" opacity="0.6"/>'
              f'<path d="M{" L".join(f"{f(x)},{f(y)}" for x, y in lerp(near, wl, 0.82)[3:-3])}" fill="none" stroke="#1d2b36" stroke-width="0.9" opacity="0.35"/>')
        band = lerp(near, wl, 0.42)
        sg = c.lin("stripe", 0, 0, 1, 0, [(0, ACCENT["lit"]), (0.6, ACCENT["light"]), (1, ACCENT["shade"])], bbox=True)
        c.accent(f'<path d="{poly(near[1:-1] + band[1:-1][::-1])}" fill="{sg}"/>')
        if lit < 0.45:
            c.add(f'<path d="{poly(near[1:-1] + band[1:-1][::-1])}" fill="#1d2b36" opacity="0.18"/>')
        ex, ey = lerp(near, wl, 0.5)[int(n * 0.86)]
        c.add(f'<ellipse cx="{f(ex)}" cy="{f(ey)}" rx="1.9" ry="1.05" fill="#f6f0e2"/><circle cx="{f(ex + 0.3)}" cy="{f(ey)}" r="0.7" fill="#1d2b36"/>'
              f'<path d="M{f(ex - 2)},{f(ey - 0.9)} Q{f(ex)},{f(ey - 2)} {f(ex + 2)},{f(ey - 0.6)}" fill="none" stroke="#1d2b36" stroke-width="0.45"/>')
        ig = c.lin("inner", 0, 0, 0, 1, [(0, "#b9845a"), (0.45, "#7e5030"), (1, "#3e2514")], bbox=True)
        c.add(f'<path d="{poly(near + far[::-1])}" fill="{ig}"/>')
        for u in (-0.42, 0.28):
            p0, p1 = W(u, -hw(u) * 0.9, gz(u) - 0.6), W(u, hw(u) * 0.9, gz(u) - 0.6)
            c.add(f'<path d="M{f(p0[0])},{f(p0[1])} L{f(p1[0])},{f(p1[1])}" stroke="{WOOD["lit"]}" stroke-width="1.6"/>'
                  f'<path d="M{f(p0[0])},{f(p0[1] + 0.8)} L{f(p1[0])},{f(p1[1] + 0.8)}" stroke="{WOOD["deep"]}" stroke-width="0.5" opacity="0.6"/>')
        c.add(f'<path d="M{" L".join(f"{f(x)},{f(y)}" for x, y in far)}" fill="none" stroke="{WOOD["base"]}" stroke-width="0.9"/>'
              f'<path d="M{" L".join(f"{f(x)},{f(y)}" for x, y in near)}" fill="none" stroke="#c99a6a" stroke-width="1"/>'
              f'<path d="M{" L".join(f"{f(x)},{f(y + 0.4)}" for x, y in wl[3:-2])}" fill="none" stroke="#e9fbf6" stroke-width="0.9" opacity="0.8"/>')
        if not mast:
            return
        # mast + lateen sail in the boat's vertical plane (local x along the boat from its centre)
        ma = -1.5
        tack, peak, clew = (14.5, 9.6), (-16, 42), (-10, 8.2)
        mz = tack[1] + (peak[1] - tack[1]) * (tack[0] - ma) / (tack[0] - peak[0]) + 1.2
        ag.pole(c, ca + ma * d[0], cb + ma * d[1], 2, mz, w=1.4, pal={"hi": "#c99a6a", "mid": WOOD["base"], "dark": WOOD["deep"]})
        m = c.m_vplane(ca, cb, d[0], d[1])
        sail = (f"M{f(tack[0])},{f(tack[1])} L{f(peak[0])},{f(peak[1])} Q{f(-16.5)},{f(21)} {f(clew[0])},{f(clew[1])} "
                f"Q{f(1.5)},{f(5.6)} {f(tack[0])},{f(tack[1])}Z")
        if lit > 0.4:
            st = [(0, ACCENT["light"]), (0.35, ACCENT["lit"]), (0.7, ACCENT["light"]), (1, ACCENT["mid"])]
        else:
            st = [(0, ACCENT["mid"]), (0.35, ACCENT["light"]), (0.7, ACCENT["mid"]), (1, ACCENT["shade"])]
        sgr = c.lin("sail", 0, 0, 1, 1, st, bbox=True)
        c.accent(c.on(m, f'<path d="{sail}" fill="{sgr}"/>'))
        seams = []
        for t in (0.2, 0.4, 0.6, 0.8):
            pp = (tack[0] + (peak[0] - tack[0]) * t, tack[1] + (peak[1] - tack[1]) * t)
            q = (clew[0] + (tack[0] - clew[0]) * t * 0.9 + 1.5, clew[1] + (tack[1] - clew[1]) * t * 0.9 - 0.4)
            seams.append(f"M{f(pp[0])},{f(pp[1])} L{f(q[0])},{f(q[1])}")
        fold = c.lin("sailfold", 1, 0, 0, 0, [(0, "#1d2b36", 0.28), (0.35, "#1d2b36", 0), (1, "#1d2b36", 0)], bbox=True)
        c.add(c.on(m, f'<path d="{sail}" fill="{fold}"/>'
                   f'<path d="{"".join(seams)}" stroke="#1d2b36" stroke-width="0.35" opacity="0.22"/>'
                   f'<path d="M{f(tack[0] + 1.2)},{f(tack[1] - 0.6)} L{f(peak[0] - 1)},{f(peak[1] + 0.5)}" stroke="{WOOD["dark"]}" stroke-width="1.1" stroke-linecap="round"/>'
                   f'<path d="M{f(tack[0] + 1.2)},{f(tack[1] - 0.6)} L{f(peak[0] - 1)},{f(peak[1] + 0.5)}" stroke="#c99a6a" stroke-width="0.4" transform="translate(0 0.4)"/>'
                   f'<path d="M{f(clew[0])},{f(clew[1])} L{f(-12.5)},{f(gz(-0.86) + 0.2)}" stroke="#5e4a36" stroke-width="0.35"/>'
                   f'<path d="M{f(ma)},{f(mz)} L{f(L - 0.5)},{f(gz(1) - 0.3)}" stroke="#5e4a36" stroke-width="0.3" opacity="0.8"/>'))
        x, y = c.P(ca + ma * d[0], cb + ma * d[1], mz)
        c.add(f'<circle cx="{f(x)}" cy="{f(y)}" r="1" fill="{WOOD["dark"]}"/>')

    sc.add(ca + cb, draw)
    return W, gz


def oar(c, a0, b0, a1, b1):
    """An oar lying on the sand from the handle (a0, b0) to the blade (a1, b1)."""
    D = ag.DRIFT
    x0, y0 = c.P(a0, b0, 0.8)
    x1, y1 = c.P(a1, b1, 0.8)
    c.add(f'<path d="M{f(x0 + 1)},{f(y0 + 0.9)} L{f(x1 + 1)},{f(y1 + 0.9)}" stroke="{iso.INK}" stroke-width="1.6" opacity="0.3" stroke-linecap="round"/>'
          f'<path d="M{f(x0)},{f(y0)} L{f(x1)},{f(y1)}" stroke="{D["mid"]}" stroke-width="1.3" stroke-linecap="round"/>'
          f'<path d="M{f(x0)},{f(y0 - 0.4)} L{f(x1)},{f(y1 - 0.4)}" stroke="{D["hi"]}" stroke-width="0.45" stroke-linecap="round"/>')
    ang = math.degrees(math.atan2(y1 - y0, x1 - x0))
    c.add(f'<g transform="translate({f(x1)} {f(y1)}) rotate({f(ang)})"><path d="M-1,1.6 C2,0.2 6,0 11,1 C12,1.8 12,2.6 11,3.2 C6,3.6 2,3 -1,1.6Z" fill="{iso.INK}" opacity="0.3"/>'
          f'<path d="M-1.5,0 C1.5,-1.3 6,-1.5 10.5,-1 C11.6,-0.4 11.6,0.6 10.5,1.2 C6,1.6 1.5,1.3 -1.5,0Z" fill="{D["lit"]}"/>'
          f'<path d="M0.5,-0.4 C3,-1 7,-1.1 10,-0.6" fill="none" stroke="{D["hi"]}" stroke-width="0.6"/></g>')
def shells(c, items):
    """Tiny shells on the sand: list of (a, b, seed)."""
    out = []
    for a, b, seed in items:
        rnd = random.Random(seed)
        x, y = c.P(a, b, 0)
        col = rnd.choice(["#fff6ea", "#f6d9cf", "#f1e4c8"])
        rot = rnd.uniform(-40, 40)
        out.append(f'<g transform="translate({f(x)} {f(y)}) rotate({f(rot)})"><ellipse cx="0.4" cy="0.3" rx="1.3" ry="0.7" fill="{iso.INK}" opacity="0.25"/>'
                   f'<path d="M-1.2,0 Q0,-1.6 1.2,0Z" fill="{col}"/><path d="M0,0 L0,-0.9 M-0.6,-0.1 L-0.4,-0.7 M0.6,-0.1 L0.4,-0.7" stroke="#c9a890" stroke-width="0.2"/></g>')
    c.add("".join(out))
def nets(c, nb, na0, na1, seed=1):
    """A fishing net hung between two poles in the plane b = nb, from a = na0 to na1."""
    ztop, zbot, hz = 19, 4.5, 22
    mid = (na0 + na1) / 2
    q1 = (na0 + (na1 - na0) * 0.3, zbot - 1.5)
    q2 = (na0 + (na1 - na0) * 0.72, zbot + 2.5)
    foot = f"L{f(na1 - 0.8)},{f(zbot + 4)} C{f(q2[0] + 4)},{f(zbot + 1)} {f(q2[0])},{f(q2[1])} {f(mid)},{f(zbot + 0.5)} S{f(q1[0])},{f(q1[1])} {f(na0 + 1)},{f(zbot + 2.5)}"
    shape = f"M{f(na0)},{f(ztop)} Q{f(mid)},{f(ztop - 7)} {f(na1)},{f(ztop)} {foot}Z"
    cid = c.define("net" + str(seed), f'<clipPath id="{c.id("net" + str(seed))}"><path d="{shape}"/></clipPath>')
    mesh = []
    s = 1.7
    for i in range(-12, int((na1 - na0) / s) + 12):
        x = na0 + i * s
        mesh.append(f"M{f(x)},{f(ztop + 1)} l{f(ztop - zbot + 4)},{f(-(ztop - zbot + 4))}M{f(x)},{f(ztop + 1)} l{f(-(ztop - zbot + 4))},{f(-(ztop - zbot + 4))}")
    # soft shadow of the net on the grass
    iso.blob_shadow(c, mid + 7, nb - 1, (na1 - na0) * 0.42, 0.22)
    c.add(c.on(c.m_bface(nb), f'<path d="{shape}" fill="#b7975f" opacity="0.45"/>'
               f'<g clip-path="{cid}"><path d="{"".join(mesh)}" stroke="#5e4428" stroke-width="0.4" opacity="0.9"/></g>'
               f'<path d="M{f(na0)},{f(ztop)} Q{f(mid)},{f(ztop - 7)} {f(na1)},{f(ztop)}" fill="none" stroke="#5e4a36" stroke-width="0.6"/>'
               f'<path d="M{f(na1 - 0.8)},{f(zbot + 4)} {foot[foot.index("C"):]}" fill="none" stroke="#6e5232" stroke-width="0.55"/>'))
    # cork floats on the head rope, lead weights at the foot
    fl = []
    for i in range(1, 6):
        t = i / 6
        a = na0 + (na1 - na0) * t
        z = ztop - 7 * 4 * t * (1 - t) * 0.5 - 0.4
        x, y = c.P(a, nb, z)
        fl.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="1.2" ry="0.85" fill="#e3c27a"/><ellipse cx="{f(x - 0.3)}" cy="{f(y - 0.3)}" rx="0.5" ry="0.35" fill="#fff1c8"/>')
    c.add("".join(fl))
    for a in (na0, na1):
        ag.pole(c, a, nb, 0, hz, w=1.5)
def fish_trap(c, a, b, k=1.0, seed=1):
    """Bulbous wicker fish trap lying on the grass, its funnel mouth facing +a (the viewer)."""
    Wk = ag.WICKER
    rmax, ln = 3.6 * k, 9.5 * k
    n = 9
    iso.blob_shadow(c, a - ln * 0.4 + 3, b, ln * 0.5, 0.34)
    rg = c.rad("trapR", 0.36, 0.3, 0.75, [(0, Wk["hi"]), (0.45, Wk["lit"]), (0.8, Wk["base"]), (1, Wk["shade"])], bbox=True)
    out = []
    for i in range(n + 1):
        t = i / n
        rr = rmax * (0.38 + 0.62 * math.sin(math.pi * (0.12 + 0.62 * t)))
        aa = a - ln * (1 - t)
        out.append(c.on(c.m_aface(aa), f'<circle cx="{f(-b)}" cy="{f(rmax)}" r="{f(rr)}" fill="{rg}"/>'
                        f'<circle cx="{f(-b)}" cy="{f(rmax)}" r="{f(rr)}" fill="none" stroke="{Wk["dark"]}" stroke-width="{f(0.45 * k)}" opacity="{0.55 if i % 2 else 0.25}"/>'))
    c.add("".join(out))
    r_m = rmax * (0.38 + 0.62 * math.sin(math.pi * 0.74))
    c.add(c.on(c.m_aface(a), f'<circle cx="{f(-b)}" cy="{f(rmax)}" r="{f(r_m - 0.6 * k)}" fill="{Wk["dark"]}"/>'
               f'<circle cx="{f(-b + 0.3 * k)}" cy="{f(rmax - 0.3 * k)}" r="{f(r_m * 0.45)}" fill="#24180c"/>'
               f'<circle cx="{f(-b)}" cy="{f(rmax)}" r="{f(r_m - 0.3 * k)}" fill="none" stroke="{Wk["hi"]}" stroke-width="{f(0.6 * k)}" stroke-dasharray="1.1 0.8"/>'))


# ---------------------------------------------------------------------------
# The whole scene for one edge direction
# ---------------------------------------------------------------------------
def scene(c, e, lay, shift=0.0):
    """The whole fishery for edge e. lay: a LAYOUT entry. shift moves every distance toward the
    water by this many user units (the icon uses a negative shift to sit inside its canvas)."""
    water = WATER_FROM + shift
    sc = Scene(c, e, water)
    wn = edge_world(e)
    wt = screen_world(60 * e + 90)               # along the shore
    corners = [(sa * (HA + 1.5), sb) for sa in (-1, 1) for sb in (-HB - 1.5, DECK_B)]
    n_h = HUT_EDGE + shift - max(along(e, *q) for q in corners)
    ha, hb = n_h * wn[0] + lay["shift"] * wt[0], n_h * wn[1] + lay["shift"] * wt[1]

    def rel(a, b):
        return ha + a, hb + b

    # the short jetty from the hut's deck to JETTY_END (measured toward the edge)
    tilt = JETTY_TILT.get(e, 0)
    w = screen_world(60 * e + tilt)
    k = math.hypot(*w)
    d = (w[0] / k, w[1] / k)
    p = toward_viewer(d)
    per = along(e, *d)                           # user units toward the edge per world unit along d
    o = rel(lay["attach"][0] + 2.0 * d[0], lay["attach"][1] + 2.0 * d[1])
    L = (JETTY_END + shift - along(e, *o)) / per
    posts, JW_pt, us, deck_props = jetty(sc, o, d, L)

    # the boat moored alongside, bow swung a little away from the jetty
    side, swing = lay["side"], lay["swing"]
    r = math.radians(swing)
    bd = (math.cos(r) * d[0] + side * math.sin(r) * p[0], math.cos(r) * d[1] + side * math.sin(r) * p[1])
    lat = side * (JW + 1.6 + lay.get("boat_gap", 0) + BOAT_HW + BOAT_L * math.sin(r))
    bs = (lay.get("boat_at", BOAT_AT) + shift - along(e, *o)) / per
    ca, cb = o[0] + bs * d[0] + lat * p[0], o[1] + bs * d[1] + lat * p[1]
    bW, bgz = boat(sc, ca, cb, bd)

    # mooring line from the boat's stern to the nearest jetty post on its side
    sx, sy = bW(-0.95, 0, bgz(-0.95) + 0.3)
    sa, sb = ca - 0.95 * BOAT_L * bd[0], cb - 0.95 * BOAT_L * bd[1]
    pu, pv = min(((u, v) for u, v in posts if v * side > 0), key=lambda q: math.hypot(JW_pt(*q)[0] - sa, JW_pt(*q)[1] - sb))
    pa, pb = JW_pt(pu, pv)
    px, py = c.P(pa, pb, JZ + 1.4)

    def rope():
        mx, my = (sx + px) / 2, (sy + py) / 2 + 2.2
        c.add(f'<path d="M{f(sx)},{f(sy)} Q{f(mx)},{f(my)} {f(px)},{f(py)}" fill="none" stroke="#6e5638" stroke-width="0.6"/>'
              f'<path d="M{f(sx)},{f(sy - 0.25)} Q{f(mx)},{f(my - 0.25)} {f(px)},{f(py - 0.25)}" fill="none" stroke="#c9ab7a" stroke-width="0.25"/>')
    sc.add(max(ca + cb, pa + pb) + 0.5, rope)

    # a fish basket and a coil of rope at the end of the jetty
    i_last = len(us) - 2

    def deck_things():
        a, b = JW_pt(L - 3.2, -1.2 * side)
        x, y = c.P(a, b, JZ)
        c.add(f'<ellipse cx="{f(x + 0.6)}" cy="{f(y + 0.3)}" rx="3" ry="1.3" fill="#2d2418" opacity="0.35"/>'
              + "".join(f'<ellipse cx="{f(x)}" cy="{f(y - i * 0.5)}" rx="{f(2.6 - i * 0.35)}" ry="{f(1.15 - i * 0.15)}" fill="none" stroke="{"#d9c08a" if i % 2 else "#b49560"}" stroke-width="0.75"/>' for i in range(4)))
        a, b = JW_pt(L - 7, 1.2 * side)
        ag.basket(c, a, b, k=0.8, contents="fish", seed=4, z=JZ)
    deck_props.setdefault(i_last, []).append(deck_things)

    # the hut: stilts in the water get foam rings; beach grass only on its land-side edges
    stilts = [rel(sa, sb) for sa in (-HA - 0.5, 0, HA + 0.5) for sb in (-HB - 0.5, HB, DECK_B - 1)]

    def stilt_water():
        for a, b in stilts:
            if along(e, a, b) > water:
                x, y = c.P(a, b, 0)
                c.add(f'<rect x="{f(x - 1)}" y="{f(y)}" width="2" height="3.6" fill="#1e5a6e" opacity="0.28"/>'
                      f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="3.2" ry="1.15" fill="none" stroke="#e9fbf6" stroke-width="0.65" opacity="0.85"/>')
    sc.ground.append(stilt_water)
    edges = [((-HA - 1.5, DECK_B + 1), (HA + 1.5, DECK_B + 1)), ((HA + 1.5, DECK_B), (HA + 1.5, -HB - 1.5))]
    land_edges = [(rel(*q0), rel(*q1)) for q0, q1 in edges if along(e, *rel(*q0)) < water - 14 and along(e, *rel(*q1)) < water - 14]

    def hut_item():
        with c.at(ha, hb):
            hut(c)
            x, y = c.P(HA + 2.2, 0, ZTOP - 0.5)
            raw.pennant(c, x, y, length=16, height=7.5, pole=13)
        if land_edges:
            iso.foot_tufts(c, land_edges, n=8, seed=6 + e, hmax=5, kind="beach", stones=2)
    sc.add(ha + hb, hut_item)
    for sa_, sb_ in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        sc.extent(rel(sa_ * (HA + 3), sb_ * (HB + 4) + (5 if sb_ > 0 else 0)) + (0,), rel(sa_ * (HA + 3), sb_ * (HB + 4)) + (ZTOP + 1,))
    sc.extent(rel(HA + 10, -8) + (ZTOP + 13,), rel(HA + 24, -HB) + (0,), rel(HA + 24, DECK_B) + (0,))

    land = [rel(a_, b_) for _, a_, b_, _ in lay["props"]] + [(ha, hb)]

    def ground():
        iso.ground_ao(c, [(ha - HA - 3, hb - HB - 3), (ha + HA + 4, hb - HB - 3), (ha + HA + 4, hb + DECK_B + 6), (ha - HA - 3, hb + DECK_B + 6)], grow=6, opacity=0.13)
        iso.ground_ao(c, land, grow=8, opacity=0.08)
    sc.ground.insert(0, ground)

    # props on the land side, close around the hut
    for kind, ra, rb, size in lay["props"]:
        a, b = rel(ra, rb)
        if kind == "net":
            sc.add(a + b, lambda a=a, b=b: nets(c, b, a - 12, a + 12, seed=1))
            sc.extent((a - 12, b, 23), (a + 12, b, 23), (a + 22, b, 0), (a - 13, b + 3, 0))
            continue
        if kind == "trap":
            sc.add(a + b, lambda a=a, b=b, size=size: fish_trap(c, a, b, k=size, seed=int(a)))
        elif kind == "basket":
            sc.add(a + b, lambda a=a, b=b, size=size: ag.basket(c, a, b, k=size, contents="fish", seed=int(b)))
        elif kind == "amphora":
            sc.add(a + b, lambda a=a, b=b, size=size: iso.amphora(c, a, b, k=size, shaded=False))
        elif kind == "oars":
            sc.add(a + b, lambda a=a, b=b: (oar(c, a, b, a + 20, b + 2), oar(c, a + 2, b + 4.5, a + 22, b + 6.5)))
            sc.extent((a + 24, b + 8, 0))
        sc.extent((a - 6, b - 2, 0), (a + 7, b + 3, 0), (a, b, 12))
    shell_spots = [rel(ra, rb) for ra, rb in ((14, 38), (24, 40), (-30, 28), (36, 12), (-36, 6), (30, -14), (-20, 36))]
    sc.ground.append(lambda: shells(c, [(a, b, i) for i, (a, b) in enumerate(shell_spots)
                                        if along(e, a, b) < water - 12 and screen_dist((a, b), o, d, L) > 9]))
    sc.draw()
    sc.hut_along = n_h
    return sc


def build():
    out = []
    # compact icon on the normal 256 canvas: the south-east scene, slid inside the canvas
    c = iso.Canvas("fishery")
    iso.ground(c)
    scene(c, 1, LAYOUT[1], shift=-108)
    out.append(c)
    for e in range(6):
        c = iso.Canvas("fishery", pid=f"fishery-e{e}", stem=f"fishery.e{e}")
        iso.ground(c)
        sc = scene(c, e, LAYOUT[e])
        c.viewbox = sc.viewbox()
        c.anchor_marker = True
        out.append(c)
    return out


if __name__ == "__main__":
    dst = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    for canvas in build():
        print("\n".join(canvas.write(dst)))
