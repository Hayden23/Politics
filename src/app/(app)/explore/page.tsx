import Link from "next/link";
import { getActor } from "@/server/auth/session";
import { exploreQuestions } from "@/server/services/explore";
import { listTopics } from "@/server/services/reader";
import { GroupedBar } from "@/components/GroupedBar";
import { Card, Chip, Empty, PageHeader } from "@/components/ui";
import { plural } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Explore" };

export default async function Explore({ searchParams }: { searchParams: Promise<{ topic?: string; sort?: string }> }) {
  const sp = await searchParams;
  const sort = sp.sort === "recent" ? "recent" : "popular";
  const actor = await getActor();
  const [topics, items] = await Promise.all([listTopics(), exploreQuestions(actor, { topic: sp.topic, sort, limit: 30 })]);

  const href = (p: { topic?: string | null; sort?: string }) => {
    const q = new URLSearchParams();
    const topic = p.topic === undefined ? sp.topic : p.topic;
    const s = p.sort ?? sort;
    if (topic) q.set("topic", topic);
    if (s !== "popular") q.set("sort", s);
    return q.toString() ? `/explore?${q}` : "/explore";
  };

  return (
    <div>
      <PageHeader title="Explore" kicker="Questions">
        <p>Browse questions by topic. Results appear only for questions you've already answered, so you always form your view first.</p>
      </PageHeader>

      <nav aria-label="Filter by topic" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip href={href({ topic: null })} active={!sp.topic} className="min-h-11">All</Chip>
        {topics.map((t) => (
          <Chip key={t.slug} href={href({ topic: t.slug })} active={sp.topic === t.slug} className="min-h-11">{t.name}</Chip>
        ))}
      </nav>

      <nav aria-label="Sort questions" className="mb-6 inline-flex gap-1 rounded-xl bg-surface-2 p-1">
        {(["popular", "recent"] as const).map((s) => (
          <Link
            key={s}
            href={href({ sort: s })}
            aria-current={sort === s ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold ${sort === s ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}
          >
            {s === "popular" ? "Popular" : "Recent"}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <Empty title="No questions here yet">
          {sp.topic ? <Link href={href({ topic: null })} className="underline">See all topics</Link> : "New questions are published with each reviewed briefing."}
        </Empty>
      ) : (
        <ul className="space-y-4">
          {items.map((q) => (
            <li key={q.questionId}>
              <Card>
                <p className="text-xs text-ink-3">{[q.topicName, plural(q.responses, "response")].filter(Boolean).join(" · ")}</p>
                <Link href={`/stories/${q.slug}`} className="mt-1 block font-serif text-lg font-semibold leading-snug hover:underline">{q.headline}</Link>
                <p className="mt-1 text-sm text-ink-2">{q.questionText}</p>
                {q.answered && q.result ? (
                  <div className="mt-4">
                    <GroupedBar dist={q.result.distribution} scale={q.result.question.scale} />
                    <p className="mt-1 text-xs text-ink-3">{q.result.population} · {q.result.weighting}</p>
                    <Link href={`/stories/${q.slug}/results`} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline">Full results</Link>
                  </div>
                ) : (
                  <Link href={`/stories/${q.slug}`} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink">
                    Answer to see results
                  </Link>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-xs leading-relaxed text-ink-3">
        Results show participating users' responses: registered users of this app who chose to answer. They are unweighted and not a representative sample of any population. “Don't know” answers are counted separately. <Link href="/methodology" className="underline">How results work</Link>
      </p>
    </div>
  );
}
