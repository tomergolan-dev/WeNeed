# We Need

Everything a place needs, in one app: shared shopping lists, chores with due dates, and reusable checklists.

Write "need 2 cartons of milk and eggs" in a list's AI chat and the list updates for everyone in the place. A user can belong to several places (an apartment, a home, an office) and switch between them.

- Spec: [docs/spec.md](docs/spec.md)
- Stack: Next.js, TypeScript, Tailwind, shadcn/ui, Drizzle, Neon Postgres, Vercel, Claude API

## Status

New direction (2026-11-16): a multi-place web app with shopping, chores and checklists, plus an AI chat per list. The WhatsApp bot is paused.

- Stage A (design mockup) is in review. Next: Stage B, places and sign-in. See "Development stages" in `docs/spec.md`.
- Production (still the earlier single-household app): https://we-need-two.vercel.app
- Planned address: `weneed.tomergolan.dev`

## Code map

The code below is from the earlier version. It still runs in production and will be reworked stage by stage.

| Path | What it is | State |
| --- | --- | --- |
| `src/app/(app)/`, `src/components/shopping/` | Shopping list, history and settings screens | Active; to be rebuilt in the new design (Stage C) |
| `src/app/(app)/chores/`, `src/components/chores/` | Chores screen | Active; to be rebuilt with due dates (Stage D) |
| `src/app/login/`, `src/lib/login-tokens.ts`, `src/lib/session.ts`, `src/lib/auth.ts` | One-time login links and the session cookie | Active; sign-in moves to phone codes (Stage B) |
| `src/db/schema.ts`, `drizzle/` | Database schema and migrations (households, members, lists, items) | Active; moves to users and places (Stage B) |
| `src/lib/bot/`, `src/lib/whatsapp.ts`, `src/app/api/whatsapp/` | WhatsApp bot | Paused; kept for reuse, each file marked with a header comment |
| `scripts/create-household.ts`, `scripts/login-link.ts` | CLI for creating a household and printing a login link | Active until Stage B replaces households and login links |
| `scripts/eval-parser.mts` | Sample messages for the Claude parser | Active; reused for the AI chat |

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Useful scripts:

- `npm run typecheck`, `npm run lint`, `npm run build`
- `npm run db:generate` / `db:migrate` / `db:push` / `db:studio` (Drizzle Kit)
- `npm run household:create -- "Name" "Member:+972501234567" ...` creates a household with members
- `npm run login-link -- +972501234567` prints a one-time login link (set `APP_URL` for a production link)
- `npm run eval:parser` runs sample messages through the Claude parser (calls the real API, a fraction of a cent per run)
