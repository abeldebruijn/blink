# Workflow Orchestrates Imports, Convex Stores State

Vercel Workflow owns long-running import orchestration for feed parsing, Firecrawl extraction, abstract generation, header image selection, and tag proposal work. Convex owns durable product state and exposes mutations for each workflow step to record discovered Feeds, Posts, Extracted Content, Abstracts, Tags, and failure states. This keeps Convex mutations focused on transactional state changes while Workflow handles retryable external calls and multi-step agent work.

MVP exception: the `/feeds/new` Firecrawl smoke-test path currently lets Convex own the Initial Import orchestration directly. This keeps the first production Add Feed flow observable before Workflow is wired in; the durable Feed, Feed Subscription, Post, Extracted Content, and Abstract state still lives in Convex.
