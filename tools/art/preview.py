"""Review sheet: art + accent tinted in the four player colours, large and at map sizes.

    python3 tools/art/preview.py house temple --out /tmp/preview.svg
    python3 tools/art/preview.py hoplite trireme --out /tmp/units.svg
    qlmanage -t -s 1600 -o /tmp /tmp/preview.svg      # macOS: render to /tmp/preview.svg.png

Reads public/assets/buildings/ or public/assets/units/ (<id>.svg + <id>.accent.svg; run
build_all.py first). The tint is a multiply (feColorMatrix), the same maths as PixiJS
sprite.tint. The accent layer is drawn first, the art on top - exactly like the game does it.
Map strips: buildings on 64 px and 40 px hexes; units on 64 px and 52 px hexes (at 52 px the
unit token is 32 px wide - the legibility check of docs/ART.md).
"""
import argparse
import math
import os
import re
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
ASSETS = os.path.join(ROOT, "public", "assets", "buildings")      # kept for older callers
FOLDERS = {"buildings": ASSETS, "units": os.path.join(ROOT, "public", "assets", "units")}
PLAYERS = ["#6e3a8e", "#b23a30", "#2e6da4", "#c9a227"]   # purple, cinnabar, Aegean blue, gold
# canvas contract (docs/ART.md): canvas size, base centre, base width, share of the hex width
ANCHOR = {"buildings": (256, 128, 176, 208, 0.92), "units": (128, 64, 96, 88, 0.62)}
STRIPS = {"buildings": (64, 40), "units": (64, 52)}
WATER_UNITS = {"transport", "trireme"}
_n = [0]


def kind_of(asset):
    for kind, folder in FOLDERS.items():
        if os.path.exists(os.path.join(folder, f"{asset}.svg")):
            return kind
    raise SystemExit(f"no art for '{asset}' in public/assets/buildings or public/assets/units")


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


def viewbox(path, canvas):
    """The file's viewBox (direction variants such as fishery.e0 have their own, in the same user
    units as the normal canvas)."""
    head = open(path, encoding="utf-8").read(400)
    m = re.search(r'viewBox="([^"]+)"', head)
    return tuple(float(v) for v in m.group(1).split()) if m else (0, 0, canvas, canvas)


def composed(asset, x, y, size, colour, layers="both"):
    """Draw an asset whose normal canvas (0 0 canvas canvas) would be `size` px wide at (x, y)."""
    _n[0] += 1
    p = f"p{_n[0]}_"
    kind = kind_of(asset)
    canvas = ANCHOR[kind][0]
    art = os.path.join(FOLDERS[kind], f"{asset}.svg")
    acc = os.path.join(FOLDERS[kind], f"{asset}.accent.svg")
    vx, vy, vw, vh = viewbox(art, canvas)
    k = size / canvas
    parts = [f'<svg x="{x + vx * k:.1f}" y="{y + vy * k:.1f}" width="{vw * k:.1f}" height="{vh * k:.1f}" viewBox="{vx:g} {vy:g} {vw:g} {vh:g}">']
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
    """Place an asset like the game: base width -> share * hex width, base centre on tile centre."""
    canvas, bx, by, bw, share = ANCHOR[kind_of(asset)]
    size = canvas * share * hex_w / bw
    return composed(asset, cx - bx * size / canvas, cy - by * size / canvas, round(size, 1), colour)


def sheet(assets):
    row_h = 300
    w = 1600
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {row_h * len(assets) + 20}">',
           f'<rect width="{w}" height="{row_h * len(assets) + 20}" fill="#f3ead8"/>']
    for i, asset in enumerate(assets):
        kind = kind_of(asset)
        y0 = 10 + i * row_h
        out.append(f'<rect x="10" y="{y0}" width="{w - 20}" height="{row_h - 10}" rx="10" fill="#fbf5e9"/>')
        out.append(composed(asset, 20, y0 + 10, 270, PLAYERS[0]))
        for k, col in enumerate(PLAYERS):
            out.append(composed(asset, 300 + k * 118, y0 + 30, 112, col))
        out.append(composed(asset, 300, y0 + 160, 112, None, "art"))
        out.append(composed(asset, 418, y0 + 160, 112, None, "accent"))
        water = asset in WATER_UNITS
        land = ["#9cc25a", "#a4c95f", "#94bb52", "#3fb3b8"]
        sea = ["#3fb3b8", "#2f9fb0", "#3fb3b8", "#2f9fb0"]
        for k, (hw, cx0) in enumerate(zip(STRIPS[kind], (820, 1180))):
            s = hw / math.sqrt(3)
            for col_i in range(4):
                for r in range(2):
                    cx = cx0 + col_i * hw + (hw / 2 if r else 0)
                    cy = y0 + 110 + r * 1.5 * s + k * 30
                    out.append(hexagon(cx, cy, s, (sea if water else land)[(col_i + r) % 4], "#2e8f98" if water else "#86ab4a"))
            for col_i, col in enumerate(PLAYERS):
                out.append(on_tile(asset, cx0 + col_i * hw, y0 + 110 + k * 30, hw, col))
    out.append("</svg>\n")
    return "".join(out)


def all_assets():
    names = []
    for folder in FOLDERS.values():
        if os.path.isdir(folder):
            names += sorted(n[:-11] for n in os.listdir(folder) if n.endswith(".accent.svg") and not re.search(r"\.e\d$", n[:-11]))
    return names


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("assets", nargs="*")
    ap.add_argument("--out", default=os.path.join(tempfile.gettempdir(), "poleis-art-preview.svg"))
    args = ap.parse_args()
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(sheet(args.assets or all_assets()))
    print(args.out)
