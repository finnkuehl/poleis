"""trireme - long dark warship: two banks of oars, bronze ram, painted eye, curling stern.
Water token. Accent (owner colour): token band, the upper hull strake, the shields on the rail and the
stern pennant."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import units_lib as U  # noqa: E402


def build():
    c = U.UnitCanvas("trireme")
    U.token(c, top="water", seed=19)
    near = U.ship_hull(c, 37, 6, 7, sheer_bow=3, sheer_stern=11,
                       colours=[(0, "#5a5652"), (0.45, "#3a3734"), (1, "#22201e")], deck="#6a4c30", strakes=1)
    U.trireme_details(c, near)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "units")
    print("\n".join(build().write(out)))

