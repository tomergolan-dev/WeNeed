import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const listType = pgEnum("list_type", ["shopping", "tasks"]);
export const listStatus = pgEnum("list_status", ["active", "completed"]);

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // E.164, e.g. +972501234567
    phone: text("phone").notNull().unique(),
    // A question the bot asked and is waiting for an answer to (Stage 4).
    pendingAction: jsonb("pending_action"),
    createdAt: createdAt(),
  },
  (t) => [index("members_household_idx").on(t.householdId)],
);

export const lists = pgTable(
  "lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    type: listType("type").notNull(),
    status: listStatus("status").notNull().default("active"),
    createdAt: createdAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => members.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    // Core rule: at most one active list of each type per household.
    uniqueIndex("lists_one_active_per_type")
      .on(t.householdId, t.type)
      .where(sql`${t.status} = 'active'`),
    index("lists_household_idx").on(t.householdId, t.type, t.createdAt),
  ],
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: numeric("quantity", { mode: "number" }),
    unit: text("unit"),
    // Store section key, see src/lib/categories.ts
    category: text("category").notNull().default("other"),
    assigneeId: uuid("assignee_id").references(() => members.id, {
      onDelete: "set null",
    }),
    done: boolean("done").notNull().default(false),
    doneBy: uuid("done_by").references(() => members.id, {
      onDelete: "set null",
    }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    addedBy: uuid("added_by").references(() => members.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [index("items_list_idx").on(t.listId)],
);

export const processedMessages = pgTable("processed_messages", {
  waMessageId: text("wa_message_id").primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const loginTokens = pgTable("login_tokens", {
  // SHA-256 of the token; the raw token only ever exists in the link.
  tokenHash: text("token_hash").primaryKey(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export type Household = typeof households.$inferSelect;
export type Member = typeof members.$inferSelect;
export type List = typeof lists.$inferSelect;
export type Item = typeof items.$inferSelect;
