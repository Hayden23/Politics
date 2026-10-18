"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button } from "@/components/ui";

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/me/notifications", { body: {} });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-2">
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="button" variant="secondary" onClick={run} disabled={busy}>{busy ? "Marking…" : "Mark all read"}</Button>
    </div>
  );
}

/** Opening a notification marks it read (best effort) before navigating. */
export function NotificationLink({ id, href, unread, className, children }: { id: string; href: string; unread: boolean; className: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        if (unread) api("/api/me/notifications", { body: { ids: [id] } }).catch(() => {});
      }}
    >
      {children}
    </Link>
  );
}
