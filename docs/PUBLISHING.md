# Publishing AlphaClawXiv

This document is for maintainers publishing `alphaclawxiv` to npm and ClawHub.
User-facing install and usage instructions belong in the README.

Automated GitHub Release publishing is the preferred path. See
[Automated Releases](./AUTOMATED_RELEASES.md) for repository secrets, release
tag conventions, and workflow behavior. Use the manual steps below only for
one-off recovery or local verification.

## Preconditions

- You have npm publish access for `alphaclawxiv`.
- You have ClawHub publish access for the package.
- The working tree only contains intentional changes.
- `package.json` version has been bumped.
- `plugins/alphaclawxiv/openclaw.plugin.json` version matches `package.json`.
- OpenClaw compatibility metadata is current:
  - `openclaw.compat.pluginApi`
  - `openclaw.compat.minGatewayVersion`
  - `openclaw.build.openclawVersion`
  - `openclaw.build.pluginSdkVersion`

## Automated Release Path

1. Bump `plugins/alphaclawxiv/package.json`.
2. Bump `plugins/alphaclawxiv/openclaw.plugin.json` to the same version.
3. Run the verification steps below.
4. Commit and push the release changes.
5. Publish a GitHub Release with a tag matching the package version.

The release workflow publishes to npm with provenance and then publishes the
same version to ClawHub with source metadata.

## Verification

Run syntax checks:

```powershell
node --check ./plugins/alphaclawxiv/dist/index.js
```

Run a local OpenClaw smoke test:

```powershell
openclaw plugins install ./plugins/alphaclawxiv --force
openclaw alphaclawxiv auth status
openclaw alphaclawxiv paper search "retrieval augmented generation"
openclaw gateway status
openclaw gateway health
```

Check npm package contents:

```powershell
cd plugins/alphaclawxiv
npm pack --dry-run
cd ../..
```

On Windows, if the PowerShell `npm` shim has permission problems, call `npm.cmd`
directly:

```powershell
& "C:\Program Files\nodejs\npm.cmd" pack --dry-run
```

Check ClawHub package contents:

```powershell
$version = node -p "require('./plugins/alphaclawxiv/package.json').version"
$commit = git rev-parse HEAD
clawhub package publish ./plugins/alphaclawxiv `
  --family code-plugin `
  --version $version `
  --changelog "Release $version" `
  --source-repo Riddhimaan-Senapati/AlphaClawXiv `
  --source-commit $commit `
  --source-ref main `
  --source-path plugins/alphaclawxiv `
  --dry-run
```

Expected publish contents:

- `dist/index.js`
- `LICENSE`
- `openclaw.plugin.json`
- `package.json`
- `README.md`
- `skills/alphaxiv/SKILL.md`

## Publish to npm

From the package directory:

```powershell
cd plugins/alphaclawxiv
npm publish
cd ../..
```

For scoped packages in the future, use `npm publish --access public`.

## Publish to ClawHub

From the repository root:

```powershell
$version = node -p "require('./plugins/alphaclawxiv/package.json').version"
$commit = git rev-parse HEAD
clawhub package publish ./plugins/alphaclawxiv `
  --family code-plugin `
  --version $version `
  --changelog "Release $version" `
  --source-repo Riddhimaan-Senapati/AlphaClawXiv `
  --source-commit $commit `
  --source-ref main `
  --source-path plugins/alphaclawxiv
```

## Post-Publish Checks

Verify npm metadata:

```powershell
npm view alphaclawxiv name version
```

Verify install from ClawHub:

```powershell
openclaw plugins install clawhub:alphaclawxiv --force
openclaw alphaclawxiv auth status
```

On Windows, prefer the explicit `clawhub:` prefix even for manual verification.
If a local folder named `AlphaClawXiv` or `alphaclawxiv` is near the current
working directory, OpenClaw can mis-resolve `openclaw plugins install
alphaclawxiv --force` as a local path or hook-pack install instead of a ClawHub
package install.

If reinstall fails with `EPERM` while renaming
`~/.openclaw/extensions/alphaclawxiv`, stop the OpenClaw gateway first, remove
the stale installed extension directory if needed, and retry the install.

Verify badges on the README:

- npm version badge resolves.
- npm monthly downloads badge resolves.
- ClawHub package link opens the package page.

## Rollback

If a bad npm package is published, npm generally does not allow republishing the
same version. Publish a patch release with the fix.

If a ClawHub package has a bad release, publish a corrected version and update
release notes to identify the broken version.
