"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ViewFilter } from "@/db/schema";
import { saveViewAction } from "@/lib/actions/views";

export function SaveView({ filter, canShare }: { filter: ViewFilter; canShare: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open)
    return (
      <button className="text-sm text-accent underline" onClick={() => setOpen(true)}>
        Save this filter as a view
      </button>
    );

  return (
    <form
      className="flex flex-wrap items-center gap-2 text-sm"
      action={(fd) =>
        start(async () => {
          const r = await saveViewAction({ name: fd.get("name"), filter, shared: fd.get("shared") === "on" });
          if (!r.ok) return setError(r.error);
          setOpen(false);
          router.refresh();
        })
      }
    >
      <input name="name" className="input w-56" placeholder="View name" required autoFocus />
      {canShare && (
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="shared" /> Share with team
        </label>
      )}
      <button className="btn-primary" disabled={pending}>
        Save
      </button>
      <button type="button" className="btn" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && <span className="text-danger">{error}</span>}
    </form>
  );
}
