import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

export type HomeFeedData = FunctionReturnType<typeof api.homeFeed.list>;
export type HomeFeedItems = HomeFeedData["items"];
export type HomeFeedItem = HomeFeedData["items"][number];
export type HomeFeedFilter = "unread" | "read" | "readLater" | "liked";

export const feedFilterLabels: Record<HomeFeedFilter, string> = {
  unread: "Unread",
  read: "Read",
  readLater: "Read Later",
  liked: "Liked",
};
