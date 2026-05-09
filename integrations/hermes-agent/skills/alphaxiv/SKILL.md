# AlphaXiv Research For Hermes

Use this skill when Hermes already has access to AlphaXiv through MCP.

Expected live tool surface:

- `discover_papers`
- `get_paper_content`
- `answer_pdf_queries`
- `read_files_from_github_repository`

Recommended pattern:

1. Use `discover_papers` to find relevant papers.
2. Use exact terms in `keywords` and a richer natural-language request in `question`.
3. Increase `difficulty` for broad literature surveys or ambiguous research asks.
4. Use `get_paper_content` to fetch the actual paper once discovery is done.
5. Use `answer_pdf_queries` for focused, citation-grounded questions about a specific paper.
6. Use `read_files_from_github_repository` when the user wants code-level analysis tied to a paper implementation.

When summarizing results:

- Include paper titles and identifiers when available.
- Distinguish retrieved content from your synthesis.
- Compare methods, datasets, results, and limitations when discussing multiple papers.
