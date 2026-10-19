# Retail Operasyon — reference alignment, 2026-10-19

Reference: the supplied `Retail_2026_2027.html`. Implementation uses live application repositories, without embedding the reference's customer snapshot or hardcoded prices.

| Reference section | Live implementation |
| --- | --- |
| Current status | Eight sales/KasaPOS KPIs, rental status, firm sales, billing and rental contracts |
| Current year end | Unique firms, sale/rental quantities, model summary and firm opportunities |
| Next year projection | Same summaries, bank-channel quantity, persisted delivery month via existing Forecast API |
| CRM pool | Retail customers, vendor/POS distributions, search/four filters/order, planned model/quantity/month and Account, inline new plan entry |
| Current year results | Eight KPIs, sale/rental scenario, model × 12 months plus opportunity column, finance inclusion toggle, reconciliation, product/rental tables and monthly KasaPOS charts |
| Next year results | Planned firms/quantity/scenario KPIs, model × 12 months and firm details |

## Calculations and persistence

- S210 contributes to product sales revenue, not terminal counts.
- USD averages use quantities from USD-denominated sales, not quantities across currencies. No currency conversion is inferred.
- Current-year forecast quantities are grouped by model and sale/rental type, then multiplied by the scenario rate and rounded. As in the reference, these opportunities appear in December and probabilities are informational.
- Next-year quantities are grouped by model/month before rounding. Firm details receive an allocation of that same rounded total; row rounding cannot create extra devices.
- If December already has actuals, actual and forecast remain separately visible and additive. This fixes a reference inconsistency where the matrix could suppress forecast while the headline included it.
- Forecast prices take priority; USD model sale averages are a fallback for sale estimates. Missing rental rates or missing USD price coverage display `Fiyat eksik`.
- Finance inclusion defaults off. Actual sales, scenario sales and recurring rental/KasaPOS income remain distinct.
- Existing `includeInRetailPlan=false` records remain excluded. CRM plans use the same canonical Forecast records as the projection; they are not added twice.
- Changes save through existing authorized Forecast endpoints. Browser-local plan storage and saved-HTML exports are replaced by application persistence and current-view CSV exports.

## Verification boundary

Unit tests cover backend mapping, currency coverage, pricing, grouping, rounding and reconciliation. Type checking, targeted ESLint and production build are run locally.

Playwright reviews the real React components and shared styles with synthetic API responses in an isolated local harness. Checks cover all six Retail tabs, CRM search and inline plan save request, scenario/finance controls, report search/categories, Retail navigation and 390px mobile overflow. Screenshots are under ignored `.theme-audit/retail-review/`.

Deployed with user approval on 2026-10-19: code commit `cabde5d`. Server checks passed (37 test files, 355 tests, typecheck/lint/build/preflight); predeploy database backup completed and PM2 reloaded. Both internal health and public HTTPS health returned `ok: true`, database connected. Live read-only source queries succeeded. Unauthenticated page/API returned 307/401 as expected.

An authenticated AD visual session and production write behavior remain unverified. No production Forecast records were changed for testing. Public URL: `https://crm.paxturkiye.com:5042/crm/reports/retail-operasyon`.
