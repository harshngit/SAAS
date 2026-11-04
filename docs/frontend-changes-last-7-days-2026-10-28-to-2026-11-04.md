# Frontend changes — last 7 days (28 October – 4 November 2026)

## How this document was put together

This repo's git history (`git log`) is real and was used as the source of truth — not guessed from file-modification times, which turned out to be unreliable (several files carry a uniform `Oct 28 09:00` timestamp block that doesn't match the content of the commits that actually introduced them, most likely from a zip re-extraction at some point).

**Important honesty note on sourcing:** everything from **2 November onward** was done by me (this assistant), in this conversation, and I can describe it first-hand in full detail. Everything **before 2 November** (28–30 October, 3 commits) was already committed to the repo before I was ever involved — I was not present for that work and have no conversation record of it. Those sections below were reconstructed by reading the actual `git show` diffs and the one contemporaneous doc that already existed (`docs/platform-staff-integration-2026-10-28.md`), not from memory or assumption. Where a commit's message was unhelpful ("added", "addedssss", "adde"), the description below reflects what the diff actually contains, not the message.

Six commits fall inside the 7-day window:

| Commit | Date | Message | What it actually contains |
|---|---|---|---|
| `ea7a5fe` | 2026-10-28 16:21 | "superadmin" | Platform Staff / Sales Manager feature (see §1) |
| `523cb52` | 2026-10-30 17:37 | "addedssss" | Self-service profile overhaul, phone OTP, customer/platform polish (see §2) |
| `a3c906f` | 2026-10-30 21:04 | "added" | `Select` creatable mode + Product UOM defaults (see §3) |
| `fef1d13` | 2026-10-30 22:59 | "done with visits okay" | Lead/visit/follow-up dual lead+customer linkage fix (see §4) |
| `f2bc65c` | 2026-11-02 15:09 | "added notifications" | Day-End feature, Expense lifecycle feature, Collections/Unsaved-Guard cleanup, Notifications groundwork — bundled together (see §5) |
| `e96a488` | 2026-11-02 15:10 | "added notificationsss" | Pure asset commit: new DM Sans web-font family added (no app logic) |

Plus **uncommitted working-tree changes** from 2–4 November (my own session work, still sitting unstaged as of this writing — see §6).

---

## §1 — Platform Staff / Sales Manager integration (28 Oct, commit `ea7a5fe`)

Full write-up already exists at `docs/platform-staff-integration-2026-10-28.md`; summarized here:

- New platform identity layer: `src/api/platform.js`, `src/auth/PlatformGuard.jsx`, `src/auth/platformRoles.js`. Platform identity is read from `user.system_role` (`super_admin` / `sales_manager`, `organization_id: null`), kept entirely separate from tenant roles via an internal `platform_sales_manager` shell key.
- New routes: `/superadmin/staff`, `/superadmin/feature-requests`, `/superadmin/superadmins` (alias), `/platform` (→ Organizations), `/platform/organizations[/:id]`, `/platform/upgrade-requests`, `/platform/feature-requests`.
- New pages: `PlatformStaff.jsx` (Super Admin staff CRUD — create/edit/activate/deactivate, no hard delete), `PlatformRequests.jsx` (shared Upgrade/Feature request queue component used by both roles), `FeatureRequests.jsx`, `OrganizationOperations.jsx`.
- `OrganizationDetail.jsx` rewritten (170 lines removed/restructured) and `UpgradeRequests.jsx` cut from 413 lines down to a thin wrapper delegating to the new shared `PlatformRequests` component.
- Sales Manager gets a restricted sidebar (Organizations / Upgrade Requests / Feature Requests only, read-only on organizations); Super Admin keeps full access plus the two new pages.
- Explicitly authorized deviation: the deployed OpenAPI didn't list the new `/platform/*` routes at the time, so endpoint paths/payloads followed a user-supplied contract instead.
- Status at the time: automated tests passed (252 passed, 0 failed), build/lint clean; **live browser acceptance was not verified** (tooling couldn't launch a browser in that environment).

---

## §2 — Self-service profile overhaul, phone OTP, customer/platform polish (30 Oct 17:37, commit `523cb52`)

Reconstructed from the diff (no contemporaneous doc existed for this commit):

- **`Profile.jsx`** grew from ~280 to ~660 lines. Every field `PATCH /auth/me` accepts is now editable by every signed-in role (tenant staff/admin, Sales Manager, Super Admin), referencing a backend contract note in the code as `crm_changes15.md`: Personal (first/last/display name, gender, DOB, marital status, blood group, nationality — `name` itself deliberately left read-only since the backend derives it from first/last name), plus photo upload/remove (`uploadMyProfilePhoto`/`removeMyProfilePhoto`, 5MB limit, JPEG/PNG/WebP only), password change (`changePassword`), and push notification controls (enable/disable, send test, via the existing `pushService`).
- **`api/auth.js`** gained ~77 lines — the `updateMyProfile`/`uploadMyProfilePhoto`/`removeMyProfilePhoto`/`changePassword` endpoints backing the above.
- **`CustomerDetail.jsx`** (184 lines changed): removed a legacy `openReceiptDocument` helper and the `getCustomerPaymentReceipt` import (dead/replaced code), added inline visit creation (`VISIT_TYPE_OPTIONS`, `createVisit` from `api/visits.js`) directly from the customer page.
- **`UserEdit.jsx`**, **`Register.jsx`**, **`Login.jsx`**, **`phoneConflict.js`**, **`roles.js`** — smaller adjustments supporting the same profile-field/phone-conflict work.
- **`PlatformStaff.jsx`**, **`OrganizationPlanAccess.jsx`**, **`SuperAdminsList.jsx`**, **`PlatformRequests.jsx`**, **`superadmin.js`**, **`platform.js`** — further polish on top of the 28 Oct platform feature (not a new feature, refinements to it).
- **`CompanySettings.jsx`**, **`OrderDetail.jsx`** — minor related touch-ups.

No independent verification record exists for this commit (no doc was written for it at the time).

---

## §3 — `Select` creatable mode + Product UOM defaults (30 Oct 21:04, commit `a3c906f`)

Small, focused UI change:

- **`components/ui/Select.jsx`** gained a `creatable` prop: when combined with `searchable`, lets the user commit free text that matches no existing option (e.g. a "create new" row in the dropdown) instead of forcing a pick from a fixed list. Menu height/row-count calculation updated to account for the extra "create" row.
- **`features/products/ProductForm.jsx`** uses this for the **Unit of Measure** field: added a fixed list of sensible defaults (Piece, Box, Carton, Dozen, Pair, Set, Pack, Bundle, Roll, Bag, Bottle, Kg, Gram, Litre, Millilitre, Meter, Centimetre, Square Feet) merged ahead of the catalog-derived suggestions — fixing the dropdown looking empty/broken for an organization's very first product (no existing products yet to derive suggestions from).
- **`components/ui/NumericInput.jsx`** — a small 6-line addition alongside the above (exact purpose not independently re-verified beyond the diff).

---

## §4 — Lead/visit/follow-up dual lead+customer linkage fix (30 Oct 22:59, commit `fef1d13`)

A correctness fix tied to the same backend contract note referenced above (`crm_changes15.md`): a lead can now be **pre-linked to a customer_id at creation without that being an actual conversion**, and a visit/follow-up row can carry **both** a `lead_id` and a `customer_id` at the same time. Several places in the UI were previously inferring "this lead is converted" or "this row is about a Lead vs a Customer" from the mere presence of an id, which is no longer safe:

- **`api/leads.js`** — `normalizeLead` now reads an explicit `is_converted` boolean from the backend (`isConverted`), rather than inferring conversion from `converted_customer_id` being present.
- **`LeadList.jsx`** — the row action menu (View Customer vs Convert to Customer) now keys off `isConverted || leadStatus === 'won'`, not `convertedCustomerId`'s mere presence; a pre-linked-but-not-converted lead now correctly keeps **both** the customer link and the Convert action available.
- **`LeadDetail.jsx`** — same correction applied to the detail page.
- **`FollowUpsList.jsx`** — `followUpNextAction`'s "is this a Lead" check changed from the display label (`contact.kind === 'Lead'`) to `Boolean(contact.leadId)`; added a `contactKind()` helper that can now return `"Lead + Customer"` when both ids are present, instead of forcing one or the other.
- **`VisitCheckIn.jsx`** — same `"Lead + Customer"` party-label fix (`visitPartyLabel()`), and the demo-mode "lead converted" override now also sets `isConverted: true` alongside the existing status fields.

No independent verification record exists for this commit either.

---

## §5 — Day-End, Expenses, Collections cleanup, Notifications groundwork (2 Nov, commits `f2bc65c` + `e96a488`)

This is one large bundled commit covering several unrelated efforts at once (plus a second, purely cosmetic commit re-adding font assets). Splitting out what's actually in it:

### 5a. Delivery Day-End — full feature (new; not something I built or observed directly)

- **`api/deliveryDayEnd.js`** (new, 252 lines) — models one day-end **session** per delivery partner per business day: `open → submitted → approved`, or `submitted → rejected → (partner corrects, resubmits) → submitted → approved`. Explicitly a separate concept from Cash/Collection Reconciliation (a session, not an individual transaction). Endpoints: `GET /delivery-day-ends/current`, `POST /delivery-day-ends/submit`, `GET /delivery-day-ends`, `GET /delivery-day-ends/{id}`, `POST /delivery-day-ends/{id}/approve`, `POST /delivery-day-ends/{id}/reject`.
- **`features/deliveries/DayEndClose.jsx`** (new, 285 lines) — Delivery Partner's "Close My Day" self-service screen: submits handed-over cash/bank/UPI/cheque/other totals against the day's deliveries.
- **`features/deliveries/DayEndApprovals.jsx`** (new, 392 lines) — Admin/Accountant approval queue: filter by status/partner/date, approve/reject with a reason, detail drawer.
- **`features/deliveries/DayEndDetailDrawer.jsx`** (new, 153 lines) — the shared read-only detail view used by the approval queue.

### 5b. Expense lifecycle — full feature (new; not something I built or observed directly)

- **`api/expenses.js`** (+88 lines) — added the reimbursement endpoint and related helpers.
- **`features/expenses/ReimburseExpenseModal.jsx`** (new) — the one real reimbursement flow (`POST /expenses/{id}/reimburse`), shared by `AdminExpenses.jsx` and `ExpenseApprovalQueue.jsx`; amount is always read-only, only ever shown for an already-approved expense.
- **`features/expenses/ExpenseHistory.jsx`** (new) — a lifecycle timeline (Submitted → Approved/Rejected → Reimbursed) that only renders steps the backend actually has a timestamp for — never fabricates an intermediate step.
- **`features/expenses/ExpenseProof.jsx`** (new) — receipt/proof viewer (image or downloadable file, demo- and real-mode aware).
- **`AdminExpenses.jsx`**, **`ExpenseApprovalQueue.jsx`**, **`MyExpenses.jsx`**, **`expenseDemo.js`** — updated to wire in the above.

### 5c. Day-End / Collections / Unsaved-Changes-Guard cleanup pass (mine — fully documented first-hand)

A targeted cleanup on top of the Day-End feature above: proper `DAY_END_CLOSED` 409 handling across every collection flow (`api/deliveryCollections.js`, `api/customerPayments.js`, `CollectionReconciliation.jsx`, `RecordCollectionModal.jsx`, `CollectPaymentDrawer.jsx`), and extending the unsaved-changes guard to sidebar navigation via a new module-level singleton (`hooks/navigationGuardStore.js`) without migrating off `BrowserRouter`. Full detail already in `docs/frontend-changes-2026-11-02-to-2026-11-04.md` §1.

### 5d. Notification system — groundwork (mine — fully documented first-hand)

The first layer of the notification integration (`api/notifications.js`'s initial shape, `notificationTypes.js`, early `NotificationsList.jsx` work, `AppRoutes.jsx` route) landed in this same commit; the full integration pass (route mapper, click behavior, platform scope filtering, etc.) is documented in full in `docs/frontend-changes-2026-11-02-to-2026-11-04.md` §2.

### 5e. `e96a488` — font assets only

Re-added a complete DM Sans web-font family (`web-fonts/DM_Sans,Open_Sans/...`, ~20 `.ttf` files + license/readme) after an accidental deletion of one font file in the same-day commit above. No application code.

---

## §6 — My own work, 2–4 November (full detail in a separate doc)

Everything from here on is work I did directly in this conversation and can vouch for completely. It is **not yet committed** — `git status` currently shows it as unstaged working-tree changes (14 modified files) plus 3 new untracked files (`src/utils/requestCache.js`, `src/components/layout/ChunkErrorBoundary.jsx`, and this doc's sibling file).

Full file-by-file detail already written up in **`docs/frontend-changes-2026-11-02-to-2026-11-04.md`** — summarized here:

1. **Day-End/Collections/Unsaved-Guard cleanup** (2 Nov) — see §5c above.
2. **Notification system integration** (2 Nov) — centralized route mapper (`utils/notificationNavigation.js`), click-to-navigate behavior, platform-vs-org scope filtering, shared type/icon map. WebSocket realtime explicitly **not** implemented — no connection URL/auth handshake was ever provided, and none was guessed.
3. **Frontend performance pass** (3 Nov) — route-level code splitting (`React.lazy()` across ~110 pages in `AppRoutes.jsx`), vendor chunking (`vite.config.js`), Firebase SDK deferred to dynamic import, `/auth/me` and `/notifications/unread-count` deduped via a new lightweight cache (`utils/requestCache.js`), Topbar's polling-effect bug fixed, the dashboard's full-order-history-walk bug fixed. **Main JS bundle: 3,658 KB / 893 KB gzip → 400 KB / 107 KB gzip.**
4. **Admin Dashboard release** (3–4 Nov) — wired the backend's new `dashboard.today` block into the "Today's Sales" card (no more client-side date filtering), added a route-level access guard (`RequireFullOrgDashboardRoute`) and mid-session-403 redirect, fixed one remaining UTC-date-shift risk, bounded the Customers/Suppliers filter-dropdown loads, moved `Suspense` inside `Layout.jsx` so Sidebar/Topbar stop unmounting on every navigation, added a chunk-load error boundary, and fixed unread-count cache invalidation on mark-read/logout.
5. **"Today's Sales" card visual fix** (4 Nov) — the scoped (non-"This Month") state of that card now shows real applied-filter and period information instead of one bare sentence in an otherwise-empty card.

All of the above: `npx oxlint` + full `npm run lint` + `npm run build` clean at every step; no live interactive browser QA was possible in this environment (flagged explicitly in the source doc).

---

## What's still genuinely unverified across the whole 7-day window

- **No live browser acceptance testing** exists for *any* of the six commits above, including mine — every pass's doc says so explicitly rather than claiming untested work as done.
- 28–30 October's three commits have **no independent doc, lint, or build record** beyond the 28 Oct platform doc — I cannot vouch for their test/build status since I wasn't there and no record survives in the repo.
- My own 2–4 November work is verified at the lint/build level only, and **is sitting uncommitted** in the working tree as of this writing.
