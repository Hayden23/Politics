"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Discover", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/explore", label: "Explore", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm4 5-2.5 5.5L8 16l2.5-5.5L16 8Z" },
  { href: "/me", label: "My Views", icon: "M5 4h14v16l-7-4-7 4V4Z" },
  { href: "/community", label: "Community", icon: "M4 5h16v10H9l-5 4V5Z" },
  { href: "/profile", label: "Profile", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" },
];

function active(path: string, href: string) {
  return href === "/" ? path === "/" || path.startsWith("/stories") : path.startsWith(href);
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map((i) => {
          const on = active(path, i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={on ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? "text-ink" : "text-ink-3"}`}>
                <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
                  <path d={i.icon} />
                </svg>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Bell({ unread, current }: { unread: number; current: boolean }) {
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";
  return (
    <Link
      href="/notifications"
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className={`relative inline-flex size-11 items-center justify-center rounded-lg transition ${current ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}
    >
      <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" />
        <path d="M10 20.5a2 2 0 0 0 4 0" />
      </svg>
      {unread > 0 && (
        <span aria-hidden className="absolute right-1 top-1 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold leading-[1.15rem] text-bg tabular-nums">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

export function MainWidth({ children }: { children: React.ReactNode }) {
  // Story pages get a wider canvas on desktop (two-column briefing, side-by-side perspectives, map).
  const wide = usePathname().startsWith("/stories/");
  return (
    <main id="main" className={`mx-auto w-full px-4 pb-28 pt-6 md:pb-16 ${wide ? "max-w-3xl lg:max-w-5xl" : "max-w-3xl"}`}>
      {children}
    </main>
  );
}

export function TopNav({ appName, signedIn, staff, unread = 0 }: { appName: string; signedIn: boolean; staff: boolean; unread?: number }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <Link href="/" className="inline-flex min-h-11 items-center rounded-lg font-serif text-lg font-semibold tracking-tight">
          {appName}
        </Link>
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex gap-1">
            {items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} aria-current={active(path, i.href) ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition ${active(path, i.href) ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2/60 hover:text-ink"}`}>
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {staff && (
            <Link href="/admin" className="inline-flex min-h-11 items-center rounded-lg px-3 font-medium text-ink-2 hover:text-ink">
              Newsroom
            </Link>
          )}
          {signedIn && <Bell unread={unread} current={path.startsWith("/notifications")} />}
          {!signedIn && (
            <Link href="/login" className="inline-flex min-h-11 items-center rounded-lg bg-ink px-3 font-semibold text-bg hover:opacity-90">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
