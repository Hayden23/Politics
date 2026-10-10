"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client";
import { ReportButton } from "@/components/StoryActions";
import { Badge, Button, Empty, Notice } from "@/components/ui";

type Comment = {
  id: string;
  parentId: string | null;
  body: string | null;
  status: "active" | "removed" | "deleted" | string;
  author: { id: string; name: string } | null;
  authorRating: { type: string; value: number | null; label: string } | null;
  insightful: number;
  reactedByMe: boolean;
  mine: boolean;
  canEdit: boolean;
  edited: boolean;
  createdAt: string;
};
type Thread = Comment & { replies: Comment[] };

const MIN = 10;
const MAX = 2000;

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function message(e: unknown) {
  if (e instanceof ApiError && e.status === 403) return `${e.message} Restricted accounts can still read and rate.`;
  if (e instanceof ApiError && e.status === 401) return "Your session ended. Sign in again to continue.";
  return (e as Error).message;
}

export function Discussion({
  questionId,
  storyId: _storyId,
  comments,
  signedIn,
  canPost,
  closed,
  restrictedUntil,
  editWindowHours,
  empty,
}: {
  questionId: string;
  storyId: string;
  comments: Thread[];
  signedIn: boolean;
  canPost: boolean;
  closed: boolean;
  restrictedUntil: string | null;
  editWindowHours: number;
  empty: { title: string; body: string };
}) {
  const router = useRouter();
  return (
    <div className="mt-6">
      {!closed && (
        <div className="mb-8">
          {!signedIn ? null : canPost ? (
            <Composer
              label="What is the main reason behind your position?"
              submitLabel="Post explanation"
              onSubmit={async (body) => {
                await api(`/api/questions/${questionId}/comments`, { body: { body } });
                router.refresh();
              }}
              note={
                <>
                  Whether your answer is shown next to your comment is up to you — change it in <Link href="/profile#privacy" className="underline">Profile → Privacy</Link>. Please follow the <Link href="/guidelines" className="underline">community guidelines</Link>.
                </>
              }
            />
          ) : (
            <Notice tone="warn">
              Your account can't post right now{restrictedUntil ? ` (until ${restrictedUntil})` : ""}. You can still read and rate. See <Link href="/profile#standing" className="underline">Account standing</Link> for details or to appeal.
            </Notice>
          )}
        </div>
      )}

      {comments.length === 0 ? (
        <Empty title={empty.title}>{empty.body}</Empty>
      ) : (
        <ul className="space-y-4" aria-label="Explanations">
          {comments.map((c) => (
            <li key={c.id}>
              <CommentCard c={c} signedIn={signedIn} canPost={canPost} editWindowHours={editWindowHours} />
              {c.replies.length > 0 && (
                <ul className="mt-2 space-y-2 border-l-2 border-line pl-4 sm:ml-4" aria-label={`Replies to ${c.author?.name ?? "comment"}`}>
                  {c.replies.map((r) => (
                    <li key={r.id}>
                      <CommentCard c={r} signedIn={signedIn} canPost={canPost} editWindowHours={editWindowHours} isReply threadId={c.id} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Composer({
  label,
  submitLabel,
  onSubmit,
  onCancel,
  initial = "",
  note,
  compact,
  autoFocus,
}: {
  label: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
  initial?: string;
  note?: React.ReactNode;
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [body, setBody] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const len = body.trim().length;
  const tooShort = len > 0 && len < MIN;
  const tooLong = body.length > MAX;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (len < MIN || tooLong || busy) {
      setError(len < MIN ? `Share a bit more — at least ${MIN} characters.` : `Keep it under ${MAX.toLocaleString("en-US")} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(body.trim());
      setBody("");
      onCancel?.();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  const describedBy = [`${id}-count`, note ? `${id}-note` : null, error ? `${id}-err` : null].filter(Boolean).join(" ");
  return (
    <form onSubmit={submit} className={compact ? "mt-3" : "rounded-2xl border border-line bg-surface p-5"} noValidate>
      <label htmlFor={`${id}-body`} className={compact ? "sr-only" : "block font-semibold"}>{label}</label>
      <textarea
        id={`${id}-body`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={compact ? 3 : 4}
        maxLength={MAX + 200}
        autoFocus={autoFocus}
        placeholder={compact ? label : "Explain your reasoning in a few sentences."}
        aria-describedby={describedBy}
        aria-invalid={!!error || tooLong || undefined}
        className={`${compact ? "" : "mt-2"} w-full rounded-xl border border-line bg-surface p-3 text-base text-ink placeholder:text-ink-3`}
      />
      <div className="mt-1 flex items-start justify-between gap-3">
        <p id={`${id}-count`} aria-live="polite" className={`text-xs tabular-nums ${tooLong || tooShort ? "text-warn" : "text-ink-3"}`}>
          {body.length.toLocaleString("en-US")} / {MAX.toLocaleString("en-US")}
          {tooShort && ` · at least ${MIN} characters`}
        </p>
      </div>
      {error && <p id={`${id}-err`} role="alert" className="mt-1 text-sm text-danger">{error}</p>}
      {note && <p id={`${id}-note`} className="mt-2 text-xs text-ink-3">{note}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || len < MIN || tooLong}>{busy ? "Posting…" : submitLabel}</Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}

const actionBtn = "inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-50";

function CommentCard({ c, signedIn, canPost, editWindowHours, isReply, threadId }: { c: Comment; signedIn: boolean; canPost: boolean; editWindowHours: number; isReply?: boolean; threadId?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "reply" | "edit" | "confirm-delete" | "confirm-block">("view");
  const [reacted, setReacted] = useState(c.reactedByMe);
  const [count, setCount] = useState(c.insightful);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gone = c.status !== "active";

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleInsightful() {
    if (!signedIn) return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
    const prev = { reacted, count };
    setReacted(!reacted);
    setCount(count + (reacted ? -1 : 1));
    setError(null);
    try {
      const r = await api<{ reacted: boolean }>(`/api/comments/${c.id}/reactions`, { method: "POST" });
      setReacted(r.reacted);
      setCount(prev.count + (r.reacted === prev.reacted ? 0 : r.reacted ? 1 : -1));
    } catch (e) {
      setReacted(prev.reacted);
      setCount(prev.count);
      setError(message(e));
    }
  }

  if (gone) {
    return (
      <article className={`rounded-2xl border border-dashed border-line px-5 py-4 text-sm italic text-ink-3 ${isReply ? "py-3" : ""}`}>
        {c.status === "removed" ? "[removed by a moderator]" : "[deleted]"}
      </article>
    );
  }

  const name = c.author?.name ?? "Reader";
  return (
    <article className={`rounded-2xl border border-line bg-surface ${isReply ? "p-4" : "p-5"}`} aria-label={`Comment by ${name}`}>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="font-semibold">{name}{c.mine && <span className="ml-1 text-xs font-medium text-ink-3">(you)</span>}</p>
        {c.authorRating && <Badge>Answered: {c.authorRating.label}</Badge>}
        <p className="text-xs text-ink-3">
          <time dateTime={c.createdAt} title={new Date(c.createdAt).toLocaleString("en-US")}>{timeAgo(c.createdAt)}</time>
          {c.edited && " · edited"}
        </p>
      </header>

      {mode === "edit" ? (
        <Composer
          compact
          autoFocus
          label="Edit your comment"
          submitLabel="Save changes"
          initial={c.body ?? ""}
          onCancel={() => setMode("view")}
          onSubmit={async (body) => {
            await api(`/api/comments/${c.id}`, { method: "PATCH", body: { body } });
            router.refresh();
          }}
        />
      ) : (
        <p className="mt-2 whitespace-pre-line break-words leading-relaxed">{c.body}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-2">
        {!c.mine && (
          <button type="button" onClick={toggleInsightful} aria-pressed={reacted} className={`${actionBtn} ${reacted ? "font-semibold text-ink" : ""}`}>
            <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill={reacted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" className="mr-1.5"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z" /></svg>
            Insightful{count > 0 && <span className="ml-1 tabular-nums">· {count}</span>}
          </button>
        )}
        {c.mine && count > 0 && <span className="px-2.5 text-sm text-ink-3">{count} found this insightful</span>}
        {canPost && (
          <button type="button" className={actionBtn} onClick={() => setMode(mode === "reply" ? "view" : "reply")} aria-expanded={mode === "reply"}>
            Reply
          </button>
        )}
        {c.mine ? (
          <>
            {c.canEdit && mode !== "edit" && <button type="button" className={actionBtn} onClick={() => setMode("edit")}>Edit</button>}
            <button type="button" className={actionBtn} onClick={() => setMode("confirm-delete")}>Delete</button>
          </>
        ) : (
          signedIn && (
            <>
              <ReportButton targetType="comment" targetId={c.id} signedIn={signedIn} compact />
              <button type="button" className={actionBtn} disabled={busy} onClick={() => run(() => api(`/api/comments/${c.id}/hide`, { method: "POST" }))}>
                Hide
              </button>
              {c.author && <button type="button" className={actionBtn} onClick={() => setMode("confirm-block")}>Block author</button>}
            </>
          )
        )}
      </div>
      {c.mine && c.canEdit && mode === "view" && <p className="mt-1 text-xs text-ink-3">You can edit for {editWindowHours} hours after posting and delete at any time.</p>}

      {mode === "confirm-delete" && (
        <div role="alertdialog" aria-labelledby={`del-${c.id}`} className="mt-3 rounded-xl bg-surface-2 p-4">
          <p id={`del-${c.id}`} className="text-sm font-semibold">Delete this comment? This can't be undone.</p>
          {!isReply && <p className="mt-1 text-xs text-ink-2">Replies from others will stay, under a “[deleted]” placeholder.</p>}
          <div className="mt-3 flex gap-2">
            <Button variant="danger" disabled={busy} onClick={() => run(() => api(`/api/comments/${c.id}`, { method: "DELETE" })).then((ok) => ok && setMode("view"))}>
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setMode("view")}>Cancel</Button>
          </div>
        </div>
      )}
      {mode === "confirm-block" && c.author && (
        <div role="alertdialog" aria-labelledby={`blk-${c.id}`} className="mt-3 rounded-xl bg-surface-2 p-4">
          <p id={`blk-${c.id}`} className="text-sm font-semibold">Block {name}?</p>
          <p className="mt-1 text-xs text-ink-2">You won't see their comments anywhere. They aren't notified. You can unblock them in your Profile.</p>
          <div className="mt-3 flex gap-2">
            <Button variant="danger" disabled={busy} onClick={() => run(() => api(`/api/users/${c.author!.id}/block`, { method: "POST" }))}>
              Block
            </Button>
            <Button variant="ghost" onClick={() => setMode("view")}>Cancel</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}

      {mode === "reply" && (
        <Composer
          compact
          autoFocus
          label={`Reply to ${name}`}
          submitLabel="Post reply"
          onCancel={() => setMode("view")}
          onSubmit={async (body) => {
            await api(`/api/comments/${threadId ?? c.id}/replies`, { body: { body } });
            router.refresh();
          }}
        />
      )}
    </article>
  );
}
