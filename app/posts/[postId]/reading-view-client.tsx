"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Bookmark,
  Clock,
  ExternalLink,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { BottomNav } from "@/app/_components/bottom-nav";
import { siteHost } from "@/app/_components/home/feed-utils";
import { MarkdownContent } from "./markdown-content";

export function ReadingViewClient({ postId }: { postId: string }) {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const ensureCurrentReader = useMutation(api.readers.ensureCurrent);
  const markRead = useMutation(api.homeFeed.markRead);
  const toggleReadLater = useMutation(api.homeFeed.toggleReadLater);
  const markedReadItemId = useRef<string | null>(null);
  const [ensuredUserId, setEnsuredUserId] = useState<string | null>(null);
  const [readerErrorUserId, setReaderErrorUserId] = useState<string | null>(
    null,
  );
  const [isUpdatingReadLater, setIsUpdatingReadLater] = useState(false);
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    if (!isSignedIn || userId === undefined) {
      router.replace("/");
      return;
    }

    let cancelled = false;
    void ensureCurrentReader({})
      .then(() => {
        if (!cancelled) {
          setEnsuredUserId(userId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReaderErrorUserId(userId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ensureCurrentReader, isLoaded, isSignedIn, router, userId]);

  const readerReady = isSignedIn === true && ensuredUserId === userId;
  const readerError = isSignedIn === true && readerErrorUserId === userId;
  const readingView = useQuery(
    api.homeFeed.getReadingView,
    readerReady ? { postId } : "skip",
  );

  useEffect(() => {
    if (readerError) {
      router.replace("/");
    }
  }, [readerError, router]);

  useEffect(() => {
    if (readingView === null) {
      router.replace("/");
      return;
    }

    if (readingView === undefined) {
      return;
    }

    const content = readingView.firecrawlPageContent?.trim() ?? "";
    if (content === "") {
      window.location.replace(readingView.canonicalUrl);
      return;
    }

    if (
      !readingView.isRead &&
      markedReadItemId.current !== readingView.homeFeedItemId
    ) {
      markedReadItemId.current = readingView.homeFeedItemId;
      void markRead({ homeFeedItemId: readingView.homeFeedItemId, read: true });
    }
  }, [markRead, readingView, router]);

  const handleToggleReadLater = async () => {
    if (!readingView) return;
    setIsUpdatingReadLater(true);
    try {
      await toggleReadLater({
        homeFeedItemId: readingView.homeFeedItemId,
        readLater: !readingView.isReadLater,
      });
    } catch (error) {
      console.error("Failed to toggle Read Later:", error);
    } finally {
      setIsUpdatingReadLater(false);
    }
  };

  const content = readingView?.firecrawlPageContent?.trim() ?? "";
  const host = useMemo(() => {
    if (readingView === undefined || readingView === null) {
      return null;
    }
    return siteHost(readingView.source.siteUrl ?? readingView.canonicalUrl);
  }, [readingView]);

  if (!isLoaded || !readerReady || readingView === undefined || content === "") {
    return <ReadingViewLoading />;
  }

  if (readingView === null) {
    return <ReadingViewLoading />;
  }

  return (
    <main
      className="min-h-screen bg-[#101418] text-white w-full overflow-x-hidden relative"
      style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(145deg,#22312d_0%,#171717_48%,#4b3327_100%)] pointer-events-none" />
      <div className="absolute inset-0 bg-linear-to-b from-black/16 via-black/20 to-black/84 pointer-events-none" />

      <div className="fixed left-1/2 top-0 z-50 w-full max-w-[680px] -translate-x-1/2 border-b border-white/5 bg-[#101418]/60 backdrop-blur-md">
        <header className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => router.back()}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-white/8 text-white transition hover:bg-white/12 focus:outline-none focus:ring-2 focus:ring-white/30"
            aria-label="Back"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
          <p
            className="min-w-0 truncate text-xs font-black uppercase text-white/58"
            style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
          >
            {readingView.source.title}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleReadLater}
              disabled={isUpdatingReadLater}
              className={`grid size-10 place-items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-white/30 ${
                readingView.isReadLater
                  ? "bg-[#d8ef7f] text-[#101418] hover:bg-[#d8ef7f]/90"
                  : "bg-white/8 text-white hover:bg-white/12"
              }`}
              aria-label={
                readingView.isReadLater
                  ? "In Read Later"
                  : "Add to Read Later"
              }
              title={
                readingView.isReadLater
                  ? "In Read Later"
                  : "Add to Read Later"
              }
            >
              <Bookmark
                className={`size-5 ${
                  readingView.isReadLater ? "fill-current" : ""
                }`}
                aria-hidden="true"
              />
            </button>
            <a
              href={readingView.canonicalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3 text-xs font-black text-[#101418] transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/30"
              style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
            >
              Original
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        </header>
      </div>

      <article className="relative z-10 mx-auto w-full max-w-[680px] px-5 pb-36 pt-24 sm:px-8 sm:pt-28 break-words">
        <header className="mb-10 grid gap-5 border-b border-white/10 pb-8">
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-black uppercase text-[#d8ef7f]"
            style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
          >
            {host !== null ? <span>{host}</span> : null}
            <span className="inline-flex items-center gap-1.5 text-white/52">
              <Clock className="size-3.5" aria-hidden="true" />
              {postDateLabel(readingView.publishedAt ?? readingView.discoveredAt)}
            </span>
          </div>
          <h1
            className="text-[32px] font-black leading-[1.05] tracking-normal sm:text-[46px] break-words text-white"
            style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
          >
            {readingView.title}
          </h1>
        </header>

        <MarkdownContent markdown={content} baseUrl={readingView.canonicalUrl} />

        <div className="mt-16 flex flex-col items-center justify-center gap-4 border-t border-white/10 pt-8 sm:flex-row sm:justify-between">
          <p className="text-sm font-black uppercase tracking-wider text-white/50" style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}>
            Was this post helpful?
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFeedback(feedback === "like" ? null : "like")}
              className={`flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-black uppercase tracking-wider transition duration-200 active:scale-95 ${
                feedback === "like"
                  ? "border-[#d8ef7f]/30 bg-[#d8ef7f]/12 text-[#d8ef7f] shadow-[0_0_20px_rgba(216,239,127,0.15)]"
                  : "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20"
              }`}
              style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
            >
              <ThumbsUp className={`size-4 ${feedback === "like" ? "fill-current" : ""}`} />
              Like
            </button>
            <button
              type="button"
              onClick={() => setFeedback(feedback === "dislike" ? null : "dislike")}
              className={`flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-black uppercase tracking-wider transition duration-200 active:scale-95 ${
                feedback === "dislike"
                  ? "border-red-500/30 bg-red-500/12 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
                  : "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20"
              }`}
              style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
            >
              <ThumbsDown className={`size-4 ${feedback === "dislike" ? "fill-current" : ""}`} />
              Dislike
            </button>
          </div>
        </div>
      </article>

      <BottomNav variant="dark" />
    </main>
  );
}

function ReadingViewLoading() {
  return (
    <main
      className="min-h-screen bg-[#101418] text-white w-full overflow-x-hidden relative"
      style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(145deg,#22312d_0%,#171717_48%,#4b3327_100%)] pointer-events-none" />
      <div className="absolute inset-0 bg-linear-to-b from-black/16 via-black/20 to-black/84 pointer-events-none" />

      <section className="relative z-10 mx-auto grid min-h-screen w-full max-w-[680px] content-center gap-5 px-6">
        <div className="h-4 w-28 animate-pulse rounded-full bg-white/14" />
        <div className="grid gap-3">
          <div className="h-12 w-11/12 animate-pulse rounded-[8px] bg-white/18" />
          <div className="h-12 w-7/12 animate-pulse rounded-[8px] bg-white/18" />
        </div>
        <div className="grid gap-2 pt-3">
          <div className="h-4 w-full animate-pulse rounded-full bg-white/12" />
          <div className="h-4 w-10/12 animate-pulse rounded-full bg-white/12" />
          <div className="h-4 w-8/12 animate-pulse rounded-full bg-white/12" />
        </div>
      </section>
    </main>
  );
}

function postDateLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
