"""harbor - a harbour at the real shore (M6, docs/ART.md "Seafaring and ocean"): on land a
whitewashed warehouse with a tiled roof, a striped awning over its goods and a banner; toward the
water a broad stone quay of cut blocks with bollards and a lit coping reaching over the shared
edge into the real water tile; on the quay an A-frame crane (shear legs) lowering a net of
amphorae into a small moored rowing boat, with stacks of amphorae, crates and sacks at the
quay's root. No big ship: ships are units in the game. No painted water (the game draws it).

Files (all built by this script), like the fishery:
    harbor.svg          the compact icon on the normal 256 canvas (quay toward the south-east)
    harbor.e0 ... e5    the map versions, one per hex edge e (screen angle 60 deg * e, y down:
                        0 east, 1 south-east, 2 south-west, 3 west, 4 north-west, 5 north-east);
                        the game picks the one whose quay reaches into the real coastal water.
                        Same user units and anchor as the normal canvas, own tight viewBox,
                        data-anchor="128 176" on the root <svg>.
Layout of a map version (user units from the tile centre toward the water edge; the shared edge
is at 113): the warehouse stands on land (its water side at about 60), the quay starts on the
beach at 82 and ends at 165, the crane stands on its outer part, the rowing boat lies beside it.
Shared human scale (README "Scale"): door 9 x 16, warehouse 40 x 24, quay 16 wide.
Reuses the direction geometry, the painter's sort (Scene) and the boat of fishery.py.
Accent (owner colour): the warehouse door, the two-tone awning, the banner, the crane's pennant
and the boat's hull stripe."""
import sys

sys.dont_write_bytecode = True
import math  # noqa: E402
import os  # noqa: E402
import random  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fishery as fs  # noqa: E402
import iso  # noqa: E402
import lib_civic as lc  # noqa: E402
import lib_raw as raw  # noqa: E402
from iso import WOOD, f, poly  # noqa: E402

# warehouse (world units, drawn around its own centre)
A, B = 20, 12          # walls 40 x 24 (README "Scale")
F = 3                  # stone footing
H = 24                 # wall height
R = 8                  # roof rise
T = 3.4
AV, BV = A + 3, B + 4
TANP = R / B
ZR = H + R + T
# quay
QUAY_FROM = 82.0       # the quay starts on the beach (user units toward the edge)
QUAY_TO = 165.0        # ... and reaches over the shared edge (113) into the water tile
WATER_FROM = 110.0     # the parts beyond this stand in water (foam, wet band); shore ~95-125
QW, QZ = 10.0, 6.5     # quay half width and height (world units): broad and sturdy
CRANE_U = 0.62         # the crane's place along the quay (share of its length)
# boat (an open rowing boat, see fishery.boat)
BOAT_L, BOAT_HW = 12.0, 4.4
# per edge (user units in the edge frame: s toward the water, t along the shore, + = clockwise):
#   house    (s, t) of the warehouse's water-side point; side: the boat's side of the quay
#   (+1 = toward the viewer); goods: (kind, s, t) at the quay's root
LAYOUT = {
    0: dict(house=(66, -30), side=1, goods=[("amph", 84, 22), ("crates", 72, 24), ("sacks", 92, -20), ("banner", 90, -15)]),
    1: dict(house=(66, -32), side=-1, goods=[("amph", 76, 24), ("crates", 88, -22), ("sacks", 70, 30), ("banner", 88, -15)]),
    2: dict(house=(66, 32), side=-1, goods=[("amph", 76, -24), ("crates", 88, 22), ("sacks", 70, -30), ("banner", 88, 15)]),
    3: dict(house=(66, 30), side=1, goods=[("amph", 84, -22), ("crates", 72, -24), ("sacks", 92, 20), ("banner", 90, 15)]),
    4: dict(house=(58, 40), side=1, goods=[("amph", 82, -22), ("crates", 72, -28), ("sacks", 90, 20), ("banner", 88, 15)]),
    5: dict(house=(58, -40), side=1, goods=[("amph", 82, 22), ("crates", 72, 28), ("sacks", 90, -20), ("banner", 88, -15)]),
}
STONE = {"top": "#efe5cb", "top2": "#e6d9b9", "top3": "#ddcfae", "lit": "#e2d4b4", "shade": "#b3a68c",
         "joint": "#8f826b", "coping": "#fbf4e2", "wet": "#6f7d62", "deep": "#5a5244"}


def frame(e):
    """World displacement per user unit toward edge e (wn) and along the shore (wt)."""
    return fs.edge_world(e), fs.screen_world(60 * e + 90)


def at_st(e, s, t):
    wn, wt = frame(e)
    return s * wn[0] + t * wt[0], s * wn[1] + t * wt[1]


# ---------------------------------------------------------------------------
# Warehouse (axis-aligned, its front faces +b like every building)
# ---------------------------------------------------------------------------
def warehouse(c):
    ze = ZR - BV * TANP
    iso.cast_shadow(c, [(sa * (A + 1), sb * (B + 1)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * AV, sb * BV, ze) for sa in (-1, 1) for sb in (-1, 1)] + [(sa * AV, 0, ZR + 2) for sa in (-1, 1)])
    iso.contact_ao(c, -A - 1.2, A + 1.2, -B - 1.2, B + 1.2)
    iso.stone_course(c, A + 1.2, B + 1.2, F, seed=7)
    iso.lime_wall_b(c, B, -A, A, F, H, seed=13, mottle=10)
    iso.lime_wall_a(c, A, -B, B, F, H, gable=R)
    # gable: a loading hatch; front: the owner-colour door, two slit vents
    c.add(c.on(c.m_aface(A), f'<rect x="-4.5" y="{f(H - 9)}" width="9" height="8" fill="#5e4a36"/><rect x="-3.8" y="{f(H - 8.4)}" width="7.6" height="6.8" fill="#2e2418"/>'
               f'<rect x="-5.2" y="{f(H - 9.8)}" width="10.4" height="1" fill="#a7a49c"/>'))
    iso.door_b(c, B, 6, 15, F, F + 16, accent=True)
    c.add(c.on(c.m_bface(B), "".join(f'<rect x="{f(x)}" y="15" width="4.5" height="2.4" fill="#2e2a26"/><rect x="{f(x - 0.7)}" y="14.3" width="5.9" height="0.8" fill="#e9e2d2"/>'
                                     for x in (-17, 18 - 4.5))))
    iso.eave_shadow_b(c, B, -A, A, H, depth=6)
    iso.box(c, 4.5, 16.5, B, B + 3, 0, 1.5, "#ebe5d6", "#c9c0ad", "#a49c8c")
    iso.foot_tufts(c, [((-A - 1.2, B + 1.2), (A + 1.2, B + 1.2)), ((A + 1.2, B + 1.2), (A + 1.2, -B - 1.2))], n=8, seed=5, kind="beach", stones=2)
    iso.tile_roof_a(c, AV, BV, ZR, TANP, T=T, n=12, courses=4)
    # the awning over the goods under it (left half of the front)
    a0, a1, za, dep, drop = -18, 2, 19, 9, 4
    c.add(f'<path d="{poly([c.P(a0 + 5, B, 0), c.P(a1 + 7, B, 0), c.P(a1 + 7, B + dep - 1, 0), c.P(a0 + 5, B + dep - 1, 0)])}" fill="{iso.INK}" opacity="0.16" filter="{c.blur(1.2)}"/>')
    for a in (-15, -10.5):
        iso.amphora(c, a, B + 3, k=0.6)
    lc.sack(c, -5, B + 3.5, k=0.85)
    for a in (a0 + 0.8, a1 - 0.8):
        x, y = c.P(a, B + dep - 0.4, 0)
        _, yt = c.P(a, B + dep - 0.4, za - drop)
        c.add(f'<ellipse cx="{f(x + 0.5)}" cy="{f(y + 0.2)}" rx="1.7" ry="0.7" fill="{iso.INK}" opacity="0.45" filter="{c.blur(0.45)}"/>'
              f'<rect x="{f(x - 0.85)}" y="{f(yt)}" width="1.7" height="{f(y - yt)}" fill="{WOOD["base"]}"/>'
              f'<rect x="{f(x - 0.85)}" y="{f(yt)}" width="0.6" height="{f(y - yt)}" fill="{WOOD["lit"]}"/>')
    iso.awning_b(c, a0, a1, B, za, depth=dep, drop=drop, stripes=6, two_tone=True)


# ---------------------------------------------------------------------------
# Stone quay (any direction: projected faces, cut blocks, paving, bollards)
# ---------------------------------------------------------------------------
def quay(sc, o, d, L, seed=3):
    """Quay from the ground point o along the unit direction d, L world units long, QW half wide
    and QZ high. Returns (W, us, deck_props): the point function W(u, v), the section ends and a
    dict {section: [draw functions]} for things standing on the quay."""
    c, e = sc.c, sc.e
    p = fs.toward_viewer(d)

    def W(u, v):
        return (o[0] + u * d[0] + v * p[0], o[1] + u * d[1] + v * p[1])

    def Pp(u, v, z):
        return c.P(*W(u, v), z)

    def wet(u):
        return fs.along(e, *W(u, 0)) > WATER_FROM

    n = max(4, round(L / 11))
    us = [L * i / n for i in range(n + 1)]
    for u, v in ((0, -QW), (0, QW), (L, -QW), (L, QW)):
        a, b = W(u, v)
        sc.extent((a, b, -1), (a, b, QZ + 5), (a + 4, b, 0))
    side_col = STONE["lit"] if fs.lightness(p) > 0.55 else STONE["shade"]
    end_col = STONE["lit"] if fs.lightness(d) > 0.55 else STONE["shade"]
    root_col = STONE["lit"] if fs.lightness((-d[0], -d[1])) > 0.55 else STONE["shade"]
    rnd = random.Random(seed)
    tones = [rnd.choice([STONE["top"], STONE["top"], STONE["top2"], STONE["top3"]]) for _ in range(200)]

    def ground():
        # soft shadow of the quay toward +a, a darker wet band where it stands in the water
        sh = [(a + iso.SHX * QZ * 1.6, b + iso.SHY * QZ) for a, b in (W(0, -QW), W(L, -QW), W(L, QW), W(0, QW))]
        c.add(f'<path d="{poly([c.P(a, b, 0) for a, b in sh])}" fill="{iso.INK}" opacity="0.26" filter="{c.blur(1.4)}"/>')

    sc.ground.append(ground)

    def face(u0, u1, v, col, wet_band):
        """The vertical stone face along v from u0 to u1: two courses of cut blocks."""
        out = [f'<path d="{poly([Pp(u0, v, QZ), Pp(u1, v, QZ), Pp(u1, v, 0), Pp(u0, v, 0)])}" fill="{col}"/>']
        joints = []
        x0, y0 = Pp(u0, v, QZ / 2)
        x1, y1 = Pp(u1, v, QZ / 2)
        joints.append(f"M{f(x0)},{f(y0)}L{f(x1)},{f(y1)}")
        for k, (z0, z1) in enumerate(((0, QZ / 2), (QZ / 2, QZ))):
            u = u0 + (2.5 if k else 0) + (int(u0) % 3)
            while u < u1 - 1:
                xa, ya = Pp(u, v, z0)
                xb, yb = Pp(u, v, z1)
                joints.append(f"M{f(xa)},{f(ya)}L{f(xb)},{f(yb)}")
                u += 5.5
        out.append(f'<path d="{"".join(joints)}" stroke="{STONE["joint"]}" stroke-width="0.5" opacity="0.75"/>')
        if wet_band:
            out.append(f'<path d="{poly([Pp(u0, v, 1.3), Pp(u1, v, 1.3), Pp(u1, v, 0), Pp(u0, v, 0)])}" fill="{STONE["wet"]}" opacity="0.7"/>'
                       f'<path d="M{f(Pp(u0, v, 0)[0])},{f(Pp(u0, v, 0)[1] + 0.3)}L{f(Pp(u1, v, 0)[0])},{f(Pp(u1, v, 0)[1] + 0.3)}" stroke="#e9fbf6" stroke-width="1.1" opacity="0.85"/>')
        return "".join(out)

    def endface(u, col, wet_band):
        out = [f'<path d="{poly([Pp(u, -QW, QZ), Pp(u, QW, QZ), Pp(u, QW, 0), Pp(u, -QW, 0)])}" fill="{col}"/>']
        jo = f"M{f(Pp(u, -QW, QZ / 2)[0])},{f(Pp(u, -QW, QZ / 2)[1])}L{f(Pp(u, QW, QZ / 2)[0])},{f(Pp(u, QW, QZ / 2)[1])}"
        for v, z0, z1 in ((-2.5, 0, QZ / 2), (3, 0, QZ / 2), (0.5, QZ / 2, QZ), (-5, QZ / 2, QZ), (5.5, QZ / 2, QZ)):
            jo += f"M{f(Pp(u, v, z0)[0])},{f(Pp(u, v, z0)[1])}L{f(Pp(u, v, z1)[0])},{f(Pp(u, v, z1)[1])}"
        out.append(f'<path d="{jo}" stroke="{STONE["joint"]}" stroke-width="0.5" opacity="0.75"/>')
        if wet_band:
            out.append(f'<path d="{poly([Pp(u, -QW, 1.3), Pp(u, QW, 1.3), Pp(u, QW, 0), Pp(u, -QW, 0)])}" fill="{STONE["wet"]}" opacity="0.7"/>'
                       f'<path d="M{f(Pp(u, -QW, 0)[0])},{f(Pp(u, -QW, 0)[1] + 0.3)}L{f(Pp(u, QW, 0)[0])},{f(Pp(u, QW, 0)[1] + 0.3)}" stroke="#e9fbf6" stroke-width="1.1" opacity="0.85"/>')
        return "".join(out)

    bg = c.lin("boll", 0, 0, 1, 0, [(0, "#a39886"), (0.4, "#7d7262"), (1, "#4e463c")], bbox=True)

    def bollard(u, v):
        """Short round stone bollard (one shared box-relative gradient keeps the file small)."""
        x, y = Pp(u, v, QZ)
        r, h = 1.6, 3.6
        c.add(f'<ellipse cx="{f(x + 1)}" cy="{f(y + 0.3)}" rx="{f(r + 0.8)}" ry="{f(r * 0.5)}" fill="{iso.INK}" opacity="0.35"/>'
              f'<path d="M{f(x - r)},{f(y)}L{f(x - r)},{f(y - h)}A{f(r)},{f(r * 0.5)} 0 0 1 {f(x + r)},{f(y - h)}L{f(x + r)},{f(y)}A{f(r)},{f(r * 0.5)} 0 0 1 {f(x - r)},{f(y)}Z" fill="{bg}"/>'
              f'<ellipse cx="{f(x)}" cy="{f(y - h)}" rx="{f(r)}" ry="{f(r * 0.5)}" fill="#c2b7a2"/>')

    deck_props = {}

    def section(i):
        u0, u1 = us[i], us[i + 1]
        first, last = i == 0, i == n - 1
        wb = wet(u1)
        parts = [face(u0, u1, QW, side_col, wb)]
        if last and d[0] + d[1] > 0:
            parts.append(endface(u1, end_col, wb))
        if first and d[0] + d[1] < 0:
            parts.append(endface(u0, root_col, False))
        # paving slabs in two rows, a lit coping along both long edges
        slabs = []
        u = u0
        k = int(u0 * 3) % 150
        while u < u1 - 0.3:
            w_ = min(5.5 + (k % 3) * 1.2, u1 - u)
            for v0, v1 in ((-QW, 0), (0, QW)):
                slabs.append(f'<path d="{poly([Pp(u + 0.2, v0 + 0.25, QZ), Pp(u + w_ - 0.2, v0 + 0.25, QZ), Pp(u + w_ - 0.2, v1 - 0.25, QZ), Pp(u + 0.2, v1 - 0.25, QZ)])}" fill="{tones[(k + int(v0)) % 200]}"/>')
                k += 1
            u += w_
        parts.append(f'<path d="{poly([Pp(u0, -QW, QZ), Pp(u1, -QW, QZ), Pp(u1, QW, QZ), Pp(u0, QW, QZ)])}" fill="{STONE["joint"]}"/>' + "".join(slabs))
        for v, col, sw in ((QW - 0.2, STONE["coping"], 1.0), (-QW + 0.2, "#f6efdc", 0.6)):
            xa, ya = Pp(u0, v, QZ)
            xb, yb = Pp(u1, v, QZ)
            parts.append(f'<path d="M{f(xa)},{f(ya)}L{f(xb)},{f(yb)}" stroke="{col}" stroke-width="{sw}"/>')
        c.add("".join(parts))
        for fn in deck_props.get(i, []):
            fn()
        # bollards at the outer end and halfway along, on both edges
        if last or i == n // 2:
            for v in (-QW + 2, QW - 2):
                bollard(u1 - 2, v)

    for i in range(n):
        a, b = W((us[i] + us[i + 1]) / 2, 0)
        sc.add(a + b, lambda i=i: section(i))
    return W, us, deck_props


# ---------------------------------------------------------------------------
# A-frame crane (shear legs) lowering a net of amphorae
# ---------------------------------------------------------------------------
def crane(sc, W, u, side):
    """Two timber legs standing on the quay, leaning out over the water on the boat's side, a
    back-stay to a windlass on the quay, the hoisting rope and a net of amphorae."""
    c = sc.c
    lean = side * (QW + 6)
    apex = W(u, lean) + (QZ + 30,)
    feet = [W(u - 6, side * (QW - 2.2)), W(u + 6, side * (QW - 2.2))]
    winch = W(u, -side * (QW - 3))
    load_z = QZ + 6
    for a, b in feet + [winch, W(u, lean)]:
        sc.extent((a, b, QZ), (a, b, QZ + 38), (a + 4, b, QZ))

    def draw():
        # the windlass on the far side of the quay
        wa, wb = winch
        with c.at(wa, wb, QZ):
            iso.box(c, -3.5, 3.5, -1.2, 1.2, 0, 4.5, WOOD["lit"], WOOD["base"], WOOD["dark"])
        raw.log_a(c, wb, QZ + 5.4, wa - 4.5, wa + 4.5, 1.4, seed=7)
        # legs, cross brace, back-stay
        for a, b in feet:
            fx, fy = c.P(a, b, QZ)
            c.add(f'<ellipse cx="{f(fx + 0.6)}" cy="{f(fy + 0.2)}" rx="1.8" ry="0.7" fill="{iso.INK}" opacity="0.4"/>')
            raw.timber(c, (a, b, QZ), apex, w=2.0)
        mid = [((fa + apex[0]) / 2, (fb + apex[1]) / 2, (QZ + apex[2]) / 2 - 2) for fa, fb in feet]
        raw.timber(c, mid[0], mid[1], w=1.3)
        raw.rope(c, apex, (wa, wb, QZ + 5.4), sag=1.5, w=0.6)
        # hoisting rope and the net of amphorae hanging over the boat
        la, lb = W(u, lean)
        raw.rope(c, apex, (la, lb, load_z + 13), w=0.6)
        x, y = c.P(la, lb, load_z)
        with c.at(0, 0, load_z):
            for da, db in ((-1.8, 1.8), (1.8, -1.8), (0, 0)):
                iso.amphora(c, la + da, lb + db, k=0.5, shaded=False)
        # the sling: ropes from the hook down around the amphorae, a mesh in front
        top = y - 16
        sling = (f"M{f(x - 7)},{f(y - 3)}Q{f(x)},{f(y + 5)} {f(x + 7)},{f(y - 3)}"
                 f"M{f(x - 7)},{f(y - 3)}L{f(x)},{f(top)}L{f(x + 7)},{f(y - 3)}"
                 f"M{f(x - 4)},{f(y + 0.8)}L{f(x)},{f(top)}L{f(x + 4)},{f(y + 0.8)}"
                 f"M{f(x - 6.5)},{f(y - 6)}Q{f(x)},{f(y - 1)} {f(x + 6.5)},{f(y - 6)}")
        c.add(f'<path d="{sling}" fill="none" stroke="#5e4428" stroke-width="0.55"/>')
        # pulley block and the owner-colour pennant at the apex
        ax, ay = c.P(*apex)
        c.add(f'<circle cx="{f(ax)}" cy="{f(ay + 1)}" r="1.4" fill="{WOOD["dark"]}"/>')
        raw.pennant(c, ax, ay, length=13, height=6, pole=8)

    return draw


# ---------------------------------------------------------------------------
# The scene for one edge
# ---------------------------------------------------------------------------
def scene(c, e, lay, shift=0.0, quay_to=QUAY_TO):
    """The whole harbour for edge e. lay: a LAYOUT entry; shift moves every distance toward the
    water by this many user units (the icon slides inside its canvas); quay_to: the quay's end."""
    sc = fs.Scene(c, e, WATER_FROM + shift)
    wn, wt = frame(e)
    w = fs.edge_world(e)
    k = math.hypot(*w)
    d = (w[0] / k, w[1] / k)
    p = fs.toward_viewer(d)
    o = at_st(e, QUAY_FROM + shift, 0)
    L = (quay_to - QUAY_FROM) / fs.along(e, *d)
    W, us, deck_props = quay(sc, o, d, L)
    side = lay["side"] * (1 if (p[0] + p[1]) > 0 else -1)

    # the rowing boat moored beside the crane
    uc = L * CRANE_U
    bu = uc + 1.5
    ca, cb = W(bu, side * (QW + 1.8 + BOAT_HW))
    bd = (d[0], d[1])
    bW, bgz = fs.boat(sc, ca, cb, bd, L=BOAT_L, HWB=BOAT_HW, mast=False)

    def oars():
        for v in (-1.4, 1.4):
            p0 = bW(-0.7, v, bgz(-0.7) + 0.4)
            p1 = bW(0.85, v * 0.6, bgz(0.85) + 0.2)
            c.add(f'<path d="M{f(p0[0])},{f(p0[1])} L{f(p1[0])},{f(p1[1])}" stroke="{fs.ag.DRIFT["mid"]}" stroke-width="1.1" stroke-linecap="round"/>')
    sc.add(ca + cb + 0.01, oars)
    # mooring line from the bow to a bollard
    bx, by = bW(0.9, 0, bgz(0.9))
    qa, qb = W(us[-1] - 1.6 if bu > us[-2] else us[min(len(us) - 1, 1 + int(bu / (us[1] or 1)))] - 1.6, side * (QW - 1.6))
    qx, qy = c.P(qa, qb, QZ + 3)
    sc.add(max(ca + cb, qa + qb) + 0.3, lambda: c.add(f'<path d="M{f(bx)},{f(by)} Q{f((bx + qx) / 2)},{f((by + qy) / 2 + 2)} {f(qx)},{f(qy)}" fill="none" stroke="#6e5638" stroke-width="0.6"/>'))

    # the crane on the quay (drawn with the quay section it stands on)
    i_c = min(len(us) - 2, int(uc / (us[1] or 1)))
    deck_props.setdefault(i_c, []).append(crane(sc, W, uc, side))

    # the warehouse on land
    hs, ht = lay["house"]
    hs += shift
    corners = [(sa * (A + 3), sb * (B + 9 if sb > 0 else B + 4)) for sa in (-1, 1) for sb in (-1, 1)]
    ha, hb = at_st(e, 0, ht)
    reach = max(fs.along(e, ha + a, hb + b) for a, b in corners)
    ha, hb = ha + (hs - reach) * wn[0], hb + (hs - reach) * wn[1]

    def house_item():
        with c.at(ha, hb):
            warehouse(c)
    sc.add(ha + hb, house_item)
    for sa_, sb_ in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        sc.extent((ha + sa_ * (A + 4), hb + sb_ * (B + 10), 0), (ha + sa_ * AV, hb + sb_ * BV, ZR + 1))
    sc.extent((ha + A + 22, hb - B, 0))

    def ground():
        iso.ground_ao(c, [(ha - A - 3, hb - B - 3), (ha + A + 3, hb - B - 3), (ha + A + 3, hb + B + 10), (ha - A - 3, hb + B + 10)], grow=6, opacity=0.13)
    sc.ground.insert(0, ground)

    # goods at the quay's root
    for kind, s_, t_ in lay["goods"]:
        a, b = at_st(e, s_ + shift, t_)
        if kind == "amph":
            def amph(a=a, b=b):
                for da, db, kk in ((-3, -2, 0.6), (1, -3, 0.6), (-1, 1, 0.62), (3, 0, 0.58), (-4.5, 3, 0.55), (1.5, 4, 0.6)):
                    iso.amphora(c, a + da, b + db, k=kk, shaded=False)
            sc.add(a + b, amph)
        elif kind == "crates":
            def crates(a=a, b=b):
                lc.crate(c, a, b, 4.6, 7.5)
                lc.crate(c, a + 9, b + 1, 4.2, 6.8)
                lc.crate(c, a + 0.5, b + 0.5, 3.6, 5.5, z=7.5)
            sc.add(a + b, crates)
        elif kind == "sacks":
            def sacks(a=a, b=b):
                lc.sack(c, a, b, k=0.95)
                lc.sack(c, a + 5, b + 2, k=0.9)
                lc.sack(c, a + 2, b + 5, k=1.0, lying=True)
            sc.add(a + b, sacks)
        elif kind == "banner":
            sc.add(a + b, lambda a=a, b=b: iso.banner_b(c, a, b, 0, height=36, width=8, drop=15))
            sc.extent((a, b, 40))
        sc.extent((a - 8, b - 6, 0), (a + 14, b + 8, 0), (a, b, 16))
    sc.draw()
    return sc, (ha, hb)


def build():
    out = []
    # compact icon on the normal 256 canvas: the south-east scene, slid inside the canvas
    c = iso.Canvas("harbor")
    iso.ground(c)
    scene(c, 1, dict(LAYOUT[1], house=(72, -28)), shift=-92, quay_to=QUAY_TO - 18)
    out.append(c)
    for e in range(6):
        c = iso.Canvas("harbor", pid=f"harbor-e{e}", stem=f"harbor.e{e}")
        iso.ground(c)
        sc, _ = scene(c, e, LAYOUT[e])
        c.viewbox = sc.viewbox()
        c.anchor_marker = True
        out.append(c)
    return out


if __name__ == "__main__":
    dst = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    for canvas in build():
        print("\n".join(canvas.write(dst)))
