"use client";
import { useRouter } from "next/navigation";

export function GuestButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="min-h-12 w-full rounded-xl font-semibold text-ink-2 hover:bg-surface-2"
      onClick={() => {
        document.cookie = `cl_welcomed=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
        router.push("/");
      }}
    >
      Continue as guest
    </button>
  );
}
