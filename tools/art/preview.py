"""Review sheet: art + accent tinted in the four player colours, large and at map sizes.

    python3 tools/art/preview.py house temple --out /tmp/preview.svg
    qlmanage -t -s 1600 -o /tmp /tmp/preview.svg      # macOS: render to /tmp/preview.svg.png

Reads public/assets/buildings/<id>.svg and <id>.accent.svg (run build_all.py first). The tint is
a multiply (feColorMatrix), the same maths as PixiJS sprite.tint. The accent layer is drawn
first, the art on top - exactly like the game should do it.
"""
import argparse
import math
import os
import re
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, "..", "..", "public", "assets", "buildings"))
PLAYERS = ["#6e3a8e", "#b23a30", "#2e6da4", "#c9a227"]   # purple, cinnabar, Aegean blue, gold
_n = [0]


def inner(path, prefix):
    text = open(path, encoding="utf-8").read()
    body = text[text.index(">", text.index("<svg")) + 1: text.rindex("</svg>")]
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    body = re.sub(r'id="', f'id="{prefix}', body)
    return body.replace("url(#", f"url(#{prefix}")


def tint_filter(fid, colour):
    r, g, b = (int(colour[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return (f'<filter id="{fid}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" '
            f'values="{r:.3f} 0 0 0 0 0 {g:.3f} 0 0 0 0 0 {b:.3f} 0 0 0 0 0 1 0"/></filter>')


def composed(asset, x, y, size, colour, layers="both"):
    _n[0] += 1
    p = f"p{_n[0]}_"
    art = os.path.join(ASSETS, f"{asset}.svg")
    acc = os.path.join(ASSETS, f"{asset}.accent.svg")
    parts = [f'<svg x="{x:.1f}" y="{y:.1f}" width="{size}" height="{size}" viewBox="0 0 256 256">']
    if layers in ("both", "accent") and os.path.exists(acc):
        parts.append(f'<defs>{tint_filter(p + "tint", colour)}</defs>' if colour else "")
        parts.append(f'<g filter="url(#{p}tint)">' if colour else "<g>")
        parts.append(inner(acc, p + "a") + "</g>")
    if layers in ("both", "art"):
        parts.append(inner(art, p + "b"))
    parts.append("</svg>")
    return "".join(parts)


def hexagon(cx, cy, s, fill, stroke):
    pts = " ".join(f"{cx + s * math.cos(math.radians(-90 + 60 * k)):.1f},{cy + s * math.sin(math.radians(-90 + 60 * k)):.1f}" for k in range(6))
    return f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width="1"/>'


def on_tile(asset, cx, cy, hex_w, colour):
    """Place an asset like the game: base width 208 -> 0.92 * hex width, base centre on tile centre."""
    size = 256 * 0.92 * hex_w / 208
    return composed(asset, cx - 128 * size / 256, cy - 176 * size / 256, round(size, 1), colour)


def sheet(assets):
    row_h = 300
    w = 1600
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {row_h * len(assets) + 20}">',
           f'<rect width="{w}" height="{row_h * len(assets) + 20}" fill="#f3ead8"/>']
    for i, asset in enumerate(assets):
        y0 = 10 + i * row_h
        out.append(f'<rect x="10" y="{y0}" width="{w - 20}" height="{row_h - 10}" rx="10" fill="#fbf5e9"/>')
        out.append(composed(asset, 20, y0 + 10, 270, PLAYERS[0]))
        for k, col in enumerate(PLAYERS):
            out.append(composed(asset, 300 + k * 118, y0 + 30, 112, col))
        out.append(composed(asset, 300, y0 + 160, 112, None, "art"))
        out.append(composed(asset, 418, y0 + 160, 112, None, "accent"))
        # map strip: hex widths 64 and 40 px (what a phone shows)
        for k, (hw, cx0) in enumerate([(64, 820), (40, 1180)]):
            s = hw / math.sqrt(3)
            for col_i in range(4):
                for r in range(2):
                    cx = cx0 + col_i * hw + (hw / 2 if r else 0)
                    cy = y0 + 110 + r * 1.5 * s + k * 30
                    out.append(hexagon(cx, cy, s, ["#9cc25a", "#a4c95f", "#94bb52", "#3fb3b8"][(col_i + r) % 4], "#86ab4a"))
            for col_i, col in enumerate(PLAYERS):
                cx = cx0 + col_i * hw
                cy = y0 + 110 + k * 30
                out.append(on_tile(asset, cx, cy, hw, col))
    out.append("</svg>\n")
    return "".join(out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("assets", nargs="*")
    ap.add_argument("--out", default=os.path.join(tempfile.gettempdir(), "poleis-art-preview.svg"))
    args = ap.parse_args()
    assets = args.assets or sorted(n[:-11] for n in os.listdir(ASSETS) if n.endswith(".accent.svg"))
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(sheet(assets))
    print(args.out)
