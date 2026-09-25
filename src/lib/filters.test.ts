import { describe, expect, it } from "vitest";
import { filterFromParams, paramsFromFilter } from "./filters";

describe("list filters", () => {
  it("round-trips through the URL", () => {
    const qs = "q=ballito&stage=s1&stage=s2&owner=me&follow=overdue&a.pos=o1";
    const { filter } = filterFromParams(Object.fromEntries([...new URLSearchParams(qs)].reduce((m, [k, v]) => {
      const prev = m.get(k);
      m.set(k, prev === undefined ? v : ([] as string[]).concat(prev, v));
      return m;
    }, new Map<string, string | string[]>())));
    expect(filter).toMatchObject({ q: "ballito", stageIds: ["s1", "s2"], owner: "me", followUp: "overdue", attr: { pos: "o1" } });
    expect(paramsFromFilter(filter)).toBe(qs);
  });

  it("ignores unknown follow-up and sort values", () => {
    const r = filterFromParams({ follow: "someday", sort: "random" });
    expect(r.filter.followUp).toBeUndefined();
    expect(r.sort).toBe("follow_up");
  });
});
