# Lance do Pix

Leilão online demonstrativo em que o último lance antes do fim do cronômetro vence.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Web app: `artifacts/lance-do-pix`
- API routes: `artifacts/api-server/src/routes`
- API contract: `lib/api-spec/openapi.yaml`
- Database schema: `lib/db/src/schema`
- Generated client and validation: `lib/api-client-react` and `lib/api-zod`

## Continuous auction rounds

- The shared round configuration is stored in `demo_auction_settings` under `id = 'lance-do-pix-demo'`.
- `next_prize_cents`, `next_duration_seconds`, and `next_initial_bid_cents` configure the next round; money values are in centavos. Each round copies these values when it is scheduled.
- When a round ends, the next one is scheduled to start 60 seconds later. Set `enabled = false` before the current round ends to leave the platform in the no-auction state instead.
- To change the defaults for the next round, update the settings row in the development database. For example:
  `UPDATE demo_auction_settings SET next_prize_cents = 125000, next_duration_seconds = 120, next_initial_bid_cents = 5000 WHERE id = 'lance-do-pix-demo';`
- The configured initial bid is recorded as the opening bid. The next accepted bid must meet the existing minimum increment.

## Architecture decisions

- The shared demonstration auction, bid history, countdown, and bonus are authoritative in PostgreSQL and served by the API.
- Money values in the auction API and database are integer centavos; the bonus is calculated per completed 60-second period and is shown only when positive.
- This is not a real-money service: account, credits, top-ups, and withdrawals remain local simulations. The shared reset affects every demo session and requires confirmation in the UI.

## Product

- Mobile-first Brazilian Portuguese auction demo with a R$ 1.000,00 prize, a 60-second bid timer, bid history, simulated credits, and Pix-style prize claim flow.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The Vite build config requires both `PORT` and `BASE_PATH`; use the artifact preview path for `BASE_PATH`.
- Regenerate API client and Zod schemas after changing `lib/api-spec/openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
