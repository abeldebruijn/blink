import Link from "next/link";
import { Clock, ExternalLink, ImageOff } from "lucide-react";
import { FeedFilterPopover } from "./feed-filter-popover";
import { postTimingLabel, siteHost } from "./feed-utils";
import type { HomeFeedFilter, HomeFeedItem } from "./types";

export function HomeFeedStoryCard({
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
      className="relative h-dvh min-h-dvh snap-start overflow-hidden bg-[#101418] text-white"
    >
      {hasImage ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-60 blur-[2px] scale-105"
          style={{ backgroundImage: `url("${item.headerImageUrl}")` }}
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#22312d_0%,#171717_46%,#4b3327_100%)]" />
      )}
      <div className="absolute inset-0 bg-linear-to-b from-black/20 via-black/20 to-black/84" />
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

      <div className="relative z-10 grid h-dvh content-end gap-3 overflow-hidden px-5 pb-[calc(env(safe-area-inset-bottom)+7.25rem)] pr-24 pt-24 sm:gap-4 sm:pb-36">
        {hasImage ? (
          <div className="overflow-hidden rounded-[18px] border border-white/12 bg-black/24 shadow-2xl shadow-black/40 backdrop-blur-sm">
            <div
              aria-hidden="true"
              className="h-[clamp(10rem,30vh,22rem)] bg-contain bg-center bg-no-repeat sm:h-[min(42vh,360px)]"
              style={{ backgroundImage: `url("${item.headerImageUrl}")` }}
            />
          </div>
        ) : null}
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
          <h2 className="text-[30px] font-black leading-none tracking-normal sm:text-[40px]">
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
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link
            href={href}
            onClick={() => {
              void onMarkRead(item._id);
            }}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-[#171717] transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#171717]"
          >
            Read
          </Link>
          <a
            href={item.canonicalUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              void onMarkRead(item._id);
            }}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white/14 px-4 text-sm font-black text-white backdrop-blur transition hover:bg-white/22"
          >
            Source
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
          {!item.isRead ? (
            <button
              type="button"
              onClick={() => {
                void onMarkRead(item._id);
              }}
              className="inline-flex h-11 items-center rounded-full bg-white/14 px-4 text-sm font-black text-white backdrop-blur transition hover:bg-white/22"
            >
              Mark as read
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function AbstractText({ item }: { item: HomeFeedItem }) {
  if (item.abstract !== null && item.abstract.trim() !== "") {
    return (
      <p
        className="line-clamp-8 text-xs leading-6 text-white/88 sm:line-clamp-10 sm:text-sm"
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
