import { pct } from "@/lib/format";

/** Standard US tile-grid layout: [column, row], one equal square per state plus DC. */
const GRID: Record<string, [number, number]> = {
  AK: [0, 0], ME: [10, 0],
  VT: [9, 1], NH: [10, 1],
  WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], IL: [5, 2], WI: [6, 2], MI: [7, 2], NY: [8, 2], RI: [9, 2], MA: [10, 2],
  OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IN: [5, 3], OH: [6, 3], PA: [7, 3], NJ: [8, 3], CT: [9, 3],
  CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4],
  AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5], DC: [8, 5],
  OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6],
  HI: [0, 7], TX: [3, 7], FL: [8, 7],
};

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/** Five equal bins of support %, one hue light → dark (anchor flips in dark mode via the tokens). */
export const BINS = [
  { min: 0, max: 20, fill: "var(--seq-1)", ink: "var(--seq-ink-lo)" },
  { min: 20, max: 40, fill: "var(--seq-2)", ink: "var(--seq-ink-lo)" },
  { min: 40, max: 60, fill: "var(--seq-3)", ink: "var(--seq-ink-lo)" },
  { min: 60, max: 80, fill: "var(--seq-4)", ink: "var(--seq-ink-hi)" },
  { min: 80, max: 100, fill: "var(--seq-5)", ink: "var(--seq-ink-hi)" },
] as const;

const binFor = (v: number) => BINS[Math.min(BINS.length - 1, Math.floor(Math.max(0, Math.round(v)) / 20))];

const S = 40; // tile size
const GAP = 3;
const COLS = 11;
const ROWS = 8;

export type StateValue = { code: string; support: number; n: number };

/**
 * Accessible tile-grid map of support by state. States without enough
 * responses are hatched and labelled. The SVG has a title/description; the
 * complete figures live in the companion table rendered by the caller.
 */
export function StateTileMap({ values, threshold }: { values: StateValue[]; threshold: number }) {
  const by = new Map(values.map((v) => [v.code, v]));
  const width = COLS * (S + GAP) - GAP;
  const height = ROWS * (S + GAP) - GAP;
  const sorted = [...values].sort((a, b) => b.support - a.support);
  const desc = values.length
    ? `${values.length} of 51 states and DC have enough responses to show. ${sorted[0] ? `Highest support: ${STATE_NAMES[sorted[0].code]} at ${pct(sorted[0].support)}.` : ""} ${sorted.length > 1 ? `Lowest support: ${STATE_NAMES[sorted[sorted.length - 1].code]} at ${pct(sorted[sorted.length - 1].support)}.` : ""} All other states have fewer than ${threshold} responses from people who shared their state. Full figures are in the table below the map.`
    : `No state has at least ${threshold} responses from people who shared their state yet.`;

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full max-w-2xl" role="img" aria-labelledby="map-title map-desc">
        <title id="map-title">Support by state (tile map)</title>
        <desc id="map-desc">{desc}</desc>
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" style={{ fill: "var(--surface)" }} />
            <line x1="0" y1="0" x2="0" y2="6" style={{ stroke: "var(--line)" }} strokeWidth="3" />
          </pattern>
        </defs>
        {Object.entries(GRID).map(([code, [c, r]]) => {
          const v = by.get(code);
          const x = c * (S + GAP);
          const y = r * (S + GAP);
          const bin = v ? binFor(v.support) : null;
          const tip = v ? `${STATE_NAMES[code]}: ${pct(v.support)} support (${v.n.toLocaleString("en-US")} responses)` : `${STATE_NAMES[code]}: not enough responses yet`;
          return (
            <g key={code}>
              <title>{tip}</title>
              <rect
                x={x}
                y={y}
                width={S}
                height={S}
                rx={4}
                style={{ fill: bin ? bin.fill : "url(#hatch)", stroke: bin ? "none" : "var(--line)" }}
                strokeWidth={1}
              />
              <text
                x={x + S / 2}
                y={y + S / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={12}
                fontWeight={bin ? 600 : 500}
                style={{ fill: bin ? bin.ink : "var(--ink-3)" }}
              >
                {code}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-3">
        <p className="sr-only">Legend</p>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-2">
          <li className="flex items-center gap-1.5 font-semibold">Support:</li>
          {BINS.map((b) => (
            <li key={b.min} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-3.5 rounded-sm" style={{ background: b.fill }} />
              <span className="tabular-nums">{b.min}–{b.max === 100 ? 100 : b.max - 1}%</span>
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-3.5 rounded-sm border border-line" style={{ backgroundImage: "repeating-linear-gradient(45deg, var(--line) 0 2px, var(--surface) 2px 5px)" }} />
            <span>Not enough responses</span>
          </li>
        </ul>
      </figcaption>
    </figure>
  );
}
