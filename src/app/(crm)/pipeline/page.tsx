import { PipelineBoard } from "@/components/pipeline-board";
import { displayName } from "@/lib/format";
import { listCompanies } from "@/lib/repo/companies";
import { listOutcomeReasons, listStages } from "@/lib/repo/config";
import { requirePageContext } from "@/lib/session";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ owner?: string }> }) {
  const ctx = await requirePageContext();
  const { owner } = await searchParams;
  const ws = ctx.workspace.id;
  const [stages, reasons, rows] = await Promise.all([
    listStages(ws),
    listOutcomeReasons(ws),
    listCompanies(ws, ctx.userId, { owner: owner === "me" ? "me" : undefined }, "follow_up", 1000),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Pipeline</h1>
        <div className="flex gap-1.5 text-sm">
          <a href="/pipeline" className={`rounded-full border px-3 py-1 ${owner !== "me" ? "border-accent bg-accent-soft text-accent" : "border-border"}`}>
            Everyone
          </a>
          <a href="/pipeline?owner=me" className={`rounded-full border px-3 py-1 ${owner === "me" ? "border-accent bg-accent-soft text-accent" : "border-border"}`}>
            Mine
          </a>
        </div>
      </div>
      <PipelineBoard
        stages={stages.map((s) => ({ id: s.id, label: s.label, kind: s.kind, color: s.color }))}
        reasons={reasons.map((r) => ({ id: r.id, label: r.label }))}
        cards={rows.map((r) => ({
          id: r.id,
          name: r.name,
          locality: r.locality,
          stageId: r.stageId,
          owner: displayName({ name: r.ownerName, email: r.ownerEmail }),
          nextFollowUpAt: r.nextFollowUpAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
