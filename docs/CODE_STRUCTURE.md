# Code Structure

AlphaClawXiv is a small native OpenClaw plugin. It is built from TypeScript into
`dist/` in CI and before `npm pack`, and ships an oclif-based CLI.

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
        |-- tsconfig.json
        |-- bin/
        |   `-- run.js            (checked-in oclif runner)
        |-- src/
        |   |-- index.ts
        |   |-- config.ts
        |   |-- storage.ts
        |   |-- mcp.ts
        |   |-- actions.ts
        |   |-- pdf.ts
        |   |-- oauth.ts
        |   |-- tool-definitions.ts
        |   |-- sdk-types.ts
        |   |-- cli-forward.ts
        |   `-- commands/
        |       |-- auth/
        |       |-- paper/
        |       |-- pdf/
        |       |-- repo/
        |       `-- mcp/
        `-- skills/
            `-- alphaxiv/
                `-- SKILL.md
```

## Runtime Package

`plugins/alphaclawxiv` is the publishable npm and ClawHub package. The package
name is `alphaclawxiv`; the project and display name are `AlphaClawXiv`.

Important files:

- `package.json`: npm metadata, package files, executable mapping, OpenClaw
  compatibility metadata, and the `oclif` block that discovers commands.
- `openclaw.plugin.json`: OpenClaw plugin manifest used by plugin installers
  and registries.
- `tsconfig.json`: TypeScript build config. `tsc -p tsconfig.json` emits `dist/`.
- `bin/run.js`: checked-in oclif runner that discovers commands under
  `dist/commands`.
- `src/`: TypeScript source for the plugin entry, storage, MCP client, actions,
  OAuth, PDF heuristics, tool definitions, and oclif commands.
- `skills/alphaxiv/SKILL.md`: agent-facing usage guidance for AlphaXiv research
  workflows.

## Runtime Responsibilities

The source modules divide by concern:

- `index.ts`: OpenClaw plugin entry. Registers the 19 tool definitions, the
  prompt hint hook, and the CLI forwarder.
- `config.ts`: shared constants, scopes, env name, and computed token field
  names.
- `storage.ts`: local auth/config persistence under `~/.openclaw/alphaxiv`.
  Filesystem only, no network.
- `mcp.ts`: JSON-RPC/SSE client for the hosted AlphaXiv MCP endpoint and tool
  result normalization.
- `actions.ts`: shared per-tool action functions and discover keyword adapters.
- `pdf.ts`: XML page parse and answer synthesis for `pdf ask`.
- `oauth.ts`: PKCE OAuth 2.1 login flow.
- `tool-definitions.ts`: 19 TypeBox tool schemas mapped to the shared actions.
- `cli-forward.ts`: forwards `openclaw alphaclawxiv ...` to the oclif CLI.
- `commands/`: oclif command classes for `auth`, `paper`, `pdf`, `repo`, and
  `mcp`.

The runtime should not perform network calls at module import time. Network
calls happen only after a user command or OpenClaw tool invocation.

## Build

`tsc` compiles `src/` to `dist/`; `dist/commands/` holds the oclif commands.
`npm run build` runs the compiler, `npm run typecheck` runs it without emit, and
`prepack` runs the build so `npm pack` ships a fresh `dist/`. `dist/` is
gitignored and produced locally and in CI; never commit it.

## Naming Rules

Use `AlphaClawXiv` for the project, documentation prose, UI display names, and
OpenClaw plugin display text.

Use `alphaclawxiv` only where lowercase identifiers are required or conventional:

- npm package name.
- ClawHub package name.
- OpenClaw command name.
- oclif bin name.
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

- Verify the hosted MCP tool name and schema before editing docs or tool
  registration; do not assume the docs page is current.
- Add the tool definition in `src/tool-definitions.ts` and any action in
  `src/actions.ts`.
- Add an oclif command in `src/commands/` if the workflow should be usable from
  a terminal.
- Update `skills/alphaxiv/SKILL.md` so agents know when to use it.
- Update README examples if the feature is user-facing.
- Run `npm run build`, `npm run typecheck`, and `node --check` on built files.
- Run at least one authenticated OpenClaw smoke test.
