# We Need

Shared shopping and chore lists managed through a WhatsApp bot, with a web app for viewing and checking off items. The full spec is in `docs/spec.md` — read it before starting any task.

## Language

- Talk to me (Tomer) in Hebrew in chat.
- Everything written into the repo is in English: code, comments, commit messages, docs, specs, README, PR descriptions.
- Exception: user-facing UI strings and bot replies are in Hebrew, and they live in the next-intl message files, not hard-coded.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind + shadcn/ui
- next-intl (Hebrew, RTL)
- Drizzle ORM + Neon Postgres
- WhatsApp Cloud API (Meta) for the bot
- Claude API for parsing free-text messages
- Hosted on Vercel

## Rules

- Secrets only in environment variables. Never commit `.env` files; keep `.env.example` up to date.
- Work stage by stage, following "Development stages" in `docs/spec.md`.
- When a decision changes the spec, update `docs/spec.md` in the same commit.
