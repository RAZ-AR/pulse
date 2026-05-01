# PULSE Backend

PULSE is a next-generation loyalty platform where venues publicly compete on their points exchange rate to attract customers. Users earn points anywhere (via receipt scan) or at partner venues (10× better rate), and spend them only at partners.

This monorepo contains the **API** (tRPC, for the mobile app) and the **Merchant Web App** (Next.js dashboard for venue owners).

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router |
| API | tRPC v11 |
| Auth | NextAuth v5 (Auth.js) |
| ORM | Prisma + PostgreSQL |
| Database | Supabase (Postgres + Storage) |
| Cache / Cron | Upstash Redis + QStash |
| OCR | Google Vision (free) → GPT-4o (paid) |
| AI verification | Anthropic Claude Sonnet |
| i18n | next-intl (EN / RU / SR) |
| Styling | Tailwind CSS |
| Monorepo | pnpm workspaces + Turborepo |

---

## Project structure

```
pulse-backend/
├── apps/
│   ├── api/          # Next.js — tRPC handler for mobile app (port 3000)
│   └── merchant/     # Next.js — Merchant Web App (port 3001)
├── packages/
│   ├── db/           # Prisma schema + client singleton
│   ├── trpc/         # tRPC routers (shared between both apps)
│   ├── auth/         # NextAuth configs (user: magic link, merchant: credentials)
│   ├── i18n/         # Translations EN / RU / SR
│   ├── shared/       # Constants, types, utilities
│   └── jobs/         # Cron handlers (expire points)
├── .env.example
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Setup

### 1. Clone and install

```bash
git clone <repo>
cd pulse-backend
pnpm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Settings → Database → Connection string
   - Copy **Transaction pooler** URL → `DATABASE_URL`
   - Copy **Session pooler** URL → `DIRECT_URL`
3. Settings → API → copy `anon` key and `service_role` key

### 3. Set up environment variables

```bash
cp .env.example .env
# Fill in: DATABASE_URL, DIRECT_URL, AUTH_SECRET, RESEND_API_KEY
# Minimum required to boot: DATABASE_URL + DIRECT_URL + AUTH_SECRET
```

Generate AUTH_SECRET:
```bash
openssl rand -base64 32
```

### 4. Run migrations

```bash
pnpm db:migrate
# Creates all tables in your Supabase Postgres instance
```

### 5. Start development

```bash
pnpm dev
# api:      http://localhost:3000
# merchant: http://localhost:3001
```

---

## Common commands

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in parallel |
| `pnpm build` | Build all apps |
| `pnpm test` | Run all tests |
| `pnpm typecheck` | TypeScript check across all packages |
| `pnpm db:migrate` | Run Prisma migrations (dev) |
| `pnpm db:migrate:prod` | Run Prisma migrations (production) |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:generate` | Regenerate Prisma client |

---

## Vercel deployment

Two separate Vercel projects, both pointing to this monorepo:

| Project | Root directory | Environment |
|---|---|---|
| `pulse-api` | `apps/api` | `DATABASE_URL`, `AUTH_SECRET`, `RESEND_API_KEY`, ... |
| `pulse-merchant` | `apps/merchant` | `DATABASE_URL`, `MERCHANT_AUTH_SECRET`, ... |

Add all variables from `.env.example` to each project's Vercel dashboard.

---

## Cron jobs (Upstash QStash)

Scheduled via QStash instead of Vercel Cron (free tier):

| Job | Endpoint | Schedule |
|---|---|---|
| Expire welcome points | `POST /api/cron/expire-welcome` | Daily 03:00 UTC |
| Expire earned points | `POST /api/cron/expire-earned` | 1st of month 04:00 UTC |

Configure in your Upstash QStash dashboard after deployment.
