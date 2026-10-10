import type { ScaleConfig } from "@/server/db/schema";

export const SEVEN_POINT_LABELS = [
  "Strongly oppose",
  "Oppose",
  "Somewhat oppose",
  "Neutral",
  "Somewhat support",
  "Support",
  "Strongly support",
] as const;

export const UNCERTAIN_LABEL = "I don't know enough to judge";

export function defaultScaleConfig(overrides: Partial<ScaleConfig> = {}): ScaleConfig {
  return {
    min: 1,
    max: 7,
    labels: [...SEVEN_POINT_LABELS],
    allowUncertain: true,
    uncertainLabel: UNCERTAIN_LABEL,
    supportGrouping: true,
    ...overrides,
  };
}

export type ResponseInput = { type: "scale"; value: number } | { type: "uncertain" };

/** Validates a submitted response against a question's scale. Returns a normalized row shape. */
export function validateResponse(config: ScaleConfig, input: unknown): { responseType: "scale" | "uncertain"; responseValue: number | null } {
  if (!input || typeof input !== "object") throw new Error("Response is required");
  const r = input as { type?: unknown; value?: unknown };
  if (r.type === "uncertain") {
    if (!config.allowUncertain) throw new Error("This question does not accept an uncertain response");
    if (r.value !== undefined && r.value !== null) throw new Error("An uncertain response has no scale value");
    return { responseType: "uncertain", responseValue: null };
  }
  if (r.type === "scale") {
    const v = r.value;
    if (typeof v !== "number" || !Number.isInteger(v) || v < config.min || v > config.max) {
      throw new Error(`Scale value must be a whole number from ${config.min} to ${config.max}`);
    }
    return { responseType: "scale", responseValue: v };
  }
  throw new Error("Unknown response type");
}

export function responseLabel(config: ScaleConfig, type: "scale" | "uncertain", value: number | null): string {
  if (type === "uncertain") return config.uncertainLabel;
  return config.labels[(value ?? 0) - config.min] ?? String(value);
}

/** Direction on the scale: -1 oppose, 0 neutral, 1 support, null uncertain. */
export function direction(type: "scale" | "uncertain", value: number | null): -1 | 0 | 1 | null {
  if (type === "uncertain" || value == null) return null;
  return value < 4 ? -1 : value > 4 ? 1 : 0;
}
