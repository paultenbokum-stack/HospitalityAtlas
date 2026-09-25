import { describe, expect, it } from "vitest";
import { formatAttribute, parseAttributePatch, slugKey } from "./attributes";

const defs = [
  { key: "pos", label: "POS system", type: "select" as const, active: true, options: [{ id: "o1", label: "Pilot", active: true }, { id: "o2", label: "Micros", active: true }] },
  { key: "tags", label: "Tags", type: "multiselect" as const, active: true, options: [{ id: "t1", label: "Group", active: true }] },
  { key: "rooms", label: "Rooms", type: "number" as const, active: true, options: [] },
  { key: "wifi", label: "WiFi", type: "bool" as const, active: true, options: [] },
  { key: "renewal", label: "Renewal", type: "date" as const, active: true, options: [] },
];

describe("parseAttributePatch", () => {
  it("accepts valid values for each type", () => {
    const r = parseAttributePatch(defs, { pos: "o2", tags: ["t1"], rooms: "12", wifi: true, renewal: "2027-01-31" });
    expect(r).toEqual({ ok: true, values: { pos: "o2", tags: ["t1"], rooms: 12, wifi: true, renewal: "2027-01-31" } });
  });

  it("rejects unknown keys and unknown options", () => {
    expect(parseAttributePatch(defs, { nope: "x" }).ok).toBe(false);
    expect(parseAttributePatch(defs, { pos: "Pilot" }).ok).toBe(false); // labels are not ids
    expect(parseAttributePatch(defs, { tags: ["t1", "zz"] }).ok).toBe(false);
  });

  it("rejects wrong types", () => {
    expect(parseAttributePatch(defs, { rooms: "lots" }).ok).toBe(false);
    expect(parseAttributePatch(defs, { wifi: "yes" }).ok).toBe(false);
    expect(parseAttributePatch(defs, { renewal: "31/01/2027" }).ok).toBe(false);
  });

  it("treats empty values as clearing", () => {
    expect(parseAttributePatch(defs, { pos: "", tags: [], rooms: null })).toEqual({
      ok: true,
      values: { pos: null, tags: null, rooms: null },
    });
  });
});

describe("formatAttribute", () => {
  it("shows option labels, not ids, so relabelling is safe", () => {
    expect(formatAttribute(defs[0], "o1")).toBe("Pilot");
    expect(formatAttribute(defs[1], ["t1"])).toBe("Group");
    expect(formatAttribute(defs[3], false)).toBe("No");
    expect(formatAttribute(defs[2], undefined)).toBe("");
  });
});

describe("slugKey", () => {
  it("derives a stable key from a label", () => {
    expect(slugKey("POS system used")).toBe("pos_system_used");
    expect(slugKey("  !!  ")).toBe("attribute");
  });
});
