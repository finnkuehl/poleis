"""transport - round-bellied merchant ship with a square linen sail, amphorae on deck and a
curved stern post. Water token. Accent (owner colour): token band and the sail."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import units_lib as U  # noqa: E402


def build():
    c = U.UnitCanvas("transport")
    U.token(c, top="water", seed=17)
    near = U.ship_hull(c, 26, 9, 8, sheer_bow=5, sheer_stern=9)
    U.transport_details(c, near)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "units")
    print("\n".join(build().write(out)))

