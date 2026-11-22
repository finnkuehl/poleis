"""horseman - a rider on a bay horse, crested helmet, javelin raised, cloak streaming behind.
Accent (owner colour): token band, the saddle cloth and the cloak."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import units_lib as U  # noqa: E402


def build():
    c = U.UnitCanvas("horseman")
    U.token(c, seed=15)
    x, y = c.P(0, 0, 0)
    U.ground_shadow(c, x + 3, y + 3, 24, length=18)
    sx, sy = U.horse(c, x + 3, y + 4, h=50)
    U.rider(c, sx, sy, h=30, accents=("cloak",))
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "units")
    print("\n".join(build().write(out)))

