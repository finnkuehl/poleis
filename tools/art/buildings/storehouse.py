"""storehouse - a long, low warehouse: stone plinth, whitewashed walls, a shallow barrel-tile
roof, an open timber loading front full of stored amphorae and sacks, and goods waiting in the yard (amphorae,
sacks, crates, a loaded hand cart).
Accent (owner colour): base rim band, the cloth valances of the loading bays, the gable shutters,
the cloth over the crates."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_civic as lc  # noqa: E402
from iso import f  # noqa: E402
from lib_civic import rect  # noqa: E402

# geometry (world units). The hall stands at the back of the base, the yard in front of it.
POS = (-2, -15)
A, B = 45, 19          # half length and half depth: much longer and lower than the house
F = 9                  # stone plinth height
H = 31                 # wall height (eave line)
R = 8.5                # roof rise (shallow)
T = 3.6
AV, BV = A + 3.5, B + 5
TANP = R / B
ZR = H + R + T
BAY = (-33, 12, 21.5)   # open loading front: x0, x1, beam height


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
        g.append(f'<g transform="translate({f(ax)} 6.5) scale(0.7 {f(-0.7 / iso.ZS)})">{amph % ("#5e3220", "#7d4a32")}</g>')
    for ax in (x0 + 4.6, x0 + 10.6, x1 - 10.4, x1 - 4.4):
        g.append(f'<g transform="translate({f(ax)} 0.8) scale(0.86 {f(-0.86 / iso.ZS)})">{amph % ("#b05f3f", "#eaa57e")}</g>')
    # sacks stacked in the middle bay
    for sx, sz, col in ((x0 + w * 1.28, 0.4, "#c9b386"), (x0 + w * 1.54, 0.4, "#b8a070"), (x0 + w * 1.78, 0.4, "#c4ad7e"), (x0 + w * 1.4, 4.4, "#d6c194"), (x0 + w * 1.66, 4.4, "#cbb688"), (x0 + w * 1.53, 8.2, "#dcc89c")):
        g.append(f'<ellipse cx="{f(sx)}" cy="{f(sz + 2.4)}" rx="3.4" ry="2.3" fill="{col}"/><ellipse cx="{f(sx - 1)}" cy="{f(sz + 3.4)}" rx="1.6" ry="0.7" fill="#efe0bc" opacity="0.6"/>')
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
        acc.append(f'<path d="M{f(a0)},{f(zt)} L{f(a1)},{f(zt)} L{f(a1)},{f(zt - 9)} Q{f(m)},{f(zt - 4.6)} {f(a0)},{f(zt - 9)}Z" fill="{fold}"/>')
        hem.append(f'<path d="M{f(a1)},{f(zt - 8.8)} Q{f(m)},{f(zt - 4.4)} {f(a0)},{f(zt - 8.8)}" fill="none" stroke="{iso.GOLD["lit"]}" stroke-width="0.8"/>')
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
    iso.window_a(c, A, -6, 6, 14.5, 26.5)
    # front: slit vents, closed side door, the gate
    vents = "".join(rect(x, 19.5, 5.5, 2.8, "#2e2a26") + rect(x - 0.8, 18.7, 7.1, 0.9, "#e9e2d2") + rect(x, 21.7, 5.5, 0.6, "#100c08", 0.6)
                    for x in (-42, 15.5, 36.5))
    c.add(c.on(c.m_bface(B), vents))
    iso.door_b(c, B, 22, 31, F - 5, F + 12)
    c.add(c.on(c.m_ground(F - 5), rect(20, B, 13, 4, "#ece5d5")) + c.on(c.m_bface(B + 4), rect(20, 0, 13, F - 5, "#cfc4ab"))
          + c.on(c.m_aface(33), rect(-B - 4, 0, 4, F - 5, "#a39c8e")))
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
    lc.sack(c, A + 7, 0, 16, 0.85, shadow=False)


def build():
    c = iso.Canvas("storehouse")
    pa, pb = POS
    iso.base(c, seed=41, tufts=70, flowers=12,
             avoid=lambda a, b: (-A - 4 < a - pa < A + 4 and -B - 4 < b - pb < B + 6) or (-34 < a < 44 and 6 < b < 50))
    # trodden earth yard in front of the gate
    x, y = c.P(2, 30, 0)
    yard = c.rad("yard", x, y, 62, [(0, "#e6d4a6"), (0.6, "#dcc894", 0.9), (1, "#d2bd84", 0)])
    c.add(f'<g clip-path="{c.url("top")}"><ellipse cx="{f(x)}" cy="{f(y)}" rx="62" ry="27" fill="{yard}"/></g>')
    with c.at(pa, pb):
        hall(c)
        iso.base_tufts(c, [((-A - 1, B + 1), (-36, B + 1)), ((A + 1, B + 1), (A + 1, -B - 1))], n=12, seed=8, hmax=3.6)
        # amphorae leaning against the left part of the wall
        for a, b, k in ((-43, B + 3.5, 1.0), (-38.5, B + 4.5, 1.1), (-42, B + 9, 0.9), (16.5, B + 3.6, 0.95)):
            iso.amphora(c, a, b, k=k, shaded=False)
    # goods in the yard
    lc.crate(c, 37, 20, 5.2, 8.5)
    lc.crate(c, 38.5, 31.5, 5.6, 9.5)
    lc.tarp(c, 38.5, 31.5, 5.6, 9.5, drop=4.5)
    lc.crate(c, 37.5, 20.5, 4, 6, z=8.5)
    lc.sack(c, -27, 27, k=1.15)
    lc.sack(c, -19, 30, k=1.15)
    lc.sack(c, -30, 34, k=1.1)
    lc.sack(c, -22, 37, k=1.2, lying=True)
    lc.sack(c, -24, 30.5, 9.5, k=1.0, lying=True, shadow=False)
    lc.hand_cart(c, 2, 39)
    lc.basket(c, 24, 43, 1.0, "#6f8f3a", "#a9c56e")
    iso.rocks(c, [(-50, 22, 2.6, 5), (-46, 30, 1.8, 6)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
