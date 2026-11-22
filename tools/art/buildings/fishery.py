"""fishery - a fisher's hut on stilts with a thatched roof at a little turquoise cove: a jetty,
a moored fishing boat with a lateen sail and a painted eye, nets drying on poles, fish baskets.
Accent (owner colour): base rim band, the boat's sail, the stripe under the boat's gunwale and
the cloth hanging in the hut's doorway."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import math  # noqa: E402
import random  # noqa: E402

import iso  # noqa: E402
import lib_agri as ag  # noqa: E402
from iso import ACCENT, WOOD, f, poly  # noqa: E402

R = iso.BASE_R
W = ag.WATER

# hut (placed with c.at(HUT)), local half extents and heights
HUT = (-10, -19)
HA, HB = 15, 11        # wall half length (a) / half depth (b)
ZF = 8                 # floor (deck top) height: the hut stands on stilts
HW = 28                # wall top
RISE = 11              # gable rise
TANP = RISE / HB
T = 4.2                # thatch thickness
DECK_B = HB + 5        # the deck reaches out in front of the door

JETTY_B = (1, 7)       # jetty: b range, a range, deck height
JETTY_A = (14, 54)
JZ = 3.4
BOAT = (43, -8)        # boat centre (a, b): moored behind the jetty


def shore(b):
    """a-coordinate of the waterline: water lies on the +a side (screen right)."""
    return 20 + 0.62 * b + 4 * math.sin(b / 9 + 0.6)


def in_water(a, b, margin=0.0):
    return a > shore(b) - margin


# ---------------------------------------------------------------------------
# Cove: beach, water surface, ripples, water seen in the side of the base
# ---------------------------------------------------------------------------
def cove(c):
    bs = [-80 + i * 2.5 for i in range(65)]
    line = [(shore(b), b) for b in bs]
    clip = f'<g clip-path="{c.url("top")}">'
    # beach: dry sand, wet sand, then the water on top
    sand_in = [(shore(b) - 7.5 - 1.8 * math.sin(b / 5.5), b) for b in bs]
    wet = [(shore(b) - 2.6, b) for b in bs]
    sand = (f'<path d="{poly(sand_in + line[::-1])}" fill="#ead6a0"/>'
            f'<path d="{poly(sand_in + [(a + 2, b) for a, b in sand_in[::-1]])}" fill="#d8c486" opacity="0.6"/>'
            f'<path d="{poly(wet + line[::-1])}" fill="#cdb57a"/>')
    wg = c.lin("water", 22, 0, 22 + 40, -26, [(0, W["shallow"]), (0.18, W["lit"]), (0.55, W["base"]), (1, W["deep"])])
    water = f'<path d="{poly(line + [(110, 80), (110, -80)])}" fill="{wg}"/>'
    # shallow band along the shore and darker sea toward the rim
    shallow = [(shore(b) + 5 + 1.5 * math.sin(b / 4), b) for b in bs]
    water += f'<path d="{poly(line + shallow[::-1])}" fill="{W["shallow"]}" opacity="0.55"/>'
    foam = (f'<path d="M{" L".join(f"{f(a)},{f(b)}" for a, b in line)}" fill="none" stroke="{W["foam"]}" stroke-width="1.3" opacity="0.9"/>'
            f'<path d="M{" L".join(f"{f(a + 2.4)},{f(b)}" for a, b in line)}" fill="none" stroke="{W["foam"]}" stroke-width="0.7" stroke-dasharray="4 3" opacity="0.6"/>')
    c.add(clip + c.on(c.m_ground(0), sand + water + foam) + "</g>")

    # ripples and sparkles (screen space)
    rnd = random.Random(17)
    rip, spark = [], []
    for _ in range(26):
        while True:
            a, b = rnd.uniform(-20, 68), rnd.uniform(-68, 60)
            if a * a + b * b < 62 ** 2 and in_water(a, b, -6) and not (JETTY_A[0] - 2 < a < JETTY_A[1] + 3 and JETTY_B[0] - 3 < b < JETTY_B[1] + 2):
                break
        x, y = c.P(a, b, 0)
        w = rnd.uniform(2.2, 4.2)
        rip.append(f"M{f(x - w)},{f(y)} q{f(w)},{f(-1.1)} {f(2 * w)},0")
        if rnd.random() < 0.35:
            spark.append(f'<circle cx="{f(x + rnd.uniform(-2, 2))}" cy="{f(y - 1.2)}" r="0.55" fill="#fff"/>')
    c.add(f'<g clip-path="{c.url("top")}"><path d="{"".join(rip)}" fill="none" stroke="#e9fbf6" stroke-width="0.75" stroke-linecap="round" opacity="0.7"/>{"".join(spark)}</g>')

    # side of the base where the cove meets the rim: a cut through clear water
    cx, cy = c.P(0, 0, 0)
    rx = R * math.sqrt(2)
    ry = rx / 2
    lo, hi = -math.pi / 4, 3 * math.pi / 4        # front arc in world angles
    if in_water(R * math.cos(lo), R * math.sin(lo)):
        a_, b_ = lo, hi
        for _ in range(40):
            m = (a_ + b_) / 2
            if in_water(R * math.cos(m), R * math.sin(m)):
                a_ = m
            else:
                b_ = m
        th_s = a_ + math.pi / 4
        depth = iso.BASE_H - iso.BAND_H - 0.1
        n = 40
        top = [(cx + rx * math.cos(th_s * i / n), cy + ry * math.sin(th_s * i / n)) for i in range(n + 1)]
        bot = [(x, y + depth) for x, y in top[::-1]]
        sg = c.lin("wside", cx, 0, cx + rx, 0, [(0, "#6fcfcc"), (0.45, "#3fa9b8"), (1, "#1f6f8c")])
        vg = c.lin("wsideV", 0, 0, 0, 1, [(0, "#ffffff", 0.25), (0.35, "#ffffff", 0), (0.8, "#0d3c52", 0.1), (1, "#0d3c52", 0.35)], bbox=True)
        sandline = [(x, y + depth - 1.6) for x, y in top]
        c.add(f'<path d="{poly(top + bot)}" fill="{sg}"/><path d="{poly(top + bot)}" fill="{vg}"/>'
              f'<path d="{poly(sandline + bot)}" fill="#c9ad74"/>'
              f'<path d="M{" L".join(f"{f(x)},{f(y)}" for x, y in top)}" fill="none" stroke="#e9fbf6" stroke-width="1.1" opacity="0.85"/>'
              f'<path d="M{" L".join(f"{f(x)},{f(y + depth - 0.1)}" for x, y in top)}" fill="none" stroke="#2c1a0e" stroke-width="1" opacity="0.35"/>')
        # light caustics in the cut
        cau = []
        for i in range(1, 9):
            t = th_s * (i + 0.3) / 9.5
            x, y = cx + rx * math.cos(t), cy + ry * math.sin(t)
            cau.append(f"M{f(x - 2.5)},{f(y + 2.2)} q1.2,-0.8 2.5,0 t2.5,0")
        c.add(f'<path d="{"".join(cau)}" fill="none" stroke="#c9f3ee" stroke-width="0.5" opacity="0.6"/>')


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
    dx0, dx1, dz1 = 1.5, 9.5, ZF + 12
    c.add(c.on(c.m_bface(HB), f'<rect x="{f(dx0 - 1)}" y="{f(ZF)}" width="{f(dx1 - dx0 + 2)}" height="{f(dz1 - ZF + 1.4)}" fill="{D["dark"]}"/>'
               f'<rect x="{f(dx0)}" y="{f(ZF)}" width="{f(dx1 - dx0)}" height="{f(dz1 - ZF)}" fill="#1c140e"/>'
               f'<rect x="{f(dx0)}" y="{f(dz1 - 3)}" width="{f(dx1 - dx0)}" height="3" fill="#000" opacity="0.3"/>'))
    cloth = [(dx0, dz1), (dx1, dz1), (dx1 - 1.2, dz1 - 4), (dx0 + 4.6, ZF + 5.5), (dx0 + 3.2, ZF + 1.2), (dx0, ZF + 0.8)]
    cg = c.lin("doorcloth", 0, 0, 1, 0, [(0, ACCENT["lit"]), (0.4, ACCENT["light"]), (0.75, ACCENT["mid"]), (1, ACCENT["shade"])], bbox=True)
    c.accent(c.on(c.m_bface(HB), f'<path d="{poly(cloth)}" fill="{cg}"/>'))
    c.add(c.on(c.m_bface(HB), f'<path d="M{f(dx0 + 1.6)},{f(dz1)} L{f(dx0 + 3.6)},{f(ZF + 4)} M{f(dx0 + 3.4)},{f(dz1)} L{f(dx0 + 4.4)},{f(ZF + 7)}" stroke="#1d2b36" stroke-width="0.6" opacity="0.25"/>'
               f'<path d="M{f(dx0 + 4.6)},{f(ZF + 5.8)} l-1.8,-0.6" stroke="{WOOD["dark"]}" stroke-width="0.8"/>'
               f'<rect x="{f(dx0 - 1.5)}" y="{f(dz1)}" width="{f(dx1 - dx0 + 3)}" height="1.6" fill="{D["mid"]}"/>'
               f'<rect x="{f(dx0 - 1.5)}" y="{f(dz1)}" width="{f(dx1 - dx0 + 3)}" height="0.45" fill="{D["dark"]}"/>'))
    # small window with a propped shutter, and a round vent in the gable
    c.add(c.on(c.m_bface(HB), f'<rect x="-9.5" y="{f(ZF + 7)}" width="6" height="5.5" fill="{D["dark"]}"/><rect x="-8.8" y="{f(ZF + 7.6)}" width="4.6" height="4.3" fill="#1c140e"/>'
               f'<path d="M-9.6,{f(ZF + 12.6)} L-3.4,{f(ZF + 12.6)} L-2.6,{f(ZF + 15.4)} L-8.8,{f(ZF + 15.4)}Z" fill="{D["lit"]}"/>'
               f'<path d="M-9.6,{f(ZF + 12.6)} L-3.4,{f(ZF + 12.6)}" stroke="{D["dark"]}" stroke-width="0.5"/>'))
    c.add(c.on(c.m_aface(HA), f'<rect x="-2.6" y="{f(ZF + 6)}" width="5.2" height="5.2" fill="#2a2119"/><rect x="-2.6" y="{f(ZF + 11.2)}" width="5.2" height="0.7" fill="{D["lit"]}" opacity="0.6"/>'
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
# Jetty, boat, nets
# ---------------------------------------------------------------------------
def jetty(c):
    D = ag.DRIFT
    (b0, b1), (a0, a1) = JETTY_B, JETTY_A
    posts = [a0 + 9 + i * 9.5 for i in range(4)]
    # reflections and back posts
    for a in posts + [a1 - 1]:
        x, y = c.P(a, b0 + 0.6, 0)
        if in_water(a, b0, -1.5):
            c.add(f'<rect x="{f(x - 0.7)}" y="{f(y)}" width="1.4" height="3" fill="#1e5a6e" opacity="0.25"/>')
        ag.pole(c, a, b0 + 0.6, 0, JZ + 1.6, w=1.5)
    # shadow of the deck on the water
    c.add(f'<path d="{poly([c.P(a0 + 6, b0, 0), c.P(a1 + 1.5, b0, 0), c.P(a1 + 2.5, b1 + 1.6, 0), c.P(a0 + 6, b1 + 1.6, 0)])}" fill="#0d4a5c" opacity="0.3" filter="{c.blur(0.8)}"/>')
    iso.box(c, a0, a1, b0, b1, JZ - 1.1, JZ, D["lit"], D["mid"], D["shade"], edge=D["hi"])
    rnd = random.Random(9)
    pl = []
    x = a0
    while x < a1:
        w = rnd.uniform(1.6, 2.2)
        tone = rnd.choice([D["hi"], D["lit"], D["lit"], D["mid"]])
        pl.append(f'<rect x="{f(x)}" y="{f(b0)}" width="{f(min(w, a1 - x) - 0.35)}" height="{f(b1 - b0)}" fill="{tone}"/>')
        x += w
    c.add(c.on(c.m_ground(JZ), "".join(pl)))
    # front posts with ripple rings
    for a in posts + [a1 - 1]:
        x, y = c.P(a, b1 - 0.6, 0)
        if in_water(a, b1, -1.5):
            c.add(f'<rect x="{f(x - 0.7)}" y="{f(y)}" width="1.4" height="3.2" fill="#1e5a6e" opacity="0.28"/>'
                  f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="2.6" ry="0.9" fill="none" stroke="#e9fbf6" stroke-width="0.6" opacity="0.75"/>')
        else:
            c.add(f'<ellipse cx="{f(x + 0.8)}" cy="{f(y + 0.2)}" rx="1.8" ry="0.7" fill="#5a4a2a" opacity="0.4"/>')
        ag.pole(c, a, b1 - 0.6, 0, JZ + 1.6, w=1.5)


def boat(c, ba, bb):
    L, HWB = 16.5, 5.4

    def hw(u):
        return HWB * max(0.0, 1 - abs(u) ** 2.4) ** 0.55

    def gz(u):
        return 3.4 + 3.2 * abs(u) ** 3 + (1.2 * u ** 4 if u > 0 else 0)

    n = 28
    us = [-1 + 2 * i / n for i in range(n + 1)]
    near = [c.P(ba + u * L, bb + hw(u), gz(u)) for u in us]
    far = [c.P(ba + u * L, bb - hw(u), gz(u)) for u in us]
    wl = [c.P(ba + u * L * 0.86, bb + hw(u) * 0.86, 0) for u in us]
    wlf = [c.P(ba + u * L * 0.86, bb - hw(u) * 0.86, 0) for u in us]
    # shadow / darker water around the hull
    x, y = c.P(ba + 3, bb, 0)
    c.add(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(L * 1.25)}" ry="{f(L * 0.5)}" transform="rotate(26.6 {f(x)} {f(y)})" fill="#0d4a5c" opacity="0.35" filter="{c.blur(1.6)}"/>')
    # hull silhouette (shaded parts), lit near side, owner stripe under the gunwale
    c.add(f'<path d="{poly(iso.hull(near + far + wl + wlf))}" fill="{WOOD["dark"]}"/>')
    hg = c.lin("hull", 0, 0, 1, 0, [(0, "#6a4227"), (0.3, WOOD["lit"]), (0.75, WOOD["base"]), (1, WOOD["dark"])], bbox=True)
    c.add(f'<path d="{poly(near + wl[::-1])}" fill="{hg}"/>')

    def lerp(p, q, t):
        return [(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t) for (x0, y0), (x1, y1) in zip(p, q)]

    strake = lerp(near, wl, 0.62)
    c.add(f'<path d="M{" L".join(f"{f(x)},{f(y)}" for x, y in strake[2:-2])}" fill="none" stroke="{WOOD["deep"]}" stroke-width="0.5" opacity="0.6"/>'
          f'<path d="M{" L".join(f"{f(x)},{f(y)}" for x, y in lerp(near, wl, 0.82)[3:-3])}" fill="none" stroke="#1d2b36" stroke-width="0.9" opacity="0.35"/>')
    band = lerp(near, wl, 0.42)
    sg = c.lin("stripe", 0, 0, 1, 0, [(0, ACCENT["lit"]), (0.6, ACCENT["light"]), (1, ACCENT["shade"])], bbox=True)
    c.accent(f'<path d="{poly(near[1:-1] + band[1:-1][::-1])}" fill="{sg}"/>')
    # painted eye on the bow
    ex, ey = lerp(near, wl, 0.5)[int(n * 0.86)]
    c.add(f'<ellipse cx="{f(ex)}" cy="{f(ey)}" rx="1.9" ry="1.05" fill="#f6f0e2"/><circle cx="{f(ex + 0.3)}" cy="{f(ey)}" r="0.7" fill="#1d2b36"/>'
          f'<path d="M{f(ex - 2)},{f(ey - 0.9)} Q{f(ex)},{f(ey - 2)} {f(ex + 2)},{f(ey - 0.6)}" fill="none" stroke="#1d2b36" stroke-width="0.45"/>')
    # inside of the boat (the far inner side is lit) + thwarts + gunwale rails
    ig = c.lin("inner", 0, 0, 0, 1, [(0, "#b9845a"), (0.45, "#7e5030"), (1, "#3e2514")], bbox=True)
    c.add(f'<path d="{poly(near + far[::-1])}" fill="{ig}"/>')
    for u in (-0.42, 0.28):
        p0, p1 = c.P(ba + u * L, bb - hw(u) * 0.9, gz(u) - 0.6), c.P(ba + u * L, bb + hw(u) * 0.9, gz(u) - 0.6)
        c.add(f'<path d="M{f(p0[0])},{f(p0[1])} L{f(p1[0])},{f(p1[1])}" stroke="{WOOD["lit"]}" stroke-width="1.6"/>'
              f'<path d="M{f(p0[0])},{f(p0[1] + 0.8)} L{f(p1[0])},{f(p1[1] + 0.8)}" stroke="{WOOD["deep"]}" stroke-width="0.5" opacity="0.6"/>')
    c.add(f'<path d="M{" L".join(f"{f(x)},{f(y)}" for x, y in far)}" fill="none" stroke="{WOOD["base"]}" stroke-width="0.9"/>'
          f'<path d="M{" L".join(f"{f(x)},{f(y)}" for x, y in near)}" fill="none" stroke="#c99a6a" stroke-width="1"/>')
    # foam along the waterline in front
    c.add(f'<path d="M{" L".join(f"{f(x)},{f(y + 0.4)}" for x, y in wl[3:-2])}" fill="none" stroke="#e9fbf6" stroke-width="0.9" opacity="0.8"/>')

    # mast + lateen sail in the plane b = bb (faces +b, lit)
    ma = ba - 1.5
    tack, peak, clew = (ba + 14.5, 9.6), (ba - 16, 42), (ba - 10, 8.2)
    mz = tack[1] + (peak[1] - tack[1]) * (tack[0] - ma) / (tack[0] - peak[0]) + 1.2   # the yard hangs at the mast top
    ag.pole(c, ma, bb, 2, mz, w=1.4, pal={"hi": "#c99a6a", "mid": WOOD["base"], "dark": WOOD["deep"]})

    def qpath(p, ctl, q):
        return f"Q{f(ctl[0])},{f(ctl[1])} {f(q[0])},{f(q[1])}"

    leech_c = (ba - 16.5, 21)
    foot_c = (ba + 1.5, 5.6)
    sail = f"M{f(tack[0])},{f(tack[1])} L{f(peak[0])},{f(peak[1])} {qpath(peak, leech_c, clew)} {qpath(clew, foot_c, tack)}Z"
    sgr = c.lin("sail", 0, 0, 1, 1, [(0, ACCENT["light"]), (0.35, ACCENT["lit"]), (0.7, ACCENT["light"]), (1, ACCENT["mid"])], bbox=True)
    c.accent(c.on(c.m_bface(bb), f'<path d="{sail}" fill="{sgr}"/>'))
    seams = []
    for t in (0.2, 0.4, 0.6, 0.8):
        p = (tack[0] + (peak[0] - tack[0]) * t, tack[1] + (peak[1] - tack[1]) * t)
        q = (clew[0] + (tack[0] - clew[0]) * t * 0.9 + 1.5, clew[1] + (tack[1] - clew[1]) * t * 0.9 - 0.4)
        seams.append(f"M{f(p[0])},{f(p[1])} L{f(q[0])},{f(q[1])}")
    fold = c.lin("sailfold", 1, 0, 0, 0, [(0, "#1d2b36", 0.28), (0.35, "#1d2b36", 0), (1, "#1d2b36", 0)], bbox=True)
    c.add(c.on(c.m_bface(bb), f'<path d="{sail}" fill="{fold}"/>'
               f'<path d="{"".join(seams)}" stroke="#1d2b36" stroke-width="0.35" opacity="0.22"/>'
               f'<path d="M{f(tack[0] + 1.2)},{f(tack[1] - 0.6)} L{f(peak[0] - 1)},{f(peak[1] + 0.5)}" stroke="{WOOD["dark"]}" stroke-width="1.1" stroke-linecap="round"/>'
               f'<path d="M{f(tack[0] + 1.2)},{f(tack[1] - 0.6)} L{f(peak[0] - 1)},{f(peak[1] + 0.5)}" stroke="#c99a6a" stroke-width="0.4" transform="translate(0 0.4)"/>'
               f'<path d="M{f(clew[0])},{f(clew[1])} L{f(ba - 12.5)},{f(gz(-0.86) + 0.2)}" stroke="#5e4a36" stroke-width="0.35"/>'
               f'<path d="M{f(ma)},{f(mz)} L{f(ba + L - 0.5)},{f(gz(1) - 0.3)}" stroke="#5e4a36" stroke-width="0.3" opacity="0.8"/>'))
    x, y = c.P(ma, bb, mz)
    c.add(f'<circle cx="{f(x)}" cy="{f(y)}" r="1" fill="{WOOD["dark"]}"/>')


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


def build():
    c = iso.Canvas("fishery")
    hut_box = (HUT[0] - HA - 3, HUT[0] + HA + 5, HUT[1] - HB - 3, HUT[1] + DECK_B + 5)
    iso.base(c, seed=19, tufts=70, flowers=12,
             avoid=lambda a, b: in_water(a, b, 9) or (hut_box[0] < a < hut_box[1] and hut_box[2] < b < hut_box[3]))
    cove(c)
    iso.rocks(c, [(shore(-40) - 3, -40, 2.6, 51), (shore(-35) - 5, -35, 1.8, 52), (shore(30) - 2, 30, 2.4, 53), (shore(35) - 4.5, 35, 1.6, 54)])
    with c.at(*HUT):
        hut(c)
    boat(c, *BOAT)
    jetty(c)
    ag.basket(c, 32, 4, k=0.8, contents="fish", seed=4, z=JZ)
    nets(c, 22, -50, -22, seed=1)
    fish_trap(c, -6, 38, k=1.0, seed=1)
    fish_trap(c, 3, 44, k=0.85, seed=2)
    ag.basket(c, -2, 14, k=1.0, contents="fish", seed=7)
    iso.amphora(c, -9, 18, k=0.75, shaded=False)
    iso.rocks(c, [(shore(14) - 1, 14, 1.6, 55)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
