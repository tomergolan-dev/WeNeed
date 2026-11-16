# We Need

Shared shopping and chore lists, managed through a WhatsApp bot.

Send the bot a message like "need 2 cartons of milk and eggs" and the shared list updates for everyone in the household. A web app shows the live list, lets you check items off and finish the list when the shopping is done.

- Spec: [docs/spec.md](docs/spec.md)
- Stack: Next.js, TypeScript, Tailwind, shadcn/ui, Drizzle, Neon Postgres, Vercel, WhatsApp Cloud API, Claude API

## Status

Stage 4 — duplicate confirmation and new-list carry-over in the bot. Next: Stage 5, chores.

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
