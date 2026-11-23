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

// "owner" is shown as "מנהל/ת" (admin); a place can have several.
export const placeRole = pgEnum("place_role", ["owner", "member"]);
// Who sees a list in a shared place: every member, or only the members added to it.
export const listVisibility = pgEnum("list_visibility", ["place", "selected"]);
export const inviteStatus = pgEnum("invite_status", ["pending", "accepted", "declined", "canceled"]);
export const attachmentKind = pgEnum("attachment_kind", ["link", "file"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Lowercase. Set on first sign-in; users carried over from the bot era get it from npm run user:link-email.
  email: text("email").unique(),
  // E.164, e.g. +972501234567. Only the paused WhatsApp bot uses it.
  phone: text("phone").unique(),
  // Paused WhatsApp bot: a question it asked and is waiting for an answer to.
  pendingAction: jsonb("pending_action"),
  // The language of the app when the user last opened it; task emails are sent in it.
  locale: text("locale").notNull().default("he"),
  // Emails about tasks assigned to the user (assignments and reminders). Turned off from the account menu.
  taskEmails: boolean("task_emails").notNull().default(true),
  // The secret in the user's calendar feed link (/api/calendar/<token>.ics). Made on first use; a new one cuts off the old link.
  calendarToken: text("calendar_token").unique(),
  createdAt: createdAt(),
});

export const places = pgTable("places", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Icon key, see src/lib/place-icons.ts
  icon: text("icon").notNull().default("home"),
  // Set for a user's personal area ("שלי"): one per user, with them as its only
  // member. Its lists are private unless shared with people (list_members).
  personalOwnerId: uuid("personal_owner_id")
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
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
    // False for someone invited to some lists only: they see just the lists
    // they were added to (list_members), not the lists open to the whole place.
    allLists: boolean("all_lists").notNull().default(true),
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
    visibility: listVisibility("visibility").notNull().default("place"),
    createdAt: createdAt(),
  },
  (t) => [index("lists_place_idx").on(t.placeId, t.type, t.createdAt)],
);

// People added to a list: in a shared place, members who see a "selected" list
// or who were invited to some lists only; in a personal area, the people it is
// shared with. Admins of a place always see all of its lists.
export const listMembers = pgTable(
  "list_members",
  {
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.listId, t.userId] }), index("list_members_user_idx").on(t.userId)],
);

// What a user calls someone else ("אמא" for נורית), like a contact name in a
// phone: shown only to that user, everywhere in the app, instead of the name
// the other person chose.
export const contactNames = pgTable(
  "contact_names",
  {
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.userId] })],
);

// An invitation by email, to a whole place (listIds null) or to some of its lists.
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    // Lowercase.
    email: text("email").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    listIds: uuid("list_ids").array(),
    status: inviteStatus("status").notNull().default("pending"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("invites_email_idx").on(t.email, t.status), index("invites_place_idx").on(t.placeId, t.status)],
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
    // Order within the round; members can reorder a checklist. New items go last.
    position: integer("position").notNull().default(0),
    // A free-text note, shown in the item's details.
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("items_round_idx").on(t.roundId)],
);

// Links, photos and files on an item. Files live in a private Vercel Blob
// store under items/<itemId>/ and are served only to people who see the list.
export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    kind: attachmentKind("kind").notNull(),
    // A link's address; null for files.
    url: text("url"),
    // A file's Blob pathname; null for links.
    pathname: text("pathname"),
    // The link's title or the file's original name.
    name: text("name").notNull(),
    contentType: text("content_type"),
    size: integer("size"),
    addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("attachments_item_idx").on(t.itemId, t.createdAt)],
);

// One row per message to a list's AI chat, for the daily limits.
export const aiRequests = pgTable(
  "ai_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index("ai_requests_user_idx").on(t.userId, t.createdAt), index("ai_requests_created_idx").on(t.createdAt)],
);

// AI chat messages sent from the public demo, for its daily limits. Holds no
// message text, only a keyed hash of the visitor's IP address.
export const demoAiRequests = pgTable(
  "demo_ai_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    visitor: text("visitor").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("demo_ai_requests_visitor_idx").on(t.visitor, t.createdAt),
    index("demo_ai_requests_created_idx").on(t.createdAt),
  ],
);

// Why a task email was sent: assigned to someone, a reminder someone sent by
// hand, or an automatic reminder (an hour before a timed task; the morning and
// the evening of a task with a date only).
export const taskEmailKind = pgEnum("task_email_kind", [
  "assigned",
  "manual",
  "hour_before",
  "morning",
  "evening",
  "quarter_before",
  "overdue",
]);

// One row per task email, written before it is sent. Automatic reminders are
// sent once per due time (due_key), so moving a task's date sends them again.
export const taskEmails = pgTable(
  "task_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: taskEmailKind("kind").notNull(),
    // "YYYY-MM-DD HH:MM" or "YYYY-MM-DD" for automatic reminders; empty otherwise.
    dueKey: text("due_key").notNull().default(""),
    sentBy: uuid("sent_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("task_emails_once_idx")
      .on(t.itemId, t.userId, t.kind, t.dueKey)
      .where(sql`${t.kind} not in ('assigned', 'manual')`),
    index("task_emails_item_idx").on(t.itemId, t.createdAt),
    index("task_emails_created_idx").on(t.createdAt),
  ],
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
export type Invite = typeof invites.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
