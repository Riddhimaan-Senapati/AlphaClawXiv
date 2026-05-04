# Code Structure

AlphaClawXiv is intentionally small. The package is a native OpenClaw plugin
with one runtime entry point and one skill bundle.

## Repository Layout

```text
.
|-- README.md
|-- CONTRIBUTING.md
|-- docs/
|   |-- AUTOMATED_RELEASES.md
|   |-- CODE_STRUCTURE.md
|   `-- PUBLISHING.md
|-- .github/
|   |-- ISSUE_TEMPLATE/
|   |-- PULL_REQUEST_TEMPLATE.md
|   `-- workflows/
|       `-- release.yml
`-- plugins/
    `-- alphaclawxiv/
        |-- package.json
        |-- openclaw.plugin.json
        |-- dist/
        |   `-- index.js
        `-- skills/
            `-- alphaxiv/
                `-- SKILL.md
```

## Runtime Package

`plugins/alphaclawxiv` is the publishable npm and ClawHub package. The package
name is `alphaclawxiv`; the project and display name are `AlphaClawXiv`.

Important files:

- `package.json`: npm metadata, package files, executable mapping, and OpenClaw compatibility metadata.
- `openclaw.plugin.json`: OpenClaw plugin manifest used by plugin installers and registries.
- `dist/index.js`: executable runtime entry point and native OpenClaw plugin implementation.
- `skills/alphaxiv/SKILL.md`: agent-facing usage guidance for AlphaXiv research workflows.

## Runtime Responsibilities

`dist/index.js` handles all plugin behavior:

- OAuth login, status, and logout commands.
- Safe local token storage under `~/.openclaw/alphaxiv`.
- Compatibility export for OpenClaw plugin loading.
- Native tool registration for AlphaXiv paper search, paper content, targeted PDF passage retrieval, and GitHub repository reads.
- Optional generic MCP config installation for debugging only.

The runtime should not perform network calls at module import time. Network
calls should happen only after a user command or OpenClaw tool invocation.

## Naming Rules

Use `AlphaClawXiv` for the project, documentation prose, UI display names, and
OpenClaw plugin display text.

Use `alphaclawxiv` only where lowercase identifiers are required or conventional:

- npm package name.
- ClawHub package name.
- OpenClaw command name.
- filesystem path under `plugins/`.
- executable name in `package.json`.

## Auth State

AlphaClawXiv stores local auth state outside the repository:

- `~/.openclaw/alphaxiv/oauth.json`
- `~/.openclaw/.env` entry for `ALPHAXIV_AUTH_HEADER`

These files must never be copied into the repository, examples, fixtures, logs,
or issue comments.

## Adding Features

When adding a new AlphaXiv capability:

- Add the tool definition and handler in `dist/index.js`.
- Add CLI coverage if the workflow should be usable from a terminal.
- Update `skills/alphaxiv/SKILL.md` so agents know when to use it.
- Update README examples if the feature is user-facing.
- Run `node --check ./plugins/alphaclawxiv/dist/index.js`.
- Run at least one authenticated OpenClaw smoke test.
