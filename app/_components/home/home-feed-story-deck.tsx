"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";
import { Bookmark, ChevronDown, ChevronUp, Heart, ThumbsDown } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { filterHomeFeedItems, parseFeedFilter } from "./feed-utils";
import { FilteredHomeFeedEmpty } from "./filtered-home-feed-empty";
import { HomeFeedStoryCard } from "./home-feed-story-card";
import { StoryActionButton } from "./story-action-button";
import type { HomeFeedFilter, HomeFeedItems } from "./types";

export function HomeFeedStoryDeck({ items }: { items: HomeFeedItems }) {
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
