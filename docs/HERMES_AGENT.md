# Hermes Agent Integration

This repository includes two Hermes Agent integration paths for AlphaXiv,
guided by the current Hermes plugin, skill, and MCP documentation.

## Verified On Windows

The following Hermes flows were live-tested on a Windows install using:

- `C:\Users\riddh\AppData\Local\hermes\hermes-agent\venv\Scripts\hermes.exe`

Verified working:

- `hermes plugins list` shows `alphaclawxiv` as an installed user plugin
- `hermes plugins enable alphaclawxiv`
- `hermes skills list` shows the local `alphaxiv` skill as enabled
- `hermes alphaclawxiv auth login`
- `hermes alphaclawxiv auth status`
- `hermes alphaclawxiv status`
- `hermes alphaclawxiv discover --question "Recent retrieval-augmented generation survey papers" --keyword rag --keyword retrieval --keyword survey --difficulty 6`

The native Hermes OAuth flow was verified end to end against AlphaXiv's live
Clerk/OAuth setup. The plugin now stores auth in `~/.hermes/alphaxiv/oauth.json`
and mirrors the current bearer header into `~/.hermes/.env`.

## Option 2: Hermes Skill + MCP

Use this when you want the fastest integration and are comfortable letting
Hermes talk to AlphaXiv through MCP directly.

Skill location in this repository:

- `integrations/hermes-agent/skills/alphaxiv/SKILL.md`

Hermes docs indicate that local skills live under `~/.hermes/skills/`, and
external shared skill directories can be added under `skills.external_dirs` in
`~/.hermes/config.yaml`.

Example MCP config for Hermes:

```yaml
mcp_servers:
  alphaxiv:
    url: "https://api.alphaxiv.org/mcp/v1"
    headers:
      Authorization: "Bearer YOUR_TOKEN"
    timeout: 180
    connect_timeout: 60

skills:
  external_dirs:
    - C:/Users/your-user/AlphaClawXiv/integrations/hermes-agent/skills
```

Use this path if you want:

- minimal maintenance
- direct access to the hosted AlphaXiv MCP tools
- a reusable Hermes skill without Python plugin code

## Option 3: Native Hermes Plugin

Use this when you want Hermes-native tools, CLI commands, and a local OAuth
flow similar to the OpenClaw plugin.

Plugin location in this repository:

- `integrations/hermes-agent/plugins/alphaclawxiv/`

The plugin currently registers the live hosted AlphaXiv MCP surface:

- `discover_papers`
- `get_paper_content`
- `answer_pdf_queries`
- `read_files_from_github_repository`

It also adds a Hermes CLI command:

```text
hermes alphaclawxiv auth login
hermes alphaclawxiv auth status
hermes alphaclawxiv auth logout
hermes alphaclawxiv status
hermes alphaclawxiv discover --question "..." --keyword rag --keyword retrieval --difficulty 6
```

The plugin stores its own AlphaXiv token under:

- `C:\Users\<you>\.hermes\alphaxiv\oauth.json`

It also mirrors the current bearer header into:

- `C:\Users\<you>\.hermes\.env`

Optional:

- `ALPHAXIV_MCP_URL` with default `https://api.alphaxiv.org/mcp/v1`

## Windows Install

This repository includes a Windows helper script:

- `integrations/hermes-agent/install-hermes-windows.ps1`

It copies:

- the Hermes plugin into `C:\Users\<you>\.hermes\plugins\alphaclawxiv`
- the standalone Hermes skill into `C:\Users\<you>\.hermes\skills\alphaxiv`

Run it from the repository root:

```powershell
.\integrations\hermes-agent\install-hermes-windows.ps1
```

Then authenticate AlphaXiv for Hermes:

```powershell
hermes alphaclawxiv auth login
```

This prints an AlphaXiv Clerk/OAuth URL, waits for the local callback, stores
the token in `~/.hermes/alphaxiv/oauth.json`, and writes
`ALPHAXIV_AUTH_HEADER` into `~/.hermes/.env`.

If `alphaclawxiv` does not appear as a Hermes command immediately after
installation, enable it once:

```powershell
hermes plugins enable alphaclawxiv
```

Hermes marks user plugins as opt-in by default.

## Setting `ALPHAXIV_AUTH_HEADER` On Windows

Hermes documentation indicates that environment variables are typically stored
in `~/.hermes/.env`, and Windows also supports process-scope environment
variables for the current shell session.

If you use the native Hermes AlphaClawXiv login flow, you usually do not need
to set this by hand. The plugin writes it automatically after successful login.

Manual fallback option:

1. Create or edit `C:\Users\<you>\.hermes\.env`
2. Add:

```text
ALPHAXIV_AUTH_HEADER=Bearer YOUR_TOKEN_HERE
```

This is useful if you need to bootstrap Hermes manually before the native login
flow is available.

Quick one-session test option:

```powershell
$env:ALPHAXIV_AUTH_HEADER = "Bearer YOUR_TOKEN_HERE"
```

Use this if you want to test the plugin immediately in the current PowerShell
window before making the setting persistent.

Less recommended but possible:

- Set a Windows User environment variable for `ALPHAXIV_AUTH_HEADER`

Hermes' Windows docs allow User environment variables, but they also note that
secrets are usually better kept in `~/.hermes/.env` rather than exposed to
every Windows process.

If you already authenticated AlphaXiv for OpenClaw, you can often reuse the
same header value from `C:\Users\<you>\.openclaw\.env`.

Example verification commands:

```powershell
hermes alphaclawxiv auth status
hermes alphaclawxiv status
hermes alphaclawxiv discover --question "Recent retrieval-augmented generation survey papers" --keyword rag --keyword retrieval --keyword survey --difficulty 6
```

## Important Compatibility Note

The public AlphaXiv MCP docs page has described more tool names than the live
hosted server exposed during real integration testing. Hermes integration in
this repository intentionally follows the live hosted `tools/list` surface so
the plugin and skill keep working against the real service.

## Hermes Docs Basis

This integration design was guided by Hermes Agent documentation retrieved via
Context7:

- plugin manifests with `plugin.yaml`
- Python plugin registration through `register(ctx)`
- `ctx.register_tool(...)`
- `ctx.register_cli_command(...)`
- skills under `~/.hermes/skills/`
- external skill directories via `skills.external_dirs`
- MCP servers in `~/.hermes/config.yaml`
- environment variables in `~/.hermes/.env`
