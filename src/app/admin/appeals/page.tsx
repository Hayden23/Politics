import { requireModerator } from "../_lib/guard";
import { listAppeals } from "@/server/services/moderation";
import { Badge, Card, Empty, Notice, PageHeader } from "@/components/ui";
import { Tabs, Time } from "@/components/admin/bits";
import { AppealForm } from "@/components/admin/ModerationForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Appeals" };

const STATUSES = ["open", "upheld", "overturned"] as const;
type S = (typeof STATUSES)[number];

export default async function AppealsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status: S = STATUSES.includes(sp.status as S) ? (sp.status as S) : "open";
  const actor = await requireModerator(`/admin/appeals?status=${status}`);
  const rows = await listAppeals(actor, status);

  return (
    <div>
      <PageHeader kicker="Moderation" title="Appeals">
        A different moderator from the one who made the original decision should review each appeal.
      </PageHeader>
      <Notice className="mb-5">Judge the appeal against the community guidelines, not the user's political views.</Notice>
      <Tabs label="Appeal status" items={STATUSES.map((s) => ({ href: `/admin/appeals?status=${s}`, label: s[0].toUpperCase() + s.slice(1), active: s === status }))} />
      {!rows.length ? (
        <Empty title={`No ${status} appeals`} />
      ) : (
        <ol className="space-y-4">
          {rows.map(({ appeal, action, userName }) => (
            <li key={appeal.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{userName ?? "Unnamed user"}</span>
                  <Badge tone="warn">{action.action.replace(/_/g, " ")}</Badge>
                  {action.moderatorId === actor.id && <Badge>Your original decision</Badge>}
                  <span className="text-xs text-ink-3">Appealed <Time value={appeal.createdAt} /></span>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-ink-3">Original action</dt>
                    <dd>
                      {action.action.replace(/_/g, " ")} on <Time value={action.createdAt} />
                      {action.expiresAt && <> · until <Time value={action.expiresAt} /></>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-ink-3">Moderator's reason</dt>
                    <dd>{action.reason}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-ink-3">User's appeal</dt>
                    <dd className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3">{appeal.body}</dd>
                  </div>
                  {appeal.resolution && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-ink-3">Resolution</dt>
                      <dd>{appeal.resolution}{appeal.resolvedAt && <> · <Time value={appeal.resolvedAt} /></>}</dd>
                    </div>
                  )}
                </dl>
                {status === "open" && <div className="mt-4"><AppealForm appealId={appeal.id} /></div>}
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
