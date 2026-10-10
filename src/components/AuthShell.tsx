import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/brand";

/** Centered single-column layout shared by sign-in, sign-up, onboarding and appeal. */
export function AuthShell({ title, intro, children, wide }: { title: string; intro?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <main id="main" className={`mx-auto flex min-h-dvh flex-col justify-center px-6 py-12 ${wide ? "max-w-xl" : "max-w-md"}`}>
      <Link href="/" className="self-start font-serif text-lg font-semibold">{APP_NAME}</Link>
      <h1 className="mt-6 font-serif text-3xl font-semibold leading-tight">{title}</h1>
      {intro && <div className="mt-2 text-ink-2">{intro}</div>}
      <div className="mt-6">{children}</div>
      <p className="mt-10 text-xs text-ink-3">
        <Link href="/guidelines" className="underline">Community guidelines</Link> · <Link href="/privacy" className="underline">Privacy</Link> · <Link href="/terms" className="underline">Terms</Link>
      </p>
    </main>
  );
}

export function ErrorText({ id, children }: { id: string; children: ReactNode }) {
  return <p id={id} role="alert" className="mt-1.5 text-sm text-danger">{children}</p>;
}
