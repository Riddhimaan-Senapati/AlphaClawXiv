import { Type } from "typebox";
import type { TSchema } from "typebox";
import { runTool } from "./actions.js";
import type { PluginToolDefinition } from "./sdk-types.js";

function makeTool(name: string, label: string, description: string, parameters: TSchema): PluginToolDefinition {
  return {
    name,
    label,
    description,
    parameters,
    async execute(_toolCallId, params) {
      return runTool(name, params as Record<string, unknown>);
    },
  };
}

export const tools: PluginToolDefinition[] = [
  makeTool(
    "discover_papers",
    "Discover Papers",
    "Discover and rank multiple candidate papers for a research topic using keywords, a semantic question, and retrieval difficulty.",
    Type.Object(
      {
        keywords: Type.Array(Type.String(), { description: "3-4 concise keyword terms for exact-name, acronym, method, benchmark, author, or title matching." }),
        question: Type.String({ description: "Detailed semantic description of the papers that would best answer the request." }),
        difficulty: Type.Number({ description: "A 1-10 estimate of how much retrieval effort this request warrants. Higher values take longer but trigger multi-round follow-up searches." }),
        published_after: Type.Optional(Type.String({ description: "Only return papers first published on or after this date (YYYY-MM-DD)." })),
        published_before: Type.Optional(Type.String({ description: "Only return papers first published on or before this date (YYYY-MM-DD)." })),
        prioritize: Type.Optional(Type.Union([Type.Literal("default"), Type.Literal("historical"), Type.Literal("recency")], { description: "How to sort and prioritize the results." })),
      },
      { additionalProperties: false },
    ),
  ),
  makeTool(
    "get_paper_content",
    "Get Paper Content",
    "Get the content of an arXiv/alphaXiv paper as text. Returns a structured intermediate report by default, or the full extracted text.",
    Type.Object(
      {
        url: Type.String({ description: "An arXiv or alphaXiv URL." }),
        fullText: Type.Optional(Type.Boolean({ description: "Return the full extracted text instead of the intermediate report." })),
      },
      { additionalProperties: false },
    ),
  ),
  makeTool(
    "answer_pdf_queries",
    "Answer PDF Queries",
    "Returns filtered page-level content of a single PDF relevant to one or more queries. Output is XML so citations can be built from the returned page text.",
    Type.Object(
      {
        paper: Type.String({ description: "The paper to read, as an arXiv ID, a URL (arXiv, alphaXiv, Semantic Scholar), a title, or a direct PDF URL." }),
        queries: Type.Array(Type.String(), { description: "One or more brief descriptions of the information you are looking for in the paper." }),
      },
      { additionalProperties: false },
    ),
  ),
  makeTool(
    "read_files_from_github_repository",
    "Read GitHub Repository",
    "Reads the contents of files or directories from a paper's GitHub repository. Reading '/' returns the complete file tree and all top-level files.",
    Type.Object(
      {
        githubUrl: Type.String({ description: "The URL of the paper's codebase repository." }),
        path: Type.String({ description: "The path to the file or directory. Use '/' to get the entire repository structure and top-level files." }),
      },
      { additionalProperties: false },
    ),
  ),
  makeTool(
    "find_researchers",
    "Find Researchers",
    "Finds researchers by subject, organization, career history, or coauthorship. A topic query is answered from the authorship graph.",
    Type.Object(
      {
        query: Type.Optional(Type.String({ description: "A person's name when identifying that person is the task, or a research subject." })),
        topic: Type.Optional(Type.String({ description: "Research subject answered from paper authorship, for 'who works on X'." })),
        topic_authors: Type.Optional(Type.Union([Type.Literal("lead"), Type.Literal("senior"), Type.Literal("any")])),
        affiliation: Type.Optional(Type.String({ description: "Current organization." })),
        include_past_affiliations: Type.Optional(Type.Boolean()),
        position: Type.Optional(Type.Object({}, { additionalProperties: true })),
        relationship: Type.Optional(Type.Object({}, { additionalProperties: true })),
        role: Type.Optional(Type.String({ description: "Current role, token-matched." })),
        min_citations: Type.Optional(Type.Number()),
        max_citations: Type.Optional(Type.Number()),
        sort: Type.Optional(Type.Union([Type.Literal("relevance"), Type.Literal("citations"), Type.Literal("recent_activity"), Type.Literal("relationship_strength")])),
        limit: Type.Optional(Type.Number()),
        page: Type.Optional(Type.Number()),
      },
      { additionalProperties: false },
    ),
  ),
  makeTool(
    "get_researcher",
    "Get Researchers",
    "Gets compact profiles for up to 25 researchers at once. Names resolve to the best-matching indexed researcher.",
    Type.Object(
      {
        researchers: Type.Array(Type.String(), { description: "Full names or exact slugs." }),
        include: Type.Optional(Type.Array(Type.String(), { description: "Additional sections: bio, position_history, linkedin_experience, education, citation_trajectory, coauthors, alphaxiv_account, links." })),
        papers: Type.Optional(Type.Union([Type.Literal("none"), Type.Literal("notable"), Type.Literal("recent")])),
        paper_limit: Type.Optional(Type.Number()),
      },
      { additionalProperties: false },
    ),
  ),
  makeTool(
    "get_researcher_papers",
    "Get Researcher Papers",
    "The papers on alphaXiv for one or many researchers, grouped per researcher. Sort by recent with published_after for current work, or by cited for best-known work.",
    Type.Object(
      {
        researchers: Type.Array(Type.String(), { description: "Full names or exact slugs." }),
        sort: Type.Optional(Type.Union([Type.Literal("recent"), Type.Literal("cited"), Type.Literal("viewed")])),
        published_after: Type.Optional(Type.String({ description: "Only papers first published on or after this date (YYYY-MM-DD)." })),
        limit_per_researcher: Type.Optional(Type.Number()),
      },
      { additionalProperties: false },
    ),
  ),
  makeTool(
    "resolve_researchers",
    "Resolve Researchers",
    "Turns a list of people read elsewhere into current alphaXiv researcher entries. Pass every person in one batch.",
    Type.Object(
      {
        people: Type.Array(Type.Object({}, { additionalProperties: true }), { description: "Each entry takes the person's name, plus optional personal, institutional, Scholar, LinkedIn, or OpenReview url." }),
        related_researchers: Type.Optional(Type.Array(Type.String(), { description: "Names or slugs related to the whole list." })),
      },
      { additionalProperties: false },
    ),
  ),
  makeTool(
    "list_followed_researchers",
    "List Followed Researchers",
    "Lists the researchers the user follows, with each one's slug, name, current headline or affiliation, and citation count.",
    Type.Object({}, { additionalProperties: false }),
  ),
  makeTool(
    "follow_researcher",
    "Follow Researcher",
    "Follows a researcher so their new papers reach the user's feed. Idempotent; the slug comes from find_researchers, get_researcher, or a /@slug profile URL.",
    Type.Object({ slug: Type.String() }, { additionalProperties: false }),
  ),
  makeTool(
    "unfollow_researcher",
    "Unfollow Researcher",
    "Stops following a researcher. Idempotent; the slug comes from list_followed_researchers.",
    Type.Object({ slug: Type.String() }, { additionalProperties: false }),
  ),
  makeTool(
    "list_library",
    "List Library",
    "Lists the user's folders (bookmark collections) with folder_id, name, type, parent_id, sharing_status, and paper_count.",
    Type.Object(
      {
        include_papers: Type.Optional(Type.Boolean({ description: "Also list the papers inside each folder." })),
        paper_ids_or_urls: Type.Optional(Type.Array(Type.String(), { description: "Report which folders already contain each of these papers." })),
      },
      { additionalProperties: false },
    ),
  ),
  makeTool(
    "save_papers_to_folder",
    "Save Papers to Folder",
    "Adds one or more papers to a folder. Papers not yet in the database are fetched from arXiv. Adding is idempotent.",
    Type.Object(
      {
        paper_ids_or_urls: Type.Array(Type.String(), { description: "arXiv ids or alphaXiv/arXiv URLs of the papers to save." }),
        folder_id: Type.Optional(Type.String({ description: "Target folder. Defaults to the user's 'Want to read' folder." })),
      },
      { additionalProperties: false },
    ),
  ),
  makeTool(
    "remove_papers_from_folder",
    "Remove Papers from Folder",
    "Removes one or more papers from a single folder. Only affects the given folder; each paper stays in any others it belongs to.",
    Type.Object(
      {
        paper_ids_or_urls: Type.Array(Type.String(), { description: "arXiv ids or alphaXiv/arXiv URLs of the papers to remove." }),
        folder_id: Type.String({ description: "Folder to remove the papers from." }),
      },
      { additionalProperties: false },
    ),
  ),
  makeTool(
    "move_papers_between_folders",
    "Move Papers Between Folders",
    "Moves papers from a source folder to a destination folder atomically: each paper is added to the destination and removed from the source.",
    Type.Object(
      {
        paper_ids_or_urls: Type.Array(Type.String(), { description: "arXiv ids or alphaXiv/arXiv URLs of the papers to move." }),
        from_folder_id: Type.String({ description: "Source folder." }),
        to_folder_id: Type.String({ description: "Destination folder." }),
      },
      { additionalProperties: false },
    ),
  ),
  makeTool(
    "create_folder",
    "Create Folder",
    "Creates a new custom folder, optionally nested under an existing folder.",
    Type.Object(
      {
        name: Type.String({ description: "Name of the new folder." }),
        parent_folder_id: Type.Optional(Type.String({ description: "Nest the new folder under this existing folder." })),
      },
      { additionalProperties: false },
    ),
  ),
  makeTool(
    "rename_folder",
    "Rename Folder",
    "Renames a custom folder. Only custom folders can be renamed, not the default reading-status or publications folders.",
    Type.Object(
      {
        folder_id: Type.String({ description: "Custom folder to rename." }),
        name: Type.String({ description: "New name for the folder." }),
      },
      { additionalProperties: false },
    ),
  ),
  makeTool(
    "delete_folder",
    "Delete Folder",
    "Deletes a folder and its paper memberships. The papers themselves are not deleted, and the publications and private-papers folders cannot be deleted.",
    Type.Object({ folder_id: Type.String() }, { additionalProperties: false }),
  ),
  makeTool(
    "edit_private_paper_metadata",
    "Edit Private Paper Metadata",
    "Edits the metadata of a paper you uploaded to alphaXiv yourself. Only the fields you pass change; the rest keep their current values.",
    Type.Object(
      {
        paper_id_or_url: Type.String({ description: "The paper's id as returned by list_library, or its alphaXiv URL." }),
        title: Type.Optional(Type.String()),
        abstract: Type.Optional(Type.String()),
        authors: Type.Optional(Type.Array(Type.String())),
        publication_date: Type.Optional(Type.String({ description: "The date the paper was originally published (YYYY-MM-DD)." })),
        categories: Type.Optional(Type.Array(Type.String())),
        bibtex: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      },
      { additionalProperties: false },
    ),
  ),
];

export const toolOptions: Record<string, { optional: boolean }> = {
  discover_papers: { optional: false },
  get_paper_content: { optional: false },
  answer_pdf_queries: { optional: false },
  read_files_from_github_repository: { optional: false },
  find_researchers: { optional: false },
  get_researcher: { optional: false },
  get_researcher_papers: { optional: false },
  resolve_researchers: { optional: false },
  list_followed_researchers: { optional: false },
  list_library: { optional: false },
  follow_researcher: { optional: true },
  unfollow_researcher: { optional: true },
  save_papers_to_folder: { optional: true },
  remove_papers_from_folder: { optional: true },
  move_papers_between_folders: { optional: true },
  create_folder: { optional: true },
  rename_folder: { optional: true },
  delete_folder: { optional: true },
  edit_private_paper_metadata: { optional: true },
};
