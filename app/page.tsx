"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import {
  Bookmark,
  ChevronDown,
  Heart,
  Loader2,
  Plus,
  Rss,
  ThumbsDown,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { BottomNav } from "./_components/bottom-nav";

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
  const { isLoaded, isSignedIn, user } = useUser();
  const ensureCurrentReader = useMutation(api.readers.ensureCurrent);
  const [ensuredUserId, setEnsuredUserId] = useState<string | null>(null);
  const [readerErrorUserId, setReaderErrorUserId] = useState<string | null>(
    null,
  );
  const userId = user?.id;

  useEffect(() => {
    if (!isLoaded || !isSignedIn || userId === undefined) {
      return;
    }

    let cancelled = false;
    void ensureCurrentReader({})
      .then(() => {
        if (!cancelled) {
          setEnsuredUserId(userId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReaderErrorUserId(userId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ensureCurrentReader, isLoaded, isSignedIn, userId]);

  const readerReady = isSignedIn === true && ensuredUserId === userId;
  const readerError = isSignedIn === true && readerErrorUserId === userId;

  const homeFeed = useQuery(
    api.homeFeed.list,
    isSignedIn && readerReady ? { limit: 20 } : "skip",
  );

  if (!isLoaded) {
    return (
      <main
        className="min-h-screen bg-[#101418]"
        style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
      />
    );
  }

  if (isLoaded && isSignedIn) {
    return (
      <AuthenticatedHomeFeed
        homeFeed={homeFeed}
        readerReady={readerReady}
        readerError={readerError}
      />
    );
  }

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
          <PreviewAction label="Like" active icon={<Heart />} />
          <PreviewAction label="Save" icon={<Bookmark />} />
          <PreviewAction label="Tune down" icon={<ThumbsDown />} />
          <PreviewAction label="Next" icon={<ChevronDown />} />
        </div>
      </section>
    </main>
  );
}

function AuthenticatedHomeFeed({
  homeFeed,
  readerReady,
  readerError,
}: {
  homeFeed: readonly unknown[] | undefined;
  readerReady: boolean;
  readerError: boolean;
}) {
  const isLoading = !readerError && (!readerReady || homeFeed === undefined);
  const hasPosts = (homeFeed?.length ?? 0) > 0;

  return (
    <main
      className="min-h-screen bg-[#f7f3ec] text-[#171717]"
      style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
    >
      <section className="mx-auto flex min-h-screen w-full max-w-[680px] flex-col px-5 pb-28 pt-5">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black italic leading-none">Blink</h1>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center py-14">
          {isLoading ? (
            <div className="grid justify-items-center gap-3 text-[#6f675d]">
              <Loader2 className="size-6 animate-spin" aria-hidden="true" />
              <p className="text-sm font-bold">Loading Home Feed</p>
            </div>
          ) : readerError ? (
            <div className="grid max-w-[27rem] justify-items-center gap-3 text-center">
              <div className="grid size-16 place-items-center rounded-full bg-[#171717] text-white">
                <Rss className="size-7" aria-hidden="true" />
              </div>
              <h2 className="text-3xl font-black leading-none tracking-normal">
                Home Feed unavailable
              </h2>
              <p className="text-base leading-7 text-[#5d554b]">
                Blink could not prepare this Reader&apos;s Home Feed.
              </p>
            </div>
          ) : hasPosts ? null : (
            <section
              aria-labelledby="empty-home-feed-title"
              className="grid w-full justify-items-center gap-5 text-center"
            >
              <div className="grid size-16 place-items-center rounded-full bg-[#171717] text-white">
                <Rss className="size-7" aria-hidden="true" />
              </div>
              <div className="grid max-w-[27rem] gap-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a3d16]">
                  Empty Home Feed
                </p>
                <h2
                  id="empty-home-feed-title"
                  className="text-4xl font-black leading-none tracking-normal"
                >
                  No Posts yet
                </h2>
                <p className="text-base leading-7 text-[#5d554b]">
                  This Reader has no Home Feed Items because there are no Feed
                  Subscriptions yet. Add a Feed to start receiving Posts in the
                  Home Feed.
                </p>
              </div>
              <Link
                href="/feeds/new"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[#171717] px-5 text-sm font-black text-white transition hover:bg-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-[#171717] focus:ring-offset-2 focus:ring-offset-[#f7f3ec]"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add Feed
              </Link>
            </section>
          )}
        </div>

        <BottomNav variant="light" />
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
