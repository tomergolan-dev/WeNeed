# We Need — Product Spec

Living version: https://claude.ai/artifact/QaRFVq4Lf37yvamLiHtjBm (this file is a snapshot from 2026-11-14).

## Vision

We Need manages shared shopping and chore lists through a WhatsApp bot. Instead of opening an app, any household member sends the bot a plain-language message, such as "need 2 cartons of milk and eggs", and the shared list updates for everyone.

The problem it solves: when a shopping list lives in a regular chat, items get lost between messages. We Need keeps one organized list, with quantities, grouping by store section and history.

Alongside the bot, a web app shows the up-to-date list, lets members check off completed items and manage the list.

## Users and main scenario

The first users are Tomer and his mom, who manage the weekly shopping for his apartment together. The product supports two or more people per household.

Key requirement: nothing to install and no password to remember. For the user it is just another WhatsApp contact and another link.

A typical week:

1. During the week, Tomer messages the bot whenever something runs out: "out of olive oil", "need 6 yogurts".
2. The bot confirms each addition and includes a link to the list.
3. Mom opens the link at the supermarket and checks off what she bought. The list is grouped by store section.
4. When the shopping is done, someone taps "Finish list", and the list is locked and moved to history.
5. The next message to the bot opens a new list, and the bot asks whether to carry over items that weren't bought.

## MVP features

| Area | What's included |
| --- | --- |
| Household | A shared household with members, identified by phone number |
| Shopping list | Items with quantity and unit, automatic grouping by store section, check-off |
| Chore list | Chores assigned to a person, check-off |
| List lifecycle | One active list per type, manual finish only, locking and history |
| Bot | Free-text adding, duplicate check, "what's on the list?", opening a new list and carrying items over |
| Web | View, check off, edit, "Finish list" button, history |

Out of scope for the MVP:

- Proactive notifications: the bot only replies to messages and never messages first.
- A bot inside a WhatsApp group: Meta's Groups API is open only to Official Business Accounts (OBA).
- Recurring chores and reminders.
- Voice messages and images.

## Bot flows

The bot identifies the sender by phone number, and Claude classifies each message into one intent. Any question the bot asks is stored as `pending_action` on the member, so the next reply is understood in context. The bot talks to users in Hebrew; the examples below are translated.

### Adding items

- User: "need 2 cartons of milk and eggs"
- Bot: "Added ✅ milk ×2 cartons, eggs" + a link to the list

Claude extracts a name, quantity, unit and category for each item.

### Item already on the list

The bot doesn't merge silently; it asks first:

- User: "need milk"
- Bot: "Milk is already on the list (2 cartons). Add 1 more, making it 3?"
- User: "yes" → quantity updates to 3. "no" → nothing changes.

If the same message also has new items, they are added right away, and only the duplicates wait for confirmation.

### What's on the list?

The bot returns the unchecked items grouped by store section, plus a link to the web app.

### No active list

After a list is finished, the next message starts this flow:

- Bot: "There's no active list. Open a new one? 3 items weren't bought (cheese, oil, toilet paper). Carry them over?"
- Possible replies: "yes", "no", "just the cheese".
- After the reply a new list opens, and the items from the original message are added to it.

### Chores

- User: "Tomer needs to fix the bathroom faucet"
- Bot: "Added to chores ✅ fix the bathroom faucet (Tomer)"

A chore with no name stays unassigned.

### Logging in to the web app

"Send me a link" (or any reply that includes a link) returns a personal one-time link that logs the user in to the app.

### Unknown sender and non-text messages

- A number that isn't a member gets a short reply saying it isn't registered.
- Non-text messages (voice, images) get a reply that only text is supported.

## Web app

The web app is a mobile-first PWA in Hebrew with RTL, reached from a link the bot sends.

| Screen | What users do there |
| --- | --- |
| Shopping list | Items grouped by store section, check off, edit quantity, delete, "Finish list" button with confirmation |
| Chores | Chores with the assignee's name, "Mine" filter, check off |
| History | Finished lists, read-only |
| Household settings | Members and phone numbers, add a member |

- **Login:** a one-time link from the bot that creates a cookie session. No password and no Google.
  - The link opens a page with a "Log in" button; the token is consumed only when the button is pressed (POST), so WhatsApp link previews, which fetch the page, can't use it up.
  - Links are valid for 24 hours and work once. The session cookie is signed with `SESSION_SECRET` and lasts a year.
  - Until the bot exists (Stage 2), households are created and links generated with CLI scripts (`npm run household:create`, `npm run login-link`).
- **Store sections:** a fixed list of categories in store walking order (`src/lib/categories.ts`). On the web the section is picked manually; from Stage 3 Claude picks it.
- **No active list:** the shopping screen offers to open a new list and, if the last finished list has unbought items, to carry them over.
- **Updates:** polling every few seconds while the screen is open. Move to real-time only if needed.
- **Locked list:** once finished, it is read-only in both the web app and the bot.

## Data model

Six tables in Postgres via Drizzle. The core rule: each household has at most one active list of each type, enforced by a partial unique index.

| Table | Main fields |
| --- | --- |
| `households` | `id`, `name`, `created_at` |
| `members` | `id`, `household_id`, `name`, `phone` (unique, E.164 format), `pending_action` (JSON), `created_at` |
| `lists` | `id`, `household_id`, `type` (`shopping` / `tasks`), `status` (`active` / `completed`), `created_at`, `completed_at`, `completed_by` |
| `items` | `id`, `list_id`, `name`, `quantity`, `unit`, `category`, `assignee_id`, `done`, `done_by`, `done_at`, `added_by`, `created_at` |
| `processed_messages` | `wa_message_id` (key), `received_at`. Prevents double handling when Meta resends a message |
| `login_tokens` | `token_hash`, `member_id`, `expires_at`, `used_at` |

- Duplicate detection runs on a normalized name (no extra spaces or niqqud). Cases like singular vs. plural are left to Claude, which receives the names of existing items.
- Carrying items over to a new list creates new rows; the locked list stays as it was.

## Architecture and stack

A single Next.js app on Vercel, on the same stack as CheckPlease, serves both the bot and the web app.

```
WhatsApp (users) <-> Meta Cloud API <-> Next.js webhook <-> Claude API
                                              |
Web app (PWA) <------------------------> Postgres (Neon)
```

The bot and the web app read and write the same database, so any change in one shows up immediately in the other.

- **Stack:** Next.js (App Router), TypeScript, Tailwind, shadcn/ui, next-intl, Drizzle, Neon, Vercel.
- **Webhook:** at `/api/whatsapp/webhook`. GET handles Meta's verification; POST receives messages, checks the signature (`X-Hub-Signature-256`), returns 200 right away and continues processing via `after()`.
- **Claude:** tool use with a fixed schema that returns an intent and items. It receives the active list and the members' names, to detect duplicates and assign chores.
- **Secrets:** Meta and Anthropic keys live only in environment variables and never go into Git.
- **Meta setup notes:**
  - The access token belongs to a System User (`weneed-bot`) in the business portfolio, with full control of the app and the WhatsApp account; it does not expire. Temporary tokens from API Setup expire within hours.
  - The WhatsApp Business Account must be subscribed to the app (`POST /{waba-id}/subscribed_apps`), otherwise Meta doesn't deliver messages to the webhook even when it is verified.
  - While on the test number, the bot can only message up to 5 pre-approved numbers.

## Development stages

- [x] **Stage 0, setup:** private GitHub repo, Next.js project, Neon database, an app in Meta for Developers with a test number.
- [x] **Stage 1, web without the bot:** schema, shared list with manual adding, check-off and finishing a list.
- [x] **Stage 2, WhatsApp connection:** webhook with signature verification, duplicate prevention and a "got it" reply.
- [ ] **Stage 3, natural language:** Claude parses messages, adding with categories, "what's on the list?".
- [ ] **Stage 4, duplicates and lifecycle:** confirmation question for existing items, opening a new list and carrying items over.
- [ ] **Stage 5, chores:** chore list with assignees, in the bot and the web app.
- [ ] **Stage 6, go live:** real phone number, deploy to Vercel, onboarding mom.

## Open questions

- [ ] Phone number for the bot in stage 6: physical SIM or virtual number?
- [ ] Cost: check Meta's official pricing for what bot replies cost since the pricing change on October 1, 2026.
- [ ] Domain: buy one, or use the Vercel address at first?
- [ ] Deleting an item through the bot ("remove the milk"): in the MVP, or web only?
