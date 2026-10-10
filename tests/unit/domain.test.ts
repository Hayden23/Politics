import { describe, expect, it } from "vitest";
import { aggregate, meetsThreshold, ordinalMedian, percent } from "@/domain/aggregation";
import { defaultScaleConfig, direction, validateResponse } from "@/domain/scale";
import { canTransition, nextStatus } from "@/domain/storyWorkflow";
import { diversify, summarize } from "@/server/services/reader";
import { normalizeUrl, parseFeed, titleSimilarity } from "@/server/services/ingestion";
import { spamProblem } from "@/server/services/community";

describe("scale validation", () => {
  const cfg = defaultScaleConfig();
  it("accepts 1–7 and uncertainty", () => {
    for (let v = 1; v <= 7; v++) expect(validateResponse(cfg, { type: "scale", value: v })).toEqual({ responseType: "scale", responseValue: v });
    expect(validateResponse(cfg, { type: "uncertain" })).toEqual({ responseType: "uncertain", responseValue: null });
  });
  it("rejects out-of-range, fractional and mistyped values", () => {
    for (const bad of [{ type: "scale", value: 0 }, { type: "scale", value: 8 }, { type: "scale", value: 2.5 }, { type: "scale", value: "4" }, { type: "uncertain", value: 4 }, null, {}]) {
      expect(() => validateResponse(cfg, bad)).toThrow();
    }
  });
  it("rejects uncertainty where disabled", () => {
    expect(() => validateResponse(defaultScaleConfig({ allowUncertain: false }), { type: "uncertain" })).toThrow();
  });
  it("uncertainty has no direction (it is not neutral)", () => {
    expect(direction("uncertain", null)).toBeNull();
    expect(direction("scale", 4)).toBe(0);
    expect(direction("scale", 2)).toBe(-1);
    expect(direction("scale", 6)).toBe(1);
  });
});

describe("aggregation", () => {
  it("computes counts, percentages and groupings from integer counts", () => {
    const d = aggregate([
      { responseType: "scale", responseValue: 1, count: 10 },
      { responseType: "scale", responseValue: 4, count: 5 },
      { responseType: "scale", responseValue: 7, count: 15 },
      { responseType: "uncertain", responseValue: null, count: 20 },
    ], { smallSampleThreshold: 30 });
    expect(d.validCount).toBe(30);
    expect(d.uncertainCount).toBe(20);
    expect(d.totalCount).toBe(50);
    expect(d.buckets[0]).toEqual({ value: 1, count: 10, percent: (10 / 30) * 100 });
    expect(d.grouping!.oppose.percent + d.grouping!.neutral.percent + d.grouping!.support.percent).toBeCloseTo(100, 10);
    expect(d.smallSample).toBe(false);
    expect(d.uncertainPercent).toBe(40);
  });
  it("does not force rounded percentages to 100", () => {
    const d = aggregate([1, 2, 3].map((v) => ({ responseType: "scale" as const, responseValue: v, count: 1 })));
    const rounded = d.buckets.filter((b) => b.count).map((b) => Math.round(b.percent));
    expect(rounded).toEqual([33, 33, 33]);
    expect(d.buckets.reduce((a, b) => a + b.percent, 0)).toBeCloseTo(100, 10);
  });
  it("handles empty data and omits grouping when disabled", () => {
    const d = aggregate([], { supportGrouping: false });
    expect(d).toMatchObject({ validCount: 0, median: null, grouping: null, smallSample: true });
    expect(percent(1, 0)).toBe(0);
  });
  it("median is an ordinal category", () => {
    expect(ordinalMedian([{ value: 1, count: 1 }, { value: 2, count: 1 }, { value: 7, count: 2 }])).toBe(2);
    expect(ordinalMedian([{ value: 3, count: 3 }])).toBe(3);
  });
  it("rejects invalid counts and ignores out-of-scale values", () => {
    expect(() => aggregate([{ responseType: "scale", responseValue: 1, count: -1 }])).toThrow();
    expect(aggregate([{ responseType: "scale", responseValue: 9, count: 3 }]).validCount).toBe(0);
  });
  it("sample thresholds", () => {
    expect(meetsThreshold(99, 100)).toBe(false);
    expect(meetsThreshold(100, 100)).toBe(true);
    expect(meetsThreshold(1000, 0)).toBe(false);
  });
});

describe("publication state machine", () => {
  it("requires approval before publication", () => {
    expect(canTransition("draft", "publish")).toBe(false);
    expect(canTransition("in_review", "publish")).toBe(false);
    expect(canTransition("approved", "publish")).toBe(true);
    expect(nextStatus("draft", "submit_review")).toBe("in_review");
    expect(nextStatus("in_review", "approve")).toBe("approved");
    expect(nextStatus("approved", "edit")).toBe("draft");
    expect(() => nextStatus("published", "edit")).toThrow();
    expect(nextStatus("published", "correct")).toBe("published");
    expect(nextStatus("archived", "restore")).toBe("draft");
  });
});

describe("feed and ingestion helpers", () => {
  it("never puts three of the same topic in a row when avoidable", () => {
    const items = ["a", "a", "a", "b", "a", "c"].map((t, i) => ({ id: i, topicSlug: t }));
    const out = diversify(items).map((i) => i.topicSlug);
    for (let i = 2; i < out.length - 1; i++) expect(out[i] === out[i - 1] && out[i] === out[i - 2]).toBe(false);
    expect(out).toHaveLength(6);
  });
  it("summarizes the first paragraph", () => {
    expect(summarize("Short.\n\nSecond paragraph.")).toBe("Short.");
    expect(summarize("word ".repeat(100), 30).endsWith("…")).toBe(true);
  });
  it("normalizes URLs and detects near-duplicate titles", () => {
    expect(normalizeUrl("http://www.Example.com/a/?utm_source=x&id=2#top")).toBe("https://example.com/a/?id=2");
    expect(titleSimilarity("Senate passes infrastructure funding bill", "Infrastructure funding bill passes Senate")).toBeGreaterThan(0.6);
    expect(titleSimilarity("Senate passes bill", "Court rules on immigration case")).toBeLessThan(0.2);
  });
  it("parses RSS and Atom", () => {
    const rss = `<rss><channel><item><title><![CDATA[Hello &amp; world]]></title><link>https://x.org/1</link><pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
    const atom = `<feed><entry><title>Atom item</title><link href="https://x.org/2"/><updated>2026-10-05T10:00:00Z</updated></entry></feed>`;
    expect(parseFeed(rss)[0]).toMatchObject({ title: "Hello & world", url: "https://x.org/1" });
    expect(parseFeed(atom)[0]).toMatchObject({ title: "Atom item", url: "https://x.org/2" });
  });
  it("flags obvious spam", () => {
    expect(spamProblem("see https://a https://b https://c")).toBeTruthy();
    expect(spamProblem("A normal reasoned comment about policy.")).toBeNull();
  });
});
