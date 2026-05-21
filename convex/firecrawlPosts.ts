import { ConvexError, v } from "convex/values";
import { generateText, gateway } from "ai";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

const firecrawlScrapeUrl = "https://api.firecrawl.dev/v2/scrape";
const maxStoredContentLength = 60_000;
const maxAbstractLength = 700;
const maxAbstractInputLength = 16_000;
const abstractModel = "openai/gpt-5.1";

type FirecrawlScrapeResponse = {
  success?: boolean;
  data?: {
    markdown?: string;
    content?: string;
    html?: string;
    metadata?: {
      title?: string;
      sourceURL?: string;
      statusCode?: number;
      error?: string;
      ogImage?: string;
      twitterImage?: string;
      image?: string;
    };
  };
  error?: string;
};

function normalizedUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    throw new ConvexError("RSS entry link is not a valid URL");
  }
}

function trimmedOrNull(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 3)}...`
    : value;
}

function validImageUrl(value: string | null, baseUrl: string) {
  if (value === null) {
    return null;
  }

  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function firstMarkdownImageUrl(markdown: string | null, baseUrl: string) {
  if (markdown === null) {
    return null;
  }

  const imageMatch = markdown.match(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
  return validImageUrl(imageMatch?.[1] ?? null, baseUrl);
}

function firstMeaningfulParagraph(markdown: string) {
  return (
    markdown
      .split(/\n{2,}/)
      .map((paragraph) =>
        paragraph
          .replace(/^#{1,6}\s+/gm, "")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/[*_`>~-]/g, "")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .find((paragraph) => paragraph.length >= 80) ?? null
  );
}

function summarizeMarkdown(markdown: string) {
  const paragraph = firstMeaningfulParagraph(markdown);
  if (paragraph === null) {
    return null;
  }

  const sentences = paragraph.match(/[^.!?]+[.!?]+/g);
  const summary =
    sentences === null ? paragraph : sentences.slice(0, 2).join(" ").trim();

  return truncate(summary, maxAbstractLength);
}

async function generateAbstract(markdown: string, title: string) {
  if ((process.env.AI_GATEWAY_API_KEY ?? "").trim() === "") {
    throw new ConvexError("AI_GATEWAY_API_KEY is not configured");
  }

  const { text } = await generateText({
    model: gateway(abstractModel),
    system:
      "You write Blink Abstracts. Return exactly one short paragraph of about four short sentences. Use this shape: introduction, why interesting, conclusion. Do not use headings or bullets.",
    prompt: `Post title: ${title}\n\nExtracted Content:\n${markdown.slice(
      0,
      maxAbstractInputLength,
    )}`,
  });

  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized === "") {
    throw new ConvexError("AI returned an empty Abstract");
  }

  return truncate(normalized, maxAbstractLength);
}

async function scrapeWithFirecrawl(canonicalUrl: string) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (apiKey === undefined || apiKey.trim() === "") {
    throw new ConvexError("FIRECRAWL_API_KEY is not configured");
  }

  const response = await fetch(firecrawlScrapeUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: canonicalUrl,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as FirecrawlScrapeResponse;
  if (!response.ok || payload.success === false) {
    return {
      ok: false as const,
      error:
        payload.error ??
        payload.data?.metadata?.error ??
        `Firecrawl scrape failed with HTTP ${response.status}`,
    };
  }

  const content =
    trimmedOrNull(payload.data?.markdown ?? null) ??
    trimmedOrNull(payload.data?.content ?? null) ??
    trimmedOrNull(payload.data?.html ?? null);

  if (content === null) {
    return {
      ok: false as const,
      error: "Firecrawl returned no readable page content",
    };
  }

  const metadataImage =
    validImageUrl(payload.data?.metadata?.ogImage ?? null, canonicalUrl) ??
    validImageUrl(payload.data?.metadata?.twitterImage ?? null, canonicalUrl) ??
    validImageUrl(payload.data?.metadata?.image ?? null, canonicalUrl);

  return {
    ok: true as const,
    content: truncate(content, maxStoredContentLength),
    summary: summarizeMarkdown(content),
    imageUrl: metadataImage ?? firstMarkdownImageUrl(content, canonicalUrl),
  };
}

export const ingestRssEntry = internalAction({
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
    publishedAt: v.union(v.number(), v.null()),
    discoveredAt: v.number(),
    rssImageUrl: v.union(v.string(), v.null()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ postId: Id<"posts">; homeFeedItemId: Id<"homeFeedItems"> }> => {
    const { rssImageUrl, ...restArgs } = args;
    const canonicalUrl = normalizedUrl(args.rssLinkUrl);
    const existing: {
      firecrawlStatus: "pending" | "succeeded" | "failed" | null;
      firecrawlVisitedAt: number | null;
      firecrawlPageContent: string | null;
      firecrawlPageSummary: string | null;
      headerImageUrl: string | null;
    } | null = await ctx.runQuery(internal.homeFeed.getProcessingState, {
      canonicalUrl,
    });

    if (
      existing?.firecrawlStatus === "succeeded" &&
      existing.firecrawlVisitedAt !== null
    ) {
      const result: {
        postId: Id<"posts">;
        homeFeedItemId: Id<"homeFeedItems">;
      } = await ctx.runMutation(internal.homeFeed.upsertPost, {
        ...restArgs,
        canonicalUrl,
        firecrawlStatus: "succeeded",
        firecrawlVisitedAt: existing.firecrawlVisitedAt,
        firecrawlPageContent: existing.firecrawlPageContent,
        firecrawlPageSummary: existing.firecrawlPageSummary,
        firecrawlError: null,
        abstractStatus:
          existing.firecrawlPageSummary !== null ? "succeeded" : "failed",
        abstractError:
          existing.firecrawlPageSummary !== null
            ? null
            : "Existing Post has no Abstract",
        headerImageUrl: rssImageUrl ?? existing.headerImageUrl,
      });
      if (args.feedImportRunId !== undefined && args.feedImportRunId !== null) {
        await ctx.runMutation(internal.feedImports.recordPostProcessed, {
          feedImportRunId: args.feedImportRunId,
          ok: existing.firecrawlPageSummary !== null,
        });
      }
      return result;
    }

    await ctx.runMutation(internal.homeFeed.upsertPost, {
      ...restArgs,
      canonicalUrl,
      firecrawlStatus: "pending",
      firecrawlVisitedAt: null,
      firecrawlPageContent: null,
      firecrawlPageSummary: null,
      firecrawlError: null,
      abstractStatus: "pending",
      abstractError: null,
      headerImageUrl: rssImageUrl,
    });

    const scraped = await scrapeWithFirecrawl(canonicalUrl).catch((error) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : "Firecrawl scrape failed",
    }));
    const visitedAt = Date.now();
    const generated =
      scraped.ok === true
        ? await generateAbstract(scraped.content, args.rssTitle).then(
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

    const result: { postId: Id<"posts">; homeFeedItemId: Id<"homeFeedItems"> } =
      await ctx.runMutation(internal.homeFeed.upsertPost, {
        ...restArgs,
        canonicalUrl,
        firecrawlStatus: scraped.ok ? "succeeded" : "failed",
        firecrawlVisitedAt: visitedAt,
        firecrawlPageContent: scraped.ok ? scraped.content : null,
        firecrawlPageSummary: generated.ok
          ? generated.abstract
          : scraped.ok
            ? scraped.summary
            : null,
        firecrawlError: scraped.ok ? null : scraped.error,
        abstractStatus: generated.ok ? "succeeded" : "failed",
        abstractError: generated.ok ? null : generated.error,
        headerImageUrl:
          rssImageUrl ?? (scraped.ok ? scraped.imageUrl : null),
      });

    if (args.feedImportRunId !== undefined && args.feedImportRunId !== null) {
      await ctx.runMutation(internal.feedImports.recordPostProcessed, {
        feedImportRunId: args.feedImportRunId,
        ok: scraped.ok && generated.ok,
      });
    }

    return result;
  },
});
