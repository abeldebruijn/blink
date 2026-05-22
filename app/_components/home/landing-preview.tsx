import Image from "next/image";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Bookmark, ChevronDown, Heart, ThumbsDown } from "lucide-react";
import { StoryActionButton } from "./story-action-button";

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

export function LandingPreview({ isSignedIn }: { isSignedIn: boolean }) {
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
          <h2 className="max-w-[12ch] text-[32px] font-black leading-none tracking-normal sm:text-[38px]">
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
          <StoryActionButton label="Like" active icon={<Heart />} />
          <StoryActionButton label="Read Later" icon={<Bookmark />} />
          <StoryActionButton label="Tune down" icon={<ThumbsDown />} />
          <StoryActionButton label="Next" icon={<ChevronDown />} />
        </div>
      </section>
    </main>
  );
}
