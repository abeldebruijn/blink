import { embed, embedMany, generateText, gateway } from "ai";
import { openai } from "@ai-sdk/openai";
import { validImageUrl } from "@/convex/feedImports";

const firecrawlScrapeUrl = "https://api.firecrawl.dev/v2/scrape";
const maxStoredContentLength = 60_000;
const maxAbstractLength = 700;
const maxAbstractInputLength = 16_000;
const maxTaggingInputLength = 12_000;
const abstractModel = "openai/gpt-5.1";
const tagSuggestionModel = "openai/gpt-5.1";
export const tagEmbeddingModel = "text-embedding-3-small";

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

function requireOpenAiApiKey() {
  if ((process.env.OPENAI_API_KEY ?? "").trim() === "") {
    throw new Error("OPENAI_API_KEY is not configured");
  }
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const jsonText = fenced?.[1] ?? trimmed;
  return JSON.parse(jsonText) as unknown;
}

function cleanTagName(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const cleaned = value.replace(/^#+/, "").trim().replace(/\s+/g, " ");
  if (cleaned === "") {
    return null;
  }
  return cleaned
    .split(" ")
    .slice(0, 3)
    .map((word) =>
      word.length === 0
        ? word
        : `${word[0]?.toLocaleUpperCase()}${word.slice(1).toLocaleLowerCase()}`,
    )
    .join(" ");
}

function cleanTagDescription(value: unknown, fallbackName: string) {
  if (typeof value !== "string" || value.trim() === "") {
    return `Posts about ${fallbackName}.`;
  }
  return truncate(value.trim().replace(/\s+/g, " "), 240);
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

export async function embedTaggingText(text: string) {
  requireOpenAiApiKey();
  const { embedding } = await embed({
    model: openai.embeddingModel(tagEmbeddingModel),
    value: text.slice(0, maxTaggingInputLength),
  });
  return embedding;
}

export async function embedTaggingTexts(values: string[]) {
  requireOpenAiApiKey();
  if (values.length === 0) {
    return [];
  }
  const { embeddings } = await embedMany({
    model: openai.embeddingModel(tagEmbeddingModel),
    values: values.map((value) => value.slice(0, maxTaggingInputLength)),
    maxParallelCalls: 2,
  });
  return embeddings;
}

export function taggingInput(args: {
  title: string;
  sourceTitle: string;
  abstract: string | null;
  content: string;
}) {
  return [
    `Title: ${args.title}`,
    `Source: ${args.sourceTitle}`,
    args.abstract === null ? null : `Abstract: ${args.abstract}`,
    `Extracted Content:\n${args.content}`,
  ]
    .filter((part): part is string => part !== null)
    .join("\n\n")
    .slice(0, maxTaggingInputLength);
}

export async function describeTagsForAutoTag(
  tags: Array<{ tagId: string; name: string }>,
) {
  if (tags.length === 0) {
    return [];
  }
  if ((process.env.AI_GATEWAY_API_KEY ?? "").trim() === "") {
    throw new Error("AI_GATEWAY_API_KEY is not configured");
  }

  const { text } = await generateText({
    model: gateway(tagSuggestionModel),
    system:
      "You write internal Blink Tag Descriptions. Return only compact JSON. Descriptions are private matching metadata, not user-facing copy.",
    prompt: `For each tag, write one concise description of what posts should match it. Keep each description under 30 words.\n\nReturn JSON with this shape: {"tags":[{"tagId":"...","description":"..."}]}.\n\nTags:\n${JSON.stringify(
      tags,
    )}`,
  });

  const parsed = parseJsonObject(text);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { tags?: unknown }).tags)
  ) {
    return tags.map((tag) => ({
      tagId: tag.tagId,
      description: cleanTagDescription(null, tag.name),
    }));
  }

  const descriptions = new Map<string, string>();
  for (const item of (parsed as { tags: unknown[] }).tags) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const tagId = (item as { tagId?: unknown }).tagId;
    if (typeof tagId !== "string") {
      continue;
    }
    const tag = tags.find((candidate) => candidate.tagId === tagId);
    if (tag === undefined) {
      continue;
    }
    descriptions.set(
      tagId,
      cleanTagDescription(
        (item as { description?: unknown }).description,
        tag.name,
      ),
    );
  }

  return tags.map((tag) => ({
    tagId: tag.tagId,
    description:
      descriptions.get(tag.tagId) ?? cleanTagDescription(null, tag.name),
  }));
}

export async function generateAutoTagSuggestions(args: {
  title: string;
  sourceTitle: string;
  content: string;
  existingTags: Array<{
    tagId: string;
    name: string;
    description: string | null;
  }>;
  alreadySelectedTagIds: string[];
  remainingSlots: number;
}) {
  if (args.remainingSlots <= 0) {
    return { existingTagIds: [], newTags: [] };
  }
  if ((process.env.AI_GATEWAY_API_KEY ?? "").trim() === "") {
    throw new Error("AI_GATEWAY_API_KEY is not configured");
  }

  const alreadySelected = new Set(args.alreadySelectedTagIds);
  const availableExistingTags = args.existingTags
    .filter((tag) => !alreadySelected.has(tag.tagId))
    .slice(0, 100);
  const maxNewTags = Math.min(3, args.remainingSlots);

  const { text } = await generateText({
    model: gateway(tagSuggestionModel),
    system:
      "You tag Blink Posts for one Reader. Return only JSON. Prefer relevant existing tags. Create new tags only when useful. New tag names must be 1-3 word noun phrases, no hashtags.",
    prompt: `Post title: ${args.title}
Source: ${args.sourceTitle}

Existing tags available:
${JSON.stringify(availableExistingTags)}

Return JSON with this shape:
{"existingTagIds":["tag id"],"newTags":[{"name":"Short Noun Phrase","description":"private matching description"}]}

Rules:
- Fill at most ${args.remainingSlots} total slots.
- Create at most ${maxNewTags} new tags.
- Do not include already selected tag ids: ${JSON.stringify(args.alreadySelectedTagIds)}.
- Only use existingTagIds from the provided existing tags.
- New descriptions are internal matching metadata under 30 words.

Extracted Content:
${args.content.slice(0, maxTaggingInputLength)}`,
  });

  const parsed = parseJsonObject(text);
  if (typeof parsed !== "object" || parsed === null) {
    return { existingTagIds: [], newTags: [] };
  }

  const availableIds = new Set(availableExistingTags.map((tag) => tag.tagId));
  const existingTagIds = Array.isArray(
    (parsed as { existingTagIds?: unknown }).existingTagIds,
  )
    ? (parsed as { existingTagIds: unknown[] }).existingTagIds
        .filter((tagId): tagId is string => typeof tagId === "string")
        .filter((tagId) => availableIds.has(tagId))
        .slice(0, args.remainingSlots)
    : [];

  const remainingAfterExisting = Math.max(
    0,
    args.remainingSlots - existingTagIds.length,
  );
  const newTags = Array.isArray((parsed as { newTags?: unknown }).newTags)
    ? (parsed as { newTags: unknown[] }).newTags
        .map((tag) => {
          if (typeof tag !== "object" || tag === null) {
            return null;
          }
          const name = cleanTagName((tag as { name?: unknown }).name);
          if (name === null) {
            return null;
          }
          return {
            name,
            description: cleanTagDescription(
              (tag as { description?: unknown }).description,
              name,
            ),
          };
        })
        .filter(
          (tag): tag is { name: string; description: string } => tag !== null,
        )
        .slice(0, Math.min(3, remainingAfterExisting))
    : [];

  return { existingTagIds, newTags };
}
