import Link from "next/link";
import { getActor } from "@/server/auth/session";
import { getPerspectives, getSources } from "@/server/services/reader";
import { gated } from "@/lib/gate";
import { StoryHeader } from "@/components/StoryNav";
import { CoverageBar } from "@/components/CoverageBar";
import { ReportButton } from "@/components/StoryActions";
import { Empty } from "@/components/ui";
import { LEAN_LABELS } from "@/domain/lean";

export const dynamic = "force-dynamic";
export const metadata = { title: "Left vs Right" };

type P = Awaited<ReturnType<typeof getPerspectives>>["perspectives"][number];

const SIDE = { left: "From the left", right: "From the right" } as const;

export default async function PerspectivesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const actor = await getActor();
  // Both loaders enforce the rating gate server-side.
  const [p, s] = await Promise.all([gated(slug, () => getPerspectives(slug, actor)), gated(slug, () => getSources(slug, actor))]);
  const left = p.perspectives.find((x) => x.side === "left");
  const right = p.perspectives.find((x) => x.side === "right");

  return (
    <div>
      <StoryHeader slug={slug} headline={p.headline} current="perspectives" />

      <h2 className="font-serif text-2xl font-semibold">How each side sees it</h2>
      <p className="mt-1 max-w-prose text-sm text-ink-2">
        The strongest case each side makes, in its own terms, with links to the coverage it comes from.
      </p>

      {!p.perspectives.length ? (
        <div className="mt-6">
          <Empty title="Editors haven't added left/right perspectives for this story yet.">
            <Link href={`/stories/${slug}/discussion`} className="underline">Read the discussion</Link> or <Link href={`/stories/${slug}/sources`} className="underline">see the sources</Link> in the meantime.
          </Empty>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {/* Same visual treatment for both columns: only label and position differ. */}
          <SideColumn side="left" p={left} />
          <SideColumn side="right" p={right} />
        </div>
      )}

      <div className="mt-8">
        <CoverageBar coverage={s.coverage} />
      </div>

      <aside aria-labelledby="about-perspectives" className="mt-8 rounded-2xl bg-surface-2 p-5 text-sm leading-relaxed text-ink-2">
        <h2 id="about-perspectives" className="font-semibold text-ink">About these perspectives</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Editors summarize each side from the cited coverage, aiming to describe it the way its own supporters would — fairly and at its strongest.</li>
          <li>They are not this app's view, and neither side is presented as right.</li>
          <li>“Left” and “right” refer to the broad US political spectrum. Many people hold views from both, or neither.</li>
          <li>Outlet lean ratings are assigned by editors with a stated basis. <Link href="/methodology#lean" className="underline">How this works</Link>.</li>
        </ul>
        <div className="mt-3">
          <ReportButton targetType="story" targetId={p.storyId} signedIn={!!actor} label="Report a framing concern" initialReason="framing_concern" className="-ml-2.5 min-h-11 text-ink-2 underline" />
        </div>
      </aside>
    </div>
  );
}

function SideColumn({ side, p }: { side: "left" | "right"; p: P | undefined }) {
  const id = `side-${side}`;
  return (
    <section aria-labelledby={id} className="flex flex-col rounded-2xl border border-line bg-surface p-5">
      <h3 id={id} className="text-xs font-semibold uppercase tracking-wider text-ink-2">{SIDE[side]}</h3>
      {!p ? (
        <p className="mt-2 text-sm text-ink-2">Editors haven't added this side for this story yet.</p>
      ) : (
        <>
          <p className="mt-2 font-serif text-lg leading-snug">{p.summary}</p>

          {p.arguments.length > 0 && (
            <>
              <h4 className="mt-5 text-sm font-semibold">Strongest arguments</h4>
              <ol className="mt-2 space-y-3">
                {p.arguments.map((a, i) => (
                  <li key={i} className="rounded-xl bg-surface-2 p-3 text-sm leading-relaxed">
                    <p>{a.text}</p>
                    {a.citations.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Cited coverage">
                        {a.citations.map((c) => (
                          <li key={c.id}>
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface px-3 text-xs font-medium text-ink-2 transition hover:border-ink-3 hover:text-ink sm:min-h-8"
                            >
                              <span className="font-semibold text-ink">{c.publisherName}</span>
                              <span aria-hidden>·</span>
                              <span>{LEAN_LABELS[c.lean]}</span>
                              <span aria-hidden>↗</span>
                              <span className="sr-only">(outlet rated {LEAN_LABELS[c.lean].toLowerCase()}; opens in a new tab)</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}

          {p.framing && (
            <>
              <h4 className="mt-5 text-sm font-semibold">How they frame it</h4>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{p.framing}</p>
            </>
          )}

          {p.values.length > 0 && (
            <>
              <h4 className="mt-5 text-sm font-semibold">Values emphasized</h4>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {p.values.map((v) => (
                  <li key={v} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-ink-2">{v}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
