"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import type { ScaleConfig } from "@/server/db/schema";

type Choice = { type: "scale"; value: number } | { type: "uncertain" };

/**
 * Seven-point scale plus a separate "don't know" option. Selecting does not
 * submit; only the explicit button does. Rows share one neutral style.
 */
export function RatingForm({
  questionId,
  questionVersion,
  questionText,
  scale,
  slug,
  signedIn,
  existing,
}: {
  questionId: string;
  questionVersion: number;
  questionText: string;
  scale: ScaleConfig;
  slug: string;
  signedIn: boolean;
  existing?: Choice | null;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | null>(existing ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updating = !!existing;
  const key = (c: Choice | null) => (c ? (c.type === "scale" ? `s${c.value}` : "u") : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!choice || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (updating) await api(`/api/questions/${questionId}/ratings`, { method: "PATCH", body: { response: choice } });
      else await api(`/api/questions/${questionId}/ratings`, { body: { questionVersion, response: choice } });
      router.push(`/stories/${slug}/results`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const options: { k: string; label: string; c: Choice }[] = scale.labels.map((label, i) => ({ k: `s${i + scale.min}`, label, c: { type: "scale", value: i + scale.min } }));

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-5" aria-describedby="rating-help">
      <fieldset disabled={busy}>
        <legend className="font-serif text-xl font-semibold leading-snug">{questionText}</legend>
        <p id="rating-help" className="mt-1 text-sm text-ink-2">
          {updating ? "Change your answer if your view has changed. Your original answer stays in your private history." : "Choose the answer closest to your view. You'll see how others responded after you submit."}
        </p>
        <div role="radiogroup" aria-label="Your response" className="mt-4 space-y-2">
          {options.map((o) => (
            <Option key={o.k} id={o.k} label={o.label} selected={key(choice) === o.k} onSelect={() => setChoice(o.c)} />
          ))}
        </div>
        {scale.allowUncertain && (
          <div className="mt-3 border-t border-line pt-3">
            <Option id="u" label={scale.uncertainLabel} selected={key(choice) === "u"} onSelect={() => setChoice({ type: "uncertain" })} />
          </div>
        )}
      </fieldset>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      {signedIn ? (
        <button type="submit" disabled={!choice || busy || (updating && key(choice) === key(existing ?? null))} className="mt-4 min-h-12 w-full rounded-xl bg-accent text-base font-semibold text-accent-ink disabled:opacity-50">
          {busy ? "Submitting…" : updating ? "Update my view" : "Submit my view"}
        </button>
      ) : (
        <div className="mt-4 space-y-2">
          <Link href={`/signup?next=/stories/${slug}`} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-accent text-base font-semibold text-accent-ink">
            Create a free account to submit
          </Link>
          <p className="text-center text-sm text-ink-2">
            Already have one? <Link href={`/login?next=/stories/${slug}`} className="font-semibold underline">Sign in</Link>
          </p>
        </div>
      )}
    </form>
  );
}

function Option({ id, label, selected, onSelect }: { id: string; label: string; selected: boolean; onSelect: () => void }) {
  return (
    <label htmlFor={`opt-${id}`} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-base transition ${selected ? "border-ink bg-surface-2 font-semibold ring-1 ring-ink" : "border-line hover:bg-surface-2"}`}>
      <input id={`opt-${id}`} type="radio" name="response" checked={selected} onChange={onSelect} className="size-5 accent-[var(--ink)]" />
      {label}
    </label>
  );
}
