import Link from "next/link";
import { notFound } from "next/navigation";
import { AttributesPanel, DetailsPanel, QuickLog, StageOwnerBar, TasksPanel } from "@/components/company";
import { displayName, formatDateTime } from "@/lib/format";
import { getPlaceDetails, type LivePlaceDetails } from "@/lib/places";
import { getCompany } from "@/lib/repo/companies";
import { listActivityTypes, listAttributeDefs, listMembers, listOutcomeReasons, listStages } from "@/lib/repo/config";
import { listCompanyTasks, listTimeline } from "@/lib/repo/timeline";
import { requirePageContext, roleAtLeast } from "@/lib/session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function liveDetails(placeId: string | null): Promise<LivePlaceDetails | null> {
  if (!placeId || !process.env.GOOGLE_PLACES_API_KEY) return null;
  try {
    return await getPlaceDetails(placeId);
  } catch {
    return null;
  }
}

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await requirePageContext();
  const ws = ctx.workspace.id;
  const row = await getCompany(ws, id);
  if (!row) notFound();
  const { company, stage, reason } = row;

  const [timeline, tasks, stages, reasons, types, defs, members, google] = await Promise.all([
    listTimeline(ws, id),
    listCompanyTasks(ws, id),
    listStages(ws),
    listOutcomeReasons(ws),
    listActivityTypes(ws),
    listAttributeDefs(ws),
    listMembers(ws),
    liveDetails(company.externalRef),
  ]);

  return (
    <div className="space-y-4">
      <div className="text-sm">
        <Link href="/companies" className="text-muted hover:underline">
          ← Companies
        </Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{company.name}</h1>
          <p className="text-sm text-muted">{[company.locality, company.region].filter(Boolean).join(", ")}</p>
        </div>
        <StageOwnerBar
          companyId={id}
          stageId={stage.id}
          reason={reason?.label ?? null}
          ownerUserId={company.ownerUserId}
          stages={stages.map((s) => ({ id: s.id, label: s.label, kind: s.kind }))}
          reasons={reasons.map((r) => ({ id: r.id, label: r.label }))}
          members={members.map((m) => ({ id: m.id, label: displayName(m) }))}
          canArchive={roleAtLeast(ctx.role, "manager")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-4">
          <QuickLog companyId={id} types={types.map((t) => ({ id: t.id, label: t.label }))} />

          <section className="card">
            <h2 className="border-b border-border px-4 py-2 text-sm font-medium">Timeline</h2>
            <ol className="divide-y divide-border">
              {timeline.map((a) => (
                <li key={a.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    {a.kind === "log" ? (
                      <span className="rounded bg-accent-soft px-1.5 py-0.5 font-medium text-accent">{a.typeLabel ?? "Note"}</span>
                    ) : (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5">Update</span>
                    )}
                    <span>{displayName({ name: a.userName, email: a.userEmail })}</span>
                    <span>· {formatDateTime(a.occurredAt)}</span>
                  </div>
                  <p className={`mt-1 whitespace-pre-wrap ${a.kind === "system" ? "text-muted" : ""}`}>{a.body}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-4">
          <TasksPanel
            companyId={id}
            tasks={tasks.map((t) => ({
              id: t.id,
              title: t.title,
              dueAt: t.dueAt.toISOString(),
              doneAt: t.doneAt?.toISOString() ?? null,
              assignee: displayName({ name: t.assigneeName, email: t.assigneeEmail }),
            }))}
            members={members.map((m) => ({ id: m.id, label: displayName(m) }))}
            me={ctx.userId}
          />
          <AttributesPanel companyId={id} defs={defs} values={company.attributes} />
          <DetailsPanel
            companyId={id}
            details={{
              name: company.name,
              locality: company.locality,
              region: company.region,
              address: company.address,
              phone: company.phone,
              website: company.website,
              email: company.email,
              contactRoles: company.contactRoles,
            }}
          />
          {google && (
            <section className="card p-4 text-sm">
              <h2 className="mb-2 font-medium">Google (live)</h2>
              <dl className="space-y-1 text-muted">
                {google.rating !== null && (
                  <div>
                    ★ {google.rating} · {google.reviews} reviews
                  </div>
                )}
                {google.status && google.status !== "OPERATIONAL" && <div className="text-danger">{google.status}</div>}
                {google.phone && <div>{google.phone}</div>}
                {google.website && (
                  <a className="block truncate text-accent underline" href={google.website} target="_blank" rel="noreferrer">
                    {google.website}
                  </a>
                )}
                {google.mapsUri && (
                  <a className="text-accent underline" href={google.mapsUri} target="_blank" rel="noreferrer">
                    Open in Google Maps
                  </a>
                )}
                {google.hours.length > 0 && (
                  <details>
                    <summary className="cursor-pointer">Opening hours</summary>
                    <ul className="mt-1 text-xs">
                      {google.hours.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </dl>
              <p className="mt-2 text-xs text-muted">Shown live from Google; not stored in the CRM.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
