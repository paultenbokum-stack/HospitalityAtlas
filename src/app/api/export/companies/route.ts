import { formatAttribute } from "@/lib/attributes";
import { filterFromParams } from "@/lib/filters";
import { displayName } from "@/lib/format";
import { listCompanies } from "@/lib/repo/companies";
import { listAttributeDefs } from "@/lib/repo/config";
import { getWorkspaceContext } from "@/lib/session";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

// CSV of the current list filter — business fields, stage, owner, attributes. Same scoping
// as the Companies page.
export async function GET(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const { filter, sort } = filterFromParams(params);
  const url = new URL(req.url);
  filter.stageIds = url.searchParams.getAll("stage");
  const [rows, defs] = await Promise.all([
    listCompanies(ctx.workspace.id, ctx.userId, filter, sort, 10_000),
    listAttributeDefs(ctx.workspace.id),
  ]);

  const header = ["Name", "Locality", "Region", "Stage", "Outcome reason", "Owner", "Next follow-up", "Last activity", "Source", ...defs.map((d) => d.label)];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows)
    lines.push(
      [
        r.name,
        r.locality,
        r.region,
        r.stageLabel,
        r.outcomeReason,
        displayName({ name: r.ownerName, email: r.ownerEmail }),
        r.nextFollowUpAt?.toISOString().slice(0, 10),
        r.lastActivityAt?.toISOString().slice(0, 10),
        r.source,
        ...defs.map((d) => formatAttribute(d, r.attributes[d.key])),
      ]
        .map(csvCell)
        .join(","),
    );

  const date = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="companies-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
