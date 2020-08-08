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
JS_NS = "@deathbeds"
JDIO = PACKAGES / "jupyterlab-drawio"
JDIO_SRC = JDIO / "src"
JDIO_PKG = JDIO / "package.json"
JDIO_PKG_DATA = json.loads(JDIO_PKG.read_text(encoding="utf-8"))
JDIO_STYLE = JDIO / "style"
JDIO_TSBUILD = JDIO / "lib" / ".tsbuildinfo"
JDIO_TARBALL = JDIO / f"""deathbeds-jupyterlab-drawio-{JDIO_PKG_DATA["version"]}.tgz"""

JDW = PACKAGES / "jupyterlab-drawio-webpack"
JDW_APP = JDW / "drawio/src/main/webapp/js/app.min.js"
JDW_PKG = JDW / "package.json"
JDW_PKG_DATA = json.loads(JDW_PKG.read_text(encoding="utf-8"))
JDW_PY = (JDW / "scripts").rglob("*.py")
DRAWIO = JDW / "drawio"
JDW_LIB = JDW / "lib"
JDW_IGNORE = JDW / ".npmignore"
ALL_JDW_JS = JDW_LIB.glob("*.js")
JDW_TARBALL = (
    JDW / f"""deathbeds-jupyterlab-drawio-webpack-{JDW_PKG_DATA["version"]}.tgz"""
)

# mostly linting
ALL_PY = [DODO, *SCRIPTS.glob("*.py"), *JDW_PY]
ALL_YML = [*ROOT.glob("*.yml"), *CI.rglob("*.yml")]
ALL_JSON = [
    *ROOT.glob("*.json"),
    *PACKAGES.glob("*/*.json"),
    *PACKAGES.glob("*/schema/*.json"),
]
ALL_MD = [*ROOT.glob("*.md"), *PACKAGES.glob("*/*.md")]
ALL_TS = [*JDIO_SRC.rglob("*.ts")]
ALL_CSS = [*JDIO_STYLE.rglob("*.css")]
ALL_PRETTIER = [*ALL_YML, *ALL_JSON, *ALL_MD, *ALL_TS, *ALL_CSS]

PKG_PACK = {
    JDIO: [[JDIO / "package.json", JDIO_TSBUILD], JDIO_TARBALL],
    JDW: [[JDW / "package.json", JDW_IGNORE, JDW_APP, *ALL_JDW_JS], JDW_TARBALL],
}


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
