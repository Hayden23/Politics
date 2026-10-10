"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/client";
import { canTransition, type StoryAction, type StoryStatus } from "@/domain/storyWorkflow";
import { Badge, Button, Card, Notice, inputClass, labelClass } from "@/components/ui";
import { StatusLine, useMutation } from "./useMutation";

// ───────────── Data passed from the server page ─────────────

export type Fact = { text: string; sourceIds?: string[] };

export type EditorData = {
  story: {
    id: string;
    slug: string;
    status: StoryStatus;
    headline: string;
    briefing: string;
    keyFacts: Fact[];
    disputedClaims: Fact[];
    uncertainties: Fact[];
    topicId: string | null;
    eventAt: string | null;
    editorialPriority: number;
    currentVersion: number;
  };
  editorialNotes: string | null;
  aiDraft: Record<string, unknown> | null;
  currentVersionPublished: boolean;
  questions: { id: string; version: number; status: "draft" | "published" | "retired"; questionText: string; allowUncertain: boolean; supportGrouping: boolean; createdAt: string; publishedAt: string | null; retiredAt: string | null }[];
  sources: {
    id: string;
    publisherName: string;
    originalHeadline: string | null;
    author: string | null;
    sourceUrl: string;
    sourceType: string;
    publishedAt: string | null;
    rightsStatus: string | null;
    relationshipType: string;
    claimsSupported: string[];
    linkStatus: string;
  }[];
  problems: string[];
  topics: { id: string; name: string }[];
};

const SOURCE_TYPES = [
  ["news_article", "News article"],
  ["primary_document", "Primary document"],
  ["government_data", "Government data"],
  ["analysis", "Analysis"],
  ["other", "Other"],
] as const;
const RELATIONSHIPS = [
  ["primary_evidence", "Primary evidence"],
  ["factual_reporting", "Factual reporting"],
  ["analysis", "Analysis"],
  ["contextual_background", "Contextual background"],
] as const;
const label = (pairs: readonly (readonly [string, string])[], k: string) => pairs.find((p) => p[0] === k)?.[1] ?? k;

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const cleanFacts = (xs: Fact[]) => xs.map((f) => ({ ...f, text: f.text.trim() })).filter((f) => f.text);
const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

// ───────────── AI draft normalisation (stored JSON is untyped) ─────────────

type DraftFact = { text: string; sourceRefs: number[] };
type Draft = {
  headline: string | null;
  briefing: string | null;
  keyFacts: DraftFact[];
  disputedClaims: DraftFact[];
  uncertainties: DraftFact[];
  questionSuggestions: string[];
  loadedWording: { phrase: string; suggestion: string }[];
  needsVerification: string[];
  missingContext: string[];
  model: string | null;
  generatedAt: string | null;
  material: { ref: number; publisher: string; url: string | null }[];
};

function toDraft(x: unknown): Draft | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && !!s.trim()) : []);
  const facts = (v: unknown): DraftFact[] =>
    Array.isArray(v)
      ? v
          .map((f) => (typeof f === "string" ? { text: f, sourceRefs: [] } : f && typeof f === "object" ? { text: String((f as { text?: unknown }).text ?? ""), sourceRefs: Array.isArray((f as { sourceRefs?: unknown }).sourceRefs) ? ((f as { sourceRefs: unknown[] }).sourceRefs.filter((n) => typeof n === "number") as number[]) : [] } : null))
          .filter((f): f is DraftFact => !!f && !!f.text.trim())
      : [];
  return {
    headline: str(o.headline),
    briefing: str(o.briefing),
    keyFacts: facts(o.keyFacts),
    disputedClaims: facts(o.disputedClaims),
    uncertainties: facts(o.uncertainties),
    questionSuggestions: strs(o.questionSuggestions),
    loadedWording: Array.isArray(o.loadedWording)
      ? o.loadedWording.filter((w): w is { phrase: string; suggestion: string } => !!w && typeof w === "object" && typeof (w as { phrase?: unknown }).phrase === "string").map((w) => ({ phrase: w.phrase, suggestion: String(w.suggestion ?? "") }))
      : [],
    needsVerification: strs(o.needsVerification),
    missingContext: strs(o.missingContext),
    model: str(o.model),
    generatedAt: str(o.generatedAt),
    material: Array.isArray(o.material)
      ? o.material.filter((m): m is { ref: number; publisher: string; url: string | null } => !!m && typeof m === "object").map((m) => ({ ref: Number(m.ref), publisher: String(m.publisher ?? ""), url: typeof m.url === "string" ? m.url : null }))
      : [],
  };
}

// ───────────── Editor ─────────────

type Content = {
  headline: string;
  topicId: string;
  eventAt: string;
  editorialPriority: number;
  briefing: string;
  keyFacts: Fact[];
  disputedClaims: Fact[];
  uncertainties: Fact[];
  editorialNotes: string;
};

export function StoryEditor({ data }: { data: EditorData }) {
  const { story } = data;
  const status = story.status;
  const published = status === "published";
  const archived = status === "archived";

  const initial: Content = useMemo(
    () => ({
      headline: story.headline,
      topicId: story.topicId ?? "",
      eventAt: dateInput(story.eventAt),
      editorialPriority: story.editorialPriority,
      briefing: story.briefing,
      keyFacts: story.keyFacts,
      disputedClaims: story.disputedClaims,
      uncertainties: story.uncertainties,
      editorialNotes: data.editorialNotes ?? "",
    }),
    // Only the first render seeds the form; later refreshes keep the editor's in-progress text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [baseline, setBaseline] = useState<Content>(initial);
  const [c, setC] = useState<Content>(initial);
  const set = <K extends keyof Content>(k: K, v: Content[K]) => setC((p) => ({ ...p, [k]: v }));
  const dirty = JSON.stringify(c) !== JSON.stringify(baseline);

  // Question form state lives here so AI suggestions can be copied into it.
  const latestQ = data.questions[data.questions.length - 1];
  const [qText, setQText] = useState(latestQ?.questionText ?? "");
  const [qUncertain, setQUncertain] = useState(latestQ?.allowUncertain ?? true);
  const [qGrouping, setQGrouping] = useState(latestQ?.supportGrouping ?? true);
  const [reviseQuestion, setReviseQuestion] = useState(false);

  const [copyNote, setCopyNote] = useState<string | null>(null);
  const copied = (what: string) => setCopyNote(`Copied ${what} into the form. Review it, then save — nothing has been saved yet.`);

  const topics = data.topics;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        {copyNote && <Notice>{copyNote}</Notice>}

        <ContentForm
          data={data}
          c={c}
          set={set}
          dirty={dirty}
          topics={topics}
          baseline={baseline}
          onSaved={() => setBaseline(c)}
          question={{ text: qText, allowUncertain: qUncertain, supportGrouping: qGrouping, setText: setQText, setUncertain: setQUncertain, setGrouping: setQGrouping, revise: reviseQuestion, setRevise: setReviseQuestion }}
        />

        <SourcesPanel data={data} />

        <AiPanel
          data={data}
          onUse={{
            headline: (v) => { set("headline", v); copied("the headline"); },
            briefing: (v) => { set("briefing", v); copied("the briefing"); },
            facts: (k, items, replace) => {
              setC((p) => ({ ...p, [k]: replace ? items.map((text) => ({ text })) : [...p[k], ...items.map((text) => ({ text }))] }));
              copied(k === "keyFacts" ? "key facts" : k === "disputedClaims" ? "disputed claims" : "uncertainties");
            },
            question: (v) => {
              setQText(v);
              if (published) setReviseQuestion(true);
              copied("the question suggestion");
            },
          }}
          disabled={published || archived}
        />
      </div>

      <div className="min-w-0 space-y-6">
        <WorkflowPanel data={data} dirty={dirty} />
        <QuestionPanel
          data={data}
          text={qText}
          setText={setQText}
          allowUncertain={qUncertain}
          setAllowUncertain={setQUncertain}
          supportGrouping={qGrouping}
          setSupportGrouping={setQGrouping}
        />
      </div>
    </div>
  );
}

// ───────────── Content / correction form ─────────────

type QuestionState = {
  text: string;
  allowUncertain: boolean;
  supportGrouping: boolean;
  setText: (s: string) => void;
  setUncertain: (b: boolean) => void;
  setGrouping: (b: boolean) => void;
  revise: boolean;
  setRevise: (b: boolean) => void;
};

function ContentForm({
  data,
  c,
  set,
  dirty,
  topics,
  baseline,
  onSaved,
  question,
}: {
  data: EditorData;
  c: Content;
  set: <K extends keyof Content>(k: K, v: Content[K]) => void;
  dirty: boolean;
  topics: { id: string; name: string }[];
  baseline: Content;
  onSaved: () => void;
  question: QuestionState;
}) {
  const { story } = data;
  const published = story.status === "published";
  const archived = story.status === "archived";
  const m = useMutation();
  const [correctionNote, setCorrectionNote] = useState("");
  const words = wordCount(c.briefing);
  const inRange = words >= 100 && words <= 250;
  const topicList = topics.some((t) => t.id === c.topicId) || !c.topicId ? topics : [...topics, { id: c.topicId, name: "Current topic (inactive)" }];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (published) return correct();
    const ok = await m.run(
      () =>
        api(`/api/admin/stories/${story.id}`, {
          method: "PATCH",
          body: {
            headline: c.headline,
            briefing: c.briefing,
            keyFacts: cleanFacts(c.keyFacts),
            disputedClaims: cleanFacts(c.disputedClaims),
            uncertainties: cleanFacts(c.uncertainties),
            topicId: c.topicId || null,
            eventAt: c.eventAt || null,
            editorialPriority: c.editorialPriority,
            editorialNotes: c.editorialNotes.trim() ? c.editorialNotes : null,
          },
        }),
      { success: "Saved." },
    );
    if (ok) onSaved();
  }

  async function correct() {
    const body: Record<string, unknown> = { correctionNote };
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    if (c.headline !== baseline.headline) body.headline = c.headline;
    if (c.briefing !== baseline.briefing) body.briefing = c.briefing;
    if (!same(c.keyFacts, baseline.keyFacts)) body.keyFacts = cleanFacts(c.keyFacts);
    if (!same(c.disputedClaims, baseline.disputedClaims)) body.disputedClaims = cleanFacts(c.disputedClaims);
    if (!same(c.uncertainties, baseline.uncertainties)) body.uncertainties = cleanFacts(c.uncertainties);
    if (c.topicId !== baseline.topicId) body.topicId = c.topicId || null;
    if (c.editorialNotes !== baseline.editorialNotes) body.editorialNotes = c.editorialNotes.trim() ? c.editorialNotes : null;
    if (question.revise) body.question = { questionText: question.text, allowUncertain: question.allowUncertain, supportGrouping: question.supportGrouping };
    const ok = await m.run(() => api(`/api/admin/stories/${story.id}/correct`, { body }), { success: "Correction published as a new version." });
    if (ok) {
      onSaved();
      setCorrectionNote("");
      question.setRevise(false);
    }
  }

  const willReset = !published && ["in_review", "approved"].includes(story.status);

  return (
    <Card>
      <form onSubmit={save} aria-labelledby="content-title">
        <h2 id="content-title" className="text-lg font-semibold">{published ? "Content (published — changes go through a correction)" : "Content"}</h2>
        {archived && <Notice className="mt-3">This story is archived. Restore it to edit.</Notice>}
        <fieldset disabled={archived || m.busy} className="mt-4 space-y-4">
          <legend className="sr-only">Story content</legend>
          <div>
            <label htmlFor="ed-headline" className={labelClass}>Headline</label>
            <input id="ed-headline" className={inputClass} required minLength={8} maxLength={160} value={c.headline} onChange={(e) => set("headline", e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="ed-topic" className={labelClass}>Topic</label>
              <select id="ed-topic" className={inputClass} value={c.topicId} onChange={(e) => set("topicId", e.target.value)}>
                <option value="">No topic</option>
                {topicList.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ed-event" className={labelClass}>Event date</label>
              <input id="ed-event" type="date" className={inputClass} value={c.eventAt} onChange={(e) => set("eventAt", e.target.value)} disabled={published} aria-describedby={published ? "ed-locked" : undefined} />
            </div>
            <div>
              <label htmlFor="ed-priority" className={labelClass}>Editorial priority</label>
              <input id="ed-priority" type="number" min={-10} max={10} step={1} className={inputClass} value={c.editorialPriority} onChange={(e) => set("editorialPriority", Math.max(-10, Math.min(10, Math.trunc(Number(e.target.value) || 0))))} disabled={published} aria-describedby="ed-priority-help" />
              <p id="ed-priority-help" className="mt-1 text-xs text-ink-3">−10 to 10; 0 is normal. Never based on opinions.</p>
            </div>
          </div>
          {published && <p id="ed-locked" className="text-xs text-ink-3">Event date and priority aren't part of a correction.</p>}
          <div>
            <label htmlFor="ed-briefing" className={labelClass}>Briefing</label>
            <textarea id="ed-briefing" rows={12} className={`${inputClass} font-serif leading-relaxed`} maxLength={4000} value={c.briefing} onChange={(e) => set("briefing", e.target.value)} aria-describedby="ed-wc" />
            <p id="ed-wc" className={`mt-1 text-sm tabular-nums ${inRange ? "text-ink-2" : "text-warn"}`}>
              {words} {words === 1 ? "word" : "words"} · target 100–250{words < 100 ? " (too short)" : words > 250 ? " (too long)" : ""}. Separate paragraphs with a blank line.
            </p>
          </div>
          <FactListEditor id="facts" title="Key facts" items={c.keyFacts} onChange={(v) => set("keyFacts", v)} />
          <FactListEditor id="disputed" title="Disputed claims" hint="Attribute each claim to who made it." items={c.disputedClaims} onChange={(v) => set("disputedClaims", v)} />
          <FactListEditor id="uncertain" title="Uncertainties" items={c.uncertainties} onChange={(v) => set("uncertainties", v)} />
          <div>
            <label htmlFor="ed-notes" className={labelClass}>Editorial notes <span className="font-normal text-ink-3">(internal, never shown to readers)</span></label>
            <textarea id="ed-notes" rows={4} className={inputClass} maxLength={4000} value={c.editorialNotes} onChange={(e) => set("editorialNotes", e.target.value)} />
          </div>

          {published && (
            <section id="correction" aria-labelledby="corr-title" className="scroll-mt-24 rounded-2xl border border-line bg-surface-2 p-4">
              <h3 id="corr-title" className="font-semibold">Publish a correction</h3>
              <p className="mt-1 text-sm text-ink-2">Edit the fields above that need to change. A correction creates a new version immediately, with you as the approving editor, and the note below is shown publicly on the sources page.</p>
              <div className="mt-3">
                <label htmlFor="corr-note" className={labelClass}>Public correction note (required)</label>
                <textarea id="corr-note" rows={3} required minLength={10} maxLength={1000} className={inputClass} value={correctionNote} onChange={(e) => setCorrectionNote(e.target.value)} placeholder="What was corrected and why" />
              </div>
              <div className="mt-3">
                <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" className="size-5" checked={question.revise} onChange={(e) => question.setRevise(e.target.checked)} />
                  Also revise the rating question
                </label>
                {question.revise && (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-ink-2">The revised wording becomes a new question version. Existing results stay attached to the original wording.</p>
                    <label htmlFor="corr-q" className={labelClass}>Revised question</label>
                    <textarea id="corr-q" rows={2} required minLength={10} maxLength={300} className={inputClass} value={question.text} onChange={(e) => question.setText(e.target.value)} />
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" className="size-5" checked={question.allowUncertain} onChange={(e) => question.setUncertain(e.target.checked)} />
                      Offer “I don't know enough to judge”
                    </label>
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" className="size-5" checked={question.supportGrouping} onChange={(e) => question.setGrouping(e.target.checked)} />
                      Show support / oppose grouping in results
                    </label>
                  </div>
                )}
              </div>
            </section>
          )}
        </fieldset>

        {!archived && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={m.busy || (!published && !dirty)}>
              {m.busy ? "Saving…" : published ? "Publish correction" : "Save"}
            </Button>
            {dirty && <Badge tone="warn">Unsaved changes</Badge>}
            {willReset && <p className="text-sm text-ink-2">Saving returns this story to draft; it will need approval again.</p>}
            {story.status === "unpublished" && data.currentVersionPublished && <p className="text-sm text-ink-2">Saving starts a new draft version; the previously published text stays on record.</p>}
          </div>
        )}
        <StatusLine className="mt-2" error={m.error} message={m.message} />
      </form>
    </Card>
  );
}

function FactListEditor({ id, title, hint, items, onChange }: { id: string; title: string; hint?: string; items: Fact[]; onChange: (v: Fact[]) => void }) {
  return (
    <fieldset className="rounded-xl border border-line p-3">
      <legend className="px-1 text-sm font-semibold">{title} <span className="font-normal text-ink-3">({items.length}/15)</span></legend>
      {hint && <p className="mb-2 text-xs text-ink-3">{hint}</p>}
      <ol className="space-y-2">
        {items.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <label htmlFor={`${id}-${i}`} className="sr-only">{title} item {i + 1}</label>
            <textarea id={`${id}-${i}`} rows={2} maxLength={600} className={`${inputClass} text-sm`} value={f.text} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
            <Button type="button" variant="ghost" className="shrink-0 px-3" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove ${title.toLowerCase()} item ${i + 1}`}>
              Remove
            </Button>
          </li>
        ))}
      </ol>
      {items.length < 15 && (
        <Button type="button" variant="secondary" className="mt-2" onClick={() => onChange([...items, { text: "" }])}>
          Add {title.toLowerCase().replace(/s$/, "").replace(/ie$/, "y")}
        </Button>
      )}
    </fieldset>
  );
}

// ───────────── Workflow ─────────────

const ACTIONS: { action: StoryAction; path: string; label: string; variant: "primary" | "secondary" | "danger"; needsReady?: boolean; confirm?: string; success: string }[] = [
  { action: "submit_review", path: "submit-review", label: "Submit for review", variant: "primary", needsReady: true, success: "Submitted for review." },
  { action: "approve", path: "approve", label: "Approve", variant: "primary", needsReady: true, success: "Approved." },
  { action: "publish", path: "publish", label: "Publish", variant: "primary", needsReady: true, confirm: "Publish this story to all readers now?", success: "Published." },
  { action: "request_changes", path: "request-changes", label: "Request changes", variant: "secondary", success: "Returned to draft with your note." },
  { action: "restore", path: "restore", label: "Restore to draft", variant: "secondary", success: "Restored to draft." },
  { action: "unpublish", path: "unpublish", label: "Unpublish", variant: "danger", confirm: "Unpublish this story? Readers will no longer be able to open it.", success: "Unpublished." },
  { action: "archive", path: "archive", label: "Archive", variant: "danger", confirm: "Archive this story?", success: "Archived." },
];

function WorkflowPanel({ data, dirty }: { data: EditorData; dirty: boolean }) {
  const { story, problems } = data;
  const m = useMutation();
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const available = ACTIONS.filter((a) => canTransition(story.status, a.action));
  const showReadiness = !["published", "archived"].includes(story.status);

  async function act(a: (typeof ACTIONS)[number]) {
    if (a.action === "request_changes" && !noteOpen) return setNoteOpen(true);
    if (a.confirm && !window.confirm(a.confirm)) return;
    const ok = await m.run(() => api(`/api/admin/stories/${story.id}/${a.path}`, { body: a.action === "request_changes" ? { note } : {} }), { success: a.success });
    if (ok && a.action === "request_changes") {
      setNoteOpen(false);
      setNote("");
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">Workflow</h2>
      {showReadiness && (
        <section aria-labelledby="ready-title" className="mt-3">
          <h3 id="ready-title" className="text-sm font-semibold">Readiness</h3>
          {problems.length ? (
            <ul className="mt-2 space-y-1.5 text-sm">
              {problems.map((p) => (
                <li key={p} className="flex gap-2"><span aria-hidden className="text-warn">○</span><span>{p}</span></li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 flex gap-2 text-sm"><span aria-hidden className="text-accent">✓</span>Ready for review and publication checks.</p>
          )}
          <p className="mt-2 text-xs text-ink-3">Reflects saved content only.</p>
        </section>
      )}

      {dirty && available.some((a) => a.needsReady) && <Notice tone="warn" className="mt-3">Save your changes before moving the story forward.</Notice>}

      <div className="mt-4 flex flex-col gap-2">
        {available.length === 0 && <p className="text-sm text-ink-2">No workflow actions for this status.</p>}
        {available.map((a) => (
          <Button key={a.action} type="button" variant={a.variant} disabled={m.busy || (a.needsReady && (dirty || problems.length > 0))} onClick={() => act(a)}>
            {a.label}
          </Button>
        ))}
      </div>

      {noteOpen && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            act(ACTIONS.find((a) => a.action === "request_changes")!);
          }}
        >
          <label htmlFor="rc-note" className={labelClass}>What needs to change?</label>
          <textarea id="rc-note" rows={3} required minLength={3} maxLength={1000} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" disabled={m.busy || note.trim().length < 3}>Send back to draft</Button>
            <Button type="button" variant="ghost" onClick={() => setNoteOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
      <StatusLine className="mt-2" error={m.error} message={m.message} />
    </Card>
  );
}

// ───────────── Question ─────────────

function QuestionPanel({
  data,
  text,
  setText,
  allowUncertain,
  setAllowUncertain,
  supportGrouping,
  setSupportGrouping,
}: {
  data: EditorData;
  text: string;
  setText: (s: string) => void;
  allowUncertain: boolean;
  setAllowUncertain: (b: boolean) => void;
  supportGrouping: boolean;
  setSupportGrouping: (b: boolean) => void;
}) {
  const { story, questions } = data;
  const m = useMutation();
  const editable = !["published", "archived"].includes(story.status);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await m.run(() => api(`/api/admin/stories/${story.id}/question`, { body: { questionText: text, allowUncertain, supportGrouping } }), { success: "Question saved." });
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">Rating question</h2>
      <p className="mt-1 text-sm text-ink-2">Seven-point support/oppose scale. Ask about the policy or decision, not about people or parties.</p>
      {editable ? (
        <form onSubmit={save} className="mt-3 space-y-2">
          <label htmlFor="q-text" className={labelClass}>Question</label>
          <textarea id="q-text" rows={3} required minLength={10} maxLength={300} className={inputClass} value={text} onChange={(e) => setText(e.target.value)} aria-describedby="q-help" />
          <p id="q-help" className="text-xs text-ink-3">Must end with a question mark.</p>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="size-5" checked={allowUncertain} onChange={(e) => setAllowUncertain(e.target.checked)} />
            Offer “I don't know enough to judge”
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="size-5" checked={supportGrouping} onChange={(e) => setSupportGrouping(e.target.checked)} />
            Show support / oppose grouping in results
          </label>
          {["in_review", "approved"].includes(story.status) && <p className="text-sm text-ink-2">Changing the question returns the story to draft.</p>}
          <Button type="submit" disabled={m.busy}>{m.busy ? "Saving…" : "Save question"}</Button>
          <StatusLine error={m.error} message={m.message} />
        </form>
      ) : (
        <p className="mt-3 text-sm text-ink-2">
          {story.status === "published" ? (
            <>Live questions are never edited. To revise the wording, use the <a href="#correction" className="font-semibold underline">correction form</a>.</>
          ) : (
            "Restore the story to change its question."
          )}
        </p>
      )}

      <h3 className="mt-5 text-sm font-semibold">Versions</h3>
      {!questions.length ? (
        <p className="mt-1 text-sm text-ink-3">No question yet.</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {[...questions].reverse().map((q) => (
            <li key={q.id} className="rounded-xl bg-surface-2 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">v{q.version}</span>
                <Badge tone={q.status === "published" ? "accent" : q.status === "draft" ? "warn" : "neutral"}>{q.status}</Badge>
              </div>
              <p className="mt-1">{q.questionText}</p>
              <p className="mt-1 text-xs text-ink-3">
                {q.allowUncertain ? "Uncertain option on" : "No uncertain option"} · {q.supportGrouping ? "grouping on" : "grouping off"}
                {q.publishedAt && <> · published {new Date(q.publishedAt).toISOString().slice(0, 10)}</>}
                {q.retiredAt && <> · retired {new Date(q.retiredAt).toISOString().slice(0, 10)}</>}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// ───────────── Sources ─────────────

const emptySource = {
  publisherName: "",
  originalHeadline: "",
  author: "",
  sourceUrl: "",
  sourceType: "news_article",
  publishedAt: "",
  rightsStatus: "link_only",
  relationshipType: "factual_reporting",
  claimsSupported: "",
};

function SourcesPanel({ data }: { data: EditorData }) {
  const { story, sources } = data;
  const m = useMutation();
  const add = useMutation();
  const [f, setF] = useState(emptySource);
  const [open, setOpen] = useState(false);
  const canRemove = !["published", "archived"].includes(story.status);
  const canAdd = story.status !== "archived";

  async function remove(id: string, publisher: string) {
    if (!window.confirm(`Remove the ${publisher} source from this version?`)) return;
    await m.run(() => api(`/api/admin/stories/${story.id}/sources/${id}`, { method: "DELETE" }), { success: "Source removed." });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await add.run(
      () =>
        api(`/api/admin/stories/${story.id}/sources`, {
          body: {
            publisherName: f.publisherName,
            originalHeadline: f.originalHeadline.trim() || null,
            author: f.author.trim() || null,
            sourceUrl: f.sourceUrl,
            sourceType: f.sourceType,
            publishedAt: f.publishedAt || null,
            rightsStatus: f.rightsStatus.trim() || null,
            relationshipType: f.relationshipType,
            claimsSupported: f.claimsSupported.split("\n").map((s) => s.trim()).filter(Boolean),
          },
        }),
      { success: "Source attached." },
    );
    if (ok) setF(emptySource);
  }

  const field = (k: keyof typeof emptySource) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value })) });

  return (
    <Card>
      <h2 className="text-lg font-semibold">Sources <span className="text-sm font-normal text-ink-3">(version {story.currentVersion})</span></h2>
      <p className="mt-1 text-sm text-ink-2">Readers see these only after they rate. Publisher names must never appear in the briefing itself.</p>
      {!sources.length ? (
        <p className="mt-3 text-sm text-ink-3">No sources attached.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sources.map((s) => (
            <li key={s.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{s.publisherName}</span>
                <Badge>{label(SOURCE_TYPES, s.sourceType)}</Badge>
                <Badge>{label(RELATIONSHIPS, s.relationshipType)}</Badge>
                <Badge tone={s.linkStatus === "broken" ? "warn" : "neutral"}>link {s.linkStatus}</Badge>
              </div>
              {s.originalHeadline && <p className="mt-1 text-sm">“{s.originalHeadline}”</p>}
              <p className="mt-1 break-all text-sm">
                <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline">{s.sourceUrl}<span className="sr-only"> (opens in a new tab)</span></a>
              </p>
              <p className="mt-1 text-xs text-ink-3">{[s.author, s.publishedAt && s.publishedAt.slice(0, 10), s.rightsStatus].filter(Boolean).join(" · ")}</p>
              {s.claimsSupported.length > 0 && <p className="mt-1 text-xs text-ink-2">Supports: {s.claimsSupported.join("; ")}</p>}
              {canRemove && (
                <Button type="button" variant="danger" className="mt-2" disabled={m.busy} onClick={() => remove(s.id, s.publisherName)}>
                  Remove<span className="sr-only"> {s.publisherName}</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!canRemove && story.status === "published" && <p className="mt-2 text-xs text-ink-3">Sources on a live story can't be removed here; publish a correction instead. New sources can still be added.</p>}
      <StatusLine className="mt-2" error={m.error} message={m.message} />

      {canAdd && (
        <div className="mt-4">
          <Button type="button" variant="secondary" aria-expanded={open} aria-controls="add-source" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide source form" : "Add a source"}
          </Button>
          {open && (
            <form id="add-source" onSubmit={submit} className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="src-pub" className={labelClass}>Publisher</label>
                  <input id="src-pub" required maxLength={200} className={inputClass} {...field("publisherName")} />
                </div>
                <div>
                  <label htmlFor="src-author" className={labelClass}>Author <span className="font-normal text-ink-3">(optional)</span></label>
                  <input id="src-author" maxLength={200} className={inputClass} {...field("author")} />
                </div>
              </div>
              <div>
                <label htmlFor="src-url" className={labelClass}>URL</label>
                <input id="src-url" type="url" required inputMode="url" placeholder="https://" className={inputClass} {...field("sourceUrl")} aria-describedby="src-url-help" />
                <p id="src-url-help" className="mt-1 text-xs text-ink-3">Public https:// links only.</p>
              </div>
              <div>
                <label htmlFor="src-head" className={labelClass}>Original headline <span className="font-normal text-ink-3">(optional)</span></label>
                <input id="src-head" maxLength={400} className={inputClass} {...field("originalHeadline")} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="src-type" className={labelClass}>Source type</label>
                  <select id="src-type" className={inputClass} {...field("sourceType")}>
                    {SOURCE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="src-rel" className={labelClass}>Relationship to the story</label>
                  <select id="src-rel" className={inputClass} {...field("relationshipType")}>
                    {RELATIONSHIPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="src-date" className={labelClass}>Published <span className="font-normal text-ink-3">(optional)</span></label>
                  <input id="src-date" type="date" className={inputClass} {...field("publishedAt")} />
                </div>
                <div>
                  <label htmlFor="src-rights" className={labelClass}>Rights status</label>
                  <input id="src-rights" maxLength={200} className={inputClass} {...field("rightsStatus")} />
                </div>
              </div>
              <div>
                <label htmlFor="src-claims" className={labelClass}>Claims supported <span className="font-normal text-ink-3">(one per line, optional)</span></label>
                <textarea id="src-claims" rows={3} className={inputClass} {...field("claimsSupported")} />
              </div>
              <Button type="submit" disabled={add.busy}>{add.busy ? "Attaching…" : "Attach source"}</Button>
            </form>
          )}
          <StatusLine className="mt-2" error={add.error} message={add.message} />
        </div>
      )}
    </Card>
  );
}

// ───────────── AI draft ─────────────

type Material = { publisher: string; url: string; text: string };
type FactKey = "keyFacts" | "disputedClaims" | "uncertainties";

function AiPanel({
  data,
  onUse,
  disabled,
}: {
  data: EditorData;
  onUse: { headline: (s: string) => void; briefing: (s: string) => void; facts: (k: FactKey, items: string[], replace: boolean) => void; question: (s: string) => void };
  disabled: boolean;
}) {
  const { story } = data;
  const [material, setMaterial] = useState<Material[]>([{ publisher: "", url: "", text: "" }]);
  const [notes, setNotes] = useState("");
  const [generated, setGenerated] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const draft = generated ?? toDraft(data.aiDraft);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setUnavailable(null);
    try {
      const out = await api<{ draft: unknown }>(`/api/admin/stories/${story.id}/generate-draft`, {
        body: { editorNotes: notes, material: material.map((m) => ({ publisher: m.publisher, url: m.url.trim() || null, text: m.text })) },
      });
      setGenerated(toDraft(out.draft));
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) setUnavailable(err.message);
      else setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const upd = (i: number, k: keyof Material, v: string) => setMaterial((ms) => ms.map((m, j) => (j === i ? { ...m, [k]: v } : m)));

  return (
    <Card>
      <h2 className="text-lg font-semibold">AI drafting assistant</h2>
      <p className="mt-1 text-sm text-ink-2">
        Paste material you're licensed to use. The draft is a suggestion stored with this version — it never changes the story until you copy fields into the form and save.
      </p>

      {disabled ? (
        <p className="mt-3 text-sm text-ink-2">{story.status === "published" ? "AI drafts can't be attached to a published version." : "Restore the story to use the assistant."}</p>
      ) : (
        <form onSubmit={generate} className="mt-4 space-y-4">
          {material.map((m, i) => (
            <fieldset key={i} className="rounded-xl border border-line p-3">
              <legend className="px-1 text-sm font-semibold">Source material {i + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={`mat-pub-${i}`} className={labelClass}>Publisher</label>
                  <input id={`mat-pub-${i}`} required maxLength={200} className={inputClass} value={m.publisher} onChange={(e) => upd(i, "publisher", e.target.value)} />
                </div>
                <div>
                  <label htmlFor={`mat-url-${i}`} className={labelClass}>URL <span className="font-normal text-ink-3">(optional)</span></label>
                  <input id={`mat-url-${i}`} type="url" maxLength={2000} className={inputClass} value={m.url} onChange={(e) => upd(i, "url", e.target.value)} />
                </div>
              </div>
              <label htmlFor={`mat-text-${i}`} className={`${labelClass} mt-3`}>Pasted text</label>
              <textarea id={`mat-text-${i}`} required minLength={20} maxLength={20000} rows={5} className={`${inputClass} text-sm`} value={m.text} onChange={(e) => upd(i, "text", e.target.value)} />
              {material.length > 1 && (
                <Button type="button" variant="ghost" className="mt-2" onClick={() => setMaterial((ms) => ms.filter((_, j) => j !== i))}>
                  Remove material {i + 1}
                </Button>
              )}
            </fieldset>
          ))}
          {material.length < 8 && (
            <Button type="button" variant="secondary" onClick={() => setMaterial((ms) => [...ms, { publisher: "", url: "", text: "" }])}>
              Add more material
            </Button>
          )}
          <div>
            <label htmlFor="ai-notes" className={labelClass}>Editor notes for the assistant <span className="font-normal text-ink-3">(optional)</span></label>
            <textarea id="ai-notes" rows={3} maxLength={4000} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy}>{busy ? "Generating…" : draft ? "Generate a new draft" : "Generate draft"}</Button>
          <div aria-live="polite">
            {unavailable && <Notice tone="warn">{unavailable}</Notice>}
          </div>
          <p role="alert" className="text-sm font-medium text-warn">{error ?? ""}</p>
        </form>
      )}

      {draft && <DraftBox draft={draft} onUse={onUse} />}
    </Card>
  );
}

function UseButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" onClick={onClick}>
      {children}
    </Button>
  );
}

function DraftBox({ draft, onUse }: { draft: Draft; onUse: { headline: (s: string) => void; briefing: (s: string) => void; facts: (k: FactKey, items: string[], replace: boolean) => void; question: (s: string) => void } }) {
  const refs = (r: number[]) => (r.length ? <span className="text-xs text-ink-3"> [{r.join(", ")}]</span> : null);
  const factSection = (k: FactKey, title: string, items: DraftFact[]) =>
    items.length > 0 && (
      <section className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">{title}</h4>
          <div className="flex gap-2">
            <UseButton onClick={() => onUse.facts(k, items.map((f) => f.text), true)}>Use this<span className="sr-only"> ({title}, replace current)</span></UseButton>
            <UseButton onClick={() => onUse.facts(k, items.map((f) => f.text), false)}>Append<span className="sr-only"> {title}</span></UseButton>
          </div>
        </div>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {items.map((f, i) => <li key={i}>{f.text}{refs(f.sourceRefs)}</li>)}
        </ul>
      </section>
    );
  const plainList = (title: string, items: string[]) =>
    items.length > 0 && (
      <section className="mt-4">
        <h4 className="text-sm font-semibold">{title}</h4>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{items.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </section>
    );

  return (
    <section aria-labelledby="ai-draft-title" className="mt-5 rounded-2xl border-2 border-warn bg-warn-soft p-4 text-ink">
      <h3 id="ai-draft-title" className="font-semibold text-warn">AI draft — unapproved, verify every claim</h3>
      <p className="mt-1 text-xs text-ink-2">
        {draft.model && <>Model: {draft.model}. </>}
        {draft.generatedAt && <>Generated {new Date(draft.generatedAt).toISOString().replace("T", " ").slice(0, 16)} UTC. </>}
        Copying a field fills the form only; nothing is saved until you press Save.
      </p>
      {draft.material.length > 0 && (
        <p className="mt-1 text-xs text-ink-2">Numbered refs: {draft.material.map((m) => `[${m.ref}] ${m.publisher}`).join(" · ")}</p>
      )}

      {draft.headline && (
        <section className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">Headline</h4>
            <UseButton onClick={() => onUse.headline(draft.headline!)}>Use this<span className="sr-only"> headline</span></UseButton>
          </div>
          <p className="mt-1 font-serif text-lg">{draft.headline}</p>
        </section>
      )}
      {draft.briefing && (
        <section className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">Briefing <span className="font-normal text-ink-3">({wordCount(draft.briefing)} words)</span></h4>
            <UseButton onClick={() => onUse.briefing(draft.briefing!)}>Use this<span className="sr-only"> briefing</span></UseButton>
          </div>
          <div className="mt-1 space-y-2 font-serif text-sm leading-relaxed">
            {draft.briefing.split(/\n\s*\n/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </section>
      )}
      {factSection("keyFacts", "Key facts", draft.keyFacts)}
      {factSection("disputedClaims", "Disputed claims", draft.disputedClaims)}
      {factSection("uncertainties", "Uncertainties", draft.uncertainties)}
      {draft.questionSuggestions.length > 0 && (
        <section className="mt-4">
          <h4 className="text-sm font-semibold">Question suggestions</h4>
          <ul className="mt-1 space-y-2 text-sm">
            {draft.questionSuggestions.map((q, i) => (
              <li key={i} className="flex flex-wrap items-start justify-between gap-2">
                <span className="min-w-0 flex-1">{q}</span>
                <UseButton onClick={() => onUse.question(q)}>Use this<span className="sr-only"> question suggestion {i + 1}</span></UseButton>
              </li>
            ))}
          </ul>
        </section>
      )}
      {draft.loadedWording.length > 0 && (
        <section className="mt-4">
          <h4 className="text-sm font-semibold">Loaded wording found</h4>
          <ul className="mt-1 space-y-1 text-sm">
            {draft.loadedWording.map((w, i) => (
              <li key={i}>“{w.phrase}” → <span className="font-medium">{w.suggestion || "—"}</span></li>
            ))}
          </ul>
        </section>
      )}
      {plainList("Needs verification", draft.needsVerification)}
      {plainList("Missing context", draft.missingContext)}
      <p className="mt-4 text-xs text-ink-2">
        Check each suggestion against the original sources. See the <Link href="/methodology" className="underline">methodology</Link> for neutrality standards.
      </p>
    </section>
  );
}
