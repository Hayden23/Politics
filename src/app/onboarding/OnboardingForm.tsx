"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button } from "@/components/ui";
import { DemographicsFields, demoPayload, emptyDemo, type Demo } from "@/components/DemographicsFields";

const STEPS = ["How it works", "Topics to follow", "About you (optional)"] as const;

const HOW = [
  ["Read the briefing", "Each story is summarized neutrally, without publisher names or anyone else's opinion."],
  ["Share your view", "Answer one question on a 7-point scale — or say you don't know enough yet. Your answer is private."],
  ["Then see the rest", "Results, how the left and right see it, breakdowns, the original sources and the discussion unlock after you answer."],
] as const;

export function OnboardingForm({ topics, next }: { topics: { slug: string; name: string }[]; next: string }) {
  const id = useId();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [demo, setDemo] = useState<Demo>(emptyDemo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  // Move focus to the new step's heading so keyboard and screen-reader users land in the right place.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  async function finish(opts: { topics: string[]; consent: boolean }) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/onboarding", {
        body: { topics: opts.topics, demographicsConsent: opts.consent, demographics: opts.consent ? demoPayload(demo) : undefined },
      });
      router.push(next);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const last = step === STEPS.length - 1;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (last) finish({ topics: picked, consent });
        else setStep(step + 1);
      }}
    >
      <div className="mb-6">
        <p className="text-sm font-semibold text-ink-2">
          Step {step + 1} of {STEPS.length}
        </p>
        <ol className="mt-2 grid grid-cols-3 gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <li key={s} className={`h-1.5 rounded-full transition ${i <= step ? "bg-ink" : "bg-surface-2"}`} />
          ))}
        </ol>
      </div>

      <h2 ref={heading} tabIndex={-1} className="font-serif text-2xl font-semibold">{STEPS[step]}</h2>

      {step === 0 && (
        <ol className="mt-4 space-y-4">
          {HOW.map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold">{i + 1}</span>
              <span>
                <span className="block font-semibold">{t}</span>
                <span className="mt-0.5 block text-sm text-ink-2">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {step === 1 && (
        <fieldset className="mt-2">
          <legend className="text-sm text-ink-2">Pick any topics you'd like to follow. We'll notify you when new briefings are published in them. You'll still see every topic.</legend>
          <div className="mt-4 flex flex-wrap gap-2">
            {topics.map((t) => {
              const on = picked.includes(t.slug);
              return (
                <label key={t.slug} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium transition has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)] ${on ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2"}`}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(t.slug)} />
                  {on && <span aria-hidden>✓</span>}
                  {t.name}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {step === 2 && (
        <fieldset className="mt-2">
          <legend className="sr-only">Optional demographics</legend>
          <div className="space-y-2 text-sm text-ink-2">
            <p>
              Sharing a few details powers <strong className="text-ink">opt-in breakdowns</strong> — for example, how answers differ by state, age or political self-identification. Only people who agree are counted, only in aggregate, and only once a group has enough responses.
            </p>
            <p>These details are never public, never shown on your profile or comments, and never used to label you. You can change or delete them anytime in your Profile.</p>
          </div>
          <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-describedby={`${id}-consent`} className="mt-0.5 size-5 shrink-0 accent-[var(--ink)]" />
            <span>
              <span className="text-sm font-semibold">I consent to storing the optional details I choose below and including them in anonymous breakdowns</span>
              <span id={`${id}-consent`} className="block text-xs text-ink-3">Leave this unchecked to skip. Every field also has “Prefer not to say”.</span>
            </span>
          </label>
          {consent && (
            <div className="mt-4">
              <DemographicsFields value={demo} onChange={setDemo} idPrefix={`${id}-d`} />
            </div>
          )}
        </fieldset>
      )}

      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-8 flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" className="min-h-12 text-base sm:flex-1" disabled={busy}>
          {busy ? "Saving…" : last ? "Start reading" : step === 0 ? "Get started" : "Continue"}
        </Button>
        {step > 0 && (
          <Button type="button" variant="secondary" className="min-h-12" disabled={busy} onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
      </div>
      <div className="mt-2 flex justify-center">
        {step === 0 ? (
          <Button type="button" variant="ghost" className="min-h-12" disabled={busy} onClick={() => finish({ topics: [], consent: false })}>
            Skip for now
          </Button>
        ) : step === 1 ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-12"
            disabled={busy}
            onClick={() => {
              setPicked([]);
              setStep(2);
            }}
          >
            Skip this step
          </Button>
        ) : (
          <Button type="button" variant="ghost" className="min-h-12" disabled={busy} onClick={() => finish({ topics: picked, consent: false })}>
            Skip and start reading
          </Button>
        )}
      </div>
    </form>
  );
}
