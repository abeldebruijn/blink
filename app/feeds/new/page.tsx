"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { SignInButton, useUser } from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import { AlertCircle, CheckCircle2, Loader2, Rss, Sparkles } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BottomNav } from "@/app/_components/bottom-nav";

type Status = "pending" | "succeeded" | "failed" | null;

function statusLabel(status: Status) {
  if (status === "succeeded") {
    return "Done";
  }
  if (status === "failed") {
    return "Failed";
  }
  return "Pending";
}

function statusClass(status: Status) {
  if (status === "succeeded") {
    return "bg-[#dcefd8] text-[#265c2e]";
  }
  if (status === "failed") {
    return "bg-[#f4d8d2] text-[#8a2d1c]";
  }
  return "bg-white/14 text-white";
}

export default function AddFeedPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const ensureCurrentReader = useMutation(api.readers.ensureCurrent);
  const startInitialImport = useAction(api.feedImports.startInitialImport);
  const retryPost = useAction(api.feedImports.retryPost);
  const [submittedFeedUrl, setSubmittedFeedUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ensuredUserId, setEnsuredUserId] = useState<string | null>(null);
  const [retryingPostId, setRetryingPostId] = useState<string | null>(null);
  const userId = user?.id;

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

  const readerReady = isSignedIn === true && ensuredUserId === userId;
  const latestRun = useQuery(
    api.feedImports.latestForCurrentReader,
    readerReady ? {} : "skip",
  );
  const runPosts = useQuery(
    api.feedImports.listRunPosts,
    latestRun?._id !== undefined ? { feedImportRunId: latestRun._id, limit: 20 } : "skip",
  );

  const progress = useMemo(() => {
    if (latestRun === null || latestRun === undefined) {
      return null;
    }
    const finished = latestRun.completedCount + latestRun.failedCount;
    return {
      finished,
      pending: Math.max(0, latestRun.importCount - finished),
    };
  }, [latestRun]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await startInitialImport({ submittedFeedUrl });
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
      await retryPost({ postId });
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

  return (
    <main
      className="min-h-screen bg-[#101418] text-white"
      style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
    >
      <section className="relative mx-auto flex min-h-screen w-full max-w-[680px] flex-col overflow-hidden bg-[#101418] px-5 pb-28">
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#22312d_0%,#171717_48%,#4b3327_100%)]" />
        <div className="absolute inset-0 bg-linear-to-b from-black/16 via-black/20 to-black/84" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.14),transparent_28%),linear-gradient(90deg,rgba(0,0,0,0.46),transparent_46%)]" />
        <header className="fixed left-1/2 top-0 z-50 flex w-full max-w-[680px] -translate-x-1/2 items-center justify-between border-b border-white/5 bg-[#101418]/60 p-5 backdrop-blur-md">
          <h1 className="text-3xl font-black italic leading-none text-white">Add Feed</h1>
        </header>

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
                <button className="h-12 rounded-full bg-white px-5 text-sm font-black text-[#101418] transition hover:bg-white/90">
                  Sign in
                </button>
              </SignInButton>
            </section>
          ) : (
            <>
              <form
                onSubmit={onSubmit}
                className="grid gap-3 rounded-[8px] border border-white/10 bg-white/10 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur"
              >
                <label
                  htmlFor="submitted-feed-url"
                  className="text-sm font-black"
                >
                  Submitted Feed URL
                </label>
                <input
                  id="submitted-feed-url"
                  type="url"
                  required
                  value={submittedFeedUrl}
                  onChange={(event) => setSubmittedFeedUrl(event.target.value)}
                  placeholder="https://example.com/feed.xml"
                  className="h-12 rounded-[8px] border border-white/12 bg-black/24 px-4 text-base font-semibold text-white outline-none transition placeholder:text-white/42 focus:border-white/70"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm leading-6 text-white/68">
                    Direct RSS or Atom URLs only. Website discovery comes later.
                  </p>
                  <button
                    type="submit"
                    disabled={isSubmitting || !readerReady}
                    className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-[#101418] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {isSubmitting ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="size-4" aria-hidden="true" />
                    )}
                    Import
                  </button>
                </div>
                {submitError !== null ? (
                  <p className="flex items-start gap-2 rounded-[8px] bg-[#f4d8d2] p-3 text-sm font-bold leading-6 text-[#8a2d1c]">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {submitError}
                  </p>
                ) : null}
              </form>

              {latestRun !== undefined && latestRun !== null ? (
                <section className="grid gap-4 rounded-[8px] border border-white/10 bg-white/10 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur">
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid gap-1">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/58">
                        Latest Feed
                      </p>
                      <h2 className="text-2xl font-black leading-tight">
                        {latestRun.feedTitle}
                      </h2>
                      <p className="break-all text-sm font-semibold text-white/68">
                        {latestRun.canonicalFeedUrl}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#dcefd8] px-3 py-1 text-xs font-black text-[#265c2e]">
                      {latestRun.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Metric label="Discovered" value={latestRun.discoveredCount} />
                    <Metric label="Imported" value={latestRun.importCount} />
                    <Metric label="Done" value={latestRun.completedCount} />
                    <Metric label="Failed" value={latestRun.failedCount} />
                  </div>

                  {progress !== null ? (
                    <div className="h-2 overflow-hidden rounded-full bg-white/12">
                      <div
                        className="h-full rounded-full bg-white transition-all"
                        style={{
                          width: `${Math.round(
                            (progress.finished / Math.max(1, latestRun.importCount)) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                  ) : null}

                  <div className="grid gap-3">
                    <h3 className="text-sm font-black">Recent Posts</h3>
                    {runPosts === undefined ? (
                      <div className="flex items-center gap-2 text-sm font-bold text-white/68">
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        Loading Posts
                      </div>
                    ) : runPosts.length === 0 ? (
                      <p className="text-sm font-semibold text-white/68">
                        Posts will appear as soon as the Initial Import starts.
                      </p>
                    ) : (
                      runPosts.map((post) => (
                        <article
                          key={post._id}
                          className="grid gap-3 border-t border-white/10 pt-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h4 className="text-base font-black leading-5">
                              {post.title}
                            </h4>
                            {post.abstractStatus === "succeeded" ? (
                              <CheckCircle2
                                className="size-5 shrink-0 text-[#265c2e]"
                                aria-hidden="true"
                              />
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <StatusPill
                              label={`Firecrawl ${statusLabel(post.firecrawlStatus)}`}
                              status={post.firecrawlStatus}
                            />
                            <StatusPill
                              label={`Abstract ${statusLabel(post.abstractStatus)}`}
                              status={post.abstractStatus}
                            />
                            {post.firecrawlStatus === "failed" ||
                            post.abstractStatus === "failed" ? (
                              <button
                                type="button"
                                onClick={() => void onRetryPost(post._id)}
                                disabled={retryingPostId === post._id}
                                className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-black text-[#101418] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-55"
                              >
                                {retryingPostId === post._id ? (
                                  <Loader2
                                    className="size-3.5 animate-spin"
                                    aria-hidden="true"
                                  />
                                ) : null}
                                Retry
                              </button>
                            ) : null}
                          </div>
                          {post.abstract !== null ? (
                            <p className="text-sm leading-6 text-white/72">
                              {post.abstract}
                            </p>
                          ) : null}
                        </article>
                      ))
                    )}
                  </div>
                </section>
              ) : (
                <section className="grid justify-items-center gap-3 rounded-[8px] border border-dashed border-white/18 bg-white/6 p-8 text-center backdrop-blur">
                  <Rss className="size-7 text-white/72" aria-hidden="true" />
                  <p className="max-w-[24rem] text-sm font-semibold leading-6 text-white/68">
                    Submit a Feed to see how many Posts Blink found and watch
                    Firecrawl extraction and Abstract generation run.
                  </p>
                </section>
              )}
            </>
          )}
        </div>

        <BottomNav variant="dark" />
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] bg-white/12 p-3">
      <p className="text-2xl font-black leading-none">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-white/58">
        {label}
      </p>
    </div>
  );
}

function StatusPill({ label, status }: { label: string; status: Status }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(status)}`}>
      {label}
    </span>
  );
}
