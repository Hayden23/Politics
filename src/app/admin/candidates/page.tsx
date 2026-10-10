import Link from "next/link";
import { requireEditor } from "../_lib/guard";
import { listCandidates } from "@/server/services/ingestion";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { Tabs, Time } from "@/components/admin/bits";
import { AddCandidateForm, CandidateActions } from "@/components/admin/CandidateForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Candidates" };

const STATUSES = ["new", "promoted", "dismissed"] as const;
type S = (typeof STATUSES)[number];

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status: S = STATUSES.includes(sp.status as S) ? (sp.status as S) : "new";
  const actor = await requireEditor("/admin/candidates");
  const rows = await listCandidates(actor, status);
  const titleOf = new Map(rows.map((r) => [r.id, r.title]));

  return (
    <div>
      <PageHeader kicker="Editorial" title="Candidates">
        Leads from feeds and editors. Metadata only — promoting creates a draft with the link attached as a source and a placeholder headline you must rewrite.
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <Tabs label="Candidate status" items={STATUSES.map((s) => ({ href: `/admin/candidates?status=${s}`, label: s[0].toUpperCase() + s.slice(1), active: s === status }))} />
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
    </div>
  );
}
