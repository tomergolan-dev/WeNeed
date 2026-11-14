# We Need

Shared shopping and chore lists, managed through a WhatsApp bot.

Send the bot a message like "need 2 cartons of milk and eggs" and the shared list updates for everyone in the household. A web app shows the live list, lets you check items off and finish the list when the shopping is done.

- Spec: [docs/spec.md](docs/spec.md)
- Stack: Next.js, TypeScript, Tailwind, shadcn/ui, Drizzle, Neon Postgres, Vercel, WhatsApp Cloud API, Claude API

## Status

Stage 0 — setup.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Useful scripts:

- `npm run typecheck`, `npm run lint`, `npm run build`
- `npm run db:generate` / `db:migrate` / `db:push` / `db:studio` (Drizzle Kit)
