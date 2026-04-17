# Call Stream AI

**Production-grade, multi-tenant SaaS platform for AI voice, chat, SMS, and email operations.**

Built for Brainbase Labs deployments. Designed as a real-time operational intelligence layer for the guest economy.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CALL STREAM AI                        │
├──────────────┬──────────────────┬───────────────────────┤
│   Frontend   │     Backend      │      Database          │
│   (Next.js)  │   (Express.js)   │     (Supabase)         │
│              │                  │                         │
│  Admin Portal│  ┌─ Runtime API  │  ┌─ Runtime Tables     │
│  Dark Theme  │  │  (Brainbase)  │  │  (Read-optimized)   │
│  Tailwind    │  ├─ Admin API    │  ├─ Template Tables     │
│              │  │  (Portal)     │  │  (Vertical presets)  │
│              │  └─ Channel API  │  ├─ Brainbase Tables    │
│              │     (Chat/SMS)   │  │  (Deployment maps)   │
│              │                  │  └─ Admin Tables         │
│              │  In-Memory Cache │     (Import/Audit)      │
├──────────────┴──────────────────┴───────────────────────┤
│              Render (Cloud Hosting)                       │
└─────────────────────────────────────────────────────────┘
```

## Core Features

### Runtime API (Brainbase-facing, <150ms target)
- `POST /api/runtime/deployment-resolve` — Primary endpoint for Brainbase voice/webhook
- `GET /api/runtime/:clientId/directory` — Phone directory
- `GET /api/runtime/:clientId/hours` — Hours of operation + current status
- `GET /api/runtime/:clientId/routing` — Routing rules
- `GET /api/runtime/:clientId/context` — Departments + intents context
- `GET /api/runtime/:clientId/faq` — Knowledge base FAQ

### Admin API (Portal-facing)
- Full CRUD for all entities (clients, departments, directory, hours, holidays, routing, intents, KB)
- Deployment binding management
- CSV import with staging, validation, and approval
- Publish system with version snapshots
- Preview simulator
- Audit logging

### Channel API (Chat/SMS/Email)
- `POST /api/channel/resolve` — Channel-aware resolution with richer responses
- `GET /api/channel/:clientId/init` — Widget initialization context

## Vertical Templates

Pre-built operational templates for:
- **Hotels & Resorts** — 12 departments, 26 intents, 9 routing rules, 8 KB items
- **Travel** — 8 departments
- **Food & Beverage** — 6 departments
- **Entertainment** — 7 departments
- **Recreation & Wellness** — 8 departments

## Database Schema

30+ tables across 5 categories:
- **Core**: clients, users, client_members
- **Templates**: vertical_templates, template_departments/intents/routing/kb/hours
- **Runtime**: departments, directory_entries, hours_of_operation, holiday_exceptions, routing_rules, intents, kb_items
- **Brainbase**: deployment_bindings, deployment_overrides, channel_overrides, published_versions, cache_invalidation_events
- **Admin**: import_jobs, import_job_rows, import_errors, audit_logs, draft_versions

All tables include:
- UUID primary keys
- Hot-path indexes
- Row Level Security (multi-tenant)
- Updated_at triggers
- Service role bypass for runtime API

## Deployment Binding Model

Maps Brainbase deployments to client configurations:

```
Brainbase Worker → Deployment Binding → Client
                     ↓
            deployment_overrides
            channel_overrides
```

Supports per-deployment, per-channel, per-environment overrides.

## Caching Strategy

- In-memory cache (node-cache) with TTL 30-300 seconds
- Cache keys: `{entity}:{clientId}:{parameters}`
- Invalidation on: publish, entity updates, deployment changes
- Cache events logged to `cache_invalidation_events` table

## Import System

1. Upload CSV file
2. Parse into staging rows
3. Field mapping (automatic or manual)
4. Validation with error reporting
5. Preview with error/valid counts
6. Approve to write to production tables
7. Cache invalidation
8. Audit log entry

## Runtime Error Contract

All runtime endpoints return structured errors with safe fallbacks:

```json
{
  "error": {
    "code": "ROUTING_NOT_FOUND",
    "message": "No routing rule found",
    "safeFallback": {
      "type": "transfer",
      "value": "operator_transfer"
    }
  }
}
```

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase project

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your Supabase credentials
npm start
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your API URL and Supabase credentials
npm run dev
```

### Database Setup
1. Create a Supabase project
2. Run `database/schema.sql` in the SQL editor
3. Run `database/seed.sql` to load vertical templates

## Environment Variables

### Backend
| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `RUNTIME_API_TOKEN` | Token for runtime API auth |
| `CACHE_TTL` | Cache TTL in seconds (default: 120) |
| `PORT` | Server port (default: 4000) |

### Frontend
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

## Design Language

- Black background (#000000)
- White text (#ffffff)
- High contrast
- Minimal, modern SaaS aesthetic
- Clean cards and structured tables
- Tailwind CSS

## Performance Targets

- Runtime API response: <150ms
- Minimal joins on hot paths
- Indexed queries for all runtime lookups
- In-memory caching
- Precomputed routing logic
- Deterministic outputs only

## License

Proprietary — All rights reserved.
