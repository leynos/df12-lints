# df12-lints

Shared df12 lint tooling for JavaScript and TypeScript projects.

The package provides an Oxlint plugin at `df12-lints/oxlint-plugin` and a
small package metadata export from `df12-lints`. The plugin contains local
rules for conditional complexity and JavaScript documentation contracts.

## Installation

The package is not published to a registry. Install it as a tag-pinned git
dependency:

```bash
bun add df12-lints@github:leynos/df12-lints#v0.0.0
# or
npm install github:leynos/df12-lints#v0.0.0
```

A `prepare` script builds the package on install. Bun blocks dependency
lifecycle scripts by default, so Bun consumers must allow it by adding
`df12-lints` to `trustedDependencies`. See
[docs/users-guide.md](docs/users-guide.md#installation) for details.

## Usage

Load the plugin from an Oxlint configuration:

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
[docs/users-guide.md](docs/users-guide.md) for the full rule contract and maintenance
policy.
