---
name: alphaxiv
description: Use AlphaXiv for research-paper discovery, literature review, arXiv or PDF passage retrieval, paper summarization, finding related work, and reading implementation repositories tied to papers. Trigger when the user asks for academic paper search, related papers, arXiv summaries, PDF-grounded answers, paper benchmark or method discovery, or codebase inspection for a paper.
---

# AlphaXiv Skill

Use the native AlphaXiv tools registered by the `alphaclawxiv` plugin for
research tasks. If the tools are not available, ask the user to run
`openclaw alphaclawxiv auth login` and restart the OpenClaw gateway after login
completes.

## Workflow

1. Use `paper_search` as the primary discovery tool for topics, keywords, methods, benchmarks, authors, or "find papers like this" requests.
2. Use `get_paper_content` when you need the paper itself, either as an intermediate report or raw text.
3. Use `answer_pdf_queries` to retrieve targeted PDF page content, then synthesize the answer from the returned passages.
4. Use `read_files_from_github_repository` only after you know the repository URL.

## Defaults

- Prefer the native AlphaXiv tools rather than website scraping.
- Prefer `paper_search` when the user asks open-ended research questions.
- Prefer `answer_pdf_queries` over a full paper dump when the user asks a specific question; it returns filtered passages, not a final synthesized answer.
- When summarizing multiple papers, keep the output comparative: methods, datasets, results, and notable limitations.

## Output guidance

- Include paper titles and URLs when available.
- Separate what the paper states from your synthesis.
- Call out uncertainty if a result depends on incomplete paper text or missing repo context.
