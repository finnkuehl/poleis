"""bakery - a whitewashed flat-roofed bakehouse standing directly on the map (grounded,
docs/ART.md) at the shared human scale, with a big domed clay oven beside it glowing orange and a
wisp of smoke: golden loaves cooling on a table under a striped awning, a baker's peel at the
wall, grain sacks by the door, sheaves drying on the roof terrace, a basket of loaves at the oven
and firewood. The game draws the trodden-earth yard underneath.
Accent (owner colour): the striped awning over the door and the bread table, the open window
shutters and a blanket airing over the parapet."""
import sys

sys.dont_write_bytecode = True
import math  # noqa: E402
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_processing as lp  # noqa: E402
from iso import ACCENT, WOOD, f  # noqa: E402

# world units; keep everything inside iso.GROUND_R = 58
HOUSE = (-14, -16)     # bakehouse centre
A, B = 25, 15          # half extents: a 50 x 30 body (README "Scale": medium)
F = 4                  # stone foundation
H = 27                 # wall height incl. the parapet (one storey)
DOOR = (-17, -8)       # local a range of the door (9 wide, 16 high)
WIN = (3, 10)          # local a range of the front window (7 wide, 8 high)
AWN = (-21, 13, 22.5, 9, 4)   # awning (local): a0, a1, height at the wall, depth, drop
OVEN = (27, 5)         # oven centre (world)
R_PLINTH, H_PLINTH = 12, 5
R_DOME = 11
UP = (-25, -5, -15, -4)  # upper room on the roof terrace (local a0, a1, b0, b1)
UP_H = 14                # its height above the terrace


def house(c):
    iso.cast_shadow(c, [(sa * (A + 1), sb * (B + 1)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * A, sb * B, H) for sa in (-1, 1) for sb in (-1, 1)], opacity=0.46)
    iso.contact_ao(c, -A - 1, A + 1, -B - 1, B + 1)
    iso.stone_course(c, A + 1, B + 1, F)
    iso.lime_wall_b(c, B, -A, A, F, H, seed=8, mottle=10)
    iso.lime_wall_a(c, A, -B, B, F, H)
    # flat roof terrace inside a low parapet
    c.add(c.on(c.m_ground(H), f'<rect x="{-A}" y="{-B}" width="{2 * A}" height="{2 * B}" fill="#fdf9ee"/>'
               f'<rect x="{-A + 2.2}" y="{-B + 2.2}" width="{2 * A - 4.4}" height="{2 * B - 4.4}" fill="#d9cfb8"/>'
               f'<rect x="{-A + 2.2}" y="{-B + 2.2}" width="{2 * A - 4.4}" height="2.4" fill="#8d8470" opacity="0.5"/>'
               f'<rect x="{-A + 2.2}" y="{-B + 2.2}" width="2.4" height="{2 * B - 4.4}" fill="#8d8470" opacity="0.4"/>'))
    c.add(c.on(c.m_bface(B), f'<rect x="{-A}" y="{H - 2.6}" width="{2 * A}" height="0.5" fill="#b9ae98" opacity="0.6"/>'
               f'<rect x="{-A}" y="{H - 0.6}" width="{2 * A}" height="0.6" fill="#fff"/>'))
    c.add(c.on(c.m_aface(A), f'<rect x="{-B}" y="{H - 2.6}" width="{2 * B}" height="0.5" fill="#77746c" opacity="0.5"/>'))
    # terracotta water spouts poking out of the parapet
    for a in (-22, 17):
        c.add(c.on(c.m_bface(B), f'<rect x="{a}" y="{H - 4.6}" width="2" height="1.2" fill="#c05a3c"/><rect x="{a + 0.6}" y="{H - 10}" width="0.9" height="5.4" fill="#6d604a" opacity="0.14"/>'))
    x0, x1 = DOOR
    iso.door_b(c, B, x0, x1, F, F + 16)
    iso.window_b(c, B, WIN[0], WIN[1], 13, 21)
    a0, a1, za, dep, drop = AWN
    # shade of the awning on the wall
    c.add(c.on(c.m_bface(B), f'<rect x="{f(a0 + 1)}" y="{f(za - 7)}" width="{f(a1 - a0)}" height="7" fill="{iso.INK}" opacity="0.14" filter="{c.blur(0.8)}"/>'))
    # small barred window on the side wall
    c.add(c.on(c.m_aface(A), f'<rect x="4" y="13" width="6" height="7" fill="#2e2a26"/><rect x="3.4" y="12" width="7.2" height="1.1" fill="#a7a49c"/>'
               f'<path d="M6,13 V20 M8,13 V20" stroke="{WOOD["dark"]}" stroke-width="0.6"/>'))
    # a blanket airing over the parapet on the side wall (owner colour)
    iso.drape_a(c, A, -10, -2, H, 11)
    c.accent(c.on(c.m_ground(H), f'<rect x="{A - 2.6}" y="2" width="2.6" height="8" fill="{ACCENT["light"]}"/>'))
    iso.foot_tufts(c, [((-A - 1, B + 1), (x0 - 2, B + 1)), ((A + 1, B + 1), (A + 1, -B - 1))], n=7, seed=8, kind="dry", stones=2)
    # a small upper room at the back of the roof terrace, with its own parapet
    ua0, ua1, ub0, ub1 = UP
    zt = H + UP_H
    c.add(c.on(c.m_ground(H + 0.1), f'<rect x="{ua0 - 1}" y="{ub0}" width="{ua1 - ua0 + 3.5}" height="{ub1 - ub0 + 3}" fill="#5d5240" opacity="0.3" filter="{c.blur(1)}"/>'))
    iso.lime_wall_b(c, ub1, ua0, ua1, H - 0.3, zt, seed=3, mottle=4)
    iso.lime_wall_a(c, ua1, ub0, ub1, H - 0.3, zt)
    c.add(c.on(c.m_ground(zt), f'<rect x="{ua0}" y="{ub0}" width="{ua1 - ua0}" height="{ub1 - ub0}" fill="#fdf9ee"/>'
               f'<rect x="{ua0 + 1.8}" y="{ub0 + 1.8}" width="{ua1 - ua0 - 3.6}" height="{ub1 - ub0 - 3.6}" fill="#d9cfb8"/>'
               f'<rect x="{ua0 + 1.8}" y="{ub0 + 1.8}" width="{ua1 - ua0 - 3.6}" height="1.6" fill="#8d8470" opacity="0.5"/>'))
    c.add(c.on(c.m_bface(ub1), f'<rect x="{ua0}" y="{zt - 0.6}" width="{ua1 - ua0}" height="0.6" fill="#fff"/>'))
    wx = ua0 + 8
    c.add(c.on(c.m_bface(ub1), f'<rect x="{wx - 0.9}" y="{H + 3.6}" width="7.8" height="8.2" fill="#ebe3d2"/><rect x="{wx}" y="{H + 4.4}" width="6" height="6.6" fill="#2e3742"/>'
               f'<rect x="{wx + 2.7}" y="{H + 4.4}" width="0.6" height="6.6" fill="{WOOD["dark"]}"/><rect x="{wx}" y="{H + 4.4}" width="1.4" height="6.6" fill="#b9af9c"/>'
               f'<rect x="{wx - 1.6}" y="{H + 2.6}" width="9.2" height="1.2" fill="#d5ccb9"/>'))
    c.add(c.on(c.m_aface(ua1), f'<rect x="{-ub1 + 3.5}" y="{H + 5}" width="4" height="5.5" fill="#2e2a26"/><rect x="{-ub1 + 3}" y="{H + 4}" width="5" height="1" fill="#a7a49c"/>'))
    # wheat sheaves and a flour sack on the terrace in front of it
    for i, (a, b) in enumerate(((-2, -6), (3, -8), (8, -5.5), (2.5, -2))):
        lp.sheaf(c, a, b, z=H - 0.4, k=0.62, seed=i)
    lp.sack(c, 15, -6, 0.5, z=H - 0.4)
    # baker's peel leaning on the wall between door and window
    px0, py0 = c.P(-2.5, B + 2.6, 0)
    px1, py1 = c.P(-2.5, B + 0.5, 19)
    c.add(f'<path d="M{f(px0)},{f(py0)} L{f(px1)},{f(py1)}" stroke="{WOOD["base"]}" stroke-width="1" stroke-linecap="round"/>'
          f'<ellipse cx="{f(px1)}" cy="{f(py1 - 3)}" rx="2.4" ry="3.6" fill="#c9a26c"/><ellipse cx="{f(px1 - 0.5)}" cy="{f(py1 - 3.4)}" rx="1.4" ry="2.6" fill="#ecd3a2"/>')
    # the bread table under the awning, with fresh loaves
    zt = lp.table(c, -1, 13, B + 2.5, B + 8, 7, th=1.1)
    for i, (a, b) in enumerate(((1.5, B + 4), (5.5, B + 4.2), (9.5, B + 3.9), (3.5, B + 6.6), (7.5, B + 6.8), (11.2, B + 6.4))):
        x, y = c.P(a, b, zt)
        c.add(f'<ellipse cx="{f(x + 0.4)}" cy="{f(y + 0.2)}" rx="2.3" ry="1" fill="#3a2414" opacity="0.4"/>'
              f'<ellipse cx="{f(x)}" cy="{f(y - 1.1)}" rx="2.3" ry="1.6" fill="#c98a3a"/>'
              f'<ellipse cx="{f(x - 0.4)}" cy="{f(y - 1.5)}" rx="1.7" ry="1.05" fill="#eab65e"/>'
              f'<path d="M{f(x - 1.2)},{f(y - 1.8)} l0.9,-0.6 M{f(x - 0.2)},{f(y - 1.4)} l0.9,-0.6" stroke="#fff0c0" stroke-width="0.4" stroke-linecap="round"/>')
    # the awning on two poles over the door and the table
    for a in (a0 + 0.8, a1 - 0.8):
        x, y = c.P(a, B + dep - 0.4, 0)
        _, yt = c.P(a, B + dep - 0.4, za - drop)
        iso.blob_shadow(c, a + 1.2, B + dep, 1.4, 0.35)
        c.add(f'<rect x="{f(x - 0.7)}" y="{f(yt)}" width="1.4" height="{f(y - yt)}" fill="{WOOD["base"]}"/>'
              f'<rect x="{f(x - 0.7)}" y="{f(yt)}" width="0.5" height="{f(y - yt)}" fill="{WOOD["lit"]}"/>')
    iso.awning_b(c, a0, a1, B, za, depth=dep, drop=drop, stripes=8, two_tone=True)


def oven(c):
    """Domed clay oven on a round stone plinth, its arched mouth glowing toward the yard (+b).
    Returns the screen point of the chimney top."""
    C = lp.CLAY
    ring = [i * math.pi / 8 for i in range(16)]
    iso.cast_shadow(c, [(R_PLINTH * math.cos(t), R_PLINTH * math.sin(t)) for t in ring],
                    [(R_DOME * 0.9 * math.cos(t), R_DOME * 0.9 * math.sin(t), H_PLINTH + 5) for t in ring] + [(0, 0, H_PLINTH + R_DOME)], opacity=0.45)
    x, y = c.P(0, 0, 0)
    c.add(f'<ellipse cx="{f(x + 2)}" cy="{f(y + 0.8)}" rx="{f(R_PLINTH * 1.414 + 1.5)}" ry="{f(R_PLINTH * 0.707 + 1)}" fill="#24381a" opacity="0.4" filter="{c.blur(1.4)}"/>')
    # round fieldstone plinth
    iso.cylinder(c, R_PLINTH, 0, H_PLINTH, [(0, "#ddd5c2"), (0.4, "#c9c0ac"), (0.75, "#9b968c"), (1, "#84817a")], top="#e6dfd0", name="plinth")
    xs, ys = c.P(0, 0, H_PLINTH)
    rxp = R_PLINTH * 1.414
    out = []
    for i in range(1, 12):
        t = math.pi * i / 12
        px, py = xs + rxp * math.cos(t), ys + rxp / 2 * math.sin(t)
        out.append(f'<rect x="{f(px - 0.2)}" y="{f(py + (0 if i % 2 else 2.6))}" width="0.4" height="{f(H_PLINTH * iso.ZS * 0.5)}" fill="#6a6258" opacity="0.5"/>')
    c.add("".join(out) + f'<path d="{iso.ring_front_arc(c, R_PLINTH, H_PLINTH, 0.4)}" fill="none" stroke="#fff" stroke-width="0.6" opacity="0.7"/>'
          f'<path d="{iso.ring_front_arc(c, R_PLINTH, H_PLINTH * 0.5)}" fill="none" stroke="#6a6258" stroke-width="0.45" opacity="0.5"/>')
    rx = R_DOME * 1.414
    hd = rx * 0.9
    cxm, cym = xs + 3, ys - hd + 1
    dome = f"M{f(xs - rx)},{f(ys)} A{f(rx)},{f(hd)} 0 0 1 {f(xs + rx)},{f(ys)} A{f(rx)},{f(rx / 2)} 0 0 1 {f(xs - rx)},{f(ys)}Z"
    g = c.rad("dome", xs - rx * 0.4, ys - hd * 0.62, rx * 1.5, [(0, C["hi"]), (0.25, C["lit"]), (0.6, C["base"]), (0.85, C["shade"]), (1, C["dark"])])
    c.add(f'<ellipse cx="{f(xs + 1.2)}" cy="{f(ys + 0.8)}" rx="{f(rx + 1.2)}" ry="{f(rx / 2 + 0.8)}" fill="#4b4436" opacity="0.4" filter="{c.blur(0.8)}"/>')
    # short clay chimney at the back of the dome (the dome hides its foot)
    c.add(f'<rect x="{f(cxm - 2.4)}" y="{f(cym - 7)}" width="4.8" height="8.5" fill="{C["shade"]}"/><rect x="{f(cxm - 2.4)}" y="{f(cym - 7)}" width="1.8" height="8.5" fill="{C["lit"]}"/>'
          f'<ellipse cx="{f(cxm)}" cy="{f(cym - 7)}" rx="3" ry="1.3" fill="{C["base"]}"/><ellipse cx="{f(cxm)}" cy="{f(cym - 7)}" rx="2" ry="0.8" fill="#2a1a12"/>')
    c.add(f'<path d="{dome}" fill="{g}"/>')
    c.define("domeclip", f'<clipPath id="{c.id("domeclip")}"><path d="{dome}"/></clipPath>')
    lines = []
    for k in (0.3, 0.55, 0.78):
        lines.append(f'<ellipse cx="{f(xs)}" cy="{f(ys - hd * k * 0.92)}" rx="{f(rx * math.sqrt(1 - k * k))}" ry="{f(rx / 2 * math.sqrt(1 - k * k))}" fill="none" stroke="{C["dark"]}" stroke-width="0.5" opacity="0.28"/>')
    lines.append(f'<path d="M{f(xs - rx * 0.72)},{f(ys - hd * 0.3)} Q{f(xs - rx * 0.6)},{f(ys - hd * 0.82)} {f(xs - rx * 0.12)},{f(ys - hd * 0.93)}" fill="none" stroke="#fff3dc" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>')
    lines.append(f'<path d="M{f(xs - rx * 0.2)},{f(ys - hd * 0.5)} l2,3.4 l-1.4,4 M{f(xs + rx * 0.3)},{f(ys - hd * 0.7)} l-1.4,4 l2,3" fill="none" stroke="{C["dark"]}" stroke-width="0.4" opacity="0.35"/>')
    c.add(f'<g clip-path="{c.url("domeclip")}">{"".join(lines)}</g>')
    # mouth: a little arched porch facing the yard (+b), glowing
    bm = R_DOME - 1
    for d in (3.4, 2.3, 1.2):
        c.add(c.on(c.m_bface(bm - d), f'<path d="{lp.arch(-5.6, 5.6, H_PLINTH, H_PLINTH + 10)}" fill="{C["shade"] if d > 1.5 else C["base"]}"/>'))
    c.add(c.on(c.m_bface(bm - 0.6), f'<path d="{lp.arch(-5.6, 5.6, H_PLINTH, H_PLINTH + 10)}" fill="{C["lit"]}"/>'))
    lp.fire_mouth(c, c.m_bface(bm), -3.8, 3.8, H_PLINTH, H_PLINTH + 7.6, name="ovenfire", frame="#f1d2a8", frame_w=1.8)
    c.add(c.on(c.m_bface(bm), f'<path d="M-3.4,{H_PLINTH + 8.6} Q0,{H_PLINTH + 14} 3.4,{H_PLINTH + 8.6} Q0,{H_PLINTH + 10.6} -3.4,{H_PLINTH + 8.6}Z" fill="#3a2a22" opacity="0.4"/>'))
    return cxm, cym - 8


def firewood(c, a0, b0, b1):
    """Short stack of split firewood along b, end grain toward the yard."""
    iso.cast_shadow(c, [(a0 - 2, b0), (a0 + 9, b0), (a0 + 9, b1), (a0 - 2, b1)], [(a0, b0, 7), (a0 + 8, b0, 5), (a0, b1, 7), (a0 + 8, b1, 5)], opacity=0.35, sd=1.2)
    for a, z in ((a0, 1.9), (a0 + 3.8, 1.9), (a0 + 7.6, 1.9), (a0 + 1.9, 5.3), (a0 + 5.7, 5.3), (a0 + 3.8, 8.7)):
        lp.log_b(c, a, b0, b1, z, 1.9)


def build():
    c = iso.Canvas("bakery")
    iso.ground(c)
    ha, hb = HOUSE
    oa, ob = OVEN
    iso.ground_ao(c, [(ha - A - 2, hb - B - 2), (ha + A + 2, hb - B - 2), (oa + R_PLINTH + 3, ob - 6), (oa + 6, ob + R_PLINTH + 4), (-6, 30), (ha - A - 2, 12)], grow=6, opacity=0.13)

    firewood(c, 39, -14, -2)
    with c.at(*HOUSE):
        house(c)
    with c.at(*OVEN):
        sx, sy = oven(c)
    lp.ground_glow(c, oa, ob + R_DOME + 4, 8, name="ovenglow", strength=0.6)
    lp.smoke(c, sx, sy, k=0.85, seed=4, n=5, drift=0.45, rise=7)

    # grain sacks by the door, an amphora of water
    for a, b, k in ((-40, 3, 0.55), (-35.5, 1.5, 0.6), (-37.5, 6.5, 0.62)):
        lp.sack(c, a, b, k)
    iso.amphora(c, -46, 10, k=0.6, shaded=False)
    # a basket of loaves by the oven mouth
    lp.basket(c, 18, 26, 0.75, fill=("#d9a04a", "#eab65e", "#7a5226"), seed=5, heap=1.2)
    iso.pebbles(c, [(-24, 40, 1.2, 71), (40, 28, 1.3, 72), (6, 46, 1.0, 73)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
