import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { feedFilterLabels, type HomeFeedFilter } from "./types";

export function FeedFilterPopover({
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
        {(["unread", "read", "readLater", "liked"] as const).map((feed) => (
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
