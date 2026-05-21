import { XMLParser } from "fast-xml-parser";
import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

const initialImportLimit = 20;

type FeedEntry = {
  title: string;
  linkUrl: string;
  description: string | null;
  publishedAt: number | null;
};

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported protocol");
    }
    url.hash = "";
    return url.toString();
  } catch {
    throw new ConvexError("Submitted Feed URL must be a valid HTTP URL");
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text === "" ? null : text;
  }

  const record = asRecord(value);
  if (record === null) {
    return null;
  }

  return textValue(record["#text"]) ?? textValue(record.__cdata);
}

function attrValue(value: unknown, attrName: string) {
  const record = asRecord(value);
  return record === null ? null : textValue(record[`@_${attrName}`]);
}

function rssLink(item: Record<string, unknown>) {
  return textValue(item.link) ?? textValue(item.guid);
}

function atomLink(entry: Record<string, unknown>) {
  for (const candidate of asArray(entry.link)) {
    const href = attrValue(candidate, "href");
    const rel = attrValue(candidate, "rel");
    if (href !== null && (rel === null || rel === "alternate")) {
      return href;
    }
  }
  return textValue(entry.link);
}

function timestamp(value: string | null) {
  if (value === null) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFeed(xml: string, canonicalFeedUrl: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    cdataPropName: "__cdata",
  });
  const parsed = parser.parse(xml) as unknown;
  const root = asRecord(parsed);
  const rss = asRecord(root?.rss);
  const channel = asRecord(rss?.channel);
  const atom = asRecord(root?.feed);

  if (channel !== null) {
    const entries = asArray(channel.item)
      .map((item): FeedEntry | null => {
        const record = asRecord(item);
        if (record === null) {
          return null;
        }
        const linkUrl = rssLink(record);
        if (linkUrl === null) {
          return null;
        }
        return {
          title: textValue(record.title) ?? linkUrl,
          linkUrl,
          description:
            textValue(record.description) ?? textValue(record["content:encoded"]),
          publishedAt: timestamp(
            textValue(record.pubDate) ?? textValue(record["dc:date"]),
          ),
        };
      })
      .filter((entry): entry is FeedEntry => entry !== null);

    return {
      title: textValue(channel.title) ?? new URL(canonicalFeedUrl).hostname,
      siteUrl: textValue(channel.link),
      description: textValue(channel.description),
      entries,
    };
  }

  if (atom !== null) {
    const entries = asArray(atom.entry)
      .map((entry): FeedEntry | null => {
        const record = asRecord(entry);
        if (record === null) {
          return null;
        }
        const linkUrl = atomLink(record);
        if (linkUrl === null) {
          return null;
        }
        return {
          title: textValue(record.title) ?? linkUrl,
          linkUrl,
          description: textValue(record.summary) ?? textValue(record.content),
          publishedAt: timestamp(
            textValue(record.published) ?? textValue(record.updated),
          ),
        };
      })
      .filter((entry): entry is FeedEntry => entry !== null);

    return {
      title: textValue(atom.title) ?? new URL(canonicalFeedUrl).hostname,
      siteUrl: atomLink(atom) ?? null,
      description: textValue(atom.subtitle),
      entries,
    };
  }

  throw new ConvexError("Submitted Feed URL must point directly to RSS or Atom");
}

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

export const startInitialImport = action({
  args: {
    submittedFeedUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ feedImportRunId: Id<"feedImportRuns"> }> => {
    await ctx.runMutation(api.readers.ensureCurrent, {});
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
      .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
    const selectedEntries = entries.slice(0, initialImportLimit);
    const discoveredAt = Date.now();
    const prepared: {
      readerId: Id<"readers">;
      feedId: Id<"feeds">;
      feedImportRunId: Id<"feedImportRuns">;
    } = await ctx.runMutation(internal.feedImports.prepareInitialImport, {
      submittedFeedUrl,
      canonicalFeedUrl: submittedFeedUrl,
      title: feed.title,
      siteUrl: feed.siteUrl,
      description: feed.description,
      discoveredCount: feed.entries.length,
      importCount: selectedEntries.length,
    });

    for (const entry of selectedEntries) {
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
      });
    }

    return { feedImportRunId: prepared.feedImportRunId };
  },
});

export const latestForCurrentReader = query({
  args: {},
  handler: async (ctx) => {
    const reader = await requireCurrentReader(ctx);
    const run = await ctx.db
      .query("feedImportRuns")
      .withIndex("by_readerId_and_createdAt", (q) =>
        q.eq("readerId", reader._id),
      )
      .order("desc")
      .first();

    if (run === null) {
      return null;
    }

    const feed = await ctx.db.get(run.feedId);
    return {
      ...run,
      feedTitle: feed?.title ?? "Feed",
      feedSiteUrl: feed?.siteUrl ?? null,
    };
  },
});

export const listRunPosts = query({
  args: {
    feedImportRunId: v.id("feedImportRuns"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const reader = await requireCurrentReader(ctx);
    const run = await ctx.db.get(args.feedImportRunId);
    if (run === null || run.readerId !== reader._id) {
      throw new ConvexError("Initial Import not found");
    }

    const posts = await ctx.db
      .query("posts")
      .withIndex("by_feedImportRunId", (q) =>
        q.eq("feedImportRunId", args.feedImportRunId),
      )
      .order("desc")
      .take(Math.max(1, Math.min(args.limit, initialImportLimit)));

    return posts.map((post) => ({
      _id: post._id,
      title: post.rssTitle,
      canonicalUrl: post.canonicalUrl,
      publishedAt: post.publishedAt,
      firecrawlStatus: post.firecrawlStatus ?? null,
      abstractStatus: post.abstractStatus ?? null,
      abstract: post.abstract,
      firecrawlError: post.firecrawlError ?? null,
      abstractError: post.abstractError ?? null,
    }));
  },
});

export const retryPost = action({
  args: {
    postId: v.id("posts"),
  },
  handler: async (ctx, args) => {
    const retryArgs: {
      feedId: Id<"feeds"> | null;
      readerId: Id<"readers">;
      sourceTitle: string;
      sourceSiteUrl: string | null;
      sourceFeedUrl: string | null;
      rssTitle: string;
      rssDescription: string | null;
      rssLinkUrl: string;
      publishedAt: number | null;
      discoveredAt: number;
    } = await ctx.runMutation(internal.feedImports.preparePostRetry, {
      postId: args.postId,
    });

    await ctx.scheduler.runAfter(0, internal.firecrawlPosts.ingestRssEntry, {
      ...retryArgs,
      feedImportRunId: null,
    });
  },
});

export const prepareInitialImport = internalMutation({
  args: {
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

    if (existingSubscription === null) {
      await ctx.db.insert("feedSubscriptions", {
        readerId: reader._id,
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

export const preparePostRetry = internalMutation({
  args: {
    postId: v.id("posts"),
  },
  handler: async (ctx, args) => {
    const reader = await requireCurrentReader(ctx);
    const post = await ctx.db.get(args.postId);
    if (post === null) {
      throw new ConvexError("Post not found");
    }

    if (post.feedImportRunId === null || post.feedImportRunId === undefined) {
      throw new ConvexError("Post is not part of an Initial Import");
    }

    const run = await ctx.db.get(post.feedImportRunId);
    if (run === null || run.readerId !== reader._id) {
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

    return {
      feedId: post.feedId ?? null,
      readerId: reader._id,
      sourceTitle: post.sourceTitle,
      sourceSiteUrl: post.sourceSiteUrl,
      sourceFeedUrl: post.sourceFeedUrl,
      rssTitle: post.rssTitle,
      rssDescription: post.rssDescription,
      rssLinkUrl: post.rssLinkUrl,
      publishedAt: post.publishedAt,
      discoveredAt: post.discoveredAt,
    };
  },
});

export const recordPostProcessed = internalMutation({
  args: {
    feedImportRunId: v.id("feedImportRuns"),
    ok: v.boolean(),
  },
  handler: async (ctx, args) => {
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
