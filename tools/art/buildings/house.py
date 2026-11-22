"""house - a modest whitewashed Aegean house with a barrel-tile gable roof, standing directly on the
map (grounded, docs/ART.md) at the shared human scale (README "Scale": door 9 x 16): in front a
small courtyard behind a low whitewashed wall with a gate, a striped sun awning over the door and
the bench, geraniums in the window box, basil pots, amphorae and an olive tree in the corner.
Accent (owner colour): the painted door, the window shutters (front open, gable closed) and the
sun awning."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
from iso import WOOD, f  # noqa: E402

# geometry (world units; keep everything inside iso.GROUND_R = 58)
HOUSE = (2, -14)       # centre of the house body; the courtyard lies in front of it (+b)
A, B = 24, 16          # half length (a) and half depth (b) of the walls: a 48 x 32 body (README "Scale")
F = 4                  # stone foundation course height
H = 30                 # wall height (eave line): one tall storey
R = 10                 # roof rise (~32 deg, the back slope shows as a sliver)
T = 3.4                # tile layer thickness
AV, BV = A + 3, B + 4  # roof half extents incl. overhangs
TANP = R / B
ZR = H + R + T
DOOR = (5, 14)         # door (local x along the front wall): 9 wide, 16 high
AWN = (-8, 18, 24, 9, 4)   # sun awning over bench + door (local): a0, a1, height at the wall, depth, drop
YARD_B = 36            # world b of the courtyard's front wall
YARD_A = (-30, 30)     # world a of its side walls
GATE = (4, 14)         # world a range of the gate in the front wall
WALL_H, WALL_T = 7, 2.2     # courtyard wall height and thickness
LIME_TOP, LIME_L, LIME_R = "#fbf6ea", "#efe6d3", "#c9c3b5"


def bench(c, a0, a1, b0, b1, h=5.2):
    """Plank bench on two stone blocks against the front wall."""
    for a in (a0 + 1.2, a1 - 3):
        iso.contact_ao(c, a, a + 1.8, b0 + 0.5, b1 - 0.5, width=1.6, opacity=0.4)
        iso.box(c, a, a + 1.8, b0 + 0.5, b1 - 0.5, 0, h - 1, "#ddd5c3", "#cfc6b2", "#a39b8c")
    iso.box(c, a0, a1, b0, b1, h - 1, h, WOOD["lit"], WOOD["base"], WOOD["dark"], edge="#c99a6a")


def awning_poles(c):
    a0, a1, z, depth, drop = AWN
    for a in (a0 + 0.8, a1 - 0.8):
        x, y = c.P(a, B + depth - 0.4, 0)
        _, yt = c.P(a, B + depth - 0.4, z - drop)
        iso.blob_shadow(c, a + 1.5, B + depth, 1.4, 0.35)
        c.add(f'<ellipse cx="{f(x + 0.5)}" cy="{f(y + 0.2)}" rx="1.7" ry="0.7" fill="{iso.INK}" opacity="0.45" filter="{c.blur(0.45)}"/>')
        c.add(f'<rect x="{f(x - 0.85)}" y="{f(yt)}" width="1.7" height="{f(y - yt)}" fill="{WOOD["base"]}"/>'
              f'<rect x="{f(x - 0.85)}" y="{f(yt)}" width="0.6" height="{f(y - yt)}" fill="{WOOD["lit"]}"/>')


def wall_a(c, a0, a1, b, seed=0):
    """Low whitewashed courtyard wall running along a (front face lit), with a rounded coping."""
    b0, b1 = b - WALL_T / 2, b + WALL_T / 2
    iso.contact_ao(c, a0, a1, b0, b1, width=2.4, opacity=0.35)
    iso.box(c, a0, a1, b0, b1, 0, WALL_H, LIME_TOP, LIME_L, LIME_R, edge="#ffffff")
    ao = c.lin("yardao", 0, 0, 0, 1, [(0, "#6d604a", 0), (1, "#6d604a", 0.25)], bbox=True)
    c.add(c.on(c.m_bface(b1), f'<rect x="{f(a0)}" y="0" width="{f(a1 - a0)}" height="2.2" fill="{ao}"/>'))


def wall_b(c, a, b0, b1):
    """Low whitewashed courtyard wall running along b (its +a face in shade)."""
    a0, a1 = a - WALL_T / 2, a + WALL_T / 2
    iso.contact_ao(c, a0, a1, b0, b1, width=2.4, opacity=0.35)
    iso.box(c, a0, a1, b0, b1, 0, WALL_H, LIME_TOP, LIME_L, LIME_R, edge="#ffffff")


def gate_posts(c):
    """Two square gate piers, a little taller than the wall."""
    for a in (GATE[0] - 1.6, GATE[1] + 1.6):
        iso.box(c, a - 1.6, a + 1.6, YARD_B - 1.6, YARD_B + 1.6, 0, WALL_H + 2.2, LIME_TOP, LIME_L, LIME_R, edge="#ffffff")


def house_body(c):
    ze = ZR - BV * TANP
    iso.cast_shadow(c, [(sa * (A + 1), sb * (B + 1)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * AV, sb * BV, ze) for sa in (-1, 1) for sb in (-1, 1)] + [(sa * AV, 0, ZR + 2) for sa in (-1, 1)])
    iso.contact_ao(c, -A - 1.2, A + 1.2, -B - 1.2, B + 1.2)
    iso.stone_course(c, A + 1.2, B + 1.2, F)
    iso.lime_wall_b(c, B, -A, A, F, H, mottle=10)
    iso.lime_wall_a(c, A, -B, B, F, H, gable=R)
    # gable: closed shutters + round vent
    iso.window_a(c, A, -4.5, 4.5, 13, 21)
    c.add(c.on(c.m_aface(A), f'<circle cx="0" cy="{H + 5.5}" r="2.4" fill="#9c9a94"/><circle cx="0.15" cy="{H + 5.35}" r="1.7" fill="#2e2a26"/>'))
    # front: painted door, window with open shutters, eave shadow, awning shade on the wall
    iso.door_b(c, B, DOOR[0], DOOR[1], F, F + 16, accent=True)
    iso.window_b(c, B, -16, -8, 11, 19)
    iso.eave_shadow_b(c, B, -A, A, H, depth=7)
    a0, a1, za = AWN[0], AWN[1], AWN[2]
    c.add(c.on(c.m_bface(B), f'<rect x="{f(a0 + 1)}" y="{f(za - 7)}" width="{f(a1 - a0 + 1)}" height="7" fill="{iso.INK}" opacity="0.16" filter="{c.blur(0.8)}"/>'))
    iso.box(c, DOOR[0] - 1.5, DOOR[1] + 1.5, B, B + 3, 0, 1.5, "#ebe5d6", "#c9c0ad", "#a49c8c")
    # beam ends poking out of the gable under the rake
    for bb in (0, -9, 9):
        zz = H + R - abs(bb) * TANP - 2.4
        c.add(c.on(c.m_ground(zz + 2.2), f'<rect x="{A}" y="{f(bb - 1.2)}" width="2.8" height="2.4" fill="#9a6a40"/>'))
        c.add(c.on(c.m_bface(bb + 1.2), f'<rect x="{A}" y="{f(zz)}" width="2.8" height="2.2" fill="#6e4628"/>'))
        c.add(c.on(c.m_aface(A + 2.8), f'<rect x="{f(-bb - 1.2)}" y="{f(zz)}" width="2.4" height="2.2" fill="#4a2e19"/>'))
    iso.foot_tufts(c, [((-A - 1.2, B + 1.2), (-17, B + 1.2)), ((A + 1.2, B + 1.2), (A + 1.2, -B - 1.2))], n=10, seed=8, stones=3)
    iso.tile_roof_a(c, AV, BV, ZR, TANP, T=T, n=11, courses=4)


def build():
    c = iso.Canvas("house")
    iso.ground(c)
    ha, hb = HOUSE
    ya0, ya1 = YARD_A
    # grounding: wide soft AO under the house and its courtyard
    iso.ground_ao(c, [(ha - A - 2, hb - B - 2), (ha + A + 2, hb - B - 2), (ya1 + 2, YARD_B + 2), (ya0 - 2, YARD_B + 2)], grow=7, opacity=0.13)
    # the courtyard's left wall runs beside the house (drawn first: it lies behind the yard)
    wall_b(c, ya0, hb + B + 4, YARD_B - WALL_T / 2)
    iso.pebbles(c, [(ha + A + 6, hb - B + 3, 1.4, 41), (ha + A + 9, hb - B + 8, 1.0, 42)])
    with c.at(ha, hb):
        house_body(c)
        # under the awning: the bench, window box and a pot; then the awning on its two poles
        a0, a1, za, dep, drop = AWN
        c.add(f'<path d="{iso.poly([c.P(a0 + 5, B, 0), c.P(a1 + 7, B, 0), c.P(a1 + 7, B + dep - 1, 0), c.P(a0 + 5, B + dep - 1, 0)])}" fill="{iso.INK}" opacity="0.16" filter="{c.blur(1.2)}"/>')
        bench(c, -6, 3, B + 0.4, B + 3.8)
        iso.flowerbox_b(c, B, -17, -7, 6.5, 9.5, depth=2.6)
        iso.pot(c, DOOR[1] + 3.5, B + 4.5, k=0.6)
        awning_poles(c)
        iso.awning_b(c, a0, a1, B, za, depth=dep, drop=drop, stripes=6, two_tone=True)
    # the courtyard: an olive tree in the corner, amphorae and pots by the walls
    iso.olive_tree(c, -21, 25, size=0.85, seed=5)
    iso.amphora(c, 24, 12, k=0.6)
    iso.amphora(c, 26.5, 16.5, k=0.5)
    iso.pot(c, -24, 32, k=0.6)
    iso.pot(c, 20, 30, k=0.55)
    # right wall, then the front wall with its gate
    wall_b(c, ya1, hb + B + 4, YARD_B - WALL_T / 2)
    wall_a(c, ya0 - WALL_T / 2, GATE[0] - 3.2, YARD_B)
    wall_a(c, GATE[1] + 3.2, ya1 + WALL_T / 2, YARD_B)
    gate_posts(c)
    iso.foot_tufts(c, [((ya0, YARD_B + 1.2), (GATE[0] - 3, YARD_B + 1.2)), ((GATE[1] + 3, YARD_B + 1.2), (ya1, YARD_B + 1.2)), ((ya1 + 1.2, YARD_B), (ya1 + 1.2, hb + B + 4))],
                   n=12, seed=12, hmax=3.6, stones=3)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
