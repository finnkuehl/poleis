"""winery - a whitewashed press-house standing directly on the map (grounded, docs/ART.md) at the
shared human scale, its gable opening in a stone barrel arch down into the wine cellar; beside it
a plastered treading vat brimming with purple must under a striped awning, big half-buried pithoi,
baskets of grapes, a vine pergola and amphorae waiting to be filled. The game draws the
trodden-earth yard.
Accent (owner colour): the vat's striped awning, the painted side door and the banner on the gable
wall."""
import sys

sys.dont_write_bytecode = True
import math  # noqa: E402
import os  # noqa: E402
import random  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_agri as ag  # noqa: E402
import lib_processing as lp  # noqa: E402
from iso import ACCENT, LIME, TERRACOTTA, WOOD, f, poly  # noqa: E402

# world units; keep everything inside iso.GROUND_R = 58
HALL = (-16, -12)      # centre of the press-house
A, B = 18, 26          # wall half extents: gable 36 wide (a), 52 deep (b) (README "Scale": medium)
F = 4                  # stone foundation height
H = 26                 # eave line
RISE = 10              # roof rise
KA, KB = A + 2.6, B + 2.2
ZEAV = H + 2.2
ARCH_R = 7             # cellar arch: 14 wide, springing at F + 8
DOOR = (14, 23)        # local b range of the side door (9 wide, 16 high)
WA = HALL[0] + A       # world a of the side wall
AWN = (-25, 1)         # world b range of the awning hanging from the side wall
AWN_Z, AWN_D = 19, 15  # awning height at the wall and depth (toward +a)
VAT = (WA + 3, WA + 13, -20, -5)       # a0, a1, b0, b1 (world) of the treading vat
G = ag.GRAPE


def hall(c):
    iso.cast_shadow(c, [(sa * (A + 1), sb * (B + 1)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * KA, sb * KB, ZEAV) for sa in (-1, 1) for sb in (-1, 1)] + [(0, sb * KB, ZEAV + RISE) for sb in (-1, 1)], opacity=0.46)
    iso.contact_ao(c, -A - 1.2, A + 1.2, -B - 1.2, B + 1.2)
    iso.stone_course(c, A + 1.2, B + 1.2, F)
    iso.lime_wall_b(c, B, -A, A, F, H, seed=7, mottle=8)
    iso.lime_wall_a(c, A, -B, B, F, H)
    # the gable triangle above the eave line on the front (+b) wall
    zg = ZEAV + RISE - 2.4
    gg = c.lin("gable", -A, 0, A, 0, [(0, LIME["lit"]), (0.6, LIME["mid"]), (1, LIME["end"])])
    c.add(c.on(c.m_bface(B), f'<path d="{poly([(-A, H - 0.2), (A, H - 0.2), (A, H + 1.4), (0, zg), (-A, H + 1.4)])}" fill="{gg}"/>'
               f'<path d="{poly([(-A, H + 1.4), (0, zg), (A, H + 1.4), (A, H - 2), (0, zg - 3.4), (-A, H - 2)])}" fill="#6f6553" opacity="0.2"/>'))
    # round window in the gable
    c.add(c.on(c.m_bface(B), f'<circle cx="0" cy="{f(H + 3.6)}" r="2.8" fill="#e4dac6"/><circle cx="0" cy="{f(H + 3.6)}" r="2" fill="#2a2420"/>'
               f'<path d="M-2,{f(H + 3.6)} L2,{f(H + 3.6)} M0,{f(H + 1.6)} L0,{f(H + 5.6)}" stroke="{WOOD["dark"]}" stroke-width="0.5"/>'))
    cellar_arch(c)
    pergola(c, -A - 1, -ARCH_R - 2.6, B, B + 12, 17)
    # side (+a) wall: small window, painted door (accent), banner (accent)
    c.add(c.on(c.m_aface(A), f'<rect x="-3" y="13" width="6" height="7" fill="#2e2a26"/><rect x="-3.6" y="12" width="7.2" height="1.1" fill="#a7a49c"/>'
               f'<path d="M-1,13 V20 M1,13 V20" stroke="{WOOD["dark"]}" stroke-width="0.5"/>'))
    door_a(c, A, -DOOR[1], -DOOR[0], F, F + 16)
    iso.drape_b(c, B, 10.5, 16, H - 2.5, 12)
    iso.foot_tufts(c, [((-A - 1.2, B + 1.2), (-ARCH_R - 4, B + 1.2)), ((ARCH_R + 4, B + 1.2), (A + 1.2, B + 1.2)), ((A + 1.2, B + 1.2), (A + 1.2, 12))],
                   n=9, seed=9, kind="dry", stones=3)
    # roof: low gable with the ridge along b, plus the front verge
    iso.tile_roof_b(c, KA, KB, ZEAV, RISE, rows=13, seed=81)
    v_out = [(-KA - 0.4, ZEAV - 0.2), (0, ZEAV + RISE + 0.4), (KA + 0.4, ZEAV - 0.2)]
    v_in = [(KA - 2, ZEAV - 1.7), (0, ZEAV + RISE - 2), (-KA + 2, ZEAV - 1.7)]
    c.add(c.on(c.m_bface(KB), f'<path d="{poly(v_out + v_in)}" fill="{TERRACOTTA["shade"]}"/>'
               f'<path d="M{f(-KA - 0.4)},{f(ZEAV - 0.2)} L0,{f(ZEAV + RISE + 0.4)} L{f(KA + 0.4)},{f(ZEAV - 0.2)}" fill="none" stroke="{TERRACOTTA["lit"]}" stroke-width="1.1" stroke-linejoin="round"/>'
               + "".join(f'<rect x="{f(sx * t * KA - 0.3)}" y="{f(ZEAV + RISE * (1 - t) - 1.8)}" width="0.6" height="1.6" fill="{TERRACOTTA["deep"]}" opacity="0.5"/>' for sx in (-1, 1) for t in (0.25, 0.5, 0.75))))


def pergola(c, a0, a1, b0, b1, z, seed=5):
    """Vine pergola against the gable wall: two posts in front, beams back to the wall, a canopy of
    vine leaves with purple bunches hanging under its front edge (local coordinates of the hall)."""
    rnd = random.Random(seed)
    V = ag.VINE
    pal = {"hi": WOOD["lit"], "mid": WOOD["base"], "dark": WOOD["deep"]}
    for a in (a0 + 1, a1 - 1):
        iso.blob_shadow(c, a + 1.5, b1 - 1, 1.6, 0.35)
    ag.pole(c, a0 + 1, b1 - 1, 0, z, w=1.3, pal=pal)
    # shadow of the canopy on the wall and the ground
    c.add(c.on(c.m_bface(b0), f'<rect x="{f(a0 + 2)}" y="{f(z - 8)}" width="{f(a1 - a0)}" height="8" fill="{iso.INK}" opacity="0.18" filter="{c.blur(0.9)}"/>'))
    for a in (a0 + 1, a1 - 1):
        p0, p1 = c.P(a, b1 - 1, z), c.P(a, b0, z + 0.5)
        c.add(f'<path d="M{f(p0[0])},{f(p0[1])} L{f(p1[0])},{f(p1[1])}" stroke="{WOOD["dark"]}" stroke-width="1"/>')
    p0, p1 = c.P(a0, b1 - 1, z), c.P(a1, b1 - 1, z)
    c.add(f'<path d="M{f(p0[0])},{f(p0[1])} L{f(p1[0])},{f(p1[1])}" stroke="{WOOD["base"]}" stroke-width="1.1"/>')
    # the leafy canopy: overlapping leaf clusters over the beams
    leaf = c.rad("vleaf", 0.35, 0.3, 0.85, [(0, V["hi"]), (0.45, V["lit"]), (1, V["shade"])], bbox=True)
    puffs = []
    for i in range(12):
        a = a0 + (a1 - a0) * ((i % 3 + 0.5) / 3 + rnd.uniform(-0.1, 0.1))
        b = b0 + (b1 - b0) * ((i // 3 + 0.5) / 4 + rnd.uniform(-0.06, 0.06))
        puffs.append((a, b, rnd.uniform(2.8, 3.8)))
    for a, b, r in sorted(puffs, key=lambda p: p[0] + p[1]):
        x, y = c.P(a, b, z + 1.2)
        c.add(f'<path d="{iso.puff(x + 0.6, y + 1, r * 1.3, r * 0.75, n=8, seed=int(a * 7 + b))}" fill="{V["dark"]}" opacity="0.6"/>'
              f'<path d="{iso.puff(x, y, r * 1.25, r * 0.7, n=8, seed=int(a * 5 + b))}" fill="{leaf}"/>')
    # purple bunches hanging under the front beam
    gr = c.lin("grp", 0, 0, 1, 1, [(0, G["hi"]), (0.4, G["lit"]), (1, G["shade"])], bbox=True)
    for t in (0.2, 0.45, 0.7, 0.9):
        x, y = c.P(a0 + (a1 - a0) * t, b1 - 1.4, z - 0.6)
        c.add(ag.grape_small(x, y, 0.75, gr, seed=int(t * 10)))
    ag.pole(c, a1 - 1, b1 - 1, 0, z, w=1.3, pal=pal)


def cellar_arch(c):
    """Round stone arch in the gable wall: a barrel vault leading down into the cellar."""
    r = ARCH_R
    zs = F + 8            # spring line of the arch
    zc = zs + r
    arch = f"M{f(-r)},{f(F)} L{f(-r)},{f(zs)} A{f(r)},{f(r)} 0 0 0 {f(r)},{f(zs)} L{f(r)},{f(F)}Z"
    inner = c.lin("vault", 0, 0, 0, 1, [(0, "#3a2c22"), (0.6, "#1e1611"), (1, "#120d0a")], bbox=True)
    out = [f'<path d="{arch}" fill="{inner}"/>']
    # the vault receding: two inner rings and the steps down
    for k_, op in ((0.78, 0.5), (0.58, 0.45)):
        rr = r * k_
        out.append(f'<path d="M{f(-rr)},{f(F)} L{f(-rr)},{f(zs)} A{f(rr)},{f(rr)} 0 0 0 {f(rr)},{f(zs)} L{f(rr)},{f(F)}" fill="none" stroke="#5a4a3c" stroke-width="0.6" opacity="{op}"/>')
    for i in range(4):
        w = r * (0.95 - i * 0.12)
        out.append(f'<rect x="{f(-w)}" y="{f(F + i * 1.1)}" width="{f(2 * w)}" height="0.45" fill="#8a7a66" opacity="{f(0.55 - i * 0.1)}"/>')
    # dim amphorae deep inside
    for ax, k_ in ((-2.4, 0.75), (2, 0.65)):
        out.append(f'<path d="M{f(ax - 1.4 * k_)},{f(F + 4.4)} C{f(ax - 2.2 * k_)},{f(F + 6.4)} {f(ax - 1.6 * k_)},{f(F + 8.4)} {f(ax)},{f(F + 9)} C{f(ax + 1.6 * k_)},{f(F + 8.4)} {f(ax + 2.2 * k_)},{f(F + 6.4)} {f(ax + 1.4 * k_)},{f(F + 4.4)}Z" fill="#5a3324" opacity="0.8"/>')
    # voussoirs: stone blocks fanning round the arch, a keystone on top
    vs = []
    n = 9
    for i in range(n):
        t0, t1 = math.pi * i / n, math.pi * (i + 1) / n
        ro = r + 2.4
        p = [(r * math.cos(t0), zs + r * math.sin(t0)), (ro * math.cos(t0), zs + ro * math.sin(t0)),
             (ro * math.cos(t1), zs + ro * math.sin(t1)), (r * math.cos(t1), zs + r * math.sin(t1))]
        tone = ["#e8e0cc", "#d9cfb8", "#e2d9c4"][i % 3]
        vs.append(f'<path d="{poly(p)}" fill="{tone}" stroke="#9d9380" stroke-width="0.3"/>')
    vs.append(f'<path d="{poly([(-1.2, zc - 0.2), (1.2, zc - 0.2), (1.7, zc + 3), (-1.7, zc + 3)])}" fill="#f1ead8" stroke="#9d9380" stroke-width="0.3"/>')
    for sx in (-1, 1):   # jambs
        for j in range(3):
            vs.append(f'<rect x="{f(r if sx > 0 else -r - 2.4)}" y="{f(F + j * 2.67)}" width="2.4" height="2.67" fill="{["#e2d9c4", "#d6ccb5", "#e8e0cc"][j]}" stroke="#9d9380" stroke-width="0.3"/>')
    out.append("".join(vs))
    out.append(f'<path d="{arch}" fill="none" stroke="#2a2018" stroke-width="0.6" opacity="0.5"/>')
    c.add(c.on(c.m_bface(B), "".join(out)))
    # a worn threshold in front of the arch
    c.add(c.on(c.m_ground(0.3), f'<rect x="{f(-r - 1)}" y="{f(B)}" width="{f(2 * r + 2)}" height="2.6" fill="#d9cfb8"/><rect x="{f(-r - 1)}" y="{f(B + 2.2)}" width="{f(2 * r + 2)}" height="0.4" fill="#8f8572"/>'))


def door_a(c, a, x0, x1, z0, z1):
    """Plank door on a right (+a) wall, painted in the owner colour (accent) under stone framing."""
    c.add(c.on(c.m_aface(a), f'<rect x="{f(x0 - 1.4)}" y="{f(z0)}" width="{f(x1 - x0 + 2.8)}" height="{f(z1 - z0 + 2.2)}" fill="#c8c2b4"/>'
               f'<rect x="{f(x0 - 2)}" y="{f(z1 + 0.5)}" width="{f(x1 - x0 + 4)}" height="1.9" fill="#d8d2c4"/>'))
    dg = c.lin("pdoor", 0, 0, 1, 0, [(0, ACCENT["mid"]), (0.5, ACCENT["shade"]), (1, ACCENT["dark"])], bbox=True)
    c.accent(c.on(c.m_aface(a), f'<rect x="{f(x0)}" y="{f(z0)}" width="{f(x1 - x0)}" height="{f(z1 - z0)}" fill="{dg}"/>'))
    pw = (x1 - x0) / 3
    planks = "".join(f'<rect x="{f(x0 + i * pw - 0.2)}" y="{f(z0)}" width="0.4" height="{f(z1 - z0)}" fill="#1d2b36" opacity="0.4"/>' for i in (1, 2))
    c.add(c.on(c.m_aface(a), planks
               + "".join(f'<rect x="{f(x0)}" y="{f(zz)}" width="{f(x1 - x0)}" height="0.9" fill="#1d2b36" opacity="0.28"/>' for zz in (z0 + 3.4, z1 - 4))
               + f'<circle cx="{f(x1 - 1.7)}" cy="{f(z0 + 7.5)}" r="0.7" fill="{iso.BRONZE["lit"]}"/>'
               f'<rect x="{f(x0)}" y="{f(z1 - 2)}" width="{f(x1 - x0)}" height="2" fill="#1d2b36" opacity="0.3"/>'))


def pithos(c, a, b, k=1.0, seed=1):
    """Big terracotta storage jar sunk into the ground up to its belly, with a rope-pattern band."""
    x, y = c.P(a, b, 0)
    c.add(f'<ellipse cx="{f(x + 2 * k)}" cy="{f(y + 0.6)}" rx="{f(8 * k)}" ry="{f(3 * k)}" fill="#1f2e15" opacity="0.38" filter="{c.blur(0.8)}"/>')
    g = c.lin("pith", 0, 0, 1, 0, [(0, "#d98a62"), (0.3, "#c46a46"), (0.7, "#9a4a32"), (1, "#6a2e1e")], bbox=True)
    body = (f"M{f(x - 6.6 * k)},{f(y)} C{f(x - 7.6 * k)},{f(y - 6 * k)} {f(x - 5.4 * k)},{f(y - 11 * k)} {f(x - 3.4 * k)},{f(y - 12.4 * k)} "
            f"L{f(x + 3.4 * k)},{f(y - 12.4 * k)} C{f(x + 5.4 * k)},{f(y - 11 * k)} {f(x + 7.6 * k)},{f(y - 6 * k)} {f(x + 6.6 * k)},{f(y)} "
            f"Q{f(x)},{f(y + 3 * k)} {f(x - 6.6 * k)},{f(y)}Z")
    c.add(f'<path d="{body}" fill="{g}"/>'
          f'<path d="M{f(x - 6.9 * k)},{f(y - 7 * k)} Q{f(x)},{f(y - 4.4 * k)} {f(x + 6.9 * k)},{f(y - 7 * k)}" fill="none" stroke="#7a3624" stroke-width="{f(1.3 * k)}"/>'
          f'<path d="M{f(x - 6.9 * k)},{f(y - 7 * k)} Q{f(x)},{f(y - 4.4 * k)} {f(x + 6.9 * k)},{f(y - 7 * k)}" fill="none" stroke="#e9a07a" stroke-width="{f(0.6 * k)}" stroke-dasharray="{f(1.2 * k)} {f(1 * k)}"/>'
          f'<path d="M{f(x - 5.4 * k)},{f(y - 3 * k)} C{f(x - 6 * k)},{f(y - 6 * k)} {f(x - 5 * k)},{f(y - 9 * k)} {f(x - 3.6 * k)},{f(y - 11 * k)}" fill="none" stroke="#f4b590" stroke-width="{f(0.8 * k)}" opacity="0.7"/>')
    # thick rim and the dark mouth
    c.add(f'<ellipse cx="{f(x)}" cy="{f(y - 12.6 * k)}" rx="{f(4.4 * k)}" ry="{f(1.8 * k)}" fill="#c46a46"/>'
          f'<ellipse cx="{f(x)}" cy="{f(y - 12.8 * k)}" rx="{f(3 * k)}" ry="{f(1.1 * k)}" fill="#2a1410"/>'
          f'<path d="M{f(x - 4.4 * k)},{f(y - 12.6 * k)} A{f(4.4 * k)},{f(1.8 * k)} 0 0 0 {f(x + 4.4 * k)},{f(y - 12.6 * k)}" fill="none" stroke="#f0a27a" stroke-width="{f(0.6 * k)}"/>')
    # earth heaped round its foot
    rnd = random.Random(seed)
    c.add(f'<path d="{iso.puff(x + 0.5, y - 0.4, 8.4 * k, 2.4 * k, n=9, seed=rnd.randrange(99), bulge=1.08)}" fill="#8a6a42"/>'
          f'<path d="{iso.puff(x - 1, y - 0.9, 6.4 * k, 1.5 * k, n=8, seed=rnd.randrange(99), bulge=1.08)}" fill="#a88458"/>'
          + "".join(iso.grass_tuft(x + dx * k, y + 0.6, 2.4, "#8f9a42") for dx in (-7, 4.5)))


def vat(c):
    """Plastered treading vat full of purple must, with a spout into a sunk collecting jar."""
    a0, a1, b0, b1 = VAT
    h, t, zm = 5, 1.2, 3.8
    W = {"top": "#f3ecdd", "left": "#e3d9c4", "right": "#bdb6a8"}
    iso.cast_shadow(c, [(a0, b0), (a1, b0), (a1, b1), (a0, b1)], [(a0, b0, h), (a1, b0, h), (a1, b1, h), (a0, b1, h)], opacity=0.4, sd=1.2)
    iso.contact_ao(c, a0, a1, b0, b1, width=2.5, opacity=0.4)
    c.add(c.on(c.m_bface(b1), f'<rect x="{a0}" y="0" width="{a1 - a0}" height="{h}" fill="{W["left"]}"/>'
               f'<rect x="{a0}" y="0" width="{a1 - a0}" height="1" fill="#6d604a" opacity="0.3"/>'
               f'<rect x="{a0}" y="{f(h - 0.5)}" width="{a1 - a0}" height="0.5" fill="#fff" opacity="0.8"/>'
               # purple stains running down from the rim
               + "".join(f'<path d="M{f(sx)},{f(h)} q0.3,-1.4 0,-{f(ln)} q-0.4,0.3 -0.7,0Z" fill="{G["base"]}" opacity="0.45"/>' for sx, ln in ((a0 + 2.5, 2), (a0 + 6.5, 1.3), (a1 - 2, 2.4)))))
    c.add(c.on(c.m_aface(a1), f'<rect x="{-b1}" y="0" width="{b1 - b0}" height="{h}" fill="{W["right"]}"/>'
               f'<rect x="{-b1}" y="{f(h - 0.45)}" width="{b1 - b0}" height="0.45" fill="#e0ddd5"/>'))
    # inner far walls above the must
    c.add(c.on(c.m_bface(b0 + t), f'<rect x="{a0 + t}" y="{zm}" width="{a1 - a0 - 2 * t}" height="{f(h - zm)}" fill="#d8cdb6"/>'))
    c.add(c.on(c.m_aface(a0 + t), f'<rect x="{-(b1 - t)}" y="{zm}" width="{b1 - b0 - 2 * t}" height="{f(h - zm)}" fill="#a79f90"/>'))
    # the must: purple surface with crushed grapes and froth
    rnd = random.Random(14)
    mg = c.lin("must", a0, b0, a1, b1, [(0, "#8a4a86"), (0.5, "#5c2a60"), (1, "#3e1a44")])
    tex = []
    for _ in range(30):
        aa, bb = rnd.uniform(a0 + t + 0.7, a1 - t - 0.7), rnd.uniform(b0 + t + 0.7, b1 - t - 0.7)
        r_ = rnd.uniform(0.45, 0.85)
        tex.append(f'<ellipse cx="{f(aa)}" cy="{f(bb)}" rx="{f(r_)}" ry="{f(r_)}" fill="{rnd.choice([G["lit"], G["shade"], G["dark"], "#9a5a92", "#6f8f34"])}"/>')
    froth = "".join(f'<ellipse cx="{f(rnd.uniform(a0 + 2.5, a1 - 2.5))}" cy="{f(rnd.uniform(b0 + 2.5, b1 - 2.5))}" rx="{f(rnd.uniform(1, 2))}" ry="{f(rnd.uniform(0.6, 1.2))}" fill="#d9b8d6" opacity="0.35"/>' for _ in range(6))
    c.add(c.on(c.m_ground(zm), f'<rect x="{a0 + t}" y="{b0 + t}" width="{f(a1 - a0 - 2 * t)}" height="{f(b1 - b0 - 2 * t)}" fill="{mg}"/>' + "".join(tex) + froth
               + f'<rect x="{a0 + t}" y="{b0 + t}" width="{f(a1 - a0 - 2 * t)}" height="1.2" fill="#1a0c1c" opacity="0.35"/>'
               f'<rect x="{a0 + t}" y="{b0 + t}" width="1.2" height="{f(b1 - b0 - 2 * t)}" fill="#1a0c1c" opacity="0.25"/>'))
    # rim on top
    c.add(c.on(c.m_ground(h), f'<path d="M{a0},{b0}h{a1 - a0}v{b1 - b0}h{a0 - a1}Z M{f(a0 + t)},{f(b0 + t)}v{f(b1 - b0 - 2 * t)}h{f(a1 - a0 - 2 * t)}v{f(-(b1 - b0 - 2 * t))}Z" fill="{W["top"]}" fill-rule="evenodd"/>'))
    # spout on the front, pouring into a sunk jar
    sx = a0 + 6
    c.add(c.on(c.m_bface(b1), f'<rect x="{f(sx - 1)}" y="{f(h - 2.6)}" width="2" height="1.4" fill="#cfc4ad"/>'))
    c.add(c.on(c.m_ground(h - 1.2), f'<rect x="{f(sx - 0.9)}" y="{b1}" width="1.8" height="2" fill="#d9cfb8"/><rect x="{f(sx - 0.5)}" y="{b1}" width="1" height="2" fill="{G["base"]}"/>'))
    x, y = c.P(sx, b1 + 5, 0)
    px, py = c.P(sx, b1 + 1.8, h - 1.2)
    c.add(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="4" ry="1.9" fill="#b05f3f"/><ellipse cx="{f(x)}" cy="{f(y)}" rx="3.1" ry="1.4" fill="#3a1a3c"/>'
          f'<ellipse cx="{f(x - 0.5)}" cy="{f(y - 0.2)}" rx="1.7" ry="0.65" fill="{G["lit"]}" opacity="0.7"/>'
          f'<path d="M{f(px - 0.45)},{f(py)} Q{f(px - 0.3)},{f((py + y) / 2)} {f(x - 0.3)},{f(y - 0.5)} L{f(x + 0.45)},{f(y - 0.5)} Q{f(px + 0.6)},{f((py + y) / 2)} {f(px + 0.45)},{f(py)}Z" fill="{G["base"]}"/>')


def amphorae(c):
    """A group of amphorae waiting to be filled, one lying on its side."""
    for a, b, k in ((-46, 20, 0.6), (-42, 23, 0.66), (-37.5, 25, 0.58), (-47.5, 26, 0.52)):
        iso.amphora(c, a, b, k=k, shaded=False)
    x, y = c.P(-31, 32, 0)
    c.add(f'<ellipse cx="{f(x + 1)}" cy="{f(y + 0.3)}" rx="6" ry="1.3" fill="#1f2e15" opacity="0.35" filter="{c.blur(0.45)}"/>')
    g = c.lin("amphL", 0, 0, 0, 1, [(0, "#e08a62"), (0.45, "#b5523b"), (1, "#6e2f20")], bbox=True)
    body = ("M0,-0.8 C-3,-3 -8,-4.4 -11.5,-3.6 C-13.5,-3 -14,-1.6 -15,-1.2 L-17.5,-1.3 L-17.5,1.3 L-15,1.2 "
            "C-14,1.6 -13.5,3 -11.5,3.6 C-8,4.4 -3,3 0,0.8Z")
    c.add(f'<g transform="translate({f(x + 5)} {f(y - 2.3)}) rotate(-8) scale(0.62)"><path d="{body}" fill="{g}"/>'
          '<ellipse cx="-17.5" cy="0" rx="0.6" ry="1.6" fill="#3a1a10"/>'
          '<rect x="-10.5" y="-3.8" width="0.6" height="7.6" fill="#2d140c" opacity="0.4"/></g>')


def build():
    c = iso.Canvas("winery")
    iso.ground(c)
    ha, hb = HALL
    iso.ground_ao(c, [(ha - A - 2, hb - B - 2), (ha + A + 2, hb - B - 2), (WA + AWN_D + 2, AWN[0]), (WA + AWN_D + 2, AWN[1] + 2), (ha + A + 2, hb + B + 4), (-44, 30)], grow=6, opacity=0.13)

    pithos(c, 22, -38, k=0.72, seed=1)
    with c.at(*HALL):
        hall(c)
    # the awning on the side wall shades the vat
    pal = {"hi": WOOD["lit"], "mid": WOOD["base"], "dark": WOOD["deep"]}
    zf = AWN_Z - 4
    ag.pole(c, WA + AWN_D - 0.8, AWN[0] + 0.8, 0, zf, w=1.3, pal=pal)
    vat(c)
    ag.pole(c, WA + AWN_D - 0.8, AWN[1] - 0.8, 0, zf, w=1.3, pal=pal)
    lp.awning_a(c, AWN[0], AWN[1], WA, AWN_Z, AWN_D, 4, stripes=7)
    for b in (AWN[0] + 1, AWN[1] - 1):
        c.add(c.on(c.m_aface(WA), f'<rect x="{f(-b - 0.6)}" y="{AWN_Z - 1}" width="1.2" height="2" fill="{WOOD["dark"]}"/>'))
    amphorae(c)
    pithos(c, 38, -22, k=0.76, seed=3)
    ag.basket(c, 26, 6, k=0.7, contents="grapes", seed=31)
    pithos(c, 40, 4, k=0.8, seed=2)
    ag.basket(c, 19, 14, k=0.62, contents="grapes", seed=32)
    ag.basket(c, 30, 14, k=0.66, contents="grapes", seed=33)
    iso.pebbles(c, [(-12, 30, 1.2, 81), (8, 36, 1.0, 82), (46, -6, 1.2, 83)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
