import type { AttributeType, StageKind, WorkspaceSettings } from "@/db/schema";

// Starting vocabularies for a new workspace. After creation everything is editable in
// Settings — templates are only a head start, never referenced again.

export type WorkspaceTemplate = {
  id: string;
  label: string;
  stages: { label: string; kind: StageKind; color: string }[];
  outcomeReasons: string[];
  activityTypes: { label: string; icon: string }[];
  attributes: { key: string; label: string; type: AttributeType; options?: string[] }[];
  settings: WorkspaceSettings;
};

const COMMON_ACTIVITY_TYPES = [
  { label: "Call", icon: "call" },
  { label: "Visit", icon: "visit" },
  { label: "Email", icon: "email" },
  { label: "Meeting", icon: "meeting" },
  { label: "Note", icon: "note" },
];

const SA_PRESETS = [
  { id: "ballito", label: "Greater Ballito", query: "Ballito, KwaZulu-Natal" },
  { id: "umhlanga", label: "Umhlanga", query: "Umhlanga, KwaZulu-Natal" },
  { id: "durban", label: "Durban", query: "Durban, KwaZulu-Natal" },
  { id: "cape-town", label: "Cape Town CBD", query: "Cape Town City Centre, Western Cape" },
  { id: "stellenbosch", label: "Stellenbosch", query: "Stellenbosch, Western Cape" },
  { id: "sandton", label: "Sandton", query: "Sandton, Gauteng" },
  { id: "rosebank", label: "Rosebank", query: "Rosebank, Johannesburg, Gauteng" },
  { id: "pretoria-east", label: "Pretoria East", query: "Menlyn, Pretoria, Gauteng" },
];

export const TEMPLATES: WorkspaceTemplate[] = [
  {
    id: "hospitality",
    label: "Hospitality (restaurants & accommodation)",
    stages: [
      { label: "New", kind: "open", color: "#64748b" },
      { label: "Contacted", kind: "open", color: "#0ea5e9" },
      { label: "Qualified", kind: "open", color: "#6366f1" },
      { label: "Demo / visit", kind: "open", color: "#a855f7" },
      { label: "Proposal", kind: "open", color: "#f59e0b" },
      { label: "Won", kind: "won", color: "#16a34a" },
      { label: "Lost", kind: "lost", color: "#dc2626" },
      { label: "Not a fit", kind: "lost", color: "#94a3b8" },
    ],
    outcomeReasons: [
      "Price",
      "Has a competitor",
      "No budget right now",
      "Not the decision maker",
      "No need / happy as is",
      "No response",
      "Closed down",
      "Wrong segment",
    ],
    activityTypes: COMMON_ACTIVITY_TYPES,
    attributes: [
      {
        key: "segment",
        label: "Segment",
        type: "select",
        options: ["Restaurant / café", "Hotel / resort", "Guest house / B&B", "Holiday rental", "Other accommodation"],
      },
      {
        key: "pos_system",
        label: "POS system",
        type: "select",
        options: ["None", "Pilot", "Micros", "Lightspeed", "GAAP", "Square", "Other"],
      },
      { key: "tables_rooms", label: "Tables / rooms", type: "number" },
      { key: "has_guest_wifi", label: "Has guest WiFi", type: "bool" },
      { key: "group_brand", label: "Part of a group", type: "bool" },
    ],
    settings: {
      country: "ZA",
      discovery: {
        searchTerms: [
          "restaurants",
          "cafes",
          "hotels",
          "resorts",
          "guest houses",
          "bed and breakfast",
          "self catering accommodation",
          "holiday apartments",
        ],
        presets: SA_PRESETS,
      },
    },
  },
  {
    id: "security-saas",
    label: "Security SaaS (estates, offices, retail)",
    stages: [
      { label: "Lead", kind: "open", color: "#64748b" },
      { label: "Discovery call", kind: "open", color: "#0ea5e9" },
      { label: "Site assessment", kind: "open", color: "#6366f1" },
      { label: "Trial", kind: "open", color: "#a855f7" },
      { label: "Negotiation", kind: "open", color: "#f59e0b" },
      { label: "Closed won", kind: "won", color: "#16a34a" },
      { label: "Closed lost", kind: "lost", color: "#dc2626" },
    ],
    outcomeReasons: ["Price", "Incumbent contract", "Security budget cut", "Feature gap", "No response", "Chose competitor"],
    activityTypes: COMMON_ACTIVITY_TYPES,
    attributes: [
      {
        key: "site_type",
        label: "Site type",
        type: "select",
        options: ["Residential estate", "Office park", "Retail centre", "Industrial", "School"],
      },
      { key: "units", label: "Units / tenants", type: "number" },
      { key: "current_provider", label: "Current security provider", type: "text" },
      { key: "contract_renewal", label: "Contract renewal date", type: "date" },
    ],
    settings: {
      country: "ZA",
      discovery: {
        searchTerms: ["residential estates", "office parks", "shopping centres", "business parks"],
        presets: SA_PRESETS,
      },
    },
  },
];

export function getTemplate(id: string) {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}
