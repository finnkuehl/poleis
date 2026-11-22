"""oilPress - a lever press in a yard with a low wall: a long timber beam anchored in a stone pier
squeezes a stack of olive mats on a round stone bed, pulled down by a hanging weight stone;
golden oil runs into a round basin, with amphorae and a basket of olives around it.
Accent (owner colour): base rim band, the drape on the stone pier, the banner and the cloth
bound around the lever beam."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402
import math  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_processing as lp  # noqa: E402
from iso import ACCENT, WOOD, f  # noqa: E402

WALL_B = -30           # back wall (runs along a)
WALL_H = 13
PIER = (-44, -4)       # stone pier that anchors the beam (centre a, b)
BEAM_B = -4            # the beam runs along a at this b
BEAM_Z0, BEAM_Z1 = 35, 42.5
BED = (-14, -4)        # press bed centre
BED_R, BED_H = 16.5, 7
BASIN = (-12, 28)      # collecting basin centre
WEIGHT_A = 40          # where the weight stone hangs

OIL = {"hi": "#fff2a8", "lit": "#f6d04e", "base": "#e0a92c", "shade": "#a8741a"}


def mats(c):
    """Stack of woven press mats (frails) full of olive paste, with the press board on top."""
    z = BED_H
    for i in range(5):
        col = [(0, "#e8cf92"), (0.4, "#cfae6a"), (0.8, "#96743c"), (1, "#7a5c2c")]
        iso.cylinder(c, 11.6 - 0.25 * i, z, z + 2.6, col, top="#d9bd7c", name="mat")
        c.add(f'<path d="{iso.ring_front_arc(c, 11.6 - 0.25 * i, z + 0.3)}" fill="none" stroke="#4a4a1e" stroke-width="1.1" opacity="0.75"/>')
        z += 2.9
    # dark paste oozing, golden drops
    x, y = c.P(0, 0, BED_H)
    c.add(f'<path d="{iso.ring_front_arc(c, 12.6, BED_H + 0.2)}" fill="none" stroke="{OIL["lit"]}" stroke-width="1.6" opacity="0.9"/>')
    lp.timber(c, -10, 10, -10, 10, z, z + 2.8)
    return z + 2.8


def build():
    c = iso.Canvas("oilPress")

    def avoid(a, b):
        return (b < WALL_B + 8 and -52 < a < 46) or (-52 < a < 48 and -16 < b < 8) or (a - BASIN[0]) ** 2 + (b - BASIN[1]) ** 2 < 230
    iso.base(c, seed=67, avoid=avoid, tufts=80, flowers=14)

    # olive trees behind the yard wall
    iso.olive_tree(c, 12, -52, size=0.95, seed=4)
    iso.olive_tree(c, -30, -52, size=0.7, seed=9)

    # trodden yard floor
    yard = c.lin("yard", -50, 0, 50, 0, [(0, "#e3d1a2"), (1, "#c9b282")])
    c.add(f'<g clip-path="{c.url("top")}">' + c.on(c.m_ground(0.2), f'<rect x="-48" y="{WALL_B + 6}" width="94" height="46" rx="10" fill="{yard}" opacity="0.9"/>') + "</g>")

    # back wall with a terracotta coping
    iso.cast_shadow(c, [(-46, WALL_B), (44, WALL_B), (44, WALL_B + 6), (-46, WALL_B + 6)],
                    [(-46, WALL_B, WALL_H), (44, WALL_B, WALL_H), (44, WALL_B + 6, WALL_H), (-46, WALL_B + 6, WALL_H)], opacity=0.4)
    iso.contact_ao(c, -46, 44, WALL_B, WALL_B + 6, opacity=0.4)
    lp.stone_box(c, -46, 44, WALL_B, WALL_B + 6, 0, WALL_H, seed=5)
    iso.box(c, -47, 45, WALL_B - 1, WALL_B + 7, WALL_H, WALL_H + 1.8, "#f1ebdc", "#d6cdb9", "#99958c", edge="#fff")
    # amphorae leaning against the wall
    for a in (2, 9, 31):
        iso.amphora(c, a, WALL_B + 10, k=0.95, shaded=False)

    iso.banner_b(c, 54, -21, 0, height=38, width=8, drop=16)

    # stone pier anchoring the beam
    pa, pb = PIER
    iso.cast_shadow(c, [(pa - 7, pb - 8), (pa + 7, pb - 8), (pa + 7, pb + 8), (pa - 7, pb + 8)],
                    [(pa - 7, pb - 8, 53), (pa + 7, pb - 8, 53), (pa + 7, pb + 8, 53), (pa - 7, pb + 8, 53)], opacity=0.42)
    iso.contact_ao(c, pa - 7, pa + 7, pb - 8, pb + 8, opacity=0.4)
    lp.stone_box(c, pa - 7, pa + 7, pb - 8, pb + 8, 0, 53, seed=11, row=5)
    iso.box(c, pa - 8, pa + 8, pb - 9, pb + 9, 53, 55.6, "#f1ebdc", "#d6cdb9", "#99958c", edge="#fff")
    iso.drape_b(c, pb + 8, pa - 5, pa + 5, 47, 23)
    # slot in the pier where the beam sits
    c.add(c.on(c.m_aface(pa + 7), f'<rect x="{f(-BEAM_B - 5.6)}" y="{BEAM_Z0 - 2.5}" width="11.2" height="{BEAM_Z1 - BEAM_Z0 + 5}" fill="#3a332a"/>'))

    # press bed: round stone with a rim groove and a spout toward the basin
    with c.at(*BED):
        ring = [i * math.pi / 8 for i in range(16)]
        iso.cast_shadow(c, [(BED_R * math.cos(t), BED_R * math.sin(t)) for t in ring], [(12 * math.cos(t), 12 * math.sin(t), 24) for t in ring], opacity=0.4)
        x, y = c.P(0, 0, 0)
        c.add(f'<ellipse cx="{f(x + 2.5)}" cy="{f(y + 1)}" rx="{f(BED_R * 1.414 + 2)}" ry="{f(BED_R * 0.707 + 1.4)}" fill="#3a3220" opacity="0.4" filter="{c.blur(1.4)}"/>')
        iso.cylinder(c, BED_R, 0, BED_H, [(0, "#e2dccd"), (0.4, "#cfc6b2"), (0.75, "#9f9a90"), (1, "#87847c")], top="#ece6d8", name="bed")
        xt, yt = c.P(0, 0, BED_H)
        c.add(f'<ellipse cx="{f(xt)}" cy="{f(yt)}" rx="{f(14.2 * 1.414)}" ry="{f(14.2 * 0.707)}" fill="none" stroke="{OIL["base"]}" stroke-width="2"/>'
              f'<ellipse cx="{f(xt)}" cy="{f(yt)}" rx="{f(14.2 * 1.414)}" ry="{f(14.2 * 0.707)}" fill="none" stroke="{OIL["hi"]}" stroke-width="0.6" opacity="0.8"/>'
              f'<path d="{iso.ring_front_arc(c, BED_R, BED_H, 0.4)}" fill="none" stroke="#fff" stroke-width="0.7" opacity="0.7"/>')
        top = mats(c)
        lp.post(c, 0, 0, top, BEAM_Z0, 2.6)

    # spout and the stream of oil into the basin
    bx, bb = BASIN
    lp.timber(c, bx - 1.6, bx + 1.6, BED[1] + BED_R - 1, bb - 7, BED_H - 2.6, BED_H - 0.8, pal={"lit": OIL["lit"], "base": "#b9b09c", "dark": "#8d887e"}, edge="#fff")
    x0, y0 = c.P(bx, bb - 7, BED_H - 1)
    x1, y1 = c.P(bx, bb - 5, 3)
    c.add(f'<path d="M{f(x0)},{f(y0)} Q{f(x0 - 1.5)},{f(y0 + 3)} {f(x1)},{f(y1)}" fill="none" stroke="{OIL["lit"]}" stroke-width="1.5" stroke-linecap="round"/>'
          f'<path d="M{f(x0)},{f(y0)} Q{f(x0 - 1.5)},{f(y0 + 3)} {f(x1)},{f(y1)}" fill="none" stroke="{OIL["hi"]}" stroke-width="0.5" stroke-linecap="round"/>')
    with c.at(bx, bb):
        x, y = c.P(0, 0, 0)
        c.add(f'<ellipse cx="{f(x + 2)}" cy="{f(y + 1)}" rx="18.5" ry="9" fill="#3a3220" opacity="0.4" filter="{c.blur(1.2)}"/>')
        iso.cylinder(c, 11.5, 0, 3.4, [(0, "#e2dccd"), (0.4, "#cfc6b2"), (0.75, "#9f9a90"), (1, "#87847c")], top="#ece6d8", name="basin")
        xt, yt = c.P(0, 0, 3.4)
        oil = c.rad("oil", xt - 5, yt - 2, 16, [(0, OIL["hi"]), (0.35, OIL["lit"]), (0.8, OIL["base"]), (1, OIL["shade"])])
        c.add(f'<ellipse cx="{f(xt)}" cy="{f(yt + 0.5)}" rx="{f(9.6 * 1.414)}" ry="{f(9.6 * 0.707)}" fill="#8d887e"/>'
              f'<ellipse cx="{f(xt)}" cy="{f(yt + 1.1)}" rx="{f(9.1 * 1.414)}" ry="{f(8.9 * 0.707)}" fill="{oil}"/>'
              f'<path d="M{f(xt - 9)},{f(yt)} Q{f(xt - 4)},{f(yt - 3.8)} {f(xt + 3)},{f(yt - 3.2)}" fill="none" stroke="#fffbe0" stroke-width="1" stroke-linecap="round" opacity="0.85"/>'
              f'<ellipse cx="{f(x1)}" cy="{f(y1 + 0.6)}" rx="2.6" ry="1.2" fill="none" stroke="#fffbe0" stroke-width="0.5" opacity="0.8"/>')

    # the lever beam
    b0, b1 = BEAM_B - 4, BEAM_B + 4
    lp.timber(c, pa + 7, 50, b0, b1, BEAM_Z0, BEAM_Z1)
    c.add(c.on(c.m_bface(b1), "".join(f'<rect x="{f(-34 + i * 17)}" y="{BEAM_Z0 + 1.6 + (i % 2) * 1.6}" width="11" height="0.4" fill="{WOOD["dark"]}" opacity="0.5"/>' for i in range(5))))
    # iron bands, and an owner-coloured cloth bound round the beam's end
    for a in (-30, 6):
        c.add(c.on(c.m_bface(b1), f'<rect x="{a}" y="{BEAM_Z0}" width="1.8" height="{BEAM_Z1 - BEAM_Z0}" fill="#4a4640"/>') + c.on(c.m_ground(BEAM_Z1), f'<rect x="{a}" y="{b0}" width="1.8" height="8" fill="#6a665e"/>'))
    c.accent(c.on(c.m_bface(b1 + 0.2), f'<rect x="19" y="{BEAM_Z0 - 0.4}" width="9" height="{BEAM_Z1 - BEAM_Z0 + 0.8}" fill="{ACCENT["light"]}"/>'
                  f'<path d="M21,{BEAM_Z0} L26.5,{BEAM_Z0} L27.5,{BEAM_Z0 - 9} L24.4,{BEAM_Z0 - 6.5} L21.6,{BEAM_Z0 - 10}Z" fill="{ACCENT["mid"]}"/>')
             + c.on(c.m_ground(BEAM_Z1 + 0.2), f'<rect x="19" y="{b0}" width="9" height="8.2" fill="{ACCENT["lit"]}"/>'))
    c.add(c.on(c.m_bface(b1 + 0.2), f'<rect x="19" y="{BEAM_Z0 - 0.4}" width="9" height="0.7" fill="{iso.GOLD["lit"]}"/><rect x="23" y="{BEAM_Z0 - 0.4}" width="0.6" height="{BEAM_Z1 - BEAM_Z0 + 0.8}" fill="#1d2b36" opacity="0.2"/>'))

    # weight stone hanging from the beam's end on ropes
    wa = WEIGHT_A
    iso.blob_shadow(c, wa + 5, BEAM_B, 9, 0.42)
    lp.stone_box(c, wa - 6.5, wa + 6.5, BEAM_B - 6.5, BEAM_B + 6.5, 4, 17, seed=31, row=6.5, ao=False, pal=lp.SOOT)
    c.add(c.on(c.m_bface(BEAM_B + 6.5), f'<circle cx="{wa}" cy="13.5" r="1.6" fill="#3a332a"/>'))
    for a in (wa - 3.4, wa + 3.4):
        x0, y0 = c.P(a, b1, BEAM_Z0)
        x1, y1 = c.P(a, BEAM_B + 6.5, 17)
        c.add(f'<path d="M{f(x0)},{f(y0)} L{f(x1)},{f(y1)}" stroke="#8a6a40" stroke-width="1.2"/><path d="M{f(x0 - 0.4)},{f(y0)} L{f(x1 - 0.4)},{f(y1)}" stroke="#e2c690" stroke-width="0.45"/>')
        c.add(c.on(c.m_bface(b1), f'<rect x="{f(a - 0.7)}" y="{BEAM_Z0}" width="1.4" height="{BEAM_Z1 - BEAM_Z0}" fill="#b08a55"/>') + c.on(c.m_ground(BEAM_Z1), f'<rect x="{f(a - 0.7)}" y="{b0}" width="1.4" height="8" fill="#d9b67c"/>'))

    # yard props: olives, oil jars
    lp.basket(c, -42, 20, 1.3, seed=7, heap=1.3)
    lp.basket(c, -36, 33, 1.05, seed=8, heap=1.0)
    iso.amphora(c, 16, 28, k=1.05, shaded=False)
    iso.amphora(c, 24, 35, k=0.9, shaded=False)
    iso.amphora(c, 12, 40, k=0.85, shaded=False)
    iso.rocks(c, [(-52, 30, 2.4, 3), (34, 44, 2, 5)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
