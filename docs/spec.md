# We Need — Product Spec

Last updated: 2026-11-16. This version replaces the WhatsApp-bot spec (see "History" at the end).

## Vision

Everything a household "needs" in one place: things to buy at the supermarket, chores to get done, things to pack for a weekend away. We Need is a mobile-first web app where each household keeps shared lists, and an AI chat in every list turns a plain sentence ("need 2 cartons of milk and eggs") into list items.

The name is the product: everything in it is something "we need" to buy, to do, or to take.

We Need is also a portfolio project, so it includes a demo household that anyone can try.

## Users and households

- A **user** signs in with a mobile phone number.
- A **household** is a shared space with members, for example "Parents' home", "My apartment", "Office".
- A user can belong to several households and switches between them from a selector at the top of the screen.
- Every member of a household can view and edit all of its lists.
- First real households:
  - "הדירה של תומר ותמיר": Tomer, Tamir and Nurit (Tomer's mom).
  - "בית משפחת גולן": Nurit.

## Lists

Each household has lists of three kinds.

| Kind | Purpose | Lifecycle |
| --- | --- | --- |
| 🛒 Shopping | Things to buy | One active list at a time; finishing it locks it and moves it to history |
| ✅ Chores | Things to do, optionally by a date and time | One ongoing list per household; done chores fade out |
| 📋 Other | A reusable checklist, e.g. "Weekend up north" | Permanent; never finished or deleted automatically |

### Shopping list

- Items have a name, quantity, unit and store section (category), and are grouped by section in store walking order.
- Check-off while shopping; checked items move to an "in the cart" section.
- **Finish list:** locks the list and moves it to history. The next list can carry over unbought items.
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

### Other lists (checklists)

- Created by users with any name, for example "Weekend up north" or "Gym bag". A household can have several.
- Items can be added, edited and removed at any time; the list stays.
- **Check all** and **Uncheck all**, mainly to reset the list before the next use.

## AI chat

- Every list has a chat where the user writes what they need, and the AI updates the list.
- Shopping: extracts name, quantity, unit and section per item, and handles items already on the list.
- Chores: extracts the title and, when given, the date and time ("tomorrow at 5", "by Friday").
- Other lists: adds the items written.
- Manual adding and editing always remain available, for quick or precise changes.
- Model: Claude (`claude-haiku-5-5`), with structured outputs. The parsing rules and sample-message tests from the bot carry over (`npm run eval:parser`).

## Sign-in

- Sign-in with a mobile phone number and a one-time code sent by SMS. No password.
- The session lasts a long time (a year), so users rarely need to sign in again.
- **Invites:** a member invites someone to a household with a link they share however they like, for example in WhatsApp. The invited person signs in with their phone and joins the household.
- The SMS provider is still open (see "Open questions").

## Demo

- A "Try the demo" entry on the sign-in screen opens a sample household with ready-made lists of all three kinds, without signing in.
- Demo visitors never see real households or real data.

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
  - `users` with a unique phone number, and a many-to-many `household_members` table between users and households.
  - `lists` with a kind (`shopping` / `chores` / `checklist`) and a name; shopping lists keep their `active` / `completed` status and history.
  - `items` gain an optional due date and time for chores.
- **Secrets:** only in environment variables; `.env.example` stays up to date.

## Development stages

- [ ] **Stage A, design:** mockup of the main screens (household selector, the three list kinds, AI chat), approved before building.
- [ ] **Stage B, households and sign-in:** users, several households per user, household selector, phone sign-in with SMS code, invite links.
- [ ] **Stage C, shopping list:** rebuilt in the new design, including finish and history.
- [ ] **Stage D, chores:** due date and time, due-soon and overdue signs.
- [ ] **Stage E, other lists:** create named checklists, check all / uncheck all.
- [ ] **Stage F, AI chat:** chat in every list, reusing the bot's parsing.
- [ ] **Stage G, demo and launch:** demo household, `weneed.tomergolan.dev`, real households for Tomer, Tamir and Nurit.

## Open questions

- [ ] SMS provider for sign-in codes, and its cost per message to Israel.
- [ ] Who can sign up: anyone (portfolio), or only invited phone numbers (fewer SMS costs and less abuse)?
- [ ] Demo: one shared demo household, or a private copy per visitor that is deleted after a day? And a limit on AI chat messages in the demo.
- [ ] Language: Hebrew only, or English too (useful for portfolio visitors)?
- [ ] "Due soon": how long before the due time does the yellow sign appear?
- [ ] Chores: is there an assignee per chore?

## Future

- Calendar integration for chores.
- Reconnecting the WhatsApp bot as an extra way to add items.

## History

Until 2026-11-16 the product was a WhatsApp bot backed by a small web app. That version was built and tested on a Meta test number (stages 0–5 in the git history): webhook with signature checks, Claude parsing, duplicate questions, list carry-over, chores and reply buttons. It was paused because a chat bot made switching between several households and lists awkward. Its code stays in the repository, disconnected from the new product, and its parsing rules carry over to the AI chat.
