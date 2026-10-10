import Link from "next/link";
import { requireReportHandler } from "../_lib/guard";
import { listReports } from "@/server/services/moderation";
import { isEditor, isModerator } from "@/server/auth/roles";
import { Badge, Card, Empty, Notice, PageHeader } from "@/components/ui";
import { StatusBadge, Tabs, Time } from "@/components/admin/bits";
import { ResolveReportForm } from "@/components/admin/ModerationForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

const STATUSES = ["open", "escalated", "resolved", "dismissed"] as const;
type S = (typeof STATUSES)[number];
type Report = Awaited<ReturnType<typeof listReports>>[number];
type History = { actions: { action: string; reason: string; createdAt: Date }[]; removedComments: number };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status: S = STATUSES.includes(sp.status as S) ? (sp.status as S) : "open";
  const actor = await requireReportHandler(`/admin/reports?status=${status}`);
  const reports = await listReports(actor, status);
  const editorOnly = isEditor(actor) && !isModerator(actor);

  return (
    <div>
      <PageHeader kicker="Moderation" title={editorOnly ? "Story reports" : "Report queue"}>
        {editorOnly ? "Reader reports about stories: factual errors, missing context, framing and broken links." : "Oldest first. Read the full context before deciding."}
      </PageHeader>

      <Notice tone="warn" className="mb-5">
        <strong>Do not sanction users for holding a political position.</strong> Remove content only for guideline violations.
      </Notice>

      <Tabs label="Report status" items={STATUSES.map((s) => ({ href: `/admin/reports?status=${s}`, label: s[0].toUpperCase() + s.slice(1), active: s === status }))} />

      {!reports.length ? (
        <Empty title={`No ${status} reports`} />
      ) : (
        <ol className="space-y-4">
          {reports.map((r) => (
            <li key={r.id}>
              <ReportCard r={r} actionable={status === "open" || status === "escalated"} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ReportCard({ r, actionable }: { r: Report; actionable: boolean }) {
  const ctx = r.context;
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{r.targetType}</Badge>
        <Badge tone="warn">{r.reason.replace(/_/g, " ")}</Badge>
        {r.status !== "open" && <Badge>{r.status}</Badge>}
        {"otherOpenReports" in ctx && (ctx.otherOpenReports ?? 0) > 1 && <Badge>{ctx.otherOpenReports} open reports on this item</Badge>}
        <span className="text-xs text-ink-3">Reported <Time value={r.createdAt} />{r.reporterId ? "" : " · automated"}</span>
      </div>
      {r.details && <p className="mt-2 text-sm"><span className="font-semibold">Reporter's note:</span> {r.details}</p>}

      <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
        {"missing" in ctx ? (
          <p className="text-ink-2">The reported item no longer exists.</p>
        ) : ctx.kind === "comment" ? (
          <div className="space-y-3">
            {ctx.story && (
              <p className="text-ink-2">
                On <Link href={`/stories/${ctx.story.slug}/discussion`} className="font-semibold underline">{ctx.story.headline}</Link>
              </p>
            )}
            {ctx.parent && (
              <div className="border-l-2 border-line pl-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">In reply to {ctx.parent.status !== "active" ? `(${ctx.parent.status})` : ""}</p>
                <p className="whitespace-pre-wrap text-ink-2">{ctx.parent.body}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                Reported comment by {ctx.author.name ?? "Unnamed user"} · <Time value={ctx.createdAt} />
                {ctx.status !== "active" && ` · ${ctx.status}`}
              </p>
              <blockquote className="mt-1 whitespace-pre-wrap rounded-lg border border-line bg-surface p-3 text-base">{ctx.body}</blockquote>
            </div>
            {ctx.replies.length > 0 && (
              <div className="border-l-2 border-line pl-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Replies ({ctx.replies.length})</p>
                <ul className="mt-1 space-y-1 text-ink-2">
                  {ctx.replies.map((x) => <li key={x.id} className="whitespace-pre-wrap">{x.status !== "active" ? `[${x.status}] ` : ""}{x.body}</li>)}
                </ul>
              </div>
            )}
            <AuthorHistory name={ctx.author.name} status={ctx.author.status} history={ctx.authorHistory} />
          </div>
        ) : ctx.kind === "story" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{ctx.headline}</span>
            <StatusBadge status={ctx.status} />
            <Link href={`/admin/stories/${ctx.id}`} className="font-semibold underline">Open in editor</Link>
            {ctx.status === "published" && <Link href={`/stories/${ctx.slug}`} className="underline">Live page</Link>}
          </div>
        ) : (
          <AuthorHistory name={ctx.name} status={ctx.status} history={ctx.authorHistory} label="Reported account" />
        )}
      </div>

      {r.resolution && <p className="mt-3 text-sm text-ink-2"><span className="font-semibold">Resolution:</span> {r.resolution}{r.resolvedAt && <> · <Time value={r.resolvedAt} /></>}</p>}

      {actionable && (
        <section className="mt-4 border-t border-line pt-4" aria-label="Decision">
          <ResolveReportForm reportId={r.id} targetType={r.targetType} />
        </section>
      )}
    </Card>
  );
}

function AuthorHistory({ name, status, history, label = "Author" }: { name: string | null; status: string; history: History; label?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{label} history</p>
      <p className="mt-1">
        <span className="font-semibold">{name ?? "Unnamed user"}</span> · account {status} · {history.removedComments} removed {history.removedComments === 1 ? "comment" : "comments"}
      </p>
      {history.actions.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-ink-2">
          {history.actions.map((a, i) => (
            <li key={i}><Time value={a.createdAt} />: {a.action.replace(/_/g, " ")} — {a.reason}</li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-3">No prior enforcement.</p>
      )}
    </div>
  );
}
