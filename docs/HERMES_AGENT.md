# Hermes Agent Integration

This repository includes two Hermes Agent integration paths for AlphaXiv,
guided by the current Hermes plugin, skill, and MCP documentation.

## Portability

The Hermes plugin implementation is OS-independent:

- it uses Python standard-library networking only
- it stores state relative to the active Hermes home
- it does not depend on PowerShell or Windows-only APIs at runtime

What is Windows-specific in this repository is only the helper installer:

- `integrations/hermes-agent/install-hermes-windows.ps1`

On macOS or Linux, copy the same plugin and skill directories manually into
the active Hermes home, commonly `~/.hermes/plugins/alphaclawxiv` and
`~/.hermes/skills/alphaxiv`.

Hermes home detection order:

- `HERMES_HOME`, if set
- the installed plugin parent, when running from `<hermes-home>/plugins/alphaclawxiv`
- `%LOCALAPPDATA%\hermes` on Windows when `config.yaml` or `.env` exists
- `~/.hermes` as a legacy fallback

## Verified on Windows

The following Hermes flows were live-tested on a Windows install using:

- `C:\Users\riddh\AppData\Local\hermes\hermes-agent\venv\Scripts\hermes.exe`
- active Hermes home: `C:\Users\riddh\AppData\Local\hermes`

Verified working:

- `hermes plugins list` shows `alphaclawxiv` as an installed user plugin
- `hermes plugins enable alphaclawxiv`
- `hermes skills list` shows the local `alphaxiv` skill as enabled
- `hermes alphaclawxiv auth status`
- `hermes alphaclawxiv auth login`
- `hermes alphaclawxiv status`
- `hermes alphaclawxiv discover --question "Recent retrieval-augmented generation survey papers" --keyword rag --keyword retrieval --keyword survey --difficulty 6`

Verified at the skill level:

- `hermes skills list` shows the local `alphaxiv` skill as enabled
- the bundled plugin skill and the standalone Hermes skill were both installed into the active Hermes home

Not verified end to end:

- an interactive Hermes conversation where the model autonomously chose and invoked the `alphaxiv` skill prompt path

The native Hermes OAuth flow was verified end to end against AlphaXiv's live
Clerk/OAuth setup. The plugin stores auth in
`<hermes-home>/alphaxiv/oauth.json` and mirrors the current bearer header into
`<hermes-home>/.env`.

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

Special Windows testing note:

- use the discovered Windows binary directly if `hermes` is not on PATH:
  `C:\Users\<you>\AppData\Local\hermes\hermes-agent\venv\Scripts\hermes.exe`

## Option 3: Native Hermes Plugin

Use this when you want Hermes-native tools, CLI commands, and a local OAuth
flow similar to the OpenClaw plugin.

Plugin location in this repository:

- `integrations/hermes-agent/plugins/alphaclawxiv/`

The plugin registers the live hosted AlphaXiv MCP surface across three
families:

- Research tools: `discover_papers`, `get_paper_content`, `answer_pdf_queries`,
  `read_files_from_github_repository`.
- Researcher tools: `find_researchers`, `get_researcher`, `get_researcher_papers`,
  `resolve_researchers`, `list_followed_researchers`, `follow_researcher`,
  `unfollow_researcher`.
- Library tools: `list_library`, `save_papers_to_folder`,
  `remove_papers_from_folder`, `move_papers_between_folders`, `create_folder`,
  `rename_folder`, `delete_folder`, `edit_private_paper_metadata`.

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

## Windows install

This repository includes a Windows helper script:

- `integrations/hermes-agent/install-hermes-windows.ps1`

It copies:

- the Hermes plugin into `<hermes-home>\plugins\alphaclawxiv`
- the standalone Hermes skill into `<hermes-home>\skills\alphaxiv`

Run it from the repository root:

```powershell
.\integrations\hermes-agent\install-hermes-windows.ps1
```

The script defaults to `%LOCALAPPDATA%\hermes` when that active Hermes install
exists. To override the target explicitly:

```powershell
.\integrations\hermes-agent\install-hermes-windows.ps1 -HermesHome "$env:LOCALAPPDATA\hermes"
```

Then authenticate AlphaXiv for Hermes:

```powershell
hermes alphaclawxiv auth login
```

This prints an AlphaXiv Clerk/OAuth URL, waits for the local callback, stores
the token in `~/.hermes/alphaxiv/oauth.json`, and writes
`ALPHAXIV_AUTH_HEADER` into `<hermes-home>\.env`.

If `alphaclawxiv` does not appear as a Hermes command immediately after
installation, enable it once:

```powershell
hermes plugins enable alphaclawxiv
```

Hermes marks user plugins as opt-in by default.

## Setting `ALPHAXIV_AUTH_HEADER` on Windows

Hermes documentation indicates that environment variables are typically stored
in `~/.hermes/.env`, and Windows also supports process-scope environment
variables for the current shell session.

If you use the native Hermes AlphaClawXiv login flow, you usually do not need
to set this by hand. The plugin writes it automatically after successful login.

Manual fallback option:

1. Create or edit `<hermes-home>\.env`
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

## Compatibility note

The public AlphaXiv MCP docs page has described more tool names than the live
hosted server exposed during real integration testing. Hermes integration in
this repository intentionally follows the live hosted `tools/list` surface so
the plugin and skill keep working against the real service.

## Hermes docs basis

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
