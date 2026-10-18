import Link from "next/link";

const tabs = [
  { k: "results", label: "Results" },
  { k: "perspectives", label: "Left vs Right" },
  { k: "breakdowns", label: "Breakdowns" },
  { k: "discussion", label: "Discussion" },
  { k: "sources", label: "Sources" },
] as const;

export type StoryTab = (typeof tabs)[number]["k"];

/** Post-rating story sections. Scrolls horizontally on narrow screens instead of wrapping. */
export function StoryNav({ slug, current }: { slug: string; current: StoryTab }) {
  return (
    <nav aria-label="Story sections" className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 rounded-xl bg-surface-2 p-1 sm:min-w-0">
        {tabs.map((t) => (
          <li key={t.k} className="sm:flex-1">
            <Link
              href={`/stories/${slug}/${t.k}`}
              aria-current={current === t.k ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg px-3 text-center text-sm font-semibold transition ${current === t.k ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:bg-surface/60 hover:text-ink"}`}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-4 inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-medium text-ink-2 hover:text-ink">
      <span aria-hidden>←</span> {children}
    </Link>
  );
}

/** Headline + tabs shared by every post-rating story page. */
export function StoryHeader({ slug, headline, current }: { slug: string; headline: string; current: StoryTab }) {
  return (
    <>
      <BackLink href={`/stories/${slug}`}>Briefing</BackLink>
      <h1 className="font-serif text-2xl font-semibold leading-snug md:text-3xl">{headline}</h1>
      <div className="mt-4">
        <StoryNav slug={slug} current={current} />
      </div>
    </>
  );
}
