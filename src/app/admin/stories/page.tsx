import Link from "next/link";
import { requireEditor } from "../_lib/guard";
import { listForEditors } from "@/server/services/editorial";
import type { StoryStatus } from "@/domain/storyWorkflow";
import { Empty, LinkButton, PageHeader } from "@/components/ui";
import { STATUS_LABEL, StatusBadge, TableWrap, Tabs, Time, tdClass, thClass } from "@/components/admin/bits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stories" };

const STATUSES: StoryStatus[] = ["draft", "in_review", "approved", "published", "unpublished", "archived"];

export default async function StoriesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as StoryStatus) ? (sp.status as StoryStatus) : undefined;
  await requireEditor(`/admin/stories${status ? `?status=${status}` : ""}`);
  const rows = await listForEditors(status);

  return (
    <div>
      <PageHeader kicker="Editorial" title={status ? STATUS_LABEL[status] : "All stories"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{rows.length === 200 ? "Showing the 200 most recently updated." : `${rows.length} ${rows.length === 1 ? "story" : "stories"}.`}</span>
          <LinkButton href="/admin/stories/new">New story</LinkButton>
        </div>
      </PageHeader>

      <Tabs
        label="Filter by status"
        items={[{ href: "/admin/stories", label: "All", active: !status }, ...STATUSES.map((s) => ({ href: `/admin/stories?status=${s}`, label: STATUS_LABEL[s], active: status === s }))]}
      />

      {!rows.length ? (
        <Empty title="No stories here">{status === "draft" ? <>Start one from a <Link className="underline" href="/admin/candidates">candidate</Link> or write a new story.</> : null}</Empty>
      ) : (
        <TableWrap label="Stories">
          <table className="w-full min-w-[640px] border-collapse">
            <caption className="sr-only">Stories{status ? ` with status ${STATUS_LABEL[status]}` : ""}, most recently updated first</caption>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Headline</th>
                <th scope="col" className={thClass}>Status</th>
                <th scope="col" className={thClass}>Topic</th>
                <th scope="col" className={thClass}>Version</th>
                <th scope="col" className={thClass}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ story: s, topic }) => (
                <tr key={s.id} className="hover:bg-surface-2">
                  <td className={tdClass}>
                    <Link href={`/admin/stories/${s.id}`} className="font-semibold underline-offset-2 hover:underline">{s.headline}</Link>
                    {s.editorialPriority !== 0 && <span className="ml-2 text-xs text-ink-3">priority {s.editorialPriority > 0 ? `+${s.editorialPriority}` : s.editorialPriority}</span>}
                  </td>
                  <td className={tdClass}>
                    <StatusBadge status={s.status} />
                    {s.scheduledPublishAt && (
                      <span className="mt-1 block text-xs font-semibold text-ink-2">
                        Scheduled for <Time value={s.scheduledPublishAt} />
                      </span>
                    )}
                  </td>
                  <td className={`${tdClass} text-ink-2`}>{topic ?? <span className="text-ink-3">No topic</span>}</td>
                  <td className={`${tdClass} tabular-nums text-ink-2`}>v{s.currentVersion}</td>
                  <td className={`${tdClass} whitespace-nowrap text-ink-2`}><Time value={s.updatedAt} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
