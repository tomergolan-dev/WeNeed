# We Need

Everything a place needs, in one app: shared shopping lists, chores with due dates, and reusable checklists.

Write "need 2 cartons of milk and eggs" in a list's AI chat and the list updates for everyone in the place. A user can belong to several places (an apartment, a home, an office) and switch between them.

- Spec: [docs/spec.md](docs/spec.md)
- Stack: Next.js, TypeScript, Tailwind, shadcn/ui, Drizzle, Neon Postgres, Vercel, Claude API

## Status

New direction (2026-11-16): a multi-place web app with shopping, chores and checklists, plus an AI chat per list. The WhatsApp bot is paused.

- Stage A (design) is approved. Stages B (places, and sign-in with Google or an email code), C (lists of all three kinds: shopping, chores, checklists) and D (the AI chat in every list) are live. Next: invites. See "Development stages" in `docs/spec.md`.
- Production: https://weneed.tomergolan.dev

## Code map

| Path | What it is | State |
| --- | --- | --- |
| `src/app/login/`, `src/app/api/auth/google/`, `src/lib/sign-in.ts`, `src/lib/sign-in-delivery.ts`, `src/lib/google.ts`, `src/lib/email.ts` | Sign-in with Google or a one-time email code (Resend); open sign-up with rate limits | Active (Stage B) |
| `src/lib/session.ts`, `src/lib/auth.ts` | Session cookie, current user and current place | Active (Stage B) |
| `src/app/privacy/` | Public privacy policy, linked from the login page and Google's consent screen | Active |
| `src/app/places/`, `src/components/places/`, `src/lib/place-icons.ts` | Place selector sheet and the create/edit place form | Active (Stage B) |
| `src/db/schema.ts`, `drizzle/` | Database schema and migrations (users, places, lists, rounds, items) | Active |
| `src/app/(app)/page.tsx`, `src/app/(app)/lists/`, `src/components/lists/`, `src/lib/lists.ts`, `src/lib/list-kinds.ts` | Home screen with the place's lists; a list screen per kind, the list menu, choosing a kind | Active (Stage C) |
| `src/components/shopping/`, `src/components/chores/`, `src/components/checklist/`, `src/lib/due.ts` | Shopping (finish and history), chores (due dates and signs) and checklists | Active (Stage C) |
| `src/components/lists/assistant-bar.tsx`, `src/components/lists/quick-add.tsx`, `src/app/assistant-actions.ts`, `src/lib/ai/` | The AI chat at the bottom of a list, and adding by hand at the top | Active (Stage D) |
| `src/app/(app)/settings/` | Place settings and members | Active (Stage B) |
| `src/lib/bot/`, `src/lib/whatsapp.ts`, `src/app/api/whatsapp/` | WhatsApp bot | Paused; kept for reuse, each file marked with a header comment |
| `scripts/link-email.ts` | CLI that links an email to a user from the bot era | Active until Tomer and Nurit are linked in production |
| `scripts/eval-parser.mts` | Sample messages for the bot's Claude parser | Paused with the bot |

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values; use the Neon "dev" branch
npm run db:migrate
npm run dev                  # without RESEND_API_KEY, the sign-in code is printed in this terminal
```

Useful scripts:

- `npm run typecheck`, `npm run lint`, `npm run build`
- `npm run db:generate` / `db:migrate` / `db:push` / `db:studio` (Drizzle Kit)
- `npm run user:link-email -- name@gmail.com +972501234567` links an email to a user from the bot era
- `npm run eval:parser` runs sample messages through the paused bot's Claude parser (calls the real API, a fraction of a cent per run)
