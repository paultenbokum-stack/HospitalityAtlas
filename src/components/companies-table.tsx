"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AttributeDefinition, AttributeValues } from "@/db/schema";
import { assignOwnerAction, bulkStageAction } from "@/lib/actions/companies";
import { formatAttribute } from "@/lib/attributes";
import { displayName, relativeAgo, relativeDue } from "@/lib/format";
import { StageBadge } from "./stage-badge";

type Row = {
  id: string;
  name: string;
  locality: string | null;
  region: string | null;
  stageLabel: string;
  stageColor: string;
  ownerName: string | null;
  ownerEmail: string | null;
  attributes: AttributeValues;
  nextFollowUpAt: string | null;
  lastActivityAt: string | null;
  outcomeReason: string | null;
};

export function CompaniesTable({
  rows,
  stages,
  members,
  columnDefs,
}: {
  rows: Row[];
  stages: { id: string; label: string }[];
  members: { id: string; label: string }[];
  columnDefs: AttributeDefinition[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  function bulk(fn: () => Promise<{ ok: boolean; error?: string }>) {
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? `Updated ${selected.size}` : (r.error ?? "Failed"));
      if (r.ok) setSelected(new Set());
      router.refresh();
    });
  }

  if (!rows.length)
    return (
      <div className="card p-8 text-center text-sm text-muted">
        No companies match. <Link href="/companies/new" className="text-accent underline">Add one</Link> or find new
        prospects in <Link href="/discover" className="text-accent underline">Discover</Link>.
      </div>
    );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">
          {rows.length}
          {rows.length >= 500 ? "+" : ""} companies
        </span>
        {selected.size > 0 && (
          <>
            <span className="font-medium">· {selected.size} selected</span>
            <select
              className="input w-auto"
              disabled={pending}
              value=""
              onChange={(e) => {
                const v = e.target.value;
                bulk(() => assignOwnerAction([...selected], v === "none" ? null : v));
              }}
            >
              <option value="">Assign owner…</option>
              <option value="none">Unassign</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              className="input w-auto"
              disabled={pending}
              value=""
              onChange={(e) => {
                const v = e.target.value;
                bulk(() => bulkStageAction([...selected], v));
              }}
            >
              <option value="">Move to stage…</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </>
        )}
        {msg && <span className="text-muted">{msg}</span>}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={selected.size === rows.length}
                  onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                />
              </th>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Owner</th>
              {columnDefs.map((d) => (
                <th key={d.id} className="hidden px-3 py-2 font-medium lg:table-cell">
                  {d.label}
                </th>
              ))}
              <th className="px-3 py-2 font-medium">Next step</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const due = relativeDue(r.nextFollowUpAt);
              return (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.name}`}
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/companies/${r.id}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    <div className="text-xs text-muted">{[r.locality, r.region].filter(Boolean).join(", ")}</div>
                  </td>
                  <td className="px-3 py-2">
                    <StageBadge label={r.stageLabel} color={r.stageColor} />
                    {r.outcomeReason && <div className="mt-0.5 text-xs text-muted">{r.outcomeReason}</div>}
                  </td>
                  <td className="px-3 py-2 text-muted">{displayName({ name: r.ownerName, email: r.ownerEmail }) || "—"}</td>
                  {columnDefs.map((d) => (
                    <td key={d.id} className="hidden px-3 py-2 text-muted lg:table-cell">
                      {formatAttribute(d, r.attributes[d.key])}
                    </td>
                  ))}
                  <td className={`px-3 py-2 ${due.overdue ? "font-medium text-danger" : "text-muted"}`}>
                    {due.text || "—"}
                  </td>
                  <td className="hidden px-3 py-2 text-muted sm:table-cell">{relativeAgo(r.lastActivityAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
