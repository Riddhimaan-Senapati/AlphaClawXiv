# Contributing to AlphaClawXiv

Thanks for considering a contribution. AlphaClawXiv is a small OpenClaw plugin,
so the bar for changes is straightforward: keep the gateway stable, avoid token
leaks, and make research workflows easier to use.

## Ways to Contribute

- Report bugs with clear reproduction steps.
- Improve docs, examples, and troubleshooting notes.
- Add tests or verification scripts for OAuth and tool behavior.
- Improve command UX without changing stored token semantics.
- Add support for new AlphaXiv tools when the upstream API exposes them.

## Development Setup

Requirements:

- Node.js 20 or newer.
- OpenClaw 2026.4.29 or newer.
- An AlphaXiv account for OAuth testing.

Install from a local checkout:

```powershell
openclaw plugins install ./plugins/alphaclawxiv --force
openclaw alphaclawxiv auth login
openclaw gateway restart
```

Run a smoke test:

```powershell
node --check ./plugins/alphaclawxiv/dist/index.js
openclaw alphaclawxiv paper search "retrieval augmented generation"
openclaw gateway status
openclaw gateway health
```

## Code Guidelines

- Keep the plugin dependency-free unless a dependency is clearly justified.
- Do not print access tokens, refresh tokens, auth headers, or OAuth callback secrets.
- Do not reintroduce automatic `mcp.servers.alphaxiv` installation during login.
- Keep network calls on demand. Plugin load should not call AlphaXiv.
- Prefer native OpenClaw tools over generic MCP startup config.
- Keep package contents small and verify them with `npm pack --dry-run`.

## Pull Request Checklist

Before opening a PR:

- Run `node --check ./plugins/alphaclawxiv/dist/index.js`.
- Run at least one AlphaXiv command against a real authenticated session.
- Run `openclaw gateway status` and `openclaw gateway health`.
- Update README or docs when behavior changes.
- Confirm no local secrets, logs, tarballs, or npm caches are included.
- If package metadata changed, run the checks in [docs/PUBLISHING.md](./docs/PUBLISHING.md).

## Issue Guidelines

Good issues include:

- OpenClaw version.
- Node.js version.
- Operating system.
- Exact command or agent prompt used.
- Expected behavior.
- Actual behavior.
- Redacted logs or screenshots.

Never include:

- `ALPHAXIV_AUTH_HEADER`
- OAuth access or refresh tokens
- `~/.openclaw/alphaxiv/oauth.json`
- Full `~/.openclaw/.env`

## Security Reports

Do not open public issues for vulnerabilities or token exposure. Use a private
GitHub security advisory if available, or contact the maintainer directly with a
minimal reproduction and impact summary.
