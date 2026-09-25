"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createWorkspaceAction, switchWorkspaceAction } from "@/lib/actions/settings";
import { TEMPLATES } from "@/lib/templates";

export function WorkspaceSwitcher({
  current,
  available,
  canCreate,
}: {
  current: string;
  available: { id: string; name: string }[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (creating)
    return (
      <form
        className="space-y-1.5"
        action={(fd) =>
          start(async () => {
            const r = await createWorkspaceAction({ name: fd.get("name"), templateId: fd.get("template") });
            if (!r.ok) return setError(r.error);
            setCreating(false);
            router.push("/companies");
            router.refresh();
          })
        }
      >
        <input name="name" className="input" placeholder="Workspace name" required />
        <select name="template" className="input">
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex gap-1.5">
          <button className="btn-primary" disabled={pending}>
            Create
          </button>
          <button type="button" className="btn" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </div>
      </form>
    );

  if (available.length < 2 && !canCreate)
    return <div className="truncate text-xs text-muted">{available[0]?.name}</div>;

  return (
    <select
      className="input"
      value={current}
      disabled={pending}
      onChange={(e) => {
        if (e.target.value === "__new") return setCreating(true);
        start(async () => {
          await switchWorkspaceAction(e.target.value);
          router.push("/companies");
          router.refresh();
        });
      }}
    >
      {available.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
        </option>
      ))}
      {canCreate && <option value="__new">+ New workspace…</option>}
    </select>
  );
}
