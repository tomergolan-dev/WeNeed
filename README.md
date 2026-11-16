# We Need

Everything a place needs, in one app: shared shopping lists, chores with due dates, and reusable checklists.

Write "need 2 cartons of milk and eggs" in a list's AI chat and the list updates for everyone in the place. A user can belong to several places (an apartment, a home, an office) and switch between them.

- Spec: [docs/spec.md](docs/spec.md)
- Stack: Next.js, TypeScript, Tailwind, shadcn/ui, Drizzle, Neon Postgres, Vercel, Claude API

## Status

New direction (2026-11-16): a multi-place web app with shopping, chores and checklists, plus an AI chat per list. The WhatsApp bot is paused.

- Stage A (design) is approved. Stage B (places and phone sign-in) is built on the `dev` database and waits for a code delivery channel before release. See "Development stages" in `docs/spec.md`.
- Production (still the earlier single-household app, until Stage B is released): https://we-need-two.vercel.app
- Planned address: `weneed.tomergolan.dev`

## Code map

| Path | What it is | State |
| --- | --- | --- |
| `src/app/login/`, `src/lib/sign-in.ts`, `src/lib/sign-in-delivery.ts`, `src/lib/phone.ts` | Phone sign-in with a one-time code, allowlist only | Active (Stage B); delivery logs the code in development until a channel is chosen |
| `src/lib/session.ts`, `src/lib/auth.ts` | Session cookie, current user and current place | Active (Stage B) |
| `src/app/places/`, `src/components/places/`, `src/lib/place-icons.ts` | Place selector sheet and the create/edit place form | Active (Stage B) |
| `src/db/schema.ts`, `drizzle/` | Database schema and migrations (users, places, lists, items) | Active |
| `src/app/(app)/`, `src/components/shopping/` | Shopping list, history and settings screens | Active; the lists are rebuilt in the new design in Stage C |
| `src/app/(app)/chores/`, `src/components/chores/` | Chores screen | Active; to be rebuilt with due dates (Stage D) |
| `src/lib/bot/`, `src/lib/whatsapp.ts`, `src/app/api/whatsapp/` | WhatsApp bot | Paused; kept for reuse, each file marked with a header comment |
| `scripts/allow-phone.ts` | CLI for the sign-in allowlist | Active |
| `scripts/eval-parser.mts` | Sample messages for the Claude parser | Active; reused for the AI chat |

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values; use the Neon "dev" branch
npm run db:migrate
npm run phone:allow -- 050-1234567 "Your name"
npm run dev                  # the sign-in code is printed in this terminal
```

Useful scripts:

- `npm run typecheck`, `npm run lint`, `npm run build`
- `npm run db:generate` / `db:migrate` / `db:push` / `db:studio` (Drizzle Kit)
- `npm run phone:allow -- 050-1234567 "Name"` allows a number to sign in (`--remove 050-...`, `--list`)
- `npm run eval:parser` runs sample messages through the Claude parser (calls the real API, a fraction of a cent per run)
