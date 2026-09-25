// Idempotent seed: creates the GuestWave workspace (hospitality template) if missing, and the
// root superadmin from ROOT_ADMIN_EMAIL. With SEED_DEV=1 it also adds a demo security-SaaS
// workspace and two local users for the dev-login provider — never run that in production.
// Run: npm run db:seed
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("./client");
  const { memberships, users, workspaces } = await import("./schema");
  const { createWorkspaceFromTemplate } = await import("@/lib/repo/workspaces");
  const { getTemplate } = await import("@/lib/templates");

  async function ensureUser(email: string, name: string, isSuperadmin: boolean) {
    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (u) return u;
    return (await db.insert(users).values({ email, name, isSuperadmin }).returning())[0];
  }

  async function ensureWorkspace(name: string, slug: string, templateId: string) {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
    if (ws) return ws;
    console.log(`Creating workspace ${name}`);
    return createWorkspaceFromTemplate(name, slug, getTemplate(templateId)!, null);
  }

  const guestwave = await ensureWorkspace("GuestWave", "guestwave", "hospitality");

  const root = (process.env.ROOT_ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (root) await ensureUser(root, root.split("@")[0], true);

  if (process.env.SEED_DEV === "1") {
    const security = await ensureWorkspace("Security SaaS (demo)", "security-demo", "security-saas");
    const admin = await ensureUser("admin@dev.local", "Dev Admin", true);
    const rep = await ensureUser("rep@dev.local", "Dev Rep", false);
    const other = await ensureUser("security-rep@dev.local", "Security Rep", false);
    await db.insert(memberships).values({ workspaceId: guestwave.id, userId: admin.id, role: "admin" }).onConflictDoNothing();
    await db.insert(memberships).values({ workspaceId: guestwave.id, userId: rep.id, role: "rep" }).onConflictDoNothing();
    await db.insert(memberships).values({ workspaceId: security.id, userId: other.id, role: "rep" }).onConflictDoNothing();
  }

  console.log("Seed complete");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
