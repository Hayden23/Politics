/**
 * Publication state machine. The server checks every transition here; the
 * database additionally refuses a published story with no approver.
 */
export type StoryStatus = "draft" | "in_review" | "approved" | "published" | "unpublished" | "archived";
export type StoryAction = "edit" | "submit_review" | "approve" | "request_changes" | "publish" | "correct" | "unpublish" | "archive" | "restore";

const transitions: Record<StoryAction, { from: StoryStatus[]; to: StoryStatus | null }> = {
  // Editing unpublished content always returns it to draft so it must be re-approved.
  edit: { from: ["draft", "in_review", "approved", "unpublished"], to: "draft" },
  submit_review: { from: ["draft"], to: "in_review" },
  approve: { from: ["in_review"], to: "approved" },
  request_changes: { from: ["in_review", "approved"], to: "draft" },
  publish: { from: ["approved"], to: "published" },
  // A correction is an approved edit applied by an editor to live content.
  correct: { from: ["published"], to: "published" },
  unpublish: { from: ["published"], to: "unpublished" },
  archive: { from: ["draft", "in_review", "approved", "published", "unpublished"], to: "archived" },
  restore: { from: ["archived"], to: "draft" },
};

export function canTransition(from: StoryStatus, action: StoryAction): boolean {
  return transitions[action].from.includes(from);
}

export function nextStatus(from: StoryStatus, action: StoryAction): StoryStatus {
  if (!canTransition(from, action)) throw new Error(`Cannot ${action.replace("_", " ")} a story that is ${from.replace("_", " ")}`);
  return transitions[action].to ?? from;
}

export const PUBLIC_STATUSES: StoryStatus[] = ["published"];
