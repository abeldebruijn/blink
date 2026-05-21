import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  numbers: defineTable({
    value: v.number(),
  }),
  readers: defineTable({
    tokenIdentifier: v.string(),
    subject: v.string(),
    issuer: v.string(),
    name: v.union(v.string(), v.null()),
    email: v.union(v.string(), v.null()),
    pictureUrl: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastSeenAt: v.number(),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),
  feeds: defineTable({
    canonicalFeedUrl: v.string(),
    title: v.string(),
    siteUrl: v.union(v.string(), v.null()),
    description: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_canonicalFeedUrl", ["canonicalFeedUrl"]),
  feedSubscriptions: defineTable({
    readerId: v.id("readers"),
    feedId: v.id("feeds"),
    displayTitle: v.optional(v.union(v.string(), v.null())),
    submittedFeedUrl: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_readerId_and_feedId", ["readerId", "feedId"])
    .index("by_readerId_and_updatedAt", ["readerId", "updatedAt"]),
  feedImportRuns: defineTable({
    readerId: v.id("readers"),
    feedId: v.id("feeds"),
    submittedFeedUrl: v.string(),
    canonicalFeedUrl: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("importing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    discoveredCount: v.number(),
    importCount: v.number(),
    queuedCount: v.number(),
    completedCount: v.number(),
    failedCount: v.number(),
    error: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_readerId_and_createdAt", ["readerId", "createdAt"])
    .index("by_feedId_and_createdAt", ["feedId", "createdAt"]),
  posts: defineTable({
    feedId: v.optional(v.union(v.id("feeds"), v.null())),
    feedImportRunId: v.optional(v.union(v.id("feedImportRuns"), v.null())),
    sourceTitle: v.string(),
    sourceSiteUrl: v.union(v.string(), v.null()),
    sourceFeedUrl: v.union(v.string(), v.null()),
    rssTitle: v.string(),
    rssDescription: v.union(v.string(), v.null()),
    rssLinkUrl: v.string(),
    canonicalUrl: v.string(),
    firecrawlStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("succeeded"),
        v.literal("failed"),
        v.null(),
      ),
    ),
    firecrawlVisitedAt: v.union(v.number(), v.null()),
    firecrawlPageContent: v.union(v.string(), v.null()),
    firecrawlPageSummary: v.union(v.string(), v.null()),
    firecrawlError: v.optional(v.union(v.string(), v.null())),
    abstractStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("succeeded"),
        v.literal("failed"),
        v.null(),
      ),
    ),
    abstractError: v.optional(v.union(v.string(), v.null())),
    abstract: v.union(v.string(), v.null()),
    abstractSource: v.union(
      v.literal("ai_generated"),
      v.literal("firecrawl_page_summary"),
      v.literal("rss_description_fallback"),
      v.literal("none"),
    ),
    headerImageUrl: v.union(v.string(), v.null()),
    publishedAt: v.union(v.number(), v.null()),
    discoveredAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_canonicalUrl", ["canonicalUrl"])
    .index("by_feedId", ["feedId"])
    .index("by_feedImportRunId", ["feedImportRunId"])
    .index("by_discoveredAt", ["discoveredAt"]),
  homeFeedItems: defineTable({
    readerId: v.id("readers"),
    postId: v.id("posts"),
    sortTime: v.number(),
    publishedAt: v.union(v.number(), v.null()),
    discoveredAt: v.number(),
    readAt: v.union(v.number(), v.null()),
    savedAt: v.optional(v.union(v.number(), v.null())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_readerId_and_sortTime", ["readerId", "sortTime"])
    .index("by_readerId_and_postId", ["readerId", "postId"]),
});
