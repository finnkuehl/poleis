"""quarry - the quarry itself, standing directly on the map (grounded, docs/ART.md) at the shared
human scale: a pale limestone outcrop of the hill cut back in three terraces of block faces, with
weathered rock around it; in front a timber treadwheel crane lifting a block off the lowest
terrace, stacks of dressed blocks, a block on rollers and a small plank tool shed. The game draws
the stony apron underneath (and clears the hill's own mounds inside the footprint).
Accent (owner colour): the canvas over a stack of blocks, the shed's painted door and the pennant
on the crane."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_processing as lp  # noqa: E402
import lib_raw as raw  # noqa: E402
from iso import ACCENT, WOOD, f  # noqa: E402

# world units; keep everything inside iso.GROUND_R = 58
# terraces (a0, a1, b0, b1, z0, z1) cut into the outcrop, stepping down toward the front
TERRACES = [(-38, 6, -26, -6, 0, 9), (-38, -6, -34, -18, 9, 18), (-38, -18, -40, -28, 18, 27)]
TOP = "#c9bb98"                 # weathered top of the natural rock (a little grass in its cracks)
CUT_TOP = "#ece2c8"             # floor of a cut terrace
WHEEL = (28, 7, 9.5, 9)        # treadwheel hub (a, b, z) and rim radius
APEX = (3, -4, 31)            # top of the crane's A-frame jib
FEET = [(-4, 6, 0), (10, 6, 0)]  # its two feet
HOOK_Z = 4.5                     # bottom of the block being lifted (just above the lowest terrace)
SHED = (-36, 18)                # tool shed centre
SA, SB, SH = 11, 7, 18           # shed half extents and wall height
STACK = (30, 30)                # stack of blocks under the canvas


def tarp_stack(c, a, b):
    """Three dressed blocks under a canvas tarp (ACCENT) tied down with ropes."""
    raw.stone_block(c, a, b, 7, 4.5, 5, seed=21)
    raw.stone_block(c, a - 0.6, b - 0.3, 6, 4, 4.6, z0=5, seed=22, shadow=False)
    ha, hb, zt = 6.5, 4.6, 9.8
    a0, a1, b0, b1 = a - 0.6 - ha, a - 0.6 + ha, b - 0.3 - hb, b - 0.3 + hb
    drop = 3.4
    top = f'<rect x="{f(a0 - 0.4)}" y="{f(b0 - 0.4)}" width="{f(a1 - a0 + 0.8)}" height="{f(b1 - b0 + 0.8)}" fill="{ACCENT["lit"]}"/>'
    hem = " ".join(f"Q{f(a0 + (i + 0.5) * (a1 - a0) / 4)},{f(zt - drop - 1.1 * (i % 2 * 2 - 1))} {f(a0 + (i + 1) * (a1 - a0) / 4)},{f(zt - drop)}" for i in range(4))
    front = (f'<path d="M{f(a0 - 0.4)},{f(zt + 0.1)} L{f(a1 + 0.4)},{f(zt + 0.1)} L{f(a1 + 0.4)},{f(zt - drop)} L{f(a0 - 0.4)},{f(zt - drop)}Z" fill="{ACCENT["light"]}"/>'
             f'<path d="M{f(a0 - 0.4)},{f(zt - drop)} {hem} L{f(a1 + 0.4)},{f(zt - drop + 0.5)} L{f(a0 - 0.4)},{f(zt - drop + 0.5)}Z" fill="{ACCENT["light"]}"/>')
    hem_r = " ".join(f"Q{f(-b1 + (i + 0.5) * (b1 - b0) / 3)},{f(zt - drop - 1 * (i % 2 * 2 - 1))} {f(-b1 + (i + 1) * (b1 - b0) / 3)},{f(zt - drop)}" for i in range(3))
    right = (f'<path d="M{f(-b1 - 0.4)},{f(zt + 0.1)} L{f(-b0 + 0.4)},{f(zt + 0.1)} L{f(-b0 + 0.4)},{f(zt - drop)} L{f(-b1 - 0.4)},{f(zt - drop)}Z" fill="{ACCENT["shade"]}"/>'
             f'<path d="M{f(-b1 - 0.4)},{f(zt - drop)} {hem_r} L{f(-b0 + 0.4)},{f(zt - drop + 0.5)} L{f(-b1 - 0.4)},{f(zt - drop + 0.5)}Z" fill="{ACCENT["shade"]}"/>')
    c.accent(c.on(c.m_ground(zt), top))
    c.accent(c.on(c.m_bface(b1 + 0.4), front))
    c.accent(c.on(c.m_aface(a1 + 0.4), right))
    folds = c.lin("tarpfold", 0, 0, 1, 0, [(0, "#ffffff", 0.0), (0.3, "#1d2b36", 0.12), (0.5, "#ffffff", 0.0), (0.75, "#1d2b36", 0.12), (1, "#ffffff", 0)], bbox=True)
    c.add(c.on(c.m_bface(b1 + 0.4), f'<rect x="{f(a0)}" y="{f(zt - drop - 1)}" width="{f(a1 - a0)}" height="{f(drop + 1)}" fill="{folds}"/>'
               f'<path d="M{f(a0 + 3)},{f(zt)} L{f(a0 + 3)},{f(zt - drop - 1.2)} M{f(a1 - 3)},{f(zt)} L{f(a1 - 3)},{f(zt - drop - 1.2)}" stroke="#6e5638" stroke-width="0.5"/>'))
    c.add(c.on(c.m_ground(zt), f'<path d="M{f(a0 + 3)},{f(b0)} L{f(a0 + 3)},{f(b1)} M{f(a1 - 3)},{f(b0)} L{f(a1 - 3)},{f(b1)}" stroke="#6e5638" stroke-width="0.5"/>'
               f'<rect x="{f(a0)}" y="{f(b0)}" width="{f(a1 - a0)}" height="{f(b1 - b0)}" fill="url(#{c.id("tarptop")})"/>'))
    c.rad("tarptop", 0.3, 0.3, 0.8, [(0, "#ffffff", 0.12), (1, "#1d2b36", 0.1)], bbox=True)


def outcrop(c):
    """The natural rock of the hill, with the quarry cut into its front as three terraces."""
    W = raw.WEATHERED
    # the hill's weathered rock behind and around the cut
    raw.boulder(c, -16, -42, 22, 10, 38, seed=41, pal=W, n=26, flat_top=0.35)
    raw.boulder(c, 8, -40, 16, 12, 30, seed=42, pal=W, n=22, flat_top=0.3)
    raw.boulder(c, -37, -28, 10, 13, 33, seed=43, pal=W, n=20, flat_top=0.3)
    a0, a1, b0, b1, z0, z1 = TERRACES[0]
    iso.cast_shadow(c, [(a0, b0), (a1, b0), (a1, b1), (a0, b1)],
                    [(a1, b0, z1), (a1, b1, z1), (TERRACES[1][1], TERRACES[1][3], TERRACES[1][5]), (TERRACES[2][1], TERRACES[2][3], TERRACES[2][5])], opacity=0.42)
    iso.contact_ao(c, a0, a1, b0, b1)
    for i, t in enumerate(TERRACES):
        if i:
            iso.contact_ao(c, t[0], t[1], t[2], t[3], z=t[4], width=3, opacity=0.3)   # foot of the next cut
        raw.terrace(c, *t, course=4.5, seed=3 + i * 5, notches=1 if i < 2 else 0, top_fill=CUT_TOP)
        if i == 0:
            # a block half cut free on the lowest terrace, its outline scored into the rock
            raw.stone_block(c, -24, -14, 5, 3.4, 4, z0=t[5], seed=8, shadow=False)
            c.add(c.on(c.m_ground(t[5]), '<rect x="-30" y="-18" width="12" height="8" fill="none" stroke="#7d6c52" stroke-width="0.6" opacity="0.5"/>'))
        if i == 1:
            with c.at(0, 0, t[5]):
                raw.rubble(c, [(-30, -22, 1.3, 61), (-25, -21, 1.0, 62)], pal=raw.PALE_ROCK)
    # natural rock closing the cut on both sides, so the terraces run into the hill
    raw.boulder(c, 16, -22, 14, 15, 24, seed=44, pal=W, n=24, flat_top=0.3)
    raw.boulder(c, -46, -10, 9, 12, 16, seed=45, pal=W, n=18, flat_top=0.2)
    raw.boulder(c, 26, -6, 6, 6, 9, seed=47, pal=W, n=14)
    raw.boulder(c, -47, 5, 4, 4, 6, seed=46, pal=W, n=10)
    # chips and spalls at the foot of each cut face
    raw.rubble(c, [(-34, -3.5, 1.2, 63), (-14, -3.5, 1.0, 64), (-2, -3.5, 1.1, 65)], pal=raw.PALE_ROCK)
    with c.at(0, 0, TERRACES[0][5]):
        raw.rubble(c, [(-12, -16, 1.0, 68), (-2, -20, 1.1, 69)], pal=raw.PALE_ROCK)
    # a wild olive bush on the hill top
    with c.at(-20, -43, 36):
        iso.olive_tree(c, 0, 0, size=0.42, seed=6)


def crane(c):
    """Treadwheel crane: an A-frame jib leaning over the lowest terrace, the block on its hook,
    the treadwheel at its foot winding the hoisting rope."""
    ax, ab, az = APEX
    # the block on the hook, then the far leg, the near leg and the cross brace
    raw.rope(c, APEX, (ax, ab, HOOK_Z + 7.4))
    raw.rope(c, (ax, ab, HOOK_Z + 7.4), (ax - 3.6, ab + 2.6, HOOK_Z + 3.8))
    raw.rope(c, (ax, ab, HOOK_Z + 7.4), (ax + 3.6, ab + 2.6, HOOK_Z + 3.8))
    # its shadow on the cut face behind it, then the block in a rope sling
    c.add(c.on(c.m_bface(TERRACES[0][3]), f'<rect x="{f(ax - 1.5)}" y="{f(HOOK_Z + 0.5)}" width="9" height="4.6" fill="{iso.INK}" opacity="0.3" filter="{c.blur(0.8)}"/>'))
    ba, bb_, hz = ax, ab + 2.6, HOOK_Z
    sil = iso.hull([c.P(ba + sa * 4, bb_ + sb * 3, hz + z) for sa in (-1, 1) for sb in (-1, 1) for z in (0, 3.8)])
    c.add(f'<path d="{iso.poly(sil)}" fill="none" stroke="#5a4a32" stroke-width="0.9" stroke-linejoin="round" opacity="0.7"/>')
    raw.stone_block(c, ba, bb_, 4, 3, 3.8, z0=hz, seed=31, shadow=False)
    for da in (-2.2, 2.2):
        x0, y0 = c.P(ax + da, ab + 5.6, HOOK_Z + 3.8)
        x1, y1 = c.P(ax + da, ab + 5.6, HOOK_Z)
        c.add(f'<path d="M{f(x0)},{f(y0)} L{f(x1)},{f(y1)}" stroke="#6e5638" stroke-width="0.6"/>')
    raw.timber(c, FEET[1], APEX, w=2.3, col=WOOD["dark"], lit=WOOD["base"])
    raw.timber(c, FEET[0], APEX, w=2.4)
    raw.timber(c, (-1.9, 3.3, 10), (8.4, 3.3, 10), w=1.2)
    x, y = c.P(ax, ab, az)
    c.add(f'<circle cx="{f(x)}" cy="{f(y)}" r="1.5" fill="{WOOD["dark"]}"/><circle cx="{f(x - 0.4)}" cy="{f(y - 0.4)}" r="0.6" fill="{WOOD["lit"]}"/>')
    raw.pennant(c, x, y - 0.8, length=10, height=4.6, pole=8)
    # hoisting rope down to the treadwheel's axle, back stay to a stake in front
    wa, wb, wz, wr = WHEEL
    raw.rope(c, APEX, (wa - 0.5, wb - 3, wz + 1), sag=1.5)
    # the treadwheel on its trestles
    iso.cast_shadow(c, [(wa - wr, wb - 3), (wa + wr, wb - 3), (wa + wr, wb + 3), (wa - wr, wb + 3)],
                    [(wa - wr * 0.7, wb, wz + wr * 0.7), (wa + wr * 0.7, wb, wz + wr * 0.7), (wa, wb, wz + wr)], opacity=0.3, sd=1.6)
    for bb in (wb - 4.4,):
        raw.timber(c, (wa - 6.5, bb, 0), (wa, bb, wz + 0.6), w=1.4, col=WOOD["dark"], lit=WOOD["base"])
        raw.timber(c, (wa + 6.5, bb, 0), (wa, bb, wz + 0.6), w=1.4, col=WOOD["dark"], lit=WOOD["base"])
    raw.treadwheel_b(c, wa, wb, wz, wr, width=5)
    for bb in (wb + 4.4,):
        iso.blob_shadow(c, wa + 2, bb, 6, 0.3)
        raw.timber(c, (wa - 6.5, bb, 0), (wa, bb, wz + 0.6), w=1.5)
        raw.timber(c, (wa + 6.5, bb, 0), (wa, bb, wz + 0.6), w=1.5)


def shed(c):
    """Small plank tool shed with a tile roof and a painted door (ACCENT)."""
    R, T = 6, 3
    AV, BV = SA + 2.4, SB + 3
    tanp = R / SB
    zr = SH + R + T
    ze = zr - BV * tanp
    iso.cast_shadow(c, [(sa * (SA + 1), sb * (SB + 1)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * AV, sb * BV, ze) for sa in (-1, 1) for sb in (-1, 1)] + [(sa * AV, 0, zr) for sa in (-1, 1)], opacity=0.42)
    iso.contact_ao(c, -SA - 1, SA + 1, -SB - 1, SB + 1)
    lp.plank_wall_b(c, SB, -SA, SA, 0, SH, name="shb", top="#9a7650", bottom="#7a5a3a", pitch=2.6)
    lp.plank_wall_a(c, SA, -SB, SB, 0, SH, name="sha", top="#6e5038", bottom="#54402c", pitch=2.6)
    c.add(c.on(c.m_aface(SA), f'<path d="M{-SB},{SH} L{SB},{SH} L0,{SH + R}Z" fill="#5e4430"/>'))
    for xx in (-SA, SA):
        c.add(c.on(c.m_bface(SB), f'<rect x="{f(xx - 0.7)}" y="0" width="1.4" height="{SH}" fill="{WOOD["dark"]}"/>'))
    iso.door_b(c, SB, -7, 2, 0, 16, frame="#8a6a44", accent=True)
    x, y = c.P(6, SB + 1.2, 0)
    raw.pickaxe(c, x, y, k=0.75)
    iso.foot_tufts(c, [((-SA - 1, SB + 1), (-5, SB + 1)), ((SA + 1, SB + 1), (SA + 1, -SB - 1))], n=6, seed=12, kind="dry", stones=1)
    iso.tile_roof_a(c, AV, BV, zr, tanp, T=T, n=8, courses=3, seed=12)


def rollers(c, a, b):
    """A dressed block resting on wooden rollers, ready to be moved off the quarry floor."""
    iso.blob_shadow(c, a + 3, b, 7, 0.32)
    for aa in (a - 4, a + 3):
        raw.log_b(c, aa, 1.2, b - 5, b + 4.6, 1.2, seed=int(aa))
    raw.stone_block(c, a, b, 6, 3.6, 4.2, z0=2.4, seed=17, shadow=False)


def build():
    c = iso.Canvas("quarry")
    iso.ground(c)
    iso.ground_ao(c, [(-48, -46), (6, -46), (26, -30), (32, -6), (44, 24), (24, 40), (-30, 30), (-50, 0)], grow=5, opacity=0.12)

    outcrop(c)
    crane(c)
    with c.at(*SHED):
        shed(c)
    raw.stone_block(c, -16, 22, 5, 3.6, 4.2, seed=11)
    raw.stone_block(c, -16.5, 22, 4.4, 3.2, 3.8, z0=4.2, seed=12, shadow=False)
    raw.stone_block(c, -6, 26, 4.4, 3.2, 3.8, seed=13)
    rollers(c, 6, 36)
    tarp_stack(c, *STACK)
    raw.rubble(c, [(14, 44, 1.4, 71), (-26, 40, 1.2, 72), (44, 12, 1.5, 73), (-8, 12, 1.2, 74)], pal=raw.PALE_ROCK)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
