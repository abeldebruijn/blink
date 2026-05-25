import { XMLParser } from "fast-xml-parser";
export { normalizeUrl } from "@/lib/url-normalization";

export const initialImportLimit = 20;
export const manualRefreshLimit = 20;

export type FeedEntry = {
  title: string;
  linkUrl: string;
  description: string | null;
  imageUrl: string | null;
  publishedAt: number | null;
};

export type ParsedFeed = {
  title: string;
  siteUrl: string | null;
  description: string | null;
  entries: FeedEntry[];
};

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

export function validImageUrl(value: string | null, baseUrl: string) {
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

function firstHtmlImageUrl(html: string | null, baseUrl: string) {
  if (html === null) {
    return null;
  }

  const imgMatch = html.match(/<img\b[^>]*>/i);
  if (imgMatch === null) {
    return null;
  }

  const attributes = imgMatch[0];
  const src =
    attributes.match(
      /\s(?:src|data-src|data-original)\s*=\s*["']([^"']+)["']/i,
    )?.[1] ??
    attributes
      .match(/\ssrcset\s*=\s*["']([^"']+)["']/i)?.[1]
      ?.split(",")[0]
      ?.trim()
      .split(/\s+/)[0] ??
    null;

  return validImageUrl(src ?? null, baseUrl);
}

function imageFromEmbeddedImg(value: unknown, baseUrl: string) {
  const record = asRecord(value);
  if (record === null) {
    return null;
  }

  for (const image of asArray(record.img)) {
    const src =
      attrValue(image, "src") ??
      attrValue(image, "data-src") ??
      attrValue(image, "data-original") ??
      attrValue(image, "srcset")?.split(",")[0]?.trim().split(/\s+/)[0] ??
      null;
    const url = validImageUrl(src, baseUrl);
    if (url !== null) {
      return url;
    }
  }

  return null;
}

function imageFromRssMedia(item: Record<string, unknown>, baseUrl: string) {
  const candidates = [
    ...asArray(item["media:content"]).map((value) => attrValue(value, "url")),
    ...asArray(item["media:thumbnail"]).map((value) => attrValue(value, "url")),
    ...asArray(item.enclosure).map((value) => {
      const type = attrValue(value, "type");
      return type?.startsWith("image/") ? attrValue(value, "url") : null;
    }),
    attrValue(item["itunes:image"], "href"),
    textValue(item.image),
  ];

  for (const candidate of candidates) {
    const url = validImageUrl(candidate, baseUrl);
    if (url !== null) {
      return url;
    }
  }

  return null;
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

export function parseFeed(xml: string, canonicalFeedUrl: string): ParsedFeed {
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
            textValue(record.description) ??
            textValue(record["content:encoded"]),
          imageUrl:
            imageFromRssMedia(record, linkUrl) ??
            imageFromEmbeddedImg(record.description, linkUrl) ??
            imageFromEmbeddedImg(record["content:encoded"], linkUrl) ??
            firstHtmlImageUrl(textValue(record.description), linkUrl) ??
            firstHtmlImageUrl(textValue(record["content:encoded"]), linkUrl),
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
          imageUrl:
            imageFromRssMedia(record, linkUrl) ??
            imageFromEmbeddedImg(record.summary, linkUrl) ??
            imageFromEmbeddedImg(record.content, linkUrl) ??
            firstHtmlImageUrl(textValue(record.summary), linkUrl) ??
            firstHtmlImageUrl(textValue(record.content), linkUrl),
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

  throw new Error("Submitted Feed URL must point directly to RSS or Atom");
}

export function newestEntries(entries: FeedEntry[], limit: number) {
  return entries
    .slice()
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
    .slice(0, limit);
}
