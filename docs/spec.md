# We Need — Product Spec

Last updated: 2026-11-17. This version replaces the WhatsApp-bot spec (see "History" at the end).

## Vision

Everything a group of people "needs" in one place: things to buy, chores to get done, things to pack for a weekend away. We Need is a mobile-first web app where each **place** (an apartment, a home, an office, a restaurant) keeps shared lists, and an AI chat in every list turns a plain sentence ("need 2 cartons of milk and eggs") into list items.

The name is the product: everything in it is something "we need" to buy, to do, or to take.

We Need is also a portfolio project, so it includes a public demo.

## Users and places

- A **user** signs in with an email address (Google, or a code sent by email).
- A **place** is a shared space with members, for example "Parents' home", "My apartment", "Office", "Restaurant".
- A user can belong to several places and switches between them from a selector at the top of the screen.
- Every user has a **personal area, "שלי"**, created automatically. Its lists belong to no place ("ציוד לצפון"): private by default, and each can be shared with specific people by email. Lists others shared with the user appear there under "משותפות איתי".
- Any user can create a **shared place**, with a name and an icon (home, apartment, office, restaurant, store, vacation), and invite others to it (see "Invites").
- The place selector ("לאן להיכנס?") shows "שלי" first, then shared places with the user's role, then pending invites.
- The chosen place is remembered on the device. A new user starts in "שלי"; the first shared place is the default for users who have one.
- Roles in a shared place (decided 2026-11-17):
  - **Admin (מנהל, stored as `owner`):** sees every list, invites and removes members, changes roles, decides who sees each list, renames the place, deletes lists. The creator is an admin; a place keeps at least one.
  - **Member (חבר):** sees the lists open to them, edits them, and can create lists.
- Who sees a list ("מי רואה", admins only, from the list menu): **the whole place** (every member, also future ones) or **selected people** (admins always see it). The owner of a personal area is its admin.
- Someone invited **to some lists only** joins the place as a member who sees just those lists, plus lists they create. A list such a member creates starts as "selected people", with them on it.
- Only admins invite (decided 2026-11-17).
- First real places:
  - "הדירה של תומר ותמיר": Tomer, Tamir and Nurit (Tomer's mom).
  - "בית משפחת גולן": Nurit.

## Lists

- A new place starts with no lists. Members create the lists they need, of any kind and in any number, each with its own name.
  - For example, three shopping lists: "קניות שוק", "קניות מהקצבייה", "קניות סופר".
- There are three kinds of list:

| Kind | Purpose | Lifecycle |
| --- | --- | --- |
| 🛒 Shopping | Things to buy | Each shopping list has a current round; finishing it locks the round, moves it to that list's history, and starts a new empty round |
| ✅ Chores | Things to do, optionally by a date and time | Ongoing; done chores fade out |
| 📋 Checklist | A reusable list, e.g. "Weekend up north" | Permanent; items are checked and unchecked again and again |

- Lists can be renamed and deleted by members (deleting removes the list's history too, after a confirmation).
- The home screen shows the place's lists as cards (item counts, progress, and for chores the overdue and due-soon counts), and a "New list" button.
- **Choosing the kind:** a new list gets a name and a kind, shown as three cards, each with a line on what it is for. The kind is guessed from the name ("קניות סופר" → shopping, "מטלות הבית" → chores, "ציוד לטיול" → checklist; shopping when nothing hints) until the user picks one. The kind can be changed later from the list's menu. Decided 2026-11-17: an explicit kind keeps each list's actions clear (finish, due dates, check all), and the guess keeps it effortless. The AI chat may later guess less obvious names.

### Shopping lists

- Items have a name, quantity, unit and store section (category), and are grouped by section in store walking order.
- Each item shows the initial of the member who added it.
- Check-off while shopping; checked items move to an "in the cart" section, and a progress bar shows how much is in the cart.
- Adding by hand: see "List screens". When the section is left on automatic, the item gets the section it had the last time it was bought in this place, otherwise the AI guesses it.
- **Finish shopping:** locks the current round and moves it to the list's history, and the list starts a new round. Unbought items stay on the list by default (the user can choose to drop them).
- **History:** per list, from the list's menu; each finished round shows what was bought and what wasn't, read-only.
- Item rules (from the bot era, kept for the AI chat):
  - Product names are kept exactly as written: no spelling fixes, no expanding slang ("גבנצ" stays "גבנצ").
  - A number with x or × ("x18", "18x") is a count of units.
  - A count without a unit is shown as "18 יח׳".
  - An item that is already on the list (open, same name ignoring spelling marks and spacing) is not added twice:
    - In the AI chat, the chat asks whether to update its quantity.
    - When adding by hand, the quantities are added up at once ("תפוח עץ" 5 + 3 → 8), with a short note under the field. With no quantity, nothing changes ("already on the list"). With a different unit, it is added as its own row.

### Chores

- Shown in the app as **"משימות"** (tasks), the more general word; "מטלות הבית" is just an example (decided 2026-11-17).
- A place can have several chores lists.
- A chore has a title, an optional **due date** and **due time** (Israel time), and an optional assignee.
- Status signs, like traffic signs:
  - **Due soon** (within 24 hours): a yellow mark and a pill ("בעוד 3 שעות", "היום").
  - **Overdue:** a red mark and a pill ("באיחור של יום").
  - A chore with a date and no time is due at the end of that day.
- Open chores have two sorts, switched above the list:
  - **By date** (the default): overdue, due soon, later by date, then those without a date in the order they were added.
  - **By order added.**
- Filters: all, overdue, due soon, no date.
- Check-off marks a chore as done; done chores stay visible for a week under "done recently".
- Later: calendar integration (see "Future").

### Checklists

- A list to check off, without dates: not necessarily fixed, it changes as needed and can be kept for next time. For example "Weekend up north" or "Gym bag".
- Items can be added, edited and removed at any time; the list itself stays.
- **Check all** and **Uncheck all**, mainly to reset the list before the next use.
- Unchecked items are shown first, with a progress bar; each group keeps the list's order.
- **Reorder:** "Change order" switches the list to a mode where items are dragged by a handle (touch, mouse or keyboard). The order is saved for everyone. New items go last.

### List screens

- The title and the manual add field stay at the top, and the AI chat at the bottom; only the list scrolls between them.
- **Adding by hand** (top): one field with an "Add" button. Once a name is typed, a row of small controls opens under it:
  - Shopping: quantity (with − and +), unit, and section (automatic by default).
  - Chores: "today", "tomorrow", another date, a time (once there is a date), and an assignee.
  - Checklists: the name only.
- Decided 2026-11-17, at Tomer's request: adding by hand moved to the top so quantities and details are set while adding, not by editing afterwards, and the bottom is kept for the AI chat.

## Attachments

- Any item can have a note, links, and photos or documents. On the row, a paperclip with the number of attachments (or a note mark), right after the item's name, opens the item's details; items without any reach them from their edit sheet ("פרטים וצירופים").
- The details sheet: the note (saved when leaving the field), links (opened in a new tab), and thumbnails of photos and documents, with buttons to add a link, take a photo, or pick a file.
- Files: photos (JPEG, PNG, WebP, GIF, HEIC), PDF, Word, Excel and plain text, up to 15MB each and 20 attachments per item.
- Storage: a private Vercel Blob store (`weneed-attachments`, Frankfurt). The browser uploads straight to it with a one-time token that only someone who can edit the item gets, under `items/<itemId>/`. Files are served only through `/api/attachments/[id]`, to people who see the list; they never get a public address. Deleting an attachment, an item or a list deletes its files.
- When a shopping round is finished, unbought items carried over to the new round take their note and attachments with them (decided 2026-11-17, at Tomer's request). Bought items keep theirs in the history, read-only.

## AI chat

- The chat is a bar at the bottom of every list, with an AI mark and an example ("מה צריך? למשל: 8 מעדני שוקולד, 4 בננות"). The reply shows above the bar, so the list stays in view. A plain reply is one short line ("הוספתי: ביצים, עגבניות" with "undo") that disappears after 3 seconds (errors after 5). A question about an item already on the list ("להוסיף עוד 2?") opens a card that stays until answered. Decided 2026-11-17, at Tomer's request.
- Each message is read once; there is no chat history yet.
- Limits against abuse: at most 100 messages per user and 2,000 in total in 24 hours.

- Every list has a chat where the user writes what they need, and the AI updates the list.
- Shopping: extracts name, quantity, unit and section per item. For an item already on the list it asks whether to update the quantity (for example "כן, 24 יח׳" or "להשאיר").
- Chores: extracts the title and, when given, the date and time ("tomorrow at 5", "by Friday").
- Checklists: adds the items written, and skips those already on the list.
- Manual adding and editing always remain available, for quick or precise changes.
- Model: Claude (`claude-haiku-5-5`), with structured outputs. The parsing rules come from the bot (`src/lib/ai/list-assistant.ts`).
- Later: editing by chat ("remove the milk", "check the eggs").

## Sign-in

- Two ways in, both by email address. No password.
  - **Sign in with Google:** one tap; Google confirms the address.
  - **Code by email:** a 6-digit code sent through Resend from `noreply@tomergolan.dev`. It is valid for 10 minutes, allows 5 attempts and works once.
- **Open sign-up:** anyone can sign in; a user is created on first sign-in, named after the Google profile (or the address). Users see only the places they belong to.
- Limits against abuse: at most 3 codes per address every 15 minutes, and at most 80 codes a day in total (Resend's free plan sends 100 emails a day). Google sign-in has no limit.
- Users from the bot era (Tomer, Nurit) are linked to their address with `npm run user:link-email -- <email> <phone>`, keeping their places and history.
- The session lasts a long time (a year), so users rarely need to sign in again.
- Decided 2026-11-17, instead of SMS codes to an allowlist: email is free, so there is no cost to protect, and Google makes it one tap.

## Invites

- An admin invites by email address, in two ways:
  - From "חברים במקום" (settings): to the whole place, or to selected lists.
  - From a list's "מי רואה": to this list only. In a personal area this is how a list is shared.
- Someone already in the place is added to the lists right away, without an invite.
- One pending invite per address and place; inviting again widens it. Up to 30 invite emails per admin per day.
- The email (Resend) says who invited and to what, with a "view the invite" button. The link opens `/invites/[id]`, which works only for the invited address after sign-in.
- The invite screen shows the list or place, what the person will see, who is already on the list, and Accept / Decline. Accepting opens the list.
- Pending invites also appear as a banner on the home screen and in the place selector.
- Admins see pending invites on the members screen and can cancel them. Accepted, declined or canceled invites can't be used again.
- Later, maybe: invites through the WhatsApp bot (needs a Meta-approved template).

## Demo

- At `/demo` (and `/en/demo`), open to everyone with no sign-up; linked from the sign-in screen.
- Shows a sample place ("הבית לדוגמה" / "Sample home") with a shopping list, a tasks list (one overdue, one due soon, one with a note and a link) and a checklist, in the page's language.
- Visitors can do everything they can in the app on those lists: add, check, edit, delete, reorder, finish a shopping trip, create, rename and delete lists, and add notes, links and files (decided 2026-11-17).
  - Everything stays in the visitor's browser (localStorage, one copy per language). Files stay only until the page reloads. "Start over" brings back the sample place.
  - No history of finished trips, no members, invites or settings.
- The AI chat works in the demo (decided 2026-11-17), with limits: 10 messages per visitor and 200 for all visitors per day. The server only reads the message and returns what it understood; the browser adds the items, with the same rules as the app (`src/lib/assistant-plan.ts`).
  - For the limits, the database keeps one row per message with a keyed hash of the visitor's IP address (`demo_ai_requests`), never the address or the message.
- Nothing else a demo visitor does reaches the database, and demo visitors never see real places or real data.
- How it is built: the list screens take their actions from a swappable "backend" (`src/components/lists/backend.tsx`): the server actions in the app, a browser store in the demo (`src/components/demo/`).

## Design

- Mobile-first, installable to the home screen (PWA), so it opens like a regular app.
- Visual style influenced by CheckPlease (Tomer's earlier app): similar icon style and the feel of a polished, modern, high-end app. Not a copy, and with a different color palette.
- The design is drafted and approved as a mockup before it is built.
- Hebrew (right to left) and English (left to right), decided 2026-11-17:
  - Hebrew lives at the plain addresses, English under `/en` (for example `/en/lists/…`).
  - A switch on the home, sign-in and privacy screens moves to the same page in the other language. The choice is remembered in a cookie; a first visit follows the browser's language.
  - Sign-in and invite emails go out in the language of the page they were sent from.
  - What people type (list and item names) is shown as written, in any language.
  - The paused WhatsApp bot stays Hebrew only.
- Branding (decided 2026-11-17):
  - Name: **WeNeed**, in English only, everywhere (browser tab, home screen, emails).
  - Slogan: "כל מה שצריך. ביחד."
  - Icon: a green tile with three list rows, the first two checked (`src/app/icon.svg`; PNGs for phones in `public/` and `src/app/apple-icon.png`).
  - Share cover (`public/og.png`, 1200×630): "צריך לקנות… / צריך לעשות… / צריך לארוז…", the slogan, the icon and the name.

## Domain and hosting

- Production address: `weneed.tomergolan.dev`.
- `tomergolan.dev` is registered at Namecheap (already used for CheckPlease). The subdomain is attached to the Vercel project and points to Vercel with a CNAME record at Namecheap.
- Sign-in emails are sent from `tomergolan.dev`, already verified in Resend for CheckPlease.
- Hosting: Vercel. Database: Neon Postgres.

## Architecture and stack

- **Stack:** Next.js (App Router), TypeScript, Tailwind, shadcn/ui, next-intl, Drizzle, Neon, Vercel. Claude API for the AI chat.
- **Data model:**
  - `users` with a unique email address (the phone number stays only for the paused bot). *(Stage B)*
  - `places` (name, icon), and a many-to-many `place_members` table between users and places, with a role (`owner` / `member`). *(Stage B)* A place with `personal_owner_id` is that user's personal area; `place_members.all_lists` is false for someone invited to some lists only. *(Stage E)*
  - `sign_in_codes`: hashed one-time email codes with expiry and attempt count. *(Stage B)*
  - `invites`: place, invited email, invited by, list ids (null for the whole place), status (`pending` / `accepted` / `declined` / `canceled`). *(Stage E)*
  - `lists.visibility` (`place` / `selected`) and `list_members` (list, user): who sees a list beyond the place's admins. *(Stage E)*
  - `lists`: place, kind (`shopping` / `tasks` / `checklist`), name. *(Stage C)*
  - `rounds`: each round of a list (status `active` / `completed`, finished at and by). At most one active round per list; items belong to a round. A chores list keeps one ongoing round. *(Stage C)*
  - `items` have an optional due date and time, used by chores, and a position (their order in the round). *(Stage C)*
  - `ai_requests`: one row per AI chat message, for the daily limits. *(Stage D)*
  - `demo_ai_requests`: one row per demo AI message (a keyed hash of the visitor's IP), for the demo's limits. *(Stage H)*
  - `items.note`, and `attachments`: item, kind (`link` / `file`), the link's address or the file's Blob pathname, name, content type and size, added by. *(Stage F)*
- **Secrets:** only in environment variables; `.env.example` stays up to date.
- **Databases:** production uses the main Neon branch; local development uses a separate Neon branch named `dev`. Migrations are tested on `dev` first and run on production only when a stage is released.

## Development stages

- [x] **Stage A, design:** mockup of the main screens (place selector, the three list kinds, AI chat, invites), approved on 2026-11-16.
  - Mockup: https://claude.ai/artifact/GmZihD6hb1TcGkQeeksQxj
- [ ] **Stage B, places and sign-in:** users, several places per user, place selector, sign-in with Google or an email code, open to everyone.
  - Built and tested on the `dev` database. The existing household moved to a place, its members to users (as owners).
  - Released to production on 2026-11-17: migrations run, Tomer's and Nurit's addresses linked to their bot-era users.
- [ ] **Stage C, lists:** named lists of all three kinds, several per place, in the new design.
  - Shopping: finish shopping and per-list history. Chores: due date and time, due-soon and overdue signs. Checklists: check all / uncheck all.
  - Built and tested on the `dev` database. The existing lists became "קניות" (with its finished rounds as history) and "מטלות".
  - Chores and checklists were moved into this stage on 2026-11-17, before the AI chat, at Tomer's request. Reordering checklists and the two chores sorts were added the same day, also at his request.
  - Released to production on 2026-11-17: the database was backed up, then migrations 0004–0008 were run.
- [ ] **Stage D, AI chat:** chat in every list, reusing the bot's parsing.
  - Built and tested on the `dev` database, with adding by hand moved to the top of the list.
  - Released to production on 2026-11-17: the database was backed up, then migration 0009 was run.
- [ ] **Stage E, personal area, invites and permissions:** "שלי", invite by email to a place or to lists, accept or decline in the app, members and roles, who sees each list.
  - Mockup approved on 2026-11-17 (rows "שלי, הרשאות וצירופים" in the mockup).
  - Built and tested on the `dev` database (migration 0010).
  - Released to production on 2026-11-17: the database was backed up, then migration 0010 was run.
- [x] **Stage F, attachments:** a paperclip on an item opens its details: a note, links, and photos or files (private Vercel Blob storage).
  - Built and tested on the `dev` database (migration 0011). The Blob store was created on 2026-11-17 and connected to all environments.
  - Released to production on 2026-11-17: the database was backed up, then migration 0011 was run.
- [x] **Stage G, branding:** icon, name, slogan, share cover and home-screen install (see "Design").
  - Built on 2026-11-17, together with the wording change from "מטלות" to "משימות".
- [ ] **Stage H, demo and launch:** public demo, `weneed.tomergolan.dev`, real places for Tomer, Tamir and Nurit.
  - English alongside Hebrew: built 2026-11-17.
  - Public demo at `/demo`: built 2026-11-17 (migration 0012).
  - Privacy policy page at `/privacy` (done 2026-11-17, contact tomergolan01@gmail.com). Next: complete Branding in Google Auth Platform and publish the Google app. Until then Google sign-in works only for test users added there (up to 100); the email code works for everyone.

## Open questions

- [x] Demo: editable in the browser, with the AI chat limited (decided 2026-11-17, see "Demo").
- [x] Language: Hebrew and English (decided 2026-11-17, see "Design").
- [x] "Due soon": 24 hours before the due time (decided 2026-11-17; easy to change in `src/lib/due.ts`).
- [ ] Chores: is there an assignee per chore?
- [x] Permissions (Stage E): decided 2026-11-17, see "Users and places".
- [x] Can regular members invite people to lists they see? No, only admins invite (decided 2026-11-17).
- [ ] Leaving a place, and deleting a place: not built yet.

## Future

- Calendar integration for chores.
- Sign in with Facebook. Possible through the existing Meta app, but it needs a published privacy policy and a data deletion URL, and some Facebook accounts have no email address, so it waits for the launch stage.
- The WhatsApp bot as an extra way to add items.

## History

Until 2026-11-16 the product was a WhatsApp bot backed by a small web app. That version was built and tested on a Meta test number (stages 0–5 in the git history): webhook with signature checks, Claude parsing, duplicate questions, list carry-over, chores and reply buttons. It was paused because a chat bot made switching between several places and lists awkward. Its code stays in the repository, disconnected from the new product, and its parsing rules carry over to the AI chat.
