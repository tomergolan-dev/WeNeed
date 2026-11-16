# We Need — Product Spec

Last updated: 2026-11-16. This version replaces the WhatsApp-bot spec (see "History" at the end).

## Vision

Everything a group of people "needs" in one place: things to buy, chores to get done, things to pack for a weekend away. We Need is a mobile-first web app where each **place** (an apartment, a home, an office, a restaurant) keeps shared lists, and an AI chat in every list turns a plain sentence ("need 2 cartons of milk and eggs") into list items.

The name is the product: everything in it is something "we need" to buy, to do, or to take.

We Need is also a portfolio project, so it includes a public demo.

## Users and places

- A **user** signs in with an email address (Google, or a code sent by email).
- A **place** is a shared space with members, for example "Parents' home", "My apartment", "Office", "Restaurant".
- A user can belong to several places and switches between them from a selector at the top of the screen.
- Any user can create a new place, with a name and an icon (home, apartment, office, restaurant, store, vacation), and invite others to it (see "Invites").
- The creator of a place is its owner. In the first version owners and members have the same rights; the role is kept for later.
- The chosen place is remembered on the device. A user with no places is taken to "create your first place".
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

- Two ways in, both by email address. No password.
  - **Sign in with Google:** one tap; Google confirms the address.
  - **Code by email:** a 6-digit code sent through Resend from `noreply@tomergolan.dev`. It is valid for 10 minutes, allows 5 attempts and works once.
- **Open sign-up:** anyone can sign in; a user is created on first sign-in, named after the Google profile (or the address). Users see only the places they belong to.
- Limits against abuse: at most 3 codes per address every 15 minutes, and at most 80 codes a day in total (Resend's free plan sends 100 emails a day). Google sign-in has no limit.
- Users from the bot era (Tomer, Nurit) are linked to their address with `npm run user:link-email -- <email> <phone>`, keeping their places and history.
- The session lasts a long time (a year), so users rarely need to sign in again.
- Decided 2026-11-17, instead of SMS codes to an allowlist: email is free, so there is no cost to protect, and Google makes it one tap.

## Invites

- A member of a place invites someone by email address (for example a partner or a colleague).
- The invited person gets an invitation saying who invited them and to which place, with two actions:
  - **"Accept in the app"**: a button with a hidden link (no raw URL shown) that opens the app.
  - **"Decline"**.
- Delivery:
  - In the app: pending invites appear for the invited address after sign-in, with Accept and Decline.
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
- `tomergolan.dev` is registered at Namecheap (already used for CheckPlease). The subdomain is attached to the Vercel project and points to Vercel with a CNAME record at Namecheap.
- Sign-in emails are sent from `tomergolan.dev`, already verified in Resend for CheckPlease.
- Hosting: Vercel. Database: Neon Postgres.

## Architecture and stack

- **Stack:** Next.js (App Router), TypeScript, Tailwind, shadcn/ui, next-intl, Drizzle, Neon, Vercel. Claude API for the AI chat.
- **Data model:**
  - `users` with a unique email address (the phone number stays only for the paused bot). *(Stage B)*
  - `places` (name, icon), and a many-to-many `place_members` table between users and places, with a role (`owner` / `member`). *(Stage B)*
  - `sign_in_codes`: hashed one-time email codes with expiry and attempt count. *(Stage B)*
  - `invites`: place, invited email, invited by, status (`pending` / `accepted` / `declined`).
  - `lists`: place, kind (`shopping` / `chores` / `checklist`), name.
  - Shopping rounds: each round of a shopping list keeps its own items, status and finish time, for history.
  - `items` gain an optional due date and time for chores.
- **Secrets:** only in environment variables; `.env.example` stays up to date.
- **Databases:** production uses the main Neon branch; local development uses a separate Neon branch named `dev`. Migrations are tested on `dev` first and run on production only when a stage is released.

## Development stages

- [x] **Stage A, design:** mockup of the main screens (place selector, the three list kinds, AI chat, invites), approved on 2026-11-16.
  - Mockup: https://claude.ai/artifact/GmZihD6hb1TcGkQeeksQxj
- [ ] **Stage B, places and sign-in:** users, several places per user, place selector, sign-in with Google or an email code, open to everyone.
  - Built and tested on the `dev` database. The existing household moved to a place, its members to users (as owners).
  - Released to production on 2026-11-17: migrations run, Tomer's and Nurit's addresses linked to their bot-era users.
- [ ] **Stage C, lists:** creating named lists of any kind; shopping lists in the new design, with finish and history.
- [ ] **Stage D, chores:** due date and time, due-soon and overdue signs.
- [ ] **Stage E, checklists:** check all / uncheck all.
- [ ] **Stage F, invites:** invite by email, accept or decline in the app.
- [ ] **Stage G, AI chat:** chat in every list, reusing the bot's parsing.
- [ ] **Stage H, demo and launch:** public demo, `weneed.tomergolan.dev`, real places for Tomer, Tamir and Nurit.
  - Privacy policy page at `/privacy` (done 2026-11-17, contact tomergolan01@gmail.com). Next: complete Branding in Google Auth Platform and publish the Google app. Until then Google sign-in works only for test users added there (up to 100); the email code works for everyone.

## Open questions

- [ ] Invites through the WhatsApp bot: in the first version, or later?
- [ ] Demo: view-only, or editable in the browser without saving? Does the AI chat work in the demo, and with what limit?
- [ ] Language: Hebrew only, or English too (useful for portfolio visitors)?
- [ ] "Due soon": how long before the due time does the yellow sign appear?
- [ ] Chores: is there an assignee per chore?

## Future

- Calendar integration for chores.
- Sign in with Facebook. Possible through the existing Meta app, but it needs a published privacy policy and a data deletion URL, and some Facebook accounts have no email address, so it waits for the launch stage.
- The WhatsApp bot as an extra way to add items.

## History

Until 2026-11-16 the product was a WhatsApp bot backed by a small web app. That version was built and tested on a Meta test number (stages 0–5 in the git history): webhook with signature checks, Claude parsing, duplicate questions, list carry-over, chores and reply buttons. It was paused because a chat bot made switching between several places and lists awkward. Its code stays in the repository, disconnected from the new product, and its parsing rules carry over to the AI chat.
