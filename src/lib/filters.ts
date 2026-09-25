import type { ViewFilter } from "@/db/schema";
import type { CompanySort } from "@/lib/repo/companies";

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const all = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).filter(Boolean);

// URL search params ⇄ ViewFilter, so every list state is linkable and saved views are just URLs.
export function filterFromParams(p: Params): { filter: ViewFilter; sort: CompanySort } {
  const attr: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) if (k.startsWith("a.") && first(v)) attr[k.slice(2)] = first(v)!;
  const followUp = first(p.follow);
  const sort = first(p.sort);
  return {
    filter: {
      q: first(p.q),
      stageIds: all(p.stage),
      owner: first(p.owner),
      region: first(p.region),
      followUp: (["overdue", "today", "week", "none"] as const).find((x) => x === followUp),
      attr,
    },
    sort: (["follow_up", "recent", "name", "created"] as const).find((x) => x === sort) ?? "follow_up",
  };
}

export function paramsFromFilter(f: ViewFilter): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  for (const s of f.stageIds ?? []) sp.append("stage", s);
  if (f.owner) sp.set("owner", f.owner);
  if (f.region) sp.set("region", f.region);
  if (f.followUp) sp.set("follow", f.followUp);
  for (const [k, v] of Object.entries(f.attr ?? {})) if (v) sp.set(`a.${k}`, v);
  return sp.toString();
}
