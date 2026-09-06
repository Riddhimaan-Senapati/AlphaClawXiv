# AlphaClawXiv

[![npm version](https://img.shields.io/npm/v/alphaclawxiv.svg?cacheSeconds=60)](https://www.npmjs.com/package/alphaclawxiv)
[![npm downloads](https://img.shields.io/npm/dm/alphaclawxiv.svg?cacheSeconds=60)](https://www.npmjs.com/package/alphaclawxiv)
[![ClawHub package](https://img.shields.io/badge/ClawHub-alphaclawxiv-blue)](https://clawhub.ai/packages/alphaclawxiv)
[![Release](https://github.com/Riddhimaan-Senapati/AlphaClawXiv/actions/workflows/release.yml/badge.svg)](https://github.com/Riddhimaan-Senapati/AlphaClawXiv/actions/workflows/release.yml)
[![license](https://img.shields.io/github/license/Riddhimaan-Senapati/AlphaClawXiv.svg)](./LICENSE)

Native OpenClaw plugin for AlphaXiv research workflows: OAuth login, paper
discovery, paper content lookup, targeted PDF passage retrieval, and
repository-reading tools.

## Why this exists

AlphaXiv exposes a hosted MCP endpoint. AlphaClawXiv wraps that endpoint as
native OpenClaw commands and tools so the gateway does not need to connect to a
remote MCP server during startup. This keeps gateway startup predictable while
still giving agents access to AlphaXiv when a tool is actually used.

For upstream MCP behavior, see the [AlphaXiv MCP documentation](https://www.alphaxiv.org/docs/mcp).
The hosted server used by this plugin is validated against the live MCP
`tools/list` endpoint; if the docs page and the live server differ, this plugin
follows the live hosted surface so OpenClaw stays functional.

## Install

Install by package name:

```powershell
openclaw plugins install alphaclawxiv --force
```

OpenClaw checks ClawHub first and falls back to npm for package-name installs.
Use an explicit source when you want to force one registry.

From ClawHub:

```powershell
openclaw plugins install clawhub:alphaclawxiv --force
```

From npm:

```powershell
openclaw plugins install npm:alphaclawxiv --force
```

Package pages:

- npm: [alphaclawxiv](https://www.npmjs.com/package/alphaclawxiv)
- ClawHub: [alphaclawxiv](https://clawhub.ai/packages/alphaclawxiv)

For local development from this repository:

```powershell
cd plugins/alphaclawxiv
npm install
npm run build
openclaw plugins install ./plugins/alphaclawxiv --force
```

## First login

```powershell
openclaw alphaclawxiv auth login
openclaw gateway restart
```

The login command prints an AlphaXiv OAuth URL, waits for the local callback,
stores the resulting token in `~/.openclaw/alphaxiv/oauth.json`, and writes
`ALPHAXIV_AUTH_HEADER` to `~/.openclaw/.env` for compatibility.

Check status without exposing secrets:

```powershell
openclaw alphaclawxiv auth status
```

Remove local AlphaXiv auth state:

```powershell
openclaw alphaclawxiv auth logout
```

## Examples

Search for papers:

```powershell
openclaw alphaclawxiv paper search "retrieval augmented generation"
openclaw alphaclawxiv paper search-semantic "Research on retrieval-augmented generation systems for large language models, including retrieval pipelines, grounding, and hallucination mitigation."
openclaw alphaclawxiv paper search-keyword "LoRA low-rank adaptation"
openclaw alphaclawxiv paper search-agentic "What are the latest approaches to reducing hallucination in large language models?"
```

Fetch paper content:

```powershell
openclaw alphaclawxiv paper content "https://arxiv.org/abs/2404.10981"
openclaw alphaclawxiv paper content "https://arxiv.org/abs/2404.10981" --full-text
```

Retrieve PDF passages relevant to a question:

```powershell
openclaw alphaclawxiv pdf ask "https://arxiv.org/pdf/2404.10981" "What is the main contribution?"
```

Read a GitHub repository file:

```powershell
openclaw alphaclawxiv repo read "https://github.com/Riddhimaan-Senapati/AlphaClawXiv" "README.md"
```

The shorter alias is also supported:

```powershell
openclaw alphaxiv paper search "graph retrieval augmented generation"
```

## Verified on Windows

The plugin targets OpenClaw `2026.8.1` and is built from TypeScript with an
oclif-based CLI. The build step emits `dist/` and `dist/commands/`; the
`alphaclawxiv` binary is an oclif runner in `bin/run.js`.

The following OpenClaw flows were live-tested on Windows against the hosted
AlphaXiv service with current AlphaXiv OAuth:

```powershell
openclaw alphaclawxiv auth status
openclaw alphaclawxiv paper search "retrieval augmented generation"
openclaw alphaclawxiv pdf ask "https://arxiv.org/pdf/2404.10981" "What is the main contribution?"
```

The installed OpenClaw extension also includes the bundled skill file at:

- `~/.openclaw/extensions/alphaclawxiv/skills/alphaxiv/SKILL.md`

Verified at the skill level:

- the bundled OpenClaw skill file is present in the installed extension
- the `alphaxiv` skill appears in OpenClaw agent prompt metadata

Not verified end to end:

- direct native OpenClaw tool projection inside the Codex app-server tool list; the tested Codex path uses AlphaClawXiv through the local OpenClaw CLI

## OpenClaw agent tools

When enabled, AlphaClawXiv registers the live AlphaXiv MCP surface across three
families:

- Research tools: `discover_papers`, `get_paper_content`,
  `answer_pdf_queries`, `read_files_from_github_repository`.
- Researcher tools: `find_researchers`, `get_researcher`,
  `get_researcher_papers`, `resolve_researchers`, `list_followed_researchers`,
  `follow_researcher`, `unfollow_researcher`.
- Library tools: `list_library`, `save_papers_to_folder`,
  `remove_papers_from_folder`, `move_papers_between_folders`, `create_folder`,
  `rename_folder`, `delete_folder`, `edit_private_paper_metadata`.

`discover_papers` accepts `keywords`, `question`, and `difficulty` (required),
plus optional date filters (`published_after`, `published_before`) and
`prioritize`. `answer_pdf_queries` takes a `paper` argument that accepts an
arXiv ID, a URL, or a title, plus a `queries` array.

The terminal subcommands `paper search`, `paper search-semantic`,
`paper search-keyword`, and `paper search-agentic` are local CLI conveniences
that adapt your query into `discover_papers` inputs. They are not separate
hosted MCP tool names.

Example prompt:

```text
Use AlphaXiv to find recent retrieval-augmented generation survey papers, then compare their methods, datasets, and limitations.
```

## Pitfalls

- Authenticate first. Tool calls fail if the stored AlphaXiv token is missing or expired.
- Restart OpenClaw after first login, install, or update.
- Package installs can take a few minutes while OpenClaw resolves and extracts ClawHub or npm packages.
- Keep the generic MCP startup config disabled unless you are debugging MCP connectivity.
- If `openclaw gateway health` times out just after restart, run `openclaw gateway status`, wait for warm-up, then retry.
- If `openclaw gateway restart` points at a deleted npx cache path, repair the Windows service with `openclaw gateway install --force`.
- If OpenClaw `2026.5.x` reports that the Codex app-server binary is missing, reinstall/update OpenClaw and `@openclaw/codex`, then verify `plugins.entries.codex.config.appServer.command` points at the local `codex.cmd` if managed discovery still fails.
- Do not share `~/.openclaw/alphaxiv/oauth.json` or `ALPHAXIV_AUTH_HEADER`.

## Project links

- Repository: https://github.com/Riddhimaan-Senapati/AlphaClawXiv
- Issues: https://github.com/Riddhimaan-Senapati/AlphaClawXiv/issues
- Contributing: https://github.com/Riddhimaan-Senapati/AlphaClawXiv/blob/main/CONTRIBUTING.md
- Code structure: https://github.com/Riddhimaan-Senapati/AlphaClawXiv/blob/main/docs/CODE_STRUCTURE.md
- Automated releases: https://github.com/Riddhimaan-Senapati/AlphaClawXiv/blob/main/docs/AUTOMATED_RELEASES.md

## License

MIT.
