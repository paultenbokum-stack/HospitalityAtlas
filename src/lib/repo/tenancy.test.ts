// Integration test: repo functions must never read or write across workspaces.
// Runs only when TEST_DATABASE_URL points at a migrated, disposable database.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("workspace isolation", () => {
  let repo: typeof import("./companies");
  let timeline: typeof import("./timeline");
  let config: typeof import("./config");
  let wsA: { id: string };
  let wsB: { id: string };
  let userId: string;
  let companyId: string;
  let taskId: string;
  let placeRef: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    const { createWorkspaceFromTemplate } = await import("./workspaces");
    const { getTemplate } = await import("@/lib/templates");
    const { db } = await import("@/db/client");
    const { users } = await import("@/db/schema");
    repo = await import("./companies");
    timeline = await import("./timeline");
    config = await import("./config");

    const suffix = Date.now().toString(36);
    userId = (await db.insert(users).values({ email: `tenancy-${suffix}@test.local` }).returning())[0].id;
    wsA = await createWorkspaceFromTemplate("A", `a-${suffix}`, getTemplate("hospitality")!, userId);
    wsB = await createWorkspaceFromTemplate("B", `b-${suffix}`, getTemplate("security-saas")!, null);
    const [stage] = await config.listStages(wsA.id);
    placeRef = `place-${suffix}`;
    companyId = (
      await repo.createCompany(wsA.id, userId, { name: "Only in A", source: "discovery", externalRef: placeRef, stageId: stage.id })
    ).id;
    taskId = (await timeline.createTask(wsA.id, companyId, { title: "Call", dueAt: new Date(), assigneeId: userId })).id;
  });

  afterAll(async () => {
    const { db } = await import("@/db/client");
    const { workspaces, users } = await import("@/db/schema");
    const { eq, inArray } = await import("drizzle-orm");
    await db.delete(workspaces).where(inArray(workspaces.id, [wsA.id, wsB.id]));
    await db.delete(users).where(eq(users.id, userId));
  });

  it("reads are scoped", async () => {
    expect(await repo.getCompany(wsA.id, companyId)).not.toBeNull();
    expect(await repo.getCompany(wsB.id, companyId)).toBeNull();
    expect((await repo.listCompanies(wsB.id, userId)).map((c) => c.id)).not.toContain(companyId);
    expect((await repo.findByExternalRefs(wsA.id, [placeRef])).get(placeRef)).toBe(companyId);
    expect((await repo.findByExternalRefs(wsB.id, [placeRef])).size).toBe(0);
    expect(await timeline.listTimeline(wsB.id, companyId)).toEqual([]);
    expect(await timeline.listCompanyTasks(wsB.id, companyId)).toEqual([]);
    expect(await config.isMember(wsB.id, userId)).toBe(false);
  });

  it("writes are scoped", async () => {
    const [stageB] = await config.listStages(wsB.id);
    expect(await repo.setStage(wsB.id, companyId, userId, stageB, null)).toBeNull();
    expect(await repo.updateCompanyDetails(wsB.id, companyId, { name: "hijacked" })).toBeNull();
    expect(await repo.mergeAttributes(wsB.id, companyId, userId, { x: "y" }, "x")).toBeNull();
    expect(await repo.archiveCompany(wsB.id, companyId, userId)).toBeNull();
    expect(await repo.setOwner(wsB.id, [companyId], userId, null)).toBe(0);
    expect(await timeline.completeTask(wsB.id, taskId, userId, true)).toBeNull();
    const a = await repo.getCompany(wsA.id, companyId);
    expect(a?.company.name).toBe("Only in A");
    expect(a?.company.archivedAt).toBeNull();
  });

  it("each workspace keeps its own vocabulary", async () => {
    const a = (await config.listStages(wsA.id)).map((s) => s.label);
    const b = (await config.listStages(wsB.id)).map((s) => s.label);
    expect(a).toContain("Not a fit");
    expect(b).toContain("Site assessment");
    expect(a).not.toContain("Site assessment");
  });
});
