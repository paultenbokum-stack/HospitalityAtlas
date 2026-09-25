import { describe, expect, it } from "vitest";
import { tiles } from "./places";

describe("tiles", () => {
  const v = { low: { latitude: -30, longitude: 30 }, high: { latitude: -29, longitude: 31 } };

  it("returns the whole viewport for a quick scan", () => {
    expect(tiles(v, 1)).toEqual([v]);
  });

  it("splits a deep scan into a 3×3 grid covering the viewport", () => {
    const t = tiles(v, 3);
    expect(t).toHaveLength(9);
    expect(t[0].low).toEqual(v.low);
    expect(t[8].high.latitude).toBeCloseTo(v.high.latitude);
    expect(t[8].high.longitude).toBeCloseTo(v.high.longitude);
  });
});
