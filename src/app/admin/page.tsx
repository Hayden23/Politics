import Link from "next/link";
import { requireStaff } from "./_lib/guard";
import { dashboardCounts } from "@/server/services/admin";
import { isAdmin, isEditor, isModerator } from "@/server/auth/roles";
import { LinkButton, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const actor = await requireStaff("/admin");
  const c = await dashboardCounts();
  const ed = isEditor(actor);
  const mod = isModerator(actor);
  const n = (s: string) => c.byStatus[s] ?? 0;

  const tiles = [
    ...(ed
      ? [
          { label: "New candidates", value: c.newCandidates, href: "/admin/candidates" },
          { label: "Drafts", value: n("draft"), href: "/admin/stories?status=draft" },
          { label: "In review", value: n("in_review"), href: "/admin/stories?status=in_review" },
          { label: "Approved, not yet published", value: n("approved"), href: "/admin/stories?status=approved" },
          { label: "Published", value: n("published"), href: "/admin/stories?status=published" },
          { label: "Unpublished", value: n("unpublished"), href: "/admin/stories?status=unpublished" },
          { label: "Archived", value: n("archived"), href: "/admin/stories?status=archived" },
        ]
      : []),
    ...(mod || ed ? [{ label: mod ? "Open & escalated reports" : "Open & escalated reports (all types)", value: c.openReports, href: "/admin/reports" }] : []),
    ...(mod ? [{ label: "Open appeals", value: c.openAppeals, href: "/admin/appeals" }] : []),
  ];

  return (
    <div>
      <PageHeader kicker="Newsroom" title="Dashboard">
        Everything waiting on a human decision. Counts update on each visit.
      </PageHeader>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className="block h-full rounded-2xl border border-line bg-surface p-4 transition hover:bg-surface-2">
              <span className="block text-3xl font-semibold tabular-nums">{t.value.toLocaleString("en-US")}</span>
              <span className="mt-1 block text-sm text-ink-2">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-8" aria-labelledby="quick">
        <h2 id="quick" className="text-lg font-semibold">Quick links</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {ed && <LinkButton href="/admin/stories/new">New story</LinkButton>}
          {ed && <LinkButton variant="secondary" href="/admin/candidates">Review candidates</LinkButton>}
          {ed && <LinkButton variant="secondary" href="/admin/stories?status=in_review">Review queue</LinkButton>}
          {ed && <LinkButton variant="secondary" href="/admin/sources">Broken source links</LinkButton>}
          {(mod || ed) && <LinkButton variant="secondary" href="/admin/reports">Report queue</LinkButton>}
          {mod && <LinkButton variant="secondary" href="/admin/appeals">Appeals</LinkButton>}
          <LinkButton variant="secondary" href="/admin/audit">Audit log</LinkButton>
          <LinkButton variant="secondary" href="/admin/metrics">Metrics</LinkButton>
          {isAdmin(actor) && <LinkButton variant="secondary" href="/admin/users">Users &amp; roles</LinkButton>}
        </div>
      </section>
    </div>
  );
}
