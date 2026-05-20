# Materialized Per-Reader Home Feed Items

Blink will materialize Home Feed Items for each Reader instead of calculating the Home Feed from Feed Subscriptions on every request.

The Home Feed is a Reader-specific view of shared Posts. It combines shared Post state with per-Reader state such as Feed Subscriptions, Read Later, Read State, Post Signals, Author Hide, Topic Hide, and Personal Notes. Computing that view live would make each Home Feed request depend on repeatedly joining shared feed data with Reader-specific filters and presentation state.

Materialized Home Feed Items make the Reader's feed explicit product state. They let Blink record why a Post is visible for a Reader, preserve stable ordering by Published Time then Discovered Time, include importing or failed Posts, and update visibility when the Reader subscribes, unsubscribes, hides, or saves without re-deriving the whole feed on every read.

This keeps read paths predictable for the primary screen while leaving shared Post, Extracted Content, Abstract, and Feed data reusable across Readers. The cost is that subscription, import, and hide actions must maintain Home Feed Items as part of their product state changes.

Post summarization still depends on Post-level Extracted Content, not Home Feed Item content. Blink uses Firecrawl to read each Post's Canonical Article URL discovered from RSS or Atom feeds, then generates the shared Abstract from that extracted page content. Feed entry descriptions are discovery and fallback metadata, not the canonical summarization source.
