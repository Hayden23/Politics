import Link from "next/link";
import { requireEditor } from "../_lib/guard";
import { candidateClusters, listCandidates } from "@/server/services/ingestion";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { Tabs, Time } from "@/components/admin/bits";
import { AddCandidateForm, CandidateActions, ClusterPromote } from "@/components/admin/CandidateForms";
import { LeanBadge, MixBar } from "@/components/admin/LeanBadge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Candidates" };

const STATUSES = ["new", "promoted", "dismissed"] as const;
type S = (typeof STATUSES)[number];
const VIEWS = [
  ["clusters", "Clusters"],
  ["list", "List & add"],
] as const;
type View = (typeof VIEWS)[number][0];

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<{ status?: string; view?: string }> }) {
  const sp = await searchParams;
  // `?status=` links from before the clusters view existed still land on the list.
  const view: View = sp.view === "list" || sp.status ? "list" : "clusters";
  const status: S = STATUSES.includes(sp.status as S) ? (sp.status as S) : "new";
  const actor = await requireEditor("/admin/candidates");

  return (
    <div>
      <PageHeader kicker="Editorial" title="Candidates">
        Leads from feeds and editors. Metadata only — promoting creates a draft with the links attached as sources and a placeholder headline you must rewrite.
      </PageHeader>

      <Tabs label="Candidate view" items={VIEWS.map(([v, l]) => ({ href: v === "clusters" ? "/admin/candidates" : "/admin/candidates?view=list", label: l, active: v === view }))} />

      {view === "clusters" ? <ClustersView actor={actor} /> : <ListView actor={actor} status={status} />}
    </div>
  );
}

type Actor = Awaited<ReturnType<typeof requireEditor>>;

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Unknown outlet";
  }
}

async function ClustersView({ actor }: { actor: Actor }) {
  const clusters = await candidateClusters(actor);
  return (
    <section aria-labelledby="clusters-title">
      <h2 id="clusters-title" className="sr-only">Clusters</h2>
      <p className="mb-4 text-sm text-ink-2">
        New leads grouped by event across outlets, most widely covered first. The lean mix shows which kinds of outlets are covering it — use it to spot missing coverage, not as a judgment of the story. Promoting a cluster creates one draft with every outlet attached as a source.
      </p>
      {!clusters.length ? (
        <Empty title="No new candidates">
          Add one from the <Link className="underline" href="/admin/candidates?view=list">list view</Link>.
        </Empty>
      ) : (
        <ul className="space-y-4">
          {clusters.map((c) => (
            <li key={c.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                  <Badge>{c.outlets} {c.outlets === 1 ? "outlet" : "outlets"}</Badge>
                  <span>{c.items.length} {c.items.length === 1 ? "lead" : "leads"}</span>
                  <span>· latest <Time value={c.latest} /></span>
                </div>
                <h3 className="mt-1 font-semibold leading-snug">{c.title}</h3>
                <div className="mt-3 max-w-md">
                  <MixBar mix={c.mix} />
                </div>
                <ul className="mt-3 space-y-2" aria-label="Headlines in this cluster">
                  {c.items.map((i) => (
                    <li key={i.id} className="rounded-xl border border-line p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-ink-2">{i.publisherName ?? hostOf(i.url)}</span>
                        <LeanBadge lean={i.lean} />
                      </div>
                      <a href={i.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block font-medium leading-snug underline-offset-2 hover:underline">
                        {i.title}<span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
                <div className="mt-3">
                  <ClusterPromote candidateIds={c.items.map((i) => i.id)} title={c.title} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function ListView({ actor, status }: { actor: Actor; status: S }) {
  const rows = await listCandidates(actor, status);
  const titleOf = new Map(rows.map((r) => [r.id, r.title]));
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0">
        <Tabs label="Candidate status" items={STATUSES.map((s) => ({ href: `/admin/candidates?view=list&status=${s}`, label: s[0].toUpperCase() + s.slice(1), active: s === status }))} />
        {!rows.length ? (
          <Empty title={`No ${status} candidates`} />
        ) : (
          <ul className="space-y-3">
            {rows.map((c) => (
              <li key={c.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                    {c.publisherName && <span className="font-semibold text-ink-2">{c.publisherName}</span>}
                    {c.feedName && <span>via {c.feedName}</span>}
                    {c.publishedAt && <span>· published <Time value={c.publishedAt} /></span>}
                    {c.duplicateOf && (
                      <Badge tone="warn">Possible duplicate{titleOf.get(c.duplicateOf) ? ` of “${titleOf.get(c.duplicateOf)!.slice(0, 60)}”` : ""}</Badge>
                    )}
                  </div>
                  <h2 className="mt-1 font-semibold leading-snug">{c.title}</h2>
                  <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block break-all text-sm text-accent underline">
                    {c.url}<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  {c.summary && <p className="mt-2 line-clamp-4 text-sm text-ink-2">{c.summary}</p>}
                  <p className="mt-1 text-xs text-ink-3">Added <Time value={c.createdAt} /></p>
                  <div className="mt-3">
                    {status === "new" && <CandidateActions id={c.id} title={c.title} />}
                    {status === "promoted" && c.storyId && <Link href={`/admin/stories/${c.storyId}`} className="text-sm font-semibold underline">Open draft</Link>}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
      <aside>
        <Card>
          <h2 className="text-lg font-semibold">Add a candidate</h2>
          <div className="mt-3"><AddCandidateForm /></div>
        </Card>
      </aside>
    </div>
  );
}
