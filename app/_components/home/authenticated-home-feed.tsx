import Link from "next/link";
import { Loader2, Plus, Rss } from "lucide-react";
import { BottomNav } from "../bottom-nav";
import { HomeFeedStoryDeck } from "./home-feed-story-deck";
import type { HomeFeedItems } from "./types";

export function AuthenticatedHomeFeed({
  homeFeed,
  readerReady,
  readerError,
}: {
  homeFeed: HomeFeedItems | undefined;
  readerReady: boolean;
  readerError: boolean;
}) {
  const isLoading = !readerError && (!readerReady || homeFeed === undefined);
  const hasPosts = (homeFeed?.length ?? 0) > 0;

  return (
    <main
      className={`min-h-screen ${
        hasPosts ? "bg-[#101418] text-white" : "bg-[#f7f3ec] text-[#171717]"
      }`}
      style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
    >
      <section
        className={`mx-auto flex min-h-screen w-full max-w-[680px] flex-col ${
          hasPosts ? "bg-[#101418]" : "px-5 pb-28 pt-5"
        }`}
      >
        {!hasPosts ? (
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black italic leading-none">Blink</h1>
            </div>
          </header>
        ) : null}

        <div
          className={
            hasPosts
              ? "min-h-screen flex-1"
              : "flex flex-1 items-center justify-center py-14"
          }
        >
          {isLoading ? (
            <div className="grid justify-items-center gap-3 text-[#6f675d]">
              <Loader2 className="size-6 animate-spin" aria-hidden="true" />
              <p className="text-sm font-bold">Loading Home Feed</p>
            </div>
          ) : readerError ? (
            <div className="grid max-w-[27rem] justify-items-center gap-3 text-center">
              <div className="grid size-16 place-items-center rounded-full bg-[#171717] text-white">
                <Rss className="size-7" aria-hidden="true" />
              </div>
              <h2 className="text-3xl font-black leading-none tracking-normal">
                Home Feed unavailable
              </h2>
              <p className="text-base leading-7 text-[#5d554b]">
                Blink could not prepare this Reader&apos;s Home Feed.
              </p>
            </div>
          ) : hasPosts ? (
            <HomeFeedStoryDeck items={homeFeed ?? []} />
          ) : (
            <section
              aria-labelledby="empty-home-feed-title"
              className="grid w-full justify-items-center gap-5 text-center"
            >
              <div className="grid size-16 place-items-center rounded-full bg-[#171717] text-white">
                <Rss className="size-7" aria-hidden="true" />
              </div>
              <div className="grid max-w-[27rem] gap-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a3d16]">
                  Empty Home Feed
                </p>
                <h2
                  id="empty-home-feed-title"
                  className="text-4xl font-black leading-none tracking-normal"
                >
                  No Posts yet
                </h2>
                <p className="text-base leading-7 text-[#5d554b]">
                  This Reader has no Home Feed Items because there are no Feed
                  Subscriptions yet. Add a Feed to start receiving Posts in the
                  Home Feed.
                </p>
              </div>
              <Link
                href="/feeds/new"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[#171717] px-5 text-sm font-black text-white transition hover:bg-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-[#171717] focus:ring-offset-2 focus:ring-offset-[#f7f3ec]"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add Feed
              </Link>
            </section>
          )}
        </div>

        <BottomNav variant={hasPosts ? "dark" : "light"} />
      </section>
    </main>
  );
}
