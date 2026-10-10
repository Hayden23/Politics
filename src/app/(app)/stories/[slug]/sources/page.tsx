import { getActor } from "@/server/auth/session";
import { getSources } from "@/server/services/reader";
import { track } from "@/server/services/analytics";
import { gated } from "@/lib/gate";
import { BackLink, StoryNav } from "@/components/StoryNav";
import { Badge, Empty } from "@/components/ui";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Original coverage" };

const REL: Record<string, string> = {
  primary_evidence: "Primary documents",
  factual_reporting: "Original reporting",
  analysis: "Analysis",
  contextual_background: "Background and context",
};
const TYPE: Record<string, string> = { news_article: "News article", primary_document: "Primary document", government_data: "Government data", analysis: "Analysis", other: "Other" };

export default async function SourcesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const actor = await getActor();
  const s = await gated(slug, () => getSources(slug, actor));
  await track("source_revealed", { subjectId: actor?.id, storyId: s.storyId, props: { surface: "page", sourceCount: s.sources.length } });
  const groups = Object.keys(REL).map((k) => ({ k, items: s.sources.filter((x) => x.relationship === k) })).filter((g) => g.items.length);

  return (
    <div>
      <BackLink href={`/stories/${slug}`}>Briefing</BackLink>
      <h1 className="font-serif text-2xl font-semibold leading-snug">{s.headline}</h1>
      <div className="mt-4"><StoryNav slug={slug} current="sources" /></div>
      <h2 className="text-lg font-semibold">See the original coverage</h2>
      <p className="mt-1 text-sm text-ink-2">These are the sources our editors used to write the briefing. Links open the publisher's site; we don't republish their articles.</p>

      {!s.sources.length && <div className="mt-6"><Empty title="No sources listed">Editors have been notified.</Empty></div>}
      {groups.map((g) => (
        <section key={g.k} className="mt-6" aria-labelledby={`g-${g.k}`}>
          <h3 id={`g-${g.k}`} className="text-xs font-semibold uppercase tracking-wider text-ink-3">{REL[g.k]}</h3>
          <ul className="mt-2 space-y-3">
            {g.items.map((x) => (
              <li key={x.id} className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{x.publisherName}</p>
                  <Badge>{TYPE[x.sourceType]}</Badge>
                  {x.linkStatus === "broken" && <Badge tone="warn">Link may be broken</Badge>}
                </div>
                {x.originalHeadline && <p className="mt-1 font-serif text-lg leading-snug">“{x.originalHeadline}”</p>}
                <p className="mt-1 text-sm text-ink-2">{[x.author, x.publishedAt && formatDate(x.publishedAt)].filter(Boolean).join(" · ")}</p>
                {x.claimsSupported.length > 0 && <p className="mt-2 text-sm text-ink-2">Supports: {x.claimsSupported.join("; ")}</p>}
                <a href={x.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-accent underline">
                  Read at {new URL(x.url).hostname.replace(/^www\./, "")} <span aria-hidden>↗</span><span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {s.corrections.length > 0 && (
        <section className="mt-8 rounded-2xl bg-warn-soft p-5" aria-labelledby="corrections">
          <h3 id="corrections" className="font-semibold text-warn">Editorial corrections</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {s.corrections.map((c) => (
              <li key={c.version}><span className="font-semibold">{formatDate(c.at)}:</span> {c.note}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
