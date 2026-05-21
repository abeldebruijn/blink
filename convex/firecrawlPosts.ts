import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

const firecrawlScrapeUrl = "https://api.firecrawl.dev/v2/scrape";
const maxStoredContentLength = 60_000;
const maxAbstractLength = 700;

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
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
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

  const payload = (await response.json().catch(() => ({}))) as FirecrawlScrapeResponse;
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

  return {
    ok: true as const,
    content: truncate(content, maxStoredContentLength),
    summary: summarizeMarkdown(content),
  };
}

export const ingestRssEntry = internalAction({
  args: {
    readerId: v.id("readers"),
    sourceTitle: v.string(),
    sourceSiteUrl: v.union(v.string(), v.null()),
    sourceFeedUrl: v.union(v.string(), v.null()),
    rssTitle: v.string(),
    rssDescription: v.union(v.string(), v.null()),
    rssLinkUrl: v.string(),
    publishedAt: v.union(v.number(), v.null()),
    discoveredAt: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ postId: Id<"posts">; homeFeedItemId: Id<"homeFeedItems"> }> => {
    const canonicalUrl = normalizedUrl(args.rssLinkUrl);
    const existing: {
      firecrawlStatus: "pending" | "succeeded" | "failed" | null;
      firecrawlVisitedAt: number | null;
      firecrawlPageContent: string | null;
      firecrawlPageSummary: string | null;
    } | null = await ctx.runQuery(internal.homeFeed.getProcessingState, {
      canonicalUrl,
    });

    if (
      existing?.firecrawlStatus === "succeeded" &&
      existing.firecrawlVisitedAt !== null
    ) {
      return await ctx.runMutation(internal.homeFeed.upsertPost, {
        ...args,
        canonicalUrl,
        firecrawlStatus: "succeeded",
        firecrawlVisitedAt: existing.firecrawlVisitedAt,
        firecrawlPageContent: existing.firecrawlPageContent,
        firecrawlPageSummary: existing.firecrawlPageSummary,
        firecrawlError: null,
        headerImageUrl: null,
      });
    }

    const scraped = await scrapeWithFirecrawl(canonicalUrl).catch((error) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : "Firecrawl scrape failed",
    }));
    const visitedAt = Date.now();

    return await ctx.runMutation(internal.homeFeed.upsertPost, {
      ...args,
      canonicalUrl,
      firecrawlStatus: scraped.ok ? "succeeded" : "failed",
      firecrawlVisitedAt: visitedAt,
      firecrawlPageContent: scraped.ok ? scraped.content : null,
      firecrawlPageSummary: scraped.ok ? scraped.summary : null,
      firecrawlError: scraped.ok ? null : scraped.error,
      headerImageUrl: null,
    });
  },
});
