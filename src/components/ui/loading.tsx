type LoadingBlockProps = {
  className?: string;
};

type LoadingScreenProps = {
  eyebrow: string;
  title: string;
  description?: string;
};

export function LoadingBlock({ className = "" }: LoadingBlockProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        "loading-shimmer rounded-[18px] bg-[rgba(227,212,198,0.52)]",
        className,
      ].join(" ")}
    />
  );
}

export function LoadingScreen({ eyebrow, title, description }: LoadingScreenProps) {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <section className="w-full max-w-[560px] overflow-hidden rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="grid gap-5">
          <div className="flex items-center gap-3">
            <span className="loading-orb" aria-hidden="true" />
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              {eyebrow}
            </div>
          </div>

          <div className="grid gap-2">
            <h1 className="text-[clamp(30px,3vw,44px)] font-semibold tracking-tight text-[#2f2a24]">
              {title}
            </h1>
            {description ? (
              <p className="max-w-2xl text-[15px] leading-7 text-[#7b6d5f]">{description}</p>
            ) : null}
          </div>

          <div className="grid gap-3">
            <LoadingBlock className="h-11 rounded-2xl" />
            <LoadingBlock className="h-11 rounded-2xl" />
            <div className="flex flex-wrap gap-3">
              <LoadingBlock className="h-11 w-32 rounded-full" />
              <LoadingBlock className="h-11 w-32 rounded-full" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
