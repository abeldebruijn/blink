type ReadingViewPageProps = {
  params: Promise<{
    postId: string;
  }>;
};

export default async function ReadingViewPage({
  params,
}: ReadingViewPageProps) {
  const { postId } = await params;

  return (
    <main
      className="min-h-screen bg-[#f6f1e8] text-[#151719]"
      style={{ fontFamily: "var(--font-literata), serif" }}
    >
      <article className="mx-auto flex min-h-screen w-full max-w-[680px] flex-col justify-center px-6 py-14">
        <p
          className="mb-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#151719]/50"
          style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
        >
          Reading View / {postId}
        </p>
        <h1
          className="max-w-[11ch] text-[42px] font-black italic leading-none tracking-normal sm:text-[54px]"
          style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
        >
          Reading View
        </h1>
        <p className="mt-6 max-w-[34rem] text-lg leading-8 text-[#151719]/72">
          Minimal production placeholder for the article reading surface.
        </p>
      </article>
    </main>
  );
}
