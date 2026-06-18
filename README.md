# PULSE / ayoo

PULSE is the ayoo loyalty platform: users earn points from receipts, QR scans, check-ins, partner purchases, referrals, challenges, and gifts. Partner venues manage rates, rewards, staff flows, imports, analytics, and Telegram-based operations.

The repo is a pnpm/Turborepo monorepo with API, merchant web, mobile, landing, bots, shared domain logic, and Prisma database packages.

## Stack

| Layer | Technology |
| --- | --- |
| Web apps | Next.js 15 App Router |
| Mobile | Expo Router / React Native |
| API | tRPC v11 |
| Auth | NextAuth v5, Telegram Mini App auth |
| ORM | Prisma + PostgreSQL |
| Database / storage | Supabase |
| Jobs / cron | API route handlers, QStash-compatible verification |
| OCR / verification | Google Vision, OpenAI, Anthropic |
| Bots | Telegram bots |
| i18n | next-intl, i18next, JSON locales |
| Styling | Tailwind CSS, React Native styles, static landing CSS |
| Monorepo | pnpm workspaces + Turborepo |

## Project Map

```text
.
├── apps/
│   ├── api/          # Public API, tRPC, Telegram mini apps, cron routes
│   ├── merchant/     # Merchant dashboard, venue imports, rewards, staff purchase flow
│   └── mobile/       # Expo app for customers
├── packages/
│   ├── auth/         # User, merchant, edge, and mobile auth helpers
│   ├── bot/          # Telegram customer, partner, support bot code
│   ├── db/           # Prisma schema, migrations, seed/import scripts
│   ├── i18n/         # EN/RU/SR translations
│   ├── jobs/         # Reusable job handlers
│   ├── shared/       # Pure points, geo, streak, pet, badge helpers
│   └── trpc/         # Routers and service functions
├── feedback-bot/     # Separate Python feedback bot
├── landing/          # Static marketing site
├── PLACES_SPEC.md
├── PULSE_SPEC.md
├── pnpm-workspace.yaml
└── turbo.json
```

## Setup

Requirements:

- Node.js 20+
- pnpm 9+
- PostgreSQL/Supabase project

Install dependencies:

```bash
pnpm install
```

Create local environment:

```bash
cp .env.example .env
openssl rand -base64 32
```

Fill at least:

- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET`
- `MERCHANT_AUTH_SECRET`
- `AUTH_URL`
- `MERCHANT_URL`

Optional integrations are documented in `.env.example`: Telegram bots, Supabase Storage, Upstash, OCR/AI providers, mobile public env, and push notification keys.

Prepare database:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Start development:

```bash
pnpm dev
```

Default ports:

- API: `http://localhost:3000`
- Merchant dashboard: `http://localhost:3001`
- Mobile: run with `pnpm --filter @pulse/mobile start`

## Common Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Start workspace dev tasks |
| `pnpm build` | Build workspace packages/apps |
| `pnpm test` | Run tests |
| `pnpm typecheck` | Run TypeScript checks |
| `pnpm lint` | Run lint tasks |
| `pnpm format` | Format TS/TSX/MD/JSON files |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run local Prisma migrations |
| `pnpm db:migrate:prod` | Deploy Prisma migrations |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:import:venues` | Import venue JSON data |
| `pnpm db:fetch:google-venues` | Fetch Google Places venue data |

Scoped examples:

```bash
pnpm --filter @pulse/api dev
pnpm --filter @pulse/merchant dev
pnpm --filter @pulse/mobile start
pnpm --filter @pulse/api test
```

## Core Flows

- Customer earns points through receipt scan, Serbian fiscal QR scan, check-in, partner purchase, gifts, referrals, and challenges.
- Partner venue sets points rate, creates rewards/offers, manages staff, imports venues, and awards points from Telegram or the merchant dashboard.
- Staff mini app scans customer QR codes and awards/redeems points from Telegram.
- Bots handle customer, partner, support, lead, and reminder flows.
- Shared package owns simple deterministic rules: points, streaks, pets, badges, geo distance, and utility helpers.

## Cron Routes

Cron routes live in `apps/api/app/api/cron/*`.

Current endpoints:

- `POST /api/cron/expire-welcome`
- `POST /api/cron/expire-earned`
- `POST /api/cron/generate-challenges`
- `POST /api/cron/partner-reminder`
- `POST /api/cron/reset-daily-steps`
- `POST /api/cron/review-prompt`
- `POST /api/cron/streak-reminder`
- `POST /api/cron/venues-enrich`
- `POST /api/cron/venues-sync`
- `POST /api/cron/welcome-expiry-warning`

Use `CRON_SECRET` or QStash signing variables from `.env.example` to protect scheduled calls.

## Deployment

Typical deployment uses separate projects:

| Project | Root | Purpose |
| --- | --- | --- |
| API | `apps/api` | API routes, tRPC, cron, Telegram mini apps |
| Merchant | `apps/merchant` | Merchant dashboard |
| Mobile web | `apps/mobile` | Expo web build |
| Landing | `landing` | Static marketing site |

Add the required variables from `.env.example` to each deployment target. Keep server-only secrets out of mobile public variables; Expo `EXPO_PUBLIC_*` values are client-visible.

## Development Notes

- Keep business rules in small functions in `packages/shared` or `packages/trpc/src/services` before wiring them into UI.
- Prefer explicit inputs and outputs over hidden global state.
- Add migrations with the Prisma schema change that needs them.
- Before shipping, run at least `pnpm typecheck` and the relevant scoped tests.
