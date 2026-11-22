"""scout - a runner with a wide petasos hat, a cloak blown back by the wind and a staff.
Accent (owner colour): token band and the cloak."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import units_lib as U  # noqa: E402


def build():
    c = U.UnitCanvas("scout")
    U.token(c, seed=9)
    x, y = c.P(-2, 2, 0)
    U.ground_shadow(c, x, y, 11)
    U.person(c, x, y, h=68, hem=-42, beard=False, stride=1.0, helmet="petasos", cloak="accent",
             cloak_flow=True, hold="staff", accents=("cloak",))
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "units")
    print("\n".join(build().write(out)))

