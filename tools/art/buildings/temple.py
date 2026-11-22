"""temple - Doric marble temple on a stepped stylobate, altar fire and a cypress.
Accent (owner colour): base rim band + painted tympanum of the pediment."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
from iso import f, poly  # noqa: E402

STEP_W, STEP_H = 3.2, 3.4
SA, SB = 23, 35                 # stylobate (top step) half extents
CA, CB = 18.5, 30.5             # column axis lines
RB, RT = 3.0, 2.5               # column radius bottom / top
EA, EB = 22.5, 34.5             # entablature faces
KA, KB = 24, 36                 # cornice faces
PR = 11                         # pediment rise (steeper than real so it reads in 2:1)
CELLA = (-12, 12, -24, 18.2)    # a0, a1, b0, b1 (deep pronaos: the door shows between columns)


def cella(c, zst, zab):
    a0, a1, b0, b1 = CELLA
    cf = c.lin("cf", 0, zst, 0, zab, [(0, "#9c978c"), (0.6, "#7f7b74"), (1, "#5c5a57")])
    g = [f'<rect x="{a0}" y="{f(zst)}" width="{a1 - a0}" height="{f(zab - zst)}" fill="{cf}"/>']
    for i in range(1, 9):
        g.append(f'<rect x="{a0}" y="{f(zst + i * (zab - zst) / 9)}" width="{a1 - a0}" height="0.35" fill="#7f7b72" opacity="0.4"/>')
    dx0, dx1, dy1 = -5, 5, zst + 26
    glow = c.rad("glow", 0, zst + 9, 12, [(0, "#f0b25a", 0.75), (0.55, "#8a4f20", 0.4), (1, "#1a120c", 0)])
    g.append(f'<rect x="{dx0 - 1.2}" y="{f(zst)}" width="{dx1 - dx0 + 2.4}" height="{f(dy1 - zst + 1.6)}" fill="#a39e92"/>'
             f'<rect x="{dx0}" y="{f(zst)}" width="{dx1 - dx0}" height="{f(dy1 - zst)}" fill="#17110d"/>'
             f'<rect x="{dx0}" y="{f(zst)}" width="{dx1 - dx0}" height="{f(dy1 - zst)}" fill="{glow}"/>'
             # gilded cult statue on a low base
             f'<rect x="-2.2" y="{f(zst)}" width="4.4" height="2.2" fill="#6e6458"/>'
             f'<path d="M-1.5,{f(zst + 2.2)} L1.5,{f(zst + 2.2)} L1.1,{f(zst + 12)} Q2.1,{f(zst + 13.2)} 1.1,{f(zst + 15)} L0,{f(zst + 16.4)} L-1.1,{f(zst + 15)} Q-2.1,{f(zst + 13.2)} -1.1,{f(zst + 12)}Z" fill="#c48b3e"/>'
             f'<path d="M-1.5,{f(zst + 2.2)} L-0.2,{f(zst + 2.2)} L-0.2,{f(zst + 16.2)} L-1.1,{f(zst + 15)} Q-2.1,{f(zst + 13.2)} -1.1,{f(zst + 12)}Z" fill="#f0c878"/>'
             f'<circle cx="0" cy="{f(zst + 17.6)}" r="1.25" fill="#e0ad5f"/><circle cx="-0.4" cy="{f(zst + 17.9)}" r="0.5" fill="#fff0c4"/>'
             f'<path d="M2.2,{f(zst + 9)} L2.6,{f(zst + 21)}" stroke="#d9a35a" stroke-width="0.5"/>'
             f'<path d="{poly([(dx0, zst), (dx0 + 2.4, zst + 1.5), (dx0 + 2.4, dy1 - 1), (dx0, dy1)])}" fill="#8a5a2a"/>'
             f'<path d="{poly([(dx1, zst), (dx1 - 2.4, zst + 1.5), (dx1 - 2.4, dy1 - 1), (dx1, dy1)])}" fill="#5e3b1c"/>')
    cao = c.lin("cao", 0, zab - 8, 0, zab, [(0, "#3b3a37", 0), (1, "#3b3a37", 0.45)])
    g.append(f'<rect x="{a0}" y="{f(zab - 8)}" width="{a1 - a0}" height="8" fill="{cao}"/>')
    c.add(c.on(c.m_bface(b1), "".join(g)))
    cr = c.lin("cr", 0, zst, 0, zab, [(0, "#7f8180"), (1, "#5a5d62")])
    g = [f'<rect x="{-b1}" y="{f(zst)}" width="{b1 - b0}" height="{f(zab - zst)}" fill="{cr}"/>']
    for i in range(1, 9):
        g.append(f'<rect x="{-b1}" y="{f(zst + i * (zab - zst) / 9)}" width="{b1 - b0}" height="0.35" fill="#5f625f" opacity="0.4"/>')
    g.append(f'<rect x="{-b1}" y="{f(zst)}" width="0.6" height="{f(zab - zst)}" fill="#d6d3ca" opacity="0.5"/>')
    c.add(c.on(c.m_aface(a1), "".join(g)))


def build():
    c = iso.Canvas("temple")
    sa0, sb0 = SA + 2 * STEP_W, SB + 2 * STEP_W
    iso.base(c, seed=23, avoid=lambda a, b: (-sa0 - 2 < a < sa0 + 2 and -sb0 - 2 < b < sb0 + 2) or (-6 < a < 6 and b > sb0))

    zst = 3 * STEP_H
    zsh = zst + 33.5
    zab = zsh + 3.5
    zco = zab + 13.2
    zeav = zco + 1.8
    iso.cast_shadow(c, [(sa * (sa0 + 0.5), sb * (sb0 + 0.5)) for sa in (-1, 1) for sb in (-1, 1)],
                    [(sa * KA, sb * KB, zeav) for sa in (-1, 1) for sb in (-1, 1)] + [(0, sb * KB, zeav + PR) for sb in (-1, 1)], opacity=0.5)
    iso.contact_ao(c, -sa0, sa0, -sb0, sb0, opacity=0.5)
    iso.blob_shadow(c, -22, 39, 6, 0.32)
    iso.blob_shadow(c, 4, 53, 4.5, 0.32)
    iso.flagstones(c, [(0, sb0 + 3.5, 9, 4.6, 0), (0.6, sb0 + 9, 8, 4.6, 4), (-0.4, sb0 + 14.5, 7, 4.4, -5)], z=0.9)

    iso.marble_steps(c, SA, SB, 3, STEP_W, STEP_H)
    # roof shadow across the right half of the steps
    c.add(f'<path d="{poly([c.P(SA - 1, -SB - 4, zst), c.P(SA + 2 * STEP_W + 3, -SB - 4, 0), c.P(SA + 2 * STEP_W + 3, SB + 2 * STEP_W + 1, 0), c.P(SA - 1, SB + 2 * STEP_W, zst)])}" fill="#3a4250" opacity="0.18" filter="{c.blur(0.8)}"/>')
    iso.base_tufts(c, [((-sa0, sb0), (-6, sb0)), ((6, sb0), (sa0, sb0)), ((sa0, sb0), (sa0, -sb0))], n=16, seed=4, hmax=3.2)

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

    iso.entablature(c, EA, EB, zab, KA, KB)
    iso.tile_roof_b(c, KA, KB, zeav, PR)
    iso.pediment_b(c, KA, KB, zco, PR)
    iso.altar(c, 0, 53)
    iso.cypress(c, -38, 40)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
