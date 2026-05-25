import { describe, expect, test } from "vitest";
import type { Doc, Id } from "../convex/_generated/dataModel";
import {
  homeFeedAggregateId,
  homeFeedBucketEntries,
} from "./home-feed-aggregate-keys";

function homeFeedItem(
  fields: Partial<Doc<"homeFeedItems">> = {},
): Doc<"homeFeedItems"> {
  return {
    _id: "homeFeedItem1" as Id<"homeFeedItems">,
    _creationTime: 1,
    readerId: "reader1" as Id<"readers">,
    feedId: "feed1" as Id<"feeds">,
    postId: "post1" as Id<"posts">,
    sortTime: 123,
    publishedAt: null,
    discoveredAt: 123,
    readAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...fields,
  };
}

describe("homeFeedBucketEntries", () => {
  test("returns the unread aggregate key for unread items", () => {
    expect(homeFeedBucketEntries(homeFeedItem())).toEqual([
      {
        bucket: "unread",
        key: ["reader1", "unread", 123],
        id: "homeFeedItem1:unread",
      },
    ]);
  });

  test("returns the read aggregate key for read items", () => {
    expect(homeFeedBucketEntries(homeFeedItem({ readAt: 456 }))).toEqual([
      {
        bucket: "read",
        key: ["reader1", "read", 123],
        id: "homeFeedItem1:read",
      },
    ]);
  });

  test("includes secondary aggregate keys for saved and liked items", () => {
    expect(
      homeFeedBucketEntries(
        homeFeedItem({
          readLaterAt: 456,
          likedAt: 789,
        }),
      ),
    ).toEqual([
      {
        bucket: "unread",
        key: ["reader1", "unread", 123],
        id: "homeFeedItem1:unread",
      },
      {
        bucket: "readLater",
        key: ["reader1", "readLater", 123],
        id: "homeFeedItem1:readLater",
      },
      {
        bucket: "liked",
        key: ["reader1", "liked", 123],
        id: "homeFeedItem1:liked",
      },
    ]);
  });
});

describe("homeFeedAggregateId", () => {
  test("keeps aggregate ids scoped by bucket", () => {
    expect(
      homeFeedAggregateId("homeFeedItem1" as Id<"homeFeedItems">, "liked"),
    ).toBe("homeFeedItem1:liked");
  });
});
