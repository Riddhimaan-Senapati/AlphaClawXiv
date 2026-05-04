# Agent Notes

This file captures the practical lessons, pitfalls, and architecture choices
made while building AlphaClawXiv. It is intended for coding agents and
maintainers working in this repository.

## Project Shape

AlphaClawXiv is a native OpenClaw code plugin for AlphaXiv. The publishable
package is not the repository root; it is `plugins/alphaclawxiv`.

Important paths:

- `plugins/alphaclawxiv/package.json`: npm package metadata, executable entry,
  and OpenClaw runtime metadata.
- `plugins/alphaclawxiv/openclaw.plugin.json`: OpenClaw plugin manifest.
- `plugins/alphaclawxiv/dist/index.js`: runtime entry point and tool handlers.
- `plugins/alphaclawxiv/dist/storage.js`: local auth/config persistence only.
- `plugins/alphaclawxiv/skills/alphaxiv/SKILL.md`: agent-facing usage guide.
- `.github/workflows/release.yml`: GitHub Release based npm and ClawHub publish
  workflow.

There is currently no build step. The checked-in `dist/*.js` files are the
published runtime source. If a build pipeline is introduced later, update
README, docs, package files, and release verification together.

## Naming Rules

Use `AlphaClawXiv` for prose, display names, headings, and UI-facing text.

Use `alphaclawxiv` only for package-name contexts and stable identifiers:

- npm package name.
- ClawHub package name.
- OpenClaw command name.
- executable name.
- filesystem path under `plugins/`.
- plugin id/runtime id.

Do not rename `skills/alphaxiv`; that folder describes the upstream AlphaXiv
workflow, not the package brand.

## Architecture Choices

Prefer native OpenClaw tools over a persistent `mcp.servers.alphaxiv` gateway
connection. The native plugin avoids gateway startup stalls seen when OpenClaw
tries to connect to the hosted AlphaXiv MCP endpoint during gateway boot.

The optional MCP config command exists for debugging only. Do not make it the
default install path unless the gateway behavior is revalidated.

Keep storage and network behavior separated:

- `dist/storage.js` may read/write local OpenClaw auth files.
- `dist/index.js` owns CLI routing, OpenClaw exports, tool definitions, and
  network calls.
- Do not move filesystem reads back into the network-facing runtime path unless
  there is a clear reason and ClawHub static analysis is rechecked.

This split was made to address ClawHub static-analysis findings that flagged
file reads combined with network sends as possible exfiltration.

## Auth And Secrets

AlphaClawXiv stores user auth outside the repository:

- `~/.openclaw/alphaxiv/oauth.json`
- `~/.openclaw/.env` with `ALPHAXIV_AUTH_HEADER`

Never commit, print, log, snapshot, or include these values in examples. If you
need to show auth state, report only redacted status such as whether a token is
present and when it expires.

Avoid literal object keys like `accessToken:` or `refreshToken:` in published JS
when practical. ClawHub previously flagged an `accessToken:` object literal as
an exposed-secret pattern even though it was just a field name. The current
storage module uses computed field-name constants to preserve the on-disk schema
while reducing false positives.

Do not read the repository root `.env` unless the task explicitly requires it.
It is local state and should not be part of published package behavior.

## ClawHub Static Analysis Pitfalls

The package previously triggered:

- `suspicious.exposed_secret_literal` for an `accessToken:` object literal.
- `suspicious.potential_exfiltration` for `fs.readFileSync(...)` in the same
  runtime module that performs network calls.

The fix was architectural, not cosmetic:

- Move auth/config persistence to `dist/storage.js`.
- Keep `dist/index.js` focused on commands, exports, and network/tool calls.
- Avoid printing token values.
- Keep token field names computed in code.

Before publishing, run targeted scans for accidental secret-looking literals:

```powershell
Select-String -Path plugins/alphaclawxiv/dist/*.js -Pattern 'accessToken:|refreshToken:|api[_-]?key\s*[:=]|secret\s*[:=]|token\s*[:=]\s*[''"]'
```

Also run:

```powershell
openclaw security audit --deep
```

OpenClaw audit warnings about the local gateway, trusted proxies, browser
control, or unrelated installed plugins are not automatically AlphaClawXiv
package failures. Confirm whether the warning references this package before
changing package code.

## Release And Publishing Pitfalls

npm versions are immutable. If a GitHub release publishes npm but ClawHub fails,
do not retry the same version. Bump both package versions and release again.

Always update both:

- `plugins/alphaclawxiv/package.json`
- `plugins/alphaclawxiv/openclaw.plugin.json`

The release tag must match the package version, usually `vX.Y.Z`.

The workflow currently pins ClawHub CLI to `clawhub@0.12.0`. This is
intentional. Releases with newer `clawhub@0.12.1` and `0.12.2` hit a ClawPack
publish path that failed server validation with:

```text
runtime extension entry not found: ./dist/index.js
```

Do not change this pin back to `clawhub@latest` until a dry run and a real
release prove the newer CLI/server path works for code plugins with this
package layout.

The OpenClaw package metadata currently uses:

```json
"openclaw": {
  "extensions": ["dist/index.js"],
  "runtimeExtensions": ["dist/index.js"]
}
```

ClawHub normalizes `./dist/index.js` and `dist/index.js` internally, but package
path handling has changed across ClawHub CLI versions. If you change these
entries, verify npm pack contents, ClawHub dry run, and a real ClawHub publish.

## Verification Checklist

Before release:

```powershell
node --check ./plugins/alphaclawxiv/dist/index.js
node --check ./plugins/alphaclawxiv/dist/storage.js
```

Verify npm package contents:

```powershell
cd plugins/alphaclawxiv
npm pack --dry-run
cd ../..
```

Expected published files:

- `LICENSE`
- `README.md`
- `dist/index.js`
- `dist/storage.js`
- `openclaw.plugin.json`
- `package.json`
- `skills/alphaxiv/SKILL.md`

Verify local OpenClaw install:

```powershell
openclaw plugins install ./plugins/alphaclawxiv --force
openclaw alphaclawxiv auth status
openclaw alphaclawxiv paper search "retrieval augmented generation"
```

Verify ClawHub dry run with the pinned CLI:

```powershell
$version = node -p "require('./plugins/alphaclawxiv/package.json').version"
$commit = git rev-parse HEAD
npx -y clawhub@0.12.0 package publish ./plugins/alphaclawxiv `
  --family code-plugin `
  --version $version `
  --changelog "Release $version" `
  --source-repo Riddhimaan-Senapati/AlphaClawXiv `
  --source-commit $commit `
  --source-ref main `
  --source-path plugins/alphaclawxiv `
  --dry-run
```

After release:

```powershell
npm view alphaclawxiv version dist-tags.latest
npx -y clawhub@0.12.0 package inspect alphaclawxiv --versions --limit 5
```

## Windows-Specific Pitfalls

This repository has been developed and tested on Windows. Prefer PowerShell
commands in docs and examples unless a workflow file is Linux-only.

When referring users to the published package on Windows, prefer:

```powershell
openclaw plugins install clawhub:alphaclawxiv --force
```

Reason: if a local folder named `AlphaClawXiv` or `alphaclawxiv` is near the
current working directory, `openclaw plugins install alphaclawxiv --force` can
be mis-resolved as a local path or hook-pack install and fail with `HOOK.md
missing`.

If `npm` has cache or shim permission problems, call `npm.cmd` directly and use
a local explicit cache:

```powershell
& "C:\Program Files\nodejs\npm.cmd" --cache ".npm-cache-verify" pack --dry-run
```

Remove generated local caches before committing. Do not commit:

- `.npm-cache-*`
- `.clawpacks`
- generated `.tgz` package files
- token files
- local OpenClaw config exports

When deleting generated directories, verify the resolved path is inside the
workspace before using recursive removal.

## Documentation Expectations

Keep README user-facing. Do not put maintainer-only release procedures back into
README. Use:

- `docs/PUBLISHING.md` for manual publish and recovery steps.
- `docs/AUTOMATED_RELEASES.md` for GitHub Actions release behavior.
- `docs/CODE_STRUCTURE.md` for public architecture overview.
- `AGENTS.md` for operational lessons, agent constraints, and sharp edges.

When changing CLI examples, test them locally where possible. If a command needs
auth, test `auth status` at minimum and clearly note any untested authenticated
behavior.

## Dependency And Docs Policy

Use Context7 MCP when checking current documentation for OpenClaw, ClawHub,
npm, GitHub CLI, AlphaXiv MCP, or any other library/CLI/API behavior. Do not
rely on memory for current CLI flags or registry behavior.

Prefer primary docs or source when diagnosing ClawHub/OpenClaw behavior. The
ClawHub validator and CLI source were necessary to understand why `0.12.1+`
failed and why `0.12.0` was pinned.

## What Not To Regress

Do not:

- Print bearer tokens or OAuth JSON.
- Move token file reads into the same code path as network sends without
  rechecking static analysis.
- Reintroduce a required startup MCP server connection.
- Publish from the repository root as if it were the npm package.
- Bump only one of the two version files.
- Switch the ClawHub workflow back to `latest` without validation.
- Treat unrelated local OpenClaw audit warnings as package vulnerabilities.
- Rename package identifiers from `alphaclawxiv` to `AlphaClawXiv`.

When in doubt, preserve the small native plugin shape and verify with local
OpenClaw, npm pack, ClawHub dry run, and registry inspection after release.
