import { formatAttribute } from "@/lib/attributes";
import { listAttributeDefs } from "@/lib/repo/config";
import { activityByRep, attributeBreakdown, outcomeBreakdown, pipelineByStage, totals } from "@/lib/repo/reports";
import { requirePageContext } from "@/lib/session";

function Bars({ rows }: { rows: { label: string; n: number; color?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-2">
          <span className="truncate text-muted" title={r.label}>
            {r.label}
          </span>
          <span className="h-3 rounded-sm bg-surface-2">
            <span className="block h-3 rounded-sm" style={{ width: `${(r.n / max) * 100}%`, background: r.color ?? "var(--accent)" }} />
          </span>
          <span className="text-right tabular-nums">{r.n}</span>
        </li>
      ))}
      {!rows.length && <li className="text-muted">No data yet.</li>}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default async function ReportsPage() {
  const ctx = await requirePageContext();
  const ws = ctx.workspace.id;
  const defs = (await listAttributeDefs(ws)).filter((d) => d.type === "select" || d.type === "multiselect" || d.type === "bool");
  const [stages, outcomes, reps, t, ...attrs] = await Promise.all([
    pipelineByStage(ws),
    outcomeBreakdown(ws),
    activityByRep(ws),
    totals(ws),
    ...defs.map((d) => attributeBreakdown(ws, d.key)),
  ]);

  const won = stages.filter((s) => s.kind === "won").reduce((a, s) => a + s.n, 0);
  const lost = stages.filter((s) => s.kind === "lost").reduce((a, s) => a + s.n, 0);
  const winRate = won + lost ? `${Math.round((won / (won + lost)) * 100)}%` : "—";

  const weeks = [...new Set(reps.map((r) => r.week))].sort();
  const repNames = [...new Set(reps.map((r) => r.name))];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Reports</h1>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Companies" value={t.companies} />
        <Stat label="Added (7 days)" value={t.added7d} />
        <Stat label="Activities (7 days)" value={t.activities7d} />
        <Stat label="Win rate (closed)" value={winRate} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-medium">Pipeline by stage</h2>
          <Bars rows={stages.map((s) => ({ label: s.label, n: s.n, color: s.color }))} />
        </section>
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-medium">Why we lose</h2>
          <Bars rows={outcomes.map((o) => ({ label: o.label, n: o.n, color: "var(--danger)" }))} />
        </section>

        <section className="card overflow-x-auto p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-medium">Logged activities per rep (last 4 weeks)</h2>
          {!reps.length ? (
            <p className="text-sm text-muted">No activities logged yet.</p>
          ) : (
            <table className="text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="pr-6 text-left font-medium">Rep</th>
                  {weeks.map((w) => (
                    <th key={w} className="px-3 text-right font-medium">
                      w/c {w.slice(5)}
                    </th>
                  ))}
                  <th className="pl-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {repNames.map((name) => {
                  const mine = reps.filter((r) => r.name === name);
                  return (
                    <tr key={name}>
                      <td className="py-1 pr-6">{name}</td>
                      {weeks.map((w) => (
                        <td key={w} className="px-3 text-right tabular-nums">
                          {mine.find((r) => r.week === w)?.n ?? 0}
                        </td>
                      ))}
                      <td className="pl-3 text-right font-medium tabular-nums">{mine.reduce((a, r) => a + r.n, 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {defs.map((d, i) => (
          <section key={d.id} className="card p-4">
            <h2 className="mb-3 text-sm font-medium">{d.label}</h2>
            <Bars
              rows={attrs[i].map((r) => ({
                label: r.value === null ? "Not set" : d.type === "bool" ? (r.value === "true" ? "Yes" : "No") : formatAttribute(d, r.value) || "(retired option)",
                n: r.n,
                color: r.value === null ? "var(--border)" : undefined,
              }))}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
