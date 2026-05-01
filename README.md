# AlphaClawXiv

AlphaXiv research plugin bundle for OpenClaw-compatible clients.

## What is in this repo

- `plugins/alphaxiv-plugin/`
  - `.codex-plugin/plugin.json`: bundle plugin manifest
  - `.mcp.json`: AlphaXiv MCP server definition
  - `skills/alphaxiv/`: companion skill that teaches the agent when to use AlphaXiv

## Current approach

The bundle targets the official hosted AlphaXiv MCP endpoint:
`https://api.alphaxiv.org/mcp/v1`

For OpenClaw bundle compatibility, the plugin-local `.mcp.json` uses the
`mcp-remote` stdio bridge rather than a direct remote MCP URL entry. OpenClaw's
bundle inspector currently reports bundle-local MCP entries as stdio-only, so
this is the publishable shape for OpenClaw today.

## Authentication

AlphaXiv documents OAuth 2.0 for MCP access. This bundle currently expects you to
provide a bearer token through an environment variable before use:

```powershell
$env:ALPHAXIV_AUTH_HEADER = "Bearer <your_alphaXiv_access_token>"
```

## Install locally

OpenClaw-compatible clients can install the bundle from this repo marketplace or
directly from the plugin path:

```bash
openclaw plugins install alphaxiv-plugin --marketplace .
```

or:

```bash
openclaw plugins install ./plugins/alphaxiv-plugin
```

Then enable it if needed and restart the gateway/runtime.

## Publish

Use the ClawHub plugin publish flow:

```bash
clawhub package publish ./plugins/alphaxiv-plugin --dry-run
clawhub package publish ./plugins/alphaxiv-plugin
```

## Local development

Inspect the bundle files directly or install the plugin from the local path in an
OpenClaw-compatible client that supports Codex-style bundle plugins.
