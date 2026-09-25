// src/app/admin/atlas/page.tsx
'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Button from '@/components/ui/Button';

// ─── PROVINCES & MARKET PRESETS (SOUTH AFRICA) ──────────────────────────────

interface Province {
  id: string;
  label: string;
}

interface MarketPreset {
  id: string;
  label: string;
  query: string;
  provinceId: string;
  deepGrid: number;
}

const PROVINCES: Province[] = [
  { id: 'EC', label: 'Eastern Cape' },
  { id: 'FS', label: 'Free State' },
  { id: 'GP', label: 'Gauteng' },
  { id: 'KZN', label: 'KwaZulu-Natal' },
  { id: 'LP', label: 'Limpopo' },
  { id: 'MP', label: 'Mpumalanga' },
  { id: 'NC', label: 'Northern Cape' },
  { id: 'NW', label: 'North West' },
  { id: 'WC', label: 'Western Cape' },
];

const PRESETS: MarketPreset[] = [
  { id: 'greater_ballito', label: 'Greater Ballito / Dolphin Coast', query: 'Ballito and Dolphin Coast', provinceId: 'KZN', deepGrid: 2 },
  { id: 'durban', label: 'Durban', query: 'Durban', provinceId: 'KZN', deepGrid: 3 },
  { id: 'umhlanga', label: 'Umhlanga & Durban North', query: 'Umhlanga and Durban North', provinceId: 'KZN', deepGrid: 2 },
  { id: 'umdloti', label: 'Umdloti & La Mercy', query: 'Umdloti and La Mercy', provinceId: 'KZN', deepGrid: 2 },
  { id: 'pietermaritzburg_midlands', label: 'Pietermaritzburg & Midlands', query: 'Pietermaritzburg and KwaZulu-Natal Midlands', provinceId: 'KZN', deepGrid: 2 },

  { id: 'johannesburg', label: 'Johannesburg', query: 'Johannesburg', provinceId: 'GP', deepGrid: 3 },
  { id: 'sandton_rosebank', label: 'Sandton & Rosebank', query: 'Sandton and Rosebank Johannesburg', provinceId: 'GP', deepGrid: 2 },
  { id: 'pretoria_centurion', label: 'Pretoria & Centurion', query: 'Pretoria and Centurion', provinceId: 'GP', deepGrid: 3 },

  { id: 'cape_town', label: 'Cape Town', query: 'Cape Town', provinceId: 'WC', deepGrid: 3 },
  { id: 'cape_wineland', label: 'Cape Winelands', query: 'Stellenbosch Franschhoek Paarl Cape Winelands', provinceId: 'WC', deepGrid: 3 },
  { id: 'garden_route', label: 'Garden Route', query: 'Garden Route Western Cape', provinceId: 'WC', deepGrid: 3 },
  { id: 'overberg', label: 'Hermanus & Overberg', query: 'Hermanus and Overberg', provinceId: 'WC', deepGrid: 2 },

  { id: 'gqeberha', label: 'Gqeberha', query: 'Gqeberha', provinceId: 'EC', deepGrid: 2 },
  { id: 'east_london', label: 'East London', query: 'East London Eastern Cape', provinceId: 'EC', deepGrid: 2 },

  { id: 'bloemfontein', label: 'Bloemfontein', query: 'Bloemfontein', provinceId: 'FS', deepGrid: 2 },
  { id: 'clarens', label: 'Clarens', query: 'Clarens Free State', provinceId: 'FS', deepGrid: 2 },

  { id: 'mbombela_lowveld', label: 'Mbombela & Lowveld', query: 'Mbombela White River Hazyview', provinceId: 'MP', deepGrid: 3 },
  { id: 'dullstroom', label: 'Dullstroom', query: 'Dullstroom Mpumalanga', provinceId: 'MP', deepGrid: 2 },

  { id: 'polokwane', label: 'Polokwane', query: 'Polokwane', provinceId: 'LP', deepGrid: 2 },
  { id: 'hoedspruit', label: 'Hoedspruit', query: 'Hoedspruit Limpopo', provinceId: 'LP', deepGrid: 2 },

  { id: 'rustenburg_suncity', label: 'Rustenburg & Sun City', query: 'Rustenburg and Sun City North West', provinceId: 'NW', deepGrid: 2 },
  { id: 'hartbeespoort', label: 'Hartbeespoort', query: 'Hartbeespoort North West', provinceId: 'NW', deepGrid: 2 },

  { id: 'kimberley', label: 'Kimberley', query: 'Kimberley Northern Cape', provinceId: 'NC', deepGrid: 2 },
  { id: 'upington', label: 'Upington', query: 'Upington Northern Cape', provinceId: 'NC', deepGrid: 2 },
];

const JOBS = [
  { q: 'restaurants', c: 'restaurant' },
  { q: 'cafes', c: 'restaurant' },
  { q: 'hotels', c: 'hotel' },
  { q: 'resorts', c: 'hotel' },
  { q: 'guest houses', c: 'guest' },
  { q: 'bed and breakfasts', c: 'guest' },
  { q: 'self catering accommodation', c: 'holiday' },
  { q: 'holiday apartments', c: 'holiday' },
];

const STYLE: Record<string, { label: string; color: string; glyph: string }> = {
  restaurant: { label: 'Restaurant / Café', color: '#e75a50', glyph: 'R' },
  hotel: { label: 'Hotel / Resort', color: '#3478e5', glyph: 'H' },
  guest: { label: 'Guest House / B&B', color: '#2fab69', glyph: 'G' },
  holiday: { label: 'Holiday Rental', color: '#8d62db', glyph: 'A' },
  other: { label: 'Other Stay', color: '#d69d32', glyph: 'S' },
};

const LOCAL_STORAGE_PROSPECTS = 'guestwave_atlas_prospect_refs';
const LOCAL_STORAGE_CRM = 'guestwave_atlas_crm';

interface ProspectRef {
  placeId: string;
  category: string;
  provinceId: string;
  provinceLabel: string;
  sourceArea: string;
  searchTargetId: string;
  createdAt: string;
}

interface CRMRecord {
  contacted: boolean;
  notes: string;
  stage: string;
  assignedTo?: string;
  followUpAt?: string | null;
  contactedAt?: string | null;
  updatedAt?: string;
}

interface VenueData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  primaryType: string;
  types: string[];
  rating: number | null;
  userRatingCount: number | null;
  googleMapsURI: string;
  businessStatus: string;
  phone: string;
  website: string;
  category: string;
  provinceId: string;
  provinceLabel: string;
  searchArea: string;
}

export default function HospitalityAtlasPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerLibRef = useRef<any>(null);
  const placesLibRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());

  const [isMapReady, setIsMapReady] = useState(false);
  const [apiKey, setApiKey] = useState(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '');
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);

  const [prospects, setProspects] = useState<ProspectRef[]>([]);
  const [crm, setCrm] = useState<Record<string, CRMRecord>>({});
  const [venues, setVenues] = useState<Map<string, VenueData>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedContactStatus, setSelectedContactStatus] = useState('');
  const [selectedSearchArea, setSelectedSearchArea] = useState('');

  // Scan config
  const [presetTarget, setPresetTarget] = useState('greater_ballito');
  const [customTarget, setCustomTarget] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [activityText, setActivityText] = useState('Ready');
  const [activityPct, setActivityPct] = useState<number | null>(null);
  const [isSatellite, setIsSatellite] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Load saved CRM state
  useEffect(() => {
    try {
      const savedP = localStorage.getItem(LOCAL_STORAGE_PROSPECTS);
      const savedC = localStorage.getItem(LOCAL_STORAGE_CRM);
      if (savedP) setProspects(JSON.parse(savedP));
      if (savedC) setCrm(JSON.parse(savedC));
    } catch (e) {
      console.error('Failed to load local CRM cache', e);
    }
  }, []);

  // Save CRM state updates
  const saveProspectsToStorage = (p: ProspectRef[]) => {
    setProspects(p);
    localStorage.setItem(LOCAL_STORAGE_PROSPECTS, JSON.stringify(p));
  };

  const saveCRMRecord = (placeId: string, record: Partial<CRMRecord>) => {
    setCrm((prev) => {
      const updated = {
        ...prev,
        [placeId]: {
          ...(prev[placeId] || { contacted: false, notes: '', stage: 'not_contacted' }),
          ...record,
          updatedAt: new Date().toISOString(),
        },
      };
      localStorage.setItem(LOCAL_STORAGE_CRM, JSON.stringify(updated));
      return updated;
    });
  };

  // Connect Google Maps
  useEffect(() => {
    const keyToUse = customKeyInput.trim() || apiKey.trim();
    if (!keyToUse || !mapContainerRef.current) return;

    let isCancelled = false;

    const loadMapsScript = async () => {
      if ((window as any).google?.maps) {
        initMap();
        return;
      }

      const scriptId = 'google-maps-atlas-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(keyToUse)}&v=weekly&libraries=places,marker`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          if (!isCancelled) initMap();
        };
        script.onerror = () => {
          showToast('Failed to load Google Maps script. Check API key and domain restrictions.');
        };
        document.head.appendChild(script);
      } else {
        const checkInterval = setInterval(() => {
          if ((window as any).google?.maps) {
            clearInterval(checkInterval);
            if (!isCancelled) initMap();
          }
        }, 100);
      }
    };

    const initMap = async () => {
      try {
        const google = (window as any).google;
        const maps = await google.maps.importLibrary('maps');
        try {
          markerLibRef.current = await google.maps.importLibrary('marker');
        } catch {
          markerLibRef.current = null;
        }
        placesLibRef.current = await google.maps.importLibrary('places');

        if (!mapContainerRef.current) return;

        const mapInstance = new maps.Map(mapContainerRef.current, {
          center: { lat: -29.5392, lng: 31.2144 }, // Greater Ballito default
          zoom: 12,
          mapId: 'GUESTWAVE_ATLAS_MAP',
          mapTypeControl: false,
          streetViewControl: true,
          fullscreenControl: true,
          gestureHandling: 'greedy',
        });

        mapRef.current = mapInstance;
        setIsMapReady(true);
        setActivityText('Google Maps & Places connected');
      } catch (err: any) {
        console.error('Error initializing map:', err);
        showToast(`Google Maps init error: ${err.message}`);
      }
    };

    loadMapsScript();

    return () => {
      isCancelled = true;
    };
  }, [apiKey, customKeyInput]);

  // Derived filtered venues
  const filteredVenues = useMemo(() => {
    const arr = Array.from(venues.values());
    const q = searchQuery.toLowerCase().trim();

    return arr.filter((v) => {
      const r = crm[v.id] || { contacted: false, notes: '', stage: 'not_contacted' };
      const haystack = [v.name, v.address, v.primaryType, ...(v.types || []), v.provinceLabel, v.searchArea].join(' ').toLowerCase();

      if (q && !haystack.includes(q)) return false;
      if (selectedProvince && v.provinceId !== selectedProvince) return false;
      if (selectedCategory && v.category !== selectedCategory) return false;
      if (selectedSearchArea && v.searchArea !== selectedSearchArea) return false;
      if (selectedContactStatus === 'yes' && !r.contacted) return false;
      if (selectedContactStatus === 'no' && r.contacted) return false;
      if (selectedContactStatus === 'notes' && !String(r.notes || '').trim()) return false;

      return true;
    });
  }, [venues, crm, searchQuery, selectedProvince, selectedCategory, selectedContactStatus, selectedSearchArea]);

  // Available search areas
  const searchAreas = useMemo(() => {
    const areas = new Set<string>();
    venues.forEach((v) => {
      if (v.searchArea) areas.add(v.searchArea);
    });
    prospects.forEach((p) => {
      if (p.sourceArea) areas.add(p.sourceArea);
    });
    return Array.from(areas).sort();
  }, [venues, prospects]);

  // Sync Markers with Map
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    const currentMarkers = markersRef.current;
    const activeIds = new Set(filteredVenues.map((v) => v.id));

    // Remove obsolete
    for (const [id, marker] of currentMarkers.entries()) {
      if (!activeIds.has(id)) {
        if ('map' in marker) marker.map = null;
        else marker.setMap(null);
        currentMarkers.delete(id);
      }
    }

    // Add / update new
    filteredVenues.forEach((v) => {
      if (currentMarkers.has(v.id)) return;
      if (v.lat == null || v.lng == null) return;

      const s = STYLE[v.category] || STYLE.other;
      const isContacted = crm[v.id]?.contacted;
      const glyph = isContacted ? '✓' : s.glyph;

      if (markerLibRef.current?.AdvancedMarkerElement && markerLibRef.current?.PinElement) {
        const pin = new markerLibRef.current.PinElement({
          background: s.color,
          borderColor: '#ffffff',
          glyphColor: '#ffffff',
          glyphText: glyph,
          scale: 1.05,
        });

        const advMarker = new markerLibRef.current.AdvancedMarkerElement({
          map: mapRef.current,
          position: { lat: v.lat, lng: v.lng },
          title: v.name,
          content: pin.element,
          gmpClickable: true,
        });

        advMarker.addEventListener('gmp-click', () => {
          setSelectedId(v.id);
        });

        currentMarkers.set(v.id, advMarker);
      } else {
        const google = (window as any).google;
        const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="48" viewBox="0 0 42 52"><path d="M21 1C10 1 1 10 1 21c0 15 20 30 20 30s20-15 20-30C41 10 32 1 21 1z" fill="${s.color}" stroke="white" stroke-width="2"/><circle cx="21" cy="20" r="10" fill="rgba(0,0,0,.2)"/><text x="21" y="25" text-anchor="middle" font-family="Arial" font-size="14" font-weight="700" fill="white">${glyph}</text></svg>`;
        const marker = new google.maps.Marker({
          map: mapRef.current,
          position: { lat: v.lat, lng: v.lng },
          title: v.name,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(iconSvg)}`,
            scaledSize: new google.maps.Size(34, 43),
            anchor: new google.maps.Point(17, 43),
          },
        });

        marker.addListener('click', () => {
          setSelectedId(v.id);
        });

        currentMarkers.set(v.id, marker);
      }
    });
  }, [filteredVenues, crm, isMapReady]);

  // Fit pins to viewport
  const fitPins = () => {
    if (!mapRef.current || filteredVenues.length === 0) return;
    const google = (window as any).google;
    const bounds = new google.maps.LatLngBounds();
    filteredVenues.forEach((v) => bounds.extend({ lat: v.lat, lng: v.lng }));
    mapRef.current.fitBounds(bounds, 50);
    const listener = google.maps.event.addListenerOnce(mapRef.current, 'idle', () => {
      if (mapRef.current.getZoom() > 16) mapRef.current.setZoom(16);
    });
  };

  // Category classifier helper
  const classifyCategory = (v: any, hint?: string): string => {
    const types = [v.primaryType, ...(v.types || [])].join(' ');
    const n = (v.displayName?.text || v.name || '').toLowerCase();
    if ((v.types || []).includes('guest_house') || (v.types || []).includes('bed_and_breakfast') || /guest house|b&b|bed and breakfast/.test(n)) return 'guest';
    if (/hotel|resort_hotel|motel|extended_stay_hotel/.test(types) || /\bhotel\b|\bresort\b/.test(n)) return 'hotel';
    if (/restaurant|cafe|bar|bakery/.test(types) || /restaurant|café|cafe|coffee|grill|bistro/.test(n)) return 'restaurant';
    if (hint === 'holiday' || /holiday|self.?catering|apartment|villa|vacation|beach house|chalet|cottage/.test(n)) return 'holiday';
    return hint || 'other';
  };

  // Run discovery scan
  const runScan = async (mode: 'quick' | 'deep') => {
    if (!placesLibRef.current || isScanning) return;

    setShowScanModal(false);
    setIsScanning(true);

    try {
      const custom = customTarget.trim();
      const presetObj = PRESETS.find((p) => p.id === presetTarget);
      const queryLabel = custom || presetObj?.query || 'Ballito and Dolphin Coast';
      const label = custom || presetObj?.label || 'South Africa';

      setActivityText(`Resolving viewport for ${label}...`);
      setActivityPct(10);

      // 1. Resolve Viewport Target
      const { places } = await placesLibRef.current.Place.searchByText({
        textQuery: `${queryLabel}, South Africa`,
        fields: ['id', 'displayName', 'location', 'viewport', 'formattedAddress', 'types'],
        maxResultCount: 5,
        language: 'en',
        region: 'za',
      });

      if (!places || places.length === 0) {
        throw new Error(`Google could not resolve location for "${label}".`);
      }

      const targetPlace = places[0];
      const vp = targetPlace.viewport;
      let rawBounds = typeof vp?.toJSON === 'function' ? vp.toJSON() : vp;
      if (!rawBounds) {
        throw new Error(`Google returned no viewport bounds for "${label}".`);
      }

      const bounds = {
        north: Number(rawBounds.north),
        south: Number(rawBounds.south),
        east: Number(rawBounds.east),
        west: Number(rawBounds.west),
      };

      // Province resolution
      const addr = (targetPlace.formattedAddress || '').toLowerCase();
      let provinceId = presetObj?.provinceId || 'KZN';
      for (const p of PROVINCES) {
        if (addr.includes(p.label.toLowerCase())) {
          provinceId = p.id;
          break;
        }
      }
      const provinceLabel = PROVINCES.find((p) => p.id === provinceId)?.label || 'South Africa';

      // 2. Generate Scan Tiles
      const gridSize = mode === 'deep' ? Math.max(2, presetObj?.deepGrid || 2) : 1;
      const tileBoundsList = [];
      const latStep = (bounds.north - bounds.south) / gridSize;
      const lngStep = (bounds.east - bounds.west) / gridSize;

      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          tileBoundsList.push({
            south: bounds.south + r * latStep,
            north: bounds.south + (r + 1) * latStep,
            west: bounds.west + c * lngStep,
            east: bounds.west + (c + 1) * lngStep,
          });
        }
      }

      // 3. Execute Searches
      const jobsToRun = [];
      for (let i = 0; i < tileBoundsList.length; i++) {
        for (const j of JOBS) {
          jobsToRun.push({
            ...j,
            bounds: tileBoundsList[i],
            tile: i + 1,
            tileCount: tileBoundsList.length,
          });
        }
      }

      let countNew = 0;
      const updatedVenues = new Map(venues);
      const updatedProspects = [...prospects];

      for (let i = 0; i < jobsToRun.length; i++) {
        const job = jobsToRun[i];
        const pct = Math.round(((i + 1) / jobsToRun.length) * 100);
        setActivityText(`${label} • ${job.q} (Tile ${job.tile}/${job.tileCount})`);
        setActivityPct(pct);

        try {
          const res = await placesLibRef.current.Place.searchByText({
            textQuery: `${job.q} in ${label}, South Africa`,
            fields: ['id', 'displayName', 'location', 'formattedAddress', 'primaryType', 'types', 'rating', 'userRatingCount', 'googleMapsURI', 'businessStatus'],
            locationRestriction: job.bounds,
            maxResultCount: 20,
            language: 'en',
            region: 'za',
          });

          if (res?.places) {
            for (const p of res.places) {
              const placeId = p.id || p.place_id;
              if (!placeId || !p.location) continue;

              const lat = typeof p.location.lat === 'function' ? p.location.lat() : p.location.lat;
              const lng = typeof p.location.lng === 'function' ? p.location.lng() : p.location.lng;
              const name = typeof p.displayName === 'string' ? p.displayName : p.displayName?.text || p.name || 'Venue';
              const cat = classifyCategory(p, job.c);

              const venueObj: VenueData = {
                id: placeId,
                name,
                lat,
                lng,
                address: p.formattedAddress || '',
                primaryType: p.primaryType || (p.types || [])[0] || '',
                types: p.types || [],
                rating: p.rating ?? null,
                userRatingCount: p.userRatingCount ?? null,
                googleMapsURI: p.googleMapsURI || `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`,
                businessStatus: p.businessStatus || '',
                phone: '',
                website: '',
                category: cat,
                provinceId,
                provinceLabel,
                searchArea: label,
              };

              if (!updatedVenues.has(placeId)) {
                countNew++;
              }
              updatedVenues.set(placeId, venueObj);

              if (!updatedProspects.find((item) => item.placeId === placeId)) {
                updatedProspects.push({
                  placeId,
                  category: cat,
                  provinceId,
                  provinceLabel,
                  sourceArea: label,
                  searchTargetId: presetObj?.id || 'custom',
                  createdAt: new Date().toISOString(),
                });
              }
            }
          }
        } catch (err: any) {
          console.warn('Tile search warning:', err);
        }

        await new Promise((r) => setTimeout(r, 120));
      }

      setVenues(updatedVenues);
      saveProspectsToStorage(updatedProspects);
      setActivityText(`${label} ${mode} scan complete`);
      setActivityPct(100);
      showToast(`Scan complete: ${countNew} new venues discovered in ${label} (${updatedVenues.size} total active).`);

      if (mapRef.current) {
        const google = (window as any).google;
        mapRef.current.fitBounds(new google.maps.LatLngBounds(
          { lat: bounds.south, lng: bounds.west },
          { lat: bounds.north, lng: bounds.east }
        ));
      }
    } catch (error: any) {
      console.error('Scan error:', error);
      showToast(`Scan failed: ${error.message}`);
      setActivityText('Scan interrupted');
      setActivityPct(null);
    } finally {
      setIsScanning(false);
    }
  };

  // Hydrate full details for a selected venue
  const loadDeepVenueDetails = async (id: string) => {
    const v = venues.get(id);
    if (!v || !placesLibRef.current) return;

    try {
      showToast('Loading direct phone & website from Google...');
      const p = new placesLibRef.current.Place({ id });
      await p.fetchFields({
        fields: ['nationalPhoneNumber', 'websiteURI', 'googleMapsURI'],
      });

      const updated = {
        ...v,
        phone: p.nationalPhoneNumber || v.phone,
        website: p.websiteURI || v.website,
        googleMapsURI: p.googleMapsURI || v.googleMapsURI,
      };

      setVenues((prev) => {
        const next = new Map(prev);
        next.set(id, updated);
        return next;
      });

      showToast('Contact information updated.');
    } catch (err: any) {
      showToast(`Could not fetch details: ${err.message}`);
    }
  };

  // Export CRM JSON
  const handleExportCRM = () => {
    const exportData = {
      version: '5.2.0',
      exportedAt: new Date().toISOString(),
      country: 'South Africa',
      prospects: Array.from(venues.values()).map((v) => ({
        ...v,
        crm: crm[v.id] || { contacted: false, notes: '', stage: 'not_contacted' },
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guestwave-hospitality-atlas-sa-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CRM prospects exported successfully.');
  };

  // Selected venue detail
  const selectedVenue = selectedId ? venues.get(selectedId) : null;
  const selectedCrm = selectedId ? crm[selectedId] || { contacted: false, notes: '', stage: 'not_contacted' } : null;

  return (
    <div className="flex flex-col gap-2.5 h-full w-full overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b pb-2 shrink-0" style={{ borderColor: 'var(--gw-dark-border)' }}>
        <div>
          <div className="flex items-center gap-2">
            <h1
              style={{
                fontSize: 'var(--gw-heading-size)',
                fontWeight: 'var(--gw-heading-weight)',
                color: 'var(--gw-dark-text-primary)',
              }}
            >
              Hospitality Atlas
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[var(--gw-teal-500)]/10 text-[var(--gw-teal-500)] border border-[var(--gw-teal-500)]/20 uppercase tracking-wider">
              South Africa V5.2.0
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--gw-dark-text-muted)' }}>
            National hospitality lead discovery, market intelligence & outreach engine.
          </p>
        </div>

        <div className="flex items-center gap-[var(--gw-space-2)]">
          <Button
            size="compact"
            onClick={() => setShowScanModal(true)}
            disabled={!isMapReady || isScanning}
          >
            {isScanning ? 'Scanning...' : '🔍 Discover Venues'}
          </Button>

          <Button
            variant="secondary"
            size="compact"
            onClick={fitPins}
            disabled={filteredVenues.length === 0}
          >
            Fit Map Pins
          </Button>

          <Button
            variant="ghost"
            size="compact"
            onClick={handleExportCRM}
            disabled={venues.size === 0}
          >
            Export CRM
          </Button>

          <Button
            variant="ghost"
            size="compact"
            onClick={() => setShowKeyModal(true)}
          >
            API Key
          </Button>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div
        className="px-3 py-2 rounded-[var(--gw-radius-md)] border flex flex-wrap items-center gap-2 text-xs shrink-0"
        style={{
          background: 'var(--gw-dark-surface-card)',
          borderColor: 'var(--gw-dark-border)',
        }}
      >
        <input
          type="search"
          placeholder="Search name, address or type..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-1.5 border rounded flex-1 min-w-[200px] focus:outline-none focus:border-[var(--gw-teal-500)]"
          style={{
            background: 'var(--gw-dark-surface-page)',
            borderColor: 'var(--gw-dark-border)',
            color: 'var(--gw-dark-text-primary)',
          }}
        />

        <select
          value={selectedProvince}
          onChange={(e) => setSelectedProvince(e.target.value)}
          className="px-3 py-1.5 border rounded focus:outline-none focus:border-[var(--gw-teal-500)]"
          style={{
            background: 'var(--gw-dark-surface-page)',
            borderColor: 'var(--gw-dark-border)',
            color: 'var(--gw-dark-text-primary)',
          }}
        >
          <option value="">All Provinces</option>
          {PROVINCES.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-1.5 border rounded focus:outline-none focus:border-[var(--gw-teal-500)]"
          style={{
            background: 'var(--gw-dark-surface-page)',
            borderColor: 'var(--gw-dark-border)',
            color: 'var(--gw-dark-text-primary)',
          }}
        >
          <option value="">All Venue Types</option>
          <option value="restaurant">Restaurants & Cafés</option>
          <option value="hotel">Hotels & Resorts</option>
          <option value="guest">Guest Houses & B&Bs</option>
          <option value="holiday">Holiday Rentals / Self-Catering</option>
          <option value="other">Other Accommodation</option>
        </select>

        <select
          value={selectedContactStatus}
          onChange={(e) => setSelectedContactStatus(e.target.value)}
          className="px-3 py-1.5 border rounded focus:outline-none focus:border-[var(--gw-teal-500)]"
          style={{
            background: 'var(--gw-dark-surface-page)',
            borderColor: 'var(--gw-dark-border)',
            color: 'var(--gw-dark-text-primary)',
          }}
        >
          <option value="">All Contact Statuses</option>
          <option value="no">Not Contacted</option>
          <option value="yes">Contacted</option>
          <option value="notes">Has CRM Notes</option>
        </select>

        {searchAreas.length > 0 && (
          <select
            value={selectedSearchArea}
            onChange={(e) => setSelectedSearchArea(e.target.value)}
            className="px-3 py-1.5 border rounded focus:outline-none focus:border-[var(--gw-teal-500)]"
            style={{
              background: 'var(--gw-dark-surface-page)',
              borderColor: 'var(--gw-dark-border)',
              color: 'var(--gw-dark-text-primary)',
            }}
          >
            <option value="">All Search Areas</option>
            {searchAreas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}

        {/* Live Counters */}
        <div className="flex items-center gap-2 ml-auto font-mono text-[11px]">
          <span className="px-2 py-1 rounded bg-[var(--gw-dark-surface-page)] border" style={{ borderColor: 'var(--gw-dark-border)', color: 'var(--gw-dark-text-primary)' }}>
            <b>{filteredVenues.length}</b> venues
          </span>
          <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <b>{filteredVenues.filter((v) => crm[v.id]?.contacted).length}</b> contacted
          </span>
        </div>
      </div>

      {/* Main Workspace (Map + Prospect Drawer) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_390px] gap-2.5 overflow-hidden">
        {/* Map Container */}
        <div
          className="relative rounded-[var(--gw-radius-lg)] border overflow-hidden flex flex-col h-full"
          style={{
            borderColor: 'var(--gw-dark-border)',
            background: 'var(--gw-dark-surface-card)',
          }}
        >
          <div ref={mapContainerRef} className="flex-1 w-full h-full min-h-[350px]" />

          {/* Activity Progress Strip */}
          <div
            className="px-4 py-2 border-t flex items-center justify-between text-xs font-mono"
            style={{
              background: 'var(--gw-dark-surface-page)',
              borderColor: 'var(--gw-dark-border)',
              color: 'var(--gw-dark-text-muted)',
            }}
          >
            <span>{activityText}</span>
            {activityPct !== null && (
              <div className="flex items-center gap-2">
                <span>{activityPct}%</span>
                <div className="w-24 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--gw-teal-500)] transition-all duration-300"
                    style={{ width: `${activityPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Map Controls Floating Badge */}
          <div className="absolute top-3 left-3 z-10 flex gap-2">
            <button
              onClick={() => {
                if (!mapRef.current) return;
                const nextSat = !isSatellite;
                setIsSatellite(nextSat);
                mapRef.current.setMapTypeId(nextSat ? 'hybrid' : 'roadmap');
              }}
              className="px-2.5 py-1 text-xs font-mono font-medium rounded shadow-md border bg-white/90 text-zinc-900 hover:bg-white transition-colors"
            >
              {isSatellite ? 'Road map' : 'Satellite'}
            </button>
          </div>

          {/* Category Legend */}
          <div className="absolute bottom-10 left-3 z-10 p-2 rounded shadow-md border bg-white/95 text-[11px] font-sans text-zinc-800 flex flex-wrap gap-3">
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: '#e75a50' }} />Restaurant</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: '#3478e5' }} />Hotel</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: '#2fab69' }} />Guest House</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: '#8d62db' }} />Holiday Rental</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: '#d69d32' }} />Other</span>
            <span className="font-bold text-emerald-600">✓ Contacted</span>
          </div>
        </div>

        {/* Prospect List & Detail Drawer */}
        <div
          className="rounded-[var(--gw-radius-lg)] border flex flex-col overflow-hidden"
          style={{
            background: 'var(--gw-dark-surface-card)',
            borderColor: 'var(--gw-dark-border)',
          }}
        >
          {selectedVenue ? (
            /* Detailed Venue View */
            <div className="flex-1 flex flex-col p-[var(--gw-space-5)] gap-[var(--gw-space-4)] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--gw-dark-border)' }}>
                <span
                  className="text-xs font-mono uppercase tracking-wider font-bold"
                  style={{ color: STYLE[selectedVenue.category]?.color || '#e75a50' }}
                >
                  {STYLE[selectedVenue.category]?.label || 'Venue'}
                </span>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-xs font-mono uppercase opacity-70 hover:opacity-100"
                  style={{ color: 'var(--gw-dark-text-muted)' }}
                >
                  ← Back to List
                </button>
              </div>

              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--gw-dark-text-primary)' }}>
                  {selectedVenue.name}
                </h2>
                <p className="text-xs mt-1" style={{ color: 'var(--gw-dark-text-muted)' }}>
                  {selectedVenue.address || 'Address not provided'}
                </p>
                {selectedVenue.rating && (
                  <div className="flex items-center gap-1 mt-1 text-xs font-mono">
                    <span className="text-amber-500">★ {selectedVenue.rating.toFixed(1)}</span>
                    {selectedVenue.userRatingCount && (
                      <span style={{ color: 'var(--gw-dark-text-meta)' }}>
                        ({selectedVenue.userRatingCount.toLocaleString()} reviews)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={selectedVenue.googleMapsURI}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded text-center text-xs font-semibold bg-[var(--gw-teal-500)] text-white hover:opacity-90 transition-opacity"
                >
                  Open in Google Maps
                </a>

                {selectedVenue.phone ? (
                  <a
                    href={`tel:${selectedVenue.phone.replace(/\s+/g, '')}`}
                    className="px-3 py-2 rounded text-center text-xs font-semibold border hover:bg-[var(--gw-dark-surface-page)] transition-colors"
                    style={{
                      borderColor: 'var(--gw-dark-border)',
                      color: 'var(--gw-dark-text-primary)',
                    }}
                  >
                    📞 {selectedVenue.phone}
                  </a>
                ) : (
                  <button
                    onClick={() => loadDeepVenueDetails(selectedVenue.id)}
                    className="px-3 py-2 rounded text-center text-xs font-semibold border hover:bg-[var(--gw-dark-surface-page)] transition-colors"
                    style={{
                      borderColor: 'var(--gw-dark-border)',
                      color: 'var(--gw-dark-text-primary)',
                    }}
                  >
                    Load Phone & Web
                  </button>
                )}
              </div>

              {selectedVenue.website && (
                <a
                  href={selectedVenue.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs truncate text-[var(--gw-teal-500)] hover:underline"
                >
                  🌐 {selectedVenue.website}
                </a>
              )}

              {/* CRM Outreach Section */}
              <div
                className="p-4 rounded border flex flex-col gap-3 mt-2"
                style={{
                  background: 'var(--gw-dark-surface-page)',
                  borderColor: 'var(--gw-dark-border)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--gw-dark-text-primary)' }}>
                    Outreach Status
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium" style={{ color: 'var(--gw-dark-text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedCrm?.contacted)}
                      onChange={(e) => {
                        saveCRMRecord(selectedVenue.id, { contacted: e.target.checked });
                      }}
                      className="w-4 h-4 accent-[var(--gw-teal-500)]"
                    />
                    Contacted
                  </label>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono uppercase" style={{ color: 'var(--gw-dark-text-meta)' }}>
                    CRM Notes (Autosaved)
                  </label>
                  <textarea
                    rows={4}
                    value={selectedCrm?.notes || ''}
                    onChange={(e) => {
                      saveCRMRecord(selectedVenue.id, { notes: e.target.value });
                    }}
                    placeholder="Contact person, conversation log, table talker requirement, follow-up date..."
                    className="w-full p-2.5 border rounded text-xs focus:outline-none focus:border-[var(--gw-teal-500)]"
                    style={{
                      background: 'var(--gw-dark-surface-card)',
                      borderColor: 'var(--gw-dark-border)',
                      color: 'var(--gw-dark-text-primary)',
                    }}
                  />
                </div>
              </div>

              {/* Google Place ID */}
              <div className="mt-auto pt-2 border-t text-[11px] font-mono" style={{ borderColor: 'var(--gw-dark-border)', color: 'var(--gw-dark-text-meta)' }}>
                <span>Place ID: {selectedVenue.id}</span>
              </div>
            </div>
          ) : (
            /* Prospect Cards List */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div
                className="px-4 py-3 border-b flex items-center justify-between font-mono text-xs"
                style={{
                  borderColor: 'var(--gw-dark-border)',
                  color: 'var(--gw-dark-text-muted)',
                }}
              >
                <span><b>{filteredVenues.length}</b> Prospect Cards</span>
                <span>{venues.size} Loaded</span>
              </div>

              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
                {filteredVenues.length === 0 ? (
                  <div className="p-8 text-center text-xs" style={{ color: 'var(--gw-dark-text-meta)' }}>
                    {venues.size === 0 ? (
                      <>
                        <p className="font-semibold text-sm mb-1" style={{ color: 'var(--gw-dark-text-primary)' }}>
                          No venues discovered yet
                        </p>
                        <p>Click &quot;Discover Venues&quot; above to scan South African markets.</p>
                      </>
                    ) : (
                      'No venues match the selected filters.'
                    )}
                  </div>
                ) : (
                  filteredVenues.map((v) => {
                    const r = crm[v.id] || { contacted: false, notes: '', stage: 'not_contacted' };
                    const s = STYLE[v.category] || STYLE.other;

                    return (
                      <div
                        key={v.id}
                        onClick={() => {
                          setSelectedId(v.id);
                          if (mapRef.current && v.lat && v.lng) {
                            mapRef.current.panTo({ lat: v.lat, lng: v.lng });
                          }
                        }}
                        className="p-3 rounded border text-left cursor-pointer hover:border-[var(--gw-teal-500)] transition-all flex flex-col gap-1.5"
                        style={{
                          background: 'var(--gw-dark-surface-page)',
                          borderColor: 'var(--gw-dark-border)',
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-xs leading-snug" style={{ color: 'var(--gw-dark-text-primary)' }}>
                            {v.name}
                          </span>
                          <span
                            className="text-[10px] font-mono uppercase font-bold shrink-0"
                            style={{ color: s.color }}
                          >
                            {s.label}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--gw-dark-text-muted)' }}>
                          <span className="truncate max-w-[200px]">{v.searchArea || v.provinceLabel}</span>
                          {v.rating && <span className="font-mono text-amber-500">★ {v.rating.toFixed(1)}</span>}
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t text-[11px]" style={{ borderColor: 'var(--gw-dark-border)' }}>
                          <label
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 cursor-pointer"
                            style={{ color: 'var(--gw-dark-text-primary)' }}
                          >
                            <input
                              type="checkbox"
                              checked={r.contacted}
                              onChange={(e) => {
                                saveCRMRecord(v.id, { contacted: e.target.checked });
                              }}
                              className="accent-[var(--gw-teal-500)]"
                            />
                            <span>{r.contacted ? 'Contacted' : 'Not Contacted'}</span>
                          </label>

                          {r.notes && (
                            <span className="text-[10px] font-mono text-[var(--gw-teal-500)]">
                              📝 Notes
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Discovery Modal */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-lg p-6 rounded-[var(--gw-radius-lg)] border shadow-xl flex flex-col gap-4"
            style={{
              background: 'var(--gw-dark-surface-card)',
              borderColor: 'var(--gw-dark-border)',
              color: 'var(--gw-dark-text-primary)',
            }}
          >
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--gw-dark-text-primary)' }}>
                Discover South African Venues
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--gw-dark-text-muted)' }}>
                Select a preset market or search any South African town, city, or tourism node.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono uppercase" style={{ color: 'var(--gw-dark-text-muted)' }}>
                  Preset Market
                </label>
                <select
                  value={presetTarget}
                  onChange={(e) => {
                    setPresetTarget(e.target.value);
                    setCustomTarget('');
                  }}
                  className="w-full p-2.5 border rounded text-xs focus:outline-none focus:border-[var(--gw-teal-500)]"
                  style={{
                    background: 'var(--gw-dark-surface-page)',
                    borderColor: 'var(--gw-dark-border)',
                    color: 'var(--gw-dark-text-primary)',
                  }}
                >
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} ({PROVINCES.find((prov) => prov.id === p.provinceId)?.label})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono uppercase" style={{ color: 'var(--gw-dark-text-muted)' }}>
                  Or Custom South African Area
                </label>
                <input
                  type="text"
                  placeholder="e.g. Knysna, Soweto, Clarens, Plettenberg Bay"
                  value={customTarget}
                  onChange={(e) => setCustomTarget(e.target.value)}
                  className="w-full p-2.5 border rounded text-xs focus:outline-none focus:border-[var(--gw-teal-500)]"
                  style={{
                    background: 'var(--gw-dark-surface-page)',
                    borderColor: 'var(--gw-dark-border)',
                    color: 'var(--gw-dark-text-primary)',
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div
                className="p-3 border rounded flex flex-col justify-between gap-2"
                style={{
                  background: 'var(--gw-dark-surface-page)',
                  borderColor: 'var(--gw-dark-border)',
                }}
              >
                <div>
                  <h3 className="font-bold text-xs">Quick Scan</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--gw-dark-text-muted)' }}>
                    8 targeted category queries across the resolved viewport.
                  </p>
                </div>
                <Button size="compact" onClick={() => runScan('quick')}>
                  Run Quick Scan
                </Button>
              </div>

              <div
                className="p-3 border rounded flex flex-col justify-between gap-2"
                style={{
                  background: 'var(--gw-dark-surface-page)',
                  borderColor: 'var(--gw-dark-border)',
                }}
              >
                <div>
                  <h3 className="font-bold text-xs">Deep Scan</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--gw-dark-text-muted)' }}>
                    Subdivides into geographic tiles for thorough market coverage.
                  </p>
                </div>
                <Button variant="secondary" size="compact" onClick={() => runScan('deep')}>
                  Run Deep Scan
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--gw-dark-border)' }}>
              <Button variant="ghost" size="compact" onClick={() => setShowScanModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-md p-6 rounded-[var(--gw-radius-lg)] border shadow-xl flex flex-col gap-4"
            style={{
              background: 'var(--gw-dark-surface-card)',
              borderColor: 'var(--gw-dark-border)',
              color: 'var(--gw-dark-text-primary)',
            }}
          >
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--gw-dark-text-primary)' }}>
                Google Maps API Key
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--gw-dark-text-muted)' }}>
                Using the pre-configured project key by default. You can override it with a development key below if needed.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono uppercase" style={{ color: 'var(--gw-dark-text-muted)' }}>
                API Key
              </label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={customKeyInput || apiKey}
                onChange={(e) => setCustomKeyInput(e.target.value)}
                className="w-full p-2.5 border rounded text-xs font-mono focus:outline-none focus:border-[var(--gw-teal-500)]"
                style={{
                  background: 'var(--gw-dark-surface-page)',
                  borderColor: 'var(--gw-dark-border)',
                  color: 'var(--gw-dark-text-primary)',
                }}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--gw-dark-border)' }}>
              <Button variant="ghost" size="compact" onClick={() => setShowKeyModal(false)}>
                Close
              </Button>
              <Button
                size="compact"
                onClick={() => {
                  setShowKeyModal(false);
                  showToast('API key updated. Reloading map...');
                  window.location.reload();
                }}
              >
                Apply Key
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded shadow-lg border text-xs font-medium bg-zinc-900 text-white border-zinc-700 animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
