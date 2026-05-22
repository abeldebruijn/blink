import { generateText, gateway } from "ai";
import { validImageUrl } from "@/lib/feed-imports";

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

function trimmedOrNull(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

export function truncate(value: string, maxLength: number) {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 3)}...`
    : value;
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

export function summarizeMarkdown(markdown: string) {
  const paragraph = firstMeaningfulParagraph(markdown);
  if (paragraph === null) {
    return null;
  }

  const sentences = paragraph.match(/[^.!?]+[.!?]+/g);
  const summary =
    sentences === null ? paragraph : sentences.slice(0, 2).join(" ").trim();

  return truncate(summary, maxAbstractLength);
}

export async function scrapeWithFirecrawl(canonicalUrl: string) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (apiKey === undefined || apiKey.trim() === "") {
    throw new Error("FIRECRAWL_API_KEY is not configured");
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
  if (!response.ok) {
    throw new Error(
      payload.error ??
        payload.data?.metadata?.error ??
        `Firecrawl scrape failed with HTTP ${response.status}`,
    );
  }

  if (payload.success === false) {
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

export async function generateAbstract(markdown: string, title: string) {
  if ((process.env.AI_GATEWAY_API_KEY ?? "").trim() === "") {
    throw new Error("AI_GATEWAY_API_KEY is not configured");
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
    throw new Error("AI returned an empty Abstract");
  }

  return truncate(normalized, maxAbstractLength);
}
