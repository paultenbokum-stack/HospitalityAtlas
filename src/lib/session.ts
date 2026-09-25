import "server-only";
import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { memberships, workspaces, type Role, type Workspace } from "@/db/schema";

export const WORKSPACE_COOKIE = "crm-workspace";

const ROLE_RANK: Record<Role, number> = { admin: 0, manager: 1, rep: 2 };

export function roleAtLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] <= ROLE_RANK[min];
}

export type WorkspaceContext = {
  workspace: Workspace;
  role: Role;
  userId: string;
  isSuperadmin: boolean;
  available: { id: string; name: string }[];
};

// Resolves the signed-in user's current workspace. A user may belong to several (e.g. the
// GuestWave and security-SaaS workspaces); the cookie picks which one, defaulting to the first.
// Superadmins can open any workspace and act as admin in it.
export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const isSuperadmin = Boolean(session.user.isSuperadmin);

  const available: { id: string; name: string; role: Role; ws: Workspace }[] = isSuperadmin
    ? (await db.select().from(workspaces).orderBy(asc(workspaces.name))).map((ws) => ({
        id: ws.id,
        name: ws.name,
        role: "admin" as Role,
        ws,
      }))
    : (
        await db
          .select({ ws: workspaces, role: memberships.role })
          .from(memberships)
          .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
          .where(eq(memberships.userId, userId))
          .orderBy(asc(workspaces.name))
      ).map((r) => ({ id: r.ws.id, name: r.ws.name, role: r.role, ws: r.ws }));

  if (!available.length) return null;
  const selected = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const current = available.find((a) => a.id === selected) ?? available[0];
  return {
    workspace: current.ws,
    role: current.role,
    userId,
    isSuperadmin,
    available: available.map(({ id, name }) => ({ id, name })),
  };
}

// For pages: redirect to login (or the no-access page) instead of rendering.
export async function requirePageContext(min: Role = "rep"): Promise<WorkspaceContext> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/no-access");
  if (!roleAtLeast(ctx.role, min)) redirect("/companies");
  return ctx;
}

export class AccessError extends Error {}

// For server actions: the single shared guard (GuestWave duplicated one per file).
export async function requireRole(min: Role = "rep"): Promise<WorkspaceContext> {
  const ctx = await getWorkspaceContext();
  if (!ctx) throw new AccessError("Not signed in");
  if (!roleAtLeast(ctx.role, min)) throw new AccessError("You don't have permission to do that");
  return ctx;
}
