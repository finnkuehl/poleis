"""sawmill - an open timber shed under a tile roof, stacked with pale sawn planks; in the yard a
trunk on trestles with a big two-man frame saw, a pile of logs and sawdust on the ground.
Accent (owner colour): base rim band, the banner, the cloth over the plank stack and the
drape on the shed's gable beam."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402
import random  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_processing as lp  # noqa: E402
from iso import WOOD, f, poly  # noqa: E402

# shed (placed with c.at(SHED)); world units, base radius 68
SHED = (-10, -22)
A, B = 34, 13          # half length (a) and half depth (b)
H = 34                 # post height (tall and shallow, so the inside stays visible)
R = 7                  # roof rise
T = 3.4                # tile thickness
AV, BV = A + 3.5, B + 4
TANP = R / B
ZR = H + R + T

LOG_B = 27             # b of the trunk on the trestles
LOG_Z, LOG_R = 16, 6.2
SAW_A = 12              # a of the frame saw


def shed(c):
    ze = ZR - BV * TANP
    iso.cast_shadow(c, [(sa * A, sb * B) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * AV, sb * BV, ze) for sa in (-1, 1) for sb in (-1, 1)], opacity=0.42)
    # trodden floor with sawdust
    fl = c.lin("floor", -A, 0, A, 0, [(0, "#d9bd8a"), (1, "#b9976a")])
    c.add(c.on(c.m_ground(0.3), f'<rect x="{-A - 1}" y="{-B - 1}" width="{2 * A + 2}" height="{2 * B + 5}" rx="3" fill="{fl}"/>'))
    # inside faces of the back and left board walls (in the roof's shade)
    lp.plank_wall_b(c, -B, -A, A, 0, H)
    lp.plank_wall_a(c, -A, -B, B, 0, H)
    c.add(c.on(c.m_ground(0.4), f'<rect x="{-A}" y="{-B}" width="{2 * A}" height="9" fill="#2a1a0e" opacity="0.35" filter="{c.blur(1.2)}"/>'))
    lp.post(c, A, -B, 0, H)
    # planks stored inside: two pale stacks and a few boards leaning on the back wall
    for i, a0 in enumerate((-27, -22.5, -18)):
        pts = [c.P(a0, -B + 5, 0), c.P(a0 + 3.4, -B + 5, 0), c.P(a0 + 3.4, -B + 0.6, 25), c.P(a0, -B + 0.6, 25)]
        c.add(f'<path d="{poly(pts)}" fill="{("#e8cd92", "#dcbf80", "#efd69c")[i]}"/>')
    lp.plank_stack(c, -29, -4, -3, 9, 0.3, n=5, th=2.2, seed=4)
    lp.plank_stack(c, 4, 29, -5, 8, 0.3, n=7, th=2.2, seed=9)
    # front posts with braces, beams
    for a in (-A, 0, A):
        lp.post(c, a, B, 0, H)
    for a, s in ((-A, 1), (0, -1), (0, 1), (A, -1)):
        c.add(c.on(c.m_bface(B + 1.5), f'<path d="M{f(a)},{H - 11} L{f(a + s * 8)},{H - 3} L{f(a + s * 10.4)},{H - 3} L{f(a)},{H - 13.6}Z" fill="{WOOD["base"]}"/>'))
    lp.timber(c, A - 1.5, A + 1.5, -B, B, H - 3.2, H)
    lp.timber(c, -A - 1.5, A + 1.5, B - 1.5, B + 1.5, H - 3.2, H)
    # open gable: dark roof underside with a king-post truss
    g = [f'<path d="{poly([(-B, H), (B, H), (0, H + R)])}" fill="#2e1e12"/>',
         f'<rect x="-1.2" y="{H}" width="2.4" height="{R - 1}" fill="{WOOD["dark"]}"/>']
    c.add(c.on(c.m_aface(A + 1.5), "".join(g)))
    iso.drape_a(c, A + 1.5, -5.5, 5.5, H - 3.2, 13)
    iso.tile_roof_a(c, AV, BV, ZR, TANP, T=T, n=13, courses=3, seed=14)


def sawdust(c, a, b, r, seed):
    rnd = random.Random(seed)
    g = c.rad("dust", a, b, r, [(0, "#f6e3ad", 0.95), (0.6, "#efd595", 0.7), (1, "#efd595", 0)])
    out = [f'<ellipse cx="{f(a)}" cy="{f(b)}" rx="{f(r * 1.25)}" ry="{f(r * 0.8)}" fill="{g}"/>']
    for _ in range(26):
        out.append(f'<circle cx="{f(a + rnd.uniform(-1.3, 1.3) * r)}" cy="{f(b + rnd.uniform(-0.9, 0.9) * r)}" r="{f(rnd.uniform(0.35, 0.7))}" fill="#fff0c2" opacity="0.9"/>')
    c.add(c.on(c.m_ground(0.2), "".join(out)))


def trestle(c, a, b):
    """X-shaped sawhorse standing in the plane a = const."""
    for s in (-1, 1):
        x0, y0 = c.P(a, b + s * 8.5, 0)
        x1, y1 = c.P(a, b - s * 4.2, 13)
        c.add(f'<path d="M{f(x0)},{f(y0)} L{f(x1)},{f(y1)}" stroke="{WOOD["dark"] if s < 0 else WOOD["base"]}" stroke-width="2.3" stroke-linecap="round"/>'
              f'<path d="M{f(x0 - 0.5)},{f(y0 - 0.4)} L{f(x1 - 0.5)},{f(y1 - 0.4)}" stroke="{WOOD["lit"]}" stroke-width="0.7" stroke-linecap="round" opacity="0.8"/>')


def frame_saw(c, front):
    """Two-man frame saw straddling the trunk (frame in the plane a = SAW_A, blade along the cut)."""
    z0, z1 = 3, 40
    hw = 11.5
    m = c.m_aface(SAW_A)
    if not front:
        # far stile and the bottom rail pass behind / under the trunk
        c.add(c.on(m, f'<rect x="{f(-LOG_B - hw)}" y="{z0}" width="{2 * hw}" height="2" fill="{WOOD["dark"]}"/>'
                      f'<rect x="{f(-LOG_B + hw - 2)}" y="{z0}" width="2" height="{z1 - z0}" fill="{WOOD["dark"]}"/>'))
        return
    # blade: a bright steel band in the kerf (plane b = LOG_B), teeth toward +a
    teeth = "".join(f"L{f(SAW_A + 3.4)},{f(z)} L{f(SAW_A + 2)},{f(z + 0.9)} " for z in [LOG_Z + LOG_R - 1 + i * 1.8 for i in range(int((z1 - LOG_Z - LOG_R) / 1.8))])
    c.add(c.on(c.m_bface(LOG_B), f'<path d="M{f(SAW_A - 2)},{f(LOG_Z + LOG_R - 1.5)} L{f(SAW_A + 2)},{f(LOG_Z + LOG_R - 1.5)} {teeth}L{f(SAW_A + 2)},{z1} L{f(SAW_A - 2)},{z1}Z" fill="{lp.STEEL["base"]}"/>'
               f'<rect x="{f(SAW_A - 2)}" y="{f(LOG_Z + LOG_R - 1.5)}" width="0.9" height="{f(z1 - LOG_Z - LOG_R + 1.5)}" fill="{lp.STEEL["hi"]}"/>'))
    # near stile, top rail with handles, tension cord
    c.add(c.on(m, f'<rect x="{f(-LOG_B - hw)}" y="{z0}" width="2.8" height="{z1 - z0}" fill="{WOOD["base"]}"/>'
                  f'<rect x="{f(-LOG_B - hw)}" y="{z0}" width="0.9" height="{z1 - z0}" fill="#d9aa78"/>'
                  f'<rect x="{f(-LOG_B - hw - 3)}" y="{z1 - 2.4}" width="{2 * hw + 6}" height="2.6" rx="1.2" fill="{WOOD["lit"]}"/>'
                  f'<rect x="{f(-LOG_B - hw - 3)}" y="{z1 - 0.5}" width="{2 * hw + 6}" height="0.6" fill="#e2b98a"/>'
                  f'<rect x="{f(-LOG_B + hw - 2)}" y="{LOG_Z + LOG_R + 3}" width="2" height="{f(z1 - LOG_Z - LOG_R - 3)}" fill="{WOOD["dark"]}"/>'))


def build():
    c = iso.Canvas("sawmill")
    sa, sb = SHED

    def avoid(a, b):
        return (sa - A - 3 < a < sa + A + 3 and sb - B - 3 < b < sb + B + 6) or (-20 < a < 38 and LOG_B - 10 < b < LOG_B + 10)
    iso.base(c, seed=43, avoid=avoid, tufts=80, flowers=12)

    iso.olive_tree(c, -54, -4, size=0.72, seed=6)
    with c.at(*SHED):
        shed(c)
    iso.base_tufts(c, [((sa - A, sb + B + 2), (sa - A + 10, sb + B + 2)), ((sa + A + 2, sb + B), (sa + A + 2, sb - B))], n=8, seed=5)

    # banner at the corner of the yard
    iso.banner_b(c, 47, -17, 0, height=38, width=8, drop=16)

    # log pile (left): sawn ends face the viewer
    iso.cast_shadow(c, [(-55, 6), (-37, 6), (-37, 32), (-55, 32)], [(-53, 6, 9), (-39, 6, 9), (-39, 32, 9), (-46, 32, 17)], opacity=0.36, sd=1.4)
    lp.log_b(c, -51, 5, 30, 4.8, 4.8)
    lp.log_b(c, -41, 3, 31, 5, 5)
    lp.log_b(c, -46, 6, 32, 13.2, 4.7)

    # the sawing place: sawdust, trestles, trunk, frame saw
    sawdust(c, 12, LOG_B + 2, 17, 3)
    iso.cast_shadow(c, [(-14, LOG_B - 5), (36, LOG_B - 5), (36, LOG_B + 5), (-14, LOG_B + 5)],
                    [(-14, LOG_B - 5, LOG_Z), (36, LOG_B - 5, LOG_Z), (36, LOG_B + 5, LOG_Z), (-14, LOG_B + 5, LOG_Z)], opacity=0.3, sd=1.6)
    frame_saw(c, front=False)
    trestle(c, -6, LOG_B)
    trestle(c, 27, LOG_B)
    lp.log_a(c, LOG_B, -15, 36, LOG_Z, LOG_R)
    # the kerf: the cut already made, running from the trunk's end to the blade
    x0, y0 = c.P(SAW_A, LOG_B, LOG_Z + LOG_R)
    x1, y1 = c.P(36, LOG_B, LOG_Z + LOG_R)
    c.add(f'<path d="M{f(x0)},{f(y0)} L{f(x1)},{f(y1)}" stroke="#3e2514" stroke-width="1.1"/>'
          f'<path d="M{f(x0)},{f(y0 - 0.9)} L{f(x1)},{f(y1 - 0.9)}" stroke="#f1dba6" stroke-width="0.6" opacity="0.8"/>')
    frame_saw(c, front=True)

    # chopping block with an axe, offcuts
    lp.stump(c, -22, 42)
    for a0, b0, rot in ((-2, 50, 18), (4, 46, -24)):
        c.add(c.on(c.m_ground(0.4), f'<rect x="-5" y="-1.1" width="10" height="2.2" transform="translate({a0} {b0}) rotate({rot})" fill="#efd89e"/>'))

    # fresh planks under an owner-coloured cloth (right)
    iso.cast_shadow(c, [(36, -8), (56, -8), (56, 6), (36, 6)], [(36, -8, 12), (56, -8, 12), (56, 6, 12), (36, 6, 12)], opacity=0.36, sd=1.4)
    top = lp.plank_stack(c, 35, 56, -7, 6, 0, n=5, th=2.2, seed=21)
    lp.tarp(c, 43, 57, -7.6, 6.6, top + 0.2, drop=4.8)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
