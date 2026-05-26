# df12-lints

Shared df12 lint tooling for JavaScript and TypeScript projects.

The package provides an Oxlint plugin at `df12-lints/oxlint-plugin` and a
small package metadata export from `df12-lints`. The plugin contains local
rules for conditional complexity and JavaScript documentation contracts.

## Usage

Install the package and load the plugin from an Oxlint configuration:

```json
{
  "jsPlugins": ["df12-lints/oxlint-plugin"],
  "rules": {
    "df12/complex-conditional": "error",
    "df12/require-module-jsdoc": "error",
    "df12/require-private-jsdoc": "error",
    "df12/require-public-jsdoc": "error"
  }
}
```

This repository runs checks through the Makefile:

```bash
make check-fmt
make typecheck
make lint
make test
```

Those targets delegate to `package.json` scripts. See
[docs/usage.md](docs/usage.md) for the full rule contract and maintenance
policy.
