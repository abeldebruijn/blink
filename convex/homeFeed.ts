import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const maxHomeFeedItems = 100;

async function requireCurrentReader(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new ConvexError("Authentication required");
  }

  const reader = await ctx.db
    .query("readers")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

  if (reader === null) {
    throw new ConvexError("Reader not found");
  }

  return reader;
}

function boundedLimit(limit: number) {
  return Math.max(1, Math.min(limit, maxHomeFeedItems));
}

function sortTimeForPost(
  post: Pick<Doc<"posts">, "publishedAt" | "discoveredAt">,
) {
  return post.publishedAt ?? post.discoveredAt;
}

function postAbstractFields(
  firecrawlVisitedAt: number | null,
  firecrawlPageSummary: string | null,
  rssDescription: string | null,
) {
  if (firecrawlPageSummary !== null && firecrawlPageSummary.trim() !== "") {
    return {
      abstract: firecrawlPageSummary,
      abstractSource: "firecrawl_page_summary" as const,
    };
  }

  if (
    firecrawlVisitedAt !== null &&
    rssDescription !== null &&
    rssDescription.trim() !== ""
  ) {
    return {
      abstract: rssDescription,
      abstractSource: "rss_description_fallback" as const,
    };
  }

  return {
    abstract: null,
    abstractSource: "none" as const,
  };
}

async function materializeHomeFeedItem(
  ctx: MutationCtx,
  readerId: Id<"readers">,
  postId: Id<"posts">,
) {
  const post = await ctx.db.get(postId);
  if (post === null) {
    throw new ConvexError("Post not found");
  }

  const now = Date.now();
  const fields = {
    readerId,
    postId,
    sortTime: sortTimeForPost(post),
    publishedAt: post.publishedAt,
    discoveredAt: post.discoveredAt,
    updatedAt: now,
  };

  const existing = await ctx.db
    .query("homeFeedItems")
    .withIndex("by_readerId_and_postId", (q) =>
      q.eq("readerId", readerId).eq("postId", postId),
    )
    .unique();

  if (existing === null) {
    return await ctx.db.insert("homeFeedItems", {
      ...fields,
      readAt: null,
      createdAt: now,
    });
  }

  await ctx.db.patch(existing._id, fields);
  return existing._id;
}

export const list = query({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const reader = await requireCurrentReader(ctx);
    const items = await ctx.db
      .query("homeFeedItems")
      .withIndex("by_readerId_and_sortTime", (q) =>
        q.eq("readerId", reader._id),
      )
      .order("desc")
      .take(boundedLimit(args.limit));

    const results = [];
    for (const item of items) {
      const post = await ctx.db.get(item.postId);
      if (post === null) {
        continue;
      }

      results.push({
        _id: item._id,
        postId: item.postId,
        source: {
          title: post.sourceTitle,
          siteUrl: post.sourceSiteUrl,
          feedUrl: post.sourceFeedUrl,
        },
        title: post.rssTitle,
        abstract: post.abstract,
        abstractSource: post.abstractSource,
        headerImageUrl: post.headerImageUrl,
        publishedAt: post.publishedAt,
        discoveredAt: post.discoveredAt,
        canonicalUrl: post.canonicalUrl,
        readAt: item.readAt,
        isRead: item.readAt !== null,
      });
    }

    return results;
  },
});

export const markRead = mutation({
  args: {
    homeFeedItemId: v.id("homeFeedItems"),
    read: v.boolean(),
  },
  handler: async (ctx, args) => {
    const reader = await requireCurrentReader(ctx);
    const item = await ctx.db.get(args.homeFeedItemId);
    if (item === null || item.readerId !== reader._id) {
      throw new ConvexError("Home feed item not found");
    }

    await ctx.db.patch(args.homeFeedItemId, {
      readAt: args.read ? Date.now() : null,
      updatedAt: Date.now(),
    });
  },
});

export const upsertPost = internalMutation({
  args: {
    readerId: v.id("readers"),
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
    headerImageUrl: v.union(v.string(), v.null()),
    publishedAt: v.union(v.number(), v.null()),
    discoveredAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const abstractFields = postAbstractFields(
      args.firecrawlVisitedAt,
      args.firecrawlPageSummary,
      args.rssDescription,
    );
    const existing = await ctx.db
      .query("posts")
      .withIndex("by_canonicalUrl", (q) =>
        q.eq("canonicalUrl", args.canonicalUrl),
      )
      .unique();

    const postFields = {
      sourceTitle: args.sourceTitle,
      sourceSiteUrl: args.sourceSiteUrl,
      sourceFeedUrl: args.sourceFeedUrl,
      rssTitle: args.rssTitle,
      rssDescription: args.rssDescription,
      rssLinkUrl: args.rssLinkUrl,
      canonicalUrl: args.canonicalUrl,
      firecrawlVisitedAt: args.firecrawlVisitedAt,
      firecrawlPageContent: args.firecrawlPageContent,
      firecrawlPageSummary: args.firecrawlPageSummary,
      ...abstractFields,
      headerImageUrl: args.headerImageUrl,
      publishedAt: args.publishedAt,
      discoveredAt: args.discoveredAt,
      updatedAt: now,
    };

    const postId =
      existing === null
        ? await ctx.db.insert("posts", {
            ...postFields,
            createdAt: now,
          })
        : existing._id;

    if (existing !== null) {
      await ctx.db.patch(existing._id, postFields);
    }

    const homeFeedItemId = await materializeHomeFeedItem(
      ctx,
      args.readerId,
      postId,
    );

    return { postId, homeFeedItemId };
  },
});
