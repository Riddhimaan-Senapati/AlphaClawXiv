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
- `plugins/alphaclawxiv/src/*.ts`: TypeScript source (config, storage, mcp,
  actions, oauth, pdf, tool-definitions, sdk-types, index).
- `plugins/alphaclawxiv/src/commands/*.ts`: oclif command classes (built to
  `dist/commands/`).
- `plugins/alphaclawxiv/bin/run.js`: checked-in oclif runner (the
  `alphaclawxiv` binary).
- `plugins/alphaclawxiv/dist/*.js`: build output from `tsc`. Not committed.
- `plugins/alphaclawxiv/skills/alphaxiv/SKILL.md`: agent-facing usage guide.
- `.github/workflows/release.yml`: GitHub Release based npm and ClawHub publish
  workflow.

There is a build step. `tsc -p tsconfig.json` compiles `src/` to `dist/`, and the
`prepack` script runs the build so `npm pack` ships a fresh `dist/`. `dist/` is
gitignored and is not committed; it is produced locally and in CI. If the build
or editor produces `dist/` locally, never commit it.

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

Do not assume the public AlphaXiv MCP docs page exactly matches the live hosted
server. As of the 2026.8 docs the hosted surface is:

- Research: `discover_papers`, `get_paper_content`, `answer_pdf_queries`,
  `read_files_from_github_repository`.
- Researcher: `find_researchers`, `get_researcher`, `get_researcher_papers`,
  `resolve_researchers`, `list_followed_researchers`, `follow_researcher`,
  `unfollow_researcher`.
- Library: `list_library`, `save_papers_to_folder`, `remove_papers_from_folder`,
  `move_papers_between_folders`, `create_folder`, `rename_folder`,
  `delete_folder`, `edit_private_paper_metadata`.

The plugin registers this full surface. CLI search variants are local wrappers
over `discover_papers`, but those wrapper names are not hosted MCP tool names.

The optional MCP config command exists for debugging only. Do not make it the
default install path unless the gateway behavior is revalidated.

Keep storage and network behavior separated:

- `src/storage.ts` may read/write local OpenClaw auth files.
- `src/index.ts` owns OpenClaw exports, tool registration, and the prompt hint.
- `src/mcp.ts` owns network calls; `src/actions.ts` holds the per-tool action
  functions; `src/tool-definitions.ts` builds the 19 tool schemas.
- `src/oauth.ts` and `src/pdf.ts` are self-contained; `src/cli-forward.ts`
  forwards `openclaw alphaclawxiv ...` to the oclif CLI.
- Do not move filesystem reads back into the network-facing runtime path unless
  there is a clear reason and ClawHub static analysis is rechecked.

This split was made to address ClawHub static-analysis findings that flagged
file reads combined with network sends as possible exfiltration.

## Local OpenClaw Gateway Setup

The plugin's `compat.pluginApi` / `minGatewayVersion` are `>=2026.8.1`. To run
that, the gateway must be at least 2026.8.1, which requires Node
`>=24.15.0 <25` (or `>=22.22.3 <23`, or `>=25.9.0`). OpenClaw 2026.5.x only
needs Node `>=22.19.0`. If `npm install -g openclaw` fails with the preinstall
"this OpenClaw release requires Node ..." message, the Node version is too old.

After bumping OpenClaw, the old `~/.openclaw/openclaw.json` is rejected with
schema-drift errors (`Unrecognized key`, `retired`). Run `openclaw doctor --fix`
to migrate config keys, auth profile, workspace setup state, and the audit log,
then `openclaw config validate`.

The plugin's `before_prompt_build` prompt-hint hook is a conversation hook. On
non-bundled plugins OpenClaw blocks it unless the plugin entry opts in:

```json
{
  "plugins": {
    "entries": {
      "alphaclawxiv": {
        "enabled": true,
        "hooks": { "allowConversationAccess": true }
      }
    }
  }
}
```

The gateway log reports `typed hook "before_prompt_build" blocked ...` when it is
not set.

Installing the plugin can land it in a state that needs capability consent:
`openclaw plugins enable alphaclawxiv --accept-capabilities`. A clean
`openclaw plugins list` row shows `enabled` with no `requires capability
consent` warning.

`openclaw gateway restart` waits for health and can hang in this environment;
`openclaw gateway stop --force` then `openclaw gateway start` restarts the
detached service. The gateway is a detached Windows service, so killing a shell
that spawned it does not stop it. In this environment the gateway takes ~70-80s
to reach `http server listening` (slow agent SQLite open + a
`registry.npmjs.org/openclaw/latest` fetch timeout), which is why restart/start
commands appear to hang; the gateway does come up. A direct
`node .../openclaw/dist/index.js gateway --port 18789` also starts it and
survives the shell that spawned it.

## Auth And Secrets

AlphaClawXiv stores user auth outside the repository:

- `~/.openclaw/alphaxiv/oauth.json`
- `~/.openclaw/.env` with `ALPHAXIV_AUTH_HEADER`

The AlphaXiv OAuth server is path-bearing. The MCP server advertises its
protected-resource metadata via `WWW-Authenticate`:
`resource_metadata="https://api.alphaxiv.org/.well-known/oauth-protected-resource/mcp/v1"`
and `scope="email profile"`. The protected resource identifier is the MCP
endpoint `https://api.alphaxiv.org/mcp/v1`, NOT the origin. Build the resource
metadata URL by inserting `/.well-known/oauth-protected-resource` after the
origin and keeping the MCP path (RFC 9728). The authorization server metadata is
at the path-inserted URL
`https://api.alphaxiv.org/auth/.well-known/oauth-authorization-server`, NOT at
the origin root; build it by appending `/.well-known/oauth-authorization-server`
to the server path. Using the origin (`https://api.alphaxiv.org`) as the
resource causes the token exchange to fail with `requested resource invalid`.
The resource scope is `email profile`. The authorization server supports `S256`
PKCE and public clients (`token_endpoint_auth_method: none`).

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
- Keep `dist/index.js` (and the CLI/action modules) focused on commands,
  exports, and network/tool calls.
- Avoid printing token values.
- Keep token field names computed in code.

Since the migration to TypeScript, the runtime depends on `@oclif/core` and
`typebox`. These are declared in `dependencies` and must resolve when the plugin
is installed by OpenClaw or ClawHub. `openclaw` is deliberately not a runtime
dependency: the plugin entry is typed against a local `src/sdk-types.ts` surface
that mirrors the real `openclaw/plugin-sdk` signatures, and it does not import
`openclaw` at runtime. Do not add a runtime `openclaw` import.

Before publishing, run targeted scans for accidental secret-looking literals:

```powershell
Get-ChildItem -Path plugins/alphaclawxiv/dist -Recurse -Include *.js | Select-String -Pattern 'accessToken:|refreshToken:|api[_-]?key\s*[:=]|secret\s*[:=]|token\s*[:=]\s*[''"]'
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

The workflow currently pins ClawHub CLI to `clawhub@0.17.0` and publishes an
explicit npm-pack `.tgz` ClawPack. This is intentional. OpenClaw warns about
packages published through the legacy ZIP path:

```text
This plugin uses the legacy ZIP path and may have compatibility issues until the publisher uploads a ClawPack.
```

Older releases used `clawhub@0.12.0` because `0.12.1` and `0.12.2` hit a
ClawPack publish path that failed server validation with `runtime extension
entry not found: ./dist/index.js`. Current `clawhub@0.17.0` dry-run validation
succeeds when publishing the `.tgz` generated by `npm pack`, so do not revert to
the legacy ZIP publish path.

### npm token expiry

The npm `NPM_TOKEN` used by the release workflow is a short-lived automation
token that expires after 7 days. Recreate it for every release, or the npm
publish step fails with:

```text
npm error 404 Not Found - PUT https://registry.npmjs.org/<package> - Not found
npm error 404  '<package>@<version>' is not in this registry.
```

E404 on `PUT` is the signature of an unauthenticated publish (the registry does
not recognize the expired/revoked token). Refresh the token before each release,
logged in as the npm account that owns the package (`npm whoami` must return
that user):

```powershell
npm token create --name "alphaclawxiv-publish" --packages alphaclawxiv --packages-and-scopes-permission read-write
gh secret set NPM_TOKEN --body "<token>"
```

`npm token create` requires `--name` in npm 11; omitting it fails with
`Token name is required`. Do not pass `--read-only` (it blocks publishing). The
ClawHub `CLAWHUB_TOKEN` is stored in the clawhub CLI at `%APPDATA%\clawhub` and
is validated with `clawhub whoami`.

### Manual release procedure

To release a new version end to end (npm + ClawHub), from the repository root:

```powershell
# 1. Set the version in both files (must match, and match the tag vX.Y.Z)
#    - plugins/alphaclawxiv/package.json
#    - plugins/alphaclawxiv/openclaw.plugin.json

# 2. Verify the build and package
cd plugins/alphaclawxiv
npm ci
npm run build
npm run typecheck
Get-ChildItem -Path dist -Recurse -Include *.js | ForEach-Object { node --check $_.FullName }
cd ../..
npm pack ./plugins/alphaclawxiv --json --ignore-scripts --pack-destination C:\tmp

# 3. Verify the oclif CLI discovers every command
cd plugins/alphaclawxiv
node bin/run.js --help
node bin/run.js auth status
cd ../..

# 4. Refresh the npm token (see above), then ClawHub dry-run
$version = node -p "require('./plugins/alphaclawxiv/package.json').version"
$commit = git rev-parse HEAD
npx -y clawhub@0.17.0 package publish "C:\tmp\alphaclawxiv-$version.tgz" `
  --family code-plugin `
  --version $version `
  --changelog "Release $version" `
  --source-repo Riddhimaan-Senapati/AlphaClawXiv `
  --source-commit $commit `
  --source-ref "v$version" `
  --source-path plugins/alphaclawxiv `
  --dry-run

# 5. Commit, tag, push, and create a GitHub Release; the workflow publishes
#    npm and ClawHub. Then confirm:
npm view alphaclawxiv version dist-tags.latest
npx -y clawhub@0.17.0 package inspect alphaclawxiv --versions --limit 5
```

The release workflow (`.github/workflows/release.yml`) runs `npm ci`, `npm run
build`, `npm run typecheck`, validates the built `dist/`, builds the ClawPack
`.tgz`, dry-runs the ClawHub publish, then publishes to npm and ClawHub.

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
cd plugins/alphaclawxiv
npm ci
npm run build
npm run typecheck
Get-ChildItem -Path dist -Recurse -Include *.js | ForEach-Object { node --check $_.FullName }
cd ../..
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
- `bin/run.js`
- `dist/index.js`
- `dist/storage.js`
- `dist/commands/**/*.js`
- `openclaw.plugin.json`
- `package.json`
- `skills/alphaxiv/SKILL.md`

Verify the oclif CLI discovers every command:

```powershell
cd plugins/alphaclawxiv
node bin/run.js --help
node bin/run.js auth status
```

Verify local OpenClaw install (build first):

```powershell
openclaw plugins install ./plugins/alphaclawxiv --force
openclaw alphaclawxiv auth status
openclaw alphaclawxiv paper search "retrieval augmented generation"
```

If you change tool names or input schemas, run an authenticated live check
against the hosted AlphaXiv `tools/list` endpoint or an equivalent direct tool
call before publishing.

Verify ClawHub dry run with the pinned CLI and explicit ClawPack artifact:

```powershell
$version = node -p "require('./plugins/alphaclawxiv/package.json').version"
$commit = git rev-parse HEAD
& "C:\Program Files\nodejs\npm.cmd" pack ./plugins/alphaclawxiv `
  --json `
  --ignore-scripts `
  --pack-destination C:\tmp
npx -y clawhub@0.17.0 package publish "C:\tmp\alphaclawxiv-$version.tgz" `
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
npx -y clawhub@0.17.0 package inspect alphaclawxiv --versions --limit 5
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
ClawHub validator and CLI source were necessary to understand why older
ClawHub releases failed, and why the workflow now publishes an explicit
npm-pack ClawPack with `clawhub@0.17.0`.

## What Not To Regress

Do not:

- Print bearer tokens or OAuth JSON.
- Move token file reads into the same code path as network sends without
  rechecking static analysis.
- Reintroduce a required startup MCP server connection.
- Publish from the repository root as if it were the npm package.
- Bump only one of the two version files.
- Switch the ClawHub workflow back to `latest` or legacy ZIP publishing without
  validation.
- Treat unrelated local OpenClaw audit warnings as package vulnerabilities.
- Rename package identifiers from `alphaclawxiv` to `AlphaClawXiv`.
- Commit `dist/` or `node_modules/`; they are generated or installed artifacts.
- Remove the TypeScript build step or revert `dist/` to checked-in source; the
  release workflow and `prepack` assume `npm run build` produces `dist/`.
- Reintroduce a single-file `dist/index.js` runtime; keep the module split
  (config, storage, mcp, oauth, pdf, actions, tool-definitions, commands).
- Add a runtime `openclaw` import; type the plugin against `src/sdk-types.ts`.
- Break the oclif `topicSeparator: " "` setting or the space-separated
  `openclaw alphaclawxiv paper search ...` command form; agents and the skill
  depend on it.

When in doubt, preserve the small native plugin shape and verify with local
OpenClaw, npm pack, ClawHub dry run, and registry inspection after release.
