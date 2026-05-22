"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { AuthenticatedHomeFeed } from "./_components/home/authenticated-home-feed";
import { parseFeedFilter } from "./_components/home/feed-utils";
import { LandingPreview } from "./_components/home/landing-preview";

export default function Home() {
  const { isLoaded, isSignedIn, user } = useUser();
  const ensureCurrentReader = useMutation(api.readers.ensureCurrent);
  const backfillHomeFeedBuckets = useMutation(
    api.homeFeed.backfillCurrentReaderHomeFeedBuckets,
  );
  const searchParams = useSearchParams();
  const selectedFeed = parseFeedFilter(searchParams.get("feed"));
  const [ensuredUserId, setEnsuredUserId] = useState<string | null>(null);
  const [readerErrorUserId, setReaderErrorUserId] = useState<string | null>(
    null,
  );
  const [backfilledUserId, setBackfilledUserId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!readerReady || userId === undefined || backfilledUserId === userId) {
      return;
    }

    let cancelled = false;
    void backfillHomeFeedBuckets({}).finally(() => {
      if (!cancelled) {
        setBackfilledUserId(userId);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [backfillHomeFeedBuckets, backfilledUserId, readerReady, userId]);

  const homeFeedCounts = useQuery(
    api.homeFeed.counts,
    isSignedIn && readerReady ? {} : "skip",
  );
  const homeFeed = usePaginatedQuery(
    api.homeFeed.listPage,
    isSignedIn && readerReady ? { feed: selectedFeed } : "skip",
    { initialNumItems: 20 },
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
        homeFeedItems={homeFeed.results}
        homeFeedCounts={homeFeedCounts}
        paginationStatus={homeFeed.status}
        loadMoreHomeFeedItems={homeFeed.loadMore}
        readerReady={readerReady}
        readerError={readerError}
      />
    );
  }

  return <LandingPreview isSignedIn={false} />;
}
