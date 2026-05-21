import { BottomNav } from "./bottom-nav";

type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PlaceholderPage({
  eyebrow,
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <main
      className="min-h-screen bg-[#101418] text-white"
      style={{ fontFamily: "var(--font-hanken-grotesk), sans-serif" }}
    >
      <section className="relative mx-auto flex min-h-screen w-full max-w-[680px] flex-col overflow-hidden bg-[#101418] px-5 pb-24 pt-8 shadow-[0_0_80px_rgba(0,0,0,0.42)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_12%,rgba(255,255,255,0.14),transparent_30%),linear-gradient(145deg,rgba(255,0,79,0.20),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent_42%)]" />
        <div className="relative z-10 flex flex-1 flex-col justify-center gap-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
            {eyebrow}
          </p>
          <h1 className="max-w-[11ch] text-[42px] font-black italic leading-none tracking-normal sm:text-[54px]">
            {title}
          </h1>
          <p
            className="max-w-[30rem] text-[17px] leading-7 text-white/78"
            style={{ fontFamily: "var(--font-literata), serif" }}
          >
            {description}
          </p>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-4">
          <BottomNav />
        </div>
      </section>
    </main>
  );
}
