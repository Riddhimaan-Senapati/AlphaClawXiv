---
name: alphaxiv
description: Search and read AlphaXiv research papers, retrieve PDF-grounded answers, profile researchers, manage an AlphaXiv library, and read paper implementation repositories. Use when asked to "find papers", "literature review", "find related work", "summarize a paper", "answer a question about a paper PDF", "compare methods or benchmarks", "find researchers", "look up an author", "manage library folders", or "read a paper's code repository".
metadata:
  author: Riddhimaan Senapati
  version: "0.2.0"
  tags: [alphaxiv, arxiv, research, mcp, papers]
---

# AlphaXiv Skill

Use AlphaClawXiv for research tasks. Prefer native AlphaXiv tools when they are
available in the current OpenClaw runtime. In Codex-harness OpenClaw agent runs,
the native OpenClaw tools may not be projected as Codex tools; in that case,
use the local CLI commands instead of web search:

```powershell
openclaw alphaclawxiv paper search "<query>"
openclaw alphaclawxiv paper content "<url>"
openclaw alphaclawxiv pdf ask "<paper>" "<question>"
openclaw alphaclawxiv repo read "<github-url>" "<path>"
```

Do not search the filesystem for the plugin before using it. Run the command
directly; OpenClaw exposes `alphaclawxiv` as a CLI command when the plugin is
enabled.

If neither tools nor CLI commands work, ask the user to run
`openclaw alphaclawxiv auth login` and restart the OpenClaw gateway after login
completes.

## Tool surface

AlphaClawXiv tracks the live hosted AlphaXiv MCP surface. The tools group into
three families:

- **Research tools** (paper discovery, reading, PDF queries, repo reading):
  `discover_papers`, `get_paper_content`, `answer_pdf_queries`,
  `read_files_from_github_repository`.
- **Researcher tools**: `find_researchers`, `get_researcher`, `get_researcher_papers`,
  `resolve_researchers`, `list_followed_researchers`, `follow_researcher`,
  `unfollow_researcher`.
- **Library tools**: `list_library`, `save_papers_to_folder`,
  `remove_papers_from_folder`, `move_papers_between_folders`, `create_folder`,
  `rename_folder`, `delete_folder`, `edit_private_paper_metadata`.

## Workflow

### Paper discovery and reading

1. Use `discover_papers` as the default discovery tool for literature search, related work, or broad topical coverage.
2. Populate `discover_papers.keywords` with 3-4 exact terms such as a method name, benchmark, acronym, author, or title fragment.
3. Populate `discover_papers.question` with a richer semantic description of the desired papers, and raise `difficulty` when the question is broad or ambiguous.
4. Use `discover_papers.published_after` / `published_before` only when the request names a real date boundary; these exclude papers outright.
5. Use `discover_papers.prioritize` when the request wants newest work (`recency`) or a historical window rather than default relevance.
6. Use `answer_pdf_queries` for a specific question about a paper. Pass `paper` as an arXiv ID, a URL, or a title, and batch all questions about that paper into one `queries` array.
7. Use `read_files_from_github_repository` only after you know the repository URL. Reading `/` returns the complete file tree and top-level files.

### Researcher workflows

8. Use `find_researchers` to find who works on a field or is at an organization. Prefer a single `topic` concept written the way the field writes it.
9. Use `get_researcher` to fetch compact profiles by name or slug, adding `include` sections only when needed.
10. Use `get_researcher_papers` to list someone's recent or most-cited papers; chain the returned paper ids into the paper tools.
11. Use `resolve_researchers` to map a roster of printed names onto current alphaXiv researcher entries.
12. Use `follow_researcher` / `unfollow_researcher` / `list_followed_researchers` only when the user explicitly asks to manage their following.

### Library workflows

13. Fetch `list_library` first to obtain the `folder_id` values the other library tools address.
14. Use `save_papers_to_folder` / `remove_papers_from_folder` / `move_papers_between_folders` for that paper's library placement.
15. Use `create_folder` / `rename_folder` / `delete_folder` for folder structure; only custom folders can be renamed or deleted.
16. Use `edit_private_paper_metadata` only for papers the user uploaded themself; arXiv papers cannot be edited.

## Defaults

- Prefer AlphaClawXiv tools or CLI commands rather than website scraping.
- Prefer `discover_papers` for both open-ended and targeted paper discovery.
- Treat terminal subcommands like `paper search-semantic` and `paper search-keyword` as CLI helpers that map into `discover_papers`; they are not separate hosted MCP tool names.
- Increase `discover_papers.difficulty` when the user asks for a broad survey, recent landscape, or multiple candidate approaches.
- Prefer `answer_pdf_queries` over a full paper dump when the user asks a specific question; it returns filtered passages, not a final synthesized answer.
- The researcher and library tools are optional in the tool list; fall back to the CLI when they are not projected as model tools.
- When summarizing multiple papers, keep the output comparative: methods, datasets, results, and notable limitations.

## Output guidance

- Include paper titles and URLs when available.
- Separate what the paper states from your synthesis.
- Call out uncertainty if a result depends on incomplete paper text or missing repo context.
