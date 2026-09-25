"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { savedViews } from "@/db/schema";
import { viewFilterSchema } from "@/lib/repo/views";
import { requireRole } from "@/lib/session";
import { run, UserError } from "./result";

export async function saveViewAction(input: unknown) {
  return run(async () => {
    const ctx = await requireRole("rep");
    const p = z
      .object({ name: z.string().trim().min(1).max(60), filter: viewFilterSchema, shared: z.boolean() })
      .parse(input);
    if (p.shared && ctx.role === "rep") throw new UserError("Only managers can share views with the team");
    await db.insert(savedViews).values({
      workspaceId: ctx.workspace.id,
      ownerUserId: p.shared ? null : ctx.userId,
      name: p.name,
      filter: p.filter,
    });
    revalidatePath("/companies");
    return null;
  });
}

export async function deleteViewAction(viewId: string) {
  return run(async () => {
    const ctx = await requireRole("rep");
    const [v] = await db
      .select()
      .from(savedViews)
      .where(and(eq(savedViews.workspaceId, ctx.workspace.id), eq(savedViews.id, viewId)))
      .limit(1);
    if (!v) throw new UserError("View not found");
    if (v.ownerUserId ? v.ownerUserId !== ctx.userId : ctx.role === "rep")
      throw new UserError("You can't delete that view");
    await db.delete(savedViews).where(eq(savedViews.id, v.id));
    revalidatePath("/companies");
    return null;
  });
}
