# Workflow Orchestrates Imports, Convex Stores State

Vercel Workflow owns long-running import orchestration for feed parsing, Firecrawl extraction, abstract generation, header image selection, and tag proposal work. Convex owns durable product state and exposes mutations for each workflow step to record discovered Feeds, Posts, Extracted Content, Abstracts, Tags, and failure states. This keeps Convex mutations focused on transactional state changes while Workflow handles retryable external calls and multi-step agent work.
