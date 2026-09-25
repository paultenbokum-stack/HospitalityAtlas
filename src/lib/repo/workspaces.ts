import "server-only";
import { uuidv7 } from "uuidv7";
import { db } from "@/db/client";
import {
  activityTypes,
  attributeDefinitions,
  memberships,
  outcomeReasons,
  pipelineStages,
  workspaces,
} from "@/db/schema";
import type { WorkspaceTemplate } from "@/lib/templates";

// Creates a workspace and copies a template's vocabulary into it.
export async function createWorkspaceFromTemplate(
  name: string,
  slug: string,
  template: WorkspaceTemplate,
  adminUserId: string | null,
) {
  return db.transaction(async (tx) => {
    const [ws] = await tx.insert(workspaces).values({ name, slug, settings: template.settings }).returning();
    await tx.insert(pipelineStages).values(template.stages.map((s, i) => ({ ...s, workspaceId: ws.id, position: i })));
    await tx
      .insert(outcomeReasons)
      .values(template.outcomeReasons.map((label, i) => ({ workspaceId: ws.id, label, position: i })));
    await tx.insert(activityTypes).values(template.activityTypes.map((t, i) => ({ ...t, workspaceId: ws.id, position: i })));
    await tx.insert(attributeDefinitions).values(
      template.attributes.map((a, i) => ({
        workspaceId: ws.id,
        key: a.key,
        label: a.label,
        type: a.type,
        position: i,
        options: (a.options ?? []).map((label) => ({ id: uuidv7(), label, active: true })),
      })),
    );
    if (adminUserId) await tx.insert(memberships).values({ workspaceId: ws.id, userId: adminUserId, role: "admin" });
    return ws;
  });
}
