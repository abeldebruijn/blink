import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { normalizeUrl, parseFeed } from "./feedImports";

const manualRefreshLimit = 20;

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

function displayTitle(
  subscription: Doc<"feedSubscriptions">,
  feed: Doc<"feeds">,
) {
  const title = subscription.displayTitle?.trim();
  return title === undefined || title === "" ? feed.title : title;
}

async function latestImportRun(
  ctx: QueryCtx,
  readerId: Id<"readers">,
  feedId: Id<"feeds">,
) {
  for await (const run of ctx.db
    .query("feedImportRuns")
    .withIndex("by_feedId_and_createdAt", (q) => q.eq("feedId", feedId))
    .order("desc")) {
    if (run.readerId === readerId) {
      return run;
    }
  }

  return null;
}

async function postCountForFeed(ctx: QueryCtx, feedId: Id<"feeds">) {
  let count = 0;
  for await (const post of ctx.db
    .query("posts")
    .withIndex("by_feedId", (q) => q.eq("feedId", feedId))) {
    if (post.feedId === feedId) {
      count += 1;
    }
  }
  return count;
}

export const countForCurrentReader = query({
  args: {},
  handler: async (ctx) => {
    const reader = await requireCurrentReader(ctx);
    let count = 0;
    for await (const subscription of ctx.db
      .query("feedSubscriptions")
      .withIndex("by_readerId_and_updatedAt", (q) =>
        q.eq("readerId", reader._id),
      )) {
      if (subscription.readerId === reader._id) {
        count += 1;
      }
    }
    return count;
  },
});

export const listForCurrentReader = query({
  args: {},
  handler: async (ctx) => {
    const reader = await requireCurrentReader(ctx);
    const subscriptions = ctx.db
      .query("feedSubscriptions")
      .withIndex("by_readerId_and_updatedAt", (q) =>
        q.eq("readerId", reader._id),
      )
      .order("desc");

    const results = [];
    for await (const subscription of subscriptions) {
      const feed = await ctx.db.get(subscription.feedId);
      if (feed === null) {
        continue;
      }

      const latestRun = await latestImportRun(ctx, reader._id, feed._id);
      const postCount = await postCountForFeed(ctx, feed._id);
      results.push({
        _id: subscription._id,
        feedId: feed._id,
        displayTitle: subscription.displayTitle ?? null,
        title: displayTitle(subscription, feed),
        sharedTitle: feed.title,
        canonicalFeedUrl: feed.canonicalFeedUrl,
        submittedFeedUrl: subscription.submittedFeedUrl,
        siteUrl: feed.siteUrl,
        description: feed.description,
        postCount,
        lastSyncedAt: latestRun?.updatedAt ?? null,
        latestImportStatus: latestRun?.status ?? null,
        latestImportError: latestRun?.error ?? null,
      });
    }

    return results;
  },
});

export const renameFeedSubscription = mutation({
  args: {
    feedSubscriptionId: v.id("feedSubscriptions"),
    displayTitle: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const reader = await requireCurrentReader(ctx);
    const subscription = await ctx.db.get(args.feedSubscriptionId);
    if (subscription === null || subscription.readerId !== reader._id) {
      throw new ConvexError("Feed Subscription not found");
    }

    const displayTitle = args.displayTitle?.trim();
    await ctx.db.patch(args.feedSubscriptionId, {
      displayTitle:
        displayTitle === undefined || displayTitle === "" ? null : displayTitle,
      updatedAt: Date.now(),
    });
  },
});

export const unsubscribeFromFeed = mutation({
  args: {
    feedSubscriptionId: v.id("feedSubscriptions"),
  },
  handler: async (ctx, args) => {
    const reader = await requireCurrentReader(ctx);
    const subscription = await ctx.db.get(args.feedSubscriptionId);
    if (subscription === null || subscription.readerId !== reader._id) {
      throw new ConvexError("Feed Subscription not found");
    }

    for await (const item of ctx.db
      .query("homeFeedItems")
      .withIndex("by_readerId_and_sortTime", (q) =>
        q.eq("readerId", reader._id),
      )) {
      const post = await ctx.db.get(item.postId);
      if (post?.feedId === subscription.feedId) {
        await ctx.db.delete(item._id);
      }
    }

    await ctx.db.delete(args.feedSubscriptionId);
  },
});

export const replaceFeedSubscriptionUrl = action({
  args: {
    feedSubscriptionId: v.id("feedSubscriptions"),
    submittedFeedUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ feedImportRunId: Id<"feedImportRuns"> }> => {
    const submittedFeedUrl = normalizeUrl(args.submittedFeedUrl);
    const response = await fetch(submittedFeedUrl, {
      headers: {
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
    });

    if (!response.ok) {
      throw new ConvexError(`Feed fetch failed with HTTP ${response.status}`);
    }

    const xml = await response.text();
    const feed = parseFeed(xml, submittedFeedUrl);
    if (feed.entries.length === 0) {
      throw new ConvexError("Feed has no Posts to import");
    }

    const entries = feed.entries
      .slice()
      .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
      .slice(0, manualRefreshLimit);
    const discoveredAt = Date.now();
    const prepared: {
      readerId: Id<"readers">;
      feedId: Id<"feeds">;
      feedImportRunId: Id<"feedImportRuns">;
    } = await ctx.runMutation(
      internal.feedSubscriptions.prepareReplacementImport,
      {
        feedSubscriptionId: args.feedSubscriptionId,
        submittedFeedUrl,
        canonicalFeedUrl: submittedFeedUrl,
        title: feed.title,
        siteUrl: feed.siteUrl,
        description: feed.description,
        discoveredCount: feed.entries.length,
        importCount: entries.length,
      },
    );

    for (const entry of entries) {
      await ctx.scheduler.runAfter(0, internal.firecrawlPosts.ingestRssEntry, {
        feedId: prepared.feedId,
        feedImportRunId: prepared.feedImportRunId,
        readerId: prepared.readerId,
        sourceTitle: feed.title,
        sourceSiteUrl: feed.siteUrl,
        sourceFeedUrl: submittedFeedUrl,
        rssTitle: entry.title,
        rssDescription: entry.description,
        rssLinkUrl: entry.linkUrl,
        publishedAt: entry.publishedAt,
        discoveredAt,
        rssImageUrl: entry.imageUrl,
      });
    }

    return { feedImportRunId: prepared.feedImportRunId };
  },
});

export const manualRefreshFeed = action({
  args: {
    feedSubscriptionId: v.id("feedSubscriptions"),
  },
  handler: async (ctx, args): Promise<{ feedImportRunId: Id<"feedImportRuns"> }> => {
    const subscription = await ctx.runQuery(
      api.feedSubscriptions.getRefreshTarget,
      {
        feedSubscriptionId: args.feedSubscriptionId,
      },
    );

    const submittedFeedUrl = normalizeUrl(subscription.submittedFeedUrl);
    const response = await fetch(subscription.canonicalFeedUrl, {
      headers: {
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
    });

    if (!response.ok) {
      throw new ConvexError(`Feed fetch failed with HTTP ${response.status}`);
    }

    const xml = await response.text();
    const feed = parseFeed(xml, subscription.canonicalFeedUrl);
    const knownUrls = new Set(subscription.knownCanonicalUrls);
    const entries = feed.entries
      .slice()
      .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
      .filter((entry) => !knownUrls.has(normalizeUrl(entry.linkUrl)))
      .slice(0, manualRefreshLimit);

    const discoveredAt = Date.now();
    const prepared: {
      readerId: Id<"readers">;
      feedId: Id<"feeds">;
      feedImportRunId: Id<"feedImportRuns">;
    } = await ctx.runMutation(internal.feedImports.prepareInitialImport, {
      submittedFeedUrl,
      canonicalFeedUrl: subscription.canonicalFeedUrl,
      title: feed.title,
      siteUrl: feed.siteUrl,
      description: feed.description,
      discoveredCount: feed.entries.length,
      importCount: entries.length,
    });

    if (entries.length === 0) {
      await ctx.runMutation(internal.feedSubscriptions.markImportRunCompleted, {
        feedImportRunId: prepared.feedImportRunId,
      });
    }

    for (const entry of entries) {
      await ctx.scheduler.runAfter(0, internal.firecrawlPosts.ingestRssEntry, {
        feedId: prepared.feedId,
        feedImportRunId: prepared.feedImportRunId,
        readerId: prepared.readerId,
        sourceTitle: feed.title,
        sourceSiteUrl: feed.siteUrl,
        sourceFeedUrl: subscription.canonicalFeedUrl,
        rssTitle: entry.title,
        rssDescription: entry.description,
        rssLinkUrl: entry.linkUrl,
        publishedAt: entry.publishedAt,
        discoveredAt,
        rssImageUrl: entry.imageUrl,
      });
    }

    return { feedImportRunId: prepared.feedImportRunId };
  },
});

export const getRefreshTarget = query({
  args: {
    feedSubscriptionId: v.id("feedSubscriptions"),
  },
  handler: async (ctx, args) => {
    const reader = await requireCurrentReader(ctx);
    const subscription = await ctx.db.get(args.feedSubscriptionId);
    if (subscription === null || subscription.readerId !== reader._id) {
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

export const prepareReplacementImport = internalMutation({
  args: {
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
    const reader = await requireCurrentReader(ctx);
    const subscription = await ctx.db.get(args.feedSubscriptionId);
    if (subscription === null || subscription.readerId !== reader._id) {
      throw new ConvexError("Feed Subscription not found");
    }

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

    const existingSubscription = await ctx.db
      .query("feedSubscriptions")
      .withIndex("by_readerId_and_feedId", (q) =>
        q.eq("readerId", reader._id).eq("feedId", feedId),
      )
      .unique();

    if (
      existingSubscription !== null &&
      existingSubscription._id !== args.feedSubscriptionId
    ) {
      for await (const item of ctx.db
        .query("homeFeedItems")
        .withIndex("by_readerId_and_sortTime", (q) =>
          q.eq("readerId", reader._id),
        )) {
        const post = await ctx.db.get(item.postId);
        if (post?.feedId === subscription.feedId) {
          await ctx.db.delete(item._id);
        }
      }
      await ctx.db.delete(args.feedSubscriptionId);
      await ctx.db.patch(existingSubscription._id, {
        submittedFeedUrl: args.submittedFeedUrl,
        updatedAt: now,
      });
    } else {
      for await (const item of ctx.db
        .query("homeFeedItems")
        .withIndex("by_readerId_and_sortTime", (q) =>
          q.eq("readerId", reader._id),
        )) {
        const post = await ctx.db.get(item.postId);
        if (post?.feedId === subscription.feedId && feedId !== subscription.feedId) {
          await ctx.db.delete(item._id);
        }
      }
      await ctx.db.patch(args.feedSubscriptionId, {
        feedId,
        submittedFeedUrl: args.submittedFeedUrl,
        updatedAt: now,
      });
    }

    const feedImportRunId = await ctx.db.insert("feedImportRuns", {
      readerId: reader._id,
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

    return { readerId: reader._id, feedId, feedImportRunId };
  },
});

export const markImportRunCompleted = internalMutation({
  args: {
    feedImportRunId: v.id("feedImportRuns"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.feedImportRunId, {
      status: "completed",
      updatedAt: Date.now(),
    });
  },
});
