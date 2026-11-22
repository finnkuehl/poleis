"""bakery - a whitewashed flat-roofed bakehouse with a big domed clay oven glowing orange,
a wisp of smoke, golden loaves cooling on a table and sacks of grain by the door.
Accent (owner colour): base rim band, the awning over the door, the window shutters, a grain
sack and the blanket airing over the parapet."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402
import math  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_processing as lp  # noqa: E402
from iso import f  # noqa: E402

# bakehouse (placed with c.at(HOUSE)); world units, base radius 68
HOUSE = (-17, -19)
A, B = 25, 19          # half length (a) and half depth (b)
F = 4                  # stone foundation
H = 40                 # wall height incl. the parapet
# oven (placed with c.at(OVEN))
OVEN = (27, 8)
R_PLINTH, H_PLINTH = 19, 8
R_DOME = 17.5


def house(c):
    iso.cast_shadow(c, [(sa * A, sb * B) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * A, sb * B, H) for sa in (-1, 1) for sb in (-1, 1)])
    iso.contact_ao(c, -A - 1, A + 1, -B - 1, B + 1)
    iso.stone_course(c, A + 1, B + 1, F)
    iso.lime_wall_b(c, B, -A, A, F, H, seed=8)
    iso.lime_wall_a(c, A, -B, B, F, H)
    # flat roof terrace inside a low parapet
    c.add(c.on(c.m_ground(H), f'<rect x="{-A}" y="{-B}" width="{2 * A}" height="{2 * B}" fill="#fdf9ee"/>'
               f'<rect x="{-A + 3}" y="{-B + 3}" width="{2 * A - 6}" height="{2 * B - 6}" fill="#d9cfb8"/>'
               f'<rect x="{-A + 3}" y="{-B + 3}" width="{2 * A - 6}" height="3.2" fill="#8d8470" opacity="0.5"/>'
               f'<rect x="{-A + 3}" y="{-B + 3}" width="3.2" height="{2 * B - 6}" fill="#8d8470" opacity="0.4"/>'))
    c.add(c.on(c.m_bface(B), f'<rect x="{-A}" y="{H - 3.2}" width="{2 * A}" height="0.5" fill="#b9ae98" opacity="0.6"/>'
               f'<rect x="{-A}" y="{H - 0.6}" width="{2 * A}" height="0.6" fill="#fff"/>'))
    c.add(c.on(c.m_aface(A), f'<rect x="{-B}" y="{H - 3.2}" width="{2 * B}" height="0.5" fill="#77746c" opacity="0.5"/>'))
    # water spouts of terracotta poking out of the parapet
    for a in (-14, 12):
        c.add(c.on(c.m_bface(B), f'<rect x="{a}" y="{H - 6.4}" width="2.6" height="1.6" fill="#c05a3c"/><rect x="{a + 0.8}" y="{H - 14}" width="1.2" height="7.6" fill="#6d604a" opacity="0.14"/>'))
    iso.door_b(c, B, -18, -7, F, F + 23)
    iso.window_b(c, B, 9, 17, 20, 30)
    iso.window_a(c, A, 5, 13, 19, 28)
    # a blanket airing over the parapet, wheat sheaves drying on the roof
    iso.drape_a(c, A, -15, -5, H, 14)
    c.accent(c.on(c.m_ground(H), f'<rect x="{A - 3.4}" y="5" width="3.4" height="10" fill="{iso.ACCENT["light"]}"/>'))
    for i, (a, b) in enumerate(((-12, -8), (-5, -9), (2, -7), (-8, -2))):
        lp.sheaf(c, a, b, z=H, k=0.82, seed=i)
    # awning over the door
    iso.awning_b(c, -22, -3, B, F + 31, depth=8, drop=4, stripes=6)
    # baker's peel leaning on the wall
    x0, y0 = c.P(2.5, B + 3.5, 0)
    x1, y1 = c.P(2.5, B + 0.6, 30)
    c.add(f'<path d="M{f(x0)},{f(y0)} L{f(x1)},{f(y1)}" stroke="{iso.WOOD["base"]}" stroke-width="1.3" stroke-linecap="round"/>'
          f'<ellipse cx="{f(x1)}" cy="{f(y1 - 4)}" rx="3.4" ry="5" fill="#c9a26c"/><ellipse cx="{f(x1 - 0.7)}" cy="{f(y1 - 4.5)}" rx="2" ry="3.6" fill="#ecd3a2"/>')
    for a in (-21.5, -3.5):
        x, y = c.P(a, B + 7.6, 0)
        _, yt = c.P(a, B + 7.6, F + 27)
        c.add(f'<rect x="{f(x - 0.6)}" y="{f(yt)}" width="1.2" height="{f(y - yt)}" fill="{iso.WOOD["base"]}"/><rect x="{f(x - 0.6)}" y="{f(yt)}" width="0.45" height="{f(y - yt)}" fill="{iso.WOOD["lit"]}"/>')


def oven(c):
    C = lp.CLAY
    ring = [i * math.pi / 8 for i in range(16)]
    iso.cast_shadow(c, [(R_PLINTH * math.cos(t), R_PLINTH * math.sin(t)) for t in ring],
                    [(R_DOME * 0.9 * math.cos(t), R_DOME * 0.9 * math.sin(t), H_PLINTH + 8) for t in ring] + [(0, 0, H_PLINTH + R_DOME)], opacity=0.45)
    x, y = c.P(0, 0, 0)
    c.add(f'<ellipse cx="{f(x + 3)}" cy="{f(y + 1)}" rx="{f(R_PLINTH * 1.414 + 2)}" ry="{f(R_PLINTH * 0.707 + 1.5)}" fill="#24381a" opacity="0.4" filter="{c.blur(1.6)}"/>')
    # round stone plinth
    iso.cylinder(c, R_PLINTH, 0, H_PLINTH, [(0, "#ddd5c2"), (0.4, "#c9c0ac"), (0.75, "#9b968c"), (1, "#84817a")], top="#e6dfd0", name="plinth")
    xs, ys = c.P(0, 0, H_PLINTH)
    rxp = R_PLINTH * 1.414
    out = []
    for i in range(1, 14):
        t = math.pi * i / 14
        px, py = xs + rxp * math.cos(t), ys + rxp / 2 * math.sin(t)
        out.append(f'<rect x="{f(px - 0.25)}" y="{f(py)}" width="0.5" height="{f(H_PLINTH * iso.ZS)}" fill="#6a6258" opacity="0.5"/>')
    c.add("".join(out) + f'<path d="{iso.ring_front_arc(c, R_PLINTH, H_PLINTH, 0.4)}" fill="none" stroke="#fff" stroke-width="0.7" opacity="0.7"/>'
          f'<path d="{iso.ring_front_arc(c, R_PLINTH, H_PLINTH * 0.5)}" fill="none" stroke="#6a6258" stroke-width="0.5" opacity="0.5"/>')
    # short clay chimney at the back of the dome (drawn first, the dome hides its foot)
    rx = R_DOME * 1.414
    hd = rx * 0.9
    cxm, cym = xs + 4, ys - hd + 1
    # the dome
    dome = f"M{f(xs - rx)},{f(ys)} A{f(rx)},{f(hd)} 0 0 1 {f(xs + rx)},{f(ys)} A{f(rx)},{f(rx / 2)} 0 0 1 {f(xs - rx)},{f(ys)}Z"
    g = c.rad("dome", xs - rx * 0.4, ys - hd * 0.62, rx * 1.5, [(0, C["hi"]), (0.25, C["lit"]), (0.6, C["base"]), (0.85, C["shade"]), (1, C["dark"])])
    c.add(f'<ellipse cx="{f(xs + 1.5)}" cy="{f(ys + 1)}" rx="{f(rx + 1.5)}" ry="{f(rx / 2 + 1)}" fill="#4b4436" opacity="0.4" filter="{c.blur(0.8)}"/>')
    c.add(f'<rect x="{f(cxm - 3.4)}" y="{f(cym - 10)}" width="6.8" height="12" fill="{C["shade"]}"/><rect x="{f(cxm - 3.4)}" y="{f(cym - 10)}" width="2.6" height="12" fill="{C["lit"]}"/>'
          f'<ellipse cx="{f(cxm)}" cy="{f(cym - 10)}" rx="4.2" ry="1.8" fill="{C["base"]}"/><ellipse cx="{f(cxm)}" cy="{f(cym - 10)}" rx="2.8" ry="1.1" fill="#2a1a12"/>')
    c.add(f'<path d="{dome}" fill="{g}"/>')
    c.define("domeclip", f'<clipPath id="{c.id("domeclip")}"><path d="{dome}"/></clipPath>')
    lines = []
    for k in (0.3, 0.55, 0.78):
        lines.append(f'<ellipse cx="{f(xs)}" cy="{f(ys - hd * k * 0.92)}" rx="{f(rx * math.sqrt(1 - k * k))}" ry="{f(rx / 2 * math.sqrt(1 - k * k))}" fill="none" stroke="{C["dark"]}" stroke-width="0.6" opacity="0.28"/>')
    lines.append(f'<path d="M{f(xs - rx * 0.72)},{f(ys - hd * 0.3)} Q{f(xs - rx * 0.6)},{f(ys - hd * 0.82)} {f(xs - rx * 0.12)},{f(ys - hd * 0.93)}" fill="none" stroke="#fff3dc" stroke-width="1.6" stroke-linecap="round" opacity="0.5"/>')
    lines.append(f'<path d="M{f(xs - rx * 0.2)},{f(ys - hd * 0.5)} l3,5 l-2,6 M{f(xs + rx * 0.3)},{f(ys - hd * 0.7)} l-2,6 l3,4" fill="none" stroke="{C["dark"]}" stroke-width="0.5" opacity="0.35"/>')
    c.add(f'<g clip-path="{c.url("domeclip")}">{"".join(lines)}</g>')
    # mouth: a little arched porch facing the yard (+b), glowing
    bm = R_DOME - 1.5
    for d in (5, 3.4, 1.8):
        c.add(c.on(c.m_bface(bm - d), f'<path d="{lp.arch(-9.4, 9.4, H_PLINTH, H_PLINTH + 17.4)}" fill="{C["shade"] if d > 2 else C["base"]}"/>'))
    c.add(c.on(c.m_bface(bm - 0.9), f'<path d="{lp.arch(-9.4, 9.4, H_PLINTH, H_PLINTH + 17.4)}" fill="{C["lit"]}"/>'))
    lp.fire_mouth(c, c.m_bface(bm), -6.4, 6.4, H_PLINTH, H_PLINTH + 13.6, name="ovenfire", frame="#f1d2a8", frame_w=3)
    # soot above the mouth
    c.add(c.on(c.m_bface(bm), f'<path d="M-5,{H_PLINTH + 15} Q0,{H_PLINTH + 24} 5,{H_PLINTH + 15} Q0,{H_PLINTH + 18} -5,{H_PLINTH + 15}Z" fill="#3a2a22" opacity="0.4"/>'))
    return cxm, cym - 11


def build():
    c = iso.Canvas("bakery")
    ha, hb = HOUSE
    oa, ob = OVEN

    def avoid(a, b):
        return (ha - A - 3 < a < ha + A + 3 and hb - B - 3 < b < hb + B + 10) or (a - oa) ** 2 + (b - ob) ** 2 < (R_PLINTH + 3) ** 2
    iso.base(c, seed=52, avoid=avoid, tufts=80, flowers=14)
    iso.cypress(c, -52, 2, h=44, seed=12)
    with c.at(*HOUSE):
        house(c)
    iso.base_tufts(c, [((ha - A - 1, hb + B + 1), (ha - A + 5, hb + B + 1))], n=4, seed=8)
    iso.flagstones(c, [(-29, 14, 8, 6, 6), (-27, 24, 7, 6, -8), (-30, 33, 7, 5.6, 10), (-26, 42, 6, 5, 0)])
    # firewood for the oven, stacked against the house's right wall
    for a, z in ((43, 2.8), (49, 2.8), (46, 7.6)):
        lp.log_b(c, a, -22, -7, z, 2.8)

    with c.at(*OVEN):
        sx, sy = oven(c)
    lp.ground_glow(c, oa, ob + R_DOME + 9, 13, name="ovenglow", strength=0.6)
    lp.smoke(c, sx, sy, k=1.15, seed=4, n=6, drift=0.45, rise=8.5)

    # grain sacks by the door
    lp.sack(c, -44, 8, 1.0)
    lp.sack(c, -37.5, 5, 1.05)
    lp.sack(c, -40, 13, 1.1, accent=True)
    # table with fresh loaves in front
    zt = lp.table(c, -14, 8, 30, 41, 8)
    for i, (a, b) in enumerate(((-10, 33), (-4, 34.5), (2, 33), (-7, 38), (-0.5, 38.5), (5, 37.5))):
        x, y = c.P(a, b, zt)
        c.add(f'<ellipse cx="{f(x + 0.5)}" cy="{f(y + 0.3)}" rx="3.4" ry="1.5" fill="#3a2414" opacity="0.4"/>'
              f'<ellipse cx="{f(x)}" cy="{f(y - 1.6)}" rx="3.4" ry="2.4" fill="#c98a3a"/>'
              f'<ellipse cx="{f(x - 0.5)}" cy="{f(y - 2.2)}" rx="2.6" ry="1.6" fill="#eab65e"/>'
              f'<path d="M{f(x - 1.8)},{f(y - 2.6)} l1.4,-0.9 M{f(x - 0.4)},{f(y - 2)} l1.4,-0.9 M{f(x + 1)},{f(y - 1.5)} l1.2,-0.8" stroke="#fff0c0" stroke-width="0.5" stroke-linecap="round"/>')
    # a basket of loaves, an amphora
    lp.basket(c, 22, 44, 1.05, fill=("#d9a04a", "#eab65e", "#7a5226"), seed=5, heap=1.2)
    iso.amphora(c, -50, 22, k=0.8, shaded=False)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
