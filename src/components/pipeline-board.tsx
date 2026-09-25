"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { StageKind } from "@/db/schema";
import { changeStageAction } from "@/lib/actions/companies";
import { relativeDue } from "@/lib/format";

type Stage = { id: string; label: string; kind: StageKind; color: string };
type Card = { id: string; name: string; locality: string | null; stageId: string; owner: string; nextFollowUpAt: string | null };

// Kanban by stage. Drag a card to another column; dropping on a lost stage asks for the
// outcome reason first.
export function PipelineBoard({ stages, reasons, cards }: { stages: Stage[]; reasons: { id: string; label: string }[]; cards: Card[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Optimistic stage moves layered over server data; props refresh after each move.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const local = cards.map((c) => (overrides[c.id] ? { ...c, stageId: overrides[c.id] } : c));
  const [dragging, setDragging] = useState<string | null>(null);
  const [pendingLost, setPendingLost] = useState<{ cardId: string; stageId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function move(cardId: string, stageId: string, reasonId?: string) {
    setOverrides((o) => ({ ...o, [cardId]: stageId }));
    start(async () => {
      const r = await changeStageAction(cardId, stageId, reasonId);
      if (!r.ok) {
        setOverrides((o) => {
          const rest = { ...o };
          delete rest[cardId];
          return rest;
        });
        setError(r.error);
      } else {
        setError(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-danger">{error}</p>}
      {pendingLost && (
        <div className="card flex flex-wrap items-center gap-2 p-3 text-sm">
          <span>
            Why is <b>{local.find((c) => c.id === pendingLost.cardId)?.name}</b> lost?
          </span>
          <select
            className="input w-auto"
            defaultValue=""
            onChange={(e) => {
              if (!e.target.value) return;
              move(pendingLost.cardId, pendingLost.stageId, e.target.value);
              setPendingLost(null);
            }}
          >
            <option value="" disabled>
              Pick an outcome reason…
            </option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => setPendingLost(null)}>
            Cancel
          </button>
        </div>
      )}
      <div className={`flex gap-3 overflow-x-auto pb-4 ${pending ? "opacity-80" : ""}`}>
        {stages.map((s) => {
          const col = local.filter((c) => c.stageId === s.id);
          return (
            <div
              key={s.id}
              className="flex w-64 shrink-0 flex-col rounded-lg bg-surface-2 p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (!dragging) return;
                const card = local.find((c) => c.id === dragging);
                setDragging(null);
                if (!card || card.stageId === s.id) return;
                if (s.kind === "lost") setPendingLost({ cardId: card.id, stageId: s.id });
                else move(card.id, s.id);
              }}
            >
              <div className="mb-2 flex items-center justify-between px-1 text-sm font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="text-xs text-muted">{col.length}</span>
              </div>
              <div className="flex max-h-[70vh] min-h-16 flex-col gap-1.5 overflow-y-auto">
                {col.slice(0, 200).map((c) => {
                  const due = relativeDue(c.nextFollowUpAt);
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setDragging(c.id)}
                      className="cursor-grab rounded-md border border-border bg-surface p-2 text-sm shadow-sm"
                    >
                      <Link href={`/companies/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      <div className="text-xs text-muted">{c.locality}</div>
                      <div className="mt-1 flex justify-between text-xs text-muted">
                        <span>{c.owner || "Unowned"}</span>
                        <span className={due.overdue ? "text-danger" : ""}>{due.text}</span>
                      </div>
                    </div>
                  );
                })}
                {col.length > 200 && <p className="px-1 text-xs text-muted">+{col.length - 200} more — use the list view</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
