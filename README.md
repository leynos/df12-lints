# df12-lints

Shared df12 lint tooling for JavaScript and TypeScript projects.

The package provides an Oxlint plugin at `df12-lints/oxlint-plugin` and a
small package metadata export from `df12-lints`. The plugin contains local
rules for conditional complexity and JavaScript documentation contracts.

## Installation

The package is deliberately unpublished (`"private": true`) and is consumed
as a git dependency pinned to a release tag. Add it to `package.json` with a
tag reference rather than a bare commit SHA:

```json
{
  "devDependencies": {
    "df12-lints": "github:leynos/df12-lints#v0.1.0"
  }
}
```

The `prepare` script builds the root entry point (`dist/index.js`) at install
time. npm and Yarn run a git dependency's `prepare` script automatically. Bun
blocks dependency lifecycle scripts by default, so Bun consumers must trust
the package first:

```json
{
  "trustedDependencies": ["df12-lints"]
}
```

The `df12-lints/oxlint-plugin` subpath resolves to committed source and works
even when the `prepare` script has not run. See
[docs/users-guide.md](docs/users-guide.md#installation) for details.

## Releases

Releases are cut by tagging the repository (for example `v0.1.0`), following
semantic versioning. Consumers upgrade by moving their pinned tag; tags are
never rewritten. If the package later needs semver ranges or
changelog-driven upgrades, the intended path is publishing to a registry and
dropping `"private": true`.

See [CHANGELOG.md](CHANGELOG.md) for release notes. Projects replacing a
vendored in-repo copy should also read the
[migration guide](docs/users-guide.md#migrating-from-an-in-repo-fork).

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
