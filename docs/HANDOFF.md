# Handoff — 2026-10-19

Read `.claude/CLAUDE.md` first. Rules:
- Do not read `.env` or secret files.
- No DROP/TRUNCATE/DELETE in migrations.
- Add migrations as new numbered files in `db/migrations/`, written with IF NOT EXISTS so they can be re-run safely.
- Do not add packages.

## Stack and deploy
- Next.js 15.5 (app router), Tailwind v4, `db.query` (pg), vitest.
- **Live server:** `tahabitim@10.250.50.39` (SSH key), app directory `/home/tahabitim/apps/pax-retail-crm`, pm2 process `pax-retail-crm`, port **5043**. The URL users open is `crm.paxturkiye.com:5042`.
- **Deploy:** `git push origin main`, then on the server run:
  ```
  git checkout -- package-lock.json
  git pull --ff-only
  bash scripts/deploy-live.sh
  ```
  `deploy-live.sh` does not pull code, so pull first. It runs lint, tests, build, `db:migrate` and a health check on 5043.
- **Read-only DB check:** write a `.cjs` file into the app directory, start it with `begin read only`, and run it with `node --env-file-if-exists=.env.local x.cjs`. Delete the file afterwards.
- Vitest also picks up the `.claude/worktrees/*` copies, so ignore failures from there or run with `--exclude ".claude/**"`.

## Live (main = 4ece5f2+, deployed)
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
1. **Report Builder UX redo:** "I couldn't even build a report". A background agent is working in worktree branch `worktree-agent-af9de7f5c551e4898`, NOT merged.
   - Target:
     - Template gallery on the landing page.
     - 3-step wizard (data → measure/grouping + live preview → view/save).
     - An advanced layer: comparison, top-N, conditional colour, drill-down, scheduling, letterhead PDF.
     - A separate "Pano oluştur" (create dashboard) flow.
     - Plain Turkish, no jargon. Bar: Metabase/Looker Studio ease.
   - Current state: tsc errors exist, e.g. `PageDesigner.tsx: SavedDefinitionLite` not found.
   - To do: finish or check that branch, then run `tsc`, `vitest` and `build`, then merge and deploy.
2. **UI taste:** the user said "too colourful" and then "too pale". The current balance is in the last commit; the request is "advanced, polished, product feel".
   - The Dashboard hero band (navy gradient) is still old styling. Bring it in line with the system.
3. **Görkem İlbay:** department is empty. The user should assign it from `/admin/users`.
4. **Playwright:** no live verification yet, because login is AD-only. Either the user provides a test AD user, or verify locally with mock auth.
5. **Inputs to request from the user:**
   - The rental contract list, for import.
   - The letterhead image (upload through Report Builder → Antetler).
   - `public/fonts/DejaVuSans*.ttf` for Turkish characters in PDFs.
6. **Retail panel vs. the HTML:** the remaining items from the original `Retail_2026_2027.html`.
   - Model×month result tables with a "Fırsat" column.
   - Reconciliation table.
   - Model sales / average price table.
   - KasaPOS monthly card and Kasa/POS distribution charts.
   - Planned model/qty/month and Account columns.
7. **Security:** `C:\Users\mustafa.bitim\.claude\settings.json` contains a plaintext `PGPASSWORD` (Pax Portal local DB) in old allow rules. Delete those lines and rotate the password.
