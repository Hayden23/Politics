import { requireAdmin } from "../_lib/guard";
import { searchUsers } from "@/server/services/admin";
import { Badge, Button, Empty, PageHeader, inputClass, labelClass } from "@/components/ui";
import { TableWrap, Time, tdClass, thClass } from "@/components/admin/bits";
import { RoleSelect } from "@/components/admin/ModerationForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").slice(0, 200);
  const actor = await requireAdmin("/admin/users");
  const rows = await searchUsers(actor, q);

  return (
    <div>
      <PageHeader kicker="Oversight" title="Users & roles">
        Role changes sign the user out so new permissions apply on their next sign-in.
      </PageHeader>
      <form method="get" role="search" className="mb-5 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <label htmlFor="q" className={labelClass}>Search by email or display name</label>
          <input id="q" name="q" type="search" defaultValue={q} className={inputClass} />
        </div>
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      <p aria-live="polite" className="mb-3 text-sm text-ink-2">{q.trim() ? `${rows.length} result${rows.length === 1 ? "" : "s"} for “${q}”.` : "Showing staff accounts. Search to find anyone."}</p>
      {!rows.length ? (
        <Empty title="No users found" />
      ) : (
        <TableWrap label="Users">
          <table className="w-full min-w-[720px] border-collapse">
            <caption className="sr-only">Users</caption>
            <thead>
              <tr>
                <th scope="col" className={thClass}>User</th>
                <th scope="col" className={thClass}>Status</th>
                <th scope="col" className={thClass}>Joined</th>
                <th scope="col" className={thClass}>Role</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className={tdClass}>
                    <p className="font-semibold">{u.displayName ?? "Unnamed"}{u.id === actor.id && <span className="ml-1 text-xs font-normal text-ink-3">(you)</span>}</p>
                    <p className="break-all text-ink-2">{u.email ?? "—"}</p>
                  </td>
                  <td className={tdClass}><Badge tone={u.accountStatus === "active" ? "neutral" : "warn"}>{u.accountStatus}</Badge></td>
                  <td className={`${tdClass} whitespace-nowrap text-ink-2`}><Time value={u.createdAt} /></td>
                  <td className={tdClass}>
                    {u.accountStatus === "deleted" ? <span className="text-ink-3">{u.role}</span> : <RoleSelect userId={u.id} role={u.role} name={u.displayName ?? u.email ?? "this user"} self={u.id === actor.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
