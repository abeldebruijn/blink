import { parseFeed } from "@/convex/feedImports";
import { normalizeUrl } from "@/lib/url-normalization";

export async function preflightFeedUrl(submittedFeedUrlInput: string) {
  const submittedFeedUrl = normalizeUrl(submittedFeedUrlInput);
  const response = await fetch(submittedFeedUrl, {
    headers: {
      Accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Feed fetch failed with HTTP ${response.status}`);
  }

  const feed = parseFeed(await response.text(), submittedFeedUrl);
  if (feed.entries.length === 0) {
    throw new Error("Feed has no Posts to import");
  }

  return submittedFeedUrl;
}
