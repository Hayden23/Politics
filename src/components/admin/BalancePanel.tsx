"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client";
import { Badge, Button, Card, Notice } from "@/components/ui";
import { formatDateTime } from "./bits";

export type BalanceCheckData = {
  checkedAt: string;
  by: "heuristic" | "ai";
  model?: string;
  issues: { kind: string; excerpt?: string; detail: string; suggestion?: string }[];
  stats?: Record<string, number>;
};

const KIND_LABEL: Record<string, string> = {
  loaded_language: "Loaded language",
  unattributed_claim: "Unattributed claims",
  asymmetry: "Asymmetry between sides",
  uncited_argument: "Arguments without linked sources",
  missing_perspective: "Missing perspective",
  one_sided: "One-sided framing",
  missing_context: "Missing context",
  factual_risk: "Factual risk",
  source_leak: "Possible source leak (publisher identity)",
};
const kindLabel = (k: string) => KIND_LABEL[k] ?? k.replace(/_/g, " ");

const STAT_LABEL: [string, string][] = [
  ["briefingWords", "Briefing words"],
  ["leftWords", "Left words"],
  ["rightWords", "Right words"],
  ["leftArguments", "Left arguments"],
  ["rightArguments", "Right arguments"],
];

export function BalancePanel({ storyId, saved, dirty, savedVersionPublished }: { storyId: string; saved: BalanceCheckData | null; dirty: boolean; savedVersionPublished: boolean }) {
  const router = useRouter();
  const [fresh, setFresh] = useState<BalanceCheckData | null>(null);
  const [busy, setBusy] = useState<"heuristic" | "ai" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(ai: boolean) {
    setBusy(ai ? "ai" : "heuristic");
    setError(null);
    setNotConfigured(null);
    setMessage(null);
    try {
      const out = await api<{ check: BalanceCheckData }>(`/api/admin/stories/${storyId}/balance-check`, { body: { ai } });
      setFresh(out.check);
      setMessage(`${ai ? "AI review" : "Balance check"} finished: ${out.check.issues.length} ${out.check.issues.length === 1 ? "prompt" : "prompts"} to consider.`);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) setNotConfigured(`AI review isn't available: ${e.message}. The heuristic check still works.`);
      else setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">Balance check</h2>
      <p className="mt-1 text-sm text-ink-2">
        Automated prompts for editorial judgment — not verdicts. They flag wording and structure worth a second look; you decide whether anything should change.
      </p>
      {dirty && <p className="mt-2 text-sm text-warn">Checks run on saved content. Save your changes first to include them.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={!!busy} onClick={() => run(false)}>{busy === "heuristic" ? "Checking…" : "Run balance check"}</Button>
        <Button type="button" variant="secondary" disabled={!!busy} onClick={() => run(true)}>{busy === "ai" ? "Reviewing…" : "Run AI review"}</Button>
      </div>
      <div className="mt-2">
        <p aria-live="polite" className="text-sm text-ink-2">{message ?? ""}</p>
        <div aria-live="polite">{notConfigured && <Notice className="mt-1">{notConfigured}</Notice>}</div>
        <p role="alert" className="text-sm font-medium text-warn">{error ?? ""}</p>
      </div>

      {fresh && <CheckResult check={fresh} title="Latest result" />}
      {saved && (!fresh || fresh.checkedAt !== saved.checkedAt) && (
        <CheckResult check={saved} title={fresh ? "Previously saved check" : "Last saved check"} collapsed={!!fresh} />
      )}
      {!fresh && !saved && <p className="mt-3 text-sm text-ink-3">No check has been run on this version yet.</p>}
      {savedVersionPublished && <p className="mt-3 text-xs text-ink-3">This version is published, so new checks are recorded in the audit log rather than on the version.</p>}
    </Card>
  );
}

function CheckResult({ check, title, collapsed }: { check: BalanceCheckData; title: string; collapsed?: boolean }) {
  const groups = new Map<string, BalanceCheckData["issues"]>();
  for (const i of check.issues) groups.set(i.kind, [...(groups.get(i.kind) ?? []), i]);
  const stats = STAT_LABEL.filter(([k]) => typeof check.stats?.[k] === "number");

  const body = (
    <>
      <p className="text-xs text-ink-3">
        {check.by === "ai" ? `AI review${check.model ? ` (${check.model})` : ""} plus heuristics` : "Heuristic check"} · {formatDateTime(check.checkedAt)}
      </p>
      {stats.length > 0 && (
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map(([k, l]) => (
            <div key={k} className="rounded-lg bg-surface-2 px-3 py-2">
              <dt className="text-xs text-ink-3">{l}</dt>
              <dd className="text-lg font-semibold tabular-nums">{check.stats![k]}</dd>
            </div>
          ))}
        </dl>
      )}
      {!check.issues.length ? (
        <p className="mt-3 text-sm text-ink-2">Nothing flagged. That doesn't certify balance — read it once more with fresh eyes.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {[...groups.entries()].map(([kind, items]) => (
            <section key={kind} aria-label={kindLabel(kind)}>
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                {kindLabel(kind)} <Badge>{items.length}</Badge>
              </h4>
              <ul className="mt-1 space-y-2">
                {items.map((i, n) => (
                  <li key={n} className="rounded-lg border border-line p-2.5 text-sm">
                    {i.excerpt && <p className="font-serif">“{i.excerpt}”</p>}
                    <p className={i.excerpt ? "mt-1 text-ink-2" : ""}>{i.detail}</p>
                    {i.suggestion && <p className="mt-1 text-ink-2"><span className="font-semibold text-ink">Consider:</span> {i.suggestion}</p>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );

  if (collapsed) {
    return (
      <details className="mt-4 rounded-xl border border-line p-3">
        <summary className="cursor-pointer text-sm font-semibold">{title} ({check.issues.length} prompts)</summary>
        <div className="mt-2">{body}</div>
      </details>
    );
  }
  return (
    <section className="mt-4 rounded-xl border border-line p-3" aria-label={title}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-1">{body}</div>
    </section>
  );
}
