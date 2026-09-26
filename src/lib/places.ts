import "server-only";

// Google Places API (New), called server-side only: the key never reaches the browser and
// every call is behind a signed-in workspace check. Places ToS: only place ids may be stored;
// everything else here is shown live and discarded (see docs/DECISIONS.md).

const BASE = "https://places.googleapis.com/v1";

export class PlacesNotConfigured extends Error {}

function key() {
  const k = process.env.GOOGLE_PLACES_API_KEY;
  if (!k) throw new PlacesNotConfigured("Discovery isn't configured (GOOGLE_PLACES_API_KEY is not set).");
  return k;
}

type LatLng = { latitude: number; longitude: number };
export type Viewport = { low: LatLng; high: LatLng };

type AddressComponent = { longText?: string; shortText?: string; types?: string[] };
type RawPlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: LatLng;
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  addressComponents?: AddressComponent[];
  viewport?: Viewport;
};

export type DiscoveredPlace = {
  placeId: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  type: string;
  rating: number | null;
  reviews: number;
  locality: string | null;
  region: string | null;
  closed: boolean;
};

const PLACE_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "primaryType",
  "primaryTypeDisplayName",
  "rating",
  "userRatingCount",
  "businessStatus",
  "addressComponents",
];

async function searchText(body: Record<string, unknown>, fields: string[]): Promise<RawPlace[]> {
  const res = await fetch(`${BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key(),
      "X-Goog-FieldMask": fields.map((f) => `places.${f}`).join(","),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  // Key/permission problems are configuration, not bugs — surface them instead of a generic error.
  if (res.status === 403) {
    const reason = ((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message;
    throw new PlacesNotConfigured(`Google rejected the Places key: ${reason ?? "permission denied"} Check the key's restrictions (docs/DEPLOYMENT.md).`);
  }
  if (!res.ok) throw new Error(`Places searchText ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as { places?: RawPlace[] }).places ?? [];
}

function component(p: RawPlace, ...types: string[]) {
  for (const t of types) {
    const c = p.addressComponents?.find((a) => a.types?.includes(t));
    if (c?.longText) return c.longText;
  }
  return null;
}

function toDiscovered(p: RawPlace): DiscoveredPlace {
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "Unnamed",
    address: p.formattedAddress ?? "",
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    type: p.primaryTypeDisplayName?.text ?? p.primaryType ?? "",
    rating: p.rating ?? null,
    reviews: p.userRatingCount ?? 0,
    locality: component(p, "locality", "sublocality", "postal_town", "administrative_area_level_2"),
    region: component(p, "administrative_area_level_1"),
    closed: p.businessStatus === "CLOSED_PERMANENTLY",
  };
}

// Resolves a free-text area ("Ballito, KwaZulu-Natal") to a viewport to scan within.
export async function resolveArea(query: string, regionCode: string) {
  const [place] = await searchText(
    { textQuery: query, regionCode: regionCode.toLowerCase(), pageSize: 1 },
    ["id", "displayName", "formattedAddress", "viewport", "location"],
  );
  if (!place?.viewport) return null;
  return { label: place.formattedAddress ?? place.displayName?.text ?? query, viewport: place.viewport };
}

// Splits a viewport into n×n tiles (deep scan) — same approach as the legacy Atlas.
export function tiles(v: Viewport, n: number): Viewport[] {
  const out: Viewport[] = [];
  const dLat = (v.high.latitude - v.low.latitude) / n;
  const dLng = (v.high.longitude - v.low.longitude) / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      out.push({
        low: { latitude: v.low.latitude + i * dLat, longitude: v.low.longitude + j * dLng },
        high: { latitude: v.low.latitude + (i + 1) * dLat, longitude: v.low.longitude + (j + 1) * dLng },
      });
  return out;
}

// Runs every search term in every tile, deduped by place id. Quick = 1 tile, deep = 3×3.
// Cost scales with terms × tiles, so deep scans are deliberately capped.
export async function scanArea(opts: {
  area: string;
  viewport: Viewport;
  terms: string[];
  depth: "quick" | "deep";
  regionCode: string;
}): Promise<DiscoveredPlace[]> {
  const grid = tiles(opts.viewport, opts.depth === "deep" ? 3 : 1);
  const found = new Map<string, DiscoveredPlace>();
  const jobs = grid.flatMap((tile) => opts.terms.map((term) => ({ tile, term })));
  // Small concurrency window: fast enough, gentle on quota.
  for (let i = 0; i < jobs.length; i += 4) {
    const batch = jobs.slice(i, i + 4);
    const results = await Promise.allSettled(
      batch.map(({ tile, term }) =>
        searchText(
          {
            textQuery: `${term} in ${opts.area}`,
            locationRestriction: { rectangle: tile },
            regionCode: opts.regionCode.toLowerCase(),
            pageSize: 20,
          },
          PLACE_FIELDS,
        ),
      ),
    );
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const p of r.value) if (!found.has(p.id)) found.set(p.id, toDiscovered(p));
    }
  }
  return [...found.values()].sort((a, b) => b.reviews - a.reviews);
}

export type LivePlaceDetails = {
  phone: string | null;
  website: string | null;
  mapsUri: string | null;
  rating: number | null;
  reviews: number;
  status: string | null;
  hours: string[];
};

// Live details for a company page. Displayed only — never written to the database.
export async function getPlaceDetails(placeId: string): Promise<LivePlaceDetails | null> {
  const res = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": key(),
      "X-Goog-FieldMask":
        "nationalPhoneNumber,websiteUri,googleMapsUri,rating,userRatingCount,businessStatus,regularOpeningHours.weekdayDescriptions",
    },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const p = (await res.json()) as {
    nationalPhoneNumber?: string;
    websiteUri?: string;
    googleMapsUri?: string;
    rating?: number;
    userRatingCount?: number;
    businessStatus?: string;
    regularOpeningHours?: { weekdayDescriptions?: string[] };
  };
  return {
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    mapsUri: p.googleMapsUri ?? null,
    rating: p.rating ?? null,
    reviews: p.userRatingCount ?? 0,
    status: p.businessStatus ?? null,
    hours: p.regularOpeningHours?.weekdayDescriptions ?? [],
  };
}
