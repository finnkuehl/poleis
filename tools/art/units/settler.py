"""settler - a family's covered hand cart (amphora and bundles under the canvas) with the
settler walking ahead, staff in hand. Accent (owner colour): token band and the cart cover."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import units_lib as U  # noqa: E402


def build():
    c = U.UnitCanvas("settler")
    U.token(c, seed=13)
    # cart behind, to the right (broadside: along the screen horizontal)
    with c.at(*U.from_uv(9, -9)):
        U.cart(c, -14, 14, 4, 13, wheel_u=1, wheel_r=7.6, cover_h=15)
        xc, yc = c.Pu(-14, 0, 7)
        # shafts reaching forward to the settler
        x1, y1 = c.Pu(-27, 5, 10)
        c.add(f'<path d="M{U.f(xc)},{U.f(yc)} L{U.f(x1)},{U.f(y1)}" stroke="{U.WOOD["dark"]}" stroke-width="1.4"/>')
    sx, sy = c.Pu(-17, 9, 0)
    U.ground_shadow(c, sx, sy, 9)
    U.person(c, sx, sy, h=60, tunic=U.WOOL, hem=-34, cloak=U.LINEN, hold="staff")
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "units")
    print("\n".join(build().write(out)))

