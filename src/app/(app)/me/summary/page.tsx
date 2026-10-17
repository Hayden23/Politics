import Link from "next/link";
import { requirePageActor } from "@/server/auth/session";
import { weeklySummary } from "@/server/services/summary";
import { BackLink } from "@/components/StoryNav";
import { Card, Empty, PageHeader } from "@/components/ui";
import { formatDate, pct, plural } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your week in review" };

export default async function WeeklySummaryPage() {
  const actor = await requirePageActor("/me/summary");
  const s = await weeklySummary(actor.id);

  return (
    <div>
      <BackLink href="/me">My views</BackLink>
      <PageHeader title="Your week in review" kicker={`${formatDate(s.from, { month: "short", day: "numeric" })} – ${formatDate(s.to, { month: "short", day: "numeric" })}`}>
        <p>What you answered and changed over the last 7 days.</p>
      </PageHeader>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Questions answered" value={s.answered} />
        <Stat label="Answers changed" value={s.changed} />
        <Stat label="Topics" value={s.topics.length} className="col-span-2 sm:col-span-1" />
      </dl>

      {s.topics.length > 0 && (
        <section aria-labelledby="sum-topics" className="mt-8">
          <h2 id="sum-topics" className="text-sm font-semibold uppercase tracking-wider text-ink-3">Topics you read about</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {s.topics.map((t) => (
              <li key={t.name} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm">
                {t.name} <span className="text-ink-3 tabular-nums">· {t.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="sum-stories" className="mt-8">
        <h2 id="sum-stories" className="text-sm font-semibold uppercase tracking-wider text-ink-3">Stories</h2>
        {s.items.length === 0 ? (
          <div className="mt-3">
            <Empty title="Nothing this week yet">
              <Link href="/" className="underline">Read a briefing</Link> and share your view — it'll show up here.
            </Empty>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {s.items.map((i) => (
              <li key={i.slug}>
                <Card className="transition hover:border-ink-3">
                  <p className="text-xs text-ink-3">{[i.topic, i.newThisWeek ? "Answered this week" : "Updated this week"].filter(Boolean).join(" · ")}</p>
                  <Link href={`/stories/${i.slug}/results`} className="mt-1 block font-serif text-lg font-semibold leading-snug hover:underline">{i.headline}</Link>
                  {i.sameSidePercent !== null && (
                    <p className="mt-2 text-sm text-ink-2">
                      {pct(i.sameSidePercent)} of participants answered on the same side as you{" "}
                      <span className="text-ink-3">({plural(i.validResponses, "valid response")})</span>
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
        This summary is private and never labels your politics. “Same side” compares your answer's direction (support or oppose) with other participants' — it isn't shown for neutral or “don't know” answers.
      </p>
    </div>
  );
}

function Stat({ label, value, className = "" }: { label: string; value: number; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface px-4 py-3 ${className}`}>
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="font-serif text-3xl font-semibold">{value.toLocaleString("en-US")}</dd>
    </div>
  );
}
