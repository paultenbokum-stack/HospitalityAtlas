import { DiscoverClient } from "@/components/discover";
import { listAttributeDefs } from "@/lib/repo/config";
import { requirePageContext } from "@/lib/session";

export default async function DiscoverPage() {
  const ctx = await requirePageContext();
  const defs = (await listAttributeDefs(ctx.workspace.id)).filter((d) => d.type === "select");
  const discovery = ctx.workspace.settings.discovery;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Discover</h1>
        <p className="text-sm text-muted">
          Find new prospects on Google Maps and add the ones worth working. Everything else happens in Companies.
        </p>
      </div>
      <DiscoverClient
        presets={discovery?.presets ?? []}
        terms={discovery?.searchTerms ?? []}
        selectDefs={defs.map((d) => ({ key: d.key, label: d.label, options: d.options.filter((o) => o.active) }))}
        placesConfigured={!!process.env.GOOGLE_PLACES_API_KEY}
        mapsKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? null}
      />
    </div>
  );
}
