"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export function RemoveBookmark({ storyId, headline }: { storyId: string; headline: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={busy}
        aria-label={`Remove “${headline}” from saved`}
        className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-50"
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api(`/api/me/bookmarks/${storyId}`, { method: "DELETE" });
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? "Removing…" : "Remove"}
      </button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </>
  );
}
