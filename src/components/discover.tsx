"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { addToCrmAction, scanAction, type ScanResult } from "@/lib/actions/discover";

type Preset = { id: string; label: string; query: string };
type SelectDef = { key: string; label: string; options: { id: string; label: string }[] };

/* eslint-disable @typescript-eslint/no-explicit-any -- Google Maps JS is loaded at runtime */
declare global {
  interface Window {
    google?: any;
    __atlasMapsLoading?: Promise<void>;
  }
}

function loadMaps(key: string) {
  if (window.google?.maps) return Promise.resolve();
  window.__atlasMapsLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(s);
  });
  return window.__atlasMapsLoading;
}

function ResultsMap({ mapsKey, result, selected, onToggle }: { mapsKey: string; result: ScanResult; selected: Set<string>; onToggle: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMaps(mapsKey).then(() => {
      if (cancelled || !el.current) return;
      const g = window.google.maps;
      map.current ??= new g.Map(el.current, { mapTypeControl: false, streetViewControl: false });
      const v = result.viewport;
      map.current.fitBounds(
        new g.LatLngBounds({ lat: v.low.latitude, lng: v.low.longitude }, { lat: v.high.latitude, lng: v.high.longitude }),
      );
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [mapsKey, result]);

  // Redraw pins whenever results or selection change (and once the map has loaded).
  useEffect(() => {
    if (!ready) return;
    const g = window.google.maps;
    markers.current.forEach((m) => m.setMap(null));
    markers.current = result.places
      .filter((p) => p.lat !== null && p.lng !== null)
      .map((p) => {
        const color = p.companyId ? "#94a3b8" : selected.has(p.placeId) ? "#0f6e5a" : "#f59e0b";
        const m = new g.Marker({
          map: map.current,
          position: { lat: p.lat, lng: p.lng },
          title: p.name,
          icon: { path: g.SymbolPath.CIRCLE, scale: 6, fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 1.5 },
        });
        if (!p.companyId) m.addListener("click", () => onToggle(p.placeId));
        return m;
      });
  }, [ready, result, selected, onToggle]);

  return <div ref={el} className="h-80 w-full rounded-lg border border-border lg:h-[32rem]" />;
}

export function DiscoverClient({
  presets,
  terms,
  selectDefs,
  placesConfigured,
  mapsKey,
}: {
  presets: Preset[];
  terms: string[];
  selectDefs: SelectDef[];
  placesConfigured: boolean;
  mapsKey: string | null;
}) {
  const [area, setArea] = useState(presets[0]?.query ?? "");
  const [depth, setDepth] = useState<"quick" | "deep">("quick");
  const [term, setTerm] = useState(""); // "" = all configured terms
  const [result, setResult] = useState<ScanResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hideInCrm, setHideInCrm] = useState(false);
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [assignToMe, setAssignToMe] = useState(true);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  if (!placesConfigured)
    return (
      <div className="card p-6 text-sm text-muted">
        Discovery needs a server-side Google Places key. Set <code>GOOGLE_PLACES_API_KEY</code> (see docs/DEPLOYMENT.md).
      </div>
    );

  const termCount = term ? 1 : terms.length;
  const visible = (result?.places ?? []).filter((p) => !(hideInCrm && p.companyId));
  const newCount = (result?.places ?? []).filter((p) => !p.companyId).length;

  function scan() {
    setMsg(null);
    start(async () => {
      const r = await scanAction({ area, depth, term: term || null });
      if (!r.ok) return setMsg({ text: r.error, error: true });
      setResult(r.data);
      setSelected(new Set());
    });
  }

  function add() {
    if (!result) return;
    const places = result.places
      .filter((p) => selected.has(p.placeId) && !p.companyId)
      .map((p) => ({ placeId: p.placeId, name: p.name, locality: p.locality, region: p.region }));
    start(async () => {
      const r = await addToCrmAction({
        places,
        attributes: Object.fromEntries(Object.entries(attrs).filter(([, v]) => v)),
        assignToMe,
      });
      if (!r.ok) return setMsg({ text: r.error, error: true });
      const { created, skipped } = r.data;
      setMsg({ text: `Added ${created.length} to Companies${skipped ? ` (${skipped} already there)` : ""}.` });
      // Mark the added ones "In CRM" locally — no second (billable) scan.
      const ids = new Map(created.map((c) => [c.placeId, c.companyId]));
      setResult((res) => res && { ...res, places: res.places.map((x) => ({ ...x, companyId: x.companyId ?? ids.get(x.placeId) ?? null })) });
      setSelected(new Set());
    });
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-2 p-3">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="area">
            Area
          </label>
          <input id="area" list="presets" className="input" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Town, suburb or city" />
          <datalist id="presets">
            {presets.map((p) => (
              <option key={p.id} value={p.query}>
                {p.label}
              </option>
            ))}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="term">
            Search for
          </label>
          <select id="term" className="input" value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="">All terms ({terms.length})</option>
            {terms.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="depth">
            Depth
          </label>
          <select id="depth" className="input" value={depth} onChange={(e) => setDepth(e.target.value as "quick" | "deep")}>
            <option value="quick">Quick ({termCount} {termCount === 1 ? "search" : "searches"})</option>
            <option value="deep">Deep 3×3 ({termCount * 9} searches)</option>
          </select>
        </div>
        <button className="btn-primary" onClick={scan} disabled={pending || area.trim().length < 2}>
          {pending ? "Working…" : "Scan"}
        </button>
      </div>
      <p className="text-xs text-muted">Searching for: {(term ? [term] : terms).join(", ") || "—"} (edit terms in Settings)</p>

      {msg && <p className={`text-sm ${msg.error ? "text-danger" : "text-accent"}`}>{msg.text}</p>}

      {result && (
        <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
          {mapsKey ? (
            <ResultsMap mapsKey={mapsKey} result={result} selected={selected} onToggle={toggle} />
          ) : (
            <div className="card hidden p-4 text-sm text-muted lg:block">
              Set <code>NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY</code> to show results on a map.
            </div>
          )}
          <div className="card flex max-h-[40rem] flex-col">
            <div className="space-y-2 border-b border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span>
                  {result.places.length} found · <b>{newCount} new</b>
                </span>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={hideInCrm} onChange={(e) => setHideInCrm(e.target.checked)} /> Hide in CRM
                </label>
              </div>
              <div className="flex gap-2 text-xs">
                <button className="text-accent underline" onClick={() => setSelected(new Set(visible.filter((p) => !p.companyId && !p.closed).map((p) => p.placeId)))}>
                  Select all new
                </button>
                <button className="text-accent underline" onClick={() => setSelected(new Set())}>
                  Clear
                </button>
              </div>
            </div>
            <ul className="flex-1 divide-y divide-border overflow-y-auto text-sm">
              {visible.map((p) => (
                <li key={p.placeId} className="flex items-start gap-2 px-3 py-2">
                  {p.companyId ? (
                    <Link href={`/companies/${p.companyId}`} className="mt-0.5 shrink-0 rounded bg-surface-2 px-1.5 text-xs text-muted">
                      In CRM
                    </Link>
                  ) : (
                    <input type="checkbox" className="mt-1" checked={selected.has(p.placeId)} onChange={() => toggle(p.placeId)} aria-label={`Select ${p.name}`} />
                  )}
                  <div className="min-w-0">
                    <div className={`font-medium ${p.closed ? "line-through" : ""}`}>{p.name}</div>
                    <div className="truncate text-xs text-muted">
                      {p.type}
                      {p.rating !== null ? ` · ★ ${p.rating} (${p.reviews})` : ""} · {p.locality ?? p.address}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {selected.size > 0 && (
              <div className="space-y-2 border-t border-border p-3 text-sm">
                {selectDefs.map((d) => (
                  <select key={d.key} className="input" value={attrs[d.key] ?? ""} onChange={(e) => setAttrs((a) => ({ ...a, [d.key]: e.target.value }))}>
                    <option value="">{d.label}: leave blank</option>
                    {d.options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {d.label}: {o.label}
                      </option>
                    ))}
                  </select>
                ))}
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={assignToMe} onChange={(e) => setAssignToMe(e.target.checked)} /> Assign to me
                </label>
                <button className="btn-primary w-full" onClick={add} disabled={pending}>
                  Add {selected.size} to Companies
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
