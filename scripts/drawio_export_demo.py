import atexit
import os
import subprocess
import sys
from pathlib import Path

from jupyterlab.commands import get_app_dir

HERE = Path(__file__).parent.resolve()
APP = HERE.parent / "drawio-export"
DRAWIO_STATIC = Path(get_app_dir()) / (
    "static/node_modules/jupyterlab-drawio/drawio/src/main/webapp"
)
DRAWIO_SERVER_URL = os.environ.get("DRAWIO_SERVER_URL")
PORT = os.environ.get("PORT")


def main():
    """ start the drawio-export, and (usually) a local http server to serve the assets
    """
    if not (APP / "node_modules").exists():
        print("Installing drawio-export deps in:\n\t", str(APP), flush=True)
        subprocess.check_call(["jlpm"], cwd=str(APP))

    env = dict(os.environ)

    if PORT is None:
        # drawio-export assumes PORT has been set, and defaults to 8000, but explicit is...
        env["PORT"] = "8000"

    if DRAWIO_SERVER_URL is None:
        env["DRAWIO_SERVER_URL"] = DRAWIO_STATIC.as_uri()

    exporter = subprocess.Popen(["jlpm", "start"], cwd=str(APP), env=env)
    print(
        "Starting drawio-export server\n\t",
        f"""http://localhost:{env["PORT"]}""",
        flush=True,
    )

    def stop():
        exporter.terminate()
        exporter.wait()

    atexit.register(stop)

    try:
        return exporter.wait()
    finally:
        stop()

    return 0


if __name__ == "__main__":
    sys.exit(main())
