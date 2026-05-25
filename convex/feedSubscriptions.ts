import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

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
      .withIndex("by_readerId_and_feedId", (q) =>
        q.eq("readerId", reader._id).eq("feedId", subscription.feedId),
      )) {
      await ctx.db.delete(item._id);
    }

    await ctx.db.delete(args.feedSubscriptionId);
  },
});

export const listAllFeeds = query({
  args: {},
  handler: async (ctx) => {
    await requireCurrentReader(ctx);
    const feeds = await ctx.db.query("feeds").collect();
    return feeds.map((feed) => ({
      _id: feed._id,
      title: feed.title,
      canonicalFeedUrl: feed.canonicalFeedUrl,
      siteUrl: feed.siteUrl,
    }));
  },
});
