"use client";
import { useState } from "react";
import { api } from "@/lib/client";

/** Follow/unfollow a topic. Followed topics drive new-briefing notifications. */
export function FollowTopic({ slug, name, initialTopics }: { slug: string; name: string; initialTopics: string[] }) {
  const [topics, setTopics] = useState(initialTopics);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = topics.includes(slug);

  async function toggle() {
    const next = on ? topics.filter((t) => t !== slug) : [...topics, slug];
    setBusy(true);
    setError(null);
    try {
      await api("/api/me/settings", { method: "PATCH", body: { topics: next } });
      setTopics(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={on}
        className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition disabled:opacity-60 ${on ? "border-ink bg-surface-2 text-ink" : "border-line bg-surface text-ink hover:bg-surface-2"}`}
      >
        <span aria-hidden>{on ? "✓" : "+"}</span>
        {on ? "Following" : `Follow ${name}`}
      </button>
      <p className="text-xs text-ink-3" aria-live="polite">
        {error ? <span role="alert" className="text-danger">{error}</span> : on ? `We'll notify you about new ${name} briefings.` : "Get notified about new briefings on this topic."}
      </p>
    </div>
  );
}
