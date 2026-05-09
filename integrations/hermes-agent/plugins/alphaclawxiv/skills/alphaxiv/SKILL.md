# AlphaXiv Research For Hermes

Use the native `alphaclawxiv` Hermes plugin tools for AlphaXiv research
workflows.

The plugin targets the live hosted AlphaXiv MCP surface:

- `discover_papers`
- `get_paper_content`
- `answer_pdf_queries`
- `read_files_from_github_repository`

Do not assume the public AlphaXiv docs page is fully current. If the hosted
`tools/list` output and the docs page differ, prefer the live hosted tool names
that the plugin actually exposes.

## Workflow

1. Use `discover_papers` first for literature discovery, related work, or broad topical coverage.
2. Fill `keywords` with three or four exact phrases such as an author, benchmark, acronym, or method name.
3. Put the broader semantic request in `question`.
4. Raise `difficulty` when the task is broad, ambiguous, or asks for multiple candidate approaches.
5. Use `get_paper_content` when you need the paper itself rather than just discovery results.
6. Use `answer_pdf_queries` when the user asks a focused question about one paper and you want grounded page excerpts.
7. Use `read_files_from_github_repository` only once you already know the implementation repository URL.

## Defaults

- Prefer `discover_papers` for both open-ended and targeted paper search tasks.
- Prefer `answer_pdf_queries` over a full paper dump for focused questions.
- Keep outputs comparative when summarizing multiple papers: methods, datasets, results, and limitations.
- Separate retrieved evidence from your synthesis.

## Setup Notes

- The Hermes plugin requires `ALPHAXIV_AUTH_HEADER`.
- `ALPHAXIV_MCP_URL` is optional and defaults to `https://api.alphaxiv.org/mcp/v1`.
- If you already use AlphaClawXiv with OpenClaw, you can usually reuse the same AlphaXiv bearer header for Hermes.
