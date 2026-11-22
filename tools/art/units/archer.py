"""archer - drawing a bow, quiver on the back, soft Phrygian cap.
Accent (owner colour): token band and the cap."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import units_lib as U  # noqa: E402


def build():
    c = U.UnitCanvas("archer")
    U.token(c, seed=11)
    x, y = c.P(2, -2, 0)
    U.ground_shadow(c, x + 6, y, 18, length=20)
    U.person(c, x + 8, y, h=78, tunic=U.WOOL, hem=-33, beard=False, helmet="phrygian", hold="bow",
             quiver=True, accents=("cap",))
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "units")
    print("\n".join(build().write(out)))

