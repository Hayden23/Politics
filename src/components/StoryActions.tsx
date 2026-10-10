"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, sendEvent } from "@/lib/client";

export function BookmarkButton({ storyId, initial, signedIn }: { storyId: string; initial: boolean; signedIn: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function toggle() {
    if (!signedIn) return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
    setBusy(true);
    try {
      if (on) await api(`/api/me/bookmarks/${storyId}`, { method: "DELETE" });
      else await api("/api/me/bookmarks", { body: { storyId } });
      setOn(!on);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={on} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-ink-2 hover:bg-surface-2">
      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8"><path d="M6 4h12v16l-6-4-6 4V4Z" /></svg>
      {on ? "Saved" : "Save"}
    </button>
  );
}

export function ShareButton({ storyId, headline }: { storyId: string; headline: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    // Shares the story link only — never the sharer's answer.
    const url = location.href.replace(/\/(results|sources|discussion)$/, "");
    try {
      if (navigator.share) await navigator.share({ title: headline, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      sendEvent("story_shared", storyId);
    } catch {}
  }
  return (
    <button type="button" onClick={share} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-ink-2 hover:bg-surface-2">
      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" /></svg>
      {copied ? "Link copied" : "Share"}
    </button>
  );
}

const STORY_REASONS = [
  ["factual_error", "A fact is wrong"],
  ["missing_context", "Important context is missing"],
  ["framing_concern", "The framing seems slanted"],
  ["source_identity_leak", "It reveals the source before I rate"],
  ["broken_link", "A source link is broken"],
  ["other", "Something else"],
] as const;
const COMMENT_REASONS = [
  ["spam", "Spam or advertising"],
  ["harassment", "Harassment or personal attack"],
  ["hate", "Hate based on identity"],
  ["threat_or_violence", "Threats or incitement to violence"],
  ["personal_information", "Shares someone's private information"],
  ["impersonation", "Impersonation"],
  ["other", "Something else"],
] as const;

export function ReportButton({ targetType, targetId, signedIn, compact }: { targetType: "story" | "comment"; targetId: string; signedIn: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | string>("idle");
  const router = useRouter();
  const reasons = targetType === "story" ? STORY_REASONS : COMMENT_REASONS;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    try {
      await api("/api/reports", { body: { targetType, targetId, reason, details: details || undefined } });
      setState("done");
    } catch (err) {
      setState((err as Error).message);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (signedIn ? setOpen(true) : router.push(`/login?next=${encodeURIComponent(location.pathname)}`))}
        className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-ink-3 hover:bg-surface-2 ${compact ? "min-h-8 px-2 text-xs" : ""}`}
      >
        {targetType === "story" ? "Report an issue" : "Report"}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby={`report-${targetId}`} className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {state === "done" ? (
              <div>
                <h2 id={`report-${targetId}`} className="text-lg font-semibold">Thanks — we'll take a look</h2>
                <p className="mt-2 text-sm text-ink-2">{targetType === "story" ? "Editors review every report about a briefing." : "A moderator will review this against the community guidelines."}</p>
                <button className="mt-4 min-h-11 w-full rounded-xl bg-ink font-semibold text-bg" onClick={() => setOpen(false)}>Close</button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <h2 id={`report-${targetId}`} className="text-lg font-semibold">{targetType === "story" ? "Report a problem with this briefing" : "Report this comment"}</h2>
                {targetType === "comment" && <p className="mt-1 text-sm text-ink-2">Disagreeing with a view isn't a reason to report it.</p>}
                <fieldset className="mt-4 space-y-1">
                  <legend className="sr-only">Reason</legend>
                  {reasons.map(([v, l]) => (
                    <label key={v} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface-2">
                      <input type="radio" name="reason" value={v} checked={reason === v} onChange={() => setReason(v)} className="size-4" />
                      <span className="text-sm">{l}</span>
                    </label>
                  ))}
                </fieldset>
                <label className="mt-3 block text-sm font-semibold" htmlFor={`details-${targetId}`}>Details (optional)</label>
                <textarea id={`details-${targetId}`} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-xl border border-line bg-surface p-3 text-sm" />
                {state !== "idle" && state !== "busy" && <p role="alert" className="mt-2 text-sm text-danger">{state}</p>}
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="min-h-11 flex-1 rounded-xl border border-line font-semibold">Cancel</button>
                  <button type="submit" disabled={!reason || state === "busy"} className="min-h-11 flex-1 rounded-xl bg-ink font-semibold text-bg disabled:opacity-50">Submit report</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
