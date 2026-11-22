"""quarry - a pale limestone hill cut into terraces of block faces, with a timber shear-leg
crane lifting a block, a winch, a hand cart loaded with a block and a stack of dressed stone
under a canvas tarp.
Accent (owner colour): base rim band, the canvas tarp and the pennant on the crane."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_raw as raw  # noqa: E402
from iso import ACCENT, f  # noqa: E402

# terraces (a0, a1, b0, b1, z0, z1) cut into the front of the hill, stepping down to the front
TERRACES = [(-40, 16, -30, 2, 0, 12), (-40, 4, -30, -10, 12, 25), (-40, -8, -30, -21, 25, 38)]
APEX = (30, 6, 47)              # crane apex (the A-frame stands parallel to the screen)
FEET = [(33, -13, 0), (11, 9, 0)]   # far (right) foot, near (left) foot
CART = (30, 9)


def tarp_stack(c, a, b):
    """Three dressed blocks under a canvas tarp (ACCENT) tied down with ropes."""
    raw.stone_block(c, a, b, 8, 6, 6, seed=21)
    raw.stone_block(c, a - 1, b - 0.5, 7, 5.5, 5.5, z0=6, seed=22, shadow=False)
    ha, hb, zt = 7.6, 6.1, 11.5
    a0, a1, b0, b1 = a - 1 - ha, a - 1 + ha, b - 0.5 - hb, b - 0.5 + hb
    drop = 4.2
    # the cloth: top, front skirt with a wavy hem, right skirt
    top = f'<rect x="{f(a0 - 0.4)}" y="{f(b0 - 0.4)}" width="{f(a1 - a0 + 0.8)}" height="{f(b1 - b0 + 0.8)}" fill="{ACCENT["lit"]}"/>'
    hem = " ".join(f"Q{f(a0 + (i + 0.5) * (a1 - a0) / 4)},{f(zt - drop - 1.4 * (i % 2 * 2 - 1))} {f(a0 + (i + 1) * (a1 - a0) / 4)},{f(zt - drop)}" for i in range(4))
    front = f'<path d="M{f(a0 - 0.4)},{f(zt + 0.1)} L{f(a1 + 0.4)},{f(zt + 0.1)} L{f(a1 + 0.4)},{f(zt - drop)} L{f(a0 - 0.4)},{f(zt - drop)}Z" fill="{ACCENT["light"]}"/>'
    front_hem = f'<path d="M{f(a0 - 0.4)},{f(zt - drop)} {hem} L{f(a1 + 0.4)},{f(zt - drop + 0.6)} L{f(a0 - 0.4)},{f(zt - drop + 0.6)}Z" fill="{ACCENT["light"]}"/>'
    hem_r = " ".join(f"Q{f(-b1 + (i + 0.5) * (b1 - b0) / 3)},{f(zt - drop - 1.2 * (i % 2 * 2 - 1))} {f(-b1 + (i + 1) * (b1 - b0) / 3)},{f(zt - drop)}" for i in range(3))
    right = (f'<path d="M{f(-b1 - 0.4)},{f(zt + 0.1)} L{f(-b0 + 0.4)},{f(zt + 0.1)} L{f(-b0 + 0.4)},{f(zt - drop)} L{f(-b1 - 0.4)},{f(zt - drop)}Z" fill="{ACCENT["shade"]}"/>'
             f'<path d="M{f(-b1 - 0.4)},{f(zt - drop)} {hem_r} L{f(-b0 + 0.4)},{f(zt - drop + 0.6)} L{f(-b1 - 0.4)},{f(zt - drop + 0.6)}Z" fill="{ACCENT["shade"]}"/>')
    c.accent(c.on(c.m_ground(zt), top))
    c.accent(c.on(c.m_bface(b1 + 0.4), front + front_hem))
    c.accent(c.on(c.m_aface(a1 + 0.4), right))
    # art on top of the cloth: soft folds, tie-down ropes, shadow under the hem
    folds = c.lin("tarpfold", 0, 0, 1, 0, [(0, "#ffffff", 0.0), (0.3, "#1d2b36", 0.12), (0.5, "#ffffff", 0.0), (0.75, "#1d2b36", 0.12), (1, "#ffffff", 0)], bbox=True)
    c.add(c.on(c.m_bface(b1 + 0.4), f'<rect x="{f(a0)}" y="{f(zt - drop - 1)}" width="{f(a1 - a0)}" height="{f(drop + 1)}" fill="{folds}"/>'
               f'<path d="M{f(a0 + 4)},{f(zt)} L{f(a0 + 4)},{f(zt - drop - 1.6)} M{f(a1 - 4)},{f(zt)} L{f(a1 - 4)},{f(zt - drop - 1.6)}" stroke="#6e5638" stroke-width="0.6"/>'))
    c.add(c.on(c.m_ground(zt), f'<path d="M{f(a0 + 4)},{f(b0)} L{f(a0 + 4)},{f(b1)} M{f(a1 - 4)},{f(b0)} L{f(a1 - 4)},{f(b1)}" stroke="#6e5638" stroke-width="0.6"/>'
               f'<rect x="{f(a0)}" y="{f(b0)}" width="{f(a1 - a0)}" height="{f(b1 - b0)}" fill="url(#{c.id("tarptop")})"/>'))
    c.rad("tarptop", 0.3, 0.3, 0.8, [(0, "#ffffff", 0.12), (1, "#1d2b36", 0.1)], bbox=True)
    c.add(c.on(c.m_bface(b1 + 0.6), f'<rect x="{f(a0)}" y="{f(zt - drop - 2.2)}" width="{f(a1 - a0)}" height="1.4" fill="#3b3426" opacity="0.25" filter="{c.blur(0.45)}"/>'))


def winch(c, a, b):
    """Wooden windlass: two posts and a drum along b, with a crank handle."""
    W = iso.WOOD
    iso.blob_shadow(c, a + 3, b, 6, 0.3)
    for bb in (b - 4.5, b + 4.5):
        iso.box(c, a - 1, a + 1, bb - 1, bb + 1, 0, 8, W["lit"], W["base"], W["dark"])
    raw.log_b(c, a, 6.4, b - 4, b + 4, 1.9, seed=4)
    x, y = c.P(a, b + 5.6, 6.4)
    c.add(f'<path d="M{f(x)},{f(y)} l-3.4,1.6 l0,3" fill="none" stroke="{raw.IRON["dark"]}" stroke-width="0.9" stroke-linecap="round"/>')


def crane(c, part):
    """Shear-leg crane: part 'back' = far leg and ropes, 'front' = near leg, block and pennant."""
    ax, ab, az = APEX
    if part == "back":
        raw.rope(c, APEX, (-6, -34, 52), sag=3)                       # back-stay to the hill top
        raw.timber(c, FEET[0], APEX, w=2.4, col=iso.WOOD["dark"], lit=iso.WOOD["base"])
        return
    raw.timber(c, (16.5, 3.5, 12), (30.5, -10.5, 12), w=1.3)              # cross brace
    raw.timber(c, FEET[1], APEX, w=2.6)
    # hoisting rope, sling and the block hanging above the cart
    zb = 15
    raw.rope(c, APEX, (ax, ab, zb + 8.5))
    raw.rope(c, (ax, ab, zb + 8.5), (ax - 4.2, ab + 3, zb + 4.2))
    raw.rope(c, (ax, ab, zb + 8.5), (ax + 4.2, ab + 3, zb + 4.2))
    raw.stone_block(c, ax, ab + 3, 4.6, 3.6, 4.2, z0=zb, seed=31, shadow=False)
    raw.rope(c, APEX, (FEET[1][0] + 1.5, FEET[1][1] - 0.5, 7), sag=2)    # haul rope to the winch
    x, y = c.P(ax, ab, az)
    c.add(f'<circle cx="{f(x)}" cy="{f(y)}" r="1.9" fill="{iso.WOOD["dark"]}"/><circle cx="{f(x - 0.5)}" cy="{f(y - 0.5)}" r="0.8" fill="{iso.WOOD["lit"]}"/>')
    raw.pennant(c, x, y - 1, length=11, height=5, pole=9)


def build():
    c = iso.Canvas("quarry")
    iso.base(c, seed=29, avoid=lambda a, b: a < 20 and b < 6 and a > -52 and b > -52, tufts=70, flowers=12)
    # pale stone dust over the work yard
    raw.ground_patch(c, 2, 16, 32, 24, "#e9dfc6", 0.7, seed=5, blur=2.2)

    # the natural hill: weathered rock rising behind the cut
    W = raw.WEATHERED
    raw.boulder(c, 12, -40, 16, 14, 30, seed=42, pal=W, n=18)
    raw.boulder(c, -22, -40, 30, 22, 58, seed=41, pal=W, n=22)
    raw.boulder(c, -46, -30, 14, 16, 40, seed=43, pal=W, n=16)
    a0, a1, b0, b1, z0, z1 = TERRACES[0]
    iso.cast_shadow(c, [(a0, b0), (a1, b0), (a1, b1), (a0, b1)],
                    [(a1, b0, 12), (a1, b1, 12), (4, -10, 25), (-8, -21, 38), (-8, -30, 38), (4, -30, 25)], opacity=0.45)
    iso.contact_ao(c, a0, a1, b0, b1)
    for i, t in enumerate(TERRACES):
        if i:
            iso.contact_ao(c, t[0], t[1], t[2], t[3], z=t[4], width=3.5, opacity=0.3)   # foot of the next cut
        raw.terrace(c, *t, seed=3 + i * 5, notches=1 if i < 2 else 0)
        if i == 0:
            # a block half cut free on the lowest terrace
            raw.stone_block(c, -24, -4, 6, 4, 4.5, z0=12, seed=8, shadow=False)
            c.add(c.on(c.m_ground(12), '<rect x="-30.6" y="-8.6" width="13.2" height="9.2" fill="none" stroke="#7d6c52" stroke-width="0.8" opacity="0.5"/>'))
        if i == 1:
            with c.at(0, 0, 25):
                raw.rubble(c, [(-30, -14, 2, 61), (-22, -13, 1.5, 62)], pal=raw.PALE_ROCK)
    iso.base_tufts(c, [((-40, 2), (16, 2)), ((16, 2), (16, -30))], n=12, seed=7, hmax=3.4)
    # chips and spalls at the foot of each cut face
    raw.rubble(c, [(-34, 5, 1.6, 63), (-12, 4.5, 1.2, 64), (9, 5, 1.5, 65), (19, -6, 1.3, 66), (19, -20, 1.6, 67)], pal=raw.PALE_ROCK)
    with c.at(0, 0, 12):
        raw.rubble(c, [(-8, -8, 1.3, 68), (7, -14, 1.5, 69), (-36, -8, 1.2, 70)], pal=raw.PALE_ROCK)
    # flanks of the hill in front of the terrace ends
    raw.boulder(c, 24, -24, 10, 12, 24, seed=44, pal=W, n=16)
    raw.boulder(c, -50, -6, 9, 14, 24, seed=45, pal=W, n=16)
    raw.boulder(c, -44, 6, 5, 5, 8, seed=46, pal=W, n=10)
    # a wild olive bush on the hill top
    with c.at(-26, -42, 50):
        iso.olive_tree(c, 0, 0, size=0.45, seed=6)

    crane(c, "back")
    tarp_stack(c, -32, 26)
    raw.stone_block(c, 4, 22, 6, 4.5, 5, seed=11)
    raw.stone_block(c, -8, 32, 4, 3.5, 3.5, seed=12)
    raw.cart_a(c, CART[0] - 6, CART[1] + 3, load=lambda c_, z: raw.stone_block(c_, -1, 0, 4.6, 3.4, 3.8, z0=z, seed=13, shadow=False))
    crane(c, "front")
    winch(c, 6, 13)
    raw.rubble(c, [(14, 36, 1.8, 71), (-18, 42, 1.4, 72), (44, 22, 2, 73), (-14, 10, 1.6, 74)], pal=raw.PALE_ROCK)
    iso.rocks(c, [(54, -4, 2.4, 81), (40, 40, 1.8, 82)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
