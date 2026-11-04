# Frontend changes — 2 to 4 November 2026

Five separate passes over three days, all on the `SAAS` frontend only (no backend/API contract changes in any of them unless explicitly noted). Each section below is one pass, in the order it was done, with what was implemented, how it was verified, and what's still open.

---

## 1. Day-End / Collections / Unsaved-Changes-Guard cleanup (2 Nov)

A scoped cleanup pass: handle the backend's `DAY_END_CLOSED` 409 properly across every collection flow, verify/improve the unsaved-changes guard, and extend it to sidebar navigation without a router migration.

### Implemented

- **`DAY_END_CLOSED` 409 handling** — `api/deliveryCollections.js` and `api/customerPayments.js`'s shared `collectionError()` helper now detects `detail.code === 'DAY_END_CLOSED'` first (before the existing 404/403/409/generic branches) and returns `{ code: 'DAY_END_CLOSED', error }` using the backend's own message, not a hardcoded string.
- `CollectionReconciliation.jsx`'s `runReconcile`/`runVoid` silently re-sync the list (`load()`) when blocked by a closed day-end, instead of leaving a stale row on screen.
- `RecordCollectionModal.jsx` and `CollectPaymentDrawer.jsx` both gained an `onBlocked` callback, fired on this specific error code, wired into `DeliveryDetail.jsx`, `OrderDetail.jsx`, and `DeliveryPartnerDashboard.jsx` to refresh their respective lists in the background rather than mutate local state or silently retry.
- **Unsaved-changes guard extended to sidebar navigation** — new module-level singleton `src/hooks/navigationGuardStore.js` (`registerNavigationGuard`/`clearNavigationGuard`/`getNavigationGuard`). The existing `useUnsavedChangesGuard` hook registers itself here while a form is dirty; `Sidebar.jsx`'s nav-link clicks now check this slot and intercept with the same unsaved-changes modal — all without migrating off `BrowserRouter` to `createBrowserRouter`/`useBlocker`, since exactly one route is ever mounted at a time.
- Order Create's Back button is now `disabled` while a save is in flight (duplicate-submit guard), matching the existing pattern elsewhere.

### Explicitly NOT built (reported honestly, not silently skipped)

- **Physical browser Back/Forward interception** — not implemented. `BrowserRouter` offers no safe hook into the native back/forward gesture; building one would mean manual `history.pushState` stack hacking, explicitly out of scope per instruction ("don't build fragile history hacks").

### Verification

`npx oxlint` on all 12 touched files, full `npm run lint`, `npm run build` — all clean.

---

## 2. Notification system integration (2 Nov)

Full integration against the finalized backend notification contract. Backend is the source of truth throughout — no notification rules, recipients, or events are calculated client-side.

### Implemented

- **`api/notifications.js`** — `normalizeNotification` maps every new field (`event`, `entity_type`, `entity_id`, `action_url`, `actor_id`, `organization_id`, `recipient_user_id`, `scope`) alongside the legacy ones; `action_url` is preferred over the legacy `link`, `body` is never parsed for logic. Added `deleteNotification`, `bulkDeleteNotifications`, `clearReadNotifications`.
- **`src/utils/notificationNavigation.js`** (new) — one centralized `resolveNotificationDestination(notification, {currentUser, role})` mapping all 13 backend path shapes to this app's actual per-role routes (ordered regex matchers + per-role lookup tables). A shape with no real per-id page in this app (expenses, leaves, follow-ups, payment receipts, day-end-by-id) lands on that role's nearest list page — a documented limitation, not a guessed deep link. An unrecognized shape resolves to `''` (do nothing) rather than pushing an unsupported path into the router. Also exports `isPlatformNotification` for scope filtering.
- **`src/features/notifications/notificationTypes.js`** (new) — one shared icon/badge/colour map for all 12 notification types, used by both the Topbar dropdown and the full Notifications page (no per-event component, per the spec).
- **`Topbar.jsx`** — notification click now closes the panel, fires `markNotificationRead` without awaiting it (navigation proceeds even if marking read fails), then navigates via the resolver above. Dropdown gained a retry-capable error state and per-row type icons.
- **`NotificationsList.jsx`** — same click/navigation behavior; added a "Clear read" action and per-row delete; platform-scope filtering applied defensively on top of the backend's own scoping.
- **Platform vs. org scope** — `isPlatformNotification(n) === hasPlatformAccess(currentUser)` filters both directions as a safety net, not a replacement for backend scoping.

### Explicitly deferred — WebSocket realtime

Per explicit instruction: **"True WebSocket notification realtime was not implemented because the backend connection URL and authentication handshake were not provided. No guessed connection was introduced."** The existing 60-second unread-count poll and on-open list refresh remain the only live-refresh mechanism; FCM push continues to work independently.

### Other known gaps

- `bulkDeleteNotifications` is wired at the API layer only — no multi-select UI exists to drive it.
- The full Notifications page still fetches up to 100 rows and filters/sorts client-side (deliberately not rearchitected in this pass, to avoid risking its working filter UX); the Topbar dropdown's own over-fetch was fixed (`pageSize: 10` instead of fetch-100-then-slice).

### Verification

`npx oxlint` + full `npm run lint` + `npm run build` — clean on first attempt.

---

## 3. Frontend performance pass (3 Nov)

Triggered by three measured problems on `beassuite.com/admin/dashboard`: a 3.66 MB single JS bundle with zero code splitting, `GET /auth/me` firing 3× and `GET /notifications/unread-count` firing 4× per page load, and `GET /orders?page_size=100` timing out on the dashboard.

### Root causes found

1. `AppRoutes.jsx` statically imported all ~110 page components, and `api/auth.js` → `push/pushService.js` statically imported the Firebase SDK, so both rode into the main bundle for every single visitor regardless of what page they loaded or whether push was even configured.
2. `Layout.jsx`, `AdminTrialPopup.jsx`, and `PlatformGuard.jsx` each independently called `getCurrentProfile()` (`/auth/me`) on their own mount with no shared cache.
3. `Topbar.jsx`'s unread-count poll `useEffect` was keyed on the whole `currentUser` **object** — every one of the `/auth/me` calls above replaced that object's reference, silently re-triggering the effect and firing an extra `/notifications/unread-count` call each time. The two bugs were causally linked.
4. `AdminDashboard.jsx` wasn't just calling `/orders?page_size=100` once — `loadDashboardOptions(listOrders, 'orders')` paginated through **every order the org had ever created**, 100 at a time, purely to filter client-side for "today." That's what hit the 20-second axios timeout.

### Implemented

- **Route-level code splitting** — `AppRoutes.jsx`: all ~110 page imports converted to `React.lazy()`. `Login`, `Layout`, `ProtectedRoute`/`RequirePermissionRoute`/`PlatformGuard` stay eager (shell + guards); `InvoicePrintView` (the headless backend-PDF-render target with no prior navigation to warm a lazy chunk) deliberately stays eager too.
- **Vendor chunking** — `vite.config.js` gained a `manualChunks` function splitting `vendor-react`, `vendor-router`, `vendor-charts` (recharts/d3), `vendor-utils` (zustand/date-fns) out of the page chunks.
- **Firebase deferred** — `push/firebase.js` and `push/pushService.js`'s static `firebase/app`/`firebase/messaging` imports converted to dynamic `import()`, loaded only when something actually calls push. (`xlsx`/`jspdf`/`html2canvas` were already dynamically imported — no change needed there.)
- **`/auth/me` and `/notifications/unread-count` deduped** — new `src/utils/requestCache.js`: a dependency-free in-flight-dedup + short staleTime cache (30s / 20s respectively), the explicitly-approved lightweight alternative to adding React Query/SWR. Wired into `getCurrentProfile` and `getUnreadNotificationCount`. Mutation-driven callers (`Profile.jsx`, `AdminPlans.jsx`) pass `{force: true}`; `login()`/`loginWithPhoneOtp()` always force a fresh fetch; `logout()` clears both caches.
- **Topbar polling bug fixed** — effect dependency changed from `[currentUser]` to `[currentUser?.id]`; added a `visibilitychange` listener so polling pauses on a hidden tab and catches up immediately on return.
- **Dashboard orders call bounded** — the full-history pagination loop replaced with a single `listOrders({page_size: 50, sort_by: 'created_at', sort_order: 'desc'})` call (later replaced entirely in pass 4 below).
- Added a Retry button to the dashboard's existing (already correctly isolated) partial-failure error banner.

### Verification

- `npx oxlint` + full `npm run lint` on every touched file — clean.
- `npm run build` — **main entry chunk: 3,658 KB / 893 KB gzip → 400 KB / 107 KB gzip** (~88% reduction).
- `vite preview` smoke test: deep links (`/login`, `/admin/orders`) return 200; new lazy/vendor chunks resolve at their built paths.

### Known gaps

- No sweep of `page_size` defaults on other list pages (no evidence they share the dashboard's bug).
- No live interactive click-through (login → dashboard → orders → logout, back/forward, refresh-on-deep-link) — only server-level checks were possible in this environment.

---

## 4. Admin Dashboard release — backend `today` block, access guard, chunk-error handling (3–4 Nov)

A backend release added `dashboard.today` (org-timezone "today", not the browser's) to `GET /dashboard/admin`, plus several items carried over from the performance pass above.

### Implemented

1. **"Today's Sales" card now reads `dashboard.today`, not a client-fetched order list.** The `/orders` call for this card (bounded to 50 in pass 3) is now removed entirely — `todaysSalesAmount`/`featuredOrdersCount` come straight from `dashboard.today.sales`/`dashboard.today.orders`. `delivered_orders`/`pending_orders`/`delivered_amount`/`pending_amount` are not yet in that block — a `hasDeliveryBreakdown` check (all four keys present) gates whether the Received/Pending and Delivered/Pending sub-stats render at all; no value is estimated or guessed for them. `today.date` (org-timezone) is implicitly trusted — nothing here re-derives "today" from the browser's clock.
   - Demo mode: `adminDashboardDemoData.js` gained a matching `today: {date, orders, sales}` block (computed from the existing demo order store) so demo and real mode behave identically, including both lacking the delivery breakdown for now.
2. **`api/dashboard.js`** already passed the whole raw response through (`dashboard: data`) — `today` was never being dropped. Added `status: error.response?.status` to its error return, needed for item 4 below.
3. **Route-level access guard** — new `RequireFullOrgDashboardRoute` (`src/auth/RequirePermission.jsx`) wraps `/admin/dashboard`: allowed only when `full_access` is true, or `permissions.dashboard.view` is true **and** `data_scope === 'all'`; otherwise redirects via the existing `resolveHomePath`. Standard Sales Officer/Delivery Partner logins were already blocked by `ProtectedRoute`'s role check; this closes the gap for a **custom role** whose workspace happens to resolve into the Admin shell without true org-wide scope.
4. **Mid-session 403 handling** — `AdminDashboard.jsx`'s `loadDashboard` now detects `dashboardResult.status === 403` specifically (role downgraded while the tab was already open) and shows a toast + redirects via `resolveHomePath`, instead of the generic error-with-retry box (which would just 403 again forever).
5. **No UTC conversion of server dates** — audited every date formatter in `AdminDashboard.jsx`. Found and fixed one real instance: `formatOrderDate` (used on `recent_orders[].date`) was parsing with `new Date(value)` directly (UTC-midnight parse, one-day-shift risk in negative-UTC-offset timezones) instead of the `parseLocalDate` helper the chart/cashflow date labels already correctly used. The user's own date-range *picker* selection (browser-local, not backend data) was deliberately left alone as a separate, pre-existing, out-of-scope concern.
6. **Remaining items from the earlier review, done in this release rather than deferred:**
   - **Customers/Suppliers dropdown bulk load** — same "walk every page" pattern as the orders bug, on the same page (`loadDashboardOptions(listCustomers/listSuppliers, ...)`). Replaced with single bounded calls (`page_size: 100`, the backend's documented max). Tradeoff: an org with more than 100 customers/suppliers only sees the first 100 in this scope-filter dropdown.
   - **Suspense moved inside `Layout.jsx`** — it previously wrapped the *entire* route tree in `AppRoutes.jsx`, so navigating between two in-app pages blanked Sidebar/Topbar too. Now scoped to just `<Outlet/>`, so the shell stays mounted during page loads.
   - **Chunk error boundary** — new `src/components/layout/ChunkErrorBoundary.jsx` (class component, remounted via `key={pathname}` on navigation) around that same Outlet/Suspense. Distinguishes a stale-deploy chunk-load failure ("a new version is available, reload") from any other render error (generic friendly message + Reload), instead of a blank screen.
   - **Unread-count cache invalidation** — `markNotificationRead`/`markAllNotificationsRead` now clear the 20s dedupe cache on success, so a different caller or the next poll tick can't read back a stale pre-mark-read count.
   - **Auth cache cleared on logout** — was already done for `/auth/me`; added the same `invalidateRequest` for the notifications unread-count cache so neither leaks into whoever logs in next on that browser.

### Verification

`npx oxlint` on every touched file, full `npm run lint`, `npm run build` — all clean, no bundle-size regression.

### Known gaps

- Live interactive QA (role-switch producing the 403 redirect, simulating a stale chunk) not run — static/build-level verification only.

---

## 5. "Today's Sales" card visual fix when a filter is applied (4 Nov)

Reported: selecting any filter other than the default "This Month" made the dashboard's green sales card visually collapse — a pre-existing issue (not introduced by pass 3/4 above), caused by the card's "scoped" state rendering only one bare sentence ("For the applied dates and filters.") inside the same fixed 320px-tall card that the default state fills with two full stat blocks.

### Implemented

`FeaturedSalesCard` in `AdminDashboard.jsx` now gives the scoped state real content of matching visual weight — using data the page already computes locally, nothing new or fabricated:

- Middle block: **"Applied filters"** — the actual Company/Warehouse/Customer/Supplier selections (`appliedScopeLabels`), or an explicit "across the whole organization" line when none are set.
- Bottom stat block: **"Period"** — the actual applied range label (`rangeLabel`, e.g. "This Year" or a custom date range).

Both states (default vs. scoped) now follow the same four-block layout rhythm, so applying a filter no longer looks like the card lost content.

### Verification

`npx oxlint` + `npm run build` — clean.

---

## Appendix: backend deploy log review (2 Nov, diagnosis only — no frontend code touched)

Reviewed a `crm-saas-backend` (separate repository) Cloudflare deploy transcript at the user's request. Identified four issues for that project, reported but not fixed here (wrong repo/stack for this agent to act on directly):

1. Five new `FOLLOW_UP_*` environment variables (reminder scheduling) were deployed without their Cloudflare Worker vars ever being set, despite the deploy script's own warning.
2. A later `wrangler deploy` showed a config-drift warning that would have silently wiped a manually-set `FOLLOW_UP_REMINDER_INTERVAL_SECONDS=300` from the dashboard, for the same reason.
3. `ENABLE_DOCS` was downgraded from a Cloudflare **secret** to a plain **var** by the same deploy.
4. The `/health` endpoint's `"build"` field was stale (still reporting an old, unrelated build tag), making it unreliable for confirming a given deploy actually went live.

---

## Full file list touched across all five passes

**New files:**
- `src/hooks/navigationGuardStore.js`
- `src/utils/notificationNavigation.js`
- `src/features/notifications/notificationTypes.js`
- `src/utils/requestCache.js`
- `src/components/layout/ChunkErrorBoundary.jsx`

**Modified:**
- `src/api/deliveryCollections.js`, `src/api/customerPayments.js`
- `src/features/collections/CollectionReconciliation.jsx`, `CollectPaymentDrawer.jsx`
- `src/features/deliveries/RecordCollectionModal.jsx`, `DeliveryDetail.jsx`
- `src/features/orders/OrderDetail.jsx`, `CreateSalesOrder.jsx`
- `src/features/dashboard/DeliveryPartnerDashboard.jsx`
- `src/hooks/useUnsavedChangesGuard.js`
- `src/components/layout/Sidebar.jsx`, `Topbar.jsx`, `Layout.jsx`
- `src/api/notifications.js`
- `src/features/notifications/NotificationsList.jsx`
- `src/api/auth.js`
- `src/features/profile/Profile.jsx`, `src/features/plans/AdminPlans.jsx`
- `src/push/firebase.js`, `src/push/pushService.js`
- `src/routes/AppRoutes.jsx`
- `vite.config.js`
- `src/api/dashboard.js`
- `src/features/dashboard/AdminDashboard.jsx`, `adminDashboardDemoData.js`
- `src/auth/RequirePermission.jsx`
