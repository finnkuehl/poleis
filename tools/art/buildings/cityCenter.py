"""cityCenter - the agora: a paved square with a round columned council house (tholos) under a
conical tiled roof, a bronze hoplite statue on a marble pedestal, two banners and a market stall.
Accent (owner colour): base rim band, both banners, the statue's crest and shield,
the market awning."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
from iso import f  # noqa: E402
import math  # noqa: E402

# tholos (round council house), placed with c.at(THOLOS)
THOLOS = (-6, -14)
R_TOP, STEP_W, STEP_H = 24, 2.8, 2.8   # podium top radius, step size
R_COL, N_COL = 20.5, 12                # column ring
R_CELLA = 14                            # round cella wall
ZCOL = 27                              # shaft height
PAVE_R = 57                            # agora paving radius


def tholos(c):
    zst = 2 * STEP_H
    zsh = zst + ZCOL
    zab = zsh + 3.5
    zent = zab + 7.5
    r_roof = R_COL + 5
    rise = 24
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
            iso.doric_column(c, a, b, zst, zsh, 2.5, 2.1, dark=True, cap=3.0)
    # round cella with a doorway facing the agora (+b)
    iso.cylinder(c, R_CELLA, zst, zab, [(0, "#a8a397"), (0.35, "#8f8a80"), (0.75, "#6c6a66"), (1, "#5a5a5c")], name="cella")
    with c.at(0, 0, 0):
        c.add(c.on(c.m_bface(R_CELLA - 0.6), f'<rect x="-14.5" y="{f(zst)}" width="7" height="17" fill="#1f1812"/><rect x="-15.4" y="{f(zst + 17)}" width="8.8" height="1.4" fill="#c9c3b5"/>'))
    ao = c.lin("cao", 0, 0, 0, 1, [(0, "#2d2a26", 0.5), (1, "#2d2a26", 0)], bbox=True)
    xa, ya = c.P(0, 0, zab)
    c.add(f'<path d="M{f(xa - R_CELLA * 1.414)},{f(ya)} A{f(R_CELLA * 1.414)},{f(R_CELLA * 0.707)} 0 0 0 {f(xa + R_CELLA * 1.414)},{f(ya)} L{f(xa + R_CELLA * 1.414)},{f(ya + 9)} A{f(R_CELLA * 1.414)},{f(R_CELLA * 0.707)} 0 0 1 {f(xa - R_CELLA * 1.414)},{f(ya + 9)}Z" fill="{ao}"/>')
    for a, b in cols:
        if a + b >= 0:
            iso.column_shadow(c, a, b, zst, 2.5, length=6)
    for a, b in cols:
        if a + b >= 0:
            iso.doric_column(c, a, b, zst, zsh, 2.5, 2.1, cap=3.0)
    # entablature ring with blue triglyphs and a red taenia
    re_ = R_COL + 4.4
    iso.cylinder(c, re_, zab, zent, [(0, "#f6f2e8"), (0.35, "#ebe6d9"), (0.75, "#c6c8c5"), (1, "#aeb1b1")], name="ent")
    x, y0 = c.P(0, 0, zab)
    rx = re_ * 1.414
    out = []
    for i in range(22):
        t = 2 * math.pi * (i + 0.5) / 22
        if math.cos(t) + math.sin(t) <= 0.15:   # only the half facing the viewer
            continue
        px = x + rx * (math.cos(t) - math.sin(t)) / 1.414
        py = y0 + rx / 2 * (math.cos(t) + math.sin(t)) / 1.414
        w = 2.4 * abs(math.cos(t) + math.sin(t)) / 1.414 + 0.3
        out.append(f'<rect x="{f(px - w / 2)}" y="{f(py - 7.5 * iso.ZS + 1.6)}" width="{f(w)}" height="{f(3.4 * iso.ZS)}" fill="#2d4f78"/>')
    c.add("".join(out))
    c.add(f'<path d="{iso.ring_front_arc(c, re_, zab + 3.2)}" fill="none" stroke="#8c877b" stroke-width="0.5" opacity="0.6"/>'
          f'<path d="{iso.ring_front_arc(c, re_, zent - 0.5)}" fill="none" stroke="#a8432f" stroke-width="1.1"/>')
    # cornice lip + conical tiled roof with a gilded finial
    iso.cylinder(c, r_roof, zent, zent + 1.6, [(0, "#fbf8f1"), (0.5, "#e8e3d6"), (1, "#b5b7b5")], name="cor")
    iso.cone_roof(c, r_roof, zent + 1.6, rise, tiles=30)


def stall(c):
    """Small wooden market stall with goods and a striped awning (ACCENT)."""
    W = iso.WOOD
    iso.blob_shadow(c, 6, 0, 7, 0.32)
    iso.box(c, -6, 6, -3, 3, 0, 5.5, W["lit"], W["base"], W["dark"], edge="#c99a6a")
    c.add(c.on(c.m_bface(3), "".join(f'<rect x="{f(-6 + i * 2.4)}" y="0" width="0.4" height="5.5" fill="{W["deep"]}" opacity="0.5"/>' for i in range(1, 5))))
    # goods: bread loaves, grapes, a small amphora
    for i, (a, b, col, hi) in enumerate([(-3.6, 0, "#d9b45a", "#f1d68a"), (-1.2, 0.6, "#d9b45a", "#f1d68a"), (1.6, -0.4, "#7a2a3a", "#b0566a"), (3.8, 0.8, "#6f7d3a", "#a2b072")]):
        x, y = c.P(a, b, 5.5)
        c.add(f'<ellipse cx="{f(x)}" cy="{f(y - 0.8)}" rx="2" ry="1.4" fill="{col}"/><ellipse cx="{f(x - 0.5)}" cy="{f(y - 1.3)}" rx="0.9" ry="0.5" fill="{hi}"/>')
    for a in (-6, 6):
        x, y = c.P(a, 3, 0)
        _, yt = c.P(a, 3, 15)
        c.add(f'<rect x="{f(x - 0.55)}" y="{f(yt)}" width="1.1" height="{f(y - yt)}" fill="{W["dark"]}"/>')
    x, y = c.P(6, -3, 0)
    _, yt = c.P(6, -3, 15)
    c.add(f'<rect x="{f(x - 0.55)}" y="{f(yt)}" width="1.1" height="{f(y - yt)}" fill="{W["deep"]}"/>')
    iso.awning_b(c, -7.5, 7.5, -4.5, 16, depth=9, drop=3.5, stripes=6)


def build():
    c = iso.Canvas("cityCenter")
    iso.base(c, seed=31, avoid=lambda a, b: a * a + b * b < (PAVE_R + 1) ** 2, tufts=60, flowers=10)
    iso.paving(c, PAVE_R, seed=12)
    # kerb ring where the paving meets the grass
    cx, cy = c.P(0, 0, 0)
    rxp = PAVE_R * 2 ** 0.5
    c.add(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rxp)}" ry="{f(rxp / 2)}" fill="none" stroke="#c9b27a" stroke-width="1.4"/>'
          f'<path d="M{f(cx - rxp)},{f(cy + 0.9)} A{f(rxp)},{f(rxp / 2)} 0 0 0 {f(cx + rxp)},{f(cy + 0.9)}" fill="none" stroke="#fff6dc" stroke-width="0.8" opacity="0.8"/>')

    iso.olive_tree(c, 30, -40, size=0.85, seed=8)
    with c.at(*THOLOS):
        tholos(c)
    # banners flanking the way into the tholos
    iso.banner_b(c, -27, 20, 0, height=40, width=7.5, drop=16)
    iso.banner_b(c, 18, 20, 0, height=40, width=7.5, drop=16)

    # bronze hoplite on a marble pedestal (left front)
    pa, pb = -30, 34
    iso.cast_shadow(c, [(pa + sa * 6, pb + sb * 6) for sa in (-1, 1) for sb in (-1, 1)], [(pa + sa * 5, pb + sb * 5, 13) for sa in (-1, 1) for sb in (-1, 1)] + [(pa, pb, 52)], opacity=0.4, sd=1.6)
    iso.contact_ao(c, pa - 5.6, pa + 5.6, pb - 5.6, pb + 5.6, opacity=0.35, width=2.5)
    ztop = iso.pedestal(c, pa, pb, 4.6, 4.6, 13)
    x, y = c.P(pa, pb, ztop)
    iso.figure(c, x, y, 40, metal=iso.BRONZE, pose="spear", accent_parts=("crest", "shield"))

    with c.at(36, 22):
        stall(c)
    iso.amphora(c, 24, 36, k=0.85, shaded=False)
    iso.amphora(c, 27.5, 38.5, k=0.7, shaded=False)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
