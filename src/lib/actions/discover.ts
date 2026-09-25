"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseAttributePatch } from "@/lib/attributes";
import { PlacesNotConfigured, resolveArea, scanArea, type DiscoveredPlace } from "@/lib/places";
import { createCompany, findByExternalRefs } from "@/lib/repo/companies";
import { listAttributeDefs, listStages } from "@/lib/repo/config";
import { requireRole } from "@/lib/session";
import { run, UserError } from "./result";

export type ScanResult = {
  areaLabel: string;
  viewport: { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } };
  places: (DiscoveredPlace & { companyId: string | null })[];
};

export async function scanAction(input: unknown) {
  return run<ScanResult>(async () => {
    const ctx = await requireRole("rep");
    const p = z
      .object({ area: z.string().trim().min(2).max(120), depth: z.enum(["quick", "deep"]) })
      .parse(input);
    const terms = ctx.workspace.settings.discovery?.searchTerms ?? [];
    if (!terms.length) throw new UserError("No discovery search terms configured — add some in Settings.");
    const regionCode = ctx.workspace.settings.country ?? "ZA";
    try {
      const area = await resolveArea(p.area, regionCode);
      if (!area) throw new UserError(`Couldn't find "${p.area}". Try a town or suburb name.`);
      const places = await scanArea({ area: p.area, viewport: area.viewport, terms, depth: p.depth, regionCode });
      const inCrm = await findByExternalRefs(
        ctx.workspace.id,
        places.map((x) => x.placeId),
      );
      return {
        areaLabel: area.label,
        viewport: area.viewport,
        places: places.map((x) => ({ ...x, companyId: inCrm.get(x.placeId) ?? null })),
      };
    } catch (e) {
      if (e instanceof PlacesNotConfigured) throw new UserError(e.message);
      throw e;
    }
  });
}

const addSchema = z.object({
  places: z
    .array(
      z.object({
        placeId: z.string().min(5).max(300),
        name: z.string().trim().min(1).max(200),
        locality: z.string().trim().max(120).nullish(),
        region: z.string().trim().max(120).nullish(),
      }),
    )
    .min(1)
    .max(200),
  attributes: z.record(z.string(), z.unknown()).optional(),
  assignToMe: z.boolean().optional(),
});

// Adds selected discovery results as companies. Stores the place id plus the rep-confirmed
// name/locality/region only; duplicates (same place id) are skipped.
export async function addToCrmAction(input: unknown) {
  return run(async () => {
    const ctx = await requireRole("rep");
    const p = addSchema.parse(input);
    const [firstStage] = await listStages(ctx.workspace.id);
    if (!firstStage) throw new UserError("No pipeline stage configured");
    let attributes = {};
    if (p.attributes && Object.keys(p.attributes).length) {
      const parsed = parseAttributePatch(await listAttributeDefs(ctx.workspace.id), p.attributes);
      if (!parsed.ok) throw new UserError(parsed.error);
      attributes = Object.fromEntries(Object.entries(parsed.values).filter(([, v]) => v !== null));
    }
    const existing = await findByExternalRefs(
      ctx.workspace.id,
      p.places.map((x) => x.placeId),
    );
    const created: { placeId: string; companyId: string }[] = [];
    for (const place of p.places) {
      if (existing.has(place.placeId)) continue;
      const c = await createCompany(ctx.workspace.id, ctx.userId, {
        name: place.name,
        locality: place.locality ?? null,
        region: place.region ?? null,
        source: "discovery",
        externalRef: place.placeId,
        stageId: firstStage.id,
        ownerUserId: p.assignToMe ? ctx.userId : null,
        attributes,
      });
      created.push({ placeId: place.placeId, companyId: c.id });
    }
    revalidatePath("/companies");
    return { created, skipped: p.places.length - created.length };
  });
}
