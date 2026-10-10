import Link from "next/link";
import { APP_NAME, TAGLINE } from "@/lib/brand";
import { GuestButton } from "./GuestButton";

export const metadata = { title: "Welcome" };

const steps = [
  { n: 1, t: "Read the briefing", d: "A short, neutral summary of the issue — with no publisher name and no one else's opinion." },
  { n: 2, t: "Give your view", d: "Answer one question on a seven-point scale, or say you don't know enough yet." },
  { n: 3, t: "See the bigger picture", d: "Then see how other participants answered, read their reasons, and check the original reporting." },
];

export default function Welcome() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <p className="font-serif text-lg font-semibold">{APP_NAME}</p>
      <h1 className="mt-6 font-serif text-4xl font-semibold leading-tight">{TAGLINE}</h1>
      <p className="mt-3 text-lg text-ink-2">Read the story. Form your opinion. Then see how others responded.</p>
      <ol className="mt-8 space-y-5">
        {steps.map((s) => (
          <li key={s.n} className="flex gap-4">
            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink font-semibold text-bg">{s.n}</span>
            <div>
              <p className="font-semibold">{s.t}</p>
              <p className="text-sm text-ink-2">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-8 rounded-2xl border border-line bg-surface p-4 text-sm text-ink-2">
        <p><strong className="text-ink">Your answers are private.</strong> We never show individual responses, never sell political data, and never ask for your party. Every briefing is reviewed by a human editor; sources are always disclosed after you answer.</p>
        <p className="mt-2"><Link href="/privacy" className="underline">Privacy</Link> · <Link href="/methodology" className="underline">How results work</Link></p>
      </div>
      <div className="mt-8 space-y-3">
        <Link href="/signup" className="flex min-h-12 items-center justify-center rounded-xl bg-accent font-semibold text-accent-ink">Create an account</Link>
        <Link href="/login" className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface font-semibold">Sign in</Link>
        <GuestButton />
      </div>
    </main>
  );
}
