# Workflow Orchestrates Imports, Convex Stores State

Vercel Workflow owns long-running import orchestration for feed parsing, Firecrawl extraction, abstract generation, header image selection, and tag proposal work. Convex owns durable product state and exposes mutations for each workflow step to record discovered Feeds, Posts, Extracted Content, Abstracts, Tags, and failure states. This keeps Convex mutations focused on transactional state changes while Workflow handles retryable external calls and multi-step agent work.

Authenticated Next route handlers are the trigger boundary for Reader-initiated import work. They use Clerk to identify the Reader, ensure the Reader exists in Convex, then start the appropriate Workflow run for Initial Import, Manual Refresh, replacement Feed URL import, or failed Post retry.

Workflow writes to Convex through narrowly scoped service-token mutations. The service token authenticates the workflow runtime; Reader ownership is still checked when a workflow touches Reader-specific state such as Feed Subscriptions, Feed Import Runs, and Home Feed Items.

Post processing is bounded parallel work. Workflow processes imported Posts in batches of four so Firecrawl extraction and Abstract generation can overlap without turning one Feed import into an unbounded provider burst.

The product UI continues to observe Convex state. `feedImportRuns`, Posts, Home Feed Items, and Reading View data remain the durable user-visible model; Workflow observability is operational debugging rather than v1 product state.
