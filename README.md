<h1 align="center">AlphaClawXiv</h1>

<p align="center">
  Native OpenClaw research workflows for AlphaXiv, with local OAuth, paper discovery, PDF-grounded Q&A, and repository-aware analysis.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/alphaclawxiv"><img src="https://img.shields.io/npm/v/alphaclawxiv.svg?cacheSeconds=60" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/alphaclawxiv"><img src="https://img.shields.io/npm/dm/alphaclawxiv.svg?cacheSeconds=60" alt="npm downloads"></a>
  <a href="https://clawhub.ai/packages/alphaclawxiv"><img src="https://img.shields.io/badge/ClawHub-alphaclawxiv-blue" alt="ClawHub package"></a>
  <a href="https://github.com/Riddhimaan-Senapati/AlphaClawXiv/actions/workflows/release.yml"><img src="https://github.com/Riddhimaan-Senapati/AlphaClawXiv/actions/workflows/release.yml/badge.svg" alt="Release workflow"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/Riddhimaan-Senapati/AlphaClawXiv.svg" alt="license"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#examples">Examples</a> •
  <a href="#native-tools">Native Tools</a> •
  <a href="./docs/CODE_STRUCTURE.md">Code Structure</a> •
  <a href="./CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <video src="./alphaclawxiv_demo_video.mp4" controls playsinline muted width="100%"></video>
</p>

<p align="center">
  Demo video not rendering in your Markdown viewer? <a href="./alphaclawxiv_demo_video.mp4">Open the MP4 directly</a>.
</p>

AlphaClawXiv is a native OpenClaw plugin for AlphaXiv research workflows. It
adds OAuth-based AlphaXiv access, paper discovery, paper content lookup,
targeted PDF passage retrieval, and repository-reading tools without forcing
OpenClaw to maintain a remote MCP connection during gateway startup.

The publishable plugin package lives in [plugins/alphaclawxiv](./plugins/alphaclawxiv).
For upstream MCP behavior, see the [AlphaXiv MCP documentation](https://www.alphaxiv.org/docs/mcp).

## Why AlphaClawXiv

- Keeps AlphaXiv usable from OpenClaw without relying on a persistent `mcp.servers.alphaxiv` startup connection.
- Exposes a native OpenClaw workflow for paper discovery, paper reading, and PDF-grounded research questions.
- Preserves a practical terminal UX through `openclaw alphaclawxiv ...` commands.
- Uses local OAuth state and redacted status output instead of leaking tokens into logs or prompts.

## What It Does

- Authenticates with AlphaXiv through a local OAuth callback flow.
- Registers native OpenClaw tools for paper discovery and paper analysis.
- Provides terminal commands for quick research workflows.
- Stores tokens under `~/.openclaw/alphaxiv` and never prints token values.
- Avoids the `mcp.servers.alphaxiv` startup path, which can stall some OpenClaw gateway versions.

## Install

Install the published plugin from ClawHub:

```powershell
openclaw plugins install clawhub:alphaclawxiv --force
```

OpenClaw resolves package-name installs through ClawHub first and falls back to
npm. You can also choose a registry explicitly:

```powershell
openclaw plugins install clawhub:alphaclawxiv --force
openclaw plugins install npm:alphaclawxiv --force
```

Package pages:

- npm: [alphaclawxiv](https://www.npmjs.com/package/alphaclawxiv)
- ClawHub: [alphaclawxiv](https://clawhub.ai/packages/alphaclawxiv)

For local development from this repository:

```powershell
openclaw plugins install ./plugins/alphaclawxiv --force
```

## Quick Start

After installation, log in to AlphaXiv:

```powershell
openclaw alphaclawxiv auth login
openclaw gateway restart
```

Search for papers:

```powershell
openclaw alphaclawxiv paper search "retrieval augmented generation"
```

The shorter alias also works:

```powershell
openclaw alphaxiv paper search "graph retrieval augmented generation"
```

## Development Install

Use a local checkout only when developing or testing unpublished changes:

```powershell
openclaw plugins install ./plugins/alphaclawxiv --force
```

## Examples

Fetch a paper summary or content:

```powershell
openclaw alphaclawxiv paper content "https://arxiv.org/abs/2404.10981"
```

Retrieve PDF passages relevant to a question:

```powershell
openclaw alphaclawxiv pdf ask "https://arxiv.org/pdf/2404.10981" "What is the main contribution?"
```

Read files from a related GitHub repository:

```powershell
openclaw alphaclawxiv repo read "https://github.com/Riddhimaan-Senapati/AlphaClawXiv" "README.md"
```

Use it from an OpenClaw agent:

```text
Use AlphaXiv to find recent retrieval-augmented generation survey papers, then compare their methods, scope, and limitations.
```

## Native Tools

AlphaClawXiv exposes these tools to OpenClaw:

- `discover_papers`: Discover and rank papers for a topic using keywords, a semantic question, and retrieval difficulty.
- `get_paper_content`: Retrieve paper content from an AlphaXiv, arXiv, or paper URL.
- `answer_pdf_queries`: Retrieve filtered PDF page content for targeted questions.
- `read_files_from_github_repository`: Read implementation files from a GitHub repository.

The hosted AlphaXiv MCP currently exposes `discover_papers` as its
paper-discovery tool. The terminal subcommands `paper search`,
`paper search-semantic`, `paper search-keyword`, and `paper search-agentic`
are local CLI conveniences that map your query into `discover_papers` inputs.

## Common Pitfalls

- Run `openclaw alphaclawxiv auth login` before using tools. A missing or expired token causes tool calls to fail.
- Restart the gateway after first login or after installing/updating the plugin.
- Package installs can take a few minutes while OpenClaw resolves and extracts ClawHub or npm packages.
- On Windows, if your current folder or a nearby folder is named `AlphaClawXiv` or `alphaclawxiv`, `openclaw plugins install alphaclawxiv --force` can be misread as a local path install. Use `openclaw plugins install clawhub:alphaclawxiv --force` to avoid path-resolution collisions.
- Prefer native tools. The optional `mcp install` command is for debugging only and can make some gateways stall.
- Do not commit `~/.openclaw/.env`, OAuth token files, package tarballs, or local npm caches.
- If a gateway health check times out immediately after restart, run `openclaw gateway status` once and retry health after warm-up.
- If a Windows reinstall fails with `EPERM` while renaming `~/.openclaw/extensions/alphaclawxiv`, stop the OpenClaw gateway before retrying the install.
- If `openclaw gateway restart` points at a deleted npx cache path, repair the Windows service with `openclaw gateway install --force`.

## Project Docs

- [Contributing](./CONTRIBUTING.md)
- [Code Structure](./docs/CODE_STRUCTURE.md)
- [Publishing](./docs/PUBLISHING.md)
- [Automated Releases](./docs/AUTOMATED_RELEASES.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)

## License

MIT. See [LICENSE](./LICENSE).
