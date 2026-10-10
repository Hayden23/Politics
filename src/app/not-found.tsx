import Link from "next/link";
import { APP_NAME } from "@/lib/brand";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="self-start font-serif text-lg font-semibold">{APP_NAME}</Link>
      <p className="mt-8 text-sm font-semibold uppercase tracking-wider text-ink-3">404</p>
      <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight">We couldn't find that page</h1>
      <p className="mt-2 text-ink-2">The link may be mistyped, or the briefing may have been withdrawn by editors.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/" className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 font-semibold text-accent-ink">Go to Discover</Link>
        <Link href="/explore" className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 font-semibold">Explore questions</Link>
      </div>
    </main>
  );
}
