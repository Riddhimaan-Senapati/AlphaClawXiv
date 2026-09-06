---
name: alphaxiv
description: Search and read AlphaXiv research papers, retrieve PDF-grounded answers, profile researchers, manage an AlphaXiv library, and read paper implementation repositories. Use when asked to "find papers", "literature review", "find related work", "summarize a paper", "answer a question about a paper PDF", "find researchers", "look up an author", "manage library folders", or "read a paper's code repository".
metadata:
  author: Riddhimaan Senapati
  version: "0.2.0"
  tags: [alphaxiv, arxiv, research, mcp, papers]
---

# AlphaXiv Research For Hermes

Use the native `alphaclawxiv` Hermes plugin tools for AlphaXiv research
workflows.

The plugin targets the live hosted AlphaXiv MCP surface across three families:

- **Research tools**: `discover_papers`, `get_paper_content`,
  `answer_pdf_queries`, `read_files_from_github_repository`.
- **Researcher tools**: `find_researchers`, `get_researcher`,
  `get_researcher_papers`, `resolve_researchers`, `list_followed_researchers`,
  `follow_researcher`, `unfollow_researcher`.
- **Library tools**: `list_library`, `save_papers_to_folder`,
  `remove_papers_from_folder`, `move_papers_between_folders`, `create_folder`,
  `rename_folder`, `delete_folder`, `edit_private_paper_metadata`.

## Workflow

### Paper discovery and reading

1. Use `discover_papers` first for literature discovery, related work, or broad topical coverage.
2. Fill `keywords` with three or four exact phrases such as an author, benchmark, acronym, or method name.
3. Put the broader semantic request in `question`.
4. Raise `difficulty` when the task is broad, ambiguous, or asks for multiple candidate approaches.
5. Use `discover_papers.published_after` / `published_before` only when the request names a real date boundary; these exclude papers outright.
6. Use `discover_papers.prioritize` for newest work (`recency`) or a historical window rather than default relevance.
7. Use `get_paper_content` when you need the paper itself rather than just discovery results.
8. Use `answer_pdf_queries` when the user asks a focused question about one paper; pass `paper` as an arXiv ID, URL, or title and batch questions into `queries`.
9. Use `read_files_from_github_repository` only once you already know the implementation repository URL.

### Researcher workflows

10. Use `find_researchers` for "who works on X" or an organization roster.
11. Use `get_researcher` / `get_researcher_papers` to profile a person by name or slug.
12. Use `resolve_researchers` to map a printed roster onto current alphaXiv researcher entries.

### Library workflows

13. Fetch `list_library` first to obtain the `folder_id` values the other library tools address.
14. Use `save_papers_to_folder` / `remove_papers_from_folder` / `move_papers_between_folders` for library placement.
15. Use `create_folder` / `rename_folder` / `delete_folder` for folder structure; only custom folders can be renamed or deleted.
16. Use `edit_private_paper_metadata` only for user-uploaded papers; arXiv papers cannot be edited.

## Defaults

- Prefer `discover_papers` for both open-ended and targeted paper search tasks.
- Prefer `answer_pdf_queries` over a full paper dump for focused questions.
- Keep outputs comparative when summarizing multiple papers: methods, datasets, results, and limitations.
- Separate retrieved evidence from your synthesis.

## Setup Notes

- The Hermes plugin requires `ALPHAXIV_AUTH_HEADER`.
- `ALPHAXIV_MCP_URL` is optional and defaults to `https://api.alphaxiv.org/mcp/v1`.
- If you already use AlphaClawXiv with OpenClaw, you can usually reuse the same AlphaXiv bearer header for Hermes.
