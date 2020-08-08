# CONTRIBUTING

## Prerequisites

- `jupyterlab >=2.2,<3`
- `nodejs >=10`
- `doit =0.32`

### Recommended: conda

- Get [Miniconda3][]

```bash
conda env update --file .ci/environment.yml
source activate jupyterlab-drawio
```

## Get to a working Lab

```bash
doit lab
```

## Run Tests

```bash
doit test
```

## Prepare a Release

```bash
doit release
```

[miniconda3]: https://repo.anaconda.com/miniconda/
