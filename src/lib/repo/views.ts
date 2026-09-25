import "server-only";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { savedViews } from "@/db/schema";

export const viewFilterSchema = z.object({
  q: z.string().max(100).optional(),
  stageIds: z.array(z.uuid()).max(30).optional(),
  owner: z.string().max(40).optional(),
  region: z.string().max(120).optional(),
  followUp: z.enum(["overdue", "today", "week", "none"]).optional(),
  attr: z.record(z.string().max(40), z.string().max(100)).optional(),
});

// Views visible to a user: their own plus shared (owner null) ones in this workspace.
export function listViews(workspaceId: string, userId: string) {
  return db
    .select()
    .from(savedViews)
    .where(and(eq(savedViews.workspaceId, workspaceId), or(isNull(savedViews.ownerUserId), eq(savedViews.ownerUserId, userId))))
    .orderBy(asc(savedViews.name));
}
