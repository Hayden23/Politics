import type { ReactNode } from "react";

/** Long-form reading layout for policy and explainer pages. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4 leading-relaxed text-ink [&_a]:underline [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:font-semibold [&_li]:mt-1.5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
      {children}
    </div>
  );
}

export function DraftNotice() {
  return (
    <div role="note" className="mb-6 rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">
      <strong>Draft — pending legal review.</strong> This plain-language summary describes how the app works today. It is not yet a final legal document.
    </div>
  );
}
