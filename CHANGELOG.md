# Changelog

## [0.1.0] - 2026-06-19

_Initial shared-package release. If you are replacing a vendored in-repo fork,
see the
[`Migrating from an in-repo fork`](docs/users-guide.md#migrating-from-an-in-repo-fork)
guide._

### Changed

- **JSDoc baseline:** Baseline loading now returns a result object with
  `{ baseline, ok, error }` state through the test-only helper surface instead
  of returning a `Set` directly, and current releases memoize baseline reads
  per directory within one lint process ([#6], [#12]).
- **JSDoc baseline:** Repository-relative baseline keys now resolve from
  `context.cwd`, then `context.getCwd()`, then `process.cwd()`, so Oxlint
  invocations from subdirectories can still use repository-relative entries
  when the lint context provides its working directory ([#12]).
- **JSDoc baseline:** Malformed `.jsdoc-baseline.json` files now report an
  Oxlint diagnostic instead of being silently treated as an empty baseline, as
  tracked by [issue 12][#12].
- **Complex conditional:** `maxLogicalOperators` is now validated as a positive
  integer, with invalid values falling back to `1` ([#12]).
- **Distribution:** The supported installation model is a git dependency pinned
  to an immutable release tag; the package remains private and unpublished
  while the git distribution model is in place ([#4], [#11]).

### Added

- Add the generated root package export, install-time `prepare` build, package
  file whitelist, and ISC license file required for reliable git and packed
  installs ([#2], [#3], [#5], [#7], [#9], [#10]).

[#2]: https://github.com/leynos/df12-lints/issues/2
[#3]: https://github.com/leynos/df12-lints/issues/3
[#4]: https://github.com/leynos/df12-lints/issues/4
[#5]: https://github.com/leynos/df12-lints/issues/5
[#6]: https://github.com/leynos/df12-lints/issues/6
[#7]: https://github.com/leynos/df12-lints/pull/7
[#9]: https://github.com/leynos/df12-lints/pull/9
[#10]: https://github.com/leynos/df12-lints/pull/10
[#11]: https://github.com/leynos/df12-lints/pull/11
[#12]: https://github.com/leynos/df12-lints/issues/12
[0.1.0]: https://github.com/leynos/df12-lints/releases/tag/v0.1.0
