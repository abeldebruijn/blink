import { ConvexError, v } from "convex/values";
import {
  internalQuery,
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
      abstractSource: "ai_generated" as const,
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
        firecrawlStatus: post.firecrawlStatus ?? null,
        abstractStatus: post.abstractStatus ?? null,
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

export const getReadingView = query({
  args: {
    postId: v.string(),
  },
  handler: async (ctx, args) => {
    const reader = await requireCurrentReader(ctx);
    const postId = ctx.db.normalizeId("posts", args.postId);
    if (postId === null) {
      return null;
    }

    const item = await ctx.db
      .query("homeFeedItems")
      .withIndex("by_readerId_and_postId", (q) =>
        q.eq("readerId", reader._id).eq("postId", postId),
      )
      .unique();

    if (item === null) {
      return null;
    }

    const post = await ctx.db.get(postId);
    if (post === null) {
      return null;
    }

    return {
      postId,
      homeFeedItemId: item._id,
      source: {
        title: post.sourceTitle,
        siteUrl: post.sourceSiteUrl,
        feedUrl: post.sourceFeedUrl,
      },
      title: post.rssTitle,
      canonicalUrl: post.canonicalUrl,
      headerImageUrl: post.headerImageUrl,
      publishedAt: post.publishedAt,
      discoveredAt: post.discoveredAt,
      firecrawlPageContent: post.firecrawlPageContent,
      firecrawlStatus: post.firecrawlStatus ?? null,
      abstractStatus: post.abstractStatus ?? null,
      readAt: item.readAt,
      isRead: item.readAt !== null,
      savedAt: item.savedAt ?? null,
      isSaved: item.savedAt !== undefined && item.savedAt !== null,
    };
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

export const toggleSave = mutation({
  args: {
    homeFeedItemId: v.id("homeFeedItems"),
    saved: v.boolean(),
  },
  handler: async (ctx, args) => {
    const reader = await requireCurrentReader(ctx);
    const item = await ctx.db.get(args.homeFeedItemId);
    if (item === null || item.readerId !== reader._id) {
      throw new ConvexError("Home feed item not found");
    }

    await ctx.db.patch(args.homeFeedItemId, {
      savedAt: args.saved ? Date.now() : null,
      updatedAt: Date.now(),
    });
  },
});

export const listSaved = query({
  args: {},
  handler: async (ctx) => {
    const reader = await requireCurrentReader(ctx);
    const items = await ctx.db
      .query("homeFeedItems")
      .withIndex("by_readerId_and_sortTime", (q) =>
        q.eq("readerId", reader._id),
      )
      .order("desc")
      .collect();

    const results = [];
    for (const item of items) {
      if (item.savedAt === undefined || item.savedAt === null) {
        continue;
      }
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
        firecrawlStatus: post.firecrawlStatus ?? null,
        abstractStatus: post.abstractStatus ?? null,
        headerImageUrl: post.headerImageUrl,
        publishedAt: post.publishedAt,
        discoveredAt: post.discoveredAt,
        canonicalUrl: post.canonicalUrl,
        readAt: item.readAt,
        isRead: item.readAt !== null,
        savedAt: item.savedAt,
      });
    }

    return results;
  },
});

export const upsertPost = internalMutation({
  args: {
    feedId: v.optional(v.union(v.id("feeds"), v.null())),
    feedImportRunId: v.optional(v.union(v.id("feedImportRuns"), v.null())),
    readerId: v.id("readers"),
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
      feedId: args.feedId ?? null,
      feedImportRunId: args.feedImportRunId ?? null,
      sourceTitle: args.sourceTitle,
      sourceSiteUrl: args.sourceSiteUrl,
      sourceFeedUrl: args.sourceFeedUrl,
      rssTitle: args.rssTitle,
      rssDescription: args.rssDescription,
      rssLinkUrl: args.rssLinkUrl,
      canonicalUrl: args.canonicalUrl,
      firecrawlStatus: args.firecrawlStatus ?? null,
      firecrawlVisitedAt: args.firecrawlVisitedAt,
      firecrawlPageContent: args.firecrawlPageContent,
      firecrawlPageSummary: args.firecrawlPageSummary,
      firecrawlError: args.firecrawlError ?? null,
      abstractStatus: args.abstractStatus ?? null,
      abstractError: args.abstractError ?? null,
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

export const getProcessingState = internalQuery({
  args: {
    canonicalUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("posts")
      .withIndex("by_canonicalUrl", (q) =>
        q.eq("canonicalUrl", args.canonicalUrl),
      )
      .unique();

    if (post === null) {
      return null;
    }

    return {
      postId: post._id,
      firecrawlStatus: post.firecrawlStatus ?? null,
      firecrawlVisitedAt: post.firecrawlVisitedAt,
      firecrawlPageContent: post.firecrawlPageContent,
      firecrawlPageSummary: post.firecrawlPageSummary,
      headerImageUrl: post.headerImageUrl,
    };
  },
});
