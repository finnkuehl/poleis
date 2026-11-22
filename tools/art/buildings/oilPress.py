"""oilPress - a lever press standing directly on the map (grounded, docs/ART.md) at the shared human
scale: a small whitewashed press-house with a tile roof, and anchored in its side wall a long timber
lever beam that squeezes a stack of olive mats on a round stone bed, pulled down by a hanging
weight stone; golden oil runs into a round basin, with amphorae, baskets of olives and an olive
tree around it. The game draws the trodden-earth yard underneath.
Accent (owner colour): the painted door and the closed shutters of the press-house, and a cloth
hanging from the lever beam."""
import sys

sys.dont_write_bytecode = True
import math  # noqa: E402
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_processing as lp  # noqa: E402
from iso import WOOD, f  # noqa: E402

# world units; keep everything inside iso.GROUND_R = 58
HUT = (-27, -16)       # press-house centre
A, B = 18, 14          # half extents: a 36 x 28 room
F = 3                  # stone footing
H = 26                 # wall height (eave line)
R = 9                  # roof rise
AV, BV = A + 3, B + 4
TANP = R / B
ZR = H + R + 3.4
BEAM_B = (-17, -11.5)  # the lever beam runs along a at this b range (world), out of the hut's wall
BEAM_Z = (13.5, 19)
BEAM_A = (HUT[0] + A, 38)
BED = (3, -14)         # press bed centre (under the beam)
BED_R, BED_H = 8.5, 4
WEIGHT_A = 33          # where the weight stone hangs
BASIN = (4, 6)         # collecting basin centre
OIL = {"hi": "#fff2a8", "lit": "#f6d04e", "base": "#e0a92c", "shade": "#a8741a"}
OLIVES = ("#5f6d2e", "#3d3152", "#2c2a22")   # basket fill: green and black olives, dark inside
STONE_SIDE = [(0, "#e2dccd"), (0.4, "#cfc6b2"), (0.75, "#9f9a90"), (1, "#87847c")]


def press_house(c):
    ze = ZR - BV * TANP
    iso.cast_shadow(c, [(sa * (A + 1), sb * (B + 1)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * AV, sb * BV, ze) for sa in (-1, 1) for sb in (-1, 1)] + [(sa * AV, 0, ZR + 1) for sa in (-1, 1)], opacity=0.46)
    iso.contact_ao(c, -A - 1, A + 1, -B - 1, B + 1)
    iso.stone_course(c, A + 1, B + 1, F, seed=6)
    iso.lime_wall_b(c, B, -A, A, F, H, seed=4, mottle=8)
    iso.lime_wall_a(c, A, -B, B, F, H, gable=R)
    iso.door_b(c, B, -9, 0, F, F + 16, accent=True)
    iso.window_a(c, A, -11, -4, 13, 21)
    # the socket in the side wall where the lever beam is anchored (stone frame, dark slot)
    b0, b1 = BEAM_B[0] - HUT[1], BEAM_B[1] - HUT[1]
    z0, z1 = BEAM_Z
    c.add(c.on(c.m_aface(A), f'<rect x="{f(-b1 - 2.2)}" y="{f(z0 - 2.4)}" width="{f(b1 - b0 + 4.4)}" height="{f(z1 - z0 + 5)}" fill="#cfc9bb"/>'
               f'<rect x="{f(-b1 - 0.6)}" y="{f(z0 - 0.6)}" width="{f(b1 - b0 + 1.2)}" height="{f(z1 - z0 + 1.6)}" fill="#3a332a"/>'))
    iso.eave_shadow_b(c, B, -A, A, H, depth=7)
    iso.foot_tufts(c, [((-A - 1, B + 1), (-10, B + 1)), ((A + 1, B + 1), (A + 1, -B - 1))], n=8, seed=4, kind="dry", stones=2)
    iso.tile_roof_a(c, AV, BV, ZR, TANP, T=3.4, n=9, courses=4, seed=31)


def mats(c):
    """Stack of woven press mats (frails) full of olive paste, with the press board on top."""
    z = BED_H
    for i in range(5):
        r = 5.8 - 0.15 * i
        iso.cylinder(c, r, z, z + 1.5, [(0, "#e8cf92"), (0.4, "#cfae6a"), (0.8, "#96743c"), (1, "#7a5c2c")], top="#d9bd7c", name="mat")
        c.add(f'<path d="{iso.ring_front_arc(c, r, z + 0.2)}" fill="none" stroke="#4a4a1e" stroke-width="0.8" opacity="0.75"/>')
        z += 1.7
    c.add(f'<path d="{iso.ring_front_arc(c, 6.6, BED_H + 0.2)}" fill="none" stroke="{OIL["lit"]}" stroke-width="1.2" opacity="0.9"/>')
    lp.timber(c, -5, 5, -5, 5, z, z + 1.6)
    return z + 1.6


def build():
    c = iso.Canvas("oilPress")
    iso.ground(c)
    ha, hb = HUT
    bx, bb = BASIN
    iso.ground_ao(c, [(ha - A - 2, hb - B - 2), (ha + A + 2, hb - B - 2), (BEAM_A[1] + 3, BEAM_B[0] - 3), (BEAM_A[1] + 3, BEAM_B[1] + 4), (bx + 8, bb + 8), (-30, 20)], grow=6, opacity=0.13)

    iso.olive_tree(c, 22, -42, size=0.72, seed=4)
    with c.at(*HUT):
        press_house(c)
    pa0, pa1 = BEAM_A
    b0, b1 = BEAM_B
    z0, z1 = BEAM_Z

    # the beam's shadow on the ground, falling to the lower right
    iso.cast_shadow(c, [(pa0, b0), (pa1, b0), (pa1, b1), (pa0, b1)], [(pa0, b0, z1), (pa1, b0, z1), (pa1, b1, z1), (pa0, b1, z1)], opacity=0.3, sd=1.6)

    # press bed: round stone with a rim groove and a spout toward the basin
    with c.at(*BED):
        ring = [i * math.pi / 8 for i in range(16)]
        iso.cast_shadow(c, [(BED_R * math.cos(t), BED_R * math.sin(t)) for t in ring], [(6 * math.cos(t), 6 * math.sin(t), 13) for t in ring], opacity=0.36)
        x, y = c.P(0, 0, 0)
        c.add(f'<ellipse cx="{f(x + 1.6)}" cy="{f(y + 0.6)}" rx="{f(BED_R * 1.414 + 1.4)}" ry="{f(BED_R * 0.707 + 1)}" fill="#3a3220" opacity="0.4" filter="{c.blur(1.2)}"/>')
        iso.cylinder(c, BED_R, 0, BED_H, STONE_SIDE, top="#ece6d8", name="bed")
        xt, yt = c.P(0, 0, BED_H)
        rr = 7.2 * 1.414
        c.add(f'<ellipse cx="{f(xt)}" cy="{f(yt)}" rx="{f(rr)}" ry="{f(rr / 2)}" fill="none" stroke="{OIL["base"]}" stroke-width="1.4"/>'
              f'<ellipse cx="{f(xt)}" cy="{f(yt)}" rx="{f(rr)}" ry="{f(rr / 2)}" fill="none" stroke="{OIL["hi"]}" stroke-width="0.45" opacity="0.8"/>'
              f'<path d="{iso.ring_front_arc(c, BED_R, BED_H, 0.3)}" fill="none" stroke="#fff" stroke-width="0.6" opacity="0.7"/>')
        top = mats(c)
    # spout and the stream of oil into the basin
    lp.timber(c, bx - 1.1, bx + 1.1, BED[1] + BED_R - 0.8, bb - 4.6, BED_H - 1.8, BED_H - 0.6,
              pal={"lit": OIL["lit"], "base": "#b9b09c", "dark": "#8d887e"}, edge="#fff")
    x0, y0 = c.P(bx, bb - 4.6, BED_H - 0.7)
    x1, y1 = c.P(bx, bb - 3.4, 2.2)
    c.add(f'<path d="M{f(x0)},{f(y0)} Q{f(x0 - 1)},{f(y0 + 2)} {f(x1)},{f(y1)}" fill="none" stroke="{OIL["lit"]}" stroke-width="1.1" stroke-linecap="round"/>'
          f'<path d="M{f(x0)},{f(y0)} Q{f(x0 - 1)},{f(y0 + 2)} {f(x1)},{f(y1)}" fill="none" stroke="{OIL["hi"]}" stroke-width="0.4" stroke-linecap="round"/>')
    with c.at(bx, bb):
        x, y = c.P(0, 0, 0)
        c.add(f'<ellipse cx="{f(x + 1.5)}" cy="{f(y + 0.7)}" rx="11" ry="5.4" fill="#3a3220" opacity="0.4" filter="{c.blur(1)}"/>')
        iso.cylinder(c, 6.8, 0, 2.6, STONE_SIDE, top="#ece6d8", name="basin")
        xt, yt = c.P(0, 0, 2.6)
        oil = c.rad("oil", xt - 3, yt - 1.2, 10, [(0, OIL["hi"]), (0.35, OIL["lit"]), (0.8, OIL["base"]), (1, OIL["shade"])])
        c.add(f'<ellipse cx="{f(xt)}" cy="{f(yt + 0.3)}" rx="{f(5.6 * 1.414)}" ry="{f(5.6 * 0.707)}" fill="#8d887e"/>'
              f'<ellipse cx="{f(xt)}" cy="{f(yt + 0.7)}" rx="{f(5.2 * 1.414)}" ry="{f(5.1 * 0.707)}" fill="{oil}"/>'
              f'<path d="M{f(xt - 5.4)},{f(yt)} Q{f(xt - 2.4)},{f(yt - 2.3)} {f(xt + 1.8)},{f(yt - 2)}" fill="none" stroke="#fffbe0" stroke-width="0.7" stroke-linecap="round" opacity="0.85"/>')

    # weight stone hanging under the beam's end (drawn first: the beam passes above it)
    wa, wb = WEIGHT_A, (b0 + b1) / 2
    iso.blob_shadow(c, wa + 4, wb, 6, 0.42)
    lp.stone_box(c, wa - 4.5, wa + 4.5, wb - 4.5, wb + 4.5, 2.5, 10, seed=31, row=3.8, ao=False, pal=lp.SOOT)
    c.add(c.on(c.m_bface(wb + 4.5), f'<circle cx="{wa}" cy="7.6" r="1.1" fill="#3a332a"/>'))
    # the lever beam, from the wall socket over the mats to the weight
    lp.timber(c, pa0, pa1, b0, b1, z0, z1)
    c.add(c.on(c.m_bface(b1), "".join(f'<rect x="{f(pa0 + 4 + i * 11)}" y="{f(z0 + 1.2 + (i % 2) * 1.4)}" width="7" height="0.35" fill="{WOOD["dark"]}" opacity="0.5"/>' for i in range(4))))
    for a in (pa0 + 8, BED[0] + 7):
        c.add(c.on(c.m_bface(b1), f'<rect x="{f(a)}" y="{f(z0)}" width="1.3" height="{f(z1 - z0)}" fill="#4a4640"/>') + c.on(c.m_ground(z1), f'<rect x="{f(a)}" y="{f(b0)}" width="1.3" height="{f(b1 - b0)}" fill="#6a665e"/>'))
    # owner-coloured cloth hanging from the beam
    iso.drape_b(c, b1 + 0.1, 18, 25, z0 + 0.2, 8)

    # ropes from the beam's end down to the weight stone
    for a in (wa - 2.4, wa + 2.4):
        x0, y0 = c.P(a, b1, z0)
        x1, y1 = c.P(a, wb + 4.5, 10)
        c.add(f'<path d="M{f(x0)},{f(y0)} L{f(x1)},{f(y1)}" stroke="#8a6a40" stroke-width="0.9"/><path d="M{f(x0 - 0.3)},{f(y0)} L{f(x1 - 0.3)},{f(y1)}" stroke="#e2c690" stroke-width="0.35"/>')
        c.add(c.on(c.m_bface(b1), f'<rect x="{f(a - 0.5)}" y="{f(z0)}" width="1" height="{f(z1 - z0)}" fill="#b08a55"/>') + c.on(c.m_ground(z1), f'<rect x="{f(a - 0.5)}" y="{f(b0)}" width="1" height="{f(b1 - b0)}" fill="#d9b67c"/>'))

    # yard props: olives in baskets, oil jars
    for a, b, k, sd, hp in ((-34, 10, 0.85, 7, 1.3), (-26, 16, 0.75, 8, 1.0), (-40, 17, 0.7, 9, 1.1)):
        lp.basket(c, a, b, k, fill=OLIVES, seed=sd, heap=hp)
    for a, b, k in ((16, 10, 0.62), (21, 13.5, 0.56), (14.5, 16.5, 0.6), (26, 9, 0.5)):
        iso.amphora(c, a, b, k=k, shaded=False)
    iso.pebbles(c, [(-14, 34, 1.2, 91), (34, 24, 1.1, 92), (46, -4, 1.3, 93)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
