"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="mx-auto flex min-h-[60dvh] max-w-md flex-col justify-center px-6 py-12">
      <div role="alert">
        <h1 className="font-serif text-3xl font-semibold leading-tight">Something went wrong</h1>
        <p className="mt-2 text-ink-2">We couldn't load this page. It's probably temporary — please try again.</p>
        {error.digest && <p className="mt-2 text-xs text-ink-3">Reference: {error.digest}</p>}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 font-semibold text-accent-ink">Try again</button>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 font-semibold">Go to Discover</Link>
      </div>
    </main>
  );
}
