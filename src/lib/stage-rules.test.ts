import { describe, expect, it } from "vitest";
import { resolveOutcomeReason } from "./stage-rules";

describe("resolveOutcomeReason", () => {
  it("requires a reason for lost stages", () => {
    expect(resolveOutcomeReason("lost", null).ok).toBe(false);
    expect(resolveOutcomeReason("lost", "r1")).toEqual({ ok: true, reasonId: "r1" });
  });

  it("clears the reason when moving to an open or won stage", () => {
    expect(resolveOutcomeReason("open", "r1")).toEqual({ ok: true, reasonId: null });
    expect(resolveOutcomeReason("won", undefined)).toEqual({ ok: true, reasonId: null });
  });
});
