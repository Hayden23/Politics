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

export function TopNav({ appName, signedIn, staff }: { appName: string; signedIn: boolean; staff: boolean }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <Link href="/" className="font-serif text-lg font-semibold tracking-tight">
          {appName}
        </Link>
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex gap-1">
            {items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} aria-current={active(path, i.href) ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-medium ${active(path, i.href) ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"}`}>
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {staff && (
            <Link href="/admin" className="rounded-lg px-3 py-2 font-medium text-ink-2 hover:text-ink">
              Newsroom
            </Link>
          )}
          {!signedIn && (
            <Link href="/login" className="rounded-lg bg-ink px-3 py-2 font-semibold text-bg">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
