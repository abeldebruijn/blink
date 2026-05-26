import type { Doc, Id } from "../convex/_generated/dataModel";

export type HomeFeedBucket = "unread" | "read" | "readLater" | "liked";

export type HomeFeedBucketEntry = {
  bucket: HomeFeedBucket;
  key: [Id<"readers">, HomeFeedBucket, number];
  id: string;
};

export function homeFeedAggregateId(
  itemId: Id<"homeFeedItems">,
  bucket: HomeFeedBucket,
) {
  return `${itemId}:${bucket}`;
}

export function homeFeedBucketEntries(
  item: Doc<"homeFeedItems">,
): HomeFeedBucketEntry[] {
  const entries: HomeFeedBucketEntry[] = [];
  const readBucket = item.readAt === null ? "unread" : "read";

  entries.push({
    bucket: readBucket,
    key: [item.readerId, readBucket, item.sortTime],
    id: homeFeedAggregateId(item._id, readBucket),
  });

  if (item.readLaterAt !== undefined && item.readLaterAt !== null) {
    entries.push({
      bucket: "readLater",
      key: [item.readerId, "readLater", item.sortTime],
      id: homeFeedAggregateId(item._id, "readLater"),
    });
  }

  if (item.likedAt !== undefined && item.likedAt !== null) {
    entries.push({
      bucket: "liked",
      key: [item.readerId, "liked", item.sortTime],
      id: homeFeedAggregateId(item._id, "liked"),
    });
  }

  return entries;
}
