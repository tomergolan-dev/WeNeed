// PAUSED (2026-11-16): part of the WhatsApp bot, which is no longer the main
// product (see "History" in docs/spec.md).
// Kept because the bot may return as an extra way to add items.
// Not used by the web app.

import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { db } from "@/db";
import { items, lists, placeMembers, processedMessages, rounds, users, type Item, type Round } from "@/db/schema";
import { locale } from "@/i18n/request";
import { isCategory } from "@/lib/categories";
import { formatQuantity, groupByCategory } from "@/lib/items";
import { ensureActiveRound, ensureFirstList, getChores, getPlace, getRoundItems } from "@/lib/lists";
import { sendButtons, sendText, type Button, type IncomingMessage } from "@/lib/whatsapp";
import messages from "../../../messages/he.json";
import { normalizeName } from "@/lib/normalize";
import { parseAnswer } from "./parse-answer";
import { parseMessage, type Target } from "./parse-message";
import { clearPending, readPending, setPending, type NewItem, type PendingAction } from "./pending";

const t = createTranslator({ locale, messages, namespace: "Bot" });
const tCategories = createTranslator({ locale, messages, namespace: "Categories" });
const units = createTranslator({ locale, messages, namespace: "ItemForm" })("units");

// The sender as the bot sees them: a user acting in their first place.
type Member = { id: string; name: string; placeId: string; pendingAction: unknown };
type RequestedItem = NewItem & { existing?: string | null };

const numberFormat = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 2 });

/** The bot adds to the active round of the place's first shopping list. */
async function shoppingRound(placeId: string): Promise<Round> {
  const list = await ensureFirstList(placeId, "shopping", "קניות");
  return ensureActiveRound(list.id);
}

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
      id: users.id,
      name: users.name,
      placeId: placeMembers.placeId,
      pendingAction: users.pendingAction,
    })
    .from(users)
    .innerJoin(placeMembers, eq(placeMembers.userId, users.id))
    .where(eq(users.phone, message.from))
    .orderBy(asc(placeMembers.joinedAt))
    .limit(1);

  if (!member) {
    await sendText(message.from, t("unknownSender"));
    return;
  }
  if (message.text === null) {
    await sendText(message.from, t("textOnly"));
    return;
  }

  const answer = await reply(member, message.text, message.buttonId);
  if (typeof answer === "string") await sendText(message.from, answer);
  else await sendButtons(message.from, answer.body, answer.buttons);
}

type Reply = string | { body: string; buttons: Button[] };
type Choice = "chores" | "shopping" | "both";
type ParsedChore = { title: string; assignee: string | null };

const CHOICE_BUTTONS: Button[] = [
  { id: "list:chores", title: t("chooseChores") },
  { id: "list:shopping", title: t("chooseShopping") },
  { id: "list:both", title: t("chooseBoth") },
];

/** A pressed button, or the same answer typed as text. */
function readChoice(buttonId: string | null, text: string): Choice | null {
  if (buttonId?.startsWith("list:")) {
    const choice = buttonId.slice("list:".length);
    return choice === "chores" || choice === "shopping" || choice === "both" ? choice : null;
  }
  const word = text.trim().replace(/[.!?]+$/u, "").replace(/^[^\p{L}]+/u, "");
  if (/^(מטלה|מטלות|משימה|משימות|למטלות)$/u.test(word)) return "chores";
  if (/^(קניות|לקניות|רשימת קניות|קנייה)$/u.test(word)) return "shopping";
  if (/^(גם וגם|שניהם|שתיהן|both)$/iu.test(word)) return "both";
  return null;
}

/** "מטלה: ..." / "קניות: ..." at the start picks the list without guessing. */
function readTarget(text: string): { target: Target | null; text: string } {
  const match = text.match(/^\s*(מטלה|מטלות|משימה|משימות|קניות|רשימת קניות)\s*[:\-–]\s*/u);
  if (!match) return { target: null, text };
  const target: Target = match[1].includes("קניות") ? "shopping" : "chores";
  return { target, text: text.slice(match[0].length) };
}

async function reply(member: Member, rawText: string, buttonId: string | null): Promise<Reply> {
  const pending = readPending(member.pendingAction);
  if (pending?.type === "choose_list") {
    const choice = readChoice(buttonId, rawText);
    await clearPending(member.id);
    if (choice) {
      return addParsed(
        member,
        choice === "shopping" ? [] : pending.chores,
        choice === "chores" ? [] : pending.items,
      );
    }
    // Not an answer: the question is dropped and the message handled as new.
  } else if (pending) {
    const answer = await answerPending(member, pending, rawText);
    if (answer !== null) return answer;
    // Not an answer to the question: drop it and treat the message as new.
  } else {
    if (member.pendingAction) await clearPending(member.id); // expired or malformed
    if (buttonId?.startsWith("list:")) return t("questionExpired");
  }

  const { target, text } = readTarget(rawText);

  const list = await shoppingRound(member.placeId);
  const open = (await getRoundItems(list.id)).filter((item) => !item.done);

  const household = await getPlace(member.placeId);
  const people = household?.members ?? [];

  const parsed = await parseMessage(
    text,
    open.map((item) => item.name),
    { sender: member.name, members: people.map((p) => p.name) },
    target,
  );
  if (!parsed) return t("notUnderstood");

  switch (parsed.intent) {
    case "add_items": {
      if (parsed.items.length === 0 && parsed.chores.length === 0) return t("notUnderstood");
      if (parsed.ambiguous && !target && parsed.chores.length > 0 && parsed.items.length > 0) {
        await setPending(member.id, {
          type: "choose_list",
          chores: parsed.chores,
          items: parsed.items.map(({ name, quantity, unit, category }) => ({ name, quantity, unit, category })),
        });
        return {
          body: t("chooseList", {
            chores: parsed.chores.map((c) => c.title).join(", "),
            items: parsed.items.map(describe).join(", "),
          }),
          buttons: CHOICE_BUTTONS,
        };
      }
      return addParsed(member, parsed.chores, parsed.items, { list, open, people });
    }
    case "show_list":
      return formatList(open);
    case "show_chores":
      return formatChores(
        member,
        await getChores((await ensureFirstList(member.placeId, "tasks", "מטלות")).id),
        people,
      );
    case "login_link":
      return t("loginLink", { url: `${appUrl()}/login` });
    case "other":
      return t("help", { name: member.name });
  }
}

type Person = { id: string; name: string };

/** Adds chores and shopping items from one message; a single link at the end. */
async function addParsed(
  member: Member,
  chores: ParsedChore[],
  requested: RequestedItem[],
  loaded?: { list: Round; open: Item[]; people: Person[] },
): Promise<string> {
  let context = loaded;
  if (!context) {
    const list = await shoppingRound(member.placeId);
    const open = (await getRoundItems(list.id)).filter((item) => !item.done);
    const people = (await getPlace(member.placeId))?.members ?? [];
    context = { list, open, people };
  }
  const choresReply = chores.length > 0 ? await addChores(member, chores, context.people) : "";
  const shoppingReply =
    requested.length > 0 ? await addItems(member, context.list, requested, context.open) : "";
  // One link per reply: the shopping part brings its own when it added items.
  if (choresReply && !shoppingReply.includes(appUrl())) {
    return [`${choresReply}\n${appUrl()}`, shoppingReply].filter(Boolean).join("\n\n");
  }
  return [choresReply, shoppingReply].filter(Boolean).join("\n\n");
}

async function addChores(
  member: Member,
  chores: ParsedChore[],
  people: Person[],
): Promise<string> {
  const list = await ensureFirstList(member.placeId, "tasks", "מטלות");
  const round = await ensureActiveRound(list.id);
  const rows = chores
    .filter((chore) => chore.title.trim())
    .map((chore) => ({
      roundId: round.id,
      name: chore.title.trim(),
      assigneeId: people.find((p) => p.name === chore.assignee)?.id ?? null,
      addedBy: member.id,
    }));
  if (rows.length === 0) return "";
  await db.insert(items).values(rows);
  const names = rows.map((row) => describeChore(row.name, row.assigneeId, people)).join(", ");
  return t("choresAdded", { chores: names });
}

/**
 * Adds new items right away; items already on the list (unchecked) wait for
 * a confirmation question about increasing the quantity.
 */
async function addItems(
  member: Member,
  list: Round,
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
        roundId: list.id,
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

async function answerPending(
  member: Member,
  pending: Exclude<PendingAction, { type: "choose_list" }>,
  text: string,
): Promise<string | null> {
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

    // pending.listId holds the round id (rounds replaced per-round lists in Stage C).
    const [list] = await db
      .select({ id: rounds.id, status: rounds.status, placeId: lists.placeId })
      .from(rounds)
      .innerJoin(lists, eq(lists.id, rounds.listId))
      .where(eq(rounds.id, pending.listId));
    if (!list || list.status !== "active" || list.placeId !== member.placeId) {
      return t("listLocked");
    }

    const updated: string[] = [];
    for (const entry of pending.items.filter((item) => chosen.has(item.name))) {
      const [row] = await db
        .update(items)
        .set({ quantity: entry.newQuantity })
        .where(and(eq(items.id, entry.itemId), eq(items.roundId, list.id), eq(items.done, false)))
        .returning();
      if (row) updated.push(describe(row));
    }
    return updated.length > 0
      ? t("duplicateUpdated", { items: updated.join(", "), url: appUrl() })
      : t("duplicateSkipped");
  }

  // open_list: open a new list, carry over the chosen leftovers, then add the
  // items from the message that started the conversation.
  const list = await shoppingRound(member.placeId);
  const carryIds = pending.leftovers.filter((item) => chosen.has(item.name)).map((item) => item.id);
  if (carryIds.length > 0) {
    await db.execute(sql`
      insert into ${items} (round_id, name, quantity, unit, category, assignee_id, added_by)
      select ${list.id}, name, quantity, unit, category, assignee_id, added_by
      from ${items}
      where ${inArray(items.id, carryIds)} and round_id = ${pending.previousListId} and done = false
      order by created_at
    `);
  }

  const carried = pending.leftovers.filter((item) => chosen.has(item.name)).map((item) => item.name);
  const opened = carried.length > 0 ? t("listOpenedCarried", { names: carried.join(", ") }) : t("listOpened");
  const open = (await getRoundItems(list.id)).filter((item) => !item.done);
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
  const url = appUrl();
  if (open.length === 0) return t("choresEmpty", { url });
  // The sender's chores first, then everyone else's, then unassigned.
  const rank = (chore: Item) => (chore.assigneeId === member.id ? 0 : chore.assigneeId ? 1 : 2);
  const lines = [...open]
    .sort((a, b) => rank(a) - rank(b))
    .map((chore) => `• ${describeChore(chore.name, chore.assigneeId, people)}`)
    .join("\n");
  return t("choresList", { lines, url });
}
