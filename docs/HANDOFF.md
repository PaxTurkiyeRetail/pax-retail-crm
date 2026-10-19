# Handoff — 2026-10-19

Read `.claude/CLAUDE.md` first. Rules:
- Do not read `.env` or secret files.
- No DROP/TRUNCATE/DELETE in migrations.
- Add migrations as new numbered files in `db/migrations/`, written with IF NOT EXISTS so they can be re-run safely.
- Do not add packages.

## Stack and deploy
- Next.js 15.5 (app router), Tailwind v4, `db.query` (pg), vitest.
- **Live server:** `tahabitim@10.250.50.39` (SSH key), app directory `/home/tahabitim/apps/pax-retail-crm`, pm2 process `pax-retail-crm`, port **5043**. The URL users open is `https://crm.paxturkiye.com:5042` (HTTPS required).
- **Deploy:** `git push origin main`, then on the server run:
  ```
  git checkout -- package-lock.json
  git pull --ff-only
  bash scripts/deploy-live.sh
  ```
  `deploy-live.sh` does not pull code, so pull first. It runs lint, tests, build, `db:migrate` and a health check on 5043.
- **Read-only DB check:** write a `.cjs` file into the app directory, start it with `begin read only`, and run it with `node --env-file-if-exists=.env.local x.cjs`. Delete the file afterwards.
- Vitest also picks up the `.claude/worktrees/*` copies, so ignore failures from there or run with `--exclude ".claude/**"`.

## Generic creation correction — 2026-10-19
- User clarified Operational Panel is a capability example, not a ready page to clone. Removed named Retail/KasaPOS creation shortcuts and static panel cards from Report Center; existing sidebar reports stay.
- Generic wizard creates independent user-defined sections with own source, measures, up to 12 dimensions, period, table/pivot, titles; assemble blocks or tabs. No fixed-page cloning in creation flow.
- Owned quick reports and editable saved pages expose confirmed Sil; server archives using existing authorized DELETE endpoints. Studio settings also expose deletion. Removed items refresh sidebar/list and their stored links cease resolving.
- Local typecheck/lint passed. Real React mocked-browser acceptance built two unrelated user sections, saved, opened live from sidebar, changed sharing, then deleted and verified menu removal. Production follow-up deploy uses mandatory full verify/backup/health script.

## Report Studio deployed — 2026-10-19 (code: 713fa70)
- Generic multi-source report pages: editable sections/tabs, tables/pivots/KPIs, formulas, conditional styles, up to 12 dimensions, CSV and PDF. Editable Retail/KasaPOS kits are examples, not limits on page structure.
- Guided creation builds summary/detail; existing saved pages open in Studio. Sharing uses existing private/roles/everyone rules and viewer row scopes. Share button copies live link.
- Optional page.navigation.enabled persists menu visibility in existing page JSON; list API only returns authorized reports. Menu opens live preview and queries fresh data. No migration.
- Sale-date legacy scalar/list normalization, pivot aliases, all-dates clearing fixed. Sidebar footer uses the sidebar background in both themes. Bar/line creation options removed; old saved chart renderers remain compatible.
- Rental creation stays in EXISTING quotes → sales flow; proposed separate rental entry was removed before release. Only active-rental future-start exclusion remains as a reporting correction.
- Official supplied PDF antet is bundled unchanged; portrait A4 preserved; uploaded/default/no-letterhead choices supported.
- Local verify passed (typecheck/lint/tests/build); targeted added tests and isolated mocked React browser acceptance cover guided model/customer/month save, menu/reopen, five-section page, themes and mobile. Official antet PDF rendered and inspected. AD-authenticated live UI still needs a test session. Production deployment completed: 43 files / 386 tests, predeploy backup, preflight/build and PM2 reload passed. Internal and public HTTPS health returned ok=true, database=connected. Read-only live SQL probes passed for every editable kit data section.
- Vitest now excludes nested .claude worktree copies to avoid duplicate/stale suites.

## Deployed release — 2026-10-19 (code: cabde5d)
- Report Center: search, category filters, resilient partial loading, retry and scoped styles. Structured API validation errors no longer render `[object Object]`.
- The Retail gallery card opens `/crm/reports/retail-operasyon` directly, rather than creating the more limited generic page template.
- Report definitions persist `style.accent` and `style.conditional`; the wizard loads, saves and exports the same rules. No migration needed (definition JSON).
- Retail: six reference sections, model/month matrices, opportunity model summaries, financial reconciliation, sales/rental tables, KasaPOS charts, CRM distributions/filters, saved plan columns and inline Forecast entry. Next-year opportunity month changes use the existing authenticated update API.
- Real sources remain CRM sales, Forecast, KasaPOS invoices and Retail customers. USD averages use USD-only quantities; missing live prices remain unavailable. Static HTML customer records and prices were not imported.
- Intentional arithmetic corrections over the reference: December actuals and forecast are shown separately and added consistently; next-year firm scenario quantities are allocated from rounded model/month totals so details reconcile with the matrix.
- Local visual verification uses the real client components with synthetic API responses in ignored `.theme-audit/retail-review/`; it does not bypass production authentication. User approved deployment. Server verification: 37 test files / 355 tests, typecheck/lint/build/preflight passed; predeploy backup created; existing migrations skipped; PM2 reloaded successfully.
- Internal `http://127.0.0.1:5043/api/health` and public `https://crm.paxturkiye.com:5042/api/health` both returned `ok: true`, database connected. Unauthenticated Retail page redirects (307), API rejects (401), as expected.
- Read-only live source queries succeeded for current-year sales, both Forecast years and Retail customers. Authenticated AD visual/interaction verification still needs a test AD session; no production Forecast writes were used for testing.
- Remaining: scheduled-report runner/UI, dashboard hero, Görkem's department, and the separately requested source assets below.

## Existing live features
- **Retail Operasyon Paneli:** `/crm/reports/retail-operasyon`. Code: `lib/reports/retail-operasyon.ts` and `RetailOperasyonClient.tsx`.
  - Sales, opportunities, KasaPOS and the CRM pool are live data.
  - Rental KPIs and a rental table.
  - Records with `includeInRetailPlan=false` are filtered out.
  - The CRM pool can add rows to the forecast via `ForecastQuickAdd`.
  - The CRM pool shows only `is_kolu='Retail'` customers.
- **Migration 045:** forecast `sale_type`/`unit_price`/`rental_monthly_price`/`include_in_retail_plan`; sales `rental_ops_*`.
- **Departments (Retail/Bank/Vertical):**
  - Customer department: `musteriler.is_kolu`.
  - User department: `allowed_users.departments text[]`. An empty array means all departments. Migration 046 seeds it from each user's customer majority.
  - Managed from `/admin/users` (Departman column).
  - `lib/departments.ts` holds the constants; `getUserDepartments()` is in `lib/authz.ts`.
  - Applied to the KasaPOS Entegrasyon Raporu and the customer list, enforced server-side.
  - Splitting is by department, NOT by person.
- **Report Builder MVP:** `/crm/report-builder`.
  - Code: `lib/report-builder/*`, `app/api/report-builder/*`, `app/(panel)/crm/report-builder/*`.
  - Design document: `docs/report-builder/DESIGN.md`.
  - Migration 047 creates the tables. 045_report_builder is a duplicate of it and harmless, because both are idempotent.
- **Design system:** `components/ui/*` and the tokens in `app/tailwind.css`. Screens in `DS_ROUTES` (`PanelShell.tsx`) use it.
  - Sidebar: light background, coloured icon tiles, active item filled with the brand gradient.
  - `html,body overflow-x: clip` keeps the sidebar sticky.
  - Content is full width (the `max-width` was removed from `premium-ui.css`).

## Open / pending
1. **Report Builder UX:** DONE and live.
   - Shipped:
     - Rapor Merkezi gallery with ready templates.
     - 3-step wizard: `ReportWizard.tsx`, plain Turkish names in `friendly.ts`.
     - Advanced layer: comparison, top-N, filters, formulas, conditional colour.
     - Drill-down, `?report=` / `?page=` links, "Kayıtlı rapor ekle" in the dashboard designer.
   - Remaining:
     - (a) Conditional colour persistence is deployed (cabde5d).
     - (b) Scheduled reports: the `report_schedules` table exists, but there is no runner or UI. Build a cron/pm2 job plus the "Zamanla" UI.
     - (c) No Playwright verification yet.
2. **UI taste:** the user said "too colourful" and then "too pale". The current balance is in the last commit; the request is "advanced, polished, product feel".
   - The Dashboard hero band (navy gradient) is still old styling. Bring it in line with the system.
3. **Görkem İlbay:** department is empty. The user should assign it from `/admin/users`.
4. **Playwright:** no live verification yet, because login is AD-only. Either the user provides a test AD user, or verify locally with mock auth.
5. **Inputs to request from the user:**
   - The rental contract list, for import.
   - The letterhead image (upload through Report Builder → Antetler).
   - `public/fonts/DejaVuSans*.ttf` for Turkish characters in PDFs.
6. **Retail panel vs. the HTML:** the previously missing tables/charts/plan columns are deployed (cabde5d); authenticated AD visual verification pending. Reference details and deliberate live-data adaptations: `docs/report-builder/RETAIL_PARITY.md`.
7. **Security:** `C:\Users\mustafa.bitim\.claude\settings.json` contains a plaintext `PGPASSWORD` (Pax Portal local DB) in old allow rules. Delete those lines and rotate the password.
