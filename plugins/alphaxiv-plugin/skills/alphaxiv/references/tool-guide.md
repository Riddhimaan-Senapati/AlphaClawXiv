# AlphaXiv MCP Tool Guide

## Tool selection

- `agentic_paper_retrieval`
  - Use for broad literature-review prompts.
  - Good first choice for "what are the latest approaches to X?"

- `full_text_papers_search`
  - Use for exact query terms such as benchmark names, authors, model names, or paper titles.

- `embedding_similarity_search`
  - Use when the user wants conceptually similar papers or adjacent methods.

- `get_paper_content`
  - Use to fetch a structured report or the full extracted paper text.

- `answer_pdf_queries`
  - Use for focused questions like datasets, hyperparameters, claims, or limitations.

- `read_files_from_github_repository`
  - Use only after a repository URL is known.
  - Start with `/` to inspect the top-level structure before drilling into files.

## Common patterns

- Literature review:
  run `agentic_paper_retrieval`, then use `answer_pdf_queries` on the best papers for structured comparisons.

- Explain a single paper:
  use `get_paper_content` first, then `answer_pdf_queries` for unresolved details.

- Understand implementation:
  get the repo URL, read `/`, then inspect the main training, inference, or model files.
