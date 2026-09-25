"use server";

import { and, eq, max } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { uuidv7 } from "uuidv7";
import { z } from "zod";
import { db } from "@/db/client";
import {
  activityTypes,
  attributeDefinitions,
  companies,
  invites,
  memberships,
  outcomeReasons,
  pipelineStages,
  workspaces,
  type AttributeOption,
} from "@/db/schema";
import { slugKey } from "@/lib/attributes";
import { createWorkspaceFromTemplate } from "@/lib/repo/workspaces";
import { getWorkspaceContext, requireRole, WORKSPACE_COOKIE } from "@/lib/session";
import { getTemplate } from "@/lib/templates";
import { run, UserError } from "./result";

// Workspace settings. Admin-only except switching workspace. Every write is scoped by the
// caller's current workspace id — ids from the client are never trusted on their own.

const label = z.string().trim().min(1, "Label is required").max(80);
const color = z.string().regex(/^#[0-9a-f]{6}$/i, "Use a hex colour");

function done() {
  revalidatePath("/", "layout");
  return null;
}

export async function switchWorkspaceAction(workspaceId: string) {
  return run(async () => {
    const ctx = await getWorkspaceContext();
    if (!ctx?.available.some((w) => w.id === workspaceId)) throw new UserError("Workspace not available");
    (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 31536000 });
    return done();
  });
}

export async function createWorkspaceAction(input: unknown) {
  return run(async () => {
    const ctx = await getWorkspaceContext();
    if (!ctx?.isSuperadmin) throw new UserError("Only platform admins can create workspaces");
    const p = z.object({ name: label, templateId: z.string() }).parse(input);
    const template = getTemplate(p.templateId);
    if (!template) throw new UserError("Unknown template");
    const slug = `${slugKey(p.name).replace(/_/g, "-")}-${uuidv7().slice(-6)}`;
    const ws = await createWorkspaceFromTemplate(p.name, slug, template, ctx.userId);
    (await cookies()).set(WORKSPACE_COOKIE, ws.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 31536000 });
    return done();
  });
}

export async function renameWorkspaceAction(name: string) {
  return run(async () => {
    const ctx = await requireRole("admin");
    await db.update(workspaces).set({ name: label.parse(name) }).where(eq(workspaces.id, ctx.workspace.id));
    return done();
  });
}

// ── Stages ──

export async function addStageAction(input: unknown) {
  return run(async () => {
    const ctx = await requireRole("admin");
    const p = z.object({ label, kind: z.enum(["open", "won", "lost"]), color }).parse(input);
    const [{ pos }] = await db
      .select({ pos: max(pipelineStages.position) })
      .from(pipelineStages)
      .where(eq(pipelineStages.workspaceId, ctx.workspace.id));
    await db.insert(pipelineStages).values({ ...p, workspaceId: ctx.workspace.id, position: (pos ?? -1) + 1 });
    return done();
  });
}

export async function updateStageAction(stageId: string, input: unknown) {
  return run(async () => {
    const ctx = await requireRole("admin");
    const p = z
      .object({ label, kind: z.enum(["open", "won", "lost"]), color, active: z.boolean() })
      .partial()
      .parse(input);
    if (p.active === false) {
      const [inUse] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(and(eq(companies.workspaceId, ctx.workspace.id), eq(companies.stageId, stageId)))
        .limit(1);
      if (inUse) throw new UserError("Move the companies out of this stage before hiding it");
    }
    await db
      .update(pipelineStages)
      .set(p)
      .where(and(eq(pipelineStages.workspaceId, ctx.workspace.id), eq(pipelineStages.id, stageId)));
    return done();
  });
}

export async function moveStageAction(stageId: string, direction: -1 | 1) {
  return run(async () => {
    const ctx = await requireRole("admin");
    const stages = await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.workspaceId, ctx.workspace.id))
      .orderBy(pipelineStages.position);
    const i = stages.findIndex((s) => s.id === stageId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= stages.length) return null;
    [stages[i], stages[j]] = [stages[j], stages[i]];
    await db.transaction(async (tx) => {
      for (const [pos, s] of stages.entries())
        await tx.update(pipelineStages).set({ position: pos }).where(eq(pipelineStages.id, s.id));
    });
    return done();
  });
}

// ── Outcome reasons & activity types (simple label lists) ──

export async function addOutcomeReasonAction(text: string) {
  return run(async () => {
    const ctx = await requireRole("admin");
    await db.insert(outcomeReasons).values({ workspaceId: ctx.workspace.id, label: label.parse(text), position: 999 });
    return done();
  });
}

export async function updateOutcomeReasonAction(id: string, input: unknown) {
  return run(async () => {
    const ctx = await requireRole("admin");
    const p = z.object({ label, active: z.boolean() }).partial().parse(input);
    await db
      .update(outcomeReasons)
      .set(p)
      .where(and(eq(outcomeReasons.workspaceId, ctx.workspace.id), eq(outcomeReasons.id, id)));
    return done();
  });
}

export async function addActivityTypeAction(text: string) {
  return run(async () => {
    const ctx = await requireRole("admin");
    await db.insert(activityTypes).values({ workspaceId: ctx.workspace.id, label: label.parse(text), position: 999 });
    return done();
  });
}

export async function updateActivityTypeAction(id: string, input: unknown) {
  return run(async () => {
    const ctx = await requireRole("admin");
    const p = z.object({ label, active: z.boolean() }).partial().parse(input);
    await db
      .update(activityTypes)
      .set(p)
      .where(and(eq(activityTypes.workspaceId, ctx.workspace.id), eq(activityTypes.id, id)));
    return done();
  });
}

// ── Attributes ──

export async function addAttributeAction(input: unknown) {
  return run(async () => {
    const ctx = await requireRole("admin");
    const p = z
      .object({
        label,
        type: z.enum(["text", "number", "bool", "date", "select", "multiselect"]),
        options: z.array(label).max(100).default([]),
      })
      .parse(input);
    const key = slugKey(p.label);
    const [clash] = await db
      .select({ id: attributeDefinitions.id })
      .from(attributeDefinitions)
      .where(and(eq(attributeDefinitions.workspaceId, ctx.workspace.id), eq(attributeDefinitions.key, key)))
      .limit(1);
    if (clash) throw new UserError("An attribute with that name already exists");
    await db.insert(attributeDefinitions).values({
      workspaceId: ctx.workspace.id,
      key,
      label: p.label,
      type: p.type,
      position: 999,
      options: p.options.map((l) => ({ id: uuidv7(), label: l, active: true })),
    });
    return done();
  });
}

async function getDef(workspaceId: string, id: string) {
  const [d] = await db
    .select()
    .from(attributeDefinitions)
    .where(and(eq(attributeDefinitions.workspaceId, workspaceId), eq(attributeDefinitions.id, id)))
    .limit(1);
  if (!d) throw new UserError("Attribute not found");
  return d;
}

export async function updateAttributeAction(id: string, input: unknown) {
  return run(async () => {
    const ctx = await requireRole("admin");
    await getDef(ctx.workspace.id, id);
    const p = z.object({ label, active: z.boolean() }).partial().parse(input);
    await db
      .update(attributeDefinitions)
      .set(p)
      .where(and(eq(attributeDefinitions.workspaceId, ctx.workspace.id), eq(attributeDefinitions.id, id)));
    return done();
  });
}

// Options are edited in place by id: add, relabel, or retire (inactive options stay readable
// on existing companies but can't be picked any more).
export async function saveAttributeOptionAction(defId: string, input: unknown) {
  return run(async () => {
    const ctx = await requireRole("admin");
    const def = await getDef(ctx.workspace.id, defId);
    const p = z.object({ id: z.string().optional(), label: label.optional(), active: z.boolean().optional() }).parse(input);
    let options: AttributeOption[];
    if (!p.id) {
      if (!p.label) throw new UserError("Label is required");
      options = [...def.options, { id: uuidv7(), label: p.label, active: true }];
    } else {
      if (!def.options.some((o) => o.id === p.id)) throw new UserError("Option not found");
      options = def.options.map((o) =>
        o.id === p.id ? { ...o, label: p.label ?? o.label, active: p.active ?? o.active } : o,
      );
    }
    await db.update(attributeDefinitions).set({ options }).where(eq(attributeDefinitions.id, def.id));
    return done();
  });
}

// ── Members ──

export async function inviteMemberAction(input: unknown) {
  return run(async () => {
    const ctx = await requireRole("admin");
    const p = z
      .object({ email: z.email().transform((e) => e.toLowerCase()), role: z.enum(["admin", "manager", "rep"]) })
      .parse(input);
    await db
      .insert(invites)
      .values({ workspaceId: ctx.workspace.id, email: p.email, role: p.role, invitedBy: ctx.userId })
      .onConflictDoUpdate({ target: [invites.workspaceId, invites.email], set: { role: p.role, acceptedAt: null } });
    return done();
  });
}

export async function revokeInviteAction(inviteId: string) {
  return run(async () => {
    const ctx = await requireRole("admin");
    await db.delete(invites).where(and(eq(invites.workspaceId, ctx.workspace.id), eq(invites.id, inviteId)));
    return done();
  });
}

export async function setMemberRoleAction(membershipId: string, role: string) {
  return run(async () => {
    const ctx = await requireRole("admin");
    const r = z.enum(["admin", "manager", "rep"]).parse(role);
    const [m] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.workspaceId, ctx.workspace.id), eq(memberships.id, membershipId)))
      .limit(1);
    if (!m) throw new UserError("Member not found");
    if (m.userId === ctx.userId && r !== "admin") throw new UserError("You can't demote yourself");
    await db.update(memberships).set({ role: r }).where(eq(memberships.id, m.id));
    return done();
  });
}

export async function removeMemberAction(membershipId: string) {
  return run(async () => {
    const ctx = await requireRole("admin");
    const [m] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.workspaceId, ctx.workspace.id), eq(memberships.id, membershipId)))
      .limit(1);
    if (!m) throw new UserError("Member not found");
    if (m.userId === ctx.userId) throw new UserError("You can't remove yourself");
    await db.delete(memberships).where(eq(memberships.id, m.id));
    return done();
  });
}

// ── Discovery config ──

export async function saveDiscoveryAction(input: unknown) {
  return run(async () => {
    const ctx = await requireRole("admin");
    const p = z
      .object({
        searchTerms: z.array(z.string().trim().min(2).max(60)).min(1).max(20),
        presets: z
          .array(z.object({ id: z.string().min(1), label, query: z.string().trim().min(2).max(120) }))
          .max(60),
      })
      .parse(input);
    await db
      .update(workspaces)
      .set({ settings: { ...ctx.workspace.settings, discovery: p } })
      .where(eq(workspaces.id, ctx.workspace.id));
    return done();
  });
}
