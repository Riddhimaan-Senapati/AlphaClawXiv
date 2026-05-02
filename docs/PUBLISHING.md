# Publishing Alphaclawxiv

This document is for maintainers publishing `alphaclawxiv` to npm and ClawHub.
User-facing install and usage instructions belong in the README.

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
clawhub package publish ./plugins/alphaclawxiv --dry-run --family code-plugin
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
clawhub package publish ./plugins/alphaclawxiv --family code-plugin
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

Verify badges on the README:

- npm version badge resolves.
- npm monthly downloads badge resolves.
- ClawHub package link opens the package page.

## Rollback

If a bad npm package is published, npm generally does not allow republishing the
same version. Publish a patch release with the fix.

If a ClawHub package has a bad release, publish a corrected version and update
release notes to identify the broken version.
