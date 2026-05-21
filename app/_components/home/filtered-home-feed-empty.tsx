import { FeedFilterPopover } from "./feed-filter-popover";
import { feedFilterLabels, type HomeFeedFilter } from "./types";

export function FilteredHomeFeedEmpty({
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
