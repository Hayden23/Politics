export type Lean = "left" | "lean_left" | "center" | "lean_right" | "right" | "unrated";
export type LeanBucket = "left" | "center" | "right" | "unrated";

export const LEAN_LABELS: Record<Lean, string> = {
  left: "Left",
  lean_left: "Lean left",
  center: "Center",
  lean_right: "Lean right",
  right: "Right",
  unrated: "Not rated",
};

export function leanBucket(l: Lean | null | undefined): LeanBucket {
  if (l === "left" || l === "lean_left") return "left";
  if (l === "right" || l === "lean_right") return "right";
  if (l === "center") return "center";
  return "unrated";
}

/** Self-identification → ideology group used for opt-in breakdowns. Other answers are excluded. */
export type IdeologyGroup = "left" | "center" | "right";
export function ideologyGroup(selfId: string | null | undefined): IdeologyGroup | null {
  switch (selfId) {
    case "very liberal":
    case "liberal":
      return "left";
    case "moderate":
      return "center";
    case "conservative":
    case "very conservative":
      return "right";
    default:
      return null;
  }
}

export const IDEOLOGY_LABELS: Record<IdeologyGroup, string> = {
  left: "Self-identified liberals",
  center: "Self-identified moderates",
  right: "Self-identified conservatives",
};
