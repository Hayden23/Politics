"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/client";

/** Wraps an API call: busy flag, inline error/success messages, and a server refresh on success. */
export function useMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, opts: { success?: string; refresh?: boolean } = {}): Promise<T | undefined> => {
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        const out = await fn();
        if (opts.success) setMessage(opts.success);
        if (opts.refresh !== false) router.refresh();
        return out;
      } catch (e) {
        setError(e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong");
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  return { busy, error, message, run, setError, setMessage };
}

/** Polite live region for success, assertive alert for errors. Always rendered so screen readers pick up changes. */
export function StatusLine({ error, message, className = "" }: { error?: string | null; message?: string | null; className?: string }) {
  return (
    <div className={className}>
      <p aria-live="polite" className="text-sm text-ink-2">{message ?? ""}</p>
      <p role="alert" className="text-sm font-medium text-warn">{error ?? ""}</p>
    </div>
  );
}
