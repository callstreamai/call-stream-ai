# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (`backend/`)
- `npm start` — run production server (`node src/index.js`, port `4000`)
- `npm run dev` — run with nodemon
- `node src/mcp/stdio.mjs` — run the MCP server over stdio (also exposed as the `callstream-mcp` bin)
- No test runner and no lint script are configured.

### Frontend (`frontend/`)
- `npm run dev` — Next.js dev server
- `npm run build` / `npm start` — production build/serve
- `npm run lint` — `next lint`

### Database (`database/`)
- Run `database/schema.sql` then `database/seed.sql` in the Supabase SQL editor. There is no migration framework — schema changes are made directly in `schema.sql`.

### Health checks
- `GET /health` — liveness
- `GET /health/db` — verifies the Postgres pool with `SELECT 1` and reports which env vars are present. Use this first when debugging runtime 500s.

## Architecture

### Two-tier API with two database clients (important)
The backend deliberately uses **two different DB access patterns** depending on the surface:

- **Runtime API** (`/api/runtime/*`, `/api/channel/*`) targets <150ms. It uses a raw `pg.Pool` (`src/config/db.js`) connecting through the Supabase **session-mode pooler on port 5432**. All queries are parameterized SQL. Results are cached in `node-cache` (`src/services/cache.js`).
- **Admin API** (`/api/admin/*`) uses the Supabase JS client with the **service role key** (`src/config/supabase.js`), bypassing RLS. CRUD routes call `supabaseAdmin.from(...)` directly.

When adding a hot-path runtime query, use `db.query*` (raw pg) and add a cache key via `cacheService.buildKey([...])`. When adding admin CRUD, use `supabaseAdmin`.

### Auth split
- `runtimeAuth` (`src/middleware/auth.js`) checks `x-api-token` or `Authorization: Bearer` against `RUNTIME_API_TOKEN`. If `RUNTIME_API_TOKEN` is unset, auth is **bypassed** — this is intentional for local dev.
- `adminAuth` validates a Supabase JWT and **requires the email to end in `@callstreamai.com`** (403 otherwise). `DEMO_MODE=true` bypasses auth entirely with a fake user.

### Deployment resolution is the critical path
`POST /api/runtime/deployment-resolve` (`src/routes/runtime/deploymentResolve.js`) is the primary Brainbase entrypoint. The flow is:

1. `deploymentId + channel` → look up `deployment_bindings` row → `client_id` (cached 300s under `binding:<id>:<channel>`). Falls back to binding without channel filter.
2. For that client, fetch `clients`, `routing_rules`, `hours_of_operation`, `holiday_exceptions`, `kb_items`, `channel_overrides` **in parallel** (`Promise.all`) and cache the bundle 120s under `resolve-config:<clientId>:<channel>`.
3. Route matching is a fixed priority cascade: `(dept + intent)` → `dept only` → `intent only` → `is_fallback`. Preserve this order when modifying.
4. Channel overrides (`channel_overrides` table) may rewrite `greeting`/`value` on the resolved action.

Every error path returns a structured `{ error: { code, message, safeFallback } }` where `safeFallback` is `{ type: 'transfer', value: 'operator_transfer' }`. The `errorHandler` middleware enforces this for any unhandled error on `/api/runtime/*`.

### Caching & invalidation
`cacheService` (`src/services/cache.js`) is a singleton `node-cache` instance. Invalidation is **substring-based on the key** — `invalidateClient(clientId)` deletes every key whose string contains the clientId. This works because `buildKey` concatenates parts with `:`. When adding cache keys, always include the `clientId` (and `deploymentId` for binding keys) so invalidation finds them. `publish.js` and admin writes call `cacheService.invalidateClient` and log a `cache_invalidation_events` row.

### Publish = JSONB snapshot
`POST /api/admin/clients/:clientId/publish` (`src/routes/admin/publish.js`) reads all runtime tables for a client, writes the whole thing as a single `snapshot` JSONB into `published_versions`, sets previous versions inactive, and flips the client to `status='active'`. Version history is snapshot-based, not event-sourced — there is no replay.

### Timezone-aware hours
`src/utils/hours.js` `isCurrentlyOpen(hours, holidays, timestamp, timezone)` is the single source of truth for open/closed. It checks holiday exceptions first, then day-of-week hours, using `toLocaleString` to convert to the client's IANA timezone. The MCP `check_operating_status` tool has its own near-duplicate implementation — keep them in sync if the logic changes.

### MCP server
`src/mcp/server.mjs` exposes Call Stream data as MCP tools/resources/prompts. It creates **its own `pg.Pool`** (does not reuse `src/config/db.js`) so it can also run standalone via stdio. Mounted on the Express app at `/mcp/sse` + `/mcp/messages` by `src/mcp/sse.mjs`; auth uses `MCP_API_TOKEN` (falls back to `RUNTIME_API_TOKEN`). `src/index.js` skips body parsing for `/mcp/messages` because the SSE transport reads the raw body — don't add body parsing there.

### Frontend
Next.js 14 App Router + Tailwind, TypeScript. Auth via Supabase Google OAuth restricted to the `callstreamai.com` hosted domain (`signInWithOAuth({ queryParams: { hd: 'callstreamai.com' } })`). The `(protected)` route group wraps pages that need `AuthGuard`. All backend calls go through `src/lib/api.ts` which attaches the Supabase session JWT as a Bearer token.

### Verticals are templates, not runtime data
`vertical_template_*` tables seed new clients. `MCP create_client` and admin client creation copy template rows into the per-client runtime tables (`departments`, `intents`, etc.). Editing a template does **not** retroactively update existing clients.

## Environment

Backend requires `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` + `SUPABASE_ANON_KEY` + `RUNTIME_API_TOKEN`. The pg pool derives its connection string from `DATABASE_URL` if set, otherwise from `SUPABASE_URL` plus `DB_PASSWORD`/`SUPABASE_DB_PASSWORD` (note the hardcoded fallback password in `db.js` and `mcp/server.mjs` — treat as dev-only). Optional: `CACHE_TTL` (default 120s), `DEMO_MODE`, `MCP_API_TOKEN`, `FRONTEND_URL` (CORS origin).

Frontend requires `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Deployment
`backend/render.yaml` defines a Render web service (Node, starter plan). The frontend is deployed separately (not configured in this repo).
