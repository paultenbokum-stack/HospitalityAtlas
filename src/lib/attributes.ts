import { z } from "zod";
import type { AttributeDefinition, AttributeValues } from "@/db/schema";

type Def = Pick<AttributeDefinition, "key" | "label" | "type" | "options" | "active">;

// Builds the zod schema for one attribute from its definition. Select values are stored as
// option ids (never labels), so relabelling an option never orphans data.
export function attributeValueSchema(def: Def) {
  const optionIds = def.options.map((o) => o.id);
  switch (def.type) {
    case "text":
      return z.string().trim().max(500);
    case "number":
      return z.coerce.number().finite();
    case "bool":
      return z.boolean();
    case "date":
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
    case "select":
      return z.string().refine((v) => optionIds.includes(v), "Unknown option");
    case "multiselect":
      return z.array(z.string().refine((v) => optionIds.includes(v), "Unknown option")).max(50);
  }
}

// Validates a partial update of a company's attributes against the workspace's definitions.
// Unknown keys are rejected; null / "" clears a value.
export function parseAttributePatch(
  defs: Def[],
  patch: Record<string, unknown>,
): { ok: true; values: AttributeValues } | { ok: false; error: string } {
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const values: AttributeValues = {};
  for (const [key, raw] of Object.entries(patch)) {
    const def = byKey.get(key);
    if (!def) return { ok: false, error: `Unknown attribute "${key}"` };
    if (raw === null || raw === "" || (Array.isArray(raw) && raw.length === 0)) {
      values[key] = null;
      continue;
    }
    const parsed = attributeValueSchema(def).safeParse(raw);
    if (!parsed.success) return { ok: false, error: `${def.label}: ${parsed.error.issues[0]?.message ?? "invalid"}` };
    values[key] = parsed.data as AttributeValues[string];
  }
  return { ok: true, values };
}

// Human-readable value for lists, exports and reports.
export function formatAttribute(def: Def, value: AttributeValues[string] | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const label = (id: string) => def.options.find((o) => o.id === id)?.label ?? "";
  if (def.type === "select") return label(String(value));
  if (def.type === "multiselect" && Array.isArray(value)) return value.map(label).filter(Boolean).join(", ");
  if (def.type === "bool") return value ? "Yes" : "No";
  return String(value);
}

export function slugKey(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || "attribute"
  );
}
