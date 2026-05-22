"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  Heart,
  ThumbsDown,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { parseFeedFilter } from "./feed-utils";
import { FeedFilterPopover } from "./feed-filter-popover";
import { FilteredHomeFeedEmpty } from "./filtered-home-feed-empty";
import { HomeFeedStoryCard } from "./home-feed-story-card";
import { StoryActionButton } from "./story-action-button";
import type { HomeFeedData, HomeFeedFilter } from "./types";

export function HomeFeedStoryDeck({ homeFeed }: { homeFeed: HomeFeedData }) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const isProgrammaticScrolling = useRef(false);
  const markRead = useMutation(api.homeFeed.markRead);
  const toggleReadLater = useMutation(api.homeFeed.toggleReadLater);
  const toggleLike = useMutation(api.homeFeed.toggleLike);
  const feedSubscriptionCount = useQuery(
    api.feedSubscriptions.countForCurrentReader,
    {},
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFeed = parseFeedFilter(searchParams.get("feed"));
  const counts = homeFeed.counts satisfies Record<HomeFeedFilter, number>;
  const visibleItems = homeFeed.items;
  const activeItem = visibleItems[activeIndex] ?? null;

  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0 });
  }, [selectedFeed]);

  function scrollToPost(index: number) {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const nextIndex = Math.max(0, Math.min(visibleItems.length - 1, index));
    const target = container.querySelector<HTMLElement>(
      `[data-home-feed-index="${nextIndex}"]`,
    );
    setActiveIndex(nextIndex);
    isProgrammaticScrolling.current = true;
    if (nextIndex === 0 || target === null) {
      container.scrollTo({ top: 0, behavior: "auto" });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setTimeout(() => {
      isProgrammaticScrolling.current = false;
      const settledIndex = Math.round(
        container.scrollTop / container.clientHeight,
      );
      setActiveIndex(
        Math.max(0, Math.min(visibleItems.length - 1, settledIndex)),
      );
    }, 500);
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
      if (isProgrammaticScrolling.current) {
        return;
      }
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
    setPopoverOpen(false);
  }

  return (
    <section
      ref={containerRef}
      aria-label="Home Feed Posts"
      className="relative h-screen snap-y snap-mandatory overflow-y-auto bg-[#101418] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <header className="fixed top-0 left-1/2 z-50 grid w-full max-w-[680px] -translate-x-1/2 grid-cols-[1fr_auto_1fr] items-center border-b border-white/5 bg-[#101418]/60 px-4 py-3 backdrop-blur-md sm:p-5">
        <div>
          <h1 className="text-2xl font-black italic leading-none text-white sm:text-3xl">
            Blink
          </h1>
        </div>
        <Link
          href="/feeds/all"
          className="max-w-[9.5rem] truncate rounded-full bg-white/14 px-2.5 py-1.5 text-[11px] font-black text-white transition hover:bg-white/20 sm:max-w-none sm:px-3 sm:text-xs"
        >
          Subscribed to {feedSubscriptionCount ?? "..."} Feed
          {feedSubscriptionCount === 1 ? "" : "s"}
        </Link>
        <div className="justify-self-end">
          <FeedFilterPopover
            selectedFeed={selectedFeed}
            position={visibleItems.length === 0 ? 0 : activeIndex + 1}
            total={
              visibleItems.length === 0
                ? counts[selectedFeed]
                : visibleItems.length
            }
            counts={counts}
            open={popoverOpen}
            onOpenChange={setPopoverOpen}
            onSelectFeed={selectFeed}
          />
        </div>
      </header>

      {visibleItems.length === 0 ? (
        <FilteredHomeFeedEmpty
          selectedFeed={selectedFeed}
          totalCount={counts.unread + counts.read}
        />
      ) : null}
      {visibleItems.map((item, index) => (
        <HomeFeedStoryCard
          key={item._id}
          item={item}
          index={index}
          onMarkRead={(homeFeedItemId) =>
            markRead({ homeFeedItemId, read: true })
          }
        />
      ))}
      <div
        className="fixed right-[max(0.35rem,calc(50vw-340px+1rem))] top-[68%] z-50 grid -translate-y-1/2 gap-2 sm:right-[max(1rem,calc(50vw-340px+1rem))] sm:gap-3"
      >
        <StoryActionButton
          label="Previous Post"
          icon={<ChevronUp />}
          onClick={() => scrollToPost(Math.max(0, activeIndex - 1))}
          disabled={activeIndex === 0}
        />
        <StoryActionButton
          label="Like Post"
          icon={<Heart />}
          active={activeItem?.isLiked ?? false}
          disabled={activeItem === null}
          onClick={() => {
            if (activeItem !== null) {
              void toggleLike({
                homeFeedItemId: activeItem._id,
                liked: !activeItem.isLiked,
              });
            }
          }}
        />
        <StoryActionButton
          label="Read Later"
          icon={<Bookmark />}
          active={activeItem?.isReadLater ?? false}
          disabled={activeItem === null}
          onClick={() => {
            if (activeItem !== null) {
              void toggleReadLater({
                homeFeedItemId: activeItem._id,
                readLater: !activeItem.isReadLater,
              });
            }
          }}
        />
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
