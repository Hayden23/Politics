"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button } from "@/components/ui";
import { DemographicsFields, demoPayload, emptyDemo, type Demo } from "@/components/DemographicsFields";

export function OnboardingForm({ topics, next }: { topics: { slug: string; name: string }[]; next: string }) {
  const id = useId();
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [demo, setDemo] = useState<Demo>(emptyDemo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  async function finish(skipAll: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/onboarding", {
        body: skipAll
          ? { topics: [], demographicsConsent: false }
          : { topics: picked, demographicsConsent: consent, demographics: consent ? demoPayload(demo) : undefined },
      });
      router.push(next);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        finish(false);
      }}
      className="space-y-8"
    >
      <fieldset>
        <legend className="text-lg font-semibold">1. Topics you care about <span className="text-sm font-normal text-ink-3">(optional)</span></legend>
        <p className="mt-1 text-sm text-ink-2">We'll lean your daily briefing toward these. You'll still see every topic.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {topics.map((t) => {
            const on = picked.includes(t.slug);
            return (
              <label key={t.slug} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)] ${on ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2"}`}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(t.slug)} />
                {on && <span aria-hidden>✓</span>}
                {t.name}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-semibold">2. About you <span className="text-sm font-normal text-ink-3">(optional)</span></legend>
        <p className="mt-1 text-sm text-ink-2">
          If you share these, we can later show how answers differ across groups — only in aggregate, and only once enough people have answered. They are stored separately from your account, never shown publicly, and never used to label you. Political self-identification is entirely optional and is never shown to anyone.
        </p>
        <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 py-2">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-describedby={`${id}-consent`} className="mt-0.5 size-5 shrink-0 accent-[var(--ink)]" />
          <span>
            <span className="text-sm font-semibold">I consent to storing the optional details I choose below</span>
            <span id={`${id}-consent`} className="block text-xs text-ink-3">Leave this unchecked to skip. You can delete these details anytime in your Profile.</span>
          </span>
        </label>
        {consent && (
          <div className="mt-3">
            <DemographicsFields value={demo} onChange={setDemo} idPrefix={`${id}-d`} />
          </div>
        )}
      </fieldset>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <div className="space-y-2">
        <Button type="submit" className="min-h-12 w-full text-base" disabled={busy}>{busy ? "Saving…" : "Start reading"}</Button>
        <Button type="button" variant="ghost" className="min-h-12 w-full" disabled={busy} onClick={() => finish(true)}>Skip for now</Button>
      </div>
    </form>
  );
}
