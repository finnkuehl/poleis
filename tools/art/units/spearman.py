"""spearman - light infantry: linen tunic, conical bronze pilos cap, spear and a small round
shield. Accent (owner colour): token band and the shield."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import units_lib as U  # noqa: E402


def build():
    c = U.UnitCanvas("spearman")
    U.token(c, seed=7)
    x, y = c.P(1, 1, 0)
    U.ground_shadow(c, x, y, 18, length=20)
    U.person(c, x - 2, y, h=76, helmet="pilos", hold="spear", shield="round", accents=("shield",))
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "units")
    print("\n".join(build().write(out)))

