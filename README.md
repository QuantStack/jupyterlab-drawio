# jupyterlab-drawio
[![Binder with JupyterLab](https://img.shields.io/badge/launch-jupyterlab_on_binder-red.svg)](http://mybinder.org/v2/gh/kmader/jupyterlab-drawio/master?urlpath=lab)


A JupyterLab extension for standalone integration of drawio / mxgraph into jupyterlab.

## Prerequisites

* JupyterLab

## Installation

```bash
jupyter labextension install jupyterlab-drawio
```

## Development

For a development install (requires npm version 4 or later), do the following in the repository directory:

```bash
npm install
npm run build
jupyter labextension link .
```

To rebuild the package and the JupyterLab app:

```bash
npm run build
jupyter lab build
```

## License

The files herein, and especially the source code of mxgraph, is licensed under the Apache 2.0 License.
The copyright holders of draw.io / mxgraph is jgraph (http://wwww.jgraph.com). The original source code
vendored in this package is taken from: https://github.com/jgraph/mxgraph 