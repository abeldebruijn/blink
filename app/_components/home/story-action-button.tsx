import type { ReactNode } from "react";

export function StoryActionButton({
  label,
  icon,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  icon: ReactNode;
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
