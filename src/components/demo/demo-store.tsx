"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ActionResult } from "@/app/actions";
import { parseDemoMessage } from "@/app/demo-actions";
import type { Item } from "@/db/schema";
import { BackendProvider, type Backend } from "@/components/lists/backend";
import { useRouter } from "@/i18n/navigation";
import { MAX_ATTACHMENTS_PER_ITEM } from "@/lib/attachment-rules";
import type { AttachmentView } from "@/lib/attachments";
import { planChecklist, planChores, planShopping, type AssistantReply } from "@/lib/assistant-plan";
import { DEFAULT_CATEGORY } from "@/lib/categories";
import { DONE_TASKS_VISIBLE_MS, dueStatus, todayIn } from "@/lib/due";
import { combineQuantities, findOpenItem } from "@/lib/items";
import type { ListType } from "@/lib/list-kinds";
import type { ListSummary } from "@/lib/lists";

// The public demo keeps a whole place in the visitor's browser
// (localStorage, one copy per language). Nothing is sent to the database:
// the only server call is the AI chat, which reads a message and returns what
// it understood (see src/app/demo-actions.ts).

export type DemoList = { id: string; name: string; type: ListType };
export type DemoPerson = { id: string; name: string };

/** Demo items keep their list's id in `roundId`. */
export type DemoState = {
  version: 1;
  place: string;
  people: DemoPerson[];
  lists: DemoList[];
  items: Item[];
  /** Links only are kept across visits; files live in memory for the visit. */
  attachments: Record<string, AttachmentView[]>;
};

export const ME = "me";
const VERSION = 1;
const ok: ActionResult = { ok: true };
const fail = (error: "notFound" | "invalid") => ({ ok: false, error }) as const;

type SeedItem = [string, number | null, string | null, string, string, boolean];
type SeedTask = [string, number | null, string | null, string | null];

function newItem(listId: string, fields: Partial<Item> & { name: string }, position: number): Item {
  return {
    id: crypto.randomUUID(),
    roundId: listId,
    note: null,
    quantity: null,
    unit: null,
    category: DEFAULT_CATEGORY,
    assigneeId: null,
    done: false,
    doneBy: null,
    doneAt: null,
    addedBy: ME,
    dueDate: null,
    dueTime: null,
    position,
    createdAt: new Date(),
    ...fields,
  };
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The sample place, in the page's language, with dates around today. */
function useSeed() {
  const t = useTranslations("Demo.seed");
  return useCallback((): DemoState => {
    const people = [
      { id: ME, name: t("me") },
      { id: "noa", name: t("noa") },
      { id: "dan", name: t("dan") },
    ];
    const shopping = { id: crypto.randomUUID(), name: t("shopping.name"), type: "shopping" as const };
    const tasks = { id: crypto.randomUUID(), name: t("tasks.name"), type: "tasks" as const };
    const checklist = { id: crypto.randomUUID(), name: t("checklist.name"), type: "checklist" as const };
    const today = todayIn();

    const items: Item[] = [
      ...(t.raw("shopping.items") as SeedItem[]).map(([name, quantity, unit, category, by, done], i) =>
        newItem(shopping.id, { name, quantity, unit, category, addedBy: by, done, doneBy: done ? by : null }, i + 1),
      ),
      ...(t.raw("tasks.items") as SeedTask[]).map(([name, days, time, assignee], i) =>
        newItem(
          tasks.id,
          {
            name,
            dueDate: days === null ? null : addDays(today, days),
            dueTime: days === null || !time ? null : `${time}:00`,
            assigneeId: assignee,
          },
          i + 1,
        ),
      ),
      newItem(tasks.id, { name: t("tasks.done"), done: true, doneBy: "noa", doneAt: new Date() }, 99),
      ...(t.raw("checklist.items") as [string, boolean][]).map(([name, done], i) =>
        newItem(checklist.id, { name, done }, i + 1),
      ),
    ];

    // One task with a note and a link, to show the paperclip.
    const withNote = items.find((item) => item.roundId === tasks.id && item.assigneeId === ME);
    const attachments: DemoState["attachments"] = {};
    if (withNote) {
      withNote.note = t("tasks.note");
      attachments[withNote.id] = [
        { id: crypto.randomUUID(), kind: "link", name: t("tasks.linkName"), url: t("tasks.link"), contentType: null, size: null },
      ];
    }
    return { version: VERSION, place: t("place"), people, lists: [shopping, tasks, checklist], items, attachments };
  }, [t]);
}

function load(key: string): DemoState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const state = JSON.parse(raw) as DemoState;
    if (state.version !== VERSION) return null;
    state.items = state.items.map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
      doneAt: item.doneAt ? new Date(item.doneAt) : null,
    }));
    return state;
  } catch {
    return null;
  }
}

function save(key: string, state: DemoState) {
  try {
    const attachments = Object.fromEntries(
      Object.entries(state.attachments).map(([id, list]) => [id, list.filter((a) => a.kind === "link")]),
    );
    localStorage.setItem(key, JSON.stringify({ ...state, attachments }));
  } catch {
    // Private windows and full storage: the demo still works for this visit.
  }
}

type DemoContext = { state: DemoState; reset: () => void };
const Context = createContext<DemoContext | null>(null);

export function useDemo() {
  const context = useContext(Context);
  if (!context) throw new Error("useDemo needs DemoProvider");
  return context;
}

/** What a list screen shows: open items, plus tasks done in the last week. */
export function itemsOf(state: DemoState, list: DemoList) {
  const since = Date.now() - DONE_TASKS_VISIBLE_MS;
  return state.items
    .filter((item) => item.roundId === list.id)
    .filter((item) => list.type !== "tasks" || !item.done || (item.doneAt && item.doneAt.getTime() > since))
    .sort((a, b) => a.position - b.position);
}

/** The demo's lists with their counts, as on the home screen; due times as of `now`. */
export function summarizeLists(state: DemoState, now: number): ListSummary[] {
  return state.lists.map((list) => {
    const items = itemsOf(state, list);
    const statuses = items.filter((item) => !item.done).map((item) => dueStatus(item, now));
    return {
      id: list.id,
      name: list.name,
      type: list.type,
      total: items.length,
      done: items.filter((item) => item.done).length,
      visibility: "place",
      ownerName: null,
      sharedWith: [],
      overdue: statuses.filter((s) => s === "overdue").length,
      soon: statuses.filter((s) => s === "soon").length,
    };
  });
}

/** Holds the demo's state outside React, so actions can read it after awaiting the AI. */
function createStore() {
  let state: DemoState | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: DemoState) {
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function DemoProvider({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const locale = useLocale();
  const key = `weneed-demo-${locale}`;
  const seed = useSeed();
  const router = useRouter();
  const [store] = useState(createStore);
  const state = useSyncExternalStore(store.subscribe, store.get, () => null);

  // localStorage is only readable in the browser, after the first render.
  useEffect(() => store.set(load(key) ?? seed()), [store, key, seed]);

  const update = useCallback(
    (change: (state: DemoState) => DemoState) => {
      const now = store.get();
      if (!now) return;
      const next = change(now);
      store.set(next);
      save(key, next);
    },
    [store, key],
  );

  const reset = useCallback(() => {
    for (const list of Object.values(store.get()?.attachments ?? {}))
      for (const a of list) if (a.url?.startsWith("blob:")) URL.revokeObjectURL(a.url);
    update(() => seed());
    router.push("/demo");
  }, [store, update, seed, router]);

  const backend = useMemo(() => createBackend(update, () => store.get()!, router), [store, update, router]);

  if (!state) return fallback;
  return (
    <Context.Provider value={{ state, reset }}>
      <BackendProvider value={backend}>{children}</BackendProvider>
    </Context.Provider>
  );
}

type Update = (change: (state: DemoState) => DemoState) => void;
type Router = ReturnType<typeof useRouter>;

function createBackend(update: Update, get: () => DemoState, router: Router): Backend {
  const patchItem = (id: string, patch: Partial<Item>) =>
    update((s) => ({ ...s, items: s.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
  const removeItems = (ids: string[]) =>
    update((s) => {
      const attachments = { ...s.attachments };
      for (const id of ids) delete attachments[id];
      return { ...s, items: s.items.filter((item) => !ids.includes(item.id)), attachments };
    });
  const listOf = (id: string) => get().lists.find((list) => list.id === id);
  const nextPosition = (listId: string) =>
    Math.max(0, ...get().items.filter((item) => item.roundId === listId).map((item) => item.position)) + 1;
  const insert = (listId: string, fields: Partial<Item> & { name: string }) => {
    const item = newItem(listId, fields, nextPosition(listId));
    update((s) => ({ ...s, items: [...s.items, item] }));
    return item;
  };
  const choreFields = (input: { title: string; assigneeId: string | null; dueDate: string | null; dueTime: string | null }) => ({
    name: input.title.trim(),
    assigneeId: input.assigneeId,
    dueDate: input.dueDate,
    dueTime: input.dueDate && input.dueTime ? `${input.dueTime}:00` : null,
  });
  const attachmentsOf = (itemId: string) => get().attachments[itemId] ?? [];
  const attach = (itemId: string, attachment: AttachmentView) =>
    update((s) => ({ ...s, attachments: { ...s.attachments, [itemId]: [...(s.attachments[itemId] ?? []), attachment] } }));

  return {
    base: "/demo",
    history: false,
    remindAssignee: null,

    async addItem(listId, input) {
      const list = listOf(listId);
      if (!list) return fail("notFound");
      const name = input.name.trim();
      // Same rules as the app: a product already on a shopping list gets the added quantity.
      if (list.type === "shopping") {
        const open = get().items.filter((item) => item.roundId === listId && !item.done);
        const existing = findOpenItem(open, name);
        if (existing) {
          const total = combineQuantities(existing, { quantity: input.quantity, unit: input.unit ?? null });
          if (total) patchItem(existing.id, total);
          if (total || input.quantity === null) return ok;
        }
      }
      const known = get().items.find((item) => item.name.trim() === name && item.category !== DEFAULT_CATEGORY);
      insert(listId, {
        name,
        quantity: input.quantity,
        unit: input.unit || null,
        category: input.category ?? known?.category ?? DEFAULT_CATEGORY,
      });
      return ok;
    },
    async updateItem(id, input) {
      patchItem(id, {
        name: input.name.trim(),
        quantity: input.quantity,
        unit: input.unit || null,
        category: input.category ?? DEFAULT_CATEGORY,
      });
      return ok;
    },
    async deleteItem(id) {
      removeItems([id]);
      return ok;
    },
    async setItemDone(id, done) {
      patchItem(id, { done, doneBy: done ? ME : null, doneAt: done ? new Date() : null });
      return ok;
    },
    async setAllDone(listId, done) {
      update((s) => ({
        ...s,
        items: s.items.map((item) =>
          item.roundId === listId ? { ...item, done, doneBy: done ? ME : null, doneAt: done ? new Date() : null } : item,
        ),
      }));
      return ok;
    },
    async reorderItems(listId, ids) {
      const rank = new Map(ids.map((id, i) => [id, i + 1]));
      update((s) => ({
        ...s,
        items: s.items.map((item) => (rank.has(item.id) ? { ...item, position: rank.get(item.id)! } : item)),
      }));
      return ok;
    },
    async addChore(listId, input) {
      if (!listOf(listId)) return fail("notFound");
      insert(listId, choreFields(input));
      return ok;
    },
    async updateChore(id, input) {
      patchItem(id, choreFields(input));
      return ok;
    },
    async finishRound(listId, carryOver) {
      // The demo keeps no history: bought items go, the rest stay if asked.
      const gone = get()
        .items.filter((item) => item.roundId === listId && (item.done || !carryOver))
        .map((item) => item.id);
      removeItems(gone);
      return ok;
    },
    async createList(name, type) {
      const list = { id: crypto.randomUUID(), name: name.trim(), type };
      update((s) => ({ ...s, lists: [...s.lists, list] }));
      router.push(`/demo/lists/${list.id}`);
      return ok;
    },
    async renameList(listId, name) {
      update((s) => ({ ...s, lists: s.lists.map((l) => (l.id === listId ? { ...l, name: name.trim() } : l)) }));
      return ok;
    },
    async setListType(listId, type) {
      update((s) => ({ ...s, lists: s.lists.map((l) => (l.id === listId ? { ...l, type } : l)) }));
      return ok;
    },
    async deleteList(listId) {
      const ids = get()
        .items.filter((item) => item.roundId === listId)
        .map((item) => item.id);
      removeItems(ids);
      update((s) => ({ ...s, lists: s.lists.filter((l) => l.id !== listId) }));
      router.push("/demo");
      return ok;
    },

    async askAssistant(listId, text) {
      const list = listOf(listId);
      if (!list) return { ok: false, error: "notFound" };
      const state = get();
      const listItems = state.items.filter((item) => item.roundId === listId);
      const open = listItems.filter((item) => !item.done);
      const me = state.people.find((p) => p.id === ME)!;
      const parsed = await parseDemoMessage({
        type: list.type,
        text,
        current: (list.type === "shopping" ? open : listItems).map((item) => item.name).slice(0, 200),
        sender: me.name,
        members: state.people.map((p) => p.name),
      });
      if (!parsed.ok) return { ok: false, error: parsed.error };

      const plan =
        parsed.type === "shopping"
          ? planShopping(parsed.result, open)
          : parsed.type === "checklist"
            ? planChecklist(parsed.result, listItems)
            : planChores(parsed.result, state.people);
      const reply: AssistantReply = { added: [], duplicates: plan.duplicates, skipped: plan.skipped };
      for (const planned of plan.add) {
        const item = insert(listId, {
          name: planned.name,
          quantity: planned.quantity,
          unit: planned.unit,
          category: planned.category,
          dueDate: planned.dueDate,
          dueTime: planned.dueTime ? `${planned.dueTime}:00` : null,
          assigneeId: planned.assigneeId,
        });
        reply.added.push({
          id: item.id,
          name: planned.name,
          quantity: planned.quantity,
          unit: planned.unit,
          dueDate: planned.dueDate,
          dueTime: planned.dueTime,
          assignee: planned.assignee,
        });
      }
      return { ok: true, reply };
    },
    async setItemQuantity(itemId, quantity, unit) {
      patchItem(itemId, { quantity, unit: unit || null });
      return ok;
    },
    async removeAdded(_listId, itemIds) {
      removeItems(itemIds);
      return ok;
    },

    async getItemDetails(itemId) {
      const item = get().items.find((i) => i.id === itemId);
      if (!item) return { ok: false, error: "notFound" };
      return { ok: true, note: item.note ?? "", attachments: attachmentsOf(itemId), readOnly: false };
    },
    async setItemNote(itemId, note) {
      patchItem(itemId, { note: note.trim() || null });
      return ok;
    },
    async addLink(itemId, url, title) {
      if (attachmentsOf(itemId).length >= MAX_ATTACHMENTS_PER_ITEM) return { ok: false, error: "tooManyAttachments" };
      let href: URL;
      try {
        href = new URL(/^[a-z]+:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
        if (href.protocol !== "https:" && href.protocol !== "http:") throw new Error();
      } catch {
        return { ok: false, error: "invalid" };
      }
      const attachment: AttachmentView = {
        id: crypto.randomUUID(),
        kind: "link",
        name: title?.trim() || href.hostname.replace(/^www\./, ""),
        url: href.toString(),
        contentType: null,
        size: null,
      };
      attach(itemId, attachment);
      return { ok: true, attachment };
    },
    async deleteAttachment(attachmentId) {
      update((s) => ({
        ...s,
        attachments: Object.fromEntries(
          Object.entries(s.attachments).map(([id, list]) => [
            id,
            list.filter((a) => {
              if (a.id === attachmentId && a.url?.startsWith("blob:")) URL.revokeObjectURL(a.url);
              return a.id !== attachmentId;
            }),
          ]),
        ),
      }));
      return ok;
    },
    async uploadFile(itemId, file) {
      if (attachmentsOf(itemId).length >= MAX_ATTACHMENTS_PER_ITEM) return { ok: false, error: "tooManyAttachments" };
      // Kept in this browser tab only: it disappears when the page reloads.
      const attachment: AttachmentView = {
        id: crypto.randomUUID(),
        kind: "file",
        name: file.name,
        url: URL.createObjectURL(file),
        contentType: file.type,
        size: file.size,
      };
      attach(itemId, attachment);
      return { ok: true, attachment };
    },
    fileUrl: (attachment) => attachment.url ?? "#",
  };
}
