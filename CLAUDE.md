# We Need

A mobile-first web app for everything a household "needs": shared shopping lists, chores with due dates, and reusable checklists, with an AI chat in every list. Users can belong to several households. The full spec is in `docs/spec.md` — read it before starting any task.

## Language

- Talk to me (Tomer) in Hebrew in chat.
- Everything written into the repo is in English: code, comments, commit messages, docs, specs, README, PR descriptions.
- Exception: user-facing UI strings (and AI chat replies) are in Hebrew, and they live in the next-intl message files, not hard-coded.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind + shadcn/ui
- next-intl (Hebrew, RTL)
- Drizzle ORM + Neon Postgres
- Claude API for the AI chat in each list
- WhatsApp bot code (Meta Cloud API) is paused and disconnected; see "History" in the spec
- Hosted on Vercel

## Rules

- Secrets only in environment variables. Never commit `.env` files; keep `.env.example` up to date.
- Work stage by stage, following "Development stages" in `docs/spec.md`.
- When a decision changes the spec, update `docs/spec.md` in the same commit.
