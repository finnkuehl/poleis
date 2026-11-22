"""sawmill - an open timber shed under a tile roof, standing directly on the map (grounded,
docs/ART.md) at the shared human scale: pale sawn planks stacked inside and leaning on the back
wall; in the yard a trunk on tall trestles with a two-man frame saw in its cut, sawdust below, a
pile of logs, a chopping block with an axe and fresh planks under a cloth. The game draws the
trodden-earth yard underneath.
Accent (owner colour): the cloth over the fresh planks, the drape on the shed's gable beam and the
banner at the corner of the yard."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402
import random  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_processing as lp  # noqa: E402
import lib_raw as raw  # noqa: E402
from iso import WOOD, f, poly  # noqa: E402

# world units; keep everything inside iso.GROUND_R = 58
SHED = (-8, -17)       # shed centre
A, B = 28, 12          # half length (a) and half depth (b): a 56 x 24 shed (README "Scale": medium)
H = 24                 # post height (eave line): a person (~14) works upright under it
R = 8                  # roof rise
T = 3.2                # tile thickness
AV, BV = A + 3, B + 4  # roof half extents incl. overhangs
TANP = R / B
ZR = H + R + T

LOG_B = 21             # b of the trunk on the trestles (world)
LOG_A = (-24, 16)      # its a range (5 m long)
LOG_Z, LOG_R = 12, 3.4  # axis height (tall trestles: the bottom sawyer stands under it), radius
SAW_A = 2              # a of the frame saw
STACK = (27, 47, -7, 6)  # fresh planks under the cloth: a0, a1, b0, b1


def shed(c):
    ze = ZR - BV * TANP
    iso.cast_shadow(c, [(sa * (A + 1), sb * (B + 1)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * AV, sb * BV, ze) for sa in (-1, 1) for sb in (-1, 1)] + [(sa * AV, 0, ZR) for sa in (-1, 1)], opacity=0.42)
    # trodden floor with sawdust under the roof (darker: it lies in the roof's shade)
    c.add(c.on(c.m_ground(0.2), f'<rect x="{-A - 1}" y="{-B - 1}" width="{2 * A + 2}" height="{2 * B + 2}" rx="2" fill="#7d6444" opacity="0.35" filter="{c.blur(1.2)}"/>'))
    # inside faces of the back and left board walls
    lp.plank_wall_b(c, -B, -A, A, 0, H, pitch=3.4)
    lp.plank_wall_a(c, -A, -B, B, 0, H, pitch=3.4)
    c.add(c.on(c.m_ground(0.4), f'<rect x="{-A}" y="{-B}" width="{2 * A}" height="7" fill="#2a1a0e" opacity="0.35" filter="{c.blur(1.2)}"/>'))
    lp.post(c, A, -B, 0, H, 1.3)
    # boards leaning on the back wall
    for i, a0 in enumerate((-24, -20.6, -17.2, 10, 13.2)):
        p = [c.P(a0, -B + 4, 0), c.P(a0 + 2.8, -B + 4, 0), c.P(a0 + 2.8, -B + 0.6, 19), c.P(a0, -B + 0.6, 19)]
        c.add(f'<path d="{poly(p)}" fill="{("#e8cd92", "#dcbf80", "#efd69c", "#e4c98a", "#d6b878")[i]}"/>'
              f'<path d="M{f(p[1][0])},{f(p[1][1])} L{f(p[2][0])},{f(p[2][1])}" stroke="#9a7440" stroke-width="0.4" opacity="0.7"/>')
    # two stacks of sawn planks inside (2.5 m boards)
    lp.plank_stack(c, -22, -2, -6, 4, 0.3, n=5, th=1.5, seed=4)
    lp.plank_stack(c, 4, 22, -7, 5, 0.3, n=7, th=1.5, seed=9)
    # front posts with knee braces, plate beams
    for a in (-A, 0, A):
        lp.post(c, a, B, 0, H, 1.3)
    for a, s in ((-A, 1), (0, -1), (0, 1), (A, -1)):
        c.add(c.on(c.m_bface(B + 1.3), f'<path d="M{f(a)},{H - 8} L{f(a + s * 6)},{H - 2.4} L{f(a + s * 8)},{H - 2.4} L{f(a)},{H - 10.2}Z" fill="{WOOD["base"]}"/>'))
    lp.timber(c, A - 1.3, A + 1.3, -B, B, H - 2.6, H)
    lp.timber(c, -A - 1.3, A + 1.3, B - 1.3, B + 1.3, H - 2.6, H)
    # open gable: dark roof underside with a king post, owner drape on the tie beam
    c.add(c.on(c.m_aface(A + 1.3), f'<path d="{poly([(-B - 2, H), (B + 2, H), (0, H + R + 1)])}" fill="#2e1e12"/>'
               f'<rect x="-1" y="{H}" width="2" height="{R - 0.5}" fill="{WOOD["dark"]}"/>'))
    iso.drape_a(c, A + 1.3, -5, 5, H - 2.6, 10)
    iso.foot_tufts(c, [((-A - 1, B + 1.5), (-A + 6, B + 1.5)), ((A + 1.5, B), (A + 1.5, -B))], n=7, seed=5, kind="dry", stones=2)
    iso.tile_roof_a(c, AV, BV, ZR, TANP, T=T, n=13, courses=3, seed=14)


def sawdust(c, a, b, r, seed):
    """Pale sawdust heaped under the saw (ground plane)."""
    rnd = random.Random(seed)
    g = c.rad("dust", a, b, r, [(0, "#f6e3ad", 0.95), (0.6, "#efd595", 0.7), (1, "#efd595", 0)])
    out = [f'<ellipse cx="{f(a)}" cy="{f(b)}" rx="{f(r * 1.3)}" ry="{f(r * 0.8)}" fill="{g}"/>']
    for _ in range(18):
        out.append(f'<circle cx="{f(a + rnd.uniform(-1.2, 1.2) * r)}" cy="{f(b + rnd.uniform(-0.8, 0.8) * r)}" r="{f(rnd.uniform(0.3, 0.55))}" fill="#fff0c2" opacity="0.9"/>')
    c.add(c.on(c.m_ground(0.2), "".join(out)))


def trestle(c, a, b, top):
    """X-shaped sawing trestle standing in the plane a = const."""
    for s in (-1, 1):
        x0, y0 = c.P(a, b + s * 5.2, 0)
        x1, y1 = c.P(a, b - s * 2.6, top + 1.5)
        c.add(f'<path d="M{f(x0)},{f(y0)} L{f(x1)},{f(y1)}" stroke="{WOOD["dark"] if s < 0 else WOOD["base"]}" stroke-width="1.6" stroke-linecap="round"/>'
              f'<path d="M{f(x0 - 0.4)},{f(y0 - 0.3)} L{f(x1 - 0.4)},{f(y1 - 0.3)}" stroke="{WOOD["lit"]}" stroke-width="0.5" stroke-linecap="round" opacity="0.8"/>')
    raw.timber(c, (a - 0.2, b - 4, 4.2), (a - 0.2, b + 4, 4.2), w=1.1)


def frame_saw(c, front):
    """Two-man frame saw standing in the cut (frame in the plane a = SAW_A, blade along the kerf)."""
    z0, z1 = 3, 23          # 2.5 m tall
    hw = 6
    m = c.m_aface(SAW_A)
    if not front:
        # far stile and the bottom rail pass behind / under the trunk
        c.add(c.on(m, f'<rect x="{f(-LOG_B - hw)}" y="{z0}" width="{2 * hw}" height="1.4" fill="{WOOD["dark"]}"/>'
                      f'<rect x="{f(-LOG_B + hw - 1.4)}" y="{z0}" width="1.4" height="{z1 - z0}" fill="{WOOD["dark"]}"/>'))
        return
    zc = LOG_Z + LOG_R - 1
    teeth = "".join(f"L{f(SAW_A + 2.2)},{f(z)} L{f(SAW_A + 1.3)},{f(z + 0.7)} " for z in [zc + i * 1.4 for i in range(int((z1 - zc) / 1.4))])
    c.add(c.on(c.m_bface(LOG_B), f'<path d="M{f(SAW_A - 1.3)},{f(zc)} L{f(SAW_A + 1.3)},{f(zc)} {teeth}L{f(SAW_A + 1.3)},{z1} L{f(SAW_A - 1.3)},{z1}Z" fill="{lp.STEEL["base"]}"/>'
               f'<rect x="{f(SAW_A - 1.3)}" y="{f(zc)}" width="0.6" height="{f(z1 - zc)}" fill="{lp.STEEL["hi"]}"/>'))
    # near stile, top rail with handles, tension cord
    c.add(c.on(m, f'<rect x="{f(-LOG_B - hw)}" y="{z0}" width="1.8" height="{z1 - z0}" fill="{WOOD["base"]}"/>'
                  f'<rect x="{f(-LOG_B - hw)}" y="{z0}" width="0.6" height="{z1 - z0}" fill="#d9aa78"/>'
                  f'<rect x="{f(-LOG_B - hw - 2.4)}" y="{z1 - 1.8}" width="{2 * hw + 4.8}" height="1.9" rx="0.9" fill="{WOOD["lit"]}"/>'
                  f'<rect x="{f(-LOG_B - hw - 2.4)}" y="{z1 - 0.4}" width="{2 * hw + 4.8}" height="0.5" fill="#e2b98a"/>'
                  f'<path d="M{f(-LOG_B - hw + 1)},{z1 - 3} L{f(-LOG_B + hw - 1)},{z1 - 3}" stroke="#c9ab7a" stroke-width="0.5"/>'))


def build():
    c = iso.Canvas("sawmill")
    iso.ground(c)
    sa, sb = SHED
    a0, a1, b0, b1 = STACK
    # wide soft AO under the shed, the stack and the sawing place
    iso.ground_ao(c, [(sa - A - 2, sb - B - 2), (sa + A + 4, sb - B - 2), (a1 + 2, b0), (a1 + 2, b1 + 2), (LOG_A[1] + 4, LOG_B + 6), (-46, 30), (-48, 4)], grow=5, opacity=0.13)

    with c.at(*SHED):
        shed(c)

    # banner at the back corner of the yard
    iso.banner_b(c, 44, -26, 0, height=30, width=7, drop=13)

    # fresh planks under an owner-coloured cloth (right)
    iso.cast_shadow(c, [(a0, b0), (a1, b0), (a1, b1), (a0, b1)], [(a0, b0, 9), (a1, b0, 9), (a1, b1, 9), (a0, b1, 9)], opacity=0.36, sd=1.4)
    iso.contact_ao(c, a0, a1, b0, b1, width=2.5, opacity=0.35)
    for a in (a0 + 3, a1 - 4):          # bearers under the stack
        lp.timber(c, a - 1, a + 1, b0 - 0.6, b1 + 0.6, 0, 1.4)
    top = lp.plank_stack(c, a0, a1, b0, b1, 1.4, n=5, th=1.5, seed=21)
    lp.tarp(c, a0 + 7, a1 + 0.8, b0 - 0.6, b1 + 0.6, top + 0.2, drop=4)

    # log pile (left): sawn ends face the viewer
    iso.cast_shadow(c, [(-51, 5), (-37, 5), (-37, 26), (-51, 26)], [(-50, 5, 7), (-39, 5, 7), (-39, 26, 7), (-45, 26, 11)], opacity=0.36, sd=1.4)
    iso.contact_ao(c, -50, -38, 5, 26, width=2.5, opacity=0.3)
    raw.log_pile_b(c, -48, 6, 25, 3.0, rows=(4, 3, 2), seed=7)

    # the sawing place: sawdust, trestles, trunk, frame saw
    sawdust(c, SAW_A + 2, LOG_B + 1, 9, 3)
    la0, la1 = LOG_A
    iso.cast_shadow(c, [(la0, LOG_B - 4), (la1, LOG_B - 4), (la1, LOG_B + 4), (la0, LOG_B + 4)],
                    [(la0, LOG_B - 3, LOG_Z + LOG_R), (la1, LOG_B - 3, LOG_Z + LOG_R), (la1, LOG_B + 3, LOG_Z + LOG_R), (la0, LOG_B + 3, LOG_Z + LOG_R)], opacity=0.3, sd=1.6)
    for ta in (la0 + 5, la1 - 5):
        iso.blob_shadow(c, ta + 2, LOG_B, 4, 0.3)
    frame_saw(c, front=False)
    trestle(c, la0 + 5, LOG_B, LOG_Z - LOG_R)
    trestle(c, la1 - 5, LOG_B, LOG_Z - LOG_R)
    lp.log_a(c, LOG_B, la0, la1, LOG_Z, LOG_R)
    # the kerf already cut, from the trunk's end to the blade
    x0, y0 = c.P(SAW_A, LOG_B, LOG_Z + LOG_R)
    x1, y1 = c.P(la1, LOG_B, LOG_Z + LOG_R)
    c.add(f'<path d="M{f(x0)},{f(y0)} L{f(x1)},{f(y1)}" stroke="#3e2514" stroke-width="0.9"/>'
          f'<path d="M{f(x0)},{f(y0 - 0.7)} L{f(x1)},{f(y1 - 0.7)}" stroke="#f1dba6" stroke-width="0.5" opacity="0.8"/>')
    frame_saw(c, front=True)

    # chopping block with an axe and offcuts (front left)
    raw.chips(c, -22, 42, 6, n=10, seed=9)
    iso.blob_shadow(c, -20, 40, 4, 0.35)
    raw.stump(c, -22, 40, 3.6, 4.6, seed=7)
    x, y = c.P(-22, 40, 4.6)
    raw.axe(c, x - 0.6, y - 0.4, k=0.8)
    for oa, ob, rot in ((-6, 44, 18), (2, 40, -24)):
        c.add(c.on(c.m_ground(0.4), f'<rect x="-4" y="-0.9" width="8" height="1.8" transform="translate({oa} {ob}) rotate({rot})" fill="#efd89e"/>'
                   f'<rect x="-4" y="0.5" width="8" height="0.4" transform="translate({oa} {ob}) rotate({rot})" fill="#9a7440" opacity="0.6"/>'))
    iso.pebbles(c, [(36, 28, 1.3, 61), (-28, 46, 1.1, 62), (50, -14, 1.2, 63)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
