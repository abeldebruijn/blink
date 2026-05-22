import type { FunctionReturnType } from "convex/server";
import type { PaginationStatus } from "convex/react";
import { api } from "@/convex/_generated/api";

export type HomeFeedPage = FunctionReturnType<typeof api.homeFeed.listPage>;
export type HomeFeedCounts = FunctionReturnType<typeof api.homeFeed.counts>;
export type HomeFeedTags = FunctionReturnType<typeof api.homeFeed.listTags>;
export type HomeFeedItems = HomeFeedPage["page"];
export type HomeFeedItem = HomeFeedItems[number];
export type HomeFeedPaginationStatus = PaginationStatus;
export type HomeFeedFilter = "unread" | "read" | "readLater" | "liked";

export const feedFilterLabels: Record<HomeFeedFilter, string> = {
  unread: "Unread",
  read: "Read",
  readLater: "Read Later",
  liked: "Liked",
};
