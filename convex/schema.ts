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
  posts: defineTable({
    sourceTitle: v.string(),
    sourceSiteUrl: v.union(v.string(), v.null()),
    sourceFeedUrl: v.union(v.string(), v.null()),
    rssTitle: v.string(),
    rssDescription: v.union(v.string(), v.null()),
    rssLinkUrl: v.string(),
    canonicalUrl: v.string(),
    firecrawlVisitedAt: v.union(v.number(), v.null()),
    firecrawlPageContent: v.union(v.string(), v.null()),
    firecrawlPageSummary: v.union(v.string(), v.null()),
    abstract: v.union(v.string(), v.null()),
    abstractSource: v.union(
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
    .index("by_discoveredAt", ["discoveredAt"]),
  homeFeedItems: defineTable({
    readerId: v.id("readers"),
    postId: v.id("posts"),
    sortTime: v.number(),
    publishedAt: v.union(v.number(), v.null()),
    discoveredAt: v.number(),
    readAt: v.union(v.number(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_readerId_and_sortTime", ["readerId", "sortTime"])
    .index("by_readerId_and_postId", ["readerId", "postId"]),
});
