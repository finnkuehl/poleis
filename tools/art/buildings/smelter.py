"""smelter - a soot-dark stone furnace house standing directly on the map (grounded, docs/ART.md)
at the shared human scale: a glowing arched furnace mouth, a tall chimney trailing smoke, molten
bronze running from the tap hole into ingot moulds in a sand bed, a leather bellows under a striped
awning on the side wall, a heap of charcoal, green copper ore, stacked bronze ingots and a crate of
charcoal under a cloth. The game draws the trodden-earth yard underneath.
Accent (owner colour): the striped awning over the bellows, the cloth over the charcoal crate and
the banner at the back of the yard."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_processing as lp  # noqa: E402
from iso import BRONZE, WOOD, f, poly  # noqa: E402

# world units; keep everything inside iso.GROUND_R = 58
FURN = (-20, -16)      # furnace house centre
A, B = 17, 13          # half extents: a 34 x 26 stone block (with the awning: 52 long)
H = 20                 # height of the block (two and a half metres)
CH = (-6, -3)          # chimney centre (local)
W2, H2 = 8, 26         # shoulder: half width, top height
W3, H3 = 5, 48         # chimney: half width, top height
MOUTH = (-12, -3)      # local a range of the furnace mouth on the front (+b) face (9 wide)
TAP_A = 7              # local a of the tap hole
AWN = (-25, -6)        # world b range of the awning on the side (+a) wall
AWN_Z, AWN_D = 17, 16  # awning height at the wall, depth toward +a
WA = FURN[0] + A       # world a of the side wall
MOULD = (-17, 2, -2.6, 8)  # sand bed with the ingot moulds (world a0, a1, b0, b1)
MOLTEN = [(0, "#fff6c0"), (0.35, "#ffc24a"), (1, "#e0601a")]


def furnace(c):
    S = lp.SOOT
    ca, cb = CH
    iso.cast_shadow(c, [(sa * (A + 1), sb * (B + 1)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * A, sb * B, H) for sa in (-1, 1) for sb in (-1, 1)] + [(ca + sa * W3, cb + sb * W3, H3) for sa in (-1, 1) for sb in (-1, 1)], opacity=0.5)
    iso.contact_ao(c, -A - 1, A + 1, -B - 1, B + 1, opacity=0.5)
    lp.stone_box(c, -A, A, -B, B, 0, H, seed=3, pal=S, row=4)
    # flat top: beaten clay with a soot stain round the shoulder
    c.add(c.on(c.m_ground(H), f'<rect x="{-A + 1}" y="{-B + 1}" width="{2 * A - 2}" height="{2 * B - 2}" fill="#a39b8c" opacity="0.6"/>'
               f'<ellipse cx="{ca}" cy="{cb}" rx="{W2 + 6}" ry="{W2 + 5}" fill="#3a3632" opacity="0.25" filter="{c.blur(1.6)}"/>'))
    # tuyere on the side face, where the bellows' nozzle enters
    c.add(c.on(c.m_aface(A), f'<circle cx="{f(-(AWN[0] + AWN[1]) / 2 + FURN[1])}" cy="6" r="2.4" fill="#4a4640"/><circle cx="{f(-(AWN[0] + AWN[1]) / 2 + FURN[1] + 0.3)}" cy="6" r="1.6" fill="#1e1410"/>'
               f'<circle cx="{f(-(AWN[0] + AWN[1]) / 2 + FURN[1] + 0.3)}" cy="6" r="0.9" fill="#f0701e"/>'))
    with c.at(ca, cb):
        iso.contact_ao(c, -W2, W2, -W2, W2, z=H, width=2, opacity=0.35)
        lp.stone_box(c, -W2, W2, -W2, W2, H, H2, seed=13, pal=S, row=3.4, ao=False)
        lp.stone_box(c, -W3, W3, -W3, W3, H2, H3, seed=23, pal=S, row=3.4, ao=False)
        # chimney cap and glowing throat, soot streaks under the cap, an iron band
        iso.box(c, -W3 - 1, W3 + 1, -W3 - 1, W3 + 1, H3, H3 + 1.8, "#c9c1b2", "#b3ab9b", "#77746c", edge="#e9e2d2")
        g = c.rad("throat", 0, 0, W3, [(0, "#ffb347"), (0.5, "#b84a16"), (1, "#2a1a14")])
        c.add(c.on(c.m_ground(H3 + 1.8), f'<rect x="{-W3 + 1}" y="{-W3 + 1}" width="{2 * W3 - 2}" height="{2 * W3 - 2}" fill="{g}"/>'))
        soot = c.lin("soot", 0, H3, 0, H3 - 12, [(0, "#1e1a18", 0.55), (1, "#1e1a18", 0)])
        c.add(c.on(c.m_bface(W3), f'<rect x="{-W3}" y="{H3 - 12}" width="{2 * W3}" height="12" fill="{soot}"/><rect x="{-W3}" y="{H2 + 9}" width="{2 * W3}" height="1.2" fill="#3a3632"/>'))
        c.add(c.on(c.m_aface(W3), f'<rect x="{-W3}" y="{H3 - 12}" width="{2 * W3}" height="12" fill="{soot}"/><rect x="{-W3}" y="{H2 + 9}" width="{2 * W3}" height="1.2" fill="#2a2724"/>'))
    # the mouth: a glowing arch on the lit face, soot above it
    x0, x1 = MOUTH
    xm = (x0 + x1) / 2
    sm = c.lin("soot2", 0, 10, 0, H, [(0, "#1e1a18", 0.5), (1, "#1e1a18", 0)])
    c.add(c.on(c.m_bface(B), f'<path d="M{f(xm - 6.5)},10 L{f(xm + 6.5)},10 L{f(xm + 4.5)},{H} L{f(xm - 4.5)},{H}Z" fill="{sm}"/>'))
    lp.fire_mouth(c, c.m_bface(B), x0, x1, 1, 11, name="furnfire", frame="#c9c1b2", frame_w=1.8)
    # tap hole with molten bronze running out
    c.add(c.on(c.m_bface(B), f'<path d="{lp.arch(TAP_A - 2, TAP_A + 2, 0.8, 4.6)}" fill="#c9c1b2"/><path d="{lp.arch(TAP_A - 1.2, TAP_A + 1.2, 0.8, 3.6)}" fill="#ffb347"/>'))
    lp.ground_glow(c, xm, B + 5, 9, name="furnglow", strength=0.7)


def moulds(c):
    """Sand bed in front of the tap hole: a channel of molten bronze feeding three ingot moulds."""
    a0, a1, b0, b1 = MOULD
    c.add(c.on(c.m_ground(0), f'<rect x="{a0 - 0.6}" y="{b0}" width="{a1 - a0 + 1.2}" height="{b1 - b0 + 0.8}" rx="1" fill="#8a7a5a"/>'))
    c.add(c.on(c.m_ground(0.8), f'<rect x="{a0}" y="{b0}" width="{a1 - a0}" height="{b1 - b0}" rx="1" fill="#d8c79c"/>'
               f'<rect x="{a0}" y="{b0}" width="{a1 - a0}" height="1" fill="#f0e3bd" opacity="0.8"/>'))
    c.add(c.on(c.m_bface(b1), f'<rect x="{a0}" y="0" width="{a1 - a0}" height="0.8" fill="#b8a67c"/>'))
    c.add(c.on(c.m_aface(a1), f'<rect x="{-b1}" y="0" width="{b1 - b0}" height="0.8" fill="#8f805e"/>'))
    hot = c.lin("molten", 0, 0, 1, 1, MOLTEN, bbox=True)
    ta = FURN[0] + TAP_A
    out = [f'<rect x="{f(ta - 0.6)}" y="{b0}" width="1.2" height="4.6" fill="{hot}"/>',
           f'<rect x="{f(a0 + 2)}" y="{f(b0 + 3.6)}" width="{f(ta - a0 - 1.4)}" height="1.1" fill="{hot}"/>']
    for i in range(3):
        ma = a0 + 1.6 + i * 5.6
        out.append(f'<rect x="{f(ma)}" y="{f(b0 + 5.4)}" width="4.2" height="3.6" rx="0.5" fill="#5a4a32"/>'
                   f'<rect x="{f(ma + 0.4)}" y="{f(b0 + 5.8)}" width="3.4" height="2.8" rx="0.4" fill="{hot if i < 2 else "#9a6a3a"}"/>'
                   + (f'<rect x="{f(ma + 1.6)}" y="{f(b0 + 4.6)}" width="1" height="1" fill="{hot}"/>' if i < 2 else ""))
    c.add(c.on(c.m_ground(0.85), "".join(out)))
    g = c.rad("mglow", ta, b0 + 3, 10, [(0, "#ffb347", 0.4), (1, "#ff8a2c", 0)])
    c.add(c.on(c.m_ground(0.9), f'<circle cx="{f(ta - 2)}" cy="{f(b0 + 4)}" r="10" fill="{g}"/>'))


def bellows(c, a0, b0):
    """Wedge bellows lying along a, nozzle toward the furnace (-a), the top board raised."""
    L, hw = 13, 4
    lift = 6
    z0 = 2.0
    iso.blob_shadow(c, a0 + L * 0.6, b0, 7, 0.42)
    lp.timber(c, a0 + 2, a0 + 3.6, b0 - hw, b0 + hw, 0, z0)
    lp.timber(c, a0 + L - 3, a0 + L - 1.4, b0 - hw, b0 + hw, 0, z0)
    lp.timber(c, a0 + 1, a0 + L, b0 - hw, b0 + hw, z0, z0 + 1)
    x0, y0 = c.P(a0 - 4, b0, z0 + 3.4)
    x1, y1 = c.P(a0 + 2, b0, z0 + 2)
    c.add(f'<path d="M{f(x0)},{f(y0)} L{f(x1)},{f(y1)}" stroke="{BRONZE["shade"]}" stroke-width="2.2" stroke-linecap="round"/>'
          f'<path d="M{f(x0)},{f(y0 - 0.6)} L{f(x1)},{f(y1 - 0.6)}" stroke="{BRONZE["hi"]}" stroke-width="0.6" stroke-linecap="round"/>')
    zb = z0 + 1
    right = [c.P(a0 + L, b0 - hw, zb), c.P(a0 + L, b0 + hw, zb), c.P(a0 + L, b0 + hw, zb + lift), c.P(a0 + L, b0 - hw, zb + lift)]
    c.add(f'<path d="{poly(right)}" fill="#5e3a22"/>')
    left = [c.P(a0 + 1, b0 + hw, zb), c.P(a0 + L, b0 + hw, zb), c.P(a0 + L, b0 + hw, zb + lift), c.P(a0 + 1, b0 + hw, zb + 0.8)]
    lg = c.lin("leather", 0, 0, 1, 0, [(0, "#b0764a"), (1, "#8a5632")], bbox=True)
    c.add(f'<path d="{poly(left)}" fill="{lg}"/>')
    for k in (0.33, 0.66):
        p0, p1 = c.P(a0 + 1, b0 + hw, zb + 0.8 * k), c.P(a0 + L, b0 + hw, zb + lift * k)
        c.add(f'<path d="M{f(p0[0])},{f(p0[1])} L{f(p1[0])},{f(p1[1])}" stroke="#4a2c16" stroke-width="0.6" opacity="0.75"/>')
    top = [c.P(a0 + 1, b0 - hw, zb + 0.8), c.P(a0 + L + 0.6, b0 - hw, zb + lift + 0.3), c.P(a0 + L + 0.6, b0 + hw, zb + lift + 0.3), c.P(a0 + 1, b0 + hw, zb + 0.8)]
    c.add(f'<path d="{poly(top)}" fill="{WOOD["lit"]}"/>'
          f'<path d="M{f(top[3][0])},{f(top[3][1])} L{f(top[2][0])},{f(top[2][1])}" stroke="#e2b98a" stroke-width="0.6"/>')
    h0 = c.P(a0 + L - 1, b0, zb + lift + 0.3)
    h1 = c.P(a0 + L + 6, b0, zb + lift + 4.5)
    c.add(f'<path d="M{f(h0[0])},{f(h0[1])} L{f(h1[0])},{f(h1[1])}" stroke="{WOOD["dark"]}" stroke-width="1.3" stroke-linecap="round"/>'
          f'<path d="M{f(h0[0])},{f(h0[1] - 0.4)} L{f(h1[0])},{f(h1[1] - 0.4)}" stroke="{WOOD["lit"]}" stroke-width="0.45" stroke-linecap="round"/>')


def ingots(c, a, b, rows=(3, 2, 1), w=5.0, d=2.4, h=1.4):
    """Pyramid of cast bronze bars lying along a: polished tops with a bright glint."""
    x, y = c.P(a + 2, b, 0)
    c.add(f'<ellipse cx="{f(x)}" cy="{f(y + 0.8)}" rx="{f(w * 1.1)}" ry="{f(d * rows[0] * 0.5)}" fill="#1f2e15" opacity="0.4" filter="{c.blur(0.9)}"/>')
    z = 0.0
    for n in rows:
        for i in range(n):
            b0 = b + (i - n / 2) * (d + 0.4)
            iso.box(c, a - w / 2, a + w / 2, b0, b0 + d, z, z + h, "#f2c27a", "#c07a36", "#7e4e22", edge="#fff0c4")
            c.add(c.on(c.m_ground(z + h), f'<rect x="{f(a - w / 2 + 0.8)}" y="{f(b0 + d * 0.3)}" width="{f(w - 1.6)}" height="0.5" fill="#fffbe8" opacity="0.85"/>'))
        z += h


def build():
    c = iso.Canvas("smelter")
    iso.ground(c)
    fa, fb = FURN
    iso.ground_ao(c, [(fa - A - 2, fb - B - 2), (WA + AWN_D + 2, AWN[0] - 2), (WA + AWN_D + 4, 14), (20, 36), (-44, 30), (fa - A - 2, fb + B + 2)], grow=6, opacity=0.14)

    iso.banner_b(c, 16, -38, 0, height=28, width=6.5, drop=12)
    with c.at(*FURN):
        furnace(c)
        sx, sy = c.P(CH[0], CH[1], H3 + 2)
    lp.smoke(c, sx, sy - 1, k=0.95, seed=6, n=5, tone="#d9d5cf", shade="#8d8983", drift=1.0, rise=5.5, op=0.9)

    # bellows under the awning on the side wall
    pal = {"hi": WOOD["lit"], "mid": WOOD["base"], "dark": WOOD["deep"]}
    zf = AWN_Z - 3.5
    for b in (AWN[0] + 0.8,):
        x, y = c.P(WA + AWN_D - 0.8, b, 0)
        _, yt = c.P(WA + AWN_D - 0.8, b, zf)
        c.add(f'<rect x="{f(x - 0.65)}" y="{f(yt)}" width="1.3" height="{f(y - yt)}" fill="{pal["mid"]}"/><rect x="{f(x - 0.65)}" y="{f(yt)}" width="0.5" height="{f(y - yt)}" fill="{pal["hi"]}"/>')
    bellows(c, WA + 3, (AWN[0] + AWN[1]) / 2)
    for b in (AWN[1] - 0.8,):
        x, y = c.P(WA + AWN_D - 0.8, b, 0)
        _, yt = c.P(WA + AWN_D - 0.8, b, zf)
        iso.blob_shadow(c, WA + AWN_D + 0.5, b, 1.4, 0.35)
        c.add(f'<rect x="{f(x - 0.65)}" y="{f(yt)}" width="1.3" height="{f(y - yt)}" fill="{pal["mid"]}"/><rect x="{f(x - 0.65)}" y="{f(yt)}" width="0.5" height="{f(y - yt)}" fill="{pal["hi"]}"/>')
    lp.awning_a(c, AWN[0], AWN[1], WA, AWN_Z, AWN_D, 3.5, stripes=7)

    moulds(c)
    # copper ore (right), charcoal (right front), bronze ingots (front left)
    lp.heap(c, 30, 2, 5.5, ("#3f6b62", "#5f9384", "#a9d2bd"), seed=4, chunks=12)
    lp.heap(c, 22, 14, 7, ("#17161a", "#2c2a2e", "#55525a"), seed=9, chunks=14)
    ingots(c, -36, 12, rows=(3, 2, 1))
    ingots(c, -28, 20, rows=(2, 1))
    # crate of charcoal under an owner-coloured cloth
    iso.cast_shadow(c, [(34, 14), (44, 14), (44, 23), (34, 23)], [(34, 14, 6), (44, 14, 6), (44, 23, 6), (34, 23, 6)], opacity=0.36, sd=1.2)
    lp.timber(c, 34, 44, 14, 23, 0, 6)
    c.add(c.on(c.m_bface(23), "".join(f'<rect x="{34 + i * 2.5}" y="0" width="0.4" height="6" fill="{WOOD["deep"]}" opacity="0.5"/>' for i in range(1, 4))))
    lp.tarp(c, 33.5, 44.5, 13.5, 23.5, 6.2, drop=3)
    iso.rocks(c, [(-44, 0, 1.6, 6), (8, 30, 1.3, 7)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
