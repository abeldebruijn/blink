import Link from "next/link";
import { Check, Clock, ExternalLink, ImageOff } from "lucide-react";
import { postTimingLabel, siteHost } from "./feed-utils";
import type { HomeFeedItem } from "./types";

export function HomeFeedStoryCard({
  item,
  index,
  onMarkRead,
}: {
  item: HomeFeedItem;
  index: number;
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
      <div className="absolute inset-0 bg-linear-to-b from-black/16 via-black/28 to-black/88" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.44),transparent_58%)]" />

      <div
        className="relative z-10 grid h-dvh content-end gap-2.5 overflow-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+6.25rem)] pr-[3.35rem] pt-[calc(env(safe-area-inset-top)+3.6rem)] sm:gap-3 sm:pb-36 sm:pr-24 sm:pt-[calc(env(safe-area-inset-top)+4.6rem)]"
      >
        <StoryImage hasImage={hasImage} item={item} />
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
          <h2
            className="text-[25px] font-black leading-[0.98] tracking-normal sm:text-[40px]"
          >
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
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Link
            href={href}
            onClick={() => {
              void onMarkRead(item._id);
            }}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-black text-[#171717] transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#171717]"
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
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/14 px-3 text-sm font-black text-white backdrop-blur transition hover:bg-white/22"
          >
            Source
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
          {!item.isRead ? (
            <button
              type="button"
              onClick={() => {
                void onMarkRead(item._id);
              }}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/14 px-3 text-sm font-black text-white backdrop-blur transition hover:bg-white/22"
            >
              <Check className="size-3.5" aria-hidden="true" />
              Mark read
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function StoryImage({
  hasImage,
  item,
}: {
  hasImage: boolean;
  item: HomeFeedItem;
}) {
  if (!hasImage) {
    return null;
  }

  return (
    <div className="hidden overflow-hidden rounded-[14px] border border-white/12 bg-black/24 shadow-2xl shadow-black/30 backdrop-blur-sm min-[420px]:block sm:block">
      <div
        aria-hidden="true"
        className="h-[5.75rem] bg-contain bg-center bg-no-repeat min-[760px]:h-[8rem] sm:h-[min(36vh,320px)]"
        style={{ backgroundImage: `url("${item.headerImageUrl}")` }}
      />
    </div>
  );
}

function AbstractText({ item }: { item: HomeFeedItem }) {
  if (item.abstract !== null && item.abstract.trim() !== "") {
    return (
      <p
        className="line-clamp-9 text-[13px] leading-[1.72] text-white/90 sm:line-clamp-10 sm:text-sm"
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
