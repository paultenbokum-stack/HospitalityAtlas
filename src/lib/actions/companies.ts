"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatAttribute, parseAttributePatch } from "@/lib/attributes";
import { personalDataError, isGenericInbox } from "@/lib/pii";
import * as repo from "@/lib/repo/companies";
import { getStage, isMember, listAttributeDefs, listMembers, listOutcomeReasons, listStages } from "@/lib/repo/config";
import { completeTask, createTask, logActivity } from "@/lib/repo/timeline";
import { requireRole } from "@/lib/session";
import { resolveOutcomeReason } from "@/lib/stage-rules";
import { run, UserError } from "./result";

const optionalText = z
  .string()
  .trim()
  .max(300)
  .transform((v) => v || null)
  .nullish();

const detailsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  locality: optionalText,
  region: optionalText,
  address: optionalText,
  phone: optionalText,
  website: optionalText,
  email: optionalText.refine((v) => !v || isGenericInbox(v), "Use a generic business inbox (info@, bookings@), not a personal address"),
  contactRoles: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
});

function checkPii(...texts: (string | null | undefined)[]) {
  for (const t of texts) {
    const err = t ? personalDataError(t) : null;
    if (err) throw new UserError(err);
  }
}

async function assertAssignable(workspaceId: string, userId: string | null | undefined) {
  if (userId && !(await isMember(workspaceId, userId))) throw new UserError("That person isn't in this workspace");
}

export async function createCompanyAction(input: unknown) {
  return run(async () => {
    const ctx = await requireRole("rep");
    const parsed = detailsSchema
      .extend({
        stageId: z.uuid().optional(),
        ownerUserId: z.uuid().nullish(),
        allowDuplicate: z.boolean().optional(),
      })
      .parse(input);
    checkPii(parsed.name, parsed.address, ...(parsed.contactRoles ?? []));
    await assertAssignable(ctx.workspace.id, parsed.ownerUserId);

    if (!parsed.allowDuplicate) {
      const similar = await repo.findSimilar(ctx.workspace.id, parsed.name, parsed.locality);
      if (similar.length)
        return { duplicates: similar };
    }
    const stages = await listStages(ctx.workspace.id);
    const stageId = parsed.stageId ?? stages[0]?.id;
    if (!stageId || !stages.some((s) => s.id === stageId)) throw new UserError("No pipeline stage configured");

    const { allowDuplicate: _a, ...values } = parsed;
    void _a;
    const c = await repo.createCompany(ctx.workspace.id, ctx.userId, {
      ...values,
      stageId,
      ownerUserId: parsed.ownerUserId ?? ctx.userId,
      source: "manual",
    });
    revalidatePath("/companies");
    return { id: c.id };
  });
}

export async function updateCompanyDetailsAction(companyId: string, input: unknown) {
  return run(async () => {
    const ctx = await requireRole("rep");
    const parsed = detailsSchema.partial().parse(input);
    checkPii(parsed.name, parsed.address, ...(parsed.contactRoles ?? []));
    const c = await repo.updateCompanyDetails(ctx.workspace.id, z.uuid().parse(companyId), parsed);
    if (!c) throw new UserError("Company not found");
    revalidatePath(`/companies/${companyId}`);
    return null;
  });
}

export async function changeStageAction(companyId: string, stageId: string, reasonId?: string | null) {
  return run(async () => {
    const ctx = await requireRole("rep");
    const stage = await getStage(ctx.workspace.id, z.uuid().parse(stageId));
    if (!stage) throw new UserError("Unknown stage");
    const rule = resolveOutcomeReason(stage.kind, reasonId);
    if (!rule.ok) throw new UserError(rule.error);
    let reason: { id: string; label: string } | null = null;
    if (rule.reasonId) {
      const r = (await listOutcomeReasons(ctx.workspace.id)).find((x) => x.id === rule.reasonId);
      if (!r) throw new UserError("Unknown outcome reason");
      reason = { id: r.id, label: r.label };
    }
    const c = await repo.setStage(ctx.workspace.id, z.uuid().parse(companyId), ctx.userId, stage, reason);
    if (!c) throw new UserError("Company not found");
    revalidatePath("/companies");
    revalidatePath("/pipeline");
    revalidatePath(`/companies/${companyId}`);
    return null;
  });
}

export async function assignOwnerAction(companyIds: string[], ownerUserId: string | null) {
  return run(async () => {
    const ctx = await requireRole("rep");
    const ids = z.array(z.uuid()).max(500).parse(companyIds);
    let owner: { id: string; label: string } | null = null;
    if (ownerUserId) {
      const m = (await listMembers(ctx.workspace.id)).find((x) => x.id === ownerUserId);
      if (!m) throw new UserError("That person isn't in this workspace");
      owner = { id: m.id, label: m.name ?? m.email };
    }
    const n = await repo.setOwner(ctx.workspace.id, ids, ctx.userId, owner);
    revalidatePath("/companies");
    return { updated: n };
  });
}

export async function bulkStageAction(companyIds: string[], stageId: string) {
  return run(async () => {
    const ctx = await requireRole("rep");
    const ids = z.array(z.uuid()).max(500).parse(companyIds);
    const stage = await getStage(ctx.workspace.id, z.uuid().parse(stageId));
    if (!stage) throw new UserError("Unknown stage");
    if (stage.kind === "lost") throw new UserError("Move to a lost stage one at a time, so each gets an outcome reason.");
    for (const id of ids) await repo.setStage(ctx.workspace.id, id, ctx.userId, stage, null);
    revalidatePath("/companies");
    return { updated: ids.length };
  });
}

export async function setAttributesAction(companyId: string, patch: Record<string, unknown>) {
  return run(async () => {
    const ctx = await requireRole("rep");
    const defs = await listAttributeDefs(ctx.workspace.id);
    const parsed = parseAttributePatch(defs, patch);
    if (!parsed.ok) throw new UserError(parsed.error);
    for (const v of Object.values(parsed.values)) if (typeof v === "string") checkPii(v);
    const summary = Object.entries(parsed.values)
      .map(([k, v]) => {
        const def = defs.find((d) => d.key === k)!;
        return v === null ? `${def.label} cleared` : `${def.label} → ${formatAttribute(def, v)}`;
      })
      .join("; ");
    const next = await repo.mergeAttributes(ctx.workspace.id, z.uuid().parse(companyId), ctx.userId, parsed.values, summary);
    if (!next) throw new UserError("Company not found");
    revalidatePath(`/companies/${companyId}`);
    return null;
  });
}

export async function archiveCompanyAction(companyId: string) {
  return run(async () => {
    const ctx = await requireRole("manager");
    const c = await repo.archiveCompany(ctx.workspace.id, z.uuid().parse(companyId), ctx.userId);
    if (!c) throw new UserError("Company not found");
    revalidatePath("/companies");
    return null;
  });
}

const logSchema = z.object({
  typeId: z.uuid(),
  body: z.string().trim().min(1, "Write a short note").max(5000),
  occurredAt: z.coerce.date().optional(),
  nextStep: z
    .object({ title: z.string().trim().min(1).max(200), dueAt: z.coerce.date() })
    .optional(),
});

// Quick-log bar: log what happened and, in the same step, set the next step (a task).
export async function logActivityAction(companyId: string, input: unknown) {
  return run(async () => {
    const ctx = await requireRole("rep");
    const id = z.uuid().parse(companyId);
    const parsed = logSchema.parse(input);
    checkPii(parsed.body, parsed.nextStep?.title);
    if (!(await repo.getCompany(ctx.workspace.id, id))) throw new UserError("Company not found");
    await logActivity(ctx.workspace.id, id, ctx.userId, {
      typeId: parsed.typeId,
      body: parsed.body,
      occurredAt: parsed.occurredAt ?? new Date(),
    });
    if (parsed.nextStep) await createTask(ctx.workspace.id, id, { ...parsed.nextStep, assigneeId: ctx.userId });
    revalidatePath(`/companies/${companyId}`);
    revalidatePath("/today");
    return null;
  });
}

export async function createTaskAction(companyId: string, input: unknown) {
  return run(async () => {
    const ctx = await requireRole("rep");
    const id = z.uuid().parse(companyId);
    const parsed = z
      .object({ title: z.string().trim().min(1).max(200), dueAt: z.coerce.date(), assigneeId: z.uuid().nullish() })
      .parse(input);
    checkPii(parsed.title);
    await assertAssignable(ctx.workspace.id, parsed.assigneeId);
    if (!(await repo.getCompany(ctx.workspace.id, id))) throw new UserError("Company not found");
    await createTask(ctx.workspace.id, id, { ...parsed, assigneeId: parsed.assigneeId ?? ctx.userId });
    revalidatePath(`/companies/${companyId}`);
    revalidatePath("/today");
    return null;
  });
}

export async function toggleTaskAction(taskId: string, done: boolean) {
  return run(async () => {
    const ctx = await requireRole("rep");
    const t = await completeTask(ctx.workspace.id, z.uuid().parse(taskId), ctx.userId, done);
    if (!t) throw new UserError("Task not found");
    revalidatePath(`/companies/${t.companyId}`);
    revalidatePath("/today");
    return null;
  });
}
