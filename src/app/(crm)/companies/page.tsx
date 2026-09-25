import Link from "next/link";
import { CompaniesTable } from "@/components/companies-table";
import { SaveView } from "@/components/save-view";
import { filterFromParams, paramsFromFilter } from "@/lib/filters";
import { listCompanies, listRegions } from "@/lib/repo/companies";
import { listAttributeDefs, listMembers, listStages } from "@/lib/repo/config";
import { listViews } from "@/lib/repo/views";
import { requirePageContext } from "@/lib/session";
import { displayName } from "@/lib/format";

// Built-in views every rep gets — the working lists of a small sales team.
const BUILT_IN = [
  { name: "My follow-ups due", qs: "owner=me&follow=week" },
  { name: "Overdue", qs: "follow=overdue" },
  { name: "Unowned", qs: "owner=none" },
  { name: "No next step", qs: "follow=none" },
];

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requirePageContext();
  const ws = ctx.workspace.id;
  const params = await searchParams;
  const { filter, sort } = filterFromParams(params);
  const [rows, stages, members, defs, views, regions] = await Promise.all([
    listCompanies(ws, ctx.userId, filter, sort),
    listStages(ws),
    listMembers(ws),
    listAttributeDefs(ws),
    listViews(ws, ctx.userId),
    listRegions(ws),
  ]);
  const currentQs = paramsFromFilter(filter);
  const filterDefs = defs.filter((d) => d.type === "select" || d.type === "multiselect" || d.type === "bool");
  const columnDefs = defs.filter((d) => d.type !== "text").slice(0, 2);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Companies</h1>
        <div className="flex gap-2">
          <a className="btn" href={`/api/export/companies?${currentQs}`}>
            Export CSV
          </a>
          <Link className="btn-primary" href="/companies/new">
            Add company
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 text-sm">
        <Link href="/companies" className={`rounded-full border px-3 py-1 ${currentQs === "" ? "border-accent bg-accent-soft text-accent" : "border-border"}`}>
          All
        </Link>
        {BUILT_IN.map((v) => (
          <Link key={v.name} href={`/companies?${v.qs}`} className={`rounded-full border px-3 py-1 ${currentQs === v.qs ? "border-accent bg-accent-soft text-accent" : "border-border"}`}>
            {v.name}
          </Link>
        ))}
        {views.map((v) => {
          const qs = paramsFromFilter(v.filter);
          return (
            <Link key={v.id} href={`/companies?${qs}`} className={`rounded-full border px-3 py-1 ${currentQs === qs ? "border-accent bg-accent-soft text-accent" : "border-border"}`}>
              {v.name}
              {!v.ownerUserId && <span className="ml-1 text-xs text-muted">(team)</span>}
            </Link>
          );
        })}
      </div>

      <form className="card grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
        <input name="q" defaultValue={filter.q} placeholder="Search name or place" className="input lg:col-span-2" />
        <select name="stage" defaultValue={filter.stageIds?.[0] ?? ""} className="input">
          <option value="">Any stage</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="owner" defaultValue={filter.owner ?? ""} className="input">
          <option value="">Any owner</option>
          <option value="me">Me</option>
          <option value="none">Unowned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {displayName(m)}
            </option>
          ))}
        </select>
        <select name="region" defaultValue={filter.region ?? ""} className="input">
          <option value="">Any region</option>
          {regions.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select name="follow" defaultValue={filter.followUp ?? ""} className="input">
          <option value="">Any follow-up</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="week">Due within 7 days</option>
          <option value="none">No next step</option>
        </select>
        {filterDefs.map((d) => (
          <select key={d.id} name={`a.${d.key}`} defaultValue={filter.attr?.[d.key] ?? ""} className="input">
            <option value="">{d.label}: any</option>
            {d.type === "bool" ? (
              <>
                <option value="true">{d.label}: yes</option>
                <option value="false">{d.label}: no</option>
              </>
            ) : (
              d.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {d.label}: {o.label}
                </option>
              ))
            )}
          </select>
        ))}
        <select name="sort" defaultValue={sort} className="input">
          <option value="follow_up">Sort: next follow-up</option>
          <option value="recent">Sort: recent activity</option>
          <option value="name">Sort: name</option>
          <option value="created">Sort: newest</option>
        </select>
        <div className="flex gap-2">
          <button className="btn-primary">Apply</button>
          <Link href="/companies" className="btn">
            Clear
          </Link>
        </div>
      </form>

      {currentQs && <SaveView filter={filter} canShare={ctx.role !== "rep"} />}

      <CompaniesTable
        rows={rows.map((r) => ({
          ...r,
          nextFollowUpAt: r.nextFollowUpAt?.toISOString() ?? null,
          lastActivityAt: r.lastActivityAt?.toISOString() ?? null,
        }))}
        stages={stages.filter((s) => s.kind !== "lost").map((s) => ({ id: s.id, label: s.label }))}
        members={members.map((m) => ({ id: m.id, label: displayName(m) }))}
        columnDefs={columnDefs}
      />
    </div>
  );
}
