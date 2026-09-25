import "server-only";
import { and, asc, desc, eq, isNull, lt, min, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { activities, activityTypes, companies, pipelineStages, tasks, users } from "@/db/schema";

// Activities (logged + system) and tasks (follow-ups). Every function takes workspaceId first.

export function listTimeline(workspaceId: string, companyId: string) {
  return db
    .select({
      id: activities.id,
      kind: activities.kind,
      body: activities.body,
      occurredAt: activities.occurredAt,
      typeLabel: activityTypes.label,
      typeIcon: activityTypes.icon,
      userName: users.name,
      userEmail: users.email,
    })
    .from(activities)
    .leftJoin(activityTypes, eq(activities.typeId, activityTypes.id))
    .leftJoin(users, eq(activities.userId, users.id))
    .where(and(eq(activities.workspaceId, workspaceId), eq(activities.companyId, companyId)))
    .orderBy(desc(activities.occurredAt), desc(activities.id))
    .limit(300);
}

// Keeps the company's denormalised next_follow_up_at in step with its earliest open task.
async function syncFollowUp(workspaceId: string, companyId: string) {
  const [row] = await db
    .select({ next: min(tasks.dueAt) })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, workspaceId), eq(tasks.companyId, companyId), isNull(tasks.doneAt)));
  await db
    .update(companies)
    .set({ nextFollowUpAt: row?.next ?? null })
    .where(and(eq(companies.workspaceId, workspaceId), eq(companies.id, companyId)));
}

export async function logActivity(
  workspaceId: string,
  companyId: string,
  userId: string,
  input: { typeId: string; body: string; occurredAt: Date },
) {
  const [a] = await db
    .insert(activities)
    .values({ workspaceId, companyId, userId, kind: "log", typeId: input.typeId, body: input.body, occurredAt: input.occurredAt })
    .returning();
  // Raw sql fragments bypass drizzle's column mapping, so pass the timestamp as ISO text + cast.
  const at = sql`${input.occurredAt.toISOString()}::timestamptz`;
  await db
    .update(companies)
    .set({ lastActivityAt: sql`greatest(coalesce(${companies.lastActivityAt}, ${at}), ${at})` })
    .where(and(eq(companies.workspaceId, workspaceId), eq(companies.id, companyId)));
  return a;
}

export async function createTask(
  workspaceId: string,
  companyId: string,
  input: { title: string; dueAt: Date; assigneeId: string | null },
) {
  const [t] = await db.insert(tasks).values({ workspaceId, companyId, ...input }).returning();
  await syncFollowUp(workspaceId, companyId);
  return t;
}

export async function completeTask(workspaceId: string, taskId: string, userId: string, done: boolean) {
  const [t] = await db
    .update(tasks)
    .set({ doneAt: done ? new Date() : null })
    .where(and(eq(tasks.workspaceId, workspaceId), eq(tasks.id, taskId)))
    .returning();
  if (!t) return null;
  await syncFollowUp(workspaceId, t.companyId);
  if (done)
    await db
      .insert(activities)
      .values({ workspaceId, companyId: t.companyId, userId, kind: "system", body: `Done: ${t.title}` });
  return t;
}

export function listCompanyTasks(workspaceId: string, companyId: string) {
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueAt: tasks.dueAt,
      doneAt: tasks.doneAt,
      assigneeName: users.name,
      assigneeEmail: users.email,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(and(eq(tasks.workspaceId, workspaceId), eq(tasks.companyId, companyId)))
    .orderBy(sql`${tasks.doneAt} is not null`, asc(tasks.dueAt))
    .limit(50);
}

// "My day": open tasks for a user due before the end of today (overdue included).
export function listMyOpenTasks(workspaceId: string, userId: string, before: Date) {
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueAt: tasks.dueAt,
      companyId: companies.id,
      companyName: companies.name,
      companyLocality: companies.locality,
      stageLabel: pipelineStages.label,
      stageColor: pipelineStages.color,
    })
    .from(tasks)
    .innerJoin(companies, eq(tasks.companyId, companies.id))
    .innerJoin(pipelineStages, eq(companies.stageId, pipelineStages.id))
    .where(
      and(
        eq(tasks.workspaceId, workspaceId),
        eq(tasks.assigneeId, userId),
        isNull(tasks.doneAt),
        isNull(companies.archivedAt),
        lt(tasks.dueAt, before),
      ),
    )
    .orderBy(asc(tasks.dueAt))
    .limit(200);
}

export function listRecentlyTouched(workspaceId: string, userId: string) {
  return db
    .selectDistinctOn([companies.id], {
      id: companies.id,
      name: companies.name,
      locality: companies.locality,
      at: activities.occurredAt,
    })
    .from(activities)
    .innerJoin(companies, eq(activities.companyId, companies.id))
    .where(and(eq(activities.workspaceId, workspaceId), eq(activities.userId, userId), eq(activities.kind, "log")))
    .orderBy(companies.id, desc(activities.occurredAt))
    .limit(20);
}
