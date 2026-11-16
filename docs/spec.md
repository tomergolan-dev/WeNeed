# We Need — Product Spec

Last updated: 2026-11-16. This version replaces the WhatsApp-bot spec (see "History" at the end).

## Vision

Everything a group of people "needs" in one place: things to buy, chores to get done, things to pack for a weekend away. We Need is a mobile-first web app where each **place** (an apartment, a home, an office, a restaurant) keeps shared lists, and an AI chat in every list turns a plain sentence ("need 2 cartons of milk and eggs") into list items.

The name is the product: everything in it is something "we need" to buy, to do, or to take.

We Need is also a portfolio project, so it includes a public demo.

## Users and places

- A **user** signs in with a mobile phone number.
- A **place** is a shared space with members, for example "Parents' home", "My apartment", "Office", "Restaurant".
- A user can belong to several places and switches between them from a selector at the top of the screen.
- Any user can create a new place and invite others to it (see "Invites").
- Every member of a place can view and edit all of its lists.
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

- Lists can be renamed and deleted by members.

### Shopping lists

- Items have a name, quantity, unit and store section (category), and are grouped by section in store walking order.
- Check-off while shopping; checked items move to an "in the cart" section.
- **Finish:** locks the current round and moves it to the list's history. The next round can carry over unbought items.
- Item rules (from the bot era, kept for the AI chat):
  - Product names are kept exactly as written: no spelling fixes, no expanding slang ("גבנצ" stays "גבנצ").
  - A number with x or × ("x18", "18x") is a count of units.
  - A count without a unit is shown as "18 יח׳".
  - Adding an item that is already on the list asks whether to increase its quantity instead of adding a duplicate.

### Chores

- A chore has a title and optional **due date** and **due time**.
- Status signs, like traffic signs:
  - **Due soon:** a yellow warning sign ⚠️.
  - **Overdue:** a red sign ⛔.
  - A chore with a date and no time is due at the end of that day.
- Check-off marks a chore as done.
- Later: calendar integration (see "Future").

### Checklists

- For example "Weekend up north" or "Gym bag".
- Items can be added, edited and removed at any time; the list itself stays.
- **Check all** and **Uncheck all**, mainly to reset the list before the next use.

## AI chat

- Every list has a chat where the user writes what they need, and the AI updates the list.
- Shopping: extracts name, quantity, unit and section per item, and handles items already on the list.
- Chores: extracts the title and, when given, the date and time ("tomorrow at 5", "by Friday").
- Checklists: adds the items written.
- Manual adding and editing always remain available, for quick or precise changes.
- Model: Claude (`claude-haiku-5-5`), with structured outputs. The parsing rules and sample-message tests from the bot carry over (`npm run eval:parser`).

## Sign-in

- Sign-in with a mobile phone number and a one-time code. No password.
- **Only allowed numbers can sign in.** Codes are sent only to phone numbers on an allowlist that Tomer manages. Any other number is refused without sending anything, so strangers can't run up messaging costs.
- The session lasts a long time (a year), so users rarely need to sign in again.
- The code is delivered by SMS, or by the WhatsApp bot (see "Open questions").

## Invites

- A member of a place invites someone by phone number (for example a partner or a colleague).
- The invited person gets an invitation saying who invited them and to which place, with two actions:
  - **"Accept in the app"**: a button with a hidden link (no raw URL shown) that opens the app.
  - **"Decline"**.
- Delivery:
  - In the app: pending invites appear for the invited phone number after sign-in, with Accept and Decline.
  - Optionally through the WhatsApp bot. A bot message to someone who hasn't written to it in the last 24 hours must use a template approved by Meta; templates support a link button and a quick-reply button together.
- Declined or accepted invites can't be used again.

## Demo

- Open to everyone from the start screen, with no sign-up.
- Shows a sample place with ready-made lists of all three kinds.
- Nothing a demo visitor does is saved to the database. Changes, if allowed at all, stay in the visitor's browser only.
- Demo visitors never see real places or real data.

## Design

- Mobile-first, installable to the home screen (PWA), so it opens like a regular app.
- Visual style influenced by CheckPlease (Tomer's earlier app): similar icon style and the feel of a polished, modern, high-end app. Not a copy, and with a different color palette.
- The design is drafted and approved as a mockup before it is built.
- Hebrew with RTL.

## Domain and hosting

- Production address: `weneed.tomergolan.dev`.
- `tomergolan.dev` is registered at Namecheap (already used for CheckPlease). The subdomain points to Vercel with a DNS record at Namecheap.
- Hosting: Vercel. Database: Neon Postgres.

## Architecture and stack

- **Stack:** Next.js (App Router), TypeScript, Tailwind, shadcn/ui, next-intl, Drizzle, Neon, Vercel. Claude API for the AI chat.
- **Data model (to be detailed in the build stage):**
  - `users` with a unique phone number.
  - `places`, and a many-to-many `place_members` table between users and places.
  - `allowed_phones`: the sign-in allowlist.
  - `invites`: place, invited phone, invited by, status (`pending` / `accepted` / `declined`).
  - `lists`: place, kind (`shopping` / `chores` / `checklist`), name.
  - Shopping rounds: each round of a shopping list keeps its own items, status and finish time, for history.
  - `items` gain an optional due date and time for chores.
- **Secrets:** only in environment variables; `.env.example` stays up to date.

## Development stages

- [ ] **Stage A, design:** mockup of the main screens (place selector, the three list kinds, AI chat, invites), approved before building.
- [ ] **Stage B, places and sign-in:** users, several places per user, place selector, phone sign-in with a code for allowed numbers.
- [ ] **Stage C, lists:** creating named lists of any kind; shopping lists in the new design, with finish and history.
- [ ] **Stage D, chores:** due date and time, due-soon and overdue signs.
- [ ] **Stage E, checklists:** check all / uncheck all.
- [ ] **Stage F, invites:** invite by phone, accept or decline in the app.
- [ ] **Stage G, AI chat:** chat in every list, reusing the bot's parsing.
- [ ] **Stage H, demo and launch:** public demo, `weneed.tomergolan.dev`, real places for Tomer, Tamir and Nurit.

## Open questions

- [ ] Sign-in code delivery: SMS (which provider, cost per message to Israel), or the WhatsApp bot (needs a real bot number and Meta approval)?
- [ ] Invites through the WhatsApp bot: in the first version, or later?
- [ ] Does inviting a phone number add it to the sign-in allowlist automatically, or does Tomer approve each new number?
- [ ] Demo: view-only, or editable in the browser without saving? Does the AI chat work in the demo, and with what limit?
- [ ] Language: Hebrew only, or English too (useful for portfolio visitors)?
- [ ] "Due soon": how long before the due time does the yellow sign appear?
- [ ] Chores: is there an assignee per chore?

## Future

- Calendar integration for chores.
- The WhatsApp bot as an extra way to add items.

## History

Until 2026-11-16 the product was a WhatsApp bot backed by a small web app. That version was built and tested on a Meta test number (stages 0–5 in the git history): webhook with signature checks, Claude parsing, duplicate questions, list carry-over, chores and reply buttons. It was paused because a chat bot made switching between several places and lists awkward. Its code stays in the repository, disconnected from the new product, and its parsing rules carry over to the AI chat.
