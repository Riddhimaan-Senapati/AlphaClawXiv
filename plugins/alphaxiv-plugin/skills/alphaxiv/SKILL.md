---
name: alphaxiv
description: Use AlphaXiv for research-paper discovery, literature review, arXiv or PDF question answering, paper summarization, finding related work, and reading implementation repositories tied to papers. Trigger when the user asks for academic paper search, related papers, arXiv summaries, PDF-based answers, benchmark or method discovery, or codebase inspection for a paper.
---

# AlphaXiv Skill

Use the bundled `alphaxiv` MCP server for research tasks. If the server is not
available, tell the user the plugin may still need the AlphaXiv OAuth login
flow to complete in the MCP bridge.

## Workflow

1. Use `agentic_paper_retrieval` for broad research questions where recall matters.
2. Use `full_text_papers_search` for exact keywords, author names, method names, or benchmarks.
3. Use `embedding_similarity_search` for concept-level similarity or "find papers like this" tasks.
4. Use `get_paper_content` when you need the paper itself, either as an intermediate report or raw text.
5. Use `answer_pdf_queries` for targeted questions about a paper or PDF.
6. Use `read_files_from_github_repository` only after you know the repository URL.

## Defaults

- Prefer the official AlphaXiv MCP endpoint rather than website scraping.
- Prefer `agentic_paper_retrieval` over keyword search when the user asks open-ended research questions.
- Prefer `answer_pdf_queries` over a full paper dump when the user asks a specific question.
- When summarizing multiple papers, keep the output comparative: methods, datasets, results, and notable limitations.

## Output guidance

- Include paper titles and URLs when available.
- Separate what the paper states from your synthesis.
- Call out uncertainty if a result depends on incomplete paper text or missing repo context.
