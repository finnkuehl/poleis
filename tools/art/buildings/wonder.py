"""wonder - the Colossus: a gilded hoplite with a raised torch on a stepped marble podium,
framed by cypresses, with bronze braziers burning at the corners.
Accent (owner colour): base rim band, the colossus' cloak, crest and shield, and the drapes
hanging on the pedestal."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
from iso import GOLD, f  # noqa: E402

TOP = 26            # podium top step half extent
STEP_W, STEP_H = 3.4, 3.6
PED = 14            # pedestal half extent
PED_H = 20          # pedestal height
FIG_H = 84          # colossus height (feet to helmet top, canvas-local units)


def build():
    c = iso.Canvas("wonder")
    bottom = TOP + 2 * STEP_W
    iso.base(c, seed=41, avoid=lambda a, b: -bottom - 2 < a < bottom + 2 and -bottom - 2 < b < bottom + 2)

    # cypresses behind the podium
    iso.cypress(c, -47, -14, h=58, seed=3)
    iso.cypress(c, -12, -50, h=50, seed=4)

    zst = 3 * STEP_H
    ztop = zst + PED_H
    # cast shadow: podium + pedestal + the figure (approximated by a tall thin column)
    iso.cast_shadow(c, [(sa * (bottom + 0.5), sb * (bottom + 0.5)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * PED, sb * PED, ztop) for sa in (-1, 1) for sb in (-1, 1)] + [(0, 0, ztop + 70), (-6, 6, ztop + 60)], opacity=0.45)
    iso.contact_ao(c, -bottom, bottom, -bottom, bottom, opacity=0.5)
    iso.base_tufts(c, [((-bottom, bottom), (bottom, bottom)), ((bottom, bottom), (bottom, -bottom))], n=14, seed=6, hmax=3.4)
    iso.marble_steps(c, TOP, TOP, 3, STEP_W, STEP_H)

    # pedestal with a gilded band and owner drapes
    iso.contact_ao(c, -PED - 1, PED + 1, -PED - 1, PED + 1, z=zst, width=3, opacity=0.35)
    iso.pedestal(c, 0, 0, PED, PED, PED_H, top_z=zst, inscription=False)
    c.add(c.on(c.m_bface(PED), f'<rect x="{-PED}" y="{f(ztop - 5.4)}" width="{2 * PED}" height="1.6" fill="{GOLD["base"]}"/><rect x="{-PED}" y="{f(ztop - 4.2)}" width="{2 * PED}" height="0.4" fill="{GOLD["hi"]}"/>'))
    c.add(c.on(c.m_aface(PED), f'<rect x="{-PED}" y="{f(ztop - 5.4)}" width="{2 * PED}" height="1.6" fill="{GOLD["shade"]}"/>'))
    for x0 in (-11, 4):
        iso.drape_b(c, PED, x0, x0 + 7, ztop - 6, 11)
    for x0 in (-11, 4):
        iso.drape_a(c, PED, x0, x0 + 7, ztop - 6, 11)
    # gilded inscription plaque between the drapes
    c.add(c.on(c.m_bface(PED), f'<rect x="-3" y="{f(zst + 4)}" width="6" height="5" fill="{GOLD["mid"]}"/><rect x="-3" y="{f(zst + 8.4)}" width="6" height="0.6" fill="{GOLD["hi"]}"/>'
               + "".join(f'<rect x="-2.2" y="{f(zst + 5 + i * 1.2)}" width="4.4" height="0.35" fill="{GOLD["dark"]}" opacity="0.7"/>' for i in range(3))))

    # the colossus
    x, y = c.P(0, 0, ztop)
    c.add(f'<ellipse cx="{f(x + 1)}" cy="{f(y + 0.5)}" rx="11" ry="3.6" fill="#3e3a32" opacity="0.35" filter="{c.blur(0.8)}"/>')
    iso.figure(c, x, y, FIG_H, metal=iso.GOLD, pose="torch", accent_parts=("crest", "shield", "cloak"))
    iso.brazier(c, -21, 21, zst, 1.0)
    iso.brazier(c, 21, -21, zst, 1.0)
    iso.brazier(c, 21, 21, zst, 1.0)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
