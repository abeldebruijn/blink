import { feedFilterLabels, type HomeFeedFilter } from "./types";

export function FilteredHomeFeedEmpty({
  selectedFeed,
  totalCount,
}: {
  selectedFeed: HomeFeedFilter;
  totalCount: number;
}) {
  return (
    <article className="relative min-h-screen snap-start overflow-hidden bg-[#101418] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(145deg,#22312d_0%,#171717_48%,#4b3327_100%)]" />

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
