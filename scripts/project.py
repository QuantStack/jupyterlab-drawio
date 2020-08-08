""" important project paths

    this should not import anything not in py36+ stdlib, or any local paths
"""
import json
import os
import platform
import shutil
import sys
from pathlib import Path

# platform
PLATFORM = os.environ.get("FAKE_PLATFORM", platform.system())
WIN = PLATFORM == "Windows"
OSX = PLATFORM == "Darwin"
UNIX = not WIN
PREFIX = Path(sys.prefix)

# find root
SCRIPTS = Path(__file__).parent.resolve()
ROOT = SCRIPTS.parent
BINDER = ROOT / "binder"

# top-level stuff
NODE_MODULES = ROOT / "node_modules"
PACKAGE = ROOT / "package.json"
PACKAGES = ROOT / "packages"
YARN_INTEGRITY = NODE_MODULES / ".yarn-integrity"
YARN_LOCK = ROOT / "yarn.lock"
EXTENSIONS_FILE = BINDER / "labextensions.txt"
EXTENSIONS = sorted(
    [
        line.strip()
        for line in EXTENSIONS_FILE.read_text().strip().splitlines()
        if line and not line.startswith("#")
    ]
)
CI = ROOT / ".github"
DODO = ROOT / "dodo.py"
BUILD = ROOT / "build"
DIST = ROOT / "dist"

# tools
PY = ["python"]
PYM = [*PY, "-m"]
PIP = [*PYM, "pip"]

NPM = (
    shutil.which("npm")
    or shutil.which("npm.cmd")
    or shutil.which("npm.exe")
    or shutil.which("npm.bat")
)
JLPM = ["jlpm"]
JLPM_INSTALL = [*JLPM, "--ignore-optional", "--prefer-offline"]
LAB_EXT = ["jupyter", "labextension"]
LAB = ["jupyter", "lab"]
PRETTIER = [str(NODE_MODULES / ".bin" / "prettier")]

# lab stuff
LAB_APP_DIR = PREFIX / "share/jupyter/lab"
LAB_STAGING = LAB_APP_DIR / "staging"
LAB_LOCK = LAB_STAGING / "yarn.lock"
LAB_STATIC = LAB_APP_DIR / "static"
LAB_INDEX = LAB_STATIC / "index.html"

# tests
EXAMPLES = ROOT / "notebooks"
EXAMPLE_IPYNB = [
    p for p in EXAMPLES.rglob("*.ipynb") if ".ipynb_checkpoints" not in str(p)
]
DIST_NBHTML = DIST / "nbsmoke"

# js packages
JS_NS = "deathbeds"
JDIO = PACKAGES / "jupyterlab-drawio"

# so many js packages
JS_PKG_JSON = {p.parent.name: p for p in PACKAGES.glob("*/package.json")}

JS_PKG_DATA = {
    k: json.loads(v.read_text(encoding="utf-8")) for k, v in JS_PKG_JSON.items()
}

JS_PKG_JSON_LABEXT = {
    k: v
    for k, v in JS_PKG_JSON.items()
    if JS_PKG_DATA[k].get("jupyterlab", {}).get("extension")
}

JS_PKG_NOT_META = {k: v for k, v in JS_PKG_JSON.items() if k.startswith("_")}

JS_TARBALL = {
    k: JS_PKG_JSON[k].parent
    / f"""{v["name"].replace('@', '').replace("/", "-")}-{v["version"]}.tgz"""
    for k, v in JS_PKG_DATA.items()
    if k not in JS_PKG_NOT_META
}

JS_TSCONFIG = {
    k: v.parent / "tsconfig.json"
    for k, v in JS_PKG_JSON.items()
    if (v.parent / "tsconfig.json").exists()
}

JS_TSSRC = {
    k: sorted(
        [*(v.parent / "src").rglob("*.ts")] + [*(v.parent / "src").rglob("*.tsx")]
    )
    for k, v in JS_TSCONFIG.items()
    if (v.parent / "src").exists()
}

JS_TSBUILDINFO = {k: v.parent / "lib" / ".tsbuildinfo" for k, v in JS_TSCONFIG.items()}

JS_STYLE = {
    k: sorted((v.parent / "style").glob("*.css"))
    for k, v in JS_PKG_JSON.items()
    if (v.parent / "style").exists()
}

JS_PY_SCRIPTS = {
    k: sorted((v.parent / "scripts").glob("*.py"))
    for k, v in JS_PKG_JSON.items()
    if (v.parent / "scripts").exists()
}

# special things for jupyterlab-drawio-webpack
JDW = JS_PKG_JSON["jupyterlab-drawio-webpack"].parent
JDW_APP = JDW / "drawio/src/main/webapp/js/app.min.js"
JDW_PY = (JDW / "scripts").rglob("*.py")
DRAWIO = JDW / "drawio"
JDW_LIB = JDW / "lib"
JDW_IGNORE = JDW / ".npmignore"
ALL_JDW_JS = JDW_LIB.glob("*.js")

# mostly linting
ALL_PY = [DODO, *SCRIPTS.glob("*.py"), *sum(JS_PY_SCRIPTS.values(), [])]
ALL_YML = [*ROOT.glob("*.yml"), *CI.rglob("*.yml")]
ALL_JSON = [
    *ROOT.glob("*.json"),
    *PACKAGES.glob("*/*.json"),
    *PACKAGES.glob("*/schema/*.json"),
]
ALL_MD = [*ROOT.glob("*.md"), *PACKAGES.glob("*/*.md")]
ALL_TS = sum(JS_TSSRC.values(), [])
ALL_CSS = sum(JS_STYLE.values(), [])
ALL_PRETTIER = [*ALL_YML, *ALL_JSON, *ALL_MD, *ALL_TS, *ALL_CSS]

# package: [dependencies, targets]
JS_PKG_PACK = {k: [[v.parent / "package.json"], [v]] for k, v in JS_TARBALL.items()}
[
    JS_PKG_PACK[k][0].append(v)
    for k, v in JS_TSBUILDINFO.items()
    if not k.startswith("_")
]
JS_PKG_PACK[JDW.name][0] += [
    JDW_IGNORE,
    JDW_APP,
    *ALL_JDW_JS,
]


# built files
OK_SUBMODULES = BUILD / "submodules.ok"
OK_BLACK = BUILD / "black.ok"
OK_FLAKE8 = BUILD / "flake8.ok"
OK_ISORT = BUILD / "isort.ok"
OK_LINT = BUILD / "lint.ok"
OK_PYFLAKES = BUILD / "pyflakes.ok"
OK_PRETTIER = BUILD / "prettier.ok"
OK_ESLINT = BUILD / "eslint.ok"
OK_JS_BUILD_PRE = BUILD / "js.build.pre.ok"
OK_JS_BUILD = BUILD / "js.build.ok"

# built artifacts
EXAMPLE_HTML = [DIST_NBHTML / p.name.replace(".ipynb", ".html") for p in EXAMPLE_IPYNB]

LINK_EXTENSIONS = [
    "jupyter",
    "labextension",
    "link",
    "--debug",
    "--no-build",
    *[v.parent for k, v in JS_PKG_JSON_LABEXT.items()],
]

INSTALL_EXTENSIONS = [
    "jupyter",
    "labextension",
    "install",
    "--debug",
    "--no-build",
    *EXTENSIONS,
]

LIST_EXTENSIONS = ["jupyter", "labextension", "list"]
