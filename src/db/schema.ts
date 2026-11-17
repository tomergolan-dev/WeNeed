import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// "tasks" is a chores list.
export const listType = pgEnum("list_type", ["shopping", "tasks", "checklist"]);
export const listStatus = pgEnum("list_status", ["active", "completed"]);

export const placeRole = pgEnum("place_role", ["owner", "member"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Lowercase. Set on first sign-in; users carried over from the bot era get it from npm run user:link-email.
  email: text("email").unique(),
  // E.164, e.g. +972501234567. Only the paused WhatsApp bot uses it.
  phone: text("phone").unique(),
  // Paused WhatsApp bot: a question it asked and is waiting for an answer to.
  pendingAction: jsonb("pending_action"),
  createdAt: createdAt(),
});

export const places = pgTable("places", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Icon key, see src/lib/place-icons.ts
  icon: text("icon").notNull().default("home"),
  createdAt: createdAt(),
});

export const placeMembers = pgTable(
  "place_members",
  {
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: placeRole("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.placeId, t.userId] }), index("place_members_user_idx").on(t.userId)],
);

export const signInCodes = pgTable(
  "sign_in_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    // HMAC of the code; the code itself is only ever sent by email.
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("sign_in_codes_email_idx").on(t.email, t.createdAt)],
);

export const lists = pgTable(
  "lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    type: listType("type").notNull(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("lists_place_idx").on(t.placeId, t.type, t.createdAt)],
);

// A shopping list is used in rounds: finishing a round locks it into the
// list's history and opens a new one. Chores lists keep one ongoing round.
export const rounds = pgTable(
  "rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    status: listStatus("status").notNull().default("active"),
    createdAt: createdAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    // Core rule: at most one active round per list.
    uniqueIndex("rounds_one_active_per_list")
      .on(t.listId)
      .where(sql`${t.status} = 'active'`),
    index("rounds_list_idx").on(t.listId, t.createdAt),
  ],
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: numeric("quantity", { mode: "number" }),
    unit: text("unit"),
    // Store section key, see src/lib/categories.ts
    category: text("category").notNull().default("other"),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    done: boolean("done").notNull().default(false),
    doneBy: uuid("done_by").references(() => users.id, {
      onDelete: "set null",
    }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    // Chores only: an optional due date and time, in Israel time. A date with
    // no time is due at the end of that day.
    dueDate: date("due_date", { mode: "string" }),
    dueTime: time("due_time"),
    addedBy: uuid("added_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [index("items_round_idx").on(t.roundId)],
);

// Paused WhatsApp bot: Meta may deliver a message more than once.
export const processedMessages = pgTable("processed_messages", {
  waMessageId: text("wa_message_id").primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Place = typeof places.$inferSelect;
export type List = typeof lists.$inferSelect;
export type Round = typeof rounds.$inferSelect;
export type Item = typeof items.$inferSelect;
