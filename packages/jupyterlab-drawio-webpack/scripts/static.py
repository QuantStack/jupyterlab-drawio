from fnmatch import fnmatch
from pathlib import Path
from pprint import pprint

HERE = Path(__file__).parent
ROOT = HERE.parent.resolve()
DRAWIO = ROOT / "drawio"
IGNORE = ROOT / ".npmignore"
IGNORED = {
    glob.strip(): 0
    for glob in IGNORE.read_text().strip().splitlines()
    if glob.startswith("drawio/")
}
STATIC = ROOT / "lib" / "_static.js"
HEADER = """
/**
    All files that should be copied to the jupyterlab static folder, available as:

    {:base_url}static/lab/node_modules/@deathbeds/jupyterlab-drawio-webpack/src/{:path}

    This file generated from https://github.com/jgraph/drawio
*/
"""
TMPL = """
import '!!file-loader?name=[path][name].[ext]&context=.!../drawio{}';
"""


def is_ignored(path):
    for ignore in IGNORED:
        if fnmatch(str(path.relative_to(ROOT)), ignore):
            IGNORED[ignore] += 1
            return True
    return False


def update_static():
    print("ignoring\n", "\n".join(IGNORED))
    lines = []

    for path in sorted(DRAWIO.rglob("*")):
        if path.is_dir():
            continue
        if is_ignored(path):
            continue
        lines += [
            TMPL.format(
                str(path.as_posix()).replace(str(DRAWIO.as_posix()), "")
            ).strip()
        ]

    assert lines

    STATIC.write_text("\n".join([HEADER, *lines]))
    print(f"wrote {len(lines)} lines")
    pprint(IGNORED)


if __name__ == "__main__":
    update_static()
