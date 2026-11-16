# We Need

Everything a place needs, in one app: shared shopping lists, chores with due dates, and reusable checklists.

Write "need 2 cartons of milk and eggs" in a list's AI chat and the list updates for everyone in the place. A user can belong to several places (an apartment, a home, an office) and switch between them.

- Spec: [docs/spec.md](docs/spec.md)
- Stack: Next.js, TypeScript, Tailwind, shadcn/ui, Drizzle, Neon Postgres, Vercel, Claude API

## Status

New direction (2026-11-16): a multi-place web app with shopping, chores and checklists, plus an AI chat per list. The WhatsApp bot is paused. Next: Stage A, design mockup. See `docs/spec.md`.

Production: https://we-need-two.vercel.app

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
- `npm run eval:parser` runs sample WhatsApp messages through the Claude parser (calls the real API)
