import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEditor } from "../../../_lib/guard";
import { getBriefing, getResults, getSources } from "@/server/services/reader";
import { HttpError } from "@/lib/errors";
import { BriefingBody } from "@/components/BriefingBody";
import { Distribution } from "@/components/Distribution";
import { Badge, Chip, Empty } from "@/components/ui";
import { formatDate, plural } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Preview" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REL: Record<string, string> = { primary_evidence: "Primary evidence", factual_reporting: "Factual reporting", analysis: "Analysis", contextual_background: "Contextual background" };

async function load<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
}

export default async function PreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { id } = await params;
  const mode = (await searchParams).mode === "post" ? "post" : "pre";
  const actor = await requireEditor(`/admin/stories/${id}/preview?mode=${mode}`);
  if (!UUID.test(id)) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <div role="note" className="mb-6 rounded-2xl border-2 border-dashed border-ink-3 bg-surface p-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-semibold">Preview — not visible to readers</p>
          <nav aria-label="Preview mode" className="flex gap-2">
            <Chip href={`/admin/stories/${id}/preview?mode=pre`} active={mode === "pre"}>Before rating</Chip>
            <Chip href={`/admin/stories/${id}/preview?mode=post`} active={mode === "post"}>After rating</Chip>
          </nav>
          <Link href={`/admin/stories/${id}`} className="ml-auto text-sm font-semibold underline">Back to editor</Link>
        </div>
      </div>
      {mode === "pre" ? <Pre id={id} actor={actor} /> : <Post id={id} actor={actor} />}
    </div>
  );
}

type A = Awaited<ReturnType<typeof requireEditor>>;

async function Pre({ id, actor }: { id: string; actor: A }) {
  const b = await load(() => getBriefing(id, actor, { preview: true }));
  return (
    <article>
      <BriefingBody b={b} />
      <section className="mt-8" aria-labelledby="pq">
        {b.question ? (
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 id="pq" className="font-serif text-xl font-semibold leading-snug">{b.question.text}</h2>
            <p className="mt-1 text-sm text-ink-2">Choose the answer closest to your view. You'll see how others responded after you submit.</p>
            <ul className="mt-4 space-y-2" aria-label="Response options (preview, not interactive)">
              {b.question.scale.labels.map((l) => (
                <li key={l} className="flex min-h-12 items-center gap-3 rounded-xl border border-line px-4 py-2.5 text-base text-ink-2">
                  <span aria-hidden className="size-5 rounded-full border-2 border-line" />
                  {l}
                </li>
              ))}
            </ul>
            {b.question.scale.allowUncertain && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="flex min-h-12 items-center gap-3 rounded-xl border border-line px-4 py-2.5 text-base text-ink-2">
                  <span aria-hidden className="size-5 rounded-full border-2 border-line" />
                  {b.question.scale.uncertainLabel}
                </p>
              </div>
            )}
            <p className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-surface-2 text-base font-semibold text-ink-3">Submit my view (disabled in preview)</p>
            <p className="mt-2 text-xs text-ink-3">Question v{b.question.version}{b.preview ? " (draft question shown when one exists)" : ""}</p>
          </div>
        ) : (
          <Empty title="No rating question yet">Add one in the editor before submitting for review.</Empty>
        )}
      </section>
    </article>
  );
}

async function Post({ id, actor }: { id: string; actor: A }) {
  const [r, s] = await Promise.all([load(() => getResults(id, actor, { preview: true })), load(() => getSources(id, actor, { preview: true }))]);
  const [current, ...older] = r.results;
  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold leading-snug">{r.headline}</h1>
      <section className="mt-6" aria-labelledby="res">
        <h2 id="res" className="text-lg font-semibold">Results</h2>
        {current ? (
          <>
            <p className="mt-1 text-sm text-ink-2">{current.question.text}</p>
            <p className="mt-1 text-sm text-ink-3">
              {current.population} · {plural(current.distribution.totalCount, "response")} · {current.weighting}
            </p>
            <div className="mt-4"><Distribution dist={current.distribution} scale={current.question.scale} /></div>
            {older.length > 0 && <p className="mt-3 text-sm text-ink-3">{plural(older.length, "earlier question version")} also have results.</p>}
          </>
        ) : (
          <div className="mt-3"><Empty title="No results yet">Results appear once a question has been published and readers respond.</Empty></div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="src">
        <h2 id="src" className="text-lg font-semibold">See the original coverage</h2>
        {!s.sources.length ? (
          <div className="mt-3"><Empty title="No sources listed" /></div>
        ) : (
          <ul className="mt-3 space-y-3">
            {s.sources.map((x) => (
              <li key={x.id} className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{x.publisherName}</p>
                  <Badge>{REL[x.relationship] ?? x.relationship}</Badge>
                  {x.linkStatus === "broken" && <Badge tone="warn">Link may be broken</Badge>}
                </div>
                {x.originalHeadline && <p className="mt-1 font-serif text-lg leading-snug">“{x.originalHeadline}”</p>}
                <p className="mt-1 text-sm text-ink-2">{[x.author, x.publishedAt && formatDate(x.publishedAt)].filter(Boolean).join(" · ")}</p>
                {x.claimsSupported.length > 0 && <p className="mt-2 text-sm text-ink-2">Supports: {x.claimsSupported.join("; ")}</p>}
                <a href={x.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-accent underline break-all">
                  {x.url}<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {s.corrections.length > 0 && (
          <section className="mt-6 rounded-2xl bg-warn-soft p-5" aria-labelledby="corr">
            <h3 id="corr" className="font-semibold text-warn">Editorial corrections</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {s.corrections.map((c) => <li key={c.version}><span className="font-semibold">{formatDate(c.at)}:</span> {c.note}</li>)}
            </ul>
          </section>
        )}
      </section>
    </div>
  );
}
