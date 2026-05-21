"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SignInButton, useUser } from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  Check,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Rss,
  Search,
  Trash2,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BottomNav } from "@/app/_components/bottom-nav";

type EditingState =
  | { kind: "rename"; id: Id<"feedSubscriptions">; value: string }
  | { kind: "url"; id: Id<"feedSubscriptions">; value: string }
  | null;

function timeLabel(value: number | null) {
  if (value === null) {
    return "Never synced";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(value: string | null) {
  if (value === null) {
    return "No import";
  }
  return value[0]?.toUpperCase() + value.slice(1);
}

function feedHost(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

export default function AllFeedsPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const ensureCurrentReader = useMutation(api.readers.ensureCurrent);
  const renameFeedSubscription = useMutation(
    api.feedSubscriptions.renameFeedSubscription,
  );
  const unsubscribeFromFeed = useMutation(
    api.feedSubscriptions.unsubscribeFromFeed,
  );
  const manualRefreshFeed = useAction(api.feedSubscriptions.manualRefreshFeed);
  const replaceFeedSubscriptionUrl = useAction(
    api.feedSubscriptions.replaceFeedSubscriptionUrl,
  );
  const [ensuredUserId, setEnsuredUserId] = useState<string | null>(null);
  const [readerErrorUserId, setReaderErrorUserId] = useState<string | null>(
    null,
  );
  const [editing, setEditing] = useState<EditingState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
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
  const subscriptions = useQuery(
    api.feedSubscriptions.listForCurrentReader,
    readerReady ? {} : "skip",
  );
  const isLoading =
    !isLoaded ||
    (!readerError && isSignedIn === true && subscriptions === undefined);
  const sortedSubscriptions = useMemo(
    () => subscriptions ?? [],
    [subscriptions],
  );
  const filteredSubscriptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query === "") {
      return sortedSubscriptions;
    }

    return sortedSubscriptions.filter((subscription) =>
      [
        subscription.title,
        subscription.sharedTitle,
        subscription.canonicalFeedUrl,
        subscription.submittedFeedUrl,
        subscription.siteUrl ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [searchQuery, sortedSubscriptions]);
  const totalPostCount = sortedSubscriptions.reduce(
    (sum, subscription) => sum + subscription.postCount,
    0,
  );
  const failedFeedCount = sortedSubscriptions.filter(
    (subscription) => subscription.latestImportStatus === "failed",
  ).length;

  async function onRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editing?.kind !== "rename") {
      return;
    }

    setBusyId(editing.id);
    setError(null);
    try {
      await renameFeedSubscription({
        feedSubscriptionId: editing.id,
        displayTitle: editing.value,
      });
      setEditing(null);
    } catch (renameError) {
      setError(
        renameError instanceof Error
          ? renameError.message
          : "Could not rename Feed Subscription",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onReplaceUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editing?.kind !== "url") {
      return;
    }

    setBusyId(editing.id);
    setError(null);
    try {
      await replaceFeedSubscriptionUrl({
        feedSubscriptionId: editing.id,
        submittedFeedUrl: editing.value,
      });
      setEditing(null);
    } catch (replaceError) {
      setError(
        replaceError instanceof Error
          ? replaceError.message
          : "Could not replace Feed Subscription URL",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onRefresh(feedSubscriptionId: Id<"feedSubscriptions">) {
    setBusyId(feedSubscriptionId);
    setError(null);
    try {
      await manualRefreshFeed({ feedSubscriptionId });
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Could not refresh Feed",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onUnsubscribe(
    feedSubscriptionId: Id<"feedSubscriptions">,
    title: string,
  ) {
    const confirmed = window.confirm(
      `Unsubscribe from "${title}"? This removes it from your Feed Subscriptions.`,
    );
    if (!confirmed) {
      return;
    }

    setBusyId(feedSubscriptionId);
    setError(null);
    try {
      await unsubscribeFromFeed({ feedSubscriptionId });
    } catch (unsubscribeError) {
      setError(
        unsubscribeError instanceof Error
          ? unsubscribeError.message
          : "Could not unsubscribe from Feed",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!isLoaded || isLoading) {
    return <FeedsShell />;
  }

  if (!isSignedIn) {
    return (
      <FeedsShell>
        <section className="grid justify-items-center gap-4 py-28 text-center">
          <div className="grid size-16 place-items-center rounded-full bg-white/14">
            <Rss className="size-7" aria-hidden="true" />
          </div>
          <div className="grid max-w-[25rem] gap-3">
            <h2 className="text-3xl font-black leading-none">
              Sign in to manage Feeds
            </h2>
            <p className="text-base leading-7 text-white/72">
              Feed Subscriptions belong to authenticated Readers.
            </p>
          </div>
          <SignInButton mode="modal">
            <button className="h-12 rounded-full bg-white px-5 text-sm font-black text-[#101418] transition hover:bg-white/90">
              Sign in
            </button>
          </SignInButton>
        </section>
      </FeedsShell>
    );
  }

  if (readerError) {
    return (
      <FeedsShell>
        <EmptyMessage
          title="Feed Subscriptions unavailable"
          body="Blink could not prepare this Reader's Feed Subscriptions."
        />
      </FeedsShell>
    );
  }

  return (
    <FeedsShell>
      <div className="grid gap-5">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/42" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Find a Feed Subscription"
              className="h-12 w-full rounded-full border border-white/10 bg-white/10 pl-10 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-white/42 focus:border-white/35 focus:bg-white/14"
            />
          </label>
          <Link
            href="/feeds/new"
            aria-label="Add Feed"
            className="grid size-12 place-items-center rounded-full bg-white text-[#101418] transition hover:bg-white/90"
          >
            <Plus className="size-5" aria-hidden="true" />
          </Link>
        </div>

        <dl className="grid grid-cols-3 gap-2">
          <Metric label="Feeds" value={sortedSubscriptions.length} />
          <Metric label="Posts" value={totalPostCount} />
          <Metric label="Failed" value={failedFeedCount} />
        </dl>

        {error !== null ? (
          <p className="flex items-start gap-2 rounded-[8px] bg-[#f4d8d2] p-3 text-sm font-bold leading-6 text-[#8a2d1c]">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}

        {sortedSubscriptions.length === 0 ? (
          <EmptyMessage
            title="No Feed Subscriptions"
            body="Add a Feed to start receiving Posts in the Home Feed."
          />
        ) : filteredSubscriptions.length === 0 ? (
          <EmptyMessage
            title="No matching Feed Subscriptions"
            body="Search checks Feed names, Canonical Feed URLs, and Submitted Feed URLs."
            showAction={false}
          />
        ) : (
          <div className="grid gap-3">
            {filteredSubscriptions.map((subscription) => {
              const isBusy = busyId === subscription._id;
              const isRenaming =
                editing?.kind === "rename" && editing.id === subscription._id;
              const isEditingUrl =
                editing?.kind === "url" && editing.id === subscription._id;

              return (
                <article
                  key={subscription._id}
                  className="grid gap-3 rounded-[8px] border border-white/10 bg-white/10 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur"
                >
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                    <FeedBadge title={subscription.title} />
                    <div className="grid min-w-0 gap-1">
                      {isRenaming ? (
                        <form onSubmit={onRename} className="flex gap-2">
                          <input
                            value={editing.value}
                            onChange={(event) =>
                              setEditing({
                                ...editing,
                                value: event.target.value,
                              })
                            }
                            className="h-10 min-w-0 rounded-[8px] border border-white/12 bg-black/24 px-3 text-base font-black text-white outline-none focus:border-white/70"
                            autoFocus
                          />
                          <button
                            type="submit"
                            disabled={isBusy}
                            className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[#101418] disabled:opacity-55"
                          >
                            <Check className="size-4" aria-hidden="true" />
                            <span className="sr-only">Save name</span>
                          </button>
                        </form>
                      ) : (
                        <h3 className="truncate text-base font-black leading-tight">
                          {subscription.title}
                        </h3>
                      )}
                      <p className="truncate text-sm font-semibold text-white/58">
                        {subscription.siteUrl ??
                          feedHost(subscription.canonicalFeedUrl)}
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <ActionButton
                        label="Rename"
                        icon={<Pencil />}
                        disabled={isBusy}
                        onClick={() =>
                          setEditing({
                            kind: "rename",
                            id: subscription._id,
                            value: subscription.displayTitle ?? subscription.title,
                          })
                        }
                      />
                      <ActionButton
                        label="Edit URL"
                        icon={<ExternalLink />}
                        disabled={isBusy}
                        onClick={() =>
                          setEditing({
                            kind: "url",
                            id: subscription._id,
                            value: subscription.submittedFeedUrl,
                          })
                        }
                      />
                      <ActionButton
                        label={isBusy ? "Syncing" : "Resync"}
                        icon={
                          isBusy ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <RefreshCw />
                          )
                        }
                        disabled={isBusy}
                        onClick={() => onRefresh(subscription._id)}
                      />
                      <ActionButton
                        label="Unsubscribe"
                        icon={<Trash2 />}
                        disabled={isBusy}
                        danger
                        onClick={() =>
                          onUnsubscribe(subscription._id, subscription.title)
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-1 pl-[3.5rem] text-xs font-black uppercase tracking-[0.12em] text-white/42 sm:grid-cols-[auto_auto_auto_1fr] sm:gap-3">
                    <span>{subscription.postCount} Posts</span>
                    <span>Last synced {timeLabel(subscription.lastSyncedAt)}</span>
                    <span>{statusLabel(subscription.latestImportStatus)}</span>
                    <span className="truncate normal-case tracking-normal text-white/42">
                      {subscription.canonicalFeedUrl}
                    </span>
                  </div>

                  {isEditingUrl ? (
                    <form onSubmit={onReplaceUrl} className="flex gap-2">
                      <input
                        type="url"
                        required
                        value={editing.value}
                        onChange={(event) =>
                          setEditing({ ...editing, value: event.target.value })
                        }
                        className="h-11 min-w-0 flex-1 rounded-[8px] border border-white/12 bg-black/24 px-3 text-sm font-semibold text-white outline-none focus:border-white/70"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={isBusy}
                        className="h-11 rounded-full bg-white px-4 text-sm font-black text-[#101418] disabled:opacity-55"
                      >
                        Save
                      </button>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </FeedsShell>
  );
}

function FeedsShell({ children }: { children?: React.ReactNode }) {
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
          className="h-40 animate-pulse rounded-[8px] border border-white/10 bg-white/10"
        />
      ))}
    </div>
  );
}

function EmptyMessage({
  title,
  body,
  showAction = true,
}: {
  title: string;
  body: string;
  showAction?: boolean;
}) {
  return (
    <section className="grid justify-items-center gap-4 py-24 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-white/14">
        <Rss className="size-7" aria-hidden="true" />
      </div>
      <div className="grid max-w-[25rem] gap-3">
        <h2 className="text-3xl font-black leading-none">{title}</h2>
        <p className="text-base leading-7 text-white/72">{body}</p>
      </div>
      {showAction ? (
        <Link
          href="/feeds/new"
          className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-[#101418] transition hover:bg-white/90"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add Feed
        </Link>
      ) : null}
    </section>
  );
}

function FeedBadge({ title }: { title: string }) {
  const initial = title.trim()[0]?.toUpperCase() ?? "F";

  return (
    <div className="grid size-11 place-items-center rounded-full bg-[#d8ef7f] text-base font-black text-[#101418]">
      {initial}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-[8px] bg-black/18 p-3">
      <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-white/45">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-black text-white">{value}</dd>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  disabled,
  danger = false,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`ml-1 grid size-9 place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-55 [&>svg]:size-4 ${
        danger
          ? "bg-[#f4d8d2]/90 text-[#8a2d1c] hover:bg-[#efc4ba]"
          : "bg-white/12 text-white hover:bg-white/20"
      }`}
    >
      {icon}
    </button>
  );
}
