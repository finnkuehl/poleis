"""smelter - a soot-dark stone furnace with a glowing mouth and a tall chimney trailing smoke,
worked by a big leather bellows; bronze ingots, a heap of charcoal and green copper ore
lie around it.
Accent (owner colour): base rim band, the banner, the drape on the furnace and the cloth
over the charcoal crate."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_processing as lp  # noqa: E402
from iso import BRONZE, WOOD, f, poly  # noqa: E402

FURN = (-12, -14)      # furnace centre
W1, H1 = 19, 30        # lower block: half width, height
W2, H2 = 14, 44        # shoulder block: half width, top height
W3, H3 = 7.5, 70       # chimney: half width, top height


def furnace(c):
    S = lp.SOOT
    iso.cast_shadow(c, [(sa * W1, sb * W1) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * W1, sb * W1, H1) for sa in (-1, 1) for sb in (-1, 1)] + [(sa * W3, sb * W3, H3) for sa in (-1, 1) for sb in (-1, 1)], opacity=0.5)
    iso.contact_ao(c, -W1, W1, -W1, W1, opacity=0.5)
    lp.stone_box(c, -W1, W1, -W1, W1, 0, H1, seed=3, pal=S, row=5)
    # stoke hole on the right face, where the bellows' nozzle enters
    c.add(c.on(c.m_aface(W1), f'<circle cx="0" cy="9" r="3.6" fill="#4a4640"/><circle cx="0.4" cy="9" r="2.4" fill="#1e1410"/><circle cx="0.4" cy="9" r="1.3" fill="#f0701e"/>'))
    iso.contact_ao(c, -W2, W2, -W2, W2, z=H1, width=2.5, opacity=0.35)
    lp.stone_box(c, -W2, W2, -W2, W2, H1, H2, seed=13, pal=S, row=4.6, ao=False)
    lp.stone_box(c, -W3, W3, -W3, W3, H2, H3, seed=23, pal=S, row=4.4, ao=False)
    # chimney cap and glowing throat
    iso.box(c, -W3 - 1.4, W3 + 1.4, -W3 - 1.4, W3 + 1.4, H3, H3 + 2.6, "#c9c1b2", "#b3ab9b", "#77746c", edge="#e9e2d2")
    g = c.rad("throat", 0, 0, W3, [(0, "#ffb347"), (0.5, "#b84a16"), (1, "#2a1a14")])
    c.add(c.on(c.m_ground(H3 + 2.6), f'<rect x="{-W3 + 1.4}" y="{-W3 + 1.4}" width="{2 * W3 - 2.8}" height="{2 * W3 - 2.8}" fill="{g}"/>'))
    # soot streaks under the cap, iron bands
    soot = c.lin("soot", 0, H3, 0, H3 - 16, [(0, "#1e1a18", 0.55), (1, "#1e1a18", 0)])
    c.add(c.on(c.m_bface(W3), f'<rect x="{-W3}" y="{H3 - 16}" width="{2 * W3}" height="16" fill="{soot}"/><rect x="{-W3}" y="{H2 + 14}" width="{2 * W3}" height="1.6" fill="#3a3632"/>'))
    c.add(c.on(c.m_aface(W3), f'<rect x="{-W3}" y="{H3 - 16}" width="{2 * W3}" height="16" fill="{soot}"/><rect x="{-W3}" y="{H2 + 14}" width="{2 * W3}" height="1.6" fill="#2a2724"/>'))
    # the mouth: a big glowing arch on the lit face, soot above it
    sm = c.lin("soot2", 0, 22, 0, H1, [(0, "#1e1a18", 0.5), (1, "#1e1a18", 0)])
    c.add(c.on(c.m_bface(W1), f'<path d="M-10,20 L10,20 L7,{H1} L-7,{H1}Z" fill="{sm}"/>'))
    lp.fire_mouth(c, c.m_bface(W1), -8, 8, 1.5, 20, name="furnfire", frame="#c9c1b2", frame_w=2.6)
    # drape with the owner's colour on the shoulder block
    iso.drape_a(c, W2, -6, 6, H2 - 2, 11)


def bellows(c, a0, b0):
    """Big wedge bellows lying along a, nozzle toward the furnace (-a)."""
    L, hw = 26, 7.5
    lift = 13                         # how far the top board is raised at the handle end
    z0 = 3.0
    iso.blob_shadow(c, a0 + L * 0.6, b0, 13, 0.42)
    # trestle feet + bottom board
    lp.timber(c, a0 + 4, a0 + 7, b0 - hw, b0 + hw, 0, z0)
    lp.timber(c, a0 + L - 5, a0 + L - 2, b0 - hw, b0 + hw, 0, z0)
    lp.timber(c, a0 + 2, a0 + L, b0 - hw, b0 + hw, z0, z0 + 1.6)
    # nozzle (bronze pipe) into the stoke hole
    x0, y0 = c.P(a0 - 7, b0, z0 + 3.5)
    x1, y1 = c.P(a0 + 3, b0, z0 + 3)
    c.add(f'<path d="M{f(x0)},{f(y0)} L{f(x1)},{f(y1)}" stroke="{BRONZE["shade"]}" stroke-width="3.4" stroke-linecap="round"/>'
          f'<path d="M{f(x0)},{f(y0 - 0.9)} L{f(x1)},{f(y1 - 0.9)}" stroke="{BRONZE["hi"]}" stroke-width="0.9" stroke-linecap="round"/>')
    zb = z0 + 1.6
    # leather sides: right (+a end, shade) and left (+b side, lit) with pleats
    right = [c.P(a0 + L, b0 - hw, zb), c.P(a0 + L, b0 + hw, zb), c.P(a0 + L, b0 + hw, zb + lift), c.P(a0 + L, b0 - hw, zb + lift)]
    c.add(f'<path d="{poly(right)}" fill="#5e3a22"/>')
    for k in (0.33, 0.66):
        p0, p1 = c.P(a0 + L, b0 - hw, zb + lift * k), c.P(a0 + L, b0 + hw, zb + lift * k)
        c.add(f'<path d="M{f(p0[0])},{f(p0[1])} L{f(p1[0])},{f(p1[1])}" stroke="#2e1a0e" stroke-width="0.7" opacity="0.7"/>')
    left = [c.P(a0 + 2, b0 + hw, zb), c.P(a0 + L, b0 + hw, zb), c.P(a0 + L, b0 + hw, zb + lift), c.P(a0 + 2, b0 + hw, zb + 1.2)]
    lg = c.lin("leather", 0, 0, 1, 0, [(0, "#b0764a"), (1, "#8a5632")], bbox=True)
    c.add(f'<path d="{poly(left)}" fill="{lg}"/>')
    for k in (0.25, 0.5, 0.75):
        p0, p1 = c.P(a0 + 2, b0 + hw, zb + 1.2 * k), c.P(a0 + L, b0 + hw, zb + lift * k)
        c.add(f'<path d="M{f(p0[0])},{f(p0[1])} L{f(p1[0])},{f(p1[1])}" stroke="#4a2c16" stroke-width="0.8" opacity="0.75"/>'
              f'<path d="M{f(p0[0])},{f(p0[1] - 0.8)} L{f(p1[0])},{f(p1[1] - 0.8)}" stroke="#e0a878" stroke-width="0.5" opacity="0.6"/>')
    # tilted top board with studs and a long handle
    top = [c.P(a0 + 2, b0 - hw, zb + 1.2), c.P(a0 + L + 1, b0 - hw, zb + lift + 0.5), c.P(a0 + L + 1, b0 + hw, zb + lift + 0.5), c.P(a0 + 2, b0 + hw, zb + 1.2)]
    c.add(f'<path d="{poly(top)}" fill="{WOOD["lit"]}"/>'
          f'<path d="M{f(top[3][0])},{f(top[3][1])} L{f(top[2][0])},{f(top[2][1])}" stroke="#e2b98a" stroke-width="0.8"/>')
    edge_r = [c.P(a0 + L + 1, b0 - hw, zb + lift + 0.5), c.P(a0 + L + 1, b0 + hw, zb + lift + 0.5), c.P(a0 + L + 1, b0 + hw, zb + lift - 1.1), c.P(a0 + L + 1, b0 - hw, zb + lift - 1.1)]
    c.add(f'<path d="{poly(edge_r)}" fill="{WOOD["dark"]}"/>')
    for k in (0.2, 0.5, 0.8):
        x, y = c.P(a0 + 2 + (L - 1) * k, b0 + hw - 1.2, zb + 1.2 + (lift - 0.7) * k)
        c.add(f'<circle cx="{f(x)}" cy="{f(y)}" r="0.8" fill="{BRONZE["lit"]}"/>')
    h0 = c.P(a0 + L - 2, b0, zb + lift + 0.5)
    h1 = c.P(a0 + L + 13, b0, zb + lift + 9)
    c.add(f'<path d="M{f(h0[0])},{f(h0[1])} L{f(h1[0])},{f(h1[1])}" stroke="{WOOD["dark"]}" stroke-width="2" stroke-linecap="round"/>'
          f'<path d="M{f(h0[0])},{f(h0[1] - 0.6)} L{f(h1[0])},{f(h1[1] - 0.6)}" stroke="{WOOD["lit"]}" stroke-width="0.7" stroke-linecap="round"/>')


def build():
    c = iso.Canvas("smelter")
    fa, fb = FURN

    def avoid(a, b):
        return (fa - W1 - 3 < a < fa + W1 + 34 and fb - W1 - 3 < b < fb + W1 + 3) or (fa - 14 < a < fa + 14 and fb + W1 < b < fb + W1 + 22)
    iso.base(c, seed=77, avoid=avoid, tufts=70, flowers=8)
    # scorched, trodden ground around the furnace
    sc = c.rad("scorch", fa + 4, fb + 12, 46, [(0, "#8a7a5a", 0.85), (0.6, "#a8996a", 0.6), (1, "#a8996a", 0)])
    c.add(f'<g clip-path="{c.url("top")}">' + c.on(c.m_ground(0.2), f'<circle cx="{fa + 4}" cy="{fb + 12}" r="46" fill="{sc}"/>') + "</g>")

    iso.cypress(c, -54, -6, h=40, seed=7)
    iso.banner_b(c, 30, -40, 0, height=40, width=8, drop=16)
    with c.at(*FURN):
        furnace(c)
        sx, sy = c.P(0, 0, H3 + 3)
    lp.smoke(c, sx, sy - 2, k=1.25, seed=6, n=5, tone="#d9d5cf", shade="#8d8983", drift=1.0, rise=6, op=0.9)
    lp.ground_glow(c, fa, fb + W1 + 9, 15, name="furnglow", strength=0.75)

    bellows(c, fa + W1 + 6, fb)

    # copper ore (left), bronze ingots (front), charcoal (right front)
    lp.heap(c, -46, 12, 9, ("#3f6b62", "#5f9384", "#a9d2bd"), seed=4, chunks=16)
    iso.rocks(c, [(-36, 22, 2.2, 6)])
    lp.ingots(c, -26, 36, rows=(4, 3, 2), w=8, d=3.6, h=2.4)
    lp.ingots(c, -12, 44, rows=(2, 1), w=8, d=3.6, h=2.4)
    lp.heap(c, 20, 32, 11, ("#17161a", "#2c2a2e", "#55525a"), seed=9, chunks=20, sparks=0)
    # crate of charcoal under an owner-coloured cloth
    lp.timber(c, 34, 48, 12, 24, 0, 8)
    c.add(c.on(c.m_bface(24), "".join(f'<rect x="{34 + i * 3.5}" y="0" width="0.5" height="8" fill="{WOOD["deep"]}" opacity="0.5"/>' for i in range(1, 4))))
    lp.tarp(c, 33.4, 48.6, 11.4, 24.6, 8.2, drop=3.6)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
