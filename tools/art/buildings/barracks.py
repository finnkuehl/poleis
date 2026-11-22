"""barracks - the corner of a small fort, standing directly on the map (grounded, docs/ART.md; the
game paints a trodden-earth drill yard around it): a long whitewashed barrack hall under a
barrel-tile roof with hoplite shields hung along its front, a square crenellated watch tower at
the corner, a crenellated wall closing the yard on the left and ending in a gate turret, and the
drill yard in front (two hoplites at drill, a straw dummy, an archery target against the wall, a
spear rack, a brazier).
Accent (owner colour): the flag on the tower, the banner on the gate turret, the faces of the
shields (on the hall, the dummy and the two hoplites) and the hoplites' crests."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_civic as lc  # noqa: E402
import units_lib as U  # noqa: E402
from iso import WOOD, f  # noqa: E402
from lib_civic import STONE, rect  # noqa: E402

# world units; keep everything inside iso.GROUND_R = 58. Human scale: door 16 x 9, person ~14.
HALL = (12, -22)       # hall centre (its roof overhang just touches the tower)
A, B = 31, 11          # hall half extents (62 long, 22 deep)
F = 4                  # stone footing
H = 26                 # wall height (one tall storey above the footing)
R = 8.5                # roof rise
T = 3.6
AV, BV = A + 3, B + 4
TANP = R / B
ZR = H + R + T
TOWER = (-38, -20, -38, -20)   # a0, a1, b0, b1 (18 x 18)
TH = 46                        # tower top (parapet walk)
MH = 4.2                       # merlon height
WALL = (-40, -35.5, -20, 21)   # left yard wall a0, a1, b0, b1
WH = 12                        # wall height (merlons on top)
TURRET = (-42, -33, 20, 29)    # gate turret at the front end of the wall
TUH = 24


def merlon_top(c, a0, a1, b0, b1, z, n_a, n_b, part, w=3.6, h=MH, k=1.4):
    """Merlons around a square parapet top: part "back" (-b and -a sides) or "front" (+b, +a)."""
    if part == "back":
        lc.merlons_a_run(c, a0, a1, b0, b0 + k * 1.9, z, n_a, w=w, h=h)
        lc.merlons_b_run(c, a0, a0 + k * 1.9, b0, b1, z, n_b, w=w, h=h)
    else:
        lc.merlons_a_run(c, a0, a1, b1 - k * 1.9, b1, z, n_a, w=w, h=h)
        lc.merlons_b_run(c, a1 - k * 1.9, a1, b0, b1, z, n_b, w=w, h=h)


def slit_b(c, b, a, z):
    c.add(c.on(c.m_bface(b), rect(a - 1.6, z - 1, 3.2, 8.5, "#efe8d8") + rect(a - 0.7, z, 1.4, 6.5, "#1c1611")))


def slit_a(c, a, b, z):
    c.add(c.on(c.m_aface(a), rect(-b - 1.6, z - 1, 3.2, 8.5, "#b3ab9b") + rect(-b - 0.7, z, 1.4, 6.5, "#17120d")))


def hall(c):
    ze = ZR - BV * TANP
    iso.cast_shadow(c, [(sa * (A + 1), sb * (B + 1)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * AV, sb * BV, ze) for sa in (-1, 1) for sb in (-1, 1)] + [(sa * AV, 0, ZR + 2) for sa in (-1, 1)])
    iso.contact_ao(c, -A - 1.2, A + 1.2, -B - 1.2, B + 1.2)
    lc.wall_block(c, -A - 1.2, A + 1.2, -B - 1.2, B + 1.2, 0, F, seed=9)
    iso.lime_wall_b(c, B, -A, A, F, H, seed=7, mottle=10)
    iso.lime_wall_a(c, A, -B, B, F, H, gable=R)
    iso.window_a(c, A, -4, 4, 12, 20)
    # front: door in the middle, two windows, hoplite shields hung in a row along the wall
    iso.door_b(c, B, -4.5, 4.5, F, F + 16)
    for x in (-22, 15):
        iso.window_b(c, B, x, x + 7, 11, 19, shutters=False)
    iso.eave_shadow_b(c, B, -A, A, H, depth=6)
    for x in (-27, -10.6, 10.6, 27):
        lc.shield_b(c, B + 0.2, x, 15, r=3.7)
    iso.box(c, -6.5, 6.5, B, B + 3.2, 0, 1.6, "#ebe5d6", "#c9c0ad", "#a49c8c")
    iso.foot_tufts(c, [((-A - 1.2, B + 1.2), (-8, B + 1.2)), ((8, B + 1.2), (A + 1.2, B + 1.2)), ((A + 1.2, B + 1.2), (A + 1.2, -B - 1.2))],
                   n=10, seed=4, kind="dry", stones=3)
    iso.tile_roof_a(c, AV, BV, ZR, TANP, T=T, n=12, courses=4)


def tower(c):
    a0, a1, b0, b1 = TOWER
    iso.cast_shadow(c, [(a0, b0), (a1, b0), (a1, b1), (a0, b1)], [(a0, b0, TH + MH), (a1, b0, TH + MH), (a1, b1, TH + MH), (a0, b1, TH + MH)], opacity=0.5)
    iso.contact_ao(c, a0, a1, b0, b1)
    lc.wall_block(c, a0, a1, b0, b1, 0, TH - 3, seed=21, course=5.2)
    # string course, the parapet walk, merlons around it
    e = 1.2
    iso.box(c, a0 - e, a1 + e, b0 - e, b1 + e, TH - 3, TH, STONE["top"], STONE["lit"], STONE["right"], edge=STONE["hi"])
    c.add(c.on(c.m_ground(TH), rect(a0 + 1.4, b0 + 1.4, a1 - a0 - 2.8, b1 - b0 - 2.8, "#8d867a")))
    merlon_top(c, a0 - e, a1 + e, b0 - e, b1 + e, TH, 4, 4, "back")
    am, bm = (a0 + a1) / 2, (b0 + b1) / 2
    slit_b(c, b1, am, 29)
    c.add(c.on(c.m_bface(b1), rect(am - 2.5, 11, 5, 8, "#efe8d8") + rect(am - 1.7, 11.8, 3.4, 6.4, "#241a12")))
    slit_a(c, a1, bm, 31)
    lc.flag(c, am - 1, bm - 1, TH, 24, w=20, h=12, wave=2.2, pole=1.4)
    merlon_top(c, a0 - e, a1 + e, b0 - e, b1 + e, TH, 4, 4, "front")


def yard_wall(c):
    """Crenellated wall closing the yard on the left (we see its inner face) and the gate turret
    at its front end, with an owner-colour banner."""
    a0, a1, b0, b1 = WALL
    iso.cast_shadow(c, [(a0, b0), (a1, b0), (a1, b1), (a0, b1)], [(a0, b0, WH + 3), (a1, b0, WH + 3), (a1, b1, WH + 3), (a0, b1, WH + 3)], opacity=0.4)
    iso.contact_ao(c, a0, a1, b0, b1, width=3)
    lc.wall_block(c, a0, a1, b0, b1, 0, WH, seed=31)
    lc.merlons_b_run(c, a0, a1, b0, b1, WH, 8, w=3.6, h=3.4)
    t0, t1, u0, u1 = TURRET
    iso.cast_shadow(c, [(t0, u0), (t1, u0), (t1, u1), (t0, u1)], [(t0, u0, TUH + MH), (t1, u0, TUH + MH), (t1, u1, TUH + MH), (t0, u1, TUH + MH)], opacity=0.45)
    iso.contact_ao(c, t0, t1, u0, u1)
    lc.wall_block(c, t0, t1, u0, u1, 0, TUH - 2.4, seed=33)
    e = 1
    iso.box(c, t0 - e, t1 + e, u0 - e, u1 + e, TUH - 2.4, TUH, STONE["top"], STONE["lit"], STONE["right"], edge=STONE["hi"])
    c.add(c.on(c.m_ground(TUH), rect(t0 + 1.2, u0 + 1.2, t1 - t0 - 2.4, u1 - u0 - 2.4, "#8d867a")))
    merlon_top(c, t0 - e, t1 + e, u0 - e, u1 + e, TUH, 3, 3, "back", w=3.2)
    merlon_top(c, t0 - e, t1 + e, u0 - e, u1 + e, TUH, 3, 3, "front", w=3.2)
    # owner banner on the lit face, on an iron bar under the string course
    am = (t0 + t1) / 2
    c.add(c.on(c.m_bface(u1), rect(am - 4.4, TUH - 3.8, 8.8, 0.8, "#3b3a3a")))
    iso.drape_b(c, u1 + 0.1, am - 3.4, am + 3.4, TUH - 3.6, 13)
    slit_a(c, t1, (u0 + u1) / 2, 7)
    iso.foot_tufts(c, [((t0, u1), (t1, u1)), ((t1, u1), (t1, u0)), ((a1, 0), (a1, u0))], n=7, seed=12, kind="dry", stones=2)


def dummy(c, a, b):
    """Straw training dummy on a post, with a wooden sword arm and a hoplite shield (ACCENT)."""
    x, y = c.P(a, b, 0)
    B_ = lc.BURLAP
    W = WOOD
    c.add(f'<ellipse cx="{f(x + 5)}" cy="{f(y + 0.6)}" rx="8" ry="2.4" fill="{iso.INK}" opacity="0.28" filter="{c.blur(0.9)}"/>'
          f'<path d="M{f(x - 4)},{f(y + 1.6)} L{f(x + 4)},{f(y - 1.6)} M{f(x - 4)},{f(y - 1.6)} L{f(x + 4)},{f(y + 1.6)}" stroke="{W["dark"]}" stroke-width="1.5" stroke-linecap="round"/>'
          + rect(x - 0.9, y - 19, 1.8, 19, W["base"]) + rect(x - 0.9, y - 19, 0.6, 19, W["lit"])
          + f'<path d="M{f(x - 7)},{f(y - 13.6)} L{f(x + 7.5)},{f(y - 14.6)}" stroke="{W["base"]}" stroke-width="1.5" stroke-linecap="round"/>'
          f'<path d="M{f(x + 7.1)},{f(y - 14.4)} L{f(x + 9.6)},{f(y - 22)}" stroke="#c9a06a" stroke-width="1.2" stroke-linecap="round"/>'
          f'<ellipse cx="{f(x)}" cy="{f(y - 11)}" rx="3.8" ry="5.2" fill="{B_["base"]}"/>'
          f'<ellipse cx="{f(x - 1)}" cy="{f(y - 11.8)}" rx="2.4" ry="4" fill="{B_["lit"]}"/>'
          f'<path d="M{f(x - 3.6)},{f(y - 9.6)} L{f(x + 3.6)},{f(y - 10.2)} M{f(x - 3.4)},{f(y - 13)} L{f(x + 3.4)},{f(y - 13.6)}" stroke="{B_["dark"]}" stroke-width="0.6"/>'
          f'<circle cx="{f(x)}" cy="{f(y - 19.2)}" r="2.7" fill="{B_["lit"]}"/>'
          f'<path d="M{f(x - 3)},{f(y - 19.4)} A3,3.1 0 0 1 {f(x + 3)},{f(y - 19.4)} L{f(x + 3)},{f(y - 18.4)} L{f(x - 3)},{f(y - 18.4)}Z" fill="{iso.BRONZE["base"]}"/>'
          f'<path d="M{f(x - 2.6)},{f(y - 20)} A2.8,2.8 0 0 1 {f(x)},{f(y - 22.3)}" fill="none" stroke="{iso.BRONZE["hi"]}" stroke-width="0.7"/>')
    lc.shield_screen(c, x - 5.6, y - 11.2, r=4.4, squash=0.82)


def target(c, a, b):
    """Round straw archery target on a tripod, facing +a (it stands against the yard wall)."""
    W = WOOD
    iso.blob_shadow(c, a + 4, b, 4.5, 0.3)
    legs = "".join(f'<path d="M{f(-b + dx)},0 L{f(-b)},11" stroke="{W["dark"]}" stroke-width="1.1" stroke-linecap="round"/>' for dx in (-4.5, 4.5))
    c.add(c.on(c.m_aface(a - 1), legs))
    x = -b
    c.add(c.on(c.m_aface(a), f'<ellipse cx="{f(x)}" cy="9.5" rx="6" ry="5.5" fill="#a8844a"/><ellipse cx="{f(x)}" cy="9.5" rx="5.2" ry="4.8" fill="#d9c27e"/>'
               f'<ellipse cx="{f(x)}" cy="9.5" rx="3.6" ry="3.3" fill="none" stroke="#a3352c" stroke-width="1.2"/><ellipse cx="{f(x)}" cy="9.5" rx="1.2" ry="1.1" fill="#a3352c"/>'
               f'<path d="M{f(x + 0.8)},10.2 L{f(x + 6.5)},12.6" stroke="#6e4628" stroke-width="0.6"/><path d="M{f(x + 5.4)},12.9 L{f(x + 7.2)},12.4 L{f(x + 6.4)},11.4Z" fill="#f4ead2"/>'))


def spear_rack(c, a, b0, b1):
    """Wooden rack against a wall (facing +a) with spears (about 1.5 x a man's height) in it."""
    W = WOOD
    iso.blob_shadow(c, a + 3, (b0 + b1) / 2, (b1 - b0) * 0.4, 0.26)
    x0, x1 = -b1, -b0
    g = [rect(x0, 0, 1.3, 11, W["base"]), rect(x1 - 1.3, 0, 1.3, 11, W["base"]), rect(x0 - 1, 9, x1 - x0 + 2, 1.3, W["lit"]), rect(x0 - 1, 3, x1 - x0 + 2, 1.2, W["dark"])]
    n = 5
    for i in range(n):
        x = x0 + 2.4 + i * (x1 - x0 - 4.8) / (n - 1)
        top = 20 + (i * 7) % 3
        g.append(f'<path d="M{f(x)},0.5 L{f(x + 0.5)},{top}" stroke="#a8744a" stroke-width="0.85" stroke-linecap="round"/>'
                 f'<path d="M{f(x - 0.5)},{top - 0.3} L{f(x + 0.6)},{top + 3.8} L{f(x + 1.5)},{top - 0.3}Z" fill="#d9dbd8"/>')
    c.add(c.on(c.m_aface(a), "".join(g)))


def hoplite(c, a, b, seed=1, stride=0.4):
    """A hoplite at drill (person scale ~14 world units), shield face in the owner colour."""
    x, y = c.P(a, b, 0)
    c.add(f'<ellipse cx="{f(x + 3)}" cy="{f(y + 0.4)}" rx="5.2" ry="1.7" fill="{iso.INK}" opacity="0.3" filter="{c.blur(0.6)}"/>')
    U.person(c, x, y, h=14 * iso.ZS, armor="cuirass", legs="greaves", stride=stride, helmet="corinthian",
             hold="spear", shield="aspis", accents=("shield", "crest"), seed=seed)


def build():
    c = iso.Canvas("barracks")
    iso.ground(c)
    a0, a1, b0, b1 = TOWER
    ha, hb = HALL
    iso.ground_ao(c, [(a0 - 2, b0 - 2), (ha + A + 2, hb - B - 2), (ha + A + 2, hb + B + 2), (TURRET[0], TURRET[3])], grow=7, opacity=0.14)
    tower(c)
    yard_wall(c)
    target(c, WALL[1] + 2.5, -8)
    spear_rack(c, WALL[1] + 1.5, 3, 15)
    with c.at(*HALL):
        hall(c)
    iso.brazier(c, 26, -5, 0, k=1.0)
    hoplite(c, -19, 4, seed=1)
    hoplite(c, -5, 12, seed=2, stride=0.2)
    dummy(c, 14, 16)
    lc.crate(c, -24, 34, 3.4, 5)
    lc.sack(c, -17, 37, k=0.85)
    iso.pebbles(c, [(36, 18, 1.2, 1), (22, 30, 1.0, 2), (-4, 30, 1.1, 3)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
