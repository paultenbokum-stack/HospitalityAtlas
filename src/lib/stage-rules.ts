import type { StageKind } from "@/db/schema";

// A company moving into a lost stage must carry an outcome reason — that's the structured
// feedback reports are built on. Leaving a lost stage clears the reason.
export function resolveOutcomeReason(
  targetKind: StageKind,
  reasonId: string | null | undefined,
): { ok: true; reasonId: string | null } | { ok: false; error: string } {
  if (targetKind === "lost") {
    if (!reasonId) return { ok: false, error: "Pick an outcome reason for a lost prospect." };
    return { ok: true, reasonId };
  }
  return { ok: true, reasonId: null };
}
