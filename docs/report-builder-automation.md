# Report page automation

Automations apply only to saved pages owned by the signed-in user. Delivery goes
only to that owner's current account email, and the existing mail service also
enforces the notification domain allowlist. PDF and CSV attachments use fresh
queries under the owner's current scope. Partial, truncated or denied results
block delivery. Manual “Göndermeden test et” is a preview and never sends mail.

Production Next.js `instrumentation.ts` registers a 60-second worker in the
existing CRM process. The PM2 process already declared in `ecosystem.config.cjs`
therefore owns the worker lifecycle; no separate secret, endpoint, package or
cron service is required. Apply the additive migration sections, build and
restart the existing application process through the normal approved deployment
workflow. Development mode does not start background deliveries.

The named `20261019_048_report_automation.sql` append section lives inside the
existing `20261019_047_report_builder.sql` file. The migration-section runner
applies it independently even when earlier sections have already been applied.
It preserves the original file prefix and earlier checksums. The legacy
`report_schedules` table has a different schema and is intentionally independent.

Every run checks account activation, current database RBAC, page ownership and
dataset permissions. Permission scope is also capped by the permissions the
owner had when saving the plan. AD users require an unexpired AD session; its
effective roles are resolved through the same DB helper as web authorization.
An AD account without such a session fails until its owner signs in again.
No session token is read or persisted by the worker.

An advisory lock serializes each automation across all processes. A unique
automation/period run row is persisted and the due cursor advanced before any
mail request. This provides at-most-once attempts for a period: a process crash
may leave a `running` record requiring inspection, but never automatically
resends an uncertain delivery. Missed intervals are coalesced into one current
run; the next run is the configured number of hours from the claim time.

Threshold alerts require one numeric result row. Notification occurs only on a
false-to-true transition; the next successful false evaluation rearms the alert.
When mail is unconfigured, the run history stores the observation and condition
as an in-app result and reports `in_app`, never `sent`. Existing mail service
failures and domain rejection statuses are preserved.

Validation: `npx vitest run lib/report-builder/automation.test.ts`,
`npm run typecheck`, and targeted ESLint for the new files. Tests use mocks and
do not query a live database or send mail.
