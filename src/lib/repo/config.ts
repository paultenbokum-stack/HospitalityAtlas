import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  activityTypes,
  attributeDefinitions,
  invites,
  memberships,
  outcomeReasons,
  pipelineStages,
  users,
} from "@/db/schema";

// Workspace vocabulary: stages, outcome reasons, activity types, attribute definitions.
// Every function takes workspaceId first and filters on it.

export function listStages(workspaceId: string, { includeInactive = false } = {}) {
  return db
    .select()
    .from(pipelineStages)
    .where(
      includeInactive
        ? eq(pipelineStages.workspaceId, workspaceId)
        : and(eq(pipelineStages.workspaceId, workspaceId), eq(pipelineStages.active, true)),
    )
    .orderBy(asc(pipelineStages.position));
}

export async function getStage(workspaceId: string, stageId: string) {
  const [s] = await db
    .select()
    .from(pipelineStages)
    .where(and(eq(pipelineStages.workspaceId, workspaceId), eq(pipelineStages.id, stageId)))
    .limit(1);
  return s ?? null;
}

export function listOutcomeReasons(workspaceId: string, { includeInactive = false } = {}) {
  return db
    .select()
    .from(outcomeReasons)
    .where(
      includeInactive
        ? eq(outcomeReasons.workspaceId, workspaceId)
        : and(eq(outcomeReasons.workspaceId, workspaceId), eq(outcomeReasons.active, true)),
    )
    .orderBy(asc(outcomeReasons.position), asc(outcomeReasons.label));
}

export function listActivityTypes(workspaceId: string, { includeInactive = false } = {}) {
  return db
    .select()
    .from(activityTypes)
    .where(
      includeInactive
        ? eq(activityTypes.workspaceId, workspaceId)
        : and(eq(activityTypes.workspaceId, workspaceId), eq(activityTypes.active, true)),
    )
    .orderBy(asc(activityTypes.position));
}

export function listAttributeDefs(workspaceId: string, { includeInactive = false } = {}) {
  return db
    .select()
    .from(attributeDefinitions)
    .where(
      includeInactive
        ? eq(attributeDefinitions.workspaceId, workspaceId)
        : and(eq(attributeDefinitions.workspaceId, workspaceId), eq(attributeDefinitions.active, true)),
    )
    .orderBy(asc(attributeDefinitions.position), asc(attributeDefinitions.label));
}

export function listMembers(workspaceId: string) {
  return db
    .select({ id: users.id, name: users.name, email: users.email, role: memberships.role, membershipId: memberships.id })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.workspaceId, workspaceId))
    .orderBy(asc(users.name), asc(users.email));
}

export function listPendingInvites(workspaceId: string) {
  return db.select().from(invites).where(eq(invites.workspaceId, workspaceId)).orderBy(asc(invites.email));
}

export async function isMember(workspaceId: string, userId: string) {
  const [m] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)))
    .limit(1);
  return !!m;
}
