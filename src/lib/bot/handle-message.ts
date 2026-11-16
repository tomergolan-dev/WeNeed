import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { db } from "@/db";
import { items, lists, members, processedMessages, type Item, type List } from "@/db/schema";
import { locale } from "@/i18n/request";
import { isCategory } from "@/lib/categories";
import { formatQuantity, groupByCategory } from "@/lib/items";
import {
  ensureActiveList,
  getActiveList,
  getChores,
  getHousehold,
  getLastCompletedList,
  getListItems,
} from "@/lib/lists";
import { createLoginToken, loginUrl } from "@/lib/login-tokens";
import { sendText, type IncomingMessage } from "@/lib/whatsapp";
import messages from "../../../messages/he.json";
import { normalizeName } from "./normalize";
import { parseAnswer } from "./parse-answer";
import { parseMessage } from "./parse-message";
import { clearPending, readPending, setPending, type NewItem, type PendingAction } from "./pending";

const t = createTranslator({ locale, messages, namespace: "Bot" });
const tCategories = createTranslator({ locale, messages, namespace: "Categories" });
const units = createTranslator({ locale, messages, namespace: "ItemForm" })("units");

type Member = { id: string; name: string; householdId: string; pendingAction: unknown };
type RequestedItem = NewItem & { existing?: string | null };

const numberFormat = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 2 });

function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function handleMessage(message: IncomingMessage): Promise<void> {
  // Meta may deliver the same message more than once.
  const [fresh] = await db
    .insert(processedMessages)
    .values({ waMessageId: message.id })
    .onConflictDoNothing()
    .returning();
  if (!fresh) return;

  const [member] = await db
    .select({
      id: members.id,
      name: members.name,
      householdId: members.householdId,
      pendingAction: members.pendingAction,
    })
    .from(members)
    .where(eq(members.phone, message.from));

  if (!member) {
    await sendText(message.from, t("unknownSender"));
    return;
  }
  if (message.text === null) {
    await sendText(message.from, t("textOnly"));
    return;
  }

  await sendText(message.from, await reply(member, message.text));
}

async function reply(member: Member, text: string): Promise<string> {
  const pending = readPending(member.pendingAction);
  if (pending) {
    const answer = await answerPending(member, pending, text);
    if (answer !== null) return answer;
    // Not an answer to the question: drop it and treat the message as new.
  } else if (member.pendingAction) {
    await clearPending(member.id); // expired or malformed
  }

  const list = await getActiveList(member.householdId, "shopping");
  const open = list ? (await getListItems(list.id)).filter((item) => !item.done) : [];

  const household = await getHousehold(member.householdId);
  const people = household?.members ?? [];

  const parsed = await parseMessage(
    text,
    open.map((item) => item.name),
    { sender: member.name, members: people.map((p) => p.name) },
  );
  if (!parsed) return t("notUnderstood");

  switch (parsed.intent) {
    case "add_items": {
      if (parsed.items.length === 0 && parsed.chores.length === 0) return t("notUnderstood");
      const choresReply = parsed.chores.length > 0 ? await addChores(member, parsed.chores, people) : "";
      const shoppingReply = parsed.items.length > 0 ? await addShopping(member, list, parsed.items, open) : "";
      return [choresReply, shoppingReply].filter(Boolean).join("\n\n");
    }
    case "show_list":
      return formatList(open);
    case "show_chores":
      return formatChores(member, await getChores(member.householdId), people);
    case "login_link": {
      const token = await createLoginToken(member.id);
      return t("loginLink", { url: loginUrl(token) });
    }
    case "other":
      return t("help", { name: member.name });
  }
}

type Person = { id: string; name: string };

async function addChores(
  member: Member,
  chores: { title: string; assignee: string | null }[],
  people: Person[],
): Promise<string> {
  const list = await ensureActiveList(member.householdId, "tasks");
  const rows = chores
    .filter((chore) => chore.title.trim())
    .map((chore) => ({
      listId: list.id,
      name: chore.title.trim(),
      assigneeId: people.find((p) => p.name === chore.assignee)?.id ?? null,
      addedBy: member.id,
    }));
  if (rows.length === 0) return "";
  await db.insert(items).values(rows);
  const names = rows.map((row) => describeChore(row.name, row.assigneeId, people)).join(", ");
  return t("choresAdded", { chores: names, url: `${appUrl()}/chores` });
}

/** Adds shopping items, asking first whether to open a new list when there is none. */
async function addShopping(
  member: Member,
  list: List | null,
  requested: RequestedItem[],
  open: Item[],
): Promise<string> {
  if (list) return addItems(member, list, requested, open);

  const previous = await getLastCompletedList(member.householdId, "shopping");
  if (previous && previous.leftovers.length > 0) {
    await setPending(member.id, {
      type: "open_list",
      previousListId: previous.list.id,
      leftovers: previous.leftovers,
      items: requested.map(({ name, quantity, unit, category }) => ({ name, quantity, unit, category })),
    });
    const names = previous.leftovers.map((item) => item.name);
    return t("noActiveList", { count: names.length, names: names.join(", "), example: names[0] });
  }
  const created = await ensureActiveList(member.householdId, "shopping");
  return addItems(member, created, requested, []);
}

/**
 * Adds new items right away; items already on the list (unchecked) wait for
 * a confirmation question about increasing the quantity.
 */
async function addItems(
  member: Member,
  list: List,
  requested: RequestedItem[],
  open: Item[],
): Promise<string> {
  const byName = new Map(open.map((item) => [normalizeName(item.name), item]));
  const fresh: RequestedItem[] = [];
  const duplicates = new Map<string, { item: Item; add: number; unit: string | null }>();

  for (const request of requested) {
    const match =
      (request.existing && byName.get(normalizeName(request.existing))) ||
      byName.get(normalizeName(request.name));
    if (!match) {
      fresh.push(request);
      continue;
    }
    const entry = duplicates.get(match.id) ?? { item: match, add: 0, unit: request.unit };
    entry.add += request.quantity && request.quantity > 0 ? request.quantity : 1;
    duplicates.set(match.id, entry);
  }

  const parts: string[] = [];

  if (fresh.length > 0) {
    await db.insert(items).values(
      fresh.map((item) => ({
        listId: list.id,
        name: item.name.trim(),
        quantity: item.quantity && item.quantity > 0 ? item.quantity : null,
        unit: item.unit?.trim() || null,
        category: item.category,
        addedBy: member.id,
      })),
    );
    parts.push(t("added", { items: fresh.map(describe).join(", "), url: appUrl() }));
  }

  if (duplicates.size > 0) {
    const questions = [...duplicates.values()].map(({ item, add, unit }) => {
      const total = (item.quantity ?? 1) + add;
      return { item, add, total, unit: item.unit ?? unit };
    });
    await setPending(member.id, {
      type: "duplicates",
      listId: list.id,
      items: questions.map(({ item, total }) => ({ itemId: item.id, name: item.name, newQuantity: total })),
    });

    if (questions.length === 1) {
      const [{ item, add, total, unit }] = questions;
      const current = formatQuantity(item, units);
      parts.push(
        t("duplicateOne", {
          name: item.name,
          current: current ? ` (${current})` : "",
          add: numberFormat.format(add),
          total: amount(total, unit),
        }),
      );
    } else {
      const lines = questions
        .map(({ item, add, total, unit }) =>
          t("duplicateLine", { name: item.name, add: numberFormat.format(add), total: amount(total, unit) }),
        )
        .join("\n");
      parts.push(t("duplicateMany", { lines }));
    }
  }

  return parts.join("\n\n");
}

async function answerPending(member: Member, pending: PendingAction, text: string): Promise<string | null> {
  const options =
    pending.type === "duplicates"
      ? pending.items.map((item) => item.name)
      : pending.leftovers.map((item) => item.name);

  const answer = await parseAnswer(text, options);
  if (!answer) return t("answerUnclear");
  if (answer.answer === "unrelated") {
    await clearPending(member.id);
    return null;
  }

  const chosen =
    answer.answer === "yes"
      ? new Set(options)
      : answer.answer === "some"
        ? new Set(answer.selected)
        : new Set<string>();
  if (answer.answer === "some" && chosen.size === 0) return t("answerUnclear");

  await clearPending(member.id);

  if (pending.type === "duplicates") {
    if (chosen.size === 0) return t("duplicateSkipped");

    const [list] = await db.select().from(lists).where(eq(lists.id, pending.listId));
    if (!list || list.status !== "active" || list.householdId !== member.householdId) {
      return t("listLocked");
    }

    const updated: string[] = [];
    for (const entry of pending.items.filter((item) => chosen.has(item.name))) {
      const [row] = await db
        .update(items)
        .set({ quantity: entry.newQuantity })
        .where(and(eq(items.id, entry.itemId), eq(items.listId, list.id), eq(items.done, false)))
        .returning();
      if (row) updated.push(describe(row));
    }
    return updated.length > 0
      ? t("duplicateUpdated", { items: updated.join(", "), url: appUrl() })
      : t("duplicateSkipped");
  }

  // open_list: open a new list, carry over the chosen leftovers, then add the
  // items from the message that started the conversation.
  const list = await ensureActiveList(member.householdId, "shopping");
  const carryIds = pending.leftovers.filter((item) => chosen.has(item.name)).map((item) => item.id);
  if (carryIds.length > 0) {
    await db.execute(sql`
      insert into ${items} (list_id, name, quantity, unit, category, assignee_id, added_by)
      select ${list.id}, name, quantity, unit, category, assignee_id, added_by
      from ${items}
      where ${inArray(items.id, carryIds)} and list_id = ${pending.previousListId} and done = false
      order by created_at
    `);
  }

  const carried = pending.leftovers.filter((item) => chosen.has(item.name)).map((item) => item.name);
  const opened = carried.length > 0 ? t("listOpenedCarried", { names: carried.join(", ") }) : t("listOpened");
  const open = (await getListItems(list.id)).filter((item) => !item.done);
  // An item that was just carried over already covers the same request.
  const carriedNames = new Set(carried.map(normalizeName));
  const requested = pending.items.filter((item) => !carriedNames.has(normalizeName(item.name)));
  const added = requested.length > 0 ? await addItems(member, list, requested, open) : "";
  return [opened, added].filter(Boolean).join("\n\n");
}

function amount(quantity: number, unit: string | null): string {
  const n = numberFormat.format(quantity);
  return `${n} ${unit ?? units}`;
}

function describe(item: { name: string; quantity: number | null; unit: string | null }): string {
  const quantity = formatQuantity(item, units);
  return quantity ? `${item.name} ${quantity}` : item.name;
}

function formatList(open: Item[]): string {
  if (open.length === 0) return t("listEmpty", { url: appUrl() });
  const sections = groupByCategory(open)
    .map(
      ({ category, items }) =>
        `*${tCategories(isCategory(category) ? category : "other")}*\n${items.map((item) => `• ${describe(item)}`).join("\n")}`,
    )
    .join("\n\n");
  return t("list", { sections, url: appUrl() });
}

function describeChore(title: string, assigneeId: string | null, people: Person[]): string {
  const name = people.find((p) => p.id === assigneeId)?.name;
  return name ? `${title} (${name})` : title;
}

function formatChores(member: Member, chores: Item[], people: Person[]): string {
  const open = chores.filter((chore) => !chore.done);
  const url = `${appUrl()}/chores`;
  if (open.length === 0) return t("choresEmpty", { url });
  // The sender's chores first, then everyone else's, then unassigned.
  const rank = (chore: Item) => (chore.assigneeId === member.id ? 0 : chore.assigneeId ? 1 : 2);
  const lines = [...open]
    .sort((a, b) => rank(a) - rank(b))
    .map((chore) => `• ${describeChore(chore.name, chore.assigneeId, people)}`)
    .join("\n");
  return t("choresList", { lines, url });
}
