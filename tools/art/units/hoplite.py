"""hoplite - heavy infantry: crested Corinthian helmet, bronze cuirass and greaves, spear and
the big round aspis. Accent (owner colour): token band, the aspis and the crest."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import units_lib as U  # noqa: E402


def build():
    c = U.UnitCanvas("hoplite")
    U.token(c, seed=5)
    x, y = c.P(0, 0, 0)
    U.ground_shadow(c, x, y, 12)
    U.person(c, x, y, h=70, armor="cuirass", legs="greaves", helmet="corinthian", cloak=U.WOOL,
             hold="spear", shield="aspis", accents=("shield", "crest"))
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "units")
    print("\n".join(build().write(out)))

