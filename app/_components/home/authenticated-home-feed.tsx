import Link from "next/link";
import { Plus, Rss } from "lucide-react";
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
  const useFeedTheme = isLoading || hasPosts;

  return (
    <main
      className={`min-h-screen ${
        useFeedTheme ? "bg-[#101418] text-white" : "bg-[#f7f3ec] text-[#171717]"
      }`}
      style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
    >
      <section
        className={`mx-auto flex min-h-screen w-full max-w-[680px] flex-col ${
          useFeedTheme ? "bg-[#101418]" : "px-5 pb-28 pt-5"
        }`}
      >
        {!useFeedTheme ? (
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black italic leading-none">Blink</h1>
            </div>
          </header>
        ) : null}

        <div
          className={
            useFeedTheme
              ? "min-h-screen flex-1"
              : "flex flex-1 items-center justify-center py-14"
          }
        >
          {isLoading ? (
            <HomeFeedLoadingSkeleton />
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

        <BottomNav variant={useFeedTheme ? "dark" : "light"} />
      </section>
    </main>
  );
}

function HomeFeedLoadingSkeleton() {
  return (
    <section
      aria-label="Loading Home Feed"
      className="relative h-screen overflow-hidden bg-[#101418]"
    >
      <div className="absolute inset-0 bg-[linear-gradient(145deg,#22312d_0%,#171717_48%,#4b3327_100%)]" />
      <div className="absolute inset-0 bg-linear-to-b from-black/16 via-black/20 to-black/84" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.14),transparent_28%),linear-gradient(90deg,rgba(0,0,0,0.46),transparent_46%)]" />

      <header className="fixed left-1/2 top-0 z-50 flex w-full max-w-[680px] -translate-x-1/2 items-center justify-between border-b border-white/5 bg-[#101418]/60 p-5 backdrop-blur-md">
        <h1 className="text-3xl font-black italic leading-none text-white">
          Blink
        </h1>
        <div className="h-9 w-28 animate-pulse rounded-full bg-white/14" />
      </header>

      <div className="relative z-10 grid h-dvh content-end gap-4 px-5 pb-[calc(env(safe-area-inset-bottom)+7.25rem)] pr-24 pt-24 sm:pb-36">
        <div className="h-[clamp(10rem,30vh,22rem)] animate-pulse rounded-[18px] border border-white/12 bg-white/12 shadow-2xl shadow-black/30" />
        <div className="flex gap-2">
          <div className="h-6 w-24 animate-pulse rounded-full bg-white/16" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-white/16" />
        </div>
        <div className="grid gap-3">
          <div className="h-9 w-11/12 animate-pulse rounded-[8px] bg-white/18" />
          <div className="h-9 w-7/12 animate-pulse rounded-[8px] bg-white/18" />
          <div className="h-4 w-44 animate-pulse rounded-full bg-white/14" />
        </div>
        <div className="grid gap-2">
          <div className="h-3 w-full animate-pulse rounded-full bg-white/12" />
          <div className="h-3 w-10/12 animate-pulse rounded-full bg-white/12" />
          <div className="h-3 w-8/12 animate-pulse rounded-full bg-white/12" />
        </div>
        <div className="flex gap-3 pt-1">
          <div className="h-11 w-20 animate-pulse rounded-full bg-white/90" />
          <div className="h-11 w-24 animate-pulse rounded-full bg-white/14" />
        </div>
      </div>
    </section>
  );
}
