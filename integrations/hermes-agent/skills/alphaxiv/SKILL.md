---
name: alphaxiv
description: Search and read AlphaXiv research papers, retrieve PDF-grounded answers, profile researchers, manage an AlphaXiv library, and read paper implementation repositories. Use when asked to "find papers", "literature review", "find related work", "summarize a paper", "answer a question about a paper PDF", "find researchers", "look up an author", "manage library folders", or "read a paper's code repository".
metadata:
  author: Riddhimaan Senapati
  version: "0.2.0"
  tags: [alphaxiv, arxiv, research, mcp, papers]
---

# AlphaXiv Research For Hermes

Use this skill when Hermes already has access to AlphaXiv through MCP.

Expected live tool surface across three families:

- **Research tools**: `discover_papers`, `get_paper_content`,
  `answer_pdf_queries`, `read_files_from_github_repository`.
- **Researcher tools**: `find_researchers`, `get_researcher`,
  `get_researcher_papers`, `resolve_researchers`, `list_followed_researchers`,
  `follow_researcher`, `unfollow_researcher`.
- **Library tools**: `list_library`, `save_papers_to_folder`,
  `remove_papers_from_folder`, `move_papers_between_folders`, `create_folder`,
  `rename_folder`, `delete_folder`, `edit_private_paper_metadata`.

Recommended pattern:

1. Use `discover_papers` to find relevant papers.
2. Use exact terms in `keywords` and a richer natural-language request in `question`.
3. Increase `difficulty` for broad literature surveys or ambiguous research asks.
4. Use `discover_papers.published_after` / `published_before` only when the request names a real date boundary.
5. Use `discover_papers.prioritize` for newest work (`recency`) or a historical window.
6. Use `get_paper_content` to fetch the actual paper once discovery is done.
7. Use `answer_pdf_queries` for focused, citation-grounded questions about a specific paper, passing `paper` as an arXiv ID, URL, or title.
8. Use `read_files_from_github_repository` when the user wants code-level analysis tied to a paper implementation.
9. For people, use `find_researchers`, `get_researcher`, `get_researcher_papers`, or `resolve_researchers`.
10. For library placement, fetch `list_library` first to get folder ids, then use the folder tools.

When summarizing results:

- Include paper titles and identifiers when available.
- Distinguish retrieved content from your synthesis.
- Compare methods, datasets, results, and limitations when discussing multiple papers.
