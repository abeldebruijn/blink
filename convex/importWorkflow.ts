import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

const autoTagMaxTags = 7;
const autoTagVectorCandidateLimit = 32;

function requireServiceToken(serviceToken: string) {
  const expected = process.env.WORKFLOW_CONVEX_SERVICE_TOKEN;
  if (expected === undefined || expected.trim() === "") {
    throw new ConvexError("WORKFLOW_CONVEX_SERVICE_TOKEN is not configured");
  }
  if (serviceToken !== expected) {
    throw new ConvexError("Invalid workflow service token");
  }
}

function normalizeTagName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function displayTagName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

async function upsertFeed(
  ctx: MutationCtx,
  args: {
    canonicalFeedUrl: string;
    title: string;
    siteUrl: string | null;
    description: string | null;
  },
) {
  const now = Date.now();
  const existingFeed = await ctx.db
    .query("feeds")
    .withIndex("by_canonicalFeedUrl", (q) =>
      q.eq("canonicalFeedUrl", args.canonicalFeedUrl),
    )
    .unique();

  const feedFields = {
    canonicalFeedUrl: args.canonicalFeedUrl,
    title: args.title,
    siteUrl: args.siteUrl,
    description: args.description,
    updatedAt: now,
  };
  const feedId =
    existingFeed === null
      ? await ctx.db.insert("feeds", { ...feedFields, createdAt: now })
      : existingFeed._id;
  if (existingFeed !== null) {
    await ctx.db.patch(existingFeed._id, feedFields);
  }

  return feedId;
}

async function deleteReaderHomeFeedItemsForFeed(
  ctx: MutationCtx,
  readerId: Id<"readers">,
  feedId: Id<"feeds">,
) {
  for await (const item of ctx.db
    .query("homeFeedItems")
    .withIndex("by_readerId_and_sortTime", (q) => q.eq("readerId", readerId))) {
    const post = await ctx.db.get(item.postId);
    if (post?.feedId === feedId) {
      await ctx.db.delete(item._id);
    }
  }
}

function postRetryPayload(post: Doc<"posts">, readerId: Id<"readers">) {
  return {
    feedId: post.feedId ?? null,
    readerId,
    sourceTitle: post.sourceTitle,
    sourceSiteUrl: post.sourceSiteUrl,
    sourceFeedUrl: post.sourceFeedUrl,
    rssTitle: post.rssTitle,
    rssDescription: post.rssDescription,
    rssLinkUrl: post.rssLinkUrl,
    publishedAt: post.publishedAt,
    discoveredAt: post.discoveredAt,
    rssImageUrl: post.headerImageUrl,
  };
}

const workflowPostArgs = {
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
    v.union(v.literal("pending"), v.literal("succeeded"), v.literal("failed")),
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
};

const autoTagEmbeddingValidator = v.array(v.float64());

const generatedAutoTagValidator = v.object({
  name: v.string(),
  description: v.string(),
  embedding: autoTagEmbeddingValidator,
  embeddingModel: v.string(),
});

async function attachTagToHomeFeedItem(
  ctx: MutationCtx,
  args: {
    readerId: Id<"readers">;
    homeFeedItemId: Id<"homeFeedItems">;
    tagId: Id<"tags">;
    now: number;
  },
) {
  const existingJoin = await ctx.db
    .query("homeFeedItemTags")
    .withIndex("by_homeFeedItemId_and_tagId", (q) =>
      q.eq("homeFeedItemId", args.homeFeedItemId).eq("tagId", args.tagId),
    )
    .unique();
  if (existingJoin !== null) {
    return false;
  }

  await ctx.db.insert("homeFeedItemTags", {
    readerId: args.readerId,
    homeFeedItemId: args.homeFeedItemId,
    tagId: args.tagId,
    createdAt: args.now,
  });
  return true;
}

export const getRefreshTarget = query({
  args: {
    serviceToken: v.string(),
    readerId: v.id("readers"),
    feedSubscriptionId: v.id("feedSubscriptions"),
  },
  handler: async (ctx, args) => {
    requireServiceToken(args.serviceToken);
    const subscription = await ctx.db.get(args.feedSubscriptionId);
    if (subscription === null || subscription.readerId !== args.readerId) {
      throw new ConvexError("Feed Subscription not found");
    }

    const feed = await ctx.db.get(subscription.feedId);
    if (feed === null) {
      throw new ConvexError("Feed not found");
    }

    const knownCanonicalUrls = [];
    for await (const post of ctx.db
      .query("posts")
      .withIndex("by_feedId", (q) => q.eq("feedId", feed._id))) {
      knownCanonicalUrls.push(post.canonicalUrl);
    }

    return {
      subscriptionId: subscription._id,
      feedId: feed._id,
      submittedFeedUrl: subscription.submittedFeedUrl,
      canonicalFeedUrl: feed.canonicalFeedUrl,
      knownCanonicalUrls,
    };
  },
});

export const getProcessingState = query({
  args: {
    serviceToken: v.string(),
    canonicalUrl: v.string(),
  },
  handler: async (ctx: QueryCtx, args) => {
    requireServiceToken(args.serviceToken);
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

export const getAutoTagContext = query({
  args: {
    serviceToken: v.string(),
    readerId: v.id("readers"),
    homeFeedItemId: v.id("homeFeedItems"),
  },
  handler: async (ctx, args) => {
    requireServiceToken(args.serviceToken);
    const item = await ctx.db.get(args.homeFeedItemId);
    if (item === null || item.readerId !== args.readerId) {
      throw new ConvexError("Home Feed Item not found");
    }

    const existingJoins = await ctx.db
      .query("homeFeedItemTags")
      .withIndex("by_readerId_and_homeFeedItemId", (q) =>
        q.eq("readerId", args.readerId).eq("homeFeedItemId", item._id),
      )
      .take(1);
    if (existingJoins.length > 0) {
      return { shouldTag: false as const, tags: [] };
    }

    const tags = [];
    for await (const tag of ctx.db
      .query("tags")
      .withIndex("by_readerId_and_updatedAt", (q) =>
        q.eq("readerId", args.readerId),
      )
      .order("desc")) {
      tags.push(tag);
    }

    return {
      shouldTag: true as const,
      tags: tags.map((tag) => ({
        _id: tag._id,
        name: tag.name,
        description: tag.description ?? null,
        hasEmbedding:
          tag.embedding !== undefined &&
          tag.embedding !== null &&
          tag.embedding.length === 1536,
      })),
    };
  },
});

export const updateAutoTagEmbeddings = mutation({
  args: {
    serviceToken: v.string(),
    readerId: v.id("readers"),
    tags: v.array(
      v.object({
        tagId: v.id("tags"),
        description: v.string(),
        embedding: autoTagEmbeddingValidator,
        embeddingModel: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    requireServiceToken(args.serviceToken);
    const now = Date.now();
    let updated = 0;

    for (const tagUpdate of args.tags) {
      const tag = await ctx.db.get(tagUpdate.tagId);
      if (tag === null || tag.readerId !== args.readerId) {
        continue;
      }
      await ctx.db.patch(tag._id, {
        description: tagUpdate.description,
        embedding: tagUpdate.embedding,
        embeddingModel: tagUpdate.embeddingModel,
        embeddingUpdatedAt: now,
        updatedAt: now,
      });
      updated += 1;
    }

    return { updated };
  },
});

export const searchAutoTagCandidates = action({
  args: {
    serviceToken: v.string(),
    readerId: v.id("readers"),
    embedding: autoTagEmbeddingValidator,
  },
  handler: async (ctx, args) => {
    requireServiceToken(args.serviceToken);
    return await ctx.vectorSearch("tags", "by_embedding", {
      vector: args.embedding,
      limit: autoTagVectorCandidateLimit,
      filter: (q) => q.eq("readerId", args.readerId),
    });
  },
});

export const applyAutoTags = mutation({
  args: {
    serviceToken: v.string(),
    readerId: v.id("readers"),
    homeFeedItemId: v.id("homeFeedItems"),
    existingTagIds: v.array(v.id("tags")),
    newTags: v.array(generatedAutoTagValidator),
  },
  handler: async (ctx, args) => {
    requireServiceToken(args.serviceToken);
    const item = await ctx.db.get(args.homeFeedItemId);
    if (item === null || item.readerId !== args.readerId) {
      throw new ConvexError("Home Feed Item not found");
    }

    const existingJoins = await ctx.db
      .query("homeFeedItemTags")
      .withIndex("by_readerId_and_homeFeedItemId", (q) =>
        q.eq("readerId", args.readerId).eq("homeFeedItemId", item._id),
      )
      .take(1);
    if (existingJoins.length > 0) {
      return { applied: 0, created: 0, skipped: true };
    }

    const now = Date.now();
    const selectedTagIds: Id<"tags">[] = [];
    const seenTagIds = new Set<string>();
    for (const tagId of args.existingTagIds) {
      if (selectedTagIds.length >= autoTagMaxTags || seenTagIds.has(tagId)) {
        continue;
      }
      const tag = await ctx.db.get(tagId);
      if (tag === null || tag.readerId !== args.readerId) {
        continue;
      }
      seenTagIds.add(tagId);
      selectedTagIds.push(tagId);
    }

    let created = 0;
    const seenNames = new Set<string>();
    for (const generatedTag of args.newTags) {
      if (selectedTagIds.length >= autoTagMaxTags || created >= 3) {
        break;
      }

      const name = displayTagName(generatedTag.name);
      const normalizedName = normalizeTagName(name);
      if (normalizedName === "" || seenNames.has(normalizedName)) {
        continue;
      }
      seenNames.add(normalizedName);

      const existingTag = await ctx.db
        .query("tags")
        .withIndex("by_readerId_and_normalizedName", (q) =>
          q.eq("readerId", args.readerId).eq("normalizedName", normalizedName),
        )
        .unique();

      const tagId =
        existingTag?._id ??
        (await ctx.db.insert("tags", {
          readerId: args.readerId,
          name,
          normalizedName,
          description: generatedTag.description,
          embedding: generatedTag.embedding,
          embeddingModel: generatedTag.embeddingModel,
          embeddingUpdatedAt: now,
          createdAt: now,
          updatedAt: now,
        }));

      if (existingTag !== null) {
        await ctx.db.patch(existingTag._id, {
          description: generatedTag.description,
          embedding: generatedTag.embedding,
          embeddingModel: generatedTag.embeddingModel,
          embeddingUpdatedAt: now,
          updatedAt: now,
        });
      } else {
        created += 1;
      }

      if (!seenTagIds.has(tagId)) {
        seenTagIds.add(tagId);
        selectedTagIds.push(tagId);
      }
    }

    let applied = 0;
    for (const tagId of selectedTagIds) {
      const didAttach = await attachTagToHomeFeedItem(ctx, {
        readerId: args.readerId,
        homeFeedItemId: args.homeFeedItemId,
        tagId,
        now,
      });
      if (didAttach) {
        applied += 1;
      }
    }

    if (applied > 0) {
      await ctx.db.patch(args.homeFeedItemId, { updatedAt: now });
    }

    return { applied, created, skipped: false };
  },
});

export const prepareInitialImport = mutation({
  args: {
    serviceToken: v.string(),
    readerId: v.id("readers"),
    submittedFeedUrl: v.string(),
    canonicalFeedUrl: v.string(),
    title: v.string(),
    siteUrl: v.union(v.string(), v.null()),
    description: v.union(v.string(), v.null()),
    discoveredCount: v.number(),
    importCount: v.number(),
  },
  handler: async (ctx, args) => {
    requireServiceToken(args.serviceToken);
    const reader = await ctx.db.get(args.readerId);
    if (reader === null) {
      throw new ConvexError("Reader not found");
    }

    const now = Date.now();
    const feedId = await upsertFeed(ctx, args);
    const existingSubscription = await ctx.db
      .query("feedSubscriptions")
      .withIndex("by_readerId_and_feedId", (q) =>
        q.eq("readerId", args.readerId).eq("feedId", feedId),
      )
      .unique();

    if (existingSubscription === null) {
      await ctx.db.insert("feedSubscriptions", {
        readerId: args.readerId,
        feedId,
        submittedFeedUrl: args.submittedFeedUrl,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(existingSubscription._id, {
        submittedFeedUrl: args.submittedFeedUrl,
        updatedAt: now,
      });
    }

    const feedImportRunId = await ctx.db.insert("feedImportRuns", {
      readerId: args.readerId,
      feedId,
      submittedFeedUrl: args.submittedFeedUrl,
      canonicalFeedUrl: args.canonicalFeedUrl,
      status: "importing",
      discoveredCount: args.discoveredCount,
      importCount: args.importCount,
      queuedCount: args.importCount,
      completedCount: 0,
      failedCount: 0,
      error: null,
      createdAt: now,
      updatedAt: now,
    });

    return { readerId: args.readerId, feedId, feedImportRunId };
  },
});

export const prepareReplacementImport = mutation({
  args: {
    serviceToken: v.string(),
    readerId: v.id("readers"),
    feedSubscriptionId: v.id("feedSubscriptions"),
    submittedFeedUrl: v.string(),
    canonicalFeedUrl: v.string(),
    title: v.string(),
    siteUrl: v.union(v.string(), v.null()),
    description: v.union(v.string(), v.null()),
    discoveredCount: v.number(),
    importCount: v.number(),
  },
  handler: async (ctx, args) => {
    requireServiceToken(args.serviceToken);
    const subscription = await ctx.db.get(args.feedSubscriptionId);
    if (subscription === null || subscription.readerId !== args.readerId) {
      throw new ConvexError("Feed Subscription not found");
    }

    const now = Date.now();
    const feedId = await upsertFeed(ctx, args);
    const existingSubscription = await ctx.db
      .query("feedSubscriptions")
      .withIndex("by_readerId_and_feedId", (q) =>
        q.eq("readerId", args.readerId).eq("feedId", feedId),
      )
      .unique();

    if (
      existingSubscription !== null &&
      existingSubscription._id !== args.feedSubscriptionId
    ) {
      await deleteReaderHomeFeedItemsForFeed(
        ctx,
        args.readerId,
        subscription.feedId,
      );
      await ctx.db.delete(args.feedSubscriptionId);
      await ctx.db.patch(existingSubscription._id, {
        submittedFeedUrl: args.submittedFeedUrl,
        updatedAt: now,
      });
    } else {
      if (feedId !== subscription.feedId) {
        await deleteReaderHomeFeedItemsForFeed(
          ctx,
          args.readerId,
          subscription.feedId,
        );
      }
      await ctx.db.patch(args.feedSubscriptionId, {
        feedId,
        submittedFeedUrl: args.submittedFeedUrl,
        updatedAt: now,
      });
    }

    const feedImportRunId = await ctx.db.insert("feedImportRuns", {
      readerId: args.readerId,
      feedId,
      submittedFeedUrl: args.submittedFeedUrl,
      canonicalFeedUrl: args.canonicalFeedUrl,
      status: "importing",
      discoveredCount: args.discoveredCount,
      importCount: args.importCount,
      queuedCount: args.importCount,
      completedCount: 0,
      failedCount: 0,
      error: null,
      createdAt: now,
      updatedAt: now,
    });

    return { readerId: args.readerId, feedId, feedImportRunId };
  },
});

export const preparePostRetry = mutation({
  args: {
    serviceToken: v.string(),
    readerId: v.id("readers"),
    postId: v.id("posts"),
  },
  handler: async (ctx, args) => {
    requireServiceToken(args.serviceToken);
    const post = await ctx.db.get(args.postId);
    if (post === null) {
      throw new ConvexError("Post not found");
    }

    if (post.feedImportRunId === null || post.feedImportRunId === undefined) {
      throw new ConvexError("Post is not part of an Initial Import");
    }

    const run = await ctx.db.get(post.feedImportRunId);
    if (run === null || run.readerId !== args.readerId) {
      throw new ConvexError("Post not found");
    }

    await ctx.db.patch(post._id, {
      firecrawlStatus: "pending",
      firecrawlVisitedAt: null,
      firecrawlPageContent: null,
      firecrawlPageSummary: null,
      firecrawlError: null,
      abstractStatus: "pending",
      abstractError: null,
      abstract: post.rssDescription,
      abstractSource:
        post.rssDescription !== null && post.rssDescription.trim() !== ""
          ? "rss_description_fallback"
          : "none",
      updatedAt: Date.now(),
    });

    return postRetryPayload(post, args.readerId);
  },
});

export const upsertPost = mutation({
  args: {
    serviceToken: v.string(),
    ...workflowPostArgs,
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ postId: Id<"posts">; homeFeedItemId: Id<"homeFeedItems"> }> => {
    requireServiceToken(args.serviceToken);
    const { serviceToken: _serviceToken, ...postArgs } = args;
    void _serviceToken;
    const result: { postId: Id<"posts">; homeFeedItemId: Id<"homeFeedItems"> } =
      await ctx.runMutation(internal.homeFeed.upsertPost, postArgs);
    return result;
  },
});

export const recordPostProcessed = mutation({
  args: {
    serviceToken: v.string(),
    feedImportRunId: v.id("feedImportRuns"),
    ok: v.boolean(),
  },
  handler: async (ctx, args) => {
    requireServiceToken(args.serviceToken);
    const run = await ctx.db.get(args.feedImportRunId);
    if (run === null) {
      return;
    }

    const completedCount = run.completedCount + (args.ok ? 1 : 0);
    const failedCount = run.failedCount + (args.ok ? 0 : 1);
    const finishedCount = completedCount + failedCount;
    await ctx.db.patch(args.feedImportRunId, {
      completedCount,
      failedCount,
      status: finishedCount >= run.importCount ? "completed" : run.status,
      updatedAt: Date.now(),
    });
  },
});

export const markImportRunCompleted = mutation({
  args: {
    serviceToken: v.string(),
    feedImportRunId: v.id("feedImportRuns"),
  },
  handler: async (ctx, args) => {
    requireServiceToken(args.serviceToken);
    await ctx.db.patch(args.feedImportRunId, {
      status: "completed",
      updatedAt: Date.now(),
    });
  },
});
