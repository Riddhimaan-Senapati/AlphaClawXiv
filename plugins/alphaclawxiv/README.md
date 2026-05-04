# AlphaClawXiv

[![npm version](https://img.shields.io/npm/v/alphaclawxiv.svg?cacheSeconds=60)](https://www.npmjs.com/package/alphaclawxiv)
[![npm downloads](https://img.shields.io/npm/dm/alphaclawxiv.svg?cacheSeconds=60)](https://www.npmjs.com/package/alphaclawxiv)
[![ClawHub package](https://img.shields.io/badge/ClawHub-alphaclawxiv-blue)](https://clawhub.ai/packages/alphaclawxiv)
[![Release](https://github.com/Riddhimaan-Senapati/AlphaClawXiv/actions/workflows/release.yml/badge.svg)](https://github.com/Riddhimaan-Senapati/AlphaClawXiv/actions/workflows/release.yml)
[![license](https://img.shields.io/github/license/Riddhimaan-Senapati/AlphaClawXiv.svg)](./LICENSE)

Native OpenClaw plugin for AlphaXiv research workflows: OAuth login, paper
search, paper content lookup, targeted PDF passage retrieval, and repository-reading tools.

## Why This Exists

AlphaXiv exposes a hosted MCP endpoint. AlphaClawXiv wraps that endpoint as
native OpenClaw commands and tools so the gateway does not need to connect to a
remote MCP server during startup. This keeps gateway startup predictable while
still giving agents access to AlphaXiv when a tool is actually used.

For upstream MCP behavior, see the [AlphaXiv MCP documentation](https://www.alphaxiv.org/docs/mcp).

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
openclaw plugins install ./plugins/alphaclawxiv --force
```

## First Login

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

## OpenClaw Agent Tools

When enabled, AlphaClawXiv registers these native tools:

- `paper_search`: Search AlphaXiv by topic, method, benchmark, author, or keyword.
- `get_paper_content`: Retrieve paper content from an AlphaXiv, arXiv, or paper URL.
- `answer_pdf_queries`: Retrieve filtered PDF page content for targeted questions.
- `read_files_from_github_repository`: Read implementation files from GitHub repositories.

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
- Do not share `~/.openclaw/alphaxiv/oauth.json` or `ALPHAXIV_AUTH_HEADER`.

## Project Links

- Repository: https://github.com/Riddhimaan-Senapati/AlphaClawXiv
- Issues: https://github.com/Riddhimaan-Senapati/AlphaClawXiv/issues
- Contributing: https://github.com/Riddhimaan-Senapati/AlphaClawXiv/blob/main/CONTRIBUTING.md
- Code structure: https://github.com/Riddhimaan-Senapati/AlphaClawXiv/blob/main/docs/CODE_STRUCTURE.md
- Automated releases: https://github.com/Riddhimaan-Senapati/AlphaClawXiv/blob/main/docs/AUTOMATED_RELEASES.md

## License

MIT.
