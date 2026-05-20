"use client";

import Image from "next/image";
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import {
  Bookmark,
  ChevronDown,
  Heart,
  HomeIcon,
  Search,
  Sparkles,
  ThumbsDown,
  UserRound,
} from "lucide-react";

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

export default function Home() {
  const { isSignedIn } = useUser();

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
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/68">
              Signed-out preview
            </p>
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

        <div className="absolute left-5 right-20 top-28 z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
            <Sparkles className="size-3.5" />
            Story feed preview
          </div>
        </div>

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
          <h2 className="max-w-[10ch] text-[38px] font-black leading-none tracking-normal sm:max-w-[12ch] sm:text-[44px]">
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

        <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-4">
          <nav
            aria-label="Preview navigation"
            className="mx-auto flex h-[58px] max-w-[360px] items-center justify-around rounded-full border border-white/10 bg-[#11161a]/88 px-4 shadow-[0_18px_42px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-2xl"
          >
            <NavIcon label="Home" active icon={<HomeIcon />} />
            <NavIcon label="Saved" icon={<Bookmark />} />
            <NavIcon label="Search" icon={<Search />} />
            <NavIcon label="Profile" icon={<UserRound />} />
          </nav>
        </div>
      </section>
    </main>
  );
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

function NavIcon({
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
      aria-current={active ? "page" : undefined}
      className={`grid size-[50px] place-items-center rounded-full text-white transition active:scale-95 [&>svg]:size-7 [&>svg]:stroke-[2.65] ${
        active ? "bg-white/18" : "hover:bg-white/10"
      }`}
    >
      {icon}
    </button>
  );
}
