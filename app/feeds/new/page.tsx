"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { SignInButton, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { AlertCircle, Loader2, Rss, Circle, Check } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BottomNav } from "@/app/_components/bottom-nav";

type Status = "pending" | "succeeded" | "failed" | null;

// Combobox URL autocomplete component
function FeedCombobox({
  value,
  onChange,
  suggestions,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  suggestions: Array<{
    title: string;
    canonicalFeedUrl: string;
    siteUrl: string | null;
  }>;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const filtered = useMemo(() => {
    if (!value.trim()) return [];
    const queryStr = value.toLowerCase().trim();
    return suggestions
      .filter(
        (s) =>
          s.canonicalFeedUrl.toLowerCase().includes(queryStr) ||
          s.title.toLowerCase().includes(queryStr),
      )
      .slice(0, 5);
  }, [value, suggestions]);

  const showDropdown = isOpen && filtered.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(
        (prev) => (prev - 1 + filtered.length) % filtered.length,
      );
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        e.preventDefault();
        onChange(filtered[highlightedIndex].canonicalFeedUrl);
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div className="relative w-full">
      <input
        id="submitted-feed-url"
        type="url"
        required
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
          setHighlightedIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          // Delay to allow item click
          setTimeout(() => setIsOpen(false), 200);
        }}
        onKeyDown={handleKeyDown}
        placeholder="https://example.com/feed.xml"
        disabled={disabled}
        className="h-12 w-full rounded-[8px] border border-white/12 bg-black/24 px-4 text-base font-semibold text-white outline-none transition placeholder:text-white/42 focus:border-white/70"
      />
      {showDropdown && (
        <ul className="absolute left-0 right-0 top-full z-[100] mt-1.5 max-h-60 overflow-y-auto rounded-[8px] border border-white/10 bg-[#161c22] p-1 shadow-2xl backdrop-blur-md">
          {filtered.map((item, index) => (
            <li key={item.canonicalFeedUrl}>
              <button
                type="button"
                onMouseDown={() => {
                  onChange(item.canonicalFeedUrl);
                  setIsOpen(false);
                  setHighlightedIndex(-1);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`flex w-full flex-col gap-0.5 rounded-[6px] px-3 py-2 text-left transition ${
                  highlightedIndex === index
                    ? "bg-white/12 text-white"
                    : "text-white/86 hover:bg-white/6"
                }`}
              >
                <span className="text-sm font-black truncate">
                  {item.title}
                </span>
                <span className="text-xs text-white/50 truncate">
                  {item.canonicalFeedUrl}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type BatchInfo = {
  index: number;
  posts: Array<{
    _id: Id<"posts">;
    title: string;
    canonicalUrl: string;
    publishedAt: number | null;
    firecrawlStatus: Status;
    abstractStatus: Status;
    abstract: string | null;
    firecrawlError: string | null;
    abstractError: string | null;
  }>;
  status: "completed" | "processing" | "queued" | "failed";
  completedCount: number;
  failedCount: number;
  total: number;
};

function IngestionHeader({
  latestRun,
  hideNotice = false,
}: {
  latestRun: {
    feedTitle: string;
    canonicalFeedUrl: string;
    completedCount: number;
    failedCount: number;
    importCount: number;
  };
  hideNotice?: boolean;
}) {
  const totalProcessed = latestRun.completedCount + latestRun.failedCount;
  const totalCount = Math.max(1, latestRun.importCount);
  const percent = Math.min(
    100,
    Math.round((totalProcessed / totalCount) * 100),
  );

  // Circular progress: radius = 18, circumference = 2 * PI * 18 ≈ 113.1
  const radius = 18;
  const strokeWidth = 3.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="space-y-4">
      {/* Target Feed & Progress Card */}
      <div className="relative flex items-center justify-between gap-4 rounded-[12px] border border-white/10 bg-white/5 p-4 backdrop-blur shadow-md">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-black text-white truncate leading-tight">
            {latestRun.feedTitle || "Importing Feed..."}
          </h2>
          <p className="text-xs text-white/50 truncate font-semibold mt-1">
            {latestRun.canonicalFeedUrl}
          </p>
        </div>

        {/* Circular Progress Ring */}
        <div className="relative size-12 shrink-0 flex items-center justify-center">
          <svg className="absolute inset-0 size-full -rotate-90">
            <circle
              cx="24"
              cy="24"
              r={radius}
              fill="transparent"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={strokeWidth}
            />
            <circle
              cx="24"
              cy="24"
              r={radius}
              fill="transparent"
              stroke="#d8ef7f"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          </svg>
          <span className="text-[10px] font-black text-white">{percent}%</span>
        </div>
      </div>

      {/* Background Processing Notice Banner */}
      {!hideNotice && (
        <div className="relative overflow-hidden rounded-[12px] border border-white/10 bg-white/5 p-3.5 backdrop-blur shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent opacity-30" />
          <div className="relative flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex size-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
              </span>
              <p className="text-xs font-semibold text-white/80 leading-snug">
                Import is running in the background. You can safely leave this
                page and continue reading your feed.
              </p>
            </div>
            <Link
              href="/"
              className="text-[10px] shrink-0 font-black uppercase tracking-wider text-[#d8ef7f] hover:text-[#e7f7a3] transition active:scale-95 px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10"
            >
              Go to Feed →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AddFeedPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const ensureCurrentReader = useMutation(api.readers.ensureCurrent);
  const [submittedFeedUrl, setSubmittedFeedUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ensuredUserId, setEnsuredUserId] = useState<string | null>(null);
  const [retryingPostId, setRetryingPostId] = useState<string | null>(null);

  const userId = user?.id;

  // Autocomplete Suggestions from database
  const readerReady = isSignedIn === true && ensuredUserId === userId;
  const dbFeeds = useQuery(
    api.feedSubscriptions.listAllFeeds,
    readerReady ? {} : "skip",
  );
  const suggestions = useMemo(() => dbFeeds ?? [], [dbFeeds]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || userId === undefined) {
      return;
    }

    let cancelled = false;
    void ensureCurrentReader({}).then(() => {
      if (!cancelled) {
        setEnsuredUserId(userId);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ensureCurrentReader, isLoaded, isSignedIn, userId]);

  const latestRun = useQuery(
    api.feedImports.latestForCurrentReader,
    readerReady ? {} : "skip",
  );
  const runPosts = useQuery(
    api.feedImports.listRunPosts,
    latestRun?._id !== undefined
      ? { feedImportRunId: latestRun._id, limit: 20 }
      : "skip",
  );

  const isComplete = useMemo(() => {
    if (!latestRun) return false;
    const totalProcessed = latestRun.completedCount + latestRun.failedCount;
    const totalCount = Math.max(1, latestRun.importCount);
    return totalProcessed >= totalCount;
  }, [latestRun]);

  // Group runPosts chronologically and compute batch statuses (batches of 4)
  const chronologicalPosts = useMemo(() => {
    if (!runPosts) return [];
    return [...runPosts].reverse();
  }, [runPosts]);

  const batches = useMemo<BatchInfo[]>(() => {
    if (chronologicalPosts.length === 0) return [];
    const list: BatchInfo[] = [];
    const batchSize = 4;
    for (let i = 0; i < chronologicalPosts.length; i += batchSize) {
      const chunk = chronologicalPosts.slice(i, i + batchSize);
      const total = chunk.length;
      let completedCount = 0;
      let failedCount = 0;
      let pendingCount = 0;
      let failed = false;

      chunk.forEach((post) => {
        const isPending =
          post.firecrawlStatus === "pending" ||
          post.abstractStatus === "pending" ||
          (!post.firecrawlStatus && !post.abstractStatus);
        const isFailed =
          post.firecrawlStatus === "failed" || post.abstractStatus === "failed";
        if (isPending) {
          pendingCount++;
        } else if (isFailed) {
          failed = true;
          failedCount++;
        } else {
          completedCount++;
        }
      });

      let status: BatchInfo["status"] = "queued";
      if (pendingCount === 0) {
        status = failed ? "failed" : "completed";
      } else if (
        pendingCount < total ||
        list.every((b) => b.status === "completed" || b.status === "failed")
      ) {
        status = "processing";
      }

      list.push({
        index: list.length + 1,
        posts: chunk,
        status,
        completedCount,
        failedCount,
        total,
      });
    }

    // Adjust sequential queuing logic so only one batch is processing at a time
    let foundProcessing = false;
    return list.map((batch) => {
      if (batch.status === "processing") {
        if (foundProcessing) {
          return { ...batch, status: "queued" as const };
        }
        foundProcessing = true;
      }
      return batch;
    });
  }, [chronologicalPosts]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/feeds/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submittedFeedUrl }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Initial Import failed");
      }
      setSubmittedFeedUrl("");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Initial Import failed",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onRetryPost(postId: Id<"posts">) {
    setRetryingPostId(postId);
    setSubmitError(null);
    try {
      const response = await fetch("/api/posts/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Could not retry Post");
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not retry Post",
      );
    } finally {
      setRetryingPostId(null);
    }
  }

  if (!isLoaded) {
    return <main className="min-h-screen bg-[#101418]" />;
  }

  // Shared Sub-components to keep layouts DRY
  const importForm = (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="submitted-feed-url"
          className="text-sm font-black text-white/90"
        >
          Submitted Feed URL
        </label>
        <FeedCombobox
          value={submittedFeedUrl}
          onChange={setSubmittedFeedUrl}
          suggestions={suggestions}
          disabled={isSubmitting || !readerReady}
        />
      </div>
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs leading-5 text-white/60 max-w-[280px]">
          Direct RSS/Atom URLs only. Website discovery is in pipeline.
        </p>
        <button
          type="submit"
          disabled={isSubmitting || !readerReady}
          className="inline-flex h-10 shrink-0 items-center rounded-full bg-white px-5 text-xs font-black text-[#101418] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-55 cursor-pointer"
        >
          {isSubmitting ? "Importing..." : "Import feed"}
        </button>
      </div>
      {submitError !== null ? (
        <p className="flex items-start gap-2 rounded-[8px] bg-[#f4d8d2] p-3 text-xs font-bold leading-5 text-[#8a2d1c]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {submitError}
        </p>
      ) : null}
    </form>
  );

  const emptyState = (
    <section className="grid justify-items-center gap-3 rounded-[8px] border border-dashed border-white/18 bg-white/5 p-8 text-center backdrop-blur">
      <Rss className="size-7 text-white/72 animate-pulse" aria-hidden="true" />
      <p className="max-w-[24rem] text-sm font-semibold leading-6 text-white/68">
        Submit a Feed URL to trigger Vercel workflow processing. Watch the batch
        logs and posts stream in real time.
      </p>
    </section>
  );

  return (
    <main
      className="min-h-screen bg-[#101418] text-white"
      style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
    >
      <section className="relative mx-auto flex min-h-screen w-full max-w-[680px] flex-col overflow-hidden bg-[#101418] px-5 pb-28">
        {/* Sleek Gradient Overlay Backgrounds */}
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#22312d_0%,#171717_48%,#4b3327_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/16 via-black/20 to-black/84" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.14),transparent_28%),linear-gradient(90deg,rgba(0,0,0,0.46),transparent_46%)]" />

        {/* Global Page Header */}
        <header className="fixed left-1/2 top-0 z-50 flex w-full max-w-[680px] -translate-x-1/2 items-center justify-between border-b border-white/5 bg-[#101418]/60 p-5 backdrop-blur-md">
          <h1 className="text-3xl font-black italic leading-none text-white flex items-center gap-2">
            Add Feed
          </h1>
        </header>

        {/* Inner Content Grid */}
        <div className="relative z-10 grid flex-1 content-start gap-5 pt-24">
          {!isSignedIn ? (
            <section className="grid justify-items-center gap-4 py-20 text-center">
              <div className="grid size-16 place-items-center rounded-full bg-white/14 text-white backdrop-blur">
                <Rss className="size-7" aria-hidden="true" />
              </div>
              <div className="grid max-w-[25rem] gap-3">
                <h2 className="text-3xl font-black leading-none">
                  Sign in to add Feeds
                </h2>
                <p className="text-base leading-7 text-white/72">
                  Blink imports Posts for authenticated Readers only.
                </p>
              </div>
              <SignInButton mode="modal">
                <button className="h-12 rounded-full bg-white px-5 text-sm font-black text-[#101418] transition hover:bg-white/90 cursor-pointer">
                  Sign in
                </button>
              </SignInButton>
            </section>
          ) : (
            <>
              {/* Form card displayed on all variants */}
              <div className="grid gap-3 rounded-[8px] border border-white/10 bg-white/10 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur">
                {importForm}
              </div>

              {/* Progress Content Wrapper */}
              {latestRun !== undefined && latestRun !== null ? (
                <div className="space-y-6">
                  {/* Shared Ingestion Header with Circular Progress Ring & Background Notice */}
                  <IngestionHeader
                    latestRun={latestRun}
                    hideNotice={isComplete}
                  />

                  {/* Connected Joint Nodes Ingestion Timeline */}
                  <div className="space-y-6 pl-1">
                    {batches.map((batch) => (
                      <div key={batch.index} className="relative flex gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={`grid size-6 place-items-center rounded-full border text-xs transition-all duration-300 ${
                              batch.status === "completed"
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : batch.status === "failed"
                                  ? "bg-red-500/10 border-red-500/30 text-red-400"
                                  : batch.status === "processing"
                                    ? "bg-amber-400/20 border-amber-400/40 text-amber-300 animate-pulse"
                                    : "bg-white/5 border-white/10 text-white/30"
                            }`}
                          >
                            {batch.status === "completed" ? (
                              <Check className="size-3" />
                            ) : batch.status === "processing" ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Circle className="size-1.5 fill-current" />
                            )}
                          </div>
                          {batch.index < batches.length && (
                            <div className="w-0.5 grow bg-white/15 my-1 min-h-[40px]" />
                          )}
                        </div>
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {batch.posts.map((post) => (
                            <div
                              key={post._id}
                              className="flex items-center justify-between gap-2 rounded-[8px] bg-black/20 p-2.5 border border-white/5"
                            >
                              <span
                                className="truncate text-xs font-semibold text-white/80"
                                title={post.title}
                              >
                                {post.title}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {post.firecrawlStatus === "pending" ||
                                post.abstractStatus === "pending" ? (
                                  <Loader2 className="size-3 animate-spin text-amber-400" />
                                ) : post.firecrawlStatus === "failed" ||
                                  post.abstractStatus === "failed" ? (
                                  <button
                                    type="button"
                                    onClick={() => void onRetryPost(post._id)}
                                    disabled={retryingPostId === post._id}
                                    className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] hover:bg-white/20 font-black cursor-pointer text-red-400"
                                  >
                                    Retry
                                  </button>
                                ) : (
                                  <span className="size-1.5 rounded-full bg-emerald-500" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                emptyState
              )}
            </>
          )}
        </div>

        {/* Global Bottom Navigation bar */}
        <BottomNav variant="dark" />
      </section>
    </main>
  );
}
