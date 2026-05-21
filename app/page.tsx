"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Heart,
  ImageOff,
  Loader2,
  Plus,
  Rss,
  ThumbsDown,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/convex/_generated/api";
import { BottomNav } from "./_components/bottom-nav";

const previewPosts = [
  {
    title: "A model explanation belongs beside the recommendation",
    source: "Protocol Review",
    author: "Jon Bell",
    readTime: "5m read",
    image:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
    summary:
      "Reader trust improves when the feed shows why something appeared, what changed, and which preference can be tuned immediately.",
    tags: ["AI", "Trust", "Ranking"],
  },
  {
    title: "Curating the Information Diet: Minimalist Consumption",
    source: "Field Notes Weekly",
    author: "Mina Okafor",
    readTime: "2m read",
    image:
      "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80",
    summary:
      "In an era of infinite scroll, intention is the luxury. Blink turns noisy reading queues into a tight stream of high-signal summaries.",
    tags: ["Focus", "Culture", "Wellness"],
  },
  {
    title: "Spatial Efficiency: The Return of the Fixed Grid",
    source: "Interface Review",
    author: "Tomas Vale",
    readTime: "45s read",
    image:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80",
    summary:
      "Constrained editorial surfaces improve reading velocity by making every recommendation easier to scan, compare, and dismiss.",
    tags: ["Design", "Typography", "UI"],
  },
];

const activePost = previewPosts[0];
type HomeFeedItems = FunctionReturnType<typeof api.homeFeed.list>;
type HomeFeedItem = HomeFeedItems[number];
type HomeFeedFilter = "unread" | "read" | "saved" | "liked";

const feedFilterLabels: Record<HomeFeedFilter, string> = {
  unread: "Unread",
  read: "Read",
  saved: "Saved for later",
  liked: "Liked",
};

export default function Home() {
  const { isLoaded, isSignedIn, user } = useUser();
  const ensureCurrentReader = useMutation(api.readers.ensureCurrent);
  const [ensuredUserId, setEnsuredUserId] = useState<string | null>(null);
  const [readerErrorUserId, setReaderErrorUserId] = useState<string | null>(
    null,
  );
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

  const homeFeed = useQuery(
    api.homeFeed.list,
    isSignedIn && readerReady ? { limit: 20 } : "skip",
  );

  if (!isLoaded) {
    return (
      <main
        className="min-h-screen bg-[#101418]"
        style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
      />
    );
  }

  if (isLoaded && isSignedIn) {
    return (
      <AuthenticatedHomeFeed
        homeFeed={homeFeed}
        readerReady={readerReady}
        readerError={readerError}
      />
    );
  }

  return (
    <main
      className="min-h-screen overflow-hidden bg-[#101418] text-white"
      style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
    >
      <section className="relative mx-auto min-h-screen w-full max-w-[680px] overflow-hidden bg-[#101418] shadow-[0_0_80px_rgba(0,0,0,0.42)]">
        <Image
          src={activePost.image}
          alt=""
          fill
          priority
          sizes="(max-width: 680px) 100vw, 680px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/28 via-black/20 to-black/88" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),transparent_28%),linear-gradient(90deg,rgba(0,0,0,0.5),transparent_38%)]" />

        <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5">
          <div>
            <h1 className="text-3xl font-black italic leading-none">Blink</h1>
          </div>
          <div className="flex items-center gap-2">
            {isSignedIn ? (
              <UserButton />
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="h-10 rounded-full bg-white/12 px-4 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20">
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="h-10 rounded-full bg-white px-4 text-sm font-black text-[#101418] transition hover:bg-white/88">
                    Join
                  </button>
                </SignUpButton>
              </>
            )}
          </div>
        </header>

        <article className="absolute bottom-32 left-0 right-20 z-10 grid gap-4 p-5">
          <div className="flex flex-wrap gap-2">
            {activePost.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/18 px-3 py-1 text-xs font-bold text-white backdrop-blur"
              >
                {tag}
              </span>
            ))}
          </div>
          <h2 className="max-w-[12ch] text-[32px] font-black leading-none tracking-normal sm:text-[38px]">
            {activePost.title}
          </h2>
          <p className="text-sm font-semibold text-white/80">
            {activePost.source} / {activePost.author} / {activePost.readTime}
          </p>
          <p
            className="max-w-[34rem] text-[16px] leading-6 text-white/88"
            style={{ fontFamily: "var(--font-literata), serif" }}
          >
            {activePost.summary}
          </p>
          {!isSignedIn && (
            <SignUpButton mode="modal">
              <button className="mt-1 h-12 w-fit rounded-full bg-white px-5 text-sm font-black text-[#101418] shadow-[0_14px_34px_rgba(0,0,0,0.24)] transition hover:bg-white/90">
                Create your feed
              </button>
            </SignUpButton>
          )}
        </article>

        <div className="absolute bottom-36 right-4 z-10 grid gap-3">
          <PreviewAction label="Like" active icon={<Heart />} />
          <PreviewAction label="Save" icon={<Bookmark />} />
          <PreviewAction label="Tune down" icon={<ThumbsDown />} />
          <PreviewAction label="Next" icon={<ChevronDown />} />
        </div>
      </section>
    </main>
  );
}

function AuthenticatedHomeFeed({
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

function HomeFeedStoryDeck({ items }: { items: HomeFeedItems }) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [openPopoverId, setOpenPopoverId] = useState<number | "empty" | null>(
    null,
  );
  const markRead = useMutation(api.homeFeed.markRead);
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFeed = parseFeedFilter(searchParams.get("feed"));
  const counts = {
    unread: items.filter((item) => !item.isRead).length,
    read: items.filter((item) => item.isRead).length,
    saved: 0,
    liked: 0,
  } satisfies Record<HomeFeedFilter, number>;
  const visibleItems = filterHomeFeedItems(items, selectedFeed);

  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0 });
  }, [selectedFeed]);

  function scrollToPost(index: number) {
    const container = containerRef.current;
    setActiveIndex(index);
    const post = container?.querySelector<HTMLElement>(
      `[data-home-feed-index="${index}"]`,
    );
    post?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const scrollContainer = container;

    let animationFrame = 0;
    function updateActiveIndex() {
      animationFrame = 0;
      const nextIndex = Math.round(
        scrollContainer.scrollTop / scrollContainer.clientHeight,
      );
      setActiveIndex(Math.max(0, Math.min(visibleItems.length - 1, nextIndex)));
    }

    function onScroll() {
      if (animationFrame === 0) {
        animationFrame = requestAnimationFrame(updateActiveIndex);
      }
    }

    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener("scroll", onScroll);
      if (animationFrame !== 0) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [visibleItems.length]);

  function selectFeed(feed: HomeFeedFilter) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("feed", feed);
    setActiveIndex(0);
    router.push(`/?${params.toString()}`);
    setOpenPopoverId(null);
  }

  return (
    <section
      ref={containerRef}
      aria-label="Home Feed Posts"
      className="relative h-screen snap-y snap-mandatory overflow-y-auto bg-[#101418] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {visibleItems.length === 0 ? (
        <FilteredHomeFeedEmpty
          selectedFeed={selectedFeed}
          totalCount={items.length}
          counts={counts}
          popoverOpen={openPopoverId === "empty"}
          onPopoverOpenChange={(open) =>
            setOpenPopoverId(open ? "empty" : null)
          }
          onSelectFeed={selectFeed}
        />
      ) : null}
      {visibleItems.map((item, index) => (
        <HomeFeedStoryCard
          key={item._id}
          item={item}
          index={index}
          position={index + 1}
          total={visibleItems.length}
          selectedFeed={selectedFeed}
          counts={counts}
          popoverOpen={openPopoverId === index}
          onPopoverOpenChange={(open) => setOpenPopoverId(open ? index : null)}
          onSelectFeed={selectFeed}
          onMarkRead={(homeFeedItemId) =>
            markRead({ homeFeedItemId, read: true })
          }
        />
      ))}
      <div className="fixed right-[max(1rem,calc(50vw-340px+1rem))] top-[68%] z-50 grid -translate-y-1/2 gap-3">
        <StoryActionButton
          label="Previous Post"
          icon={<ChevronUp />}
          onClick={() => scrollToPost(Math.max(0, activeIndex - 1))}
          disabled={activeIndex === 0}
        />
        <StoryActionButton label="Like Post" icon={<Heart />} active />
        <StoryActionButton label="Save Post" icon={<Bookmark />} />
        <StoryActionButton label="Dislike Post" icon={<ThumbsDown />} />
        <StoryActionButton
          label="Next Post"
          icon={<ChevronDown />}
          onClick={() =>
            scrollToPost(Math.min(visibleItems.length - 1, activeIndex + 1))
          }
          disabled={activeIndex === visibleItems.length - 1}
        />
      </div>
    </section>
  );
}

function HomeFeedStoryCard({
  item,
  index,
  position,
  total,
  selectedFeed,
  counts,
  popoverOpen,
  onPopoverOpenChange,
  onSelectFeed,
  onMarkRead,
}: {
  item: HomeFeedItem;
  index: number;
  position: number;
  total: number;
  selectedFeed: HomeFeedFilter;
  counts: Record<HomeFeedFilter, number>;
  popoverOpen: boolean;
  onPopoverOpenChange: (open: boolean) => void;
  onSelectFeed: (feed: HomeFeedFilter) => void;
  onMarkRead: (homeFeedItemId: HomeFeedItem["_id"]) => Promise<unknown>;
}) {
  const hasImage = item.headerImageUrl !== null && item.headerImageUrl !== "";
  const href = `/posts/${item.postId}`;
  const timing = postTimingLabel(item);

  return (
    <article
      data-home-feed-index={index}
      className="relative min-h-screen snap-start overflow-hidden bg-[#101418] text-white"
    >
      {hasImage ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${item.headerImageUrl}")` }}
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#22312d_0%,#171717_46%,#4b3327_100%)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/20 to-black/84" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.14),transparent_28%),linear-gradient(90deg,rgba(0,0,0,0.46),transparent_46%)]" />

      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-5">
        <div>
          <h1 className="text-3xl font-black italic leading-none">Blink</h1>
        </div>
        <FeedFilterPopover
          selectedFeed={selectedFeed}
          position={position}
          total={total}
          counts={counts}
          open={popoverOpen}
          onOpenChange={onPopoverOpenChange}
          onSelectFeed={onSelectFeed}
        />
      </header>

      <div className="relative z-10 grid min-h-screen content-end gap-4 px-5 pb-36 pr-24 pt-24">
        <div className="flex flex-wrap gap-2">
          <FeedPill>{item.source.title}</FeedPill>
          {item.isRead ? <FeedPill>Read</FeedPill> : null}
          {!hasImage ? (
            <FeedPill>
              <ImageOff className="size-3.5" aria-hidden="true" />
              No image
            </FeedPill>
          ) : null}
        </div>

        <div className="grid gap-3">
          <h2 className="text-[34px] font-black leading-none tracking-normal sm:text-[40px]">
            {item.title}
          </h2>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-white/78">
            {timing !== null ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden="true" />
                {timing}
              </span>
            ) : null}
            {item.source.siteUrl !== null ? (
              <span className="truncate">{siteHost(item.source.siteUrl)}</span>
            ) : null}
          </p>
        </div>

        <AbstractText item={item} />

        <div className="flex items-center gap-3 pt-1">
          <Link
            href={href}
            onClick={() => {
              void onMarkRead(item._id);
            }}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-[#171717] transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#171717]"
          >
            Read
            <ExternalLink className="size-4" aria-hidden="true" />
          </Link>
          <a
            href={item.canonicalUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              void onMarkRead(item._id);
            }}
            className="inline-flex h-11 items-center rounded-full bg-white/14 px-4 text-sm font-black text-white backdrop-blur transition hover:bg-white/22"
          >
            Source
          </a>
        </div>
      </div>
    </article>
  );
}

function FilteredHomeFeedEmpty({
  selectedFeed,
  totalCount,
  counts,
  popoverOpen,
  onPopoverOpenChange,
  onSelectFeed,
}: {
  selectedFeed: HomeFeedFilter;
  totalCount: number;
  counts: Record<HomeFeedFilter, number>;
  popoverOpen: boolean;
  onPopoverOpenChange: (open: boolean) => void;
  onSelectFeed: (feed: HomeFeedFilter) => void;
}) {
  return (
    <article className="relative min-h-screen snap-start overflow-hidden bg-[#101418] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(145deg,#22312d_0%,#171717_48%,#4b3327_100%)]" />
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-5">
        <h1 className="text-3xl font-black italic leading-none">Blink</h1>
        <FeedFilterPopover
          selectedFeed={selectedFeed}
          position={0}
          total={counts[selectedFeed]}
          counts={counts}
          open={popoverOpen}
          onOpenChange={onPopoverOpenChange}
          onSelectFeed={onSelectFeed}
        />
      </header>
      <div className="relative z-10 grid min-h-screen content-center gap-3 px-5 text-center">
        <h2 className="text-3xl font-black leading-none">
          No {feedFilterLabels[selectedFeed].toLowerCase()} Posts
        </h2>
        <p className="mx-auto max-w-[24rem] text-base leading-7 text-white/72">
          {totalCount} Posts are available across the merged Home Feed.
        </p>
      </div>
    </article>
  );
}

function FeedFilterPopover({
  selectedFeed,
  position,
  total,
  counts,
  open,
  onOpenChange,
  onSelectFeed,
}: {
  selectedFeed: HomeFeedFilter;
  position: number;
  total: number;
  counts: Record<HomeFeedFilter, number>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectFeed: (feed: HomeFeedFilter) => void;
}) {
  const label = `${feedFilterLabels[selectedFeed]}: ${Math.min(
    position,
    total,
  )}/${total}`;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="rounded-full bg-white/12 px-3 py-1.5 text-xs font-bold text-white backdrop-blur transition hover:bg-white/20"
          />
        }
      >
        {label}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-56 border border-white/10 bg-[#151a1f]/95 p-2 text-white backdrop-blur-xl"
      >
        {(["unread", "read", "saved", "liked"] as const).map((feed) => (
          <button
            key={feed}
            type="button"
            onClick={() => onSelectFeed(feed)}
            className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-sm font-bold transition ${
              selectedFeed === feed
                ? "bg-white text-[#101418]"
                : "hover:bg-white/10"
            }`}
          >
            <span>{feedFilterLabels[feed]}</span>
            <span>{counts[feed]}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function AbstractText({ item }: { item: HomeFeedItem }) {
  if (item.abstract !== null && item.abstract.trim() !== "") {
    return (
      <p
        className="line-clamp-10 text-xs sm:text-sm leading-6 text-white/88"
        style={{ fontFamily: "var(--font-literata), serif" }}
      >
        {item.abstract}
      </p>
    );
  }

  const message =
    item.firecrawlStatus === "failed" || item.abstractStatus === "failed"
      ? "Blink could not read this page yet. The Post is still available from the original source."
      : "Blink is still reading this page. The Abstract will appear after extraction finishes.";

  return (
    <p
      className="rounded-[8px] bg-white/12 p-3 text-[15px] leading-6 text-white/80 backdrop-blur"
      style={{ fontFamily: "var(--font-literata), serif" }}
    >
      {message}
    </p>
  );
}

function FeedPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/16 px-3 py-1 text-xs font-black text-white backdrop-blur">
      {children}
    </span>
  );
}

function StoryActionButton({
  label,
  icon,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-12 place-items-center rounded-full backdrop-blur transition active:scale-95 [&>svg]:size-5 ${
        active ? "bg-[#ff004f] text-white" : "bg-white/14 text-white"
      } disabled:cursor-not-allowed disabled:opacity-35`}
    >
      {icon}
    </button>
  );
}

function parseFeedFilter(value: string | null): HomeFeedFilter {
  if (value === "read" || value === "saved" || value === "liked") {
    return value;
  }
  return "unread";
}

function filterHomeFeedItems(
  items: HomeFeedItems,
  selectedFeed: HomeFeedFilter,
) {
  if (selectedFeed === "read") {
    return items.filter((item) => item.isRead);
  }
  if (selectedFeed === "saved" || selectedFeed === "liked") {
    return [];
  }
  return items.filter((item) => !item.isRead);
}

function postTimingLabel(item: HomeFeedItem) {
  const timestamp = item.publishedAt ?? item.discoveredAt;
  if (timestamp === null) {
    return null;
  }

  const date = new Date(timestamp);
  const now = Date.now();
  const diffMs = Math.max(0, now - date.getTime());
  const diffHours = Math.floor(diffMs / 3_600_000);
  if (diffHours < 1) {
    return "Just now";
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function siteHost(siteUrl: string) {
  try {
    return new URL(siteUrl).host.replace(/^www\./, "");
  } catch {
    return siteUrl;
  }
}

function PreviewAction({
  label,
  icon,
  active = false,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`grid size-12 place-items-center rounded-full backdrop-blur transition active:scale-95 [&>svg]:size-5 ${
        active ? "bg-[#ff004f] text-white" : "bg-white/14 text-white"
      }`}
    >
      {icon}
    </button>
  );
}
