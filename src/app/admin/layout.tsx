import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "./_lib/guard";
import { isAdmin, isEditor, isModerator } from "@/server/auth/roles";
import { AdminNavFallback, AdminSidebar, AdminTopNav, type NavItem } from "@/components/admin/AdminNav";
import { Badge } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Newsroom", template: `%s · Newsroom · ${APP_NAME}` }, robots: { index: false, follow: false } };

const ROLE_LABEL = { user: "Reader", moderator: "Moderator", editor: "Editor", admin: "Admin" } as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireStaff("/admin");
  const ed = isEditor(actor);
  const mod = isModerator(actor);
  const items: NavItem[] = [
    { href: "/admin", label: "Dashboard", group: "Overview" },
    ...(ed
      ? [
          { href: "/admin/candidates", label: "Candidates", group: "Editorial" },
          { href: "/admin/stories?status=draft", label: "Drafts", group: "Editorial" },
          { href: "/admin/stories?status=in_review", label: "In review", group: "Editorial" },
          { href: "/admin/stories?status=approved", label: "Approved", group: "Editorial" },
          { href: "/admin/stories?status=published", label: "Published", group: "Editorial" },
          { href: "/admin/corrections", label: "Corrections", group: "Editorial" },
          { href: "/admin/stories?status=archived", label: "Archived", group: "Editorial" },
          { href: "/admin/sources", label: "Sources", group: "Editorial" },
          { href: "/admin/publishers", label: "Publishers", group: "Editorial" },
        ]
      : []),
    ...(mod || ed ? [{ href: "/admin/reports", label: mod ? "Reports" : "Story reports", group: "Moderation" }] : []),
    ...(mod ? [{ href: "/admin/appeals", label: "Appeals", group: "Moderation" }] : []),
    { href: "/admin/audit", label: "Audit log", group: "Oversight" },
    ...(isAdmin(actor) ? [{ href: "/admin/users", label: "Users", group: "Oversight" }] : []),
    { href: "/admin/metrics", label: "Metrics", group: "Oversight" },
  ];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link href="/admin" className="font-serif text-lg font-semibold tracking-tight">Newsroom</Link>
          <Badge>{ROLE_LABEL[actor.role]}</Badge>
          <span className="hidden truncate text-sm text-ink-3 sm:inline">{actor.displayName ?? actor.email}</span>
          <Link href="/" className="ml-auto rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink">
            <span aria-hidden>←</span> Back to {APP_NAME}
          </Link>
        </div>
        <div className="md:hidden">
          <Suspense fallback={<AdminNavFallback items={items} variant="top" />}>
            <AdminTopNav items={items} />
          </Suspense>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-8 px-4">
        <aside className="hidden w-52 shrink-0 py-6 md:block">
          <div className="sticky top-20">
            <Suspense fallback={<AdminNavFallback items={items} variant="side" />}>
              <AdminSidebar items={items} />
            </Suspense>
          </div>
        </aside>
        <main id="main" className="min-w-0 flex-1 pb-16 pt-6">
          {children}
        </main>
      </div>
    </div>
  );
}
