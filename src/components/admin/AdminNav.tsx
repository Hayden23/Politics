"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export type NavItem = { href: string; label: string; group: string };

function isActive(path: string, status: string | null, href: string) {
  const [p, q] = href.split("?");
  if (p === "/admin") return path === "/admin";
  if (q) {
    const want = new URLSearchParams(q).get("status");
    return path === p && status === want;
  }
  if (p === "/admin/stories") return path === p && !status;
  return path === p || path.startsWith(`${p}/`);
}

function useActive() {
  const path = usePathname();
  const params = useSearchParams();
  return (href: string) => isActive(path, params.get("status"), href);
}

export function AdminSidebar({ items }: { items: NavItem[] }) {
  const active = useActive();
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <nav aria-label="Newsroom" className="space-y-5">
      {groups.map((g) => (
        <div key={g}>
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-ink-3">{g}</p>
          <ul className="mt-1 space-y-0.5">
            {items
              .filter((i) => i.group === g)
              .map((i) => {
                const on = active(i.href);
                return (
                  <li key={i.href}>
                    <Link href={i.href} aria-current={on ? "page" : undefined} className={`flex min-h-10 items-center rounded-lg px-3 text-sm font-medium ${on ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}>
                      {i.label}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminTopNav({ items }: { items: NavItem[] }) {
  const active = useActive();
  return (
    <nav aria-label="Newsroom" className="overflow-x-auto">
      <ul className="flex gap-1.5 px-4 pb-3">
        {items.map((i) => {
          const on = active(i.href);
          return (
            <li key={i.href} className="shrink-0">
              <Link href={i.href} aria-current={on ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm font-medium ${on ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2"}`}>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Static fallback while search params resolve (no active state). */
export function AdminNavFallback({ items, variant }: { items: NavItem[]; variant: "side" | "top" }) {
  return (
    <nav aria-label="Newsroom" className={variant === "top" ? "overflow-x-auto" : ""}>
      <ul className={variant === "top" ? "flex gap-1.5 px-4 pb-3" : "space-y-0.5"}>
        {items.map((i) => (
          <li key={i.href} className="shrink-0">
            <Link href={i.href} className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-ink-2">{i.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
