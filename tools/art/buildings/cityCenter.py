"""cityCenter - the agora, standing directly on the map (grounded, docs/ART.md; the game paints the
paved plaza): a round columned council house (tholos) under a conical tiled roof, a bronze hoplite
statue on a marble pedestal, two banners, a market stall, a fountain, amphorae and an olive tree.
Accent (owner colour): the painted frieze ring of the tholos, both banners, the statue's crest
and shield, the market awning."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_civic as lc  # noqa: E402
from iso import f  # noqa: E402
import math  # noqa: E402

# tholos (round council house), placed with c.at(THOLOS). Shared human scale (README "Scale"):
# the city's heart is the largest building of a town - its podium (about 77 across) and its
# height (about 84 to the cone's tip) beat the temple (59 x 77, 73 high); door 9 x 16.
THOLOS = (-8, -18)
R_TOP, STEP_W, STEP_H = 32, 3.2, 3.6   # podium top radius, step size
R_COL, N_COL = 27.5, 14                # column ring
R_CELLA = 19                            # round cella wall
ZCOL = 31                              # shaft height
COL_RB, COL_RT, COL_CAP = 2.9, 2.45, 3.5   # column radius bottom / top, abacus half size
CONE_RISE = 30                         # cone roof rise


def tholos(c):
    zst = 2 * STEP_H
    zsh = zst + ZCOL
    zab = zsh + 3.5
    zent = zab + 10.5                  # tall entablature: its painted frieze shows under the cone
    r_roof = R_COL + 5
    rise = CONE_RISE
    rb = R_TOP + 2 * STEP_W
    # cast shadow (the cone is approximated by its eave circle and apex)
    ring = [(r_roof * math.cos(t), r_roof * math.sin(t), zent) for t in [i * math.pi / 8 for i in range(16)]]
    foot = [(rb * math.cos(t), rb * math.sin(t)) for t in [i * math.pi / 8 for i in range(16)]]
    iso.cast_shadow(c, foot, ring + [(0, 0, zent + rise)], opacity=0.5)
    cx, cy = c.P(0, 0, 0)
    c.add(f'<ellipse cx="{f(cx + 3)}" cy="{f(cy + 1)}" rx="{f(rb * 1.414 + 2)}" ry="{f(rb * 0.707 + 1.5)}" fill="#24381a" opacity="0.35" filter="{c.blur(1.6)}"/>')
    # round podium (two steps)
    for k in range(2):
        r = R_TOP + (1 - k) * STEP_W
        iso.cylinder(c, r, k * STEP_H, (k + 1) * STEP_H, [(0, "#f3eee2"), (0.4, "#e6e0d2"), (0.75, "#c3c4bf"), (1, "#a9acab")], top=iso.MARBLE["top"], name=f"pod{k}")
        c.add(f'<path d="{iso.ring_front_arc(c, r, (k + 1) * STEP_H, 0.4)}" fill="none" stroke="#fff" stroke-width="0.7" opacity="0.85"/>')
    # shaded floor inside the colonnade + AO ring around the cella
    x, y = c.P(0, 0, zst)
    c.add(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(R_COL * 1.414)}" ry="{f(R_COL * 0.707)}" fill="#b4ae9f"/>'
          f'<ellipse cx="{f(x + 2)}" cy="{f(y + 1)}" rx="{f(R_CELLA * 1.414 + 3)}" ry="{f(R_CELLA * 0.707 + 2)}" fill="#5c5a52" opacity="0.35" filter="{c.blur(1.2)}"/>')
    cols = [(R_COL * math.cos(2 * math.pi * (i + 0.5) / N_COL), R_COL * math.sin(2 * math.pi * (i + 0.5) / N_COL)) for i in range(N_COL)]
    cols.sort(key=lambda p: p[0] + p[1])
    for a, b in cols:
        if a + b < 0:
            iso.doric_column(c, a, b, zst, zsh, COL_RB, COL_RT, dark=True, cap=COL_CAP)
    # round cella with a doorway facing the agora (+b)
    iso.cylinder(c, R_CELLA, zst, zab, [(0, "#a8a397"), (0.35, "#8f8a80"), (0.75, "#6c6a66"), (1, "#5a5a5c")], name="cella")
    with c.at(0, 0, 0):
        c.add(c.on(c.m_bface(R_CELLA - 0.6), f'<rect x="-16" y="{f(zst)}" width="9" height="16" fill="#1f1812"/><rect x="-17" y="{f(zst + 16)}" width="11" height="1.6" fill="#c9c3b5"/>'))
    ao = c.lin("cao", 0, 0, 0, 1, [(0, "#2d2a26", 0.5), (1, "#2d2a26", 0)], bbox=True)
    xa, ya = c.P(0, 0, zab)
    c.add(f'<path d="M{f(xa - R_CELLA * 1.414)},{f(ya)} A{f(R_CELLA * 1.414)},{f(R_CELLA * 0.707)} 0 0 0 {f(xa + R_CELLA * 1.414)},{f(ya)} L{f(xa + R_CELLA * 1.414)},{f(ya + 9)} A{f(R_CELLA * 1.414)},{f(R_CELLA * 0.707)} 0 0 1 {f(xa - R_CELLA * 1.414)},{f(ya + 9)}Z" fill="{ao}"/>')
    for a, b in cols:
        if a + b >= 0:
            iso.column_shadow(c, a, b, zst, COL_RB, length=7)
    for a, b in cols:
        if a + b >= 0:
            iso.doric_column(c, a, b, zst, zsh, COL_RB, COL_RT, cap=COL_CAP)
    # entablature ring with blue triglyphs and a red taenia
    re_ = R_COL + 4.4
    iso.cylinder(c, re_, zab, zent, [(0, "#f6f2e8"), (0.35, "#ebe6d9"), (0.75, "#c6c8c5"), (1, "#aeb1b1")], name="ent")
    x, y0 = c.P(0, 0, zab)
    rx = re_ * 1.414
    # painted frieze (owner colour): a coloured ring under the cone, readable at map size
    _, ylo = c.P(0, 0, zab + 3.2)
    _, yhi = c.P(0, 0, zent - 1.2)
    fr = c.lin("frieze", x - rx, 0, x + rx, 0, [(0, iso.ACCENT["light"]), (0.3, iso.ACCENT["lit"]), (0.7, iso.ACCENT["mid"]), (1, iso.ACCENT["dark"])])
    c.accent(f'<path d="M{f(x - rx)},{f(yhi)} L{f(x - rx)},{f(ylo)} A{f(rx)},{f(rx / 2)} 0 0 0 {f(x + rx)},{f(ylo)} L{f(x + rx)},{f(yhi)} A{f(rx)},{f(rx / 2)} 0 0 1 {f(x - rx)},{f(yhi)}Z" fill="{fr}"/>')
    out = []
    for i in range(28):
        t = 2 * math.pi * (i + 0.5) / 28
        if math.cos(t) + math.sin(t) <= 0.15:   # only the half facing the viewer
            continue
        px = x + rx * (math.cos(t) - math.sin(t)) / 1.414
        py = y0 + rx / 2 * (math.cos(t) + math.sin(t)) / 1.414
        w = 2.4 * abs(math.cos(t) + math.sin(t)) / 1.414 + 0.3
        out.append(f'<rect x="{f(px - w / 2)}" y="{f(py - (zent - zab - 1.2) * iso.ZS)}" width="{f(w)}" height="{f((zent - zab - 4.4) * iso.ZS)}" fill="#2d4f78"/>')
    c.add("".join(out))
    c.add(f'<path d="{iso.ring_front_arc(c, re_, zab + 3.2)}" fill="none" stroke="#8c877b" stroke-width="0.5" opacity="0.6"/>'
          f'<path d="{iso.ring_front_arc(c, re_, zent - 0.5)}" fill="none" stroke="#a8432f" stroke-width="1.1"/>')
    # cornice lip + conical tiled roof with a gilded finial
    iso.cylinder(c, r_roof, zent, zent + 1.6, [(0, "#fbf8f1"), (0.5, "#e8e3d6"), (1, "#b5b7b5")], name="cor")
    iso.cone_roof(c, r_roof, zent + 1.6, rise, tiles=36, courses=5)


def build():
    c = iso.Canvas("cityCenter")
    iso.ground(c)
    iso.ground_ao(c, [(-44, -52), (30, -52), (46, 28), (-40, 42)], grow=6, opacity=0.12)

    iso.olive_tree(c, 34, -38, size=0.85, seed=8)
    with c.at(*THOLOS):
        tholos(c)
        rb = R_TOP + 2 * STEP_W
        iso.foot_tufts(c, [((rb * 0.2, rb * 0.95), (rb * 0.95, rb * 0.2))], n=4, seed=3, hmax=3, kind="weeds", stones=2)
    # banners flanking the way into the tholos
    iso.banner_b(c, -31, 21, 0, height=42, width=8.5, drop=18)
    iso.banner_b(c, 17, 25, 0, height=42, width=8.5, drop=18)

    # bronze hoplite (twice life size) on a marble pedestal (left front)
    pa, pb = -34, 31
    iso.cast_shadow(c, [(pa + sa * 5, pb + sb * 5) for sa in (-1, 1) for sb in (-1, 1)], [(pa + sa * 4, pb + sb * 4, 11) for sa in (-1, 1) for sb in (-1, 1)] + [(pa, pb, 41)], opacity=0.4, sd=1.6)
    iso.contact_ao(c, pa - 4.8, pa + 4.8, pb - 4.8, pb + 4.8, opacity=0.35, width=2.5)
    ztop = iso.pedestal(c, pa, pb, 3.8, 3.8, 11)
    x, y = c.P(pa, pb, ztop)
    iso.figure(c, x, y, 30, metal=iso.BRONZE, pose="spear", accent_parts=("crest", "shield"))

    with c.at(38, 22):
        lc.stall(c, w=9, d=3.6, z_aw=17, depth=11, drop=4.5, goods=1)
    iso.amphora(c, 24, 38, k=0.6, shaded=False)
    iso.amphora(c, 19.5, 41.5, k=0.5, shaded=False)
    # fountain at the front of the square
    with c.at(-2, 44):
        lc.fountain(c, r=7.5)
    iso.pebbles(c, [(14, 50, 1.0, 1), (-18, 52, 0.9, 2)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
