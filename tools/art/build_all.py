"""Build every asset script in tools/art/buildings/ into public/assets/buildings/.

    python3 tools/art/build_all.py              # all buildings
    python3 tools/art/build_all.py house temple # only these

Each script in buildings/ is named after the asset id (e.g. cityCenter.py) and defines build().
"""
import sys

sys.dont_write_bytecode = True
import importlib.util  # noqa: E402
import os  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "public", "assets", "buildings"))
SOFT_LIMIT = 150 * 1024


def load(path):
    name = os.path.splitext(os.path.basename(path))[0]
    spec = importlib.util.spec_from_file_location(f"poleis_art_{name}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return name, mod


def main(only):
    src = os.path.join(HERE, "buildings")
    scripts = sorted(p for p in os.listdir(src) if p.endswith(".py") and not p.startswith("_"))
    for script in scripts:
        name, mod = load(os.path.join(src, script))
        if only and name not in only:
            continue
        canvas = mod.build()
        if canvas.asset_id != name:
            raise SystemExit(f"{script}: Canvas id '{canvas.asset_id}' must match the file name '{name}'")
        for path in canvas.write(OUT):
            size = os.path.getsize(path)
            warn = "  <-- over 150 KB, simplify" if size > SOFT_LIMIT else ""
            print(f"{os.path.relpath(path, os.path.join(HERE, '..', '..'))}  {size / 1024:.0f} KB{warn}")


if __name__ == "__main__":
    main(set(sys.argv[1:]))
