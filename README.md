# Dotnapps Invoice

[![License](https://img.shields.io/badge/license-proprietary-red.svg)](LICENSE)

> Create. Quote. Invoice. Share. Get Paid.

A production-grade, multi-tenant SaaS for freelancers, agencies, consultants,
startups and SMEs: GST-aware quotations, invoicing, payments, bulk bill
sharing, reminders, expenses, reports and subscriptions. **V1 intentionally
excludes AI.**

Source of truth: [`docs/spec/Dotnapps_Invoice_V1_Vibe_Coding_Product_Spec.pdf`](docs/spec/Dotnapps_Invoice_V1_Vibe_Coding_Product_Spec.pdf).

## Stack

- Next.js 15 (App Router) + React 19, TypeScript
- PostgreSQL + Prisma
- Auth.js v5 (Credentials provider, JWT sessions)
- Tailwind v4
- Vitest for unit tests

This mirrors the stack used by the sibling project `dotnapps-crm` for
consistency across the Dotnapps portfolio.

## Getting started

```bash
createdb dotnapps_invoice
cp .env.example .env   # then edit DATABASE_URL / AUTH_SECRET
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Seeded business **Acme Design Studio** with one login per role (password
`Password123!` for all):

| Email | Role |
| --- | --- |
| `superadmin@dotnapps.test` | Platform Super Admin |
| `owner@dotnapps.test` | Owner |
| `admin@dotnapps.test` | Admin |
| `accountant@dotnapps.test` | Accountant |
| `sales@dotnapps.test` | Sales |
| `staff@dotnapps.test` | Staff |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create/apply a dev migration |
| `npm run db:seed` | Seed demo data (`prisma/seed.ts`) |
| `npm run db:studio` | Prisma Studio |
| `npm test` | Unit tests (`tests/unit`) |

## Roles & permissions (spec §3)

| Role | Access |
| --- | --- |
| Owner | Full access, billing, business settings, team, integrations |
| Admin | Operational management and reports |
| Accountant | Invoices, quotations, payments, expenses, reports |
| Sales | Customers, quotations, products; restricted financial actions |
| Staff | Only explicitly granted modules/actions |

Authorization is enforced server-side in every server action and page
(`src/lib/rbac.ts`, `src/lib/context.ts`) — the sidebar only *hides* items a
role can't use; it is never the source of truth. **Staff currently ships
with the safe default (dashboard view only)** — per-user granular grants
beyond the five fixed roles are future work, not part of V1's role model.

## Build order (spec §29)

1. **Foundation** — auth, business model, roles, database, design system, navigation, settings ✅
2. **Core billing** — customers, products/services, quotations + PDF, invoices + PDF ✅
3. **Collections** — payments, partial payments, receipts, statuses, reminders ✅
4. **Bulk** — multi-select, filters, async sending, retries, bulk history, export/download ✅
5. **Finance** — expenses, reports, GST summaries ✅
6. **SaaS** — plans, subscriptions, usage limits, super admin ✅
7. **Hardening** — security, tests, performance, accessibility, monitoring ✅ **this phase, and the last one (spec §29)**

## Phase 1 (Foundation) — what's here

- Signup / login / logout, JWT sessions (`src/lib/auth.ts`)
- `Business` model carrying the fields required before a document can be
  sent (spec §4): contact/address, GSTIN & registration type, currency,
  quotation/invoice numbering, bank/UPI payment details
- `Membership` + `Invite` (5 roles: Owner/Admin/Accountant/Sales/Staff),
  team invite flow with a shareable link (email delivery is a later phase)
- `AuditLog` — append-only record of security-sensitive and business
  mutations
- Sidebar navigation for every V1 module (spec §2) with real routes; modules
  not yet built render an honest "Coming in Phase N" placeholder rather than
  a broken link or fabricated data
- Settings: profile, business profile, team

## Phase 2 (Core billing) — what's here

- `Customer` (billing/shipping address, GSTIN, archive-not-delete) and
  `ProductService` (SKU, HSN/SAC, price, tax rate, active/inactive) — full
  CRUD under `/customers` and `/products-services`
- `src/lib/billing/tax.ts` — the single centralized, unit-tested GST
  calculation service (spec §7, §15): per-line taxable value/tax, CGST+SGST
  vs IGST split by comparing business/customer state, all in exact decimal
  math (`Prisma.Decimal`) rather than floats
- `Quotation`/`QuotationItem` and `Invoice`/`InvoiceItem` with the full
  spec §8/§9 flow: DRAFT → SENT → VIEWED (auto, on customer open) →
  ACCEPTED/REJECTED (quotations, via the public portal) → convert to
  invoice (copies items/totals, links both records)
- Auto-numbering per business (`quotationPrefix`/`invoicePrefix` +
  sequence) via an atomic increment (`src/lib/billing/numbering.ts`)
- A4 PDFs (`@react-pdf/renderer`) at `/quotations/[id]/pdf` and
  `/invoices/[id]/pdf` (internal) and `/q/[token]/pdf`, `/i/[token]/pdf`
  (public) — always re-derived from the same stored totals the on-screen
  view uses, so they can't drift (spec §10, §33)
- Public customer portal (spec §17) at `/q/[token]` and `/i/[token]`: no
  auth, an unguessable token is the access control; quotations get
  Accept/Reject, invoices are view+download only (no payment gateway yet)
- Send-readiness gate (`src/lib/billing/readiness.ts`): sending a document
  is blocked until the business profile has an address/city/state/contact
  (spec §4) — verified live in the browser, not just in tests
- Dashboard shows real quotation/invoice counts and recent activity;
  revenue/outstanding/overdue now come from real Payment data (Phase 3);
  expenses/net income stay "—" until Expense (Phase 5) exists

## Phase 3 (Collections) — what's here

- `Payment`/`PaymentAllocation` (spec §12): full or partial payments
  recorded against an invoice, methods (UPI/bank transfer/card/cash/
  cheque/other), reference ID, notes. Reversal instead of deletion — a
  reversed payment stays visible for audit but stops counting toward the
  invoice balance
- Invoice balance/status is **never stored** — `src/lib/billing/
  invoice-status.ts` derives DRAFT/SENT/VIEWED/PARTIALLY_PAID/PAID/
  OVERDUE/CANCELLED at read time from ACTIVE payment allocations + due
  date, every time. Spec's own acceptance criterion is "Overdue status is
  deterministic and safe against stale jobs" — a stored status needs a
  cron to flip it and that cron can fail to run; a computed one can't go
  stale
- PDF payment receipts (`/payments/[id]/receipt`, spec §12 "Generate
  payment receipt")
- Rule-based reminders (spec §13): `ReminderRule` (6 kinds — 7/2 days
  before due, on due date, 3/7/30 days overdue — enabled flag, channel,
  editable template) and `ReminderEvent` (dedupes so the same rule never
  fires twice for one invoice). Manual send only — bulk sending is
  explicitly a Phase 4 item in the spec's own build order, not Phase 3.
  `/settings/reminders` to configure rules, `/reminders` as a cross-
  business queue of what's currently due, plus a reminders card on each
  invoice. Sending logs the event and shows the customer-ready message as
  copyable text — same "share the link yourself" pattern as sending a
  quotation/invoice, since there's no email/WhatsApp/SMS provider wired
  up yet
- Dashboard Revenue/Outstanding/Overdue KPIs and the 5-way invoice status
  breakdown (draft/sent/partial/paid/overdue) are now computed from real
  data, not placeholders

## Phase 4 (Bulk) — what's here

- Invoice list filters (spec §11): status (derived, not a DB column — see
  Phase 3), customer, invoice number, invoice-date range, due-date range,
  amount range — all as plain GET query params, paginated (20/page)
- Multi-select with a "select all on this page" checkbox and a bulk
  toolbar (`bulk-invoice-table.tsx`) that appears once ≥1 row is selected
- **Send Invoice** / **Send Reminder** in bulk: a channel picker (Email/
  WhatsApp/SMS) drives a live preview — invoice count, total amount, valid
  recipients, missing contacts — recomputed client-side the moment the
  channel changes, before anything is confirmed (spec: "Before sending
  show invoice count, total amount, valid recipients, missing contacts")
- `BulkSendBatch`/`BulkSendItem` (spec §21 core data model): each
  selected invoice gets its own outcome — SENT / SKIPPED (e.g. no email on
  file, invoice cancelled, reminder for an already-paid invoice) / FAILED
  (e.g. business profile incomplete) — written independently so one bad
  item can't abort the batch (spec: "one failure must not stop the
  batch"). No real messaging provider exists yet, so "sent" means the
  templated message was rendered, logged, and shown as copyable text —
  same honesty rule as the single-document send/reminder flows, not a
  fabricated delivery
- **Retry** re-evaluates only the FAILED/SKIPPED items in a batch (e.g.
  after adding a missing phone number) — verified live: sent a WhatsApp
  reminder to 3 invoices whose customer had no phone (all 3 correctly
  skipped with the real reason), added the phone number, retried, all 3
  flipped to sent with the phone-appropriate message
- **Mark as Paid** in bulk (spec §11): records one full payment per
  selected invoice that still has a balance (skips drafts/cancelled/
  already-paid), using the same `Payment`/`PaymentAllocation` machinery
  as a single payment — individually reversible and audited, not a
  separate "bulk" data path
- **Download PDFs**: zips one PDF per selected invoice (`jszip`), reusing
  the same `BillingDocumentPdf` renderer as the single-invoice PDF route
- **Export**: CSV of the selection (number, customer, email, dates,
  status, totals, balance) — spec's "Export" bulk action
- `/invoices/bulk` — Bulk Activity history (batch name, creator, time,
  channel, totals); `/invoices/bulk/[batchId]` — per-item results with
  each rendered message and a Retry button when anything didn't send

## Phase 5 (Finance) — what's here

- `Expense` (spec §14): vendor, amount + separate tax component, date,
  configurable category, payment method, notes, and a real receipt upload
  (image or PDF, ≤5MB) — stored as `Bytes` directly in Postgres, not a
  cloud object store, since there's no S3/blob storage configured
  anywhere in the app. Verified live: uploaded a receipt, then re-fetched
  it and confirmed the exact byte size and MIME type round-tripped
  correctly through `/expenses/[id]/receipt`
- `ExpenseCategory` (spec: "Configurable categories") — 9 sensible
  defaults auto-seeded per business (`ensureDefaultExpenseCategories`,
  same lazy-upsert pattern as Phase 3's reminder rules), manageable at
  `/settings/expense-categories` (add + activate/deactivate; no delete —
  deactivating keeps historical expenses' category intact)
- `/reports` (spec §16), computed live from Invoice/Payment/Quotation/
  Expense on every load — nothing denormalized, so a report can't go
  stale: invoices by status, quotation conversion rate, payments by
  method, **receivables aging** (current/1–30/31–60/61–90/90+, always
  "as of now" regardless of the date filter — aging isn't period-bound),
  sales by customer/product, expenses by category/vendor, **GST summary**
  (taxable value + CGST/SGST/IGST), and **Profit & Loss** (collected
  payments − expenses). Date-range filter (defaults to the current
  month), CSV export per section
- Pure aggregation logic in `src/lib/reports/metrics.ts` and
  `src/lib/reports/aging.ts` — same "computable from plain data, unit-
  testable without a database" pattern as Phase 3/4's tax/invoice-status/
  bulk modules (16 new tests)
- Dashboard's Expenses/Net income KPIs (placeholders since Phase 2) are
  now real numbers

## Phase 6 (SaaS) — what's here

- `SubscriptionPlan` (Starter/Growth/Scale, seeded via `ensureDefaultPlans`)
  and `Subscription` (spec §21): one per business, `TRIALING → ACTIVE →
  PAST_DUE → GRACE → SUSPENDED`, or `→ CANCELED` at any point. **No
  `UsageRecord` table despite spec §21 listing one** — same "compute live,
  never denormalize" philosophy as invoice status/reports: usage is
  counted from the real rows (`Membership`, `Customer`, `Invoice`,
  `Quotation`, `BulkSendBatch`, `Expense.receiptData` bytes) every time
  (`src/lib/billing/entitlements.ts`), so it can't drift from reality
- Every business gets a 14-day trial the moment it's created
  (`getSubscription` lazily creates one on first touch, same pattern as
  Phase 3/5's reminder-rules/expense-categories seeding)
- `src/lib/billing/lifecycle.ts` — the state machine is a pure function
  (`computeLifecycleTransition`), unit-tested for every edge (7 tests):
  trial → 7-day grace → suspended; active period end → 3-day past-due →
  7-day grace → suspended; suspended/canceled never auto-transition.
  `POST /api/billing/lifecycle` (bearer-token gated, mirrors
  dotnapps-crm's `/api/automation/run`) runs it for every subscription —
  needs an external scheduler to fire automatically, there's no built-in
  cron
- Plan limits (`maxUsers`, `maxCustomers`, `maxInvoicesPerMonth`,
  `maxQuotationsPerMonth`, `maxBulkSendsPerMonth`, `maxStorageMB`) enforced
  server-side via `suspensionGuard`/`planLimitGuard`
  (`src/lib/billing/guard.ts`), wired into a **representative set** of
  mutations, not exhaustively every create action: inviting a member,
  creating a customer/invoice/quotation, starting a bulk send, and
  uploading an expense receipt. Verified live: a `SUSPENDED` override
  correctly blocked customer creation with the exact spec-worded error,
  and the customer count in the database didn't move
- `/settings/subscription` (Owner/Admin only, `billing:manage`): current
  plan + color-coded usage bars per metric, a 3-plan comparison grid with
  Upgrade/Downgrade buttons, and a "Sandbox billing" card (**no real
  payment gateway** — "Simulate payment" moves the subscription to ACTIVE
  with a fresh 30-day period, same show-a-proper-setup-state honesty rule
  as every other unbuilt integration in this app). Downgrading is blocked
  when current usage exceeds the target plan's limit for any metric, and
  the error names the specific over-limit metric. Cancelling sets
  `CANCELED` and never deletes data — verified live: cancelled the demo
  subscription, all customers/invoices were still there afterward
- `BillingBanner` (`src/components/app/billing-banner.tsx`) in the app
  shell: info for TRIALING, warning for PAST_DUE/GRACE/CANCELED, danger
  for SUSPENDED, nothing for ACTIVE — verified all five states live
- Public `/pricing` page lists the real plans/limits from the database
- Full Super Admin panel (`/admin`, `isSuperAdmin` gated), replacing the
  Phase 1–5 placeholder: platform dashboard (business/user counts,
  simulated MRR, all-time collected payments, subscriptions by status,
  invoice/quotation volume), Businesses (search, per-business usage vs.
  limits), Users (search, membership badges), Plans (full CRUD, including
  create), Subscriptions (support-only status override, explicitly
  distinct from the business-facing simulate/cancel flow), and a
  cross-business Audit log (paginated, 50/page)

## Phase 7 (Hardening) — what's here

- **Password reset** (spec §4, the one Phase 1 auth requirement that had
  been missing): `PasswordResetToken` — single-use, sha256-hashed, 1-hour
  expiry, never stores the raw token. `/forgot-password` → `/reset-
  password/[token]`, both rate-limited. Same honesty rule as team invites:
  no email provider is configured, so the generated link is shown directly
  on the confirmation screen instead of pretending an email was sent — and
  the request screen always returns the same generic message regardless of
  whether the account exists, so the form itself can't be used to
  enumerate registered emails. Verified live end-to-end: requested a
  reset, followed the link, set a new password, confirmed the old password
  no longer works and the new one does, confirmed the link can't be reused
  a second time, confirmed both steps land in the audit log
- **Security headers** (spec §28) via `next.config.ts`: CSP, X-Frame-
  Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, a
  restrictive Permissions-Policy, and HSTS — verified live via response
  headers, and confirmed the CSP doesn't break the app (no console
  violations navigating the full app)
- **Cross-tenant isolation** (spec §26 acceptance criterion) verified
  live, not just by code review: created a second business from scratch,
  then tried to open the first business's invoice detail page, invoice
  PDF route, and customer detail page by ID while authenticated as the
  second business — all three correctly returned "not found" (a custom
  `not-found.tsx`) rather than leaking data
- Structured JSON logging (`src/lib/logger.ts`) — no external error-
  tracking service is configured (same "no fake integration" rule as
  messaging/payment), so this emits real single-line JSON to stdout/
  stderr, which is what any log aggregator actually scrapes. Wired into
  `error.tsx`/`global-error.tsx` (custom error boundaries, previously
  missing — the app fell back to Next's generic unstyled error screen)
  and `/api/health`
- `/api/health` — unauthenticated liveness/readiness endpoint for load
  balancers/uptime monitors: pings the database with `SELECT 1`, returns
  503 if unreachable
- Custom `not-found.tsx` (previously missing, relied on Next's default)
- Performance indexes added per spec §21's own list (`businessId,
  createdAt` on Invoice/Quotation — the Phase 6 usage-limit checks query
  this on every guarded mutation; `businessId, dueDate` on Invoice;
  `businessId, paymentDate` on Payment)
- Accessibility: audited icon-only buttons, alert/status regions, and
  password-visibility toggles — all already had proper `aria-label`/
  `role="alert"`/`role="status"` from earlier phases, so this was mostly
  a verification pass rather than new work; no gaps found worth a
  dedicated fix
- Destructive-action confirmation (spec §24) was likewise already
  consistent app-wide (cancel invoice, reverse payment, delete expense,
  remove team member, cancel subscription all confirm) — verified rather
  than re-built
- New unit tests: `tests/unit/auth-tokens.test.ts` (6 cases — token
  hashing, expiry, single-use) — 58 tests total, all passing

## Notes / next steps

- Email/WhatsApp/SMS delivery (for invites, documents, reminders, and
  bulk sends) is stubbed as copyable text — there's no real messaging
  provider configured anywhere in the app yet, by design (spec's Master
  Vibe-Coding Instruction: show a proper setup state, don't pretend a
  message was delivered)
- Per-user granular permission overrides beyond the 5 fixed roles
- No online payment gateway yet — public invoice view shows bank/UPI details only
- Reminder rules (single or bulk) fire only when a user visits the
  relevant page or clicks "Send"/"Send now" — there's no background
  scheduler; spec's automatic timing still needs a cron endpoint (would
  mirror dotnapps-crm's `/api/automation/run` pattern) to be truly
  "automatic"
- Bulk processing is a synchronous loop per request, not a real job
  queue — fine at this data volume, but a production deployment with a
  real messaging provider (rate limits, retries, webhooks) would want an
  actual background worker (e.g. BullMQ) instead
- Receipt files live in Postgres as `Bytes` — fine at V1 scale, but a
  production deployment with many/large receipts would want real object
  storage (S3-compatible) instead of growing the database with binary blobs
- Reports have no XLSX export, only CSV (consistent with every other
  export in the app — spec allows either)
- No real payment gateway — "Simulate payment" is a sandbox stand-in;
  wiring a real processor (Razorpay/Stripe) is out of scope for V1
- Plan-limit/suspension guards are wired into 6 representative mutations
  (member invite, customer/invoice/quotation create, bulk send, expense
  receipt upload), not exhaustively every create action in the app —
  e.g. product/service creation and payment recording aren't gated
- The lifecycle cron (`/api/billing/lifecycle`) needs an external
  scheduler (cron job, GitHub Action, etc.) to actually fire — there's no
  built-in scheduler in this app, same gap as the reminder-automation
  cron noted above
- Password reset/change doesn't invalidate other already-issued JWT
  sessions (a stolen session token would stay valid for up to 30 days
  regardless) — closing this fully needs either DB-backed sessions or a
  token-versioning check added to the `jwt()` callback, which costs a DB
  read on every request; deliberately not added given the perf trade-off
- CSP allows `'unsafe-inline'` for scripts/styles (Next's own hydration/
  streaming scripts and Tailwind rely on inline styles) — a stricter
  nonce-based CSP is a follow-up, not attempted here
- No webhook idempotency tests (spec §27) — there are no real webhooks to
  test, since no payment/messaging provider is wired up; N/A until one is
- No PDF visual/snapshot regression tests — would need a visual-diff tool
  (e.g. `jest-image-snapshot`); PDFs are covered by "does the on-screen
  total match the rendered total" verification instead, done live each
  phase
- Rate limiting is in-process (a `Map`, documented in `rate-limit.ts`) —
  correct for this app's single-instance deployment model, but a
  horizontally-scaled deployment needs a shared store (Redis) instead
- Database backups: no automated backup job exists (no infra to run one
  against). For local Postgres, back up with
  `pg_dump dotnapps_invoice > backup.sql` and restore with
  `psql dotnapps_invoice < backup.sql`; a real deployment would want
  scheduled snapshots (most managed Postgres providers do this natively)
- Local Postgres via Homebrew `postgresql@16`, db `dotnapps_invoice`
- Never run `next build` while `next dev` is running against the same
  `.next` directory — stop the dev server first
- **Dev-mode gotcha hit this session:** restarting the dev server (or
  clearing `.next`) without hard-reloading an already-open browser tab
  can throw a client-side `ReferenceError` on the next Server Action
  (stale RSC client-reference manifest in that tab). It's harmless and
  local to that one tab — close and reopen it. The server-side action
  itself completes correctly regardless (check the terminal, not just the
  browser console, before assuming a real bug)
