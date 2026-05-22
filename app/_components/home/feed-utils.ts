import type { HomeFeedFilter, HomeFeedItem, HomeFeedItems } from "./types";

export function parseFeedFilter(value: string | null): HomeFeedFilter {
  if (value === "read" || value === "readLater" || value === "liked") {
    return value;
  }
  return "unread";
}

export function filterHomeFeedItems(
  items: HomeFeedItems,
  selectedFeed: HomeFeedFilter,
) {
  if (selectedFeed === "read") {
    return items.filter((item) => item.isRead);
  }
  if (selectedFeed === "readLater" || selectedFeed === "liked") {
    return [];
  }
  return items.filter((item) => !item.isRead);
}

export function postTimingLabel(item: HomeFeedItem) {
  const timestamp = item.publishedAt ?? item.discoveredAt;
  if (timestamp === null) {
    return null;
  }

  const date = new Date(timestamp);
  const now = Date.now();
  const diffMs = Math.max(0, now - date.getTime());
  const diffHours = Math.floor(diffMs / 3_600_000);
  if (diffHours < 1) {
    return "Just now";
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function siteHost(siteUrl: string) {
  try {
    return new URL(siteUrl).host.replace(/^www\./, "");
  } catch {
    return siteUrl;
  }
}
