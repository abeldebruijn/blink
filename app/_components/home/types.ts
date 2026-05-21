import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

export type HomeFeedItems = FunctionReturnType<typeof api.homeFeed.list>;
export type HomeFeedItem = HomeFeedItems[number];
export type HomeFeedFilter = "unread" | "read" | "saved" | "liked";

export const feedFilterLabels: Record<HomeFeedFilter, string> = {
  unread: "Unread",
  read: "Read",
  saved: "Saved for later",
  liked: "Liked",
};
