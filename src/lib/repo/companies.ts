import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  activities,
  companies,
  outcomeReasons,
  pipelineStages,
  users,
  type AttributeValues,
  type ViewFilter,
} from "@/db/schema";

export type CompanySort = "follow_up" | "recent" | "name" | "created";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function filterClauses(workspaceId: string, userId: string, f: ViewFilter): SQL[] {
  const where: SQL[] = [eq(companies.workspaceId, workspaceId), isNull(companies.archivedAt)];
  if (f.q?.trim()) {
    const q = `%${f.q.trim()}%`;
    where.push(or(ilike(companies.name, q), ilike(companies.locality, q), ilike(companies.region, q))!);
  }
  const stageIds = (f.stageIds ?? []).filter((s) => UUID.test(s));
  if (stageIds.length) where.push(inArray(companies.stageId, stageIds));
  if (f.owner === "me") where.push(eq(companies.ownerUserId, userId));
  else if (f.owner === "none") where.push(isNull(companies.ownerUserId));
  else if (f.owner && UUID.test(f.owner)) where.push(eq(companies.ownerUserId, f.owner));
  if (f.region) where.push(eq(companies.region, f.region));
  if (f.followUp) {
    const today = startOfToday();
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const week = new Date(today.getTime() + 7 * 86_400_000);
    if (f.followUp === "overdue") where.push(lt(companies.nextFollowUpAt, today));
    if (f.followUp === "today") where.push(and(gte(companies.nextFollowUpAt, today), lt(companies.nextFollowUpAt, tomorrow))!);
    if (f.followUp === "week") where.push(lt(companies.nextFollowUpAt, week));
    if (f.followUp === "none") where.push(isNull(companies.nextFollowUpAt));
  }
  // Attribute filters: jsonb_exists matches both a select value ("opt") and a multiselect
  // array containing it (["opt", …]); plain values compare as text.
  for (const [key, value] of Object.entries(f.attr ?? {})) {
    if (!value) continue;
    where.push(
      sql`(jsonb_exists(${companies.attributes} -> ${key}, ${value}) or ${companies.attributes} ->> ${key} = ${value})`,
    );
  }
  return where;
}

export async function listCompanies(
  workspaceId: string,
  userId: string,
  filter: ViewFilter = {},
  sort: CompanySort = "follow_up",
  limit = 500,
) {
  const order =
    sort === "name"
      ? [asc(companies.name)]
      : sort === "recent"
        ? [sql`${companies.lastActivityAt} desc nulls last`, asc(companies.name)]
        : sort === "created"
          ? [desc(companies.createdAt)]
          : [sql`${companies.nextFollowUpAt} asc nulls last`, asc(companies.name)];

  return db
    .select({
      id: companies.id,
      name: companies.name,
      locality: companies.locality,
      region: companies.region,
      stageId: companies.stageId,
      stageLabel: pipelineStages.label,
      stageColor: pipelineStages.color,
      stageKind: pipelineStages.kind,
      ownerUserId: companies.ownerUserId,
      ownerName: users.name,
      ownerEmail: users.email,
      attributes: companies.attributes,
      nextFollowUpAt: companies.nextFollowUpAt,
      lastActivityAt: companies.lastActivityAt,
      source: companies.source,
      outcomeReason: outcomeReasons.label,
    })
    .from(companies)
    .innerJoin(pipelineStages, eq(companies.stageId, pipelineStages.id))
    .leftJoin(users, eq(companies.ownerUserId, users.id))
    .leftJoin(outcomeReasons, eq(companies.outcomeReasonId, outcomeReasons.id))
    .where(and(...filterClauses(workspaceId, userId, filter)))
    .orderBy(...order)
    .limit(limit);
}

export type CompanyRow = Awaited<ReturnType<typeof listCompanies>>[number];

export async function listRegions(workspaceId: string) {
  const rows = await db
    .selectDistinct({ region: companies.region })
    .from(companies)
    .where(and(eq(companies.workspaceId, workspaceId), isNotNull(companies.region), isNull(companies.archivedAt)))
    .orderBy(asc(companies.region));
  return rows.map((r) => r.region as string);
}

export async function getCompany(workspaceId: string, companyId: string) {
  const [row] = await db
    .select({ company: companies, stage: pipelineStages, reason: outcomeReasons })
    .from(companies)
    .innerJoin(pipelineStages, eq(companies.stageId, pipelineStages.id))
    .leftJoin(outcomeReasons, eq(companies.outcomeReasonId, outcomeReasons.id))
    .where(and(eq(companies.workspaceId, workspaceId), eq(companies.id, companyId)))
    .limit(1);
  return row ?? null;
}

export type NewCompany = {
  name: string;
  locality?: string | null;
  region?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  contactRoles?: string[];
  source: "discovery" | "manual" | "import";
  externalRef?: string | null;
  stageId: string;
  ownerUserId?: string | null;
  attributes?: AttributeValues;
};

export async function createCompany(workspaceId: string, userId: string, input: NewCompany) {
  return db.transaction(async (tx) => {
    const [c] = await tx
      .insert(companies)
      .values({ ...input, workspaceId, contactRoles: input.contactRoles ?? [], attributes: input.attributes ?? {} })
      .returning();
    await tx.insert(activities).values({
      workspaceId,
      companyId: c.id,
      userId,
      kind: "system",
      body: input.source === "discovery" ? "Added from Discover" : input.source === "import" ? "Imported" : "Created",
    });
    return c;
  });
}

// Existing place ids in this workspace — lets Discover mark results "In CRM".
export async function findByExternalRefs(workspaceId: string, refs: string[]) {
  if (!refs.length) return new Map<string, string>();
  const rows = await db
    .select({ id: companies.id, ref: companies.externalRef })
    .from(companies)
    .where(and(eq(companies.workspaceId, workspaceId), inArray(companies.externalRef, refs)));
  return new Map(rows.map((r) => [r.ref as string, r.id]));
}

// Possible duplicates for a manual add: same name (case-insensitive), optionally same locality.
export function findSimilar(workspaceId: string, name: string, locality?: string | null) {
  const clauses = [eq(companies.workspaceId, workspaceId), sql`lower(${companies.name}) = lower(${name.trim()})`];
  if (locality?.trim()) clauses.push(sql`lower(coalesce(${companies.locality}, '')) = lower(${locality.trim()})`);
  return db
    .select({ id: companies.id, name: companies.name, locality: companies.locality })
    .from(companies)
    .where(and(...clauses))
    .limit(5);
}

type CompanyPatch = Partial<
  Pick<NewCompany, "name" | "locality" | "region" | "address" | "phone" | "website" | "email" | "contactRoles">
>;

export async function updateCompanyDetails(workspaceId: string, companyId: string, patch: CompanyPatch) {
  const [c] = await db
    .update(companies)
    .set(patch)
    .where(and(eq(companies.workspaceId, workspaceId), eq(companies.id, companyId)))
    .returning({ id: companies.id });
  return c ?? null;
}

async function systemEntry(workspaceId: string, companyId: string, userId: string, body: string) {
  await db.insert(activities).values({ workspaceId, companyId, userId, kind: "system", body });
}

export async function setStage(
  workspaceId: string,
  companyId: string,
  userId: string,
  stage: { id: string; label: string },
  outcomeReason: { id: string; label: string } | null,
) {
  const [c] = await db
    .update(companies)
    .set({ stageId: stage.id, outcomeReasonId: outcomeReason?.id ?? null })
    .where(and(eq(companies.workspaceId, workspaceId), eq(companies.id, companyId)))
    .returning({ id: companies.id });
  if (!c) return null;
  await systemEntry(
    workspaceId,
    companyId,
    userId,
    outcomeReason ? `Stage → ${stage.label} (${outcomeReason.label})` : `Stage → ${stage.label}`,
  );
  return c;
}

export async function setOwner(
  workspaceId: string,
  companyIds: string[],
  userId: string,
  owner: { id: string; label: string } | null,
) {
  if (!companyIds.length) return 0;
  const rows = await db
    .update(companies)
    .set({ ownerUserId: owner?.id ?? null })
    .where(and(eq(companies.workspaceId, workspaceId), inArray(companies.id, companyIds)))
    .returning({ id: companies.id });
  for (const r of rows) await systemEntry(workspaceId, r.id, userId, owner ? `Owner → ${owner.label}` : "Owner cleared");
  return rows.length;
}

export async function mergeAttributes(
  workspaceId: string,
  companyId: string,
  userId: string,
  values: AttributeValues,
  summary: string,
) {
  const [current] = await db
    .select({ attributes: companies.attributes })
    .from(companies)
    .where(and(eq(companies.workspaceId, workspaceId), eq(companies.id, companyId)))
    .limit(1);
  if (!current) return null;
  const next: AttributeValues = { ...current.attributes };
  for (const [k, v] of Object.entries(values)) {
    if (v === null) delete next[k];
    else next[k] = v;
  }
  await db
    .update(companies)
    .set({ attributes: next })
    .where(and(eq(companies.workspaceId, workspaceId), eq(companies.id, companyId)));
  await systemEntry(workspaceId, companyId, userId, summary);
  return next;
}

export async function archiveCompany(workspaceId: string, companyId: string, userId: string) {
  const [c] = await db
    .update(companies)
    .set({ archivedAt: new Date() })
    .where(and(eq(companies.workspaceId, workspaceId), eq(companies.id, companyId)))
    .returning({ id: companies.id });
  if (c) await systemEntry(workspaceId, companyId, userId, "Archived");
  return c ?? null;
}
