"""winery - a whitewashed press-house whose gable opens in a big stone barrel arch down into the
wine cellar, a treading vat brimming with purple must under a striped awning, big half-buried
pithoi along the wall and amphorae waiting to be filled.
Accent (owner colour): base rim band, the vat's awning, the banner on the side wall and the
painted door."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import math  # noqa: E402
import random  # noqa: E402

import iso  # noqa: E402
import lib_agri as ag  # noqa: E402
from iso import ACCENT, LIME, TERRACOTTA, WOOD, f, poly  # noqa: E402

HALL = (-16, -11)      # centre of the press-house
A, B = 23, 23          # wall half extents (a, b)
F = 4                  # stone foundation height
H = 33                 # eave line
RISE = 13              # roof rise
KA, KB = A + 3, B + 2.2
ZEAV = H + 2.2
ARCH = (-11.5, 11.5)   # local a range of the cellar arch in the gable wall
AWN = (-20, 8)         # world b range of the awning hanging from the side (+a) wall
AWN_Z, AWN_D = 22, 19  # awning height at the wall and depth (toward +a)
WA = HALL[0] + A       # world a of the side wall
VAT = (WA + 3, WA + 17, -15, 2)       # a0, a1, b0, b1 (world) of the treading vat
G = ag.GRAPE


def hall(c):
    iso.cast_shadow(c, [(sa * (A + 1), sb * (B + 1)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * KA, sb * KB, ZEAV) for sa in (-1, 1) for sb in (-1, 1)] + [(0, sb * KB, ZEAV + RISE) for sb in (-1, 1)], opacity=0.46)
    iso.contact_ao(c, -A - 1.2, A + 1.2, -B - 1.2, B + 1.2)
    iso.stone_course(c, A + 1.2, B + 1.2, F)
    iso.lime_wall_b(c, B, -A, A, F, H, seed=7)
    iso.lime_wall_a(c, A, -B, B, F, H)
    # the gable triangle above the eave line on the front (+b) wall
    zg = ZEAV + RISE - 2.4
    gg = c.lin("gable", -A, 0, A, 0, [(0, LIME["lit"]), (0.6, LIME["mid"]), (1, LIME["end"])])
    c.add(c.on(c.m_bface(B), f'<path d="{poly([(-A, H - 0.2), (A, H - 0.2), (A, H + 1.4), (0, zg), (-A, H + 1.4)])}" fill="{gg}"/>'
               f'<path d="{poly([(-A, H + 1.4), (0, zg), (A, H + 1.4), (A, H - 2.6), (0, zg - 4.4), (-A, H - 2.6)])}" fill="#6f6553" opacity="0.2"/>'))
    # round window in the gable
    c.add(c.on(c.m_bface(B), f'<circle cx="0" cy="{f(H + 5.2)}" r="3.6" fill="#e4dac6"/><circle cx="0" cy="{f(H + 5.2)}" r="2.6" fill="#2a2420"/>'
               f'<path d="M-2.6,{f(H + 5.2)} L2.6,{f(H + 5.2)} M0,{f(H + 2.6)} L0,{f(H + 7.8)}" stroke="{WOOD["dark"]}" stroke-width="0.6"/>'))
    cellar_arch(c)
    # side (+a) wall: painted door (accent), banner (accent), small window
    door_a(c, A, -21, -12, F, F + 18)
    iso.drape_a(c, A, 11, 18.5, H - 3, 16)
    iso.base_tufts(c, [((-A - 1.2, B + 1.2), (-12, B + 1.2)), ((12, B + 1.2), (A + 1.2, B + 1.2)), ((A + 1.2, B + 1.2), (A + 1.2, -B - 1.2))], n=14, seed=9)
    # roof: low gable with the ridge along b, plus the front verge
    iso.tile_roof_b(c, KA, KB, ZEAV, RISE, rows=12, seed=81)
    v_out = [(-KA - 0.4, ZEAV - 0.2), (0, ZEAV + RISE + 0.4), (KA + 0.4, ZEAV - 0.2)]
    v_in = [(KA - 2.4, ZEAV - 1.9), (0, ZEAV + RISE - 2.2), (-KA + 2.4, ZEAV - 1.9)]
    c.add(c.on(c.m_bface(KB), f'<path d="{poly(v_out + v_in)}" fill="{TERRACOTTA["shade"]}"/>'
               f'<path d="M{f(-KA - 0.4)},{f(ZEAV - 0.2)} L0,{f(ZEAV + RISE + 0.4)} L{f(KA + 0.4)},{f(ZEAV - 0.2)}" fill="none" stroke="{TERRACOTTA["lit"]}" stroke-width="1.2" stroke-linejoin="round"/>'
               + "".join(f'<rect x="{f(sx * t * KA - 0.3)}" y="{f(ZEAV + RISE * (1 - t) - 2)}" width="0.6" height="1.8" fill="{TERRACOTTA["deep"]}" opacity="0.5"/>' for sx in (-1, 1) for t in (0.25, 0.5, 0.75))))


def cellar_arch(c):
    """Big round stone arch in the gable wall: a barrel vault leading down into the cellar."""
    x0, x1 = ARCH
    r = (x1 - x0) / 2
    xm = (x0 + x1) / 2
    zs = F + 9            # spring line of the arch
    zc = zs + r
    x0, x1 = -r, r        # drawn centred, then moved to xm
    arch = f"M{f(x0)},{f(F)} L{f(x0)},{f(zs)} A{f(r)},{f(r)} 0 0 0 {f(x1)},{f(zs)} L{f(x1)},{f(F)}Z"
    inner = c.lin("vault", 0, 0, 0, 1, [(0, "#3a2c22"), (0.6, "#1e1611"), (1, "#120d0a")], bbox=True)
    out = [f'<path d="{arch}" fill="{inner}"/>']
    # the vault receding: two inner rings and the steps down
    for k_, op in ((0.78, 0.5), (0.58, 0.45)):
        rr = r * k_
        out.append(f'<path d="M{f(-rr)},{f(F)} L{f(-rr)},{f(zs)} A{f(rr)},{f(rr)} 0 0 0 {f(rr)},{f(zs)} L{f(rr)},{f(F)}" fill="none" stroke="#5a4a3c" stroke-width="0.7" opacity="{op}"/>')
    for i in range(4):
        w = r * (0.95 - i * 0.12)
        out.append(f'<rect x="{f(-w)}" y="{f(F + i * 1.4)}" width="{f(2 * w)}" height="0.5" fill="#8a7a66" opacity="{f(0.55 - i * 0.1)}"/>')
    # dim amphorae deep inside
    for ax, k_ in ((-3.5, 1.0), (2.8, 0.85)):
        out.append(f'<path d="M{f(ax - 1.4 * k_)},{f(F + 5.6)} C{f(ax - 2.2 * k_)},{f(F + 8)} {f(ax - 1.6 * k_)},{f(F + 10.6)} {f(ax)},{f(F + 11.4)} C{f(ax + 1.6 * k_)},{f(F + 10.6)} {f(ax + 2.2 * k_)},{f(F + 8)} {f(ax + 1.4 * k_)},{f(F + 5.6)}Z" fill="#5a3324" opacity="0.8"/>')
    # voussoirs: stone blocks fanning round the arch, a keystone on top
    vs = []
    n = 11
    for i in range(n):
        t0, t1 = math.pi * i / n, math.pi * (i + 1) / n
        ro = r + 3.2
        p = [(r * math.cos(t0), zs + r * math.sin(t0)), (ro * math.cos(t0), zs + ro * math.sin(t0)),
             (ro * math.cos(t1), zs + ro * math.sin(t1)), (r * math.cos(t1), zs + r * math.sin(t1))]
        tone = ["#e8e0cc", "#d9cfb8", "#e2d9c4"][i % 3]
        vs.append(f'<path d="{poly(p)}" fill="{tone}" stroke="#9d9380" stroke-width="0.35"/>')
    vs.append(f'<path d="{poly([(-1.6, zc - 0.3), (1.6, zc - 0.3), (2.2, zc + 3.9), (-2.2, zc + 3.9)])}" fill="#f1ead8" stroke="#9d9380" stroke-width="0.35"/>')
    for sx in (-1, 1):   # jambs
        for j in range(3):
            vs.append(f'<rect x="{f(x1 if sx > 0 else x0 - 3.2)}" y="{f(F + j * 3)}" width="3.2" height="3" fill="{["#e2d9c4", "#d6ccb5", "#e8e0cc"][j]}" stroke="#9d9380" stroke-width="0.35"/>')
    out.append("".join(vs))
    out.append(f'<path d="{arch}" fill="none" stroke="#2a2018" stroke-width="0.8" opacity="0.5"/>')
    c.add(c.on(c.m_bface(B), f'<g transform="translate({f(xm)} 0)">{"".join(out)}</g>'))
    # a worn threshold in front of the arch
    c.add(c.on(c.m_ground(0.3), f'<rect x="{f(xm + x0 - 1)}" y="{f(B)}" width="{f(x1 - x0 + 2)}" height="3.4" fill="#d9cfb8"/><rect x="{f(xm + x0 - 1)}" y="{f(B + 3)}" width="{f(x1 - x0 + 2)}" height="0.5" fill="#8f8572"/>'))


def door_a(c, a, x0, x1, z0, z1):
    """Plank door on a right (+a) wall, painted in the owner colour (accent) under stone framing."""
    c.add(c.on(c.m_aface(a), f'<rect x="{f(x0 - 1.6)}" y="{f(z0)}" width="{f(x1 - x0 + 3.2)}" height="{f(z1 - z0 + 2.6)}" fill="#c8c2b4"/>'
               f'<rect x="{f(x0 - 2.2)}" y="{f(z1 + 0.6)}" width="{f(x1 - x0 + 4.4)}" height="2.2" fill="#d8d2c4"/>'))
    dg = c.lin("pdoor", 0, 0, 1, 0, [(0, ACCENT["mid"]), (0.5, ACCENT["shade"]), (1, ACCENT["dark"])], bbox=True)
    c.accent(c.on(c.m_aface(a), f'<rect x="{f(x0)}" y="{f(z0)}" width="{f(x1 - x0)}" height="{f(z1 - z0)}" fill="{dg}"/>'))
    pw = (x1 - x0) / 3
    planks = "".join(f'<rect x="{f(x0 + i * pw - 0.2)}" y="{f(z0)}" width="0.4" height="{f(z1 - z0)}" fill="#1d2b36" opacity="0.4"/>' for i in (1, 2))
    c.add(c.on(c.m_aface(a), planks
               + "".join(f'<rect x="{f(x0)}" y="{f(zz)}" width="{f(x1 - x0)}" height="1.1" fill="#1d2b36" opacity="0.28"/>' for zz in (z0 + 4, z1 - 5))
               + f'<circle cx="{f(x1 - 2)}" cy="{f(z0 + 9)}" r="0.8" fill="{iso.BRONZE["lit"]}"/>'
               f'<rect x="{f(x0)}" y="{f(z1 - 2.6)}" width="{f(x1 - x0)}" height="2.6" fill="#1d2b36" opacity="0.3"/>'))


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
          + "".join(iso.grass_tuft(x + dx * k, y + 0.6, 3, "#6c9a38") for dx in (-7, -2.5, 4.5, 8)))


def vat(c):
    """Plastered treading vat full of purple must, with a spout into a sunk collecting jar."""
    a0, a1, b0, b1 = VAT
    h, t, zm = 6.5, 1.6, 4.8
    W = {"top": "#f3ecdd", "left": "#e3d9c4", "right": "#bdb6a8"}
    iso.cast_shadow(c, [(a0, b0), (a1, b0), (a1, b1), (a0, b1)], [(a0, b0, h), (a1, b0, h), (a1, b1, h), (a0, b1, h)], opacity=0.4, sd=1.2)
    iso.contact_ao(c, a0, a1, b0, b1, width=3, opacity=0.4)
    c.add(c.on(c.m_bface(b1), f'<rect x="{a0}" y="0" width="{a1 - a0}" height="{h}" fill="{W["left"]}"/>'
               f'<rect x="{a0}" y="0" width="{a1 - a0}" height="1.2" fill="#6d604a" opacity="0.3"/>'
               f'<rect x="{a0}" y="{f(h - 0.6)}" width="{a1 - a0}" height="0.6" fill="#fff" opacity="0.8"/>'
               # purple stains running down from the rim
               + "".join(f'<path d="M{f(sx)},{f(h)} q0.4,-1.8 0,-{f(ln)} q-0.5,0.4 -0.9,0Z" fill="{G["base"]}" opacity="0.45"/>' for sx, ln in ((a0 + 4, 2.6), (a0 + 9.5, 1.6), (a1 - 3, 3.2)))))
    c.add(c.on(c.m_aface(a1), f'<rect x="{-b1}" y="0" width="{b1 - b0}" height="{h}" fill="{W["right"]}"/>'
               f'<rect x="{-b1}" y="{f(h - 0.5)}" width="{b1 - b0}" height="0.5" fill="#e0ddd5"/>'))
    # inner far walls above the must
    c.add(c.on(c.m_bface(b0 + t), f'<rect x="{a0 + t}" y="{zm}" width="{a1 - a0 - 2 * t}" height="{h - zm}" fill="#d8cdb6"/>'))
    c.add(c.on(c.m_aface(a0 + t), f'<rect x="{-(b1 - t)}" y="{zm}" width="{b1 - b0 - 2 * t}" height="{h - zm}" fill="#a79f90"/>'))
    # the must: purple surface with crushed grapes and froth
    rnd = random.Random(14)
    mg = c.lin("must", a0, b0, a1, b1, [(0, "#8a4a86"), (0.5, "#5c2a60"), (1, "#3e1a44")])
    tex = []
    for _ in range(42):
        aa, bb = rnd.uniform(a0 + t + 0.8, a1 - t - 0.8), rnd.uniform(b0 + t + 0.8, b1 - t - 0.8)
        tex.append(f'<ellipse cx="{f(aa)}" cy="{f(bb)}" rx="{f(rnd.uniform(0.6, 1.2))}" ry="{f(rnd.uniform(0.6, 1.2))}" fill="{rnd.choice([G["lit"], G["shade"], G["dark"], "#9a5a92", "#6f8f34"])}"/>')
    froth = "".join(f'<ellipse cx="{f(rnd.uniform(a0 + 3, a1 - 3))}" cy="{f(rnd.uniform(b0 + 3, b1 - 3))}" rx="{f(rnd.uniform(1.2, 2.6))}" ry="{f(rnd.uniform(0.8, 1.6))}" fill="#d9b8d6" opacity="0.35"/>' for _ in range(7))
    c.add(c.on(c.m_ground(zm), f'<rect x="{a0 + t}" y="{b0 + t}" width="{a1 - a0 - 2 * t}" height="{b1 - b0 - 2 * t}" fill="{mg}"/>' + "".join(tex) + froth
               + f'<rect x="{a0 + t}" y="{b0 + t}" width="{a1 - a0 - 2 * t}" height="1.6" fill="#1a0c1c" opacity="0.35"/>'
               f'<rect x="{a0 + t}" y="{b0 + t}" width="1.6" height="{b1 - b0 - 2 * t}" fill="#1a0c1c" opacity="0.25"/>'))
    # rim on top
    c.add(c.on(c.m_ground(h), f'<path d="M{a0},{b0}h{a1 - a0}v{b1 - b0}h{a0 - a1}Z M{a0 + t},{b0 + t}v{b1 - b0 - 2 * t}h{a1 - a0 - 2 * t}v{-(b1 - b0 - 2 * t)}Z" fill="{W["top"]}" fill-rule="evenodd"/>'))
    # spout on the front, pouring into a sunk jar
    sx = a0 + 9
    c.add(c.on(c.m_bface(b1), f'<rect x="{f(sx - 1.4)}" y="{f(h - 3.2)}" width="2.8" height="1.8" fill="#cfc4ad"/>'))
    c.add(c.on(c.m_ground(h - 1.4), f'<rect x="{f(sx - 1.2)}" y="{b1}" width="2.4" height="2.6" fill="#d9cfb8"/><rect x="{f(sx - 0.7)}" y="{b1}" width="1.4" height="2.6" fill="{G["base"]}"/>'))
    x, y = c.P(sx, b1 + 6.5, 0)
    px, py = c.P(sx, b1 + 2.4, h - 1.4)
    c.add(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="5.4" ry="2.5" fill="#b05f3f"/><ellipse cx="{f(x)}" cy="{f(y)}" rx="4.3" ry="1.9" fill="#3a1a3c"/>'
          f'<ellipse cx="{f(x - 0.6)}" cy="{f(y - 0.2)}" rx="2.4" ry="0.9" fill="{G["lit"]}" opacity="0.7"/>'
          f'<path d="M{f(px - 0.6)},{f(py)} Q{f(px - 0.4)},{f((py + y) / 2)} {f(x - 0.4)},{f(y - 0.6)} L{f(x + 0.6)},{f(y - 0.6)} Q{f(px + 0.8)},{f((py + y) / 2)} {f(px + 0.6)},{f(py)}Z" fill="{G["base"]}"/>')


def amphorae(c):
    """A group of amphorae waiting to be filled, one lying on its side."""
    for a, b, k in ((-46, 18, 0.95), (-41, 22, 1.05), (-35, 25, 0.9), (-48, 26, 0.8)):
        iso.amphora(c, a, b, k=k, shaded=False)
    x, y = c.P(-28, 36, 0)
    c.add(f'<ellipse cx="{f(x + 1)}" cy="{f(y + 0.4)}" rx="9" ry="1.8" fill="#1f2e15" opacity="0.35" filter="{c.blur(0.45)}"/>')
    g = c.lin("amphL", 0, 0, 0, 1, [(0, "#e08a62"), (0.45, "#b5523b"), (1, "#6e2f20")], bbox=True)
    body = ("M0,-0.8 C-3,-3 -8,-4.4 -11.5,-3.6 C-13.5,-3 -14,-1.6 -15,-1.2 L-17.5,-1.3 L-17.5,1.3 L-15,1.2 "
            "C-14,1.6 -13.5,3 -11.5,3.6 C-8,4.4 -3,3 0,0.8Z")
    c.add(f'<g transform="translate({f(x + 8)} {f(y - 3.6)}) rotate(-8)"><path d="{body}" fill="{g}"/>'
          '<ellipse cx="-17.5" cy="0" rx="0.6" ry="1.6" fill="#3a1a10"/>'
          '<rect x="-10.5" y="-3.8" width="0.6" height="7.6" fill="#2d140c" opacity="0.4"/></g>')


def awning_a(c, b0, b1, a, z, depth, drop, stripes=7):
    """Striped awning sloping out from a side wall plane a (facing +a) toward +a. The cloth is
    ACCENT; every second stripe is cream (art). Local x = -b along the wall, y = distance out."""
    tanp = drop / depth
    m = f"matrix(1 -0.5 1 {f(0.5 + iso.ZS * tanp)} {f(c.ox + a)} {f(c.oy + a / 2 - iso.ZS * z)})"
    x0, x1 = -b1, -b0
    w = (x1 - x0) / stripes
    c.accent(c.on(m, f'<rect x="{f(x0)}" y="0" width="{f(x1 - x0)}" height="{f(depth)}" fill="{ACCENT["mid"]}"/>'))
    art = "".join(f'<rect x="{f(x0 + i * w)}" y="0" width="{f(w)}" height="{f(depth)}" fill="#e6d8ba"/>' for i in range(stripes) if i % 2)
    sh = c.lin("awAsh", 0, 0, 0, 1, [(0, "#1d2b36", 0.22), (0.4, "#1d2b36", 0.05), (1, "#fff", 0.1)], bbox=True)
    c.add(c.on(m, art + f'<rect x="{f(x0)}" y="0" width="{f(x1 - x0)}" height="{f(depth)}" fill="{sh}"/>'))
    zf = z - drop
    sc_acc, sc_art = [], []
    for i in range(stripes):
        x = x0 + i * w
        d = f'<path d="M{f(x)},{f(zf)} L{f(x + w)},{f(zf)} L{f(x + w)},{f(zf - 1.2)} Q{f(x + w / 2)},{f(zf - 2.8)} {f(x)},{f(zf - 1.2)}Z" fill="{{}}"/>'
        (sc_acc if i % 2 == 0 else sc_art).append(d)
    c.accent(c.on(c.m_aface(a + depth), "".join(d.format(ACCENT["shade"]) for d in sc_acc)))
    c.add(c.on(c.m_aface(a + depth), "".join(d.format("#d4c6a8") for d in sc_art)))


def build():
    c = iso.Canvas("winery")
    a0, a1, b0, b1 = VAT
    ha, hb = HALL

    def avoid(a, b):
        return ((ha - A - 3 < a < ha + A + 3 and hb - B - 3 < b < hb + B + 6) or (WA - 1 < a < WA + AWN_D + 3 and AWN[0] - 3 < b < AWN[1] + 4))

    iso.base(c, seed=45, avoid=avoid, tufts=70, flowers=12)
    # a worn path of flagstones from the arch to the front
    iso.flagstones(c, [(ha + 1, hb + B + 7, 9, 5.5, 3), (ha + 2, hb + B + 13.5, 8, 5.5, -6), (ha + 0.5, hb + B + 20, 7.5, 5, 8), (ha + 2.5, hb + B + 26, 6.5, 4.6, -3)], z=0.9)
    with c.at(*HALL):
        hall(c)
    # the awning on the side wall shades the vat and the painted door
    pal = {"hi": WOOD["lit"], "mid": WOOD["base"], "dark": WOOD["deep"]}
    zf = AWN_Z - 4
    ag.pole(c, WA + AWN_D - 0.8, AWN[0] + 0.8, 0, zf, w=1.6, pal=pal)
    vat(c)
    ag.pole(c, WA + AWN_D - 0.8, AWN[1] - 0.8, 0, zf, w=1.6, pal=pal)
    awning_a(c, AWN[0], AWN[1], WA, AWN_Z, AWN_D, 4, stripes=7)
    for b in (AWN[0] + 1, AWN[1] - 1):
        c.add(c.on(c.m_aface(WA), f'<rect x="{f(-b - 0.7)}" y="{AWN_Z - 1}" width="1.4" height="2.4" fill="{WOOD["dark"]}"/>'))
    amphorae(c)
    pithos(c, 40, -30, k=1.0, seed=1)
    pithos(c, 50, -17, k=1.1, seed=3)
    ag.basket(c, 14, 20, k=1.05, contents="grapes", seed=31)
    pithos(c, 44, 15, k=1.15, seed=2)
    ag.basket(c, 29, 27, k=0.9, contents="grapes", seed=32)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
