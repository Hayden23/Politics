"use client";
import { Chip } from "@/components/ui";
import { sendEvent } from "@/lib/client";

export type PerspectiveKey = "all" | "different" | "insightful" | "newest";

const OPTIONS: { k: PerspectiveKey; label: string }[] = [
  { k: "all", label: "All" },
  { k: "different", label: "Different responses" },
  { k: "insightful", label: "Most insightful" },
  { k: "newest", label: "Newest" },
];

export function PerspectiveChips({ slug, storyId, current }: { slug: string; storyId: string; current: PerspectiveKey }) {
  return (
    <nav aria-label="Filter explanations" aria-describedby="perspective-help" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {OPTIONS.map((o) => (
        <Chip
          key={o.k}
          href={o.k === "all" ? `/stories/${slug}/discussion` : `/stories/${slug}/discussion?perspective=${o.k}`}
          active={current === o.k}
          scroll={false}
          className="min-h-11"
          onClick={() => {
            if (o.k !== current) sendEvent("perspective_explored", storyId, { filter: o.k });
          }}
        >
          {o.label}
        </Chip>
      ))}
    </nav>
  );
}
