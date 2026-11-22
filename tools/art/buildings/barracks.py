"""barracks - a small fort: a square crenellated stone wall around a sandy drill yard, a gate
between two taller gate piers, a tiled barrack hall at the back, and training gear in the yard
(straw dummy, archery target, spear rack).
Accent (owner colour): base rim band, the two flags on the gate piers, the gate cloth,
the faces of the hoplite shields on the walls."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_civic as lc  # noqa: E402
from iso import f, poly  # noqa: E402
from lib_civic import rect  # noqa: E402

Y = 41                 # half size of the walled square (outer face)
TH = 4.5               # wall thickness
YI = Y - TH            # inner face
WH = 10                # wall height
MH = 3.4               # merlon height
GATE = 8.5             # half width of the gate opening
PIER = (7, 21.5)       # gate pier width (along a) and height
HALL = (-10, -23)      # barrack hall position
HA, HB, HH, HR = 23, 10.5, 21, 7


def hall(c):
    tanp = HR / HB
    zr = HH + HR + 3.6
    c.add(f'<path d="{poly([c.P(HA, -HB, 0), c.P(HA + 13, -HB + 1, 0), c.P(HA + 13, HB + 2, 0), c.P(HA, HB + 1, 0)])}" fill="#5a4a2c" opacity="0.4" filter="{c.blur(1.4)}"/>')
    iso.contact_ao(c, -HA - 1, HA + 1, -HB - 1, HB + 1, opacity=0.35, width=3)
    iso.stone_course(c, HA + 1, HB + 1, 3.5, seed=9)
    iso.lime_wall_b(c, HB, -HA, HA, 3.5, HH, mottle=8)
    iso.lime_wall_a(c, HA, -HB, HB, 3.5, HH, gable=HR)
    iso.door_b(c, HB, 3, 11.5, 3.5, 17.5)
    iso.window_b(c, HB, -16, -8, 9.5, 16.5, shutters=False)
    c.add(c.on(c.m_aface(HA), '<circle cx="0" cy="18" r="2.6" fill="#9c9a94"/><circle cx="0.2" cy="17.8" r="1.8" fill="#2e2a26"/>'))
    iso.eave_shadow_b(c, HB, -HA, HA, HH, depth=6)
    iso.tile_roof_a(c, HA + 3, HB + 4, zr, tanp, T=3.6, n=9, courses=3)


def dummy(c, a, b):
    """Straw training dummy on a post, with a wooden sword arm and a hoplite shield (ACCENT)."""
    x, y = c.P(a, b, 0)
    B_ = lc.BURLAP
    W = iso.WOOD
    c.add(f'<ellipse cx="{f(x + 5)}" cy="{f(y + 0.6)}" rx="8" ry="2.4" fill="#5a4a2c" opacity="0.4" filter="{c.blur(0.9)}"/>'
          f'<path d="M{f(x - 4)},{f(y + 1.6)} L{f(x + 4)},{f(y - 1.6)} M{f(x - 4)},{f(y - 1.6)} L{f(x + 4)},{f(y + 1.6)}" stroke="{W["dark"]}" stroke-width="1.5" stroke-linecap="round"/>'
          + rect(x - 0.9, y - 21, 1.8, 21, W["base"]) + rect(x - 0.9, y - 21, 0.6, 21, W["lit"])
          + f'<path d="M{f(x - 7.5)},{f(y - 15.4)} L{f(x + 8)},{f(y - 16.6)}" stroke="{W["base"]}" stroke-width="1.5" stroke-linecap="round"/>'
          f'<path d="M{f(x + 7.6)},{f(y - 16.4)} L{f(x + 10.4)},{f(y - 25)}" stroke="#c9a06a" stroke-width="1.2" stroke-linecap="round"/>'
          f'<ellipse cx="{f(x)}" cy="{f(y - 12.4)}" rx="4" ry="5.6" fill="{B_["base"]}"/>'
          f'<ellipse cx="{f(x - 1)}" cy="{f(y - 13.2)}" rx="2.6" ry="4.4" fill="{B_["lit"]}"/>'
          f'<path d="M{f(x - 3.8)},{f(y - 11)} L{f(x + 3.8)},{f(y - 11.6)} M{f(x - 3.6)},{f(y - 14.6)} L{f(x + 3.6)},{f(y - 15.2)}" stroke="{B_["dark"]}" stroke-width="0.6"/>'
          f'<circle cx="{f(x)}" cy="{f(y - 21.4)}" r="2.9" fill="{B_["lit"]}"/>'
          f'<path d="M{f(x - 3.2)},{f(y - 21.6)} A3.2,3.3 0 0 1 {f(x + 3.2)},{f(y - 21.6)} L{f(x + 3.2)},{f(y - 20.6)} L{f(x - 3.2)},{f(y - 20.6)}Z" fill="{iso.BRONZE["base"]}"/>'
          f'<path d="M{f(x - 2.8)},{f(y - 22.2)} A3,3 0 0 1 {f(x)},{f(y - 24.7)}" fill="none" stroke="{iso.BRONZE["hi"]}" stroke-width="0.7"/>')
    lc.shield_screen(c, x - 6, y - 12.6, r=4.6, squash=0.82)


def target(c, a, b):
    """Round straw archery target on a tripod, facing +b."""
    W = iso.WOOD
    iso.blob_shadow(c, a + 4, b, 4.5, 0.3)
    legs = "".join(f'<path d="M{f(a + dx)},0 L{f(a)},11" stroke="{W["dark"]}" stroke-width="1.1" stroke-linecap="round"/>' for dx in (-4.5, 4.5))
    c.add(c.on(c.m_bface(b - 1), legs))
    c.add(c.on(c.m_bface(b), f'<ellipse cx="{f(a)}" cy="9.5" rx="6.4" ry="5.8" fill="#b8924e"/><ellipse cx="{f(a)}" cy="9.5" rx="5.6" ry="5.1" fill="#ecd590"/>'
               f'<ellipse cx="{f(a)}" cy="9.5" rx="3.9" ry="3.5" fill="none" stroke="#b23a30" stroke-width="1.3"/><ellipse cx="{f(a)}" cy="9.5" rx="1.3" ry="1.2" fill="#b23a30"/>'
               f'<path d="M{f(a + 1)},10.2 L{f(a + 7.5)},13.4" stroke="#6e4628" stroke-width="0.6"/><path d="M{f(a + 6.2)},13.6 L{f(a + 8.2)},13.2 L{f(a + 7.4)},12.2Z" fill="#f4ead2"/>'))


def spear_rack(c, a0, a1, b):
    """Wooden rack with spears standing in it and two shields leaning below."""
    W = iso.WOOD
    g = [rect(a0, 0, 1.3, 13, W["base"]), rect(a1 - 1.3, 0, 1.3, 13, W["base"]), rect(a0 - 1, 10.5, a1 - a0 + 2, 1.3, W["lit"]), rect(a0 - 1, 3.5, a1 - a0 + 2, 1.2, W["dark"])]
    n = 5
    for i in range(n):
        x = a0 + 2.6 + i * (a1 - a0 - 5.2) / (n - 1)
        top = 25 + (i * 7) % 3
        g.append(f'<path d="M{f(x)},0.5 L{f(x + 0.5)},{top}" stroke="#a8744a" stroke-width="0.85" stroke-linecap="round"/>'
                 f'<path d="M{f(x - 0.5)},{top - 0.3} L{f(x + 0.6)},{top + 4.4} L{f(x + 1.5)},{top - 0.3}Z" fill="#d9dbd8"/>')
    c.add(c.on(c.m_bface(b), "".join(g)))


def build():
    c = iso.Canvas("barracks")
    iso.base(c, seed=67, tufts=60, flowers=10, avoid=lambda a, b: (abs(a) < Y + 3 and abs(b) < Y + 3) or (abs(a) < 11 and b > 0))
    corners = [(sa * Y, sb * Y) for sa in (-1, 1) for sb in (-1, 1)]
    iso.cast_shadow(c, corners, [(a, b, WH + MH) for a, b in corners] + [(HALL[0] + HA, HALL[1] - HB, 30)], opacity=0.44)
    iso.contact_ao(c, -Y, Y, -Y, Y)
    # sandy road out of the gate, drill yard
    c.add(f'<g clip-path="{c.url("top")}">' + c.on(c.m_ground(0), rect(-GATE + 1, YI - 2, 2 * GATE - 2, 44, "#e0cd9c") + rect(-GATE + 1, YI - 2, 1.2, 44, "#c9b47e", 0.6)) + "</g>")
    sand = c.lin("sand", -YI, -YI, YI, YI, [(0, "#d9c491"), (0.5, "#e6d4a6"), (1, "#ecdcb2")])
    marks = "".join(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="#b89f66" opacity="0.28"/>' for x, y, rx, ry in ((6, 10, 9, 6), (-22, 16, 7, 5), (22, 24, 6, 4), (-4, 28, 8, 3), (20, -6, 5, 4)))
    c.add(c.on(c.m_ground(0), rect(-YI, -YI, 2 * YI, 2 * YI, sand) + marks
               + rect(-YI, -YI, 6.5, 2 * YI, "#5a4a2c", 0.3) + rect(-YI, -YI, 2 * YI, 2.2, "#5a4a2c", 0.3)))

    # back walls (we look at their inner faces)
    lc.wall_block(c, -Y, Y, -Y, -YI, 0, WH, seed=3)
    lc.merlons_a_run(c, -Y, Y, -Y, -YI, WH, 9, w=4.6, h=MH)
    lc.wall_block(c, -Y, -YI, -Y, Y, 0, WH, seed=7)
    lc.merlons_b_run(c, -Y, -YI, -Y, Y, WH, 9, w=4.6, h=MH)

    with c.at(*HALL):
        hall(c)
    spear_rack(c, 17.5, 33.5, -YI + 1.5)
    lc.shield_b(c, -YI + 3, 21.5, 4.6, r=3.7)
    lc.shield_b(c, -YI + 3.6, 29.5, 4.6, r=3.7)
    target(c, -24, 6)
    iso.brazier(c, 27, 4, 0, k=1.0)
    dummy(c, 2, 14)
    lc.crate(c, -30, 27, 3.4, 5)
    lc.sack(c, -24, 30, k=0.85)

    # right wall with shields on its outer face
    lc.wall_block(c, YI, Y, -Y, Y, 0, WH, seed=11)
    lc.merlons_b_run(c, YI, Y, -Y, Y, WH, 9, w=4.6, h=MH)
    for b in (-24, 0, 24):
        lc.shield_a(c, Y, b, 5.2, r=3.9)

    # front wall: two runs, the gate piers, the lintel
    pw, ph = PIER
    lc.wall_block(c, -Y, -GATE - pw + 1, YI, Y, 0, WH, seed=13)
    lc.merlons_a_run(c, -Y, -GATE - pw - 1, YI, Y, WH, 4, w=4.6, h=MH)
    for a in (-27, -37 + 0.0):
        lc.shield_b(c, Y, a + 2.6, 5.2, r=3.9)
    lc.wall_block(c, -GATE - pw, -GATE, YI - 1.5, Y + 2, 0, ph, seed=17)
    iso.box(c, -GATE - pw - 0.8, -GATE + 0.8, YI - 2.3, Y + 2.8, ph, ph + 1.6, lc.STONE["hi"], lc.STONE["lit"], lc.STONE["right"])
    lc.flag(c, -GATE - pw / 2, Y - 2, ph + 1.6, 19, w=15, h=9.5, wave=1.8, pole=1.2, emblem=False)
    # lintel beam and gate cloth
    W = iso.WOOD
    iso.box(c, -GATE, GATE, Y - 3, Y, ph - 4.5, ph - 1.2, "#c79763", W["lit"], W["dark"], edge="#e2b98a")
    iso.drape_b(c, Y, -GATE + 1.2, GATE - 1.2, ph - 4.5, 5.5)
    lc.wall_block(c, GATE, GATE + pw, YI - 1.5, Y + 2, 0, ph, seed=19)
    iso.box(c, GATE - 0.8, GATE + pw + 0.8, YI - 2.3, Y + 2.8, ph, ph + 1.6, lc.STONE["hi"], lc.STONE["lit"], lc.STONE["right"])
    lc.flag(c, GATE + pw / 2, Y - 2, ph + 1.6, 19, w=15, h=9.5, wave=1.8, pole=1.2, emblem=False)
    lc.wall_block(c, GATE + pw - 1, Y, YI, Y, 0, WH, seed=23)
    lc.merlons_a_run(c, GATE + pw + 1, Y, YI, Y, WH, 4, w=4.6, h=MH)
    for a in (22, 32):
        lc.shield_b(c, Y, a, 5.2, r=3.9)
    lc.shield_b(c, Y + 2, -GATE - pw / 2, 13.5, r=2.7)
    lc.shield_b(c, Y + 2, GATE + pw / 2, 13.5, r=2.7)

    iso.base_tufts(c, [((-Y, Y), (-GATE - pw, Y)), ((GATE + pw, Y), (Y, Y)), ((Y, Y), (Y, -Y))], n=18, seed=5, hmax=3.6)
    iso.rocks(c, [(-55, 12, 2.6, 31), (56, -6, 2.2, 32)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
