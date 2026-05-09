---
name: alphaxiv
description: Use AlphaXiv for research-paper discovery, literature review, arXiv or PDF passage retrieval, paper summarization, finding related work, and reading implementation repositories tied to papers. Trigger when the user asks for academic paper search, related papers, arXiv summaries, PDF-grounded answers, paper benchmark or method discovery, or codebase inspection for a paper.
---

# AlphaXiv Skill

Use the native AlphaXiv tools registered by the `alphaclawxiv` plugin for
research tasks. If the tools are not available, ask the user to run
`openclaw alphaclawxiv auth login` and restart the OpenClaw gateway after login
completes.

Important: the public AlphaXiv MCP docs page and the live hosted MCP server are
currently not identical. The hosted server presently exposes `discover_papers`,
`get_paper_content`, `answer_pdf_queries`, and
`read_files_from_github_repository`. Use the live hosted tool surface, not the
stale documented six-tool list, when operating through this plugin.

## Workflow

1. Use `discover_papers` as the default discovery tool for literature search, related work, or broad topical coverage.
2. Populate `discover_papers.keywords` with 3-4 exact terms such as a method name, benchmark, acronym, author, or title fragment.
3. Populate `discover_papers.question` with a richer semantic description of the desired papers, and raise `difficulty` when the question is broad or ambiguous.
4. Use `get_paper_content` when you need the paper itself, either as an intermediate report or raw text.
5. Use `answer_pdf_queries` to retrieve targeted PDF page content, then synthesize the answer from the returned passages.
6. Use `read_files_from_github_repository` only after you know the repository URL.

## Defaults

- Prefer the native AlphaXiv tools rather than website scraping.
- Prefer `discover_papers` for both open-ended and targeted paper discovery.
- Treat terminal subcommands like `paper search-semantic` and `paper search-keyword` as CLI helpers that map into `discover_papers`; they are not separate hosted MCP tool names.
- Increase `difficulty` when the user asks for a broad survey, recent landscape, or multiple candidate approaches.
- Prefer `answer_pdf_queries` over a full paper dump when the user asks a specific question; it returns filtered passages, not a final synthesized answer.
- When summarizing multiple papers, keep the output comparative: methods, datasets, results, and notable limitations.

## Output guidance

- Include paper titles and URLs when available.
- Separate what the paper states from your synthesis.
- Call out uncertainty if a result depends on incomplete paper text or missing repo context.
