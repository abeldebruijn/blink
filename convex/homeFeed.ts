import { ConvexError, v } from "convex/values";
import { DirectAggregate } from "@convex-dev/aggregate";
import { paginationOptsValidator } from "convex/server";
import {
  internalQuery,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { components } from "./_generated/api";

const maxHomeFeedItems = 100;
const homeFeedBucketValidator = v.union(
  v.literal("unread"),
  v.literal("read"),
  v.literal("readLater"),
  v.literal("liked"),
);

type HomeFeedBucket = "unread" | "read" | "readLater" | "liked";

const homeFeedBuckets = new DirectAggregate<{
  Key: [Id<"readers">, HomeFeedBucket, number];
  Id: string;
}>(components.homeFeedBuckets);

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

function aggregateId(itemId: Id<"homeFeedItems">, bucket: HomeFeedBucket) {
  return `${itemId}:${bucket}`;
}

function bucketEntries(item: Doc<"homeFeedItems">) {
  const entries: Array<{
    bucket: HomeFeedBucket;
    key: [Id<"readers">, HomeFeedBucket, number];
    id: string;
  }> = [];
  const readBucket = item.readAt === null ? "unread" : "read";

  entries.push({
    bucket: readBucket,
    key: [item.readerId, readBucket, item.sortTime],
    id: aggregateId(item._id, readBucket),
  });

  if (item.readLaterAt !== undefined && item.readLaterAt !== null) {
    entries.push({
      bucket: "readLater",
      key: [item.readerId, "readLater", item.sortTime],
      id: aggregateId(item._id, "readLater"),
    });
  }

  if (item.likedAt !== undefined && item.likedAt !== null) {
    entries.push({
      bucket: "liked",
      key: [item.readerId, "liked", item.sortTime],
      id: aggregateId(item._id, "liked"),
    });
  }

  return entries;
}

async function insertBucketEntries(ctx: MutationCtx, item: Doc<"homeFeedItems">) {
  for (const entry of bucketEntries(item)) {
    await homeFeedBuckets.insertIfDoesNotExist(ctx, {
      key: entry.key,
      id: entry.id,
    });
  }
}

async function replaceBucketEntries(
  ctx: MutationCtx,
  oldItem: Doc<"homeFeedItems">,
  newItem: Doc<"homeFeedItems">,
) {
  const oldEntries = new Map(
    bucketEntries(oldItem).map((entry) => [entry.bucket, entry]),
  );
  const newEntries = new Map(
    bucketEntries(newItem).map((entry) => [entry.bucket, entry]),
  );

  for (const [bucket, oldEntry] of oldEntries) {
    const newEntry = newEntries.get(bucket);
    if (newEntry === undefined) {
      await homeFeedBuckets.deleteIfExists(ctx, {
        key: oldEntry.key,
        id: oldEntry.id,
      });
      continue;
    }

    await homeFeedBuckets.replaceOrInsert(
      ctx,
      { key: oldEntry.key, id: oldEntry.id },
      { key: newEntry.key },
    );
  }

  for (const [bucket, newEntry] of newEntries) {
    if (oldEntries.has(bucket)) {
      continue;
    }
    await homeFeedBuckets.insertIfDoesNotExist(ctx, {
      key: newEntry.key,
      id: newEntry.id,
    });
  }
}

function itemIdFromAggregateId(id: string) {
  return id.split(":")[0] ?? "";
}

function countBounds(readerId: Id<"readers">, bucket: HomeFeedBucket) {
  return {
    namespace: undefined,
    bounds: {
      prefix: [readerId, bucket] as [Id<"readers">, HomeFeedBucket],
    },
  };
}

async function homeFeedItemView(
  ctx: QueryCtx,
  readerId: Id<"readers">,
  homeFeedItemId: Id<"homeFeedItems">,
) {
  const item = await ctx.db.get(homeFeedItemId);
  if (item === null || item.readerId !== readerId) {
    return null;
  }
  const post = await ctx.db.get(item.postId);
  if (post === null) {
    return null;
  }

  return {
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
    readLaterAt: item.readLaterAt ?? null,
    isReadLater: item.readLaterAt !== undefined && item.readLaterAt !== null,
    likedAt: item.likedAt ?? null,
    isLiked: item.likedAt !== undefined && item.likedAt !== null,
  };
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
    const homeFeedItemId = await ctx.db.insert("homeFeedItems", {
      ...fields,
      readAt: null,
      createdAt: now,
    });
    const item = await ctx.db.get(homeFeedItemId);
    if (item !== null) {
      await insertBucketEntries(ctx, item);
    }
    return homeFeedItemId;
  }

  await ctx.db.patch(existing._id, fields);
  const updated = await ctx.db.get(existing._id);
  if (updated !== null) {
    await replaceBucketEntries(ctx, existing, updated);
  }
  return existing._id;
}

export const counts = query({
  args: {},
  handler: async (ctx) => {
    const reader = await requireCurrentReader(ctx);
    const [unread, read, readLater, liked] = await homeFeedBuckets.countBatch(
      ctx,
      [
        countBounds(reader._id, "unread"),
        countBounds(reader._id, "read"),
        countBounds(reader._id, "readLater"),
        countBounds(reader._id, "liked"),
      ],
    );

    return { unread, read, readLater, liked };
  },
});

export const listPage = query({
  args: {
    feed: homeFeedBucketValidator,
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const reader = await requireCurrentReader(ctx);
    const page = await homeFeedBuckets.paginate(ctx, {
      ...countBounds(reader._id, args.feed),
      cursor: args.paginationOpts.cursor ?? undefined,
      order: "desc",
      pageSize: boundedLimit(args.paginationOpts.numItems),
    });

    const results = [];
    for (const aggregateItem of page.page) {
      const itemId = ctx.db.normalizeId(
        "homeFeedItems",
        itemIdFromAggregateId(aggregateItem.id),
      );
      if (itemId === null) {
        continue;
      }
      const view = await homeFeedItemView(ctx, reader._id, itemId);
      if (view !== null) {
        results.push(view);
      }
    }

    return {
      page: results,
      isDone: page.isDone,
      continueCursor: page.cursor,
    };
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
      readLaterAt: item.readLaterAt ?? null,
      isReadLater:
        item.readLaterAt !== undefined && item.readLaterAt !== null,
      likedAt: item.likedAt ?? null,
      isLiked: item.likedAt !== undefined && item.likedAt !== null,
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

    const oldItem = item;
    await ctx.db.patch(args.homeFeedItemId, {
      readAt: args.read ? Date.now() : null,
      updatedAt: Date.now(),
    });
    const newItem = await ctx.db.get(args.homeFeedItemId);
    if (newItem !== null) {
      await replaceBucketEntries(ctx, oldItem, newItem);
    }
  },
});

export const toggleReadLater = mutation({
  args: {
    homeFeedItemId: v.id("homeFeedItems"),
    readLater: v.boolean(),
  },
  handler: async (ctx, args) => {
    const reader = await requireCurrentReader(ctx);
    const item = await ctx.db.get(args.homeFeedItemId);
    if (item === null || item.readerId !== reader._id) {
      throw new ConvexError("Home feed item not found");
    }

    const oldItem = item;
    await ctx.db.patch(args.homeFeedItemId, {
      readLaterAt: args.readLater ? Date.now() : null,
      updatedAt: Date.now(),
    });
    const newItem = await ctx.db.get(args.homeFeedItemId);
    if (newItem !== null) {
      await replaceBucketEntries(ctx, oldItem, newItem);
    }
  },
});

export const toggleLike = mutation({
  args: {
    homeFeedItemId: v.id("homeFeedItems"),
    liked: v.boolean(),
  },
  handler: async (ctx, args) => {
    const reader = await requireCurrentReader(ctx);
    const item = await ctx.db.get(args.homeFeedItemId);
    if (item === null || item.readerId !== reader._id) {
      throw new ConvexError("Home feed item not found");
    }

    const oldItem = item;
    await ctx.db.patch(args.homeFeedItemId, {
      likedAt: args.liked ? Date.now() : null,
      updatedAt: Date.now(),
    });
    const newItem = await ctx.db.get(args.homeFeedItemId);
    if (newItem !== null) {
      await replaceBucketEntries(ctx, oldItem, newItem);
    }
  },
});

export const backfillCurrentReaderHomeFeedBuckets = mutation({
  args: {},
  handler: async (ctx) => {
    const reader = await requireCurrentReader(ctx);
    const items = await ctx.db
      .query("homeFeedItems")
      .withIndex("by_readerId_and_sortTime", (q) =>
        q.eq("readerId", reader._id),
      )
      .take(500);

    for (const item of items) {
      await insertBucketEntries(ctx, item);
    }

    return { backfilled: items.length };
  },
});

export const listReadLater = query({
  args: {},
  handler: async (ctx) => {
    const reader = await requireCurrentReader(ctx);
    const page = await homeFeedBuckets.paginate(ctx, {
      ...countBounds(reader._id, "readLater"),
      order: "desc",
      pageSize: maxHomeFeedItems,
    });

    const results = [];
    for (const aggregateItem of page.page) {
      const itemId = ctx.db.normalizeId(
        "homeFeedItems",
        itemIdFromAggregateId(aggregateItem.id),
      );
      if (itemId === null) {
        continue;
      }
      const item = await ctx.db.get(itemId);
      if (
        item === null ||
        item.readerId !== reader._id ||
        item.readLaterAt === undefined ||
        item.readLaterAt === null
      ) {
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
        readLaterAt: item.readLaterAt,
        likedAt: item.likedAt ?? null,
        isLiked: item.likedAt !== undefined && item.likedAt !== null,
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
