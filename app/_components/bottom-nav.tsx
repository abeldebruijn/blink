"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Bookmark, HomeIcon, PlusCircle, Search } from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/feeds/new", label: "Add feed", icon: PlusCircle },
  { href: "/search", label: "Search", icon: Search },
  { href: "/read-later", label: "Saved", icon: Bookmark },
];

type BottomNavProps = {
  variant?: "dark" | "light";
};

export function BottomNav({ variant = "dark" }: BottomNavProps) {
  const pathname = usePathname();
  const shellClass =
    variant === "light"
      ? "border-black/10 bg-white/82 shadow-[0_18px_42px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
      : "border-white/10 bg-[#11161a]/88 shadow-[0_18px_42px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.14)]";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+14px)]">
      <nav
        aria-label="Main navigation"
        className={`pointer-events-auto flex w-full max-w-70 items-center justify-around rounded-full border py-1 backdrop-blur-2xl ${shellClass}`}
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname === href;
          const itemClass =
            variant === "light"
              ? active
                ? "bg-black/10 text-[#171717]"
                : "text-[#171717] hover:bg-black/5"
              : active
                ? "bg-white/18 text-white"
                : "text-white hover:bg-white/10";

          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`grid size-11 place-items-center rounded-full transition active:scale-95 [&>svg]:size-6 [&>svg]:stroke-[2.65] ${itemClass}`}
            >
              <Icon aria-hidden="true" />
            </Link>
          );
        })}
        <div className="grid size-11 place-items-center">
          <UserButton />
        </div>
      </nav>
    </div>
  );
}
