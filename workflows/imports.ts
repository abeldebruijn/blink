import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  initialImportLimit,
  manualRefreshLimit,
  newestEntries,
  normalizeUrl,
  parseFeed,
  type FeedEntry,
} from "@/lib/feed-imports";
import {
  describeTagsForAutoTag,
  embedTaggingText,
  embedTaggingTexts,
  generateAbstract,
  generateAutoTagSuggestions,
  scrapeWithFirecrawl,
  taggingInput,
  tagEmbeddingModel,
} from "@/lib/post-processing";

const postBatchSize = 4;
const autoTagMaxTags = 7;
const autoTagSimilarityThreshold = 0.82;

type PreparedImport = {
  readerId: Id<"readers">;
  feedId: Id<"feeds">;
  feedImportRunId: Id<"feedImportRuns">;
};

type WorkflowPostInput = {
  feedId: Id<"feeds"> | null;
  feedImportRunId: Id<"feedImportRuns"> | null;
  readerId: Id<"readers">;
  sourceTitle: string;
  sourceSiteUrl: string | null;
  sourceFeedUrl: string | null;
  rssTitle: string;
  rssDescription: string | null;
  rssLinkUrl: string;
  publishedAt: number | null;
  discoveredAt: number;
  rssImageUrl: string | null;
  autoTag: boolean;
};

type ExistingAutoTag = {
  _id: Id<"tags">;
  name: string;
  description: string | null;
  hasEmbedding: boolean;
};

function convex() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (url === undefined || url.trim() === "") {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
  }
  return new ConvexHttpClient(url);
}

function serviceToken() {
  const token = process.env.WORKFLOW_CONVEX_SERVICE_TOKEN;
  if (token === undefined || token.trim() === "") {
    throw new Error("WORKFLOW_CONVEX_SERVICE_TOKEN is not configured");
  }
  return token;
}

function normalizedArticleUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    throw new Error("RSS entry link is not a valid URL");
  }
}

async function fetchFeed(canonicalFeedUrl: string) {
  "use step";

  const response = await fetch(canonicalFeedUrl, {
    headers: {
      Accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Feed fetch failed with HTTP ${response.status}`);
  }

  return parseFeed(await response.text(), canonicalFeedUrl);
}

async function getRefreshTarget(
  readerId: Id<"readers">,
  feedSubscriptionId: Id<"feedSubscriptions">,
) {
  "use step";

  return await convex().query(api.importWorkflow.getRefreshTarget, {
    serviceToken: serviceToken(),
    readerId,
    feedSubscriptionId,
  });
}

async function prepareInitialImport(args: {
  readerId: Id<"readers">;
  submittedFeedUrl: string;
  canonicalFeedUrl: string;
  title: string;
  siteUrl: string | null;
  description: string | null;
  discoveredCount: number;
  importCount: number;
}) {
  "use step";

  return await convex().mutation(api.importWorkflow.prepareInitialImport, {
    serviceToken: serviceToken(),
    ...args,
  });
}

async function prepareReplacementImport(args: {
  readerId: Id<"readers">;
  feedSubscriptionId: Id<"feedSubscriptions">;
  submittedFeedUrl: string;
  canonicalFeedUrl: string;
  title: string;
  siteUrl: string | null;
  description: string | null;
  discoveredCount: number;
  importCount: number;
}) {
  "use step";

  return await convex().mutation(api.importWorkflow.prepareReplacementImport, {
    serviceToken: serviceToken(),
    ...args,
  });
}

async function preparePostRetry(readerId: Id<"readers">, postId: Id<"posts">) {
  "use step";

  return await convex().mutation(api.importWorkflow.preparePostRetry, {
    serviceToken: serviceToken(),
    readerId,
    postId,
  });
}

async function markImportRunCompleted(feedImportRunId: Id<"feedImportRuns">) {
  "use step";

  await convex().mutation(api.importWorkflow.markImportRunCompleted, {
    serviceToken: serviceToken(),
    feedImportRunId,
  });
}

async function recordPostProcessed(
  feedImportRunId: Id<"feedImportRuns"> | null,
  ok: boolean,
) {
  "use step";

  if (feedImportRunId === null) {
    return;
  }

  await convex().mutation(api.importWorkflow.recordPostProcessed, {
    serviceToken: serviceToken(),
    feedImportRunId,
    ok,
  });
}

async function upsertPendingPost(
  args: WorkflowPostInput & { canonicalUrl: string },
) {
  "use step";

  const { autoTag: _autoTag, rssImageUrl, ...rest } = args;
  void _autoTag;

  await convex().mutation(api.importWorkflow.upsertPost, {
    serviceToken: serviceToken(),
    ...rest,
    firecrawlStatus: "pending",
    firecrawlVisitedAt: null,
    firecrawlPageContent: null,
    firecrawlPageSummary: null,
    firecrawlError: null,
    abstractStatus: "pending",
    abstractError: null,
    headerImageUrl: rssImageUrl,
  });
}

async function upsertProcessedPost(
  args: WorkflowPostInput & {
    canonicalUrl: string;
    scraped:
      | {
          ok: true;
          content: string;
          summary: string | null;
          imageUrl: string | null;
        }
      | { ok: false; error: string };
    generated: { ok: true; abstract: string } | { ok: false; error: string };
    visitedAt: number;
  },
) {
  "use step";

  return await convex().mutation(api.importWorkflow.upsertPost, {
    serviceToken: serviceToken(),
    feedId: args.feedId,
    feedImportRunId: args.feedImportRunId,
    readerId: args.readerId,
    sourceTitle: args.sourceTitle,
    sourceSiteUrl: args.sourceSiteUrl,
    sourceFeedUrl: args.sourceFeedUrl,
    rssTitle: args.rssTitle,
    rssDescription: args.rssDescription,
    rssLinkUrl: args.rssLinkUrl,
    canonicalUrl: args.canonicalUrl,
    firecrawlStatus: args.scraped.ok ? "succeeded" : "failed",
    firecrawlVisitedAt: args.visitedAt,
    firecrawlPageContent: args.scraped.ok ? args.scraped.content : null,
    firecrawlPageSummary: args.generated.ok
      ? args.generated.abstract
      : args.scraped.ok
        ? args.scraped.summary
        : null,
    firecrawlError: args.scraped.ok ? null : args.scraped.error,
    abstractStatus: args.generated.ok ? "succeeded" : "failed",
    abstractError: args.generated.ok ? null : args.generated.error,
    headerImageUrl:
      args.rssImageUrl ?? (args.scraped.ok ? args.scraped.imageUrl : null),
    publishedAt: args.publishedAt,
    discoveredAt: args.discoveredAt,
  });
}

async function getProcessingState(canonicalUrl: string) {
  "use step";

  return await convex().query(api.importWorkflow.getProcessingState, {
    serviceToken: serviceToken(),
    canonicalUrl,
  });
}

async function getAutoTagContext(
  readerId: Id<"readers">,
  homeFeedItemId: Id<"homeFeedItems">,
) {
  "use step";

  return await convex().query(api.importWorkflow.getAutoTagContext, {
    serviceToken: serviceToken(),
    readerId,
    homeFeedItemId,
  });
}

async function updateAutoTagEmbeddings(
  readerId: Id<"readers">,
  tags: Array<{
    tagId: Id<"tags">;
    description: string;
    embedding: number[];
    embeddingModel: string;
  }>,
) {
  "use step";

  if (tags.length === 0) {
    return { updated: 0 };
  }

  return await convex().mutation(api.importWorkflow.updateAutoTagEmbeddings, {
    serviceToken: serviceToken(),
    readerId,
    tags,
  });
}

async function searchAutoTagCandidates(
  readerId: Id<"readers">,
  embedding: number[],
) {
  "use step";

  return await convex().action(api.importWorkflow.searchAutoTagCandidates, {
    serviceToken: serviceToken(),
    readerId,
    embedding,
  });
}

async function applyAutoTags(args: {
  readerId: Id<"readers">;
  homeFeedItemId: Id<"homeFeedItems">;
  existingTagIds: Id<"tags">[];
  newTags: Array<{
    name: string;
    description: string;
    embedding: number[];
    embeddingModel: string;
  }>;
}) {
  "use step";

  return await convex().mutation(api.importWorkflow.applyAutoTags, {
    serviceToken: serviceToken(),
    ...args,
  });
}

async function scrapePost(canonicalUrl: string) {
  "use step";

  return await scrapeWithFirecrawl(canonicalUrl);
}

async function generatePostAbstract(content: string, title: string) {
  "use step";

  return await generateAbstract(content, title);
}

function wasManuallyFailed(
  state: Awaited<ReturnType<typeof getProcessingState>>,
) {
  return (
    state !== null &&
    (state.firecrawlError === "Post import skipped manually" ||
      state.firecrawlError === "Post import timed out after 2 minutes" ||
      state.abstractError === "Post import skipped manually" ||
      state.abstractError === "Post import timed out after 2 minutes")
  );
}

async function prepareMissingTagEmbeddings(tags: ExistingAutoTag[]) {
  "use step";

  const missing = tags.filter((tag) => !tag.hasEmbedding);
  if (missing.length === 0) {
    return [];
  }

  const descriptions = await describeTagsForAutoTag(
    missing.map((tag) => ({ tagId: tag._id, name: tag.name })),
  );
  const embeddings = await embedTaggingTexts(
    descriptions.map((tag) => tag.description),
  );

  return descriptions.map((tag, index) => ({
    tagId: tag.tagId as Id<"tags">,
    description: tag.description,
    embedding: embeddings[index] ?? [],
    embeddingModel: tagEmbeddingModel,
  }));
}

async function prepareNewTagEmbeddings(
  tags: Array<{ name: string; description: string }>,
) {
  "use step";

  if (tags.length === 0) {
    return [];
  }

  const embeddings = await embedTaggingTexts(
    tags.map((tag) => tag.description),
  );
  return tags.map((tag, index) => ({
    ...tag,
    embedding: embeddings[index] ?? [],
    embeddingModel: tagEmbeddingModel,
  }));
}

async function autoTagReadablePost(args: {
  readerId: Id<"readers">;
  homeFeedItemId: Id<"homeFeedItems">;
  rssTitle: string;
  sourceTitle: string;
  abstract: string | null;
  content: string;
}) {
  const context = await getAutoTagContext(args.readerId, args.homeFeedItemId);
  if (!context.shouldTag) {
    return;
  }

  const preparedTags = await prepareMissingTagEmbeddings(context.tags);
  await updateAutoTagEmbeddings(args.readerId, preparedTags);

  const descriptionByTagId = new Map(
    context.tags.map((tag) => [tag._id, tag.description]),
  );
  for (const tag of preparedTags) {
    descriptionByTagId.set(tag.tagId, tag.description);
  }

  const input = taggingInput({
    title: args.rssTitle,
    sourceTitle: args.sourceTitle,
    abstract: args.abstract,
    content: args.content,
  });
  const postEmbedding = await embedTaggingText(input);
  const vectorCandidates = await searchAutoTagCandidates(
    args.readerId,
    postEmbedding,
  );
  const selectedExistingTagIds = vectorCandidates
    .filter((candidate) => candidate._score >= autoTagSimilarityThreshold)
    .slice(0, autoTagMaxTags)
    .map((candidate) => candidate._id);

  const remainingSlots = autoTagMaxTags - selectedExistingTagIds.length;
  const suggestions =
    remainingSlots > 0
      ? await generateAutoTagSuggestions({
          title: args.rssTitle,
          sourceTitle: args.sourceTitle,
          content: input,
          existingTags: context.tags.map((tag) => ({
            tagId: tag._id,
            name: tag.name,
            description: descriptionByTagId.get(tag._id) ?? null,
          })),
          alreadySelectedTagIds: selectedExistingTagIds,
          remainingSlots,
        })
      : { existingTagIds: [], newTags: [] };

  const suggestedExistingTagIds = suggestions.existingTagIds.map(
    (tagId) => tagId as Id<"tags">,
  );
  const newTags = await prepareNewTagEmbeddings(suggestions.newTags);

  await applyAutoTags({
    readerId: args.readerId,
    homeFeedItemId: args.homeFeedItemId,
    existingTagIds: [...selectedExistingTagIds, ...suggestedExistingTagIds],
    newTags,
  });
}

async function upsertExistingPost(args: {
  feedId: Id<"feeds"> | null;
  feedImportRunId: Id<"feedImportRuns"> | null;
  readerId: Id<"readers">;
  sourceTitle: string;
  sourceSiteUrl: string | null;
  sourceFeedUrl: string | null;
  rssTitle: string;
  rssDescription: string | null;
  rssLinkUrl: string;
  canonicalUrl: string;
  firecrawlVisitedAt: number;
  firecrawlPageContent: string | null;
  firecrawlPageSummary: string | null;
  headerImageUrl: string | null;
  publishedAt: number | null;
  discoveredAt: number;
}) {
  "use step";

  return await convex().mutation(api.importWorkflow.upsertPost, {
    serviceToken: serviceToken(),
    feedId: args.feedId,
    feedImportRunId: args.feedImportRunId,
    readerId: args.readerId,
    sourceTitle: args.sourceTitle,
    sourceSiteUrl: args.sourceSiteUrl,
    sourceFeedUrl: args.sourceFeedUrl,
    rssTitle: args.rssTitle,
    rssDescription: args.rssDescription,
    rssLinkUrl: args.rssLinkUrl,
    canonicalUrl: args.canonicalUrl,
    firecrawlStatus: "succeeded",
    firecrawlVisitedAt: args.firecrawlVisitedAt,
    firecrawlPageContent: args.firecrawlPageContent,
    firecrawlPageSummary: args.firecrawlPageSummary,
    firecrawlError: null,
    abstractStatus: args.firecrawlPageSummary !== null ? "succeeded" : "failed",
    abstractError:
      args.firecrawlPageSummary !== null
        ? null
        : "Existing Post has no Abstract",
    headerImageUrl: args.headerImageUrl,
    publishedAt: args.publishedAt,
    discoveredAt: args.discoveredAt,
  });
}

async function processPost(args: WorkflowPostInput) {
  const canonicalUrl = normalizedArticleUrl(args.rssLinkUrl);
  const existing = await getProcessingState(canonicalUrl);
  if (
    existing?.firecrawlStatus === "succeeded" &&
    existing.firecrawlVisitedAt !== null
  ) {
    const upserted = await upsertExistingPost({
      feedId: args.feedId,
      feedImportRunId: args.feedImportRunId,
      readerId: args.readerId,
      sourceTitle: args.sourceTitle,
      sourceSiteUrl: args.sourceSiteUrl,
      sourceFeedUrl: args.sourceFeedUrl,
      rssTitle: args.rssTitle,
      rssDescription: args.rssDescription,
      rssLinkUrl: args.rssLinkUrl,
      canonicalUrl,
      firecrawlVisitedAt: existing.firecrawlVisitedAt,
      firecrawlPageContent: existing.firecrawlPageContent,
      firecrawlPageSummary: existing.firecrawlPageSummary,
      headerImageUrl: args.rssImageUrl ?? existing.headerImageUrl,
      publishedAt: args.publishedAt,
      discoveredAt: args.discoveredAt,
    });
    await recordPostProcessed(
      args.feedImportRunId,
      existing.firecrawlPageSummary !== null,
    );
    if (args.autoTag && existing.firecrawlPageContent !== null) {
      try {
        await autoTagReadablePost({
          readerId: args.readerId,
          homeFeedItemId: upserted.homeFeedItemId,
          rssTitle: args.rssTitle,
          sourceTitle: args.sourceTitle,
          abstract: existing.firecrawlPageSummary,
          content: existing.firecrawlPageContent,
        });
      } catch (error) {
        console.error("Auto-tagging failed", error);
      }
    }
    return;
  }

  await upsertPendingPost({ ...args, canonicalUrl });

  const scraped = await scrapePost(canonicalUrl).catch((error) => ({
    ok: false as const,
    error: error instanceof Error ? error.message : "Firecrawl scrape failed",
  }));
  const visitedAt = Date.now();
  const generated =
    scraped.ok === true
      ? await generatePostAbstract(scraped.content, args.rssTitle).then(
          (abstract) => ({ ok: true as const, abstract }),
          (error) => ({
            ok: false as const,
            error:
              error instanceof Error
                ? error.message
                : "Abstract generation failed",
          }),
        )
      : { ok: false as const, error: scraped.error };

  if (wasManuallyFailed(await getProcessingState(canonicalUrl))) {
    return;
  }

  const upserted = await upsertProcessedPost({
    ...args,
    canonicalUrl,
    scraped,
    generated,
    visitedAt,
  });
  await recordPostProcessed(args.feedImportRunId, scraped.ok && generated.ok);
  if (args.autoTag && scraped.ok) {
    try {
      await autoTagReadablePost({
        readerId: args.readerId,
        homeFeedItemId: upserted.homeFeedItemId,
        rssTitle: args.rssTitle,
        sourceTitle: args.sourceTitle,
        abstract: generated.ok ? generated.abstract : scraped.summary,
        content: scraped.content,
      });
    } catch (error) {
      console.error("Auto-tagging failed", error);
    }
  }
}

async function processPostsInBatches(posts: WorkflowPostInput[]) {
  for (let index = 0; index < posts.length; index += postBatchSize) {
    await Promise.all(
      posts.slice(index, index + postBatchSize).map(processPost),
    );
  }
}

function postInput(
  prepared: PreparedImport,
  entry: FeedEntry,
  args: {
    sourceTitle: string;
    sourceSiteUrl: string | null;
    sourceFeedUrl: string;
    discoveredAt: number;
    autoTag: boolean;
  },
): WorkflowPostInput {
  return {
    feedId: prepared.feedId,
    feedImportRunId: prepared.feedImportRunId,
    readerId: prepared.readerId,
    sourceTitle: args.sourceTitle,
    sourceSiteUrl: args.sourceSiteUrl,
    sourceFeedUrl: args.sourceFeedUrl,
    rssTitle: entry.title,
    rssDescription: entry.description,
    rssLinkUrl: entry.linkUrl,
    publishedAt: entry.publishedAt,
    discoveredAt: args.discoveredAt,
    rssImageUrl: entry.imageUrl,
    autoTag: args.autoTag,
  };
}

export async function initialImportWorkflow(
  readerId: Id<"readers">,
  submittedFeedUrlInput: string,
) {
  "use workflow";

  const submittedFeedUrl = normalizeUrl(submittedFeedUrlInput);
  const feed = await fetchFeed(submittedFeedUrl);
  if (feed.entries.length === 0) {
    throw new Error("Feed has no Posts to import");
  }

  const entries = newestEntries(feed.entries, initialImportLimit);
  const prepared = await prepareInitialImport({
    readerId,
    submittedFeedUrl,
    canonicalFeedUrl: submittedFeedUrl,
    title: feed.title,
    siteUrl: feed.siteUrl,
    description: feed.description,
    discoveredCount: feed.entries.length,
    importCount: entries.length,
  });
  const discoveredAt = Date.now();

  await processPostsInBatches(
    entries.map((entry) =>
      postInput(prepared, entry, {
        sourceTitle: feed.title,
        sourceSiteUrl: feed.siteUrl,
        sourceFeedUrl: submittedFeedUrl,
        discoveredAt,
        autoTag: true,
      }),
    ),
  );

  return { feedImportRunId: prepared.feedImportRunId };
}

export async function manualRefreshWorkflow(
  readerId: Id<"readers">,
  feedSubscriptionId: Id<"feedSubscriptions">,
) {
  "use workflow";

  const subscription = await getRefreshTarget(readerId, feedSubscriptionId);
  const submittedFeedUrl = normalizeUrl(subscription.submittedFeedUrl);
  const feed = await fetchFeed(subscription.canonicalFeedUrl);
  const knownUrls = new Set(subscription.knownCanonicalUrls);
  const entries = feed.entries
    .slice()
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
    .filter((entry) => !knownUrls.has(normalizeUrl(entry.linkUrl)))
    .slice(0, manualRefreshLimit);
  const prepared = await prepareInitialImport({
    readerId,
    submittedFeedUrl,
    canonicalFeedUrl: subscription.canonicalFeedUrl,
    title: feed.title,
    siteUrl: feed.siteUrl,
    description: feed.description,
    discoveredCount: feed.entries.length,
    importCount: entries.length,
  });
  const discoveredAt = Date.now();

  if (entries.length === 0) {
    await markImportRunCompleted(prepared.feedImportRunId);
    return { feedImportRunId: prepared.feedImportRunId };
  }

  await processPostsInBatches(
    entries.map((entry) =>
      postInput(prepared, entry, {
        sourceTitle: feed.title,
        sourceSiteUrl: feed.siteUrl,
        sourceFeedUrl: subscription.canonicalFeedUrl,
        discoveredAt,
        autoTag: true,
      }),
    ),
  );

  return { feedImportRunId: prepared.feedImportRunId };
}

export async function replacementImportWorkflow(
  readerId: Id<"readers">,
  feedSubscriptionId: Id<"feedSubscriptions">,
  submittedFeedUrlInput: string,
) {
  "use workflow";

  const submittedFeedUrl = normalizeUrl(submittedFeedUrlInput);
  const feed = await fetchFeed(submittedFeedUrl);
  if (feed.entries.length === 0) {
    throw new Error("Feed has no Posts to import");
  }

  const entries = newestEntries(feed.entries, manualRefreshLimit);
  const prepared = await prepareReplacementImport({
    readerId,
    feedSubscriptionId,
    submittedFeedUrl,
    canonicalFeedUrl: submittedFeedUrl,
    title: feed.title,
    siteUrl: feed.siteUrl,
    description: feed.description,
    discoveredCount: feed.entries.length,
    importCount: entries.length,
  });
  const discoveredAt = Date.now();

  await processPostsInBatches(
    entries.map((entry) =>
      postInput(prepared, entry, {
        sourceTitle: feed.title,
        sourceSiteUrl: feed.siteUrl,
        sourceFeedUrl: submittedFeedUrl,
        discoveredAt,
        autoTag: false,
      }),
    ),
  );

  return { feedImportRunId: prepared.feedImportRunId };
}

export async function postRetryWorkflow(
  readerId: Id<"readers">,
  postId: Id<"posts">,
) {
  "use workflow";

  const retryArgs = await preparePostRetry(readerId, postId);
  await processPost({ ...retryArgs, feedImportRunId: null, autoTag: false });
}
