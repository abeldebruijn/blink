"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SignInButton, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { Bookmark, Clock, ExternalLink, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BottomNav } from "@/app/_components/bottom-nav";
import { siteHost } from "@/app/_components/home/feed-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function postDateLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ReadLaterPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const ensureCurrentReader = useMutation(api.readers.ensureCurrent);
  const toggleReadLater = useMutation(api.homeFeed.toggleReadLater);
  const [ensuredUserId, setEnsuredUserId] = useState<string | null>(null);
  const [readerErrorUserId, setReaderErrorUserId] = useState<string | null>(
    null,
  );
  const [pendingRemove, setPendingRemove] = useState<{
    homeFeedItemId: Id<"homeFeedItems">;
    title: string;
  } | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!isLoaded || !isSignedIn || userId === undefined) {
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
  }, [ensureCurrentReader, isLoaded, isSignedIn, userId]);

  const readerReady = isSignedIn === true && ensuredUserId === userId;
  const readerError = isSignedIn === true && readerErrorUserId === userId;
  const readLaterItems = useQuery(
    api.homeFeed.listReadLater,
    readerReady ? {} : "skip",
  );

  const isLoading =
    !isLoaded ||
    (!readerError && isSignedIn === true && readLaterItems === undefined);

  async function onRemove(homeFeedItemId: Id<"homeFeedItems">) {
    try {
      await toggleReadLater({ homeFeedItemId, readLater: false });
      setPendingRemove(null);
    } catch (err) {
      console.error("Failed to remove Read Later item:", err);
    }
  }

  if (!isLoaded || isLoading) {
    return <ReadLaterShell />;
  }

  if (!isSignedIn) {
    return (
      <ReadLaterShell>
        <section className="grid justify-items-center gap-4 py-28 text-center">
          <div className="grid size-16 place-items-center rounded-full bg-white/14">
            <Bookmark className="size-7" aria-hidden="true" />
          </div>
          <div className="grid max-w-[25rem] gap-3">
            <h2 className="text-3xl font-black leading-none">
              Sign in to view Read Later
            </h2>
            <p className="text-base leading-7 text-white/72">
              Read Later belongs to authenticated Readers.
            </p>
          </div>
          <SignInButton mode="modal">
            <button className="h-12 rounded-full bg-white px-5 text-sm font-black text-[#101418] transition hover:bg-white/90">
              Sign in
            </button>
          </SignInButton>
        </section>
      </ReadLaterShell>
    );
  }

  if (readerError) {
    return (
      <ReadLaterShell>
        <EmptyMessage
          title="Read Later unavailable"
          body="Blink could not prepare this Reader's Read Later list."
        />
      </ReadLaterShell>
    );
  }

  return (
    <ReadLaterShell>
      <div className="grid gap-5">
        <h2 className="text-xl font-black uppercase tracking-[0.14em] text-white/60">
          Read Later ({readLaterItems?.length ?? 0})
        </h2>

        {readLaterItems && readLaterItems.length === 0 ? (
          <EmptyMessage
            title="Your queue is empty"
            body="Add Posts to Read Later when you want to return to them."
          />
        ) : (
          <div className="grid gap-3">
            {readLaterItems?.map((item) => {
              const host = siteHost(item.source.siteUrl ?? item.canonicalUrl);
              return (
                <article
                  key={item._id}
                  className="grid gap-3 rounded-[8px] border border-white/10 bg-white/10 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur transition hover:border-white/20"
                >
                  <div className="grid grid-cols-[1fr_auto] items-start gap-4">
                    <div className="grid gap-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 text-xs font-black uppercase text-[#d8ef7f]">
                        {host !== null ? <span>{host}</span> : null}
                        <span className="inline-flex items-center gap-1 text-white/50">
                          <Clock className="size-3" aria-hidden="true" />
                          {postDateLabel(item.publishedAt ?? item.discoveredAt)}
                        </span>
                      </div>
                      <Link href={`/posts/${item.postId}`} className="group">
                        <h3 className="text-base font-black leading-tight text-white group-hover:text-[#d8ef7f] transition duration-150 break-words">
                          {item.title}
                        </h3>
                      </Link>
                    </div>

                    <button
                      type="button"
                      title="Remove from Read Later"
                      aria-label="Remove from Read Later"
                      onClick={() =>
                        setPendingRemove({
                          homeFeedItemId: item._id,
                          title: item.title,
                        })
                      }
                      className="grid size-9 place-items-center rounded-full bg-white/12 text-white hover:bg-red-500/20 hover:text-red-400 transition"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  {item.abstract !== null && item.abstract.trim() !== "" ? (
                    <p className="line-clamp-3 text-xs leading-5 text-white/70 font-medium">
                      {item.abstract}
                    </p>
                  ) : null}

                  <div className="flex gap-3 pt-1">
                    <Link
                      href={`/posts/${item.postId}`}
                      className="inline-flex h-8 items-center rounded-full bg-white px-3 text-xs font-black text-[#101418] transition hover:bg-white/90"
                    >
                      Read post
                    </Link>
                    <a
                      href={item.canonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-full bg-white/12 px-3 text-xs font-black text-white transition hover:bg-white/20"
                    >
                      Original
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      <AlertDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRemove(null);
          }
        }}
      >
        <AlertDialogContent className="border border-white/10 bg-[#151a1f] text-white shadow-2xl shadow-black/40">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Read Later?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/68">
              This Post will leave your Read Later list. It will still be
              available from the Home Feed if it matches the current filters.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingRemove !== null ? (
            <p className="line-clamp-2 rounded-[8px] bg-white/8 px-3 py-2 text-sm font-bold text-white/86">
              {pendingRemove.title}
            </p>
          ) : null}
          <AlertDialogFooter className="border-white/10 bg-white/[0.03]">
            <AlertDialogCancel className="border-white/12 bg-white/8 text-white hover:bg-white/14">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500/16 text-red-200 hover:bg-red-500/24"
              onClick={() => {
                if (pendingRemove !== null) {
                  void onRemove(pendingRemove.homeFeedItemId);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ReadLaterShell>
  );
}

function ReadLaterShell({ children }: { children?: React.ReactNode }) {
  return (
    <main
      className="min-h-screen bg-[#101418] text-white"
      style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
    >
      <section className="relative mx-auto flex min-h-screen w-full max-w-[680px] flex-col overflow-hidden bg-[#101418] px-5 pb-28">
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#22312d_0%,#171717_48%,#4b3327_100%)]" />
        <div className="absolute inset-0 bg-linear-to-b from-black/16 via-black/20 to-black/84" />
        <header className="fixed left-1/2 top-0 z-50 flex w-full max-w-[680px] -translate-x-1/2 items-center border-b border-white/5 bg-[#101418]/60 px-4 py-3 backdrop-blur-md sm:p-5">
          <Link
            href="/"
            className="text-2xl font-black italic leading-none text-white sm:text-3xl"
          >
            Blink
          </Link>
        </header>
        <div className="relative z-10 grid flex-1 content-start gap-5 pt-24">
          {children ?? <LoadingSkeleton />}
        </div>
        <BottomNav variant="dark" />
      </section>
    </main>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-32 animate-pulse rounded-[8px] border border-white/10 bg-white/10"
        />
      ))}
    </div>
  );
}

function EmptyMessage({ title, body }: { title: string; body: string }) {
  return (
    <section className="grid justify-items-center gap-4 py-24 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-white/14">
        <Bookmark className="size-7" aria-hidden="true" />
      </div>
      <div className="grid max-w-[25rem] gap-3">
        <h2 className="text-3xl font-black leading-none">{title}</h2>
        <p className="text-base leading-7 text-white/72">{body}</p>
      </div>
    </section>
  );
}
