export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="animate-pulse motion-reduce:animate-none">
      <span className="sr-only">Loading…</span>
      <div aria-hidden>
        <div className="h-3 w-32 rounded bg-surface-2" />
        <div className="mt-3 h-8 w-2/3 rounded bg-surface-2" />
        <div className="mt-3 h-4 w-1/2 rounded bg-surface-2" />
        <div className="mt-6 flex gap-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-9 w-20 rounded-full bg-surface-2" />)}
        </div>
        <div className="mt-6 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-line bg-surface p-5">
              <div className="h-3 w-24 rounded bg-surface-2" />
              <div className="mt-3 h-5 w-5/6 rounded bg-surface-2" />
              <div className="mt-2 h-4 w-full rounded bg-surface-2" />
              <div className="mt-2 h-4 w-3/4 rounded bg-surface-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
