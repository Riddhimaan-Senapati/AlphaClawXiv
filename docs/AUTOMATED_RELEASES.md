# Automated Releases

AlphaClawXiv is set up for GitHub Release based publishing. A published GitHub
Release triggers `.github/workflows/release.yml`, which verifies the package and
publishes it to npm and ClawHub.

## Release Model

The release workflow runs when a GitHub Release is published:

```yaml
on:
  release:
    types: [published]
```

The release tag should match the package version, with or without a leading
`v`. For example, package version `0.1.1` can be released as `0.1.1` or
`v0.1.1`.

## Required Repository Secrets

Configure these secrets in GitHub:

- `NPM_TOKEN`: npm automation token with publish access to `alphaclawxiv`.
- `CLAWHUB_TOKEN`: ClawHub token accepted by `clawhub login --token ... --no-browser`.

GitHub path:

```text
Repository Settings -> Secrets and variables -> Actions -> New repository secret
```

## npm Publishing

The workflow uses `actions/setup-node` with the npm registry URL, then publishes
the package directory:

```bash
npm publish ./plugins/alphaclawxiv --provenance
```

`--provenance` attaches GitHub Actions build provenance to the npm package when
the workflow has `id-token: write` permission. Keep that permission enabled.

If you later configure npm trusted publishing for this repository, you can
remove `NODE_AUTH_TOKEN` from the npm publish step and rely on npm's trusted
publisher configuration instead. Until then, `NPM_TOKEN` is the portable path.

## ClawHub Publishing

The workflow logs in to ClawHub with `CLAWHUB_TOKEN`, then publishes the same
package with source metadata:

```bash
clawhub package publish ./plugins/alphaclawxiv \
  --family code-plugin \
  --version "$PACKAGE_VERSION" \
  --changelog "$CHANGELOG" \
  --source-repo "$GITHUB_REPOSITORY" \
  --source-commit "$GITHUB_SHA" \
  --source-ref "$GITHUB_REF_NAME" \
  --source-path plugins/alphaclawxiv
```

The source metadata lets ClawHub connect the package artifact back to the exact
GitHub source revision.

## Release Checklist

Before publishing a GitHub Release:

- Update `plugins/alphaclawxiv/package.json`.
- Update `plugins/alphaclawxiv/openclaw.plugin.json`.
- Confirm both versions match.
- Run `node --check ./plugins/alphaclawxiv/dist/index.js`.
- Run `npm pack --dry-run` from `plugins/alphaclawxiv`.
- Confirm README examples and docs match the new behavior.
- Commit and push the release changes.
- Create a GitHub Release with a tag matching the package version.

## Failure Modes

If npm publish fails with an auth error, rotate or replace `NPM_TOKEN`.

If npm publish fails because the version already exists, bump the package and
plugin versions and create a new release tag. npm does not allow overwriting a
published version.

If ClawHub publish fails because the package already exists, publish a new
version. Do not reuse release versions across registries.
