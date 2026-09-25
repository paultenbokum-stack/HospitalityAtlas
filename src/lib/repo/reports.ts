import "server-only";
import { and, asc, count, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { activities, companies, outcomeReasons, pipelineStages, users } from "@/db/schema";

// Aggregates for the Reports page. All scoped by workspaceId.

export function pipelineByStage(workspaceId: string) {
  return db
    .select({
      id: pipelineStages.id,
      label: pipelineStages.label,
      kind: pipelineStages.kind,
      color: pipelineStages.color,
      n: count(companies.id),
    })
    .from(pipelineStages)
    .leftJoin(
      companies,
      and(eq(companies.stageId, pipelineStages.id), isNull(companies.archivedAt), eq(companies.workspaceId, workspaceId)),
    )
    .where(and(eq(pipelineStages.workspaceId, workspaceId), eq(pipelineStages.active, true)))
    .groupBy(pipelineStages.id)
    .orderBy(asc(pipelineStages.position));
}

export function outcomeBreakdown(workspaceId: string) {
  return db
    .select({ label: outcomeReasons.label, n: count(companies.id) })
    .from(companies)
    .innerJoin(outcomeReasons, eq(companies.outcomeReasonId, outcomeReasons.id))
    .where(and(eq(companies.workspaceId, workspaceId), isNull(companies.archivedAt)))
    .groupBy(outcomeReasons.label)
    .orderBy(sql`count(${companies.id}) desc`);
}

// Logged activities per rep over the last `days`, split by week.
export function activityByRep(workspaceId: string, days = 28) {
  const since = new Date(Date.now() - days * 86_400_000);
  return db
    .select({
      userId: users.id,
      name: sql<string>`coalesce(${users.name}, ${users.email})`,
      week: sql<string>`to_char(date_trunc('week', ${activities.occurredAt}), 'YYYY-MM-DD')`,
      n: count(activities.id),
    })
    .from(activities)
    .innerJoin(users, eq(activities.userId, users.id))
    .where(and(eq(activities.workspaceId, workspaceId), eq(activities.kind, "log"), gte(activities.occurredAt, since)))
    .groupBy(users.id, sql`date_trunc('week', ${activities.occurredAt})`)
    .orderBy(sql`date_trunc('week', ${activities.occurredAt})`);
}

// Distribution of one attribute across active companies. Multiselect arrays are expanded
// to one row per option; a missing value counts under null ("Not set").
export async function attributeBreakdown(workspaceId: string, key: string) {
  const rows = await db.execute<{ value: string | null; n: number }>(sql`
    select v.value, count(*)::int as n
    from ${companies} c
    cross join lateral jsonb_array_elements_text(
      case
        when jsonb_typeof(c.attributes -> ${key}) = 'array' and jsonb_array_length(c.attributes -> ${key}) > 0
          then c.attributes -> ${key}
        when c.attributes -> ${key} is null or jsonb_typeof(c.attributes -> ${key}) = 'null'
          then '[null]'::jsonb
        else jsonb_build_array(c.attributes -> ${key})
      end
    ) as v(value)
    where c.workspace_id = ${workspaceId} and c.archived_at is null
    group by v.value
    order by n desc`);
  return [...rows].map((r) => ({ value: r.value, n: Number(r.n) }));
}

export async function totals(workspaceId: string) {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [c] = await db
    .select({ n: count() })
    .from(companies)
    .where(and(eq(companies.workspaceId, workspaceId), isNull(companies.archivedAt)));
  const [a] = await db
    .select({ n: count() })
    .from(activities)
    .where(and(eq(activities.workspaceId, workspaceId), eq(activities.kind, "log"), gte(activities.occurredAt, since)));
  const [added] = await db
    .select({ n: count() })
    .from(companies)
    .where(and(eq(companies.workspaceId, workspaceId), gte(companies.createdAt, since)));
  return { companies: c.n, activities7d: a.n, added7d: added.n };
}
