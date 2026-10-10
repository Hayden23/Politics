import Link from "next/link";

const tabs = [
  { k: "results", label: "Results" },
  { k: "discussion", label: "Perspectives" },
  { k: "sources", label: "Original coverage" },
] as const;

export function StoryNav({ slug, current }: { slug: string; current: (typeof tabs)[number]["k"] }) {
  return (
    <nav aria-label="Story sections" className="mb-6 flex gap-1 rounded-xl bg-surface-2 p-1">
      {tabs.map((t) => (
        <Link
          key={t.k}
          href={`/stories/${slug}/${t.k}`}
          aria-current={current === t.k ? "page" : undefined}
          className={`flex min-h-10 flex-1 items-center justify-center rounded-lg px-2 text-center text-sm font-semibold ${current === t.k ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-4 inline-flex min-h-10 items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
      <span aria-hidden>←</span> {children}
    </Link>
  );
}
