import Link from "next/link";
import { getActor } from "@/server/auth/session";
import { getResults } from "@/server/services/reader";
import { listFeed } from "@/server/services/reader";
import { questionTrend } from "@/server/services/explore";
import { track } from "@/server/services/analytics";
import { gated } from "@/lib/gate";
import { BackLink, StoryNav } from "@/components/StoryNav";
import { Distribution } from "@/components/Distribution";
import { ShareButton } from "@/components/StoryActions";
import { Card } from "@/components/ui";
import { responseLabel } from "@/domain/scale";
import { formatDate, plural, pct } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Results" };

export default async function ResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const actor = await getActor();
  const r = await gated(slug, () => getResults(slug, actor));
  await track("results_viewed", { subjectId: actor?.id, storyId: r.storyId, props: { surface: "page" } });
  const [current, ...older] = r.results;
  const mineCurrent = r.myRatings.find((m) => m.questionId === current?.question.id) ?? null;
  const trend = current ? await questionTrend(current.question.id) : null;
  const next = actor ? (await listFeed(actor, { answered: false, limit: 1 })).items[0] : null;

  return (
    <div>
      <BackLink href={`/stories/${slug}`}>Briefing</BackLink>
      <h1 className="font-serif text-2xl font-semibold leading-snug">{r.headline}</h1>
      <div className="mt-4"><StoryNav slug={slug} current="results" /></div>

      {current && (
        <>
          <Card className="mb-5">
            <p className="text-sm text-ink-2">Your response</p>
            {mineCurrent ? (
              <p className="mt-1 font-serif text-2xl font-semibold">{responseLabel(current.question.scale, mineCurrent.type, mineCurrent.value)}</p>
            ) : (
              <p className="mt-1 text-ink-2">You answered an earlier version of this question. <Link className="underline" href={`/stories/${slug}`}>Answer the current one</Link>.</p>
            )}
            <p className="mt-1 text-sm text-ink-3">{current.question.text}</p>
            {mineCurrent && <Link href={`/stories/${slug}?update=1`} className="mt-3 inline-block text-sm font-semibold underline">Update my view</Link>}
          </Card>

          <section aria-labelledby="dist">
            <h2 id="dist" className="text-lg font-semibold">{current.population}</h2>
            <p className="mt-1 text-sm text-ink-2">
              {plural(current.distribution.totalCount, "response")}
              {current.dateRange.from && <> · {formatDate(current.dateRange.from)} – {formatDate(current.dateRange.to)}</>} · {current.weighting}
            </p>
            <div className="mt-4"><Distribution dist={current.distribution} scale={current.question.scale} mine={mineCurrent} /></div>
            <p className="mt-4 text-xs leading-relaxed text-ink-3">
              {current.populationDescription} Percentages are of valid responses and exclude “{current.question.scale.uncertainLabel}”; rounded figures may not total 100%. <Link href="/methodology" className="underline">How results work</Link>
            </p>
          </section>

          {trend && (
            <section className="mt-8" aria-labelledby="trend">
              <h2 id="trend" className="text-lg font-semibold">Over time</h2>
              <table className="mt-3 w-full text-sm tabular-nums">
                <thead className="text-left text-ink-3"><tr><th className="py-1 font-medium">Date</th><th className="font-medium">Responses</th><th className="font-medium">Oppose</th><th className="font-medium">Neutral</th><th className="font-medium">Support</th></tr></thead>
                <tbody>
                  {trend.slice(-10).map((p) => (
                    <tr key={p.day} className="border-t border-line"><td className="py-1.5">{formatDate(p.day, { month: "short", day: "numeric" })}</td><td>{p.total}</td><td>{pct(p.oppose)}</td><td>{pct(p.neutral)}</td><td>{pct(p.support)}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-ink-3">Cumulative shares of valid responses by the date people first answered.</p>
            </section>
          )}
        </>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link href={`/stories/${slug}/discussion`} className="rounded-2xl border border-line bg-surface p-5 hover:border-ink-3">
          <p className="font-semibold">Explore perspectives →</p>
          <p className="mt-1 text-sm text-ink-2">Read why people answered the way they did — including those who disagree with you.</p>
        </Link>
        <Link href={`/stories/${slug}/sources`} className="rounded-2xl border border-line bg-surface p-5 hover:border-ink-3">
          <p className="font-semibold">See the original coverage →</p>
          <p className="mt-1 text-sm text-ink-2">Who reported this, the primary documents, and any corrections.</p>
        </Link>
      </div>

      {older.length > 0 && (
        <section className="mt-10" aria-labelledby="older">
          <h2 id="older" className="text-lg font-semibold">Earlier question versions</h2>
          <p className="mt-1 text-sm text-ink-2">Editors revised the question. Results for earlier wording are kept separate so their meaning doesn't change.</p>
          {older.map((o) => (
            <Card key={o.question.id} className="mt-4">
              <p className="text-sm font-semibold">Version {o.question.version}: {o.question.text}</p>
              <div className="mt-3"><Distribution dist={o.distribution} scale={o.question.scale} mine={r.myRatings.find((m) => m.questionId === o.question.id)} /></div>
            </Card>
          ))}
        </section>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
        <ShareButton storyId={r.storyId} headline={r.headline} />
        {next ? (
          <Link href={`/stories/${next.slug}`} className="inline-flex min-h-11 items-center rounded-xl bg-ink px-4 font-semibold text-bg">Next story →</Link>
        ) : (
          <Link href="/" className="inline-flex min-h-11 items-center rounded-xl bg-ink px-4 font-semibold text-bg">Back to Discover</Link>
        )}
      </div>
    </div>
  );
}
