"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AttributeDefinition, AttributeValues, StageKind } from "@/db/schema";
import {
  archiveCompanyAction,
  assignOwnerAction,
  changeStageAction,
  createTaskAction,
  logActivityAction,
  setAttributesAction,
  toggleTaskAction,
  updateCompanyDetailsAction,
} from "@/lib/actions/companies";
import { formatAttribute } from "@/lib/attributes";
import { formatDate, relativeDue } from "@/lib/format";
import { personalDataError } from "@/lib/pii";

type Opt = { id: string; label: string };
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
  return { pending, error, exec, setError };
}

function inDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Stage + owner ──

export function StageOwnerBar(props: {
  companyId: string;
  stageId: string;
  reason: string | null;
  ownerUserId: string | null;
  stages: (Opt & { kind: StageKind })[];
  reasons: Opt[];
  members: Opt[];
  canArchive: boolean;
}) {
  const router = useRouter();
  const { pending, error, exec } = useAction();
  const [lostTarget, setLostTarget] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Stage"
          className="input w-auto"
          value={lostTarget ?? props.stageId}
          disabled={pending}
          onChange={(e) => {
            const s = props.stages.find((x) => x.id === e.target.value)!;
            if (s.kind === "lost") return setLostTarget(s.id);
            setLostTarget(null);
            exec(() => changeStageAction(props.companyId, s.id));
          }}
        >
          {props.stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Owner"
          className="input w-auto"
          value={props.ownerUserId ?? ""}
          disabled={pending}
          onChange={(e) => exec(() => assignOwnerAction([props.companyId], e.target.value || null))}
        >
          <option value="">Unowned</option>
          {props.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        {props.canArchive && (
          <button
            className="btn"
            disabled={pending}
            onClick={() => {
              if (confirm("Archive this company? It will disappear from lists and reports."))
                exec(() => archiveCompanyAction(props.companyId), () => router.push("/companies"));
            }}
          >
            Archive
          </button>
        )}
      </div>
      {props.reason && !lostTarget && <p className="text-xs text-muted">Outcome: {props.reason}</p>}
      {lostTarget && (
        <div className="card flex flex-wrap items-center gap-2 p-2 text-sm">
          <span>Why?</span>
          <select
            className="input w-auto"
            defaultValue=""
            onChange={(e) =>
              e.target.value &&
              exec(() => changeStageAction(props.companyId, lostTarget, e.target.value), () => setLostTarget(null))
            }
          >
            <option value="" disabled>
              Pick an outcome reason…
            </option>
            {props.reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => setLostTarget(null)}>
            Cancel
          </button>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

// ── Quick log ──

export function QuickLog({ companyId, types }: { companyId: string; types: Opt[] }) {
  const { pending, error, exec } = useAction();
  const [body, setBody] = useState("");
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [next, setNext] = useState(true);
  const [nextTitle, setNextTitle] = useState("Follow up");
  const [nextDue, setNextDue] = useState(inDays(3));
  const warning = body ? personalDataError(body) : null;

  return (
    <form
      className="card space-y-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        exec(
          () =>
            logActivityAction(companyId, {
              typeId,
              body,
              nextStep: next ? { title: nextTitle, dueAt: nextDue } : undefined,
            }),
          () => setBody(""),
        );
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        {types.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => setTypeId(t.id)}
            className={`rounded-full border px-3 py-1 text-sm ${
              typeId === t.id ? "border-accent bg-accent-soft text-accent" : "border-border"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        className="input min-h-20"
        placeholder="What happened? Outcome, objections, what they use today… (business info only — no personal names or numbers)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {warning && <p className="rounded-md bg-warn-soft px-3 py-2 text-xs text-warn-ink">{warning}</p>}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={next} onChange={(e) => setNext(e.target.checked)} /> Next step
        </label>
        {next && (
          <>
            <input className="input w-48" value={nextTitle} onChange={(e) => setNextTitle(e.target.value)} />
            <input type="date" className="input w-40" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
          </>
        )}
        <button className="btn-primary ml-auto" disabled={pending || !body.trim() || !!warning}>
          Log activity
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}

// ── Tasks ──

export function TasksPanel({
  companyId,
  tasks,
  members,
  me,
}: {
  companyId: string;
  tasks: { id: string; title: string; dueAt: string; doneAt: string | null; assignee: string }[];
  members: Opt[];
  me: string;
}) {
  const { pending, error, exec } = useAction();
  const [adding, setAdding] = useState(false);

  return (
    <section className="card p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">Next steps</h2>
        <button className="text-accent underline" onClick={() => setAdding((v) => !v)}>
          {adding ? "Cancel" : "Add"}
        </button>
      </div>
      {adding && (
        <form
          className="mb-3 space-y-1.5"
          action={(fd) =>
            exec(
              () =>
                createTaskAction(companyId, {
                  title: fd.get("title"),
                  dueAt: fd.get("dueAt"),
                  assigneeId: fd.get("assigneeId") || null,
                }),
              () => setAdding(false),
            )
          }
        >
          <input name="title" className="input" placeholder="e.g. Send proposal" required />
          <div className="flex gap-1.5">
            <input name="dueAt" type="date" className="input" defaultValue={inDays(2)} required />
            <select name="assigneeId" className="input" defaultValue={me}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary" disabled={pending}>
            Add step
          </button>
        </form>
      )}
      {!tasks.length && <p className="text-muted">No next step set.</p>}
      <ul className="space-y-1.5">
        {tasks.map((t) => {
          const due = relativeDue(t.dueAt);
          return (
            <li key={t.id} className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!t.doneAt}
                disabled={pending}
                onChange={(e) => exec(() => toggleTaskAction(t.id, e.target.checked))}
                aria-label={`Mark ${t.title} done`}
              />
              <div className={t.doneAt ? "text-muted line-through" : ""}>
                <div>{t.title}</div>
                <div className={`text-xs ${!t.doneAt && due.overdue ? "text-danger" : "text-muted"}`}>
                  {t.doneAt ? `Done ${formatDate(t.doneAt)}` : due.text} · {t.assignee}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-danger">{error}</p>}
    </section>
  );
}

// ── Attributes ──

function AttributeInput({
  def,
  value,
  onSave,
}: {
  def: AttributeDefinition;
  value: AttributeValues[string] | undefined;
  onSave: (v: unknown) => void;
}) {
  const options = def.options.filter((o) => o.active || o.id === value || (Array.isArray(value) && value.includes(o.id)));
  switch (def.type) {
    case "select":
      return (
        <select className="input" value={(value as string) ?? ""} onChange={(e) => onSave(e.target.value || null)}>
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "multiselect": {
      const current = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-1">
          {options.map((o) => {
            const on = current.includes(o.id);
            return (
              <button
                type="button"
                key={o.id}
                onClick={() => onSave(on ? current.filter((x) => x !== o.id) : [...current, o.id])}
                className={`rounded-full border px-2 py-0.5 text-xs ${on ? "border-accent bg-accent-soft text-accent" : "border-border"}`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }
    case "bool":
      return (
        <select
          className="input"
          value={value === true ? "true" : value === false ? "false" : ""}
          onChange={(e) => onSave(e.target.value === "" ? null : e.target.value === "true")}
        >
          <option value="">—</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    default:
      return (
        <input
          className="input"
          type={def.type === "number" ? "number" : def.type === "date" ? "date" : "text"}
          defaultValue={(value as string | number | undefined) ?? ""}
          onBlur={(e) => {
            if (e.target.value !== String(value ?? "")) onSave(e.target.value || null);
          }}
        />
      );
  }
}

export function AttributesPanel({
  companyId,
  defs,
  values,
}: {
  companyId: string;
  defs: AttributeDefinition[];
  values: AttributeValues;
}) {
  const { error, exec } = useAction();
  if (!defs.length) return null;
  return (
    <section className="card p-4 text-sm">
      <h2 className="mb-2 font-medium">Classification</h2>
      <div className="space-y-2.5">
        {defs.map((d) => (
          <div key={d.id}>
            <div className="label" title={formatAttribute(d, values[d.key])}>
              {d.label}
            </div>
            <AttributeInput def={d} value={values[d.key]} onSave={(v) => exec(() => setAttributesAction(companyId, { [d.key]: v }))} />
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-danger">{error}</p>}
    </section>
  );
}

// ── Business details ──

type Details = {
  name: string;
  locality: string | null;
  region: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  contactRoles: string[];
};

const FIELDS: { key: keyof Omit<Details, "contactRoles">; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "locality", label: "Town / suburb" },
  { key: "region", label: "Region" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Business phone" },
  { key: "website", label: "Website" },
  { key: "email", label: "Generic inbox" },
];

export function DetailsPanel({ companyId, details }: { companyId: string; details: Details }) {
  const { pending, error, exec } = useAction();
  const [editing, setEditing] = useState(false);

  return (
    <section className="card p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">Business details</h2>
        <button className="text-accent underline" onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>
      {editing ? (
        <form
          className="space-y-2"
          action={(fd) =>
            exec(
              () =>
                updateCompanyDetailsAction(companyId, {
                  ...Object.fromEntries(FIELDS.map((f) => [f.key, String(fd.get(f.key) ?? "")])),
                  contactRoles: String(fd.get("contactRoles") ?? "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                }),
              () => setEditing(false),
            )
          }
        >
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <input name={f.key} className="input" defaultValue={details[f.key] ?? ""} required={f.key === "name"} />
            </div>
          ))}
          <div>
            <label className="label">Roles we deal with</label>
            <input name="contactRoles" className="input" defaultValue={details.contactRoles.join(", ")} />
          </div>
          <button className="btn-primary" disabled={pending}>
            Save
          </button>
        </form>
      ) : (
        <dl className="space-y-1">
          {FIELDS.slice(3).map((f) =>
            details[f.key] ? (
              <div key={f.key} className="flex gap-2">
                <dt className="w-24 shrink-0 text-muted">{f.label}</dt>
                <dd className="min-w-0 break-words">{details[f.key]}</dd>
              </div>
            ) : null,
          )}
          {details.contactRoles.length > 0 && (
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-muted">Roles</dt>
              <dd>{details.contactRoles.join(", ")}</dd>
            </div>
          )}
          {!details.address && !details.phone && !details.website && !details.email && !details.contactRoles.length && (
            <p className="text-muted">No details yet.</p>
          )}
        </dl>
      )}
      {error && <p className="mt-2 text-danger">{error}</p>}
    </section>
  );
}
