""" patch drawio sources for embedding in JupyterLab
"""
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
DRAWIO = ROOT / "drawio"
APP_MIN = DRAWIO / "src/main/webapp/js/app.min.js"
PATCHES = {
    APP_MIN: [
        {
            "name": "global ref so we can get at the App at runtime",
            "before": "b=null!=e?e():new App(new Editor",
            "after": "\nwindow.JUPYTERLAB_DRAWIO_APP = b=null!=e?e():new App(new Editor",
        },
        {
            "name": "plugin path so this can be hosted on non-root",
            "before": """;window.PLUGINS_BASE_PATH=window.PLUGINS_BASE_PATH||"";""",
            "after": """;window.PLUGINS_BASE_PATH=window.PLUGINS_BASE_PATH||".";""",
        },
    ]
}


def patch():
    for path, patches in PATCHES.items():
        print("checkout", path)
        subprocess.check_call(
            ["git", "checkout", str(path.relative_to(DRAWIO))], cwd=DRAWIO
        )
        txt = path.read_text(encoding="utf-8")

        for patch in patches:
            print("  ", patch["name"])
            if patch["before"] not in txt:
                print("Couldn't find", patch["before"])
            elif patch["after"] not in txt:
                print("   ...patching")
                txt = txt.replace(patch["before"], patch["after"])
            else:
                print("   ...nothing to do")

        path.write_text(txt, encoding="utf-8")


if __name__ == "__main__":
    patch()
