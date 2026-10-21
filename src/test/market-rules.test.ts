import { describe, it, expect } from "vitest";
import {
  numeric,
  estimatedListing,
  gmpPercentage,
  estimatedLotGain,
  minimumInvestment,
  listingGain,
  listingPercentage,
  dateOnly,
  observationTime,
  freshness,
  indiaToday,
  subscriptionLabel,
} from "../lib/market/rules";
describe("decimal financial rules", () => {
  it("adds decimals without binary rounding", () =>
    expect(estimatedListing("0.1", "0.2")).toBe("0.3"));
  it("calculates GMP percentage from upper band", () =>
    expect(gmpPercentage("200", "25")).toBe("12.5"));
  it("calculates signed gain per lot", () => expect(estimatedLotGain("-2.5", 40)).toBe("-100"));
  it("calculates one lot at selected price", () =>
    expect(minimumInvestment("101.25", 40)).toBe("4050"));
  it("calculates actual listing gain separately", () => {
    expect(listingGain("100", "90")).toBe("-10");
    expect(listingPercentage("100", "90")).toBe("-10");
  });
  it("returns null for absent/invalid references", () => {
    expect(gmpPercentage(0, 20)).toBeNull();
    expect(estimatedListing(null, 20)).toBeNull();
    expect(minimumInvestment(100, 0)).toBeNull();
    expect(estimatedLotGain(2, 1.5)).toBeNull();
    expect(listingPercentage(100, null)).toBeNull();
  });
  it.each([
    ["1,23,456.70", "123456.7"],
    ["1,234,567", "1234567"],
    ["-2.25", "-2.25"],
    ["—", null],
    [null, null],
  ])("parses %s", (raw, result) => expect(numeric(raw)).toBe(result));
  it.each(["1,2,3", "NaN", "Infinity", "1e40", "₹500", true])("rejects malformed %s", (raw) =>
    expect(() => numeric(raw)).toThrow(),
  );
});
describe("time and quality", () => {
  it("does not shift a date-only value", () =>
    expect(dateOnly("2026-10-19T00:00:00.000Z")).toBe("2026-10-19"));
  it("rejects impossible dates", () => expect(() => dateOnly("2026-02-30")).toThrow());
  it("converts provider local observation to UTC", () =>
    expect(observationTime("Oct 9 2026 5:00PM").observedAt).toBe("2026-10-09T11:30:00.000Z"));
  it("preserves unknown date precision", () =>
    expect(observationTime("2026-10-19")).toEqual({
      observedAt: null,
      reportedDate: "2026-10-19",
      raw: "2026-10-19",
    }));
  it("uses India calendar day at UTC boundary", () =>
    expect(indiaToday(new Date("2026-10-18T20:00:00Z"))).toBe("2026-10-19"));
  it("distinguishes stale, historical, missing and future", () => {
    const now = Date.parse("2026-10-19T12:00:00Z");
    expect(freshness("2026-10-18T00:00:00Z", 24, false, now)).toBe("stale");
    expect(freshness(null, 24, true, now)).toBe("historical");
    expect(freshness(null, 24, false, now)).toBe("unknown");
    expect(freshness("2026-10-20T12:00:00Z", 24, false, now)).toBe("review");
  });
});
describe("subscription interpretation", () => {
  it("labels exact", () =>
    expect(
      subscriptionLabel({ basis: "exact", multiple: "2.5", lowerBound: null, sharesBid: null }),
    ).toBe("2.50×"));
  it("labels lower bounds", () =>
    expect(
      subscriptionLabel({
        basis: "lower_bound",
        multiple: null,
        lowerBound: "2.5",
        sharesBid: "250",
      }),
    ).toBe("At least 2.50×"));
  it("never invents a multiple from bids", () =>
    expect(
      subscriptionLabel({ basis: "bids_only", multiple: null, lowerBound: null, sharesBid: "250" }),
    ).toBe("250 shares bid"));
});
