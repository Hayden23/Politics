import Link from "next/link";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/server/db";
import { stories } from "@/server/db/schema";
import { Time } from "@/components/admin/bits";
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
  // Read-only query local to this page: approved stories waiting on a scheduled publish time, soonest first.
  const scheduled = ed
    ? await db
        .select({ id: stories.id, headline: stories.headline, at: stories.scheduledPublishAt })
        .from(stories)
        .where(and(eq(stories.status, "approved"), isNotNull(stories.scheduledPublishAt)))
        .orderBy(asc(stories.scheduledPublishAt))
        .limit(50)
    : [];

  const tiles = [
    ...(ed
      ? [
          { label: "New candidates", value: c.newCandidates, href: "/admin/candidates" },
          { label: "Drafts", value: n("draft"), href: "/admin/stories?status=draft" },
          { label: "In review", value: n("in_review"), href: "/admin/stories?status=in_review" },
          { label: "Approved, not yet published", value: n("approved"), href: "/admin/stories?status=approved" },
          { label: "Scheduled to publish", value: scheduled.length, href: "#scheduled" },
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

      {ed && (
        <section id="scheduled" className="mt-8 scroll-mt-24" aria-labelledby="scheduled-title">
          <h2 id="scheduled-title" className="text-lg font-semibold">Scheduled</h2>
          {!scheduled.length ? (
            <p className="mt-2 text-sm text-ink-3">Nothing scheduled. Approved stories can be scheduled from the editor.</p>
          ) : (
            <ol className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
              {scheduled.map((s) => (
                <li key={s.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <Link href={`/admin/stories/${s.id}`} className="font-semibold underline-offset-2 hover:underline">{s.headline}</Link>
                  <span className="shrink-0 text-sm tabular-nums text-ink-2"><Time value={s.at} /></span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <section className="mt-8" aria-labelledby="quick">
        <h2 id="quick" className="text-lg font-semibold">Quick links</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {ed && <LinkButton href="/admin/stories/new">New story</LinkButton>}
          {ed && <LinkButton variant="secondary" href="/admin/candidates">Review candidates</LinkButton>}
          {ed && <LinkButton variant="secondary" href="/admin/stories?status=in_review">Review queue</LinkButton>}
          {ed && <LinkButton variant="secondary" href="/admin/sources">Broken source links</LinkButton>}
          {ed && <LinkButton variant="secondary" href="/admin/publishers">Publishers &amp; lean ratings</LinkButton>}
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
