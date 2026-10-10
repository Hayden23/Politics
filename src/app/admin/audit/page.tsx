import Link from "next/link";
import { requireStaff } from "../_lib/guard";
import { auditLog } from "@/server/services/admin";
import { Button, Empty, PageHeader, inputClass, labelClass } from "@/components/ui";
import { JsonDetails, TableWrap, Time, tdClass, thClass } from "@/components/admin/bits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  const sp = await searchParams;
  const entity = sp.entity && UUID.test(sp.entity.trim()) ? sp.entity.trim() : undefined;
  const actor = await requireStaff("/admin/audit");
  const rows = await auditLog(actor, { entityId: entity, limit: 300 });

  return (
    <div>
      <PageHeader kicker="Oversight" title="Audit log">
        Every editorial, moderation and role change, newest first.
      </PageHeader>

      <form method="get" className="mb-5 flex flex-wrap items-end gap-2" role="search">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <label htmlFor="entity" className={labelClass}>Filter by entity id</label>
          <input id="entity" name="entity" defaultValue={sp.entity ?? ""} className={inputClass} placeholder="Story, comment, user or appeal id" />
        </div>
        <Button type="submit" variant="secondary">Filter</Button>
        {entity && <Link href="/admin/audit" className="min-h-11 px-2 py-2.5 text-sm font-semibold underline">Clear</Link>}
      </form>
      {sp.entity && !entity && <p role="alert" className="mb-4 text-sm text-warn">That isn't a valid id; showing everything.</p>}

      {!rows.length ? (
        <Empty title="No audit entries" />
      ) : (
        <TableWrap label="Audit log">
          <table className="w-full min-w-[760px] border-collapse">
            <caption className="sr-only">Audit log entries{entity ? ` for ${entity}` : ""}</caption>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Time</th>
                <th scope="col" className={thClass}>Actor</th>
                <th scope="col" className={thClass}>Action</th>
                <th scope="col" className={thClass}>Entity</th>
                <th scope="col" className={thClass}>Before</th>
                <th scope="col" className={thClass}>After</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ log, actorName }) => (
                <tr key={log.id}>
                  <td className={`${tdClass} whitespace-nowrap text-ink-2`}><Time value={log.createdAt} /></td>
                  <td className={tdClass}>{actorName ?? (log.actorId ? "Unknown" : "System")}</td>
                  <td className={`${tdClass} font-medium`}>{log.action}</td>
                  <td className={tdClass}>
                    <span className="text-ink-2">{log.entityType}</span>{" "}
                    {log.entityType === "story" ? (
                      <Link href={`/admin/stories/${log.entityId}`} className="font-mono text-xs underline">{log.entityId.slice(0, 8)}</Link>
                    ) : (
                      <Link href={`/admin/audit?entity=${log.entityId}`} className="font-mono text-xs underline">{log.entityId.slice(0, 8)}</Link>
                    )}
                  </td>
                  <td className={tdClass}><JsonDetails label="Show" value={log.beforeState} /></td>
                  <td className={tdClass}><JsonDetails label="Show" value={log.afterState} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
