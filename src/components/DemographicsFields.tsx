"use client";
import { AGE_RANGES, GEOGRAPHIC_TYPES, POLITICAL_IDS, US_STATES } from "@/domain/topics";
import { inputClass, labelClass } from "@/components/ui";

export type Demo = { stateCode: string; ageRange: string; geographicType: string; politicalSelfIdentification: string };
export const emptyDemo: Demo = { stateCode: "", ageRange: "", geographicType: "", politicalSelfIdentification: "" };

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function toDemo(d: Partial<Record<keyof Demo, string | null>> | null | undefined): Demo {
  if (!d) return emptyDemo;
  return {
    stateCode: d.stateCode ?? "",
    ageRange: d.ageRange ?? "",
    geographicType: d.geographicType ?? "",
    politicalSelfIdentification: d.politicalSelfIdentification === "prefer not to say" ? "" : (d.politicalSelfIdentification ?? ""),
  };
}

/** Converts "" (Prefer not to say) to null for the API. */
export function demoPayload(d: Demo) {
  const n = (v: string) => (v ? v : null);
  return { stateCode: n(d.stateCode), ageRange: n(d.ageRange), geographicType: n(d.geographicType), politicalSelfIdentification: n(d.politicalSelfIdentification) };
}

/** Four optional selects, each with "Prefer not to say". Disabled until consent is given. */
export function DemographicsFields({ value, onChange, disabled, idPrefix = "demo" }: { value: Demo; onChange: (d: Demo) => void; disabled?: boolean; idPrefix?: string }) {
  const set = (k: keyof Demo) => (e: React.ChangeEvent<HTMLSelectElement>) => onChange({ ...value, [k]: e.target.value });
  const field = (k: keyof Demo, label: string, opts: readonly (readonly [string, string])[], hint?: string) => (
    <div>
      <label htmlFor={`${idPrefix}-${k}`} className={labelClass}>{label}</label>
      {hint && <p id={`${idPrefix}-${k}-hint`} className="-mt-1 mb-1.5 text-xs text-ink-3">{hint}</p>}
      <select id={`${idPrefix}-${k}`} value={value[k]} onChange={set(k)} disabled={disabled} aria-describedby={hint ? `${idPrefix}-${k}-hint` : undefined} className={`${inputClass} disabled:opacity-60`}>
        <option value="">Prefer not to say</option>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {field("stateCode", "State", US_STATES.map((s) => [s, STATE_NAMES[s] ?? s] as const))}
      {field("ageRange", "Age range", AGE_RANGES.map((a) => [a, a] as const))}
      {field("geographicType", "Area type", GEOGRAPHIC_TYPES.map((g) => [g, cap(g)] as const))}
      {field(
        "politicalSelfIdentification",
        "Political self-identification",
        POLITICAL_IDS.filter((p) => p !== "prefer not to say").map((p) => [p, cap(p)] as const),
        "Optional. Never shown on your profile or comments, and never used to label you.",
      )}
    </div>
  );
}
