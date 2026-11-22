"""Build every asset script into public/assets/:

    tools/art/buildings/<id>.py  ->  public/assets/buildings/<id>.svg + <id>.accent.svg
    tools/art/units/<id>.py      ->  public/assets/units/<id>.svg + <id>.accent.svg

    python3 tools/art/build_all.py              # everything
    python3 tools/art/build_all.py house scout  # only these ids

Each script is named after the asset id (e.g. cityCenter.py) and defines build().
"""
import sys

sys.dont_write_bytecode = True
import importlib.util  # noqa: E402
import os  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
KINDS = ("buildings", "units")          # script folder == asset folder name
SOFT_LIMIT = 150 * 1024


def load(path):
    name = os.path.splitext(os.path.basename(path))[0]
    spec = importlib.util.spec_from_file_location(f"poleis_art_{os.path.basename(os.path.dirname(path))}_{name}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return name, mod


def main(only):
    for kind in KINDS:
        src = os.path.join(HERE, kind)
        if not os.path.isdir(src):
            continue
        out = os.path.join(ROOT, "public", "assets", kind)
        scripts = sorted(p for p in os.listdir(src) if p.endswith(".py") and not p.startswith("_"))
        for script in scripts:
            name = os.path.splitext(script)[0]
            if only and name not in only:
                continue
            name, mod = load(os.path.join(src, script))
            canvas = mod.build()
            if canvas.asset_id != name:
                raise SystemExit(f"{kind}/{script}: Canvas id '{canvas.asset_id}' must match the file name '{name}'")
            for path in canvas.write(out):
                size = os.path.getsize(path)
                warn = "  <-- over 150 KB, simplify" if size > SOFT_LIMIT else ""
                print(f"{os.path.relpath(path, ROOT)}  {size / 1024:.0f} KB{warn}")


if __name__ == "__main__":
    main(set(sys.argv[1:]))
