"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AttributeDefinition, PipelineStage, Role } from "@/db/schema";
import {
  addActivityTypeAction,
  addAttributeAction,
  addOutcomeReasonAction,
  addStageAction,
  inviteMemberAction,
  moveStageAction,
  removeMemberAction,
  renameWorkspaceAction,
  revokeInviteAction,
  saveAttributeOptionAction,
  saveDiscoveryAction,
  setMemberRoleAction,
  updateActivityTypeAction,
  updateAttributeAction,
  updateOutcomeReasonAction,
  updateStageAction,
} from "@/lib/actions/settings";
import { displayName } from "@/lib/format";

type Res = { ok: true } | { ok: false; error: string };

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const exec = (fn: () => Promise<Res>, onOk?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      onOk?.();
      router.refresh();
    });
  return { pending, error, exec };
}

function Section({ title, hint, children, error }: { title: string; hint?: string; children: React.ReactNode; error?: string | null }) {
  return (
    <section className="card p-4">
      <h2 className="font-medium">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-3 text-sm">{children}</div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}

// Inline-editable label: saves on blur when changed.
function EditableLabel({ value, onSave, disabled }: { value: string; onSave: (v: string) => void; disabled?: boolean }) {
  return (
    <input
      className="input"
      defaultValue={value}
      disabled={disabled}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v && v !== value) onSave(v);
      }}
    />
  );
}

export function WorkspaceName({ name }: { name: string }) {
  const { error, exec } = useAction();
  return (
    <Section title="Workspace" error={error}>
      <label className="label">Name</label>
      <EditableLabel value={name} onSave={(v) => exec(() => renameWorkspaceAction(v))} />
    </Section>
  );
}

export function MembersSettings({
  me,
  members,
  invites,
}: {
  me: string;
  members: { id: string; name: string | null; email: string; role: Role; membershipId: string }[];
  invites: { id: string; email: string; role: Role }[];
}) {
  const { pending, error, exec } = useAction();
  return (
    <Section title="People" hint="Invite-only. Invited people sign in with the Google account for that email." error={error}>
      <ul className="divide-y divide-border">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate">{displayName(m)}</div>
              <div className="truncate text-xs text-muted">{m.email}</div>
            </div>
            <select
              className="input w-auto"
              value={m.role}
              disabled={pending || m.id === me}
              onChange={(e) => exec(() => setMemberRoleAction(m.membershipId, e.target.value))}
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="rep">Rep</option>
            </select>
            {m.id !== me && (
              <button className="btn" disabled={pending} onClick={() => confirm(`Remove ${m.email}?`) && exec(() => removeMemberAction(m.membershipId))}>
                Remove
              </button>
            )}
          </li>
        ))}
        {invites.map((i) => (
          <li key={i.id} className="flex items-center gap-2 py-2 text-muted">
            <div className="min-w-0 flex-1 truncate">
              {i.email} <span className="text-xs">(invited · {i.role})</span>
            </div>
            <button className="btn" disabled={pending} onClick={() => exec(() => revokeInviteAction(i.id))}>
              Revoke
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex flex-wrap gap-2"
        action={(fd) => exec(() => inviteMemberAction({ email: fd.get("email"), role: fd.get("role") }))}
      >
        <input name="email" type="email" className="input w-64" placeholder="name@company.com" required />
        <select name="role" className="input w-auto" defaultValue="rep">
          <option value="rep">Rep</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
        <button className="btn-primary" disabled={pending}>
          Invite
        </button>
      </form>
      <p className="mt-2 text-xs text-muted">Reps work companies · Managers can archive and share views · Admins manage settings and people.</p>
    </Section>
  );
}

export function StagesSettings({ stages }: { stages: PipelineStage[] }) {
  const { pending, error, exec } = useAction();
  return (
    <Section title="Pipeline stages" hint="In order. Won and lost stages close a prospect; lost stages require an outcome reason." error={error}>
      <ul className="space-y-1.5">
        {stages.map((s, i) => (
          <li key={s.id} className={`flex items-center gap-2 ${s.active ? "" : "opacity-50"}`}>
            <input
              type="color"
              className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-surface"
              defaultValue={s.color}
              onBlur={(e) => e.target.value !== s.color && exec(() => updateStageAction(s.id, { color: e.target.value }))}
              aria-label={`${s.label} colour`}
            />
            <EditableLabel value={s.label} onSave={(v) => exec(() => updateStageAction(s.id, { label: v }))} />
            <select className="input w-auto" value={s.kind} disabled={pending} onChange={(e) => exec(() => updateStageAction(s.id, { kind: e.target.value }))}>
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
            <button className="btn px-2" disabled={pending || i === 0} onClick={() => exec(() => moveStageAction(s.id, -1))} aria-label="Move up">
              ↑
            </button>
            <button className="btn px-2" disabled={pending || i === stages.length - 1} onClick={() => exec(() => moveStageAction(s.id, 1))} aria-label="Move down">
              ↓
            </button>
            <button className="btn" disabled={pending} onClick={() => exec(() => updateStageAction(s.id, { active: !s.active }))}>
              {s.active ? "Hide" : "Show"}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex flex-wrap gap-2"
        action={(fd) => exec(() => addStageAction({ label: fd.get("label"), kind: fd.get("kind"), color: fd.get("color") }))}
      >
        <input type="color" name="color" defaultValue="#64748b" className="h-8 w-8 rounded border border-border" aria-label="Colour" />
        <input name="label" className="input w-56" placeholder="New stage" required />
        <select name="kind" className="input w-auto" defaultValue="open">
          <option value="open">Open</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
        <button className="btn-primary" disabled={pending}>
          Add stage
        </button>
      </form>
    </Section>
  );
}

export function LabelListSettings({
  kind,
  title,
  hint,
  items,
}: {
  kind: "reasons" | "types";
  title: string;
  hint: string;
  items: { id: string; label: string; active: boolean }[];
}) {
  const { pending, error, exec } = useAction();
  const update = kind === "reasons" ? updateOutcomeReasonAction : updateActivityTypeAction;
  const add = kind === "reasons" ? addOutcomeReasonAction : addActivityTypeAction;
  return (
    <Section title={title} hint={hint} error={error}>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.id} className={`flex items-center gap-2 ${it.active ? "" : "opacity-50"}`}>
            <EditableLabel value={it.label} onSave={(v) => exec(() => update(it.id, { label: v }))} />
            <button className="btn" disabled={pending} onClick={() => exec(() => update(it.id, { active: !it.active }))}>
              {it.active ? "Hide" : "Show"}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        action={(fd) => exec(() => add(String(fd.get("label") ?? "")))}
      >
        <input name="label" className="input w-64" placeholder="Add…" required />
        <button className="btn-primary" disabled={pending}>
          Add
        </button>
      </form>
    </Section>
  );
}

const TYPE_LABEL: Record<string, string> = {
  text: "Text",
  number: "Number",
  bool: "Yes / no",
  date: "Date",
  select: "Pick one",
  multiselect: "Pick many",
};

export function AttributesSettings({ defs }: { defs: AttributeDefinition[] }) {
  const { pending, error, exec } = useAction();
  const [type, setType] = useState("select");
  return (
    <Section
      title="Classification attributes"
      hint="Extra facts you track per company — e.g. POS system, segment, number of rooms. Pick-lists can grow over time; hidden options stay on existing companies."
      error={error}
    >
      <div className="space-y-4">
        {defs.map((d) => (
          <div key={d.id} className={`rounded-md border border-border p-3 ${d.active ? "" : "opacity-50"}`}>
            <div className="flex items-center gap-2">
              <EditableLabel value={d.label} onSave={(v) => exec(() => updateAttributeAction(d.id, { label: v }))} />
              <span className="shrink-0 text-xs text-muted">{TYPE_LABEL[d.type]}</span>
              <button className="btn" disabled={pending} onClick={() => exec(() => updateAttributeAction(d.id, { active: !d.active }))}>
                {d.active ? "Hide" : "Show"}
              </button>
            </div>
            {(d.type === "select" || d.type === "multiselect") && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {d.options.map((o) => (
                  <button
                    key={o.id}
                    title={o.active ? "Click to hide this option" : "Click to show this option"}
                    className={`rounded-full border border-border px-2.5 py-0.5 text-xs ${o.active ? "" : "line-through opacity-50"}`}
                    disabled={pending}
                    onClick={() => exec(() => saveAttributeOptionAction(d.id, { id: o.id, active: !o.active }))}
                  >
                    {o.label}
                  </button>
                ))}
                <form
                  className="flex gap-1"
                  action={(fd) => exec(() => saveAttributeOptionAction(d.id, { label: String(fd.get("label") ?? "") }))}
                >
                  <input name="label" className="input h-7 w-36 py-0 text-xs" placeholder="Add option" required />
                  <button className="btn h-7 py-0 text-xs" disabled={pending}>
                    Add
                  </button>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>
      <form
        className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3"
        action={(fd) =>
          exec(() =>
            addAttributeAction({
              label: fd.get("label"),
              type: fd.get("type"),
              options: String(fd.get("options") ?? "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            }),
          )
        }
      >
        <input name="label" className="input w-48" placeholder="New attribute, e.g. POS system" required />
        <select name="type" className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {(type === "select" || type === "multiselect") && (
          <input name="options" className="input w-64" placeholder="Options, comma-separated" />
        )}
        <button className="btn-primary" disabled={pending}>
          Add attribute
        </button>
      </form>
    </Section>
  );
}

export function DiscoverySettings({ terms, presets }: { terms: string[]; presets: { id: string; label: string; query: string }[] }) {
  const { pending, error, exec } = useAction();
  const [saved, setSaved] = useState(false);
  return (
    <Section
      title="Discovery"
      hint="What Discover searches Google for, and the areas offered as shortcuts. Each term is one paid Places search per scan tile."
      error={error}
    >
      <form
        className="space-y-3"
        action={(fd) =>
          exec(
            () =>
              saveDiscoveryAction({
                searchTerms: String(fd.get("terms") ?? "")
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
                presets: String(fd.get("presets") ?? "")
                  .split("\n")
                  .map((line) => line.split("|").map((s) => s.trim()))
                  .filter(([label, query]) => label && query)
                  .map(([label, query], i) => ({ id: `p${i}`, label, query })),
              }),
            () => setSaved(true),
          )
        }
      >
        <div>
          <label className="label">Search terms (one per line)</label>
          <textarea name="terms" className="input min-h-32 font-mono text-xs" defaultValue={terms.join("\n")} />
        </div>
        <div>
          <label className="label">Area shortcuts (one per line: Label | search text)</label>
          <textarea
            name="presets"
            className="input min-h-32 font-mono text-xs"
            defaultValue={presets.map((p) => `${p.label} | ${p.query}`).join("\n")}
          />
        </div>
        <button className="btn-primary" disabled={pending} onClick={() => setSaved(false)}>
          Save discovery settings
        </button>
        {saved && <span className="ml-2 text-accent">Saved</span>}
      </form>
    </Section>
  );
}
