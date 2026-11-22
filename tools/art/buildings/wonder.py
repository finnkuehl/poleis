"""wonder - the Colossus, standing directly on the map (grounded, docs/ART.md; the game paints a
paved plaza around it): a gilded hoplite five times a man's height raising a torch, on a tall
marble pedestal with gilded bands and owner drapes, on a broad three-stepped podium with bronze
braziers burning at its corners, framed by two cypresses. Two visitors at the foot of the steps
show its size. The most monumental piece of all - it towers far over the temple.
Accent (owner colour): the colossus' cloak, crest and shield, and the drapes on the pedestal."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import units_lib as U  # noqa: E402
from iso import GOLD, MARBLE, f  # noqa: E402

# world units; keep everything inside iso.GROUND_R = 58. Human scale: person ~14.
TOP = 29            # podium top step half extent
STEP_W, STEP_H = 3.6, 3.4
N_STEPS = 3
PB = 17             # pedestal foot block half extent
PED = 14            # pedestal die half extent
FIG_H = 86          # colossus height, feet to helmet top (canvas-local units; ~70 world = 5 men)


def pedestal(c, zst):
    """Two-tier marble pedestal: foot block, a tall die with gilded bands, owner drapes and a gold
    plaque, a moulded crown. Returns its top height."""
    z1 = zst + 4
    iso.contact_ao(c, -PB - 1, PB + 1, -PB - 1, PB + 1, z=zst, width=3, opacity=0.35)
    iso.box(c, -PB, PB, -PB, PB, zst, z1, MARBLE["top"], MARBLE["left"], MARBLE["right"], edge="#fff")
    z2 = z1 + 14.5
    iso.contact_ao(c, -PED, PED, -PED, PED, z=z1, width=2.4, opacity=0.3)
    iso.box(c, -PED, PED, -PED, PED, z1, z2, MARBLE["top"], MARBLE["left"], MARBLE["right"])
    for zz, h in ((z1 + 1.2, 1.4), (z2 - 3.2, 1.6)):
        c.add(c.on(c.m_bface(PED), f'<rect x="{-PED}" y="{f(zz)}" width="{2 * PED}" height="{f(h)}" fill="{GOLD["base"]}"/><rect x="{-PED}" y="{f(zz + h - 0.4)}" width="{2 * PED}" height="0.4" fill="{GOLD["hi"]}"/>'))
        c.add(c.on(c.m_aface(PED), f'<rect x="{-PED}" y="{f(zz)}" width="{2 * PED}" height="{f(h)}" fill="{GOLD["shade"]}"/>'))
    for x0 in (-12, 5):
        iso.drape_b(c, PED, x0, x0 + 7, z2 - 3.4, 10)
        iso.drape_a(c, PED, x0, x0 + 7, z2 - 3.4, 10)
    # gilded inscription plaque between the drapes
    c.add(c.on(c.m_bface(PED), f'<rect x="-3.4" y="{f(z1 + 3.6)}" width="6.8" height="6" fill="{GOLD["mid"]}"/><rect x="-3.4" y="{f(z1 + 9)}" width="6.8" height="0.6" fill="{GOLD["hi"]}"/>'
               + "".join(f'<rect x="-2.6" y="{f(z1 + 4.8 + i * 1.3)}" width="5.2" height="0.35" fill="{GOLD["dark"]}" opacity="0.7"/>' for i in range(3))))
    z3 = z2 + 2.6
    iso.box(c, -PED - 1.4, PED + 1.4, -PED - 1.4, PED + 1.4, z2, z3, MARBLE["top"], "#f3eee2", "#c6c8c5", edge="#fff")
    c.add(c.on(c.m_bface(PED + 1.4), f'<rect x="{-PED - 1.4}" y="{f(z2)}" width="{2 * PED + 2.8}" height="0.7" fill="#8f8a7f" opacity="0.6"/>'))
    return z3


def visitor(c, a, b, tunic, seed, hold=None, beard=True):
    """A visitor at human scale (~14 world units) - shows how colossal the statue is."""
    x, y = c.P(a, b, 0)
    c.add(f'<ellipse cx="{f(x + 3)}" cy="{f(y + 0.4)}" rx="5" ry="1.6" fill="{iso.INK}" opacity="0.3" filter="{c.blur(0.6)}"/>')
    U.person(c, x, y, h=14 * iso.ZS, tunic=tunic, hem=-24, beard=beard, hold=hold, seed=seed)


def build():
    c = iso.Canvas("wonder")
    iso.ground(c)
    bottom = TOP + (N_STEPS - 1) * STEP_W
    iso.ground_ao(c, [(sa * bottom, sb * bottom) for sa in (-1, 1) for sb in (-1, 1)], grow=8, opacity=0.18)

    # cypresses behind the podium
    iso.cypress(c, -47, -16, h=58, seed=3)
    iso.cypress(c, -16, -50, h=52, seed=4)

    zst = N_STEPS * STEP_H
    ztop = zst + 4 + 14.5 + 2.6
    # cast shadow: podium + pedestal + the figure (approximated by a tall thin column)
    iso.cast_shadow(c, [(sa * (bottom + 0.5), sb * (bottom + 0.5)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * PB, sb * PB, ztop) for sa in (-1, 1) for sb in (-1, 1)] + [(0, 0, ztop + 66), (-6, 6, ztop + 58)], opacity=0.46)
    iso.contact_ao(c, -bottom, bottom, -bottom, bottom, opacity=0.5)
    iso.foot_tufts(c, [((-bottom, bottom), (-8, bottom)), ((8, bottom), (bottom, bottom)), ((bottom, bottom), (bottom, -bottom))],
                   n=8, seed=6, hmax=3.2, kind="weeds", stones=3)
    iso.marble_steps(c, TOP, TOP, N_STEPS, STEP_W, STEP_H)
    k = TOP - 4
    iso.brazier(c, -k, -k, zst, 1.15)
    pedestal(c, zst)
    iso.brazier(c, -k, k, zst, 1.15)
    iso.brazier(c, k, -k, zst, 1.15)

    # the colossus
    x, y = c.P(0, 0, ztop)
    c.add(f'<ellipse cx="{f(x + 1)}" cy="{f(y + 0.5)}" rx="12" ry="3.8" fill="#3e3a32" opacity="0.35" filter="{c.blur(0.8)}"/>')
    iso.figure(c, x, y, FIG_H, metal=GOLD, pose="torch", accent_parts=("crest", "shield", "cloak"))
    iso.brazier(c, k, k, zst, 1.15)
    # visitors at the foot of the steps
    visitor(c, -14, bottom + 6, U.LINEN, 1, hold="staff")
    visitor(c, 10, bottom + 8, U.WOOL, 2, beard=False)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
