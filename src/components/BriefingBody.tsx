import { formatDate } from "@/lib/format";
import type { getBriefing } from "@/server/services/reader";

type B = Awaited<ReturnType<typeof getBriefing>>;

/** The source-blind briefing: topic, date, headline, text, facts, disputes, uncertainties. */
export function BriefingBody({ b }: { b: B }) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
        {b.topicName && <span>{b.topicName} · </span>}
        <time dateTime={b.date}>{formatDate(b.date, { month: "long", day: "numeric", year: "numeric" })}</time>
        <span> · {b.readingMinutes} min read</span>
        {b.updatedVersion && <span> · Updated</span>}
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight">{b.headline}</h1>
      <div className="prose-brief mt-5 font-serif text-lg leading-relaxed">
        {b.briefing.split(/\n\s*\n/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
      </div>
      <FactList title="Key facts and context" items={b.keyFacts} />
      <FactList title="Disputed claims" items={b.disputedClaims} note="Claims made by one side that others contest or that haven't been verified." />
      <FactList title="What's still uncertain" items={b.uncertainties} />
    </>
  );
}

function FactList({ title, items, note }: { title: string; items: { text: string }[]; note?: string }) {
  if (!items.length) return null;
  return (
    <section className="mt-6 rounded-2xl bg-surface-2 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-2">{title}</h2>
      {note && <p className="mt-1 text-sm text-ink-3">{note}</p>}
      <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed">
        {items.map((f, i) => <li key={i}>{f.text}</li>)}
      </ul>
    </section>
  );
}
