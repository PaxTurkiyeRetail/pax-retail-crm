# Premium CRM UI Redesign

## Scope
This redesign preserves the current CRM data and route structure while upgrading the visual language and dashboard information hierarchy to a premium enterprise SaaS style.

## Updated files
- `components/PanelShell.tsx`
- `components/crm/CrmDashboardClient.tsx`

## Design decisions
- Dark command sidebar + light analytics workspace
- KPI-first dashboard hierarchy
- Funnel and phase-distribution blocks for management visibility
- Owner distribution, critical opportunities, and AI insight rail on the right
- Stronger spacing, rounded surfaces, and premium card system
- Retained current API endpoints and existing CRUD flow

## Product architecture direction
- Keep App Router pages thin and move page-specific UI into feature folders
- Introduce reusable primitives next:
  - `components/ui/card.tsx`
  - `components/ui/data-table.tsx`
  - `components/ui/stat-card.tsx`
  - `components/ui/filter-bar.tsx`
  - `components/ui/status-pill.tsx`
- Move CRM-specific dashboard sections under `components/crm/dashboard/*`
- Centralize derived analytics in a selector layer instead of the view component

## Data model extensions recommended
- `deal_value`
- `forecast_value`
- `health_score`
- `risk_level`
- `last_activity_at`
- `next_step`
- `owner_id`
- `segment`
- `priority`

## Validation note
- TypeScript `tsc --noEmit` passed.
- Full `next build` could not complete in this environment because Next.js attempted to fetch SWC from npm registry and the container blocks that registry lookup.
