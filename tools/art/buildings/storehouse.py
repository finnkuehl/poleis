"""storehouse - a long, low warehouse standing directly on the map (grounded, docs/ART.md): stone
plinth, whitewashed walls, a shallow barrel-tile roof, an open timber loading front full of stored
amphorae and sacks, and goods waiting in front of it (amphorae, sacks, crates, a loaded hand cart).
Accent (owner colour): the cloth valances of the loading bays, the gable shutters, the cloth over
the crates. Shared human scale (README "Scale"): a large building, 76 x 34, door 9 x 16."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_civic as lc  # noqa: E402
from iso import f  # noqa: E402
from lib_civic import rect  # noqa: E402

# geometry (world units; shared human scale, README "Scale": a large building, 76 x 34, door 9 x 16).
# The hall stands at the back of the tile, the goods wait in front of it.
POS = (-2, -14)
A, B = 38, 17          # half length and half depth: much longer and lower than the house
F = 7                  # stone plinth height
H = 29                 # wall height (eave line): one tall storey above the plinth
R = 8                  # roof rise (shallow)
T = 3.6
AV, BV = A + 3.5, B + 5
TANP = R / B
ZR = H + R + T
BAY = (-31, 8, 20)     # open loading front: x0, x1, beam height


def bay(c):
    """The open loading front: three timber bays showing the dark store full of amphorae, sacks
    and crates, with an owner-coloured cloth valance under the beam."""
    x0, x1, zt = BAY
    n = 3
    w = (x1 - x0) / n
    inner = c.lin("bayin", 0, 0, 0, zt, [(0, "#4a3523"), (0.35, "#2a1e15"), (1, "#15100c")])
    g = [rect(x0, 0, x1 - x0, zt, inner)]
    amph = ('<path d="M-0.8,0 C-3,-3 -4.2,-8 -3.4,-11.5 C-3,-13.5 -1.6,-14 -1.2,-15 L-1.3,-17 L1.3,-17 L1.2,-15 C1.6,-14 3,-13.5 3.4,-11.5 C4.2,-8 3,-3 0.8,0Z" fill="%s"/>'
            '<path d="M-2.4,-10.5 C-2.8,-7 -1.8,-4 -1,-2" fill="none" stroke="%s" stroke-width="0.7" opacity="0.8"/>')
    # back row (dim), then a front row catching the light
    for i in range(9):
        ax = x0 + 3.5 + i * (x1 - x0 - 7) / 8
        g.append(f'<g transform="translate({f(ax)} 6) scale(0.56 {f(-0.56 / iso.ZS)})">{amph % ("#5e3220", "#7d4a32")}</g>')
    for ax in (x0 + 4, x0 + 9, x1 - 9, x1 - 4):
        g.append(f'<g transform="translate({f(ax)} 0.8) scale(0.64 {f(-0.64 / iso.ZS)})">{amph % ("#b05f3f", "#eaa57e")}</g>')
    # sacks stacked in the middle bay
    for sx, sz, col in ((x0 + w * 1.25, 0.4, "#c9b386"), (x0 + w * 1.5, 0.4, "#b8a070"), (x0 + w * 1.75, 0.4, "#c4ad7e"), (x0 + w * 1.38, 3.9, "#d6c194"), (x0 + w * 1.62, 3.9, "#cbb688"), (x0 + w * 1.5, 7.2, "#dcc89c")):
        g.append(f'<ellipse cx="{f(sx)}" cy="{f(sz + 2.1)}" rx="2.9" ry="2" fill="{col}"/><ellipse cx="{f(sx - 0.9)}" cy="{f(sz + 3)}" rx="1.4" ry="0.6" fill="#efe0bc" opacity="0.6"/>')
    g.append(rect(x0, zt - 7, x1 - x0, 7, "#0c0906", 0.45))
    c.add(c.on(c.m_bface(B), "".join(g)))
    # sunlit threshold
    c.add(c.on(c.m_ground(0.2), rect(x0, B, x1 - x0, 4, "#e2d3ad") + rect(x0, B, x1 - x0, 1.4, "#3d352a", 0.3)))
    # timber posts and the beam
    W = iso.WOOD
    posts = "".join(rect(x0 + i * w - 1.3, 0, 2.6, zt, W["base"]) + rect(x0 + i * w - 1.3, 0, 0.9, zt, W["lit"]) + rect(x0 + i * w + 0.8, 0, 0.5, zt, W["deep"], 0.7)
                    for i in range(n + 1))
    beam = rect(x0 - 2.5, zt, x1 - x0 + 5, 3, W["lit"]) + rect(x0 - 2.5, zt, x1 - x0 + 5, 0.7, W["deep"], 0.7) + rect(x0 - 2.5, zt + 2.4, x1 - x0 + 5, 0.6, "#d9a878")
    # cloth valance (ACCENT): one scalloped strip per bay
    fold = c.lin("valfold", 0, 0, 1, 0, [(0, iso.ACCENT["lit"]), (0.3, iso.ACCENT["light"]), (0.5, iso.ACCENT["mid"]), (0.72, iso.ACCENT["light"]), (1, iso.ACCENT["shade"])], bbox=True)
    acc, hem = [], []
    for i in range(n):
        a0, a1 = x0 + i * w + 1.3, x0 + (i + 1) * w - 1.3
        m = (a0 + a1) / 2
        acc.append(f'<path d="M{f(a0)},{f(zt)} L{f(a1)},{f(zt)} L{f(a1)},{f(zt - 8)} Q{f(m)},{f(zt - 4)} {f(a0)},{f(zt - 8)}Z" fill="{fold}"/>')
        hem.append(f'<path d="M{f(a1)},{f(zt - 7.8)} Q{f(m)},{f(zt - 3.8)} {f(a0)},{f(zt - 7.8)}" fill="none" stroke="{iso.GOLD["lit"]}" stroke-width="0.8"/>')
    c.add(c.on(c.m_bface(B), posts))
    c.accent(c.on(c.m_bface(B), "".join(acc)))
    c.add(c.on(c.m_bface(B), "".join(hem) + beam))


def hall(c):
    ze = ZR - BV * TANP
    iso.cast_shadow(c, [(sa * (A + 1), sb * (B + 1)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * AV, sb * BV, ze) for sa in (-1, 1) for sb in (-1, 1)] + [(sa * AV, 0, ZR + 2) for sa in (-1, 1)])
    iso.contact_ao(c, -A - 1, A + 1, -B - 1, B + 1)
    # stone plinth, whitewash above
    lc.wall_block(c, -A - 1, A + 1, -B - 1, B + 1, 0, F, seed=4)
    iso.lime_wall_b(c, B, -A, A, F, H, mottle=10)
    iso.lime_wall_a(c, A, -B, B, F, H, gable=R)
    # gable: shuttered loft hatch, hoist beam with a hanging sack
    iso.window_a(c, A, -4.5, 4.5, 14, 23)
    # front: slit vents, closed side door, the gate
    vents = "".join(rect(x, 19.5, 5.5, 2.8, "#2e2a26") + rect(x - 0.8, 18.7, 7.1, 0.9, "#e9e2d2") + rect(x, 21.7, 5.5, 0.6, "#100c08", 0.6)
                    for x in (-36.5, 27.5))
    c.add(c.on(c.m_bface(B), vents))
    iso.door_b(c, B, 14, 23, F - 4, F + 12)
    c.add(c.on(c.m_ground(F - 4), rect(12, B, 13, 4, "#ece5d5")) + c.on(c.m_bface(B + 4), rect(12, 0, 13, F - 4, "#cfc4ab"))
          + c.on(c.m_aface(25), rect(-B - 4, 0, 4, F - 4, "#a39c8e")))
    bay(c)
    iso.eave_shadow_b(c, B, -A, A, H, depth=7)
    iso.tile_roof_a(c, AV, BV, ZR, TANP, T=T, n=14, courses=4)
    # hoist: a beam poking out of the gable with a rope and a sack
    zb = H + R - 3.4
    c.add(c.on(c.m_ground(zb + 2.4), rect(A, -1.3, 9, 2.6, "#a8744a")) + c.on(c.m_bface(1.3), rect(A, zb, 9, 2.4, "#7a4f2e"))
          + c.on(c.m_aface(A + 9), rect(-1.3, zb, 2.6, 2.4, "#4a2e19")))
    x, y = c.P(A + 7, 0, zb)
    _, y2 = c.P(A + 7, 0, 16)
    c.add(f'<path d="M{f(x)},{f(y)} L{f(x)},{f(y2 - 9)}" stroke="#6a5433" stroke-width="0.7"/>')
    lc.sack(c, A + 7, 0, 16, 0.8, shadow=False)


def build():
    c = iso.Canvas("storehouse")
    iso.ground(c)
    pa, pb = POS
    # wide soft AO under the hall and the goods in front of it
    iso.ground_ao(c, [(pa - A - 2, pb - B - 2), (pa + A + 2, pb - B - 2), (42, 34), (-30, 38)], grow=7, opacity=0.14)
    with c.at(pa, pb):
        hall(c)
        iso.foot_tufts(c, [((-A - 1, B + 1), (-36, B + 1)), ((A + 1, B + 1), (A + 1, -B - 1))], n=10, seed=8, hmax=3.6, kind="dry")
        # amphorae leaning against the left part of the wall
        for a, b, k in ((-36, B + 3, 0.6), (-33, B + 4.2, 0.62), (-37.5, B + 7, 0.55), (10.8, B + 3, 0.58)):
            iso.amphora(c, a, b, k=k, shaded=False)
    # goods in front of the hall
    lc.crate(c, 33, 18, 4.6, 7.5)
    lc.crate(c, 34, 29, 5, 8)
    lc.tarp(c, 34, 29, 5, 8, drop=4)
    lc.crate(c, 33.5, 18.5, 3.6, 5.5, z=7.5)
    lc.sack(c, -25, 24, k=0.95)
    lc.sack(c, -18.5, 27, k=0.95)
    lc.sack(c, -27, 30.5, k=0.9)
    lc.sack(c, -20, 33, k=1.0, lying=True)
    lc.sack(c, -22, 27.5, 8, k=0.85, lying=True, shadow=False)
    lc.hand_cart(c, 2, 36)
    lc.basket(c, 22, 40, 0.9, "#6f8f3a", "#a9c56e")
    iso.pebbles(c, [(-40, 24, 1.4, 5), (-37, 30, 1.0, 6), (26, 46, 1.1, 7)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
