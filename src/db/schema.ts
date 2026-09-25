import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

// Every tenant-owned table carries `workspace_id`; every repo function takes `workspaceId`
// first (see src/lib/repo). Business-level data only — no named contact people (docs/DECISIONS.md).

const id = () => uuid("id").primaryKey().$defaultFn(() => uuidv7());
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
const workspaceRef = () =>
  uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

// ── Tenancy & users ──────────────────────────────────────────────────────────

export type WorkspaceSettings = {
  country?: string; // ISO-3166 alpha-2, biases discovery searches
  discovery?: {
    searchTerms: string[]; // e.g. "restaurants", "guest houses"
    presets: { id: string; label: string; query: string }[];
  };
};

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  settings: jsonb("settings").$type<WorkspaceSettings>().notNull().default({}),
  ...timestamps,
});

// Staff identity from Google SSO — the only personal data the CRM holds.
export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name"),
  isSuperadmin: boolean("is_superadmin").notNull().default(false),
  ...timestamps,
});

export const roleEnum = pgEnum("role", ["admin", "manager", "rep"]);

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    workspaceId: workspaceRef(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("rep"),
    ...timestamps,
  },
  (t) => [uniqueIndex("memberships_ws_user").on(t.workspaceId, t.userId)],
);

// Invite-only: a Google sign-in is accepted only for an email with a pending invite
// (or an existing membership / superadmin).
export const invites = pgTable(
  "invites",
  {
    id: id(),
    workspaceId: workspaceRef(),
    email: text("email").notNull(),
    role: roleEnum("role").notNull().default("rep"),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("invites_ws_email").on(t.workspaceId, t.email)],
);

// ── Configurable vocabulary (per workspace) ──────────────────────────────────

export const stageKindEnum = pgEnum("stage_kind", ["open", "won", "lost"]);

export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: id(),
    workspaceId: workspaceRef(),
    label: text("label").notNull(),
    kind: stageKindEnum("kind").notNull().default("open"),
    position: integer("position").notNull(),
    color: text("color").notNull().default("#64748b"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("stages_ws_pos").on(t.workspaceId, t.position)],
);

export const outcomeReasons = pgTable("outcome_reasons", {
  id: id(),
  workspaceId: workspaceRef(),
  label: text("label").notNull(),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const activityTypes = pgTable("activity_types", {
  id: id(),
  workspaceId: workspaceRef(),
  label: text("label").notNull(),
  icon: text("icon").notNull().default("note"),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const attributeTypeEnum = pgEnum("attribute_type", [
  "text",
  "number",
  "bool",
  "date",
  "select",
  "multiselect",
]);

// Options carry stable ids so relabelling an option never orphans stored values.
export type AttributeOption = { id: string; label: string; active: boolean };

export const attributeDefinitions = pgTable(
  "attribute_definitions",
  {
    id: id(),
    workspaceId: workspaceRef(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    type: attributeTypeEnum("type").notNull(),
    options: jsonb("options").$type<AttributeOption[]>().notNull().default([]),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("attr_defs_ws_key").on(t.workspaceId, t.key)],
);

// ── Core CRM ─────────────────────────────────────────────────────────────────

export const companySourceEnum = pgEnum("company_source", ["discovery", "manual", "import"]);

export type AttributeValues = Record<string, string | number | boolean | string[] | null>;

export const companies = pgTable(
  "companies",
  {
    id: id(),
    workspaceId: workspaceRef(),
    name: text("name").notNull(),
    locality: text("locality"),
    region: text("region"),
    address: text("address"),
    phone: text("phone"), // business line only
    website: text("website"),
    email: text("email"), // generic inbox only (info@, bookings@)
    contactRoles: text("contact_roles").array().notNull().default(sql`'{}'::text[]`),
    source: companySourceEnum("source").notNull().default("manual"),
    // Google place_id — the only Places content we may persist (Places ToS).
    externalRef: text("external_ref"),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => pipelineStages.id),
    outcomeReasonId: uuid("outcome_reason_id").references(() => outcomeReasons.id, { onDelete: "set null" }),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    attributes: jsonb("attributes").$type<AttributeValues>().notNull().default({}),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("companies_ws_external_ref").on(t.workspaceId, t.externalRef),
    index("companies_ws_stage").on(t.workspaceId, t.stageId),
    index("companies_ws_owner").on(t.workspaceId, t.ownerUserId),
    index("companies_attributes_gin").using("gin", t.attributes),
  ],
);

export const activityKindEnum = pgEnum("activity_kind", ["log", "system"]);

// One timeline per company: logged sales activity plus system entries (stage/owner/attribute
// changes), so the timeline doubles as the audit trail.
export const activities = pgTable(
  "activities",
  {
    id: id(),
    workspaceId: workspaceRef(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    kind: activityKindEnum("kind").notNull().default("log"),
    typeId: uuid("type_id").references(() => activityTypes.id, { onDelete: "set null" }),
    body: text("body").notNull().default(""),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index("activities_company_time").on(t.companyId, t.occurredAt)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    workspaceId: workspaceRef(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    doneAt: timestamp("done_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("tasks_ws_assignee_due").on(t.workspaceId, t.assigneeId, t.dueAt)],
);

export type ViewFilter = {
  q?: string;
  stageIds?: string[];
  owner?: "me" | "none" | string;
  region?: string;
  followUp?: "overdue" | "today" | "week" | "none";
  attr?: Record<string, string>; // attribute key → option id / value
};

export const savedViews = pgTable("saved_views", {
  id: id(),
  workspaceId: workspaceRef(),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "cascade" }), // null = shared
  name: text("name").notNull(),
  filter: jsonb("filter").$type<ViewFilter>().notNull().default({}),
  ...timestamps,
});

// ── Relations ────────────────────────────────────────────────────────────────

export const companiesRelations = relations(companies, ({ one, many }) => ({
  stage: one(pipelineStages, { fields: [companies.stageId], references: [pipelineStages.id] }),
  owner: one(users, { fields: [companies.ownerUserId], references: [users.id] }),
  outcomeReason: one(outcomeReasons, { fields: [companies.outcomeReasonId], references: [outcomeReasons.id] }),
  activities: many(activities),
  tasks: many(tasks),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  company: one(companies, { fields: [activities.companyId], references: [companies.id] }),
  user: one(users, { fields: [activities.userId], references: [users.id] }),
  type: one(activityTypes, { fields: [activities.typeId], references: [activityTypes.id] }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  company: one(companies, { fields: [tasks.companyId], references: [companies.id] }),
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id] }),
}));

export type Role = (typeof roleEnum.enumValues)[number];
export type StageKind = (typeof stageKindEnum.enumValues)[number];
export type AttributeType = (typeof attributeTypeEnum.enumValues)[number];
export type Company = typeof companies.$inferSelect;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type AttributeDefinition = typeof attributeDefinitions.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
