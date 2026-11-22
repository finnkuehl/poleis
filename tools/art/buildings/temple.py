"""temple - Doric marble temple on a stepped stylobate, standing directly on the map (grounded,
docs/ART.md; the game paints a paved plaza around it): an altar with an offering fire and
garlands, a cypress, two bronze tripods flanking the steps.
Accent (owner colour): the painted tympanum of the pediment, the painted metopes of the frieze
and the cloth draped over the altar."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
from iso import f, poly  # noqa: E402

STEP_W, STEP_H = 3.2, 3.4
# shared human scale (README "Scale"): 59 x 77 at the bottom step, 73 high, door 9 x 16; a
# little smaller than the city centre, the city's heart
SA, SB = 23, 32                 # stylobate (top step) half extents
CA, CB = 18.5, 27.5             # column axis lines
RB, RT = 3.0, 2.5               # column radius bottom / top
EA, EB = 22.5, 31.5             # entablature faces
KA, KB = 24, 33                 # cornice faces
PR = 11                         # pediment rise (steeper than real so it reads in 2:1)
CELLA = (-12, 12, -22, 15.2)    # a0, a1, b0, b1 (deep pronaos: the door shows between columns)


def cella(c, zst, zab):
    a0, a1, b0, b1 = CELLA
    cf = c.lin("cf", 0, zst, 0, zab, [(0, "#9c978c"), (0.6, "#7f7b74"), (1, "#5c5a57")])
    g = [f'<rect x="{a0}" y="{f(zst)}" width="{a1 - a0}" height="{f(zab - zst)}" fill="{cf}"/>']
    for i in range(1, 9):
        g.append(f'<rect x="{a0}" y="{f(zst + i * (zab - zst) / 9)}" width="{a1 - a0}" height="0.35" fill="#7f7b72" opacity="0.4"/>')
    dx0, dx1, dy1 = -4.5, 4.5, zst + 16      # door 9 x 16, like every door (README "Scale")
    glow = c.rad("glow", 0, zst + 6, 9, [(0, "#f0b25a", 0.75), (0.55, "#8a4f20", 0.4), (1, "#1a120c", 0)])
    statue = ('<rect x="-2.2" y="0" width="4.4" height="2.2" fill="#6e6458"/>'
              '<path d="M-1.5,2.2 L1.5,2.2 L1.1,12 Q2.1,13.2 1.1,15 L0,16.4 L-1.1,15 Q-2.1,13.2 -1.1,12Z" fill="#c48b3e"/>'
              '<path d="M-1.5,2.2 L-0.2,2.2 L-0.2,16.2 L-1.1,15 Q-2.1,13.2 -1.1,12Z" fill="#f0c878"/>'
              '<circle cx="0" cy="17.6" r="1.25" fill="#e0ad5f"/><circle cx="-0.4" cy="17.9" r="0.5" fill="#fff0c4"/>'
              '<path d="M2.2,9 L2.6,21" stroke="#d9a35a" stroke-width="0.5"/>')
    g.append(f'<rect x="{dx0 - 1.2}" y="{f(zst)}" width="{dx1 - dx0 + 2.4}" height="{f(dy1 - zst + 1.6)}" fill="#a39e92"/>'
             f'<rect x="{dx0}" y="{f(zst)}" width="{dx1 - dx0}" height="{f(dy1 - zst)}" fill="#17110d"/>'
             f'<rect x="{dx0}" y="{f(zst)}" width="{dx1 - dx0}" height="{f(dy1 - zst)}" fill="{glow}"/>'
             # gilded cult statue on a low base, deep inside the cella
             f'<g transform="translate(0 {f(zst)}) scale(0.62)">{statue}</g>'
             f'<path d="{poly([(dx0, zst), (dx0 + 2, zst + 1.2), (dx0 + 2, dy1 - 0.8), (dx0, dy1)])}" fill="#8a5a2a"/>'
             f'<path d="{poly([(dx1, zst), (dx1 - 2, zst + 1.2), (dx1 - 2, dy1 - 0.8), (dx1, dy1)])}" fill="#5e3b1c"/>')
    cao = c.lin("cao", 0, zab - 8, 0, zab, [(0, "#3b3a37", 0), (1, "#3b3a37", 0.45)])
    g.append(f'<rect x="{a0}" y="{f(zab - 8)}" width="{a1 - a0}" height="8" fill="{cao}"/>')
    c.add(c.on(c.m_bface(b1), "".join(g)))
    cr = c.lin("cr", 0, zst, 0, zab, [(0, "#7f8180"), (1, "#5a5d62")])
    g = [f'<rect x="{-b1}" y="{f(zst)}" width="{b1 - b0}" height="{f(zab - zst)}" fill="{cr}"/>']
    for i in range(1, 9):
        g.append(f'<rect x="{-b1}" y="{f(zst + i * (zab - zst) / 9)}" width="{b1 - b0}" height="0.35" fill="#5f625f" opacity="0.4"/>')
    g.append(f'<rect x="{-b1}" y="{f(zst)}" width="0.6" height="{f(zab - zst)}" fill="#d6d3ca" opacity="0.5"/>')
    c.add(c.on(c.m_aface(a1), "".join(g)))


def altar(c, a, b):
    """Marble altar with an owner-colour cloth draped over its front, a garland and the fire."""
    ha, hb, hz = 5.2, 3.4, 6.0
    iso.cast_shadow(c, [(a - ha, b - hb), (a + ha, b - hb), (a + ha, b + hb), (a - ha, b + hb)], [(a + sa * ha, b + sb * hb, hz) for sa in (-1, 1) for sb in (-1, 1)], opacity=0.4, sd=1.2)
    iso.contact_ao(c, a - ha, a + ha, b - hb, b + hb, width=2.2, opacity=0.35)
    iso.box(c, a - ha - 0.6, a + ha + 0.6, b - hb - 0.6, b + hb + 0.6, 0, 1.2, iso.MARBLE["top"], "#e6e0d2", "#b9bbb8")
    iso.box(c, a - ha, a + ha, b - hb, b + hb, 1.2, hz - 1, iso.MARBLE["top"], "#ece6d8", "#bcbebb")
    iso.box(c, a - ha - 0.7, a + ha + 0.7, b - hb - 0.7, b + hb + 0.7, hz - 1, hz, iso.MARBLE["top"], "#f3eee2", "#c6c8c5", edge="#fff")
    iso.drape_b(c, b + hb + 0.75, a - ha + 0.8, a + ha - 0.8, hz - 1.1, 4.2, tails=True)
    x, y = c.P(a, b, hz)
    c.add(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="4.6" ry="2.1" fill="#3a2a22"/>')
    iso.fire(c, x, y, 1.1)


def build():
    c = iso.Canvas("temple")
    sa0, sb0 = SA + 2 * STEP_W, SB + 2 * STEP_W
    iso.ground(c)
    iso.ground_ao(c, [(-sa0, -sb0), (sa0, -sb0), (sa0, sb0), (-sa0, sb0)], grow=8, opacity=0.18)
    iso.cypress(c, -44, 20, h=48)

    zst = 3 * STEP_H
    zsh = zst + 33.5
    zab = zsh + 3.5
    zco = zab + 13.2
    zeav = zco + 1.8
    iso.cast_shadow(c, [(sa * (sa0 + 0.5), sb * (sb0 + 0.5)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * KA, sb * KB, zeav) for sa in (-1, 1) for sb in (-1, 1)] + [(0, sb * KB, zeav + PR) for sb in (-1, 1)], opacity=0.5)
    iso.contact_ao(c, -sa0, sa0, -sb0, sb0, opacity=0.5)

    iso.marble_steps(c, SA, SB, 3, STEP_W, STEP_H)
    # roof shadow across the right half of the steps
    c.add(f'<path d="{poly([c.P(SA - 1, -SB - 4, zst), c.P(SA + 2 * STEP_W + 3, -SB - 4, 0), c.P(SA + 2 * STEP_W + 3, SB + 2 * STEP_W + 1, 0), c.P(SA - 1, SB + 2 * STEP_W, zst)])}" fill="#3a4250" opacity="0.18" filter="{c.blur(0.8)}"/>')
    iso.foot_tufts(c, [((-sa0, sb0), (-8, sb0)), ((8, sb0), (sa0, sb0)), ((sa0, sb0), (sa0, -sb0))], n=8, seed=4, hmax=3.2, kind="weeds", stones=3)

    # peristyle floor under the roof (shaded)
    c.add(f'<path d="{poly([c.P(-CA, CB, zst), c.P(CA, CB, zst), c.P(CA, -CB, zst), c.P(-CA, -CB, zst)])}" fill="#a9a497"/>')
    c.add(f'<path d="{poly([c.P(-CA, CB, zst), c.P(CA, CB, zst), c.P(CA, -CB, zst), c.P(CA - 3, -CB, zst), c.P(CA - 3, CB - 3, zst), c.P(-CA, CB - 3, zst)])}" fill="#d8d3c6" opacity="0.6" filter="{c.blur(0.8)}"/>')
    a0, a1, b0, b1 = CELLA
    c.add(f'<path d="{poly([c.P(a0 - 2, b1 + 4, zst), c.P(a1 + 4, b1 + 4, zst), c.P(a1 + 4, b0 - 2, zst), c.P(a1, b0, zst), c.P(a1, b1, zst), c.P(a0, b1, zst)])}" fill="#5c5a52" opacity="0.35" filter="{c.blur(1.6)}"/>')

    bs = [CB - i * (2 * CB / 5) for i in range(6)]
    as_ = [-CA + i * (2 * CA / 3) for i in range(4)]
    front = [(aa, CB) for aa in as_] + [(CA, bb) for bb in bs[1:]]
    back = sorted({(-CA, bb) for bb in bs} | {(aa, -CB) for aa in as_[1:]}, key=lambda p: p[0] + p[1])
    for aa, bb in back:
        if (aa, bb) not in front:
            iso.doric_column(c, aa, bb, zst, zsh, RB, RT, dark=True)
    cella(c, zst, zab)
    for aa, bb in front:
        iso.column_shadow(c, aa, bb, zst, RB)
    for aa, bb in sorted(front, key=lambda p: p[0] + p[1]):
        iso.doric_column(c, aa, bb, zst, zsh, RB, RT)

    iso.entablature(c, EA, EB, zab, KA, KB, metope_accent=True)
    iso.tile_roof_b(c, KA, KB, zeav, PR)
    iso.pediment_b(c, KA, KB, zco, PR)
    iso.brazier(c, -sa0 + 1, sb0 + 3, k=1.1)
    iso.brazier(c, sa0 - 1, sb0 + 3, k=1.1)
    altar(c, 0, sb0 + 8)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
