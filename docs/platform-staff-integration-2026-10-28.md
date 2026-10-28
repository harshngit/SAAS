# Platform Staff / Sales Manager integration ? 28 October 2026

Frontend implementation is complete against the supplied endpoint contract. Live end-to-end acceptance is NOT VERIFIED. The user explicitly authorized using that supplied contract when the deployed OpenAPI did not list the new platform routes.

1. Files changed (27)

- scripts/test-listing-summaries.mjs
- scripts/test-loading-layouts.mjs
- scripts/test-phone-otp.mjs
- src/api/auth.js
- src/api/billing.js
- src/api/client.js
- src/api/superadmin.js
- src/auth/ProtectedRoute.jsx
- src/auth/roles.js
- src/components/layout/Sidebar.jsx
- src/features/auth/Login.jsx
- src/features/superadmin/OrganizationDetail.jsx
- src/features/superadmin/OrganizationsList.jsx
- src/features/superadmin/UpgradeRequests.jsx
- src/routes/AppRoutes.jsx
- src/store/authStore.js
- scripts/test-platform-operations.mjs
- src/api/platform.js
- src/auth/PlatformGuard.jsx
- src/auth/platformRoles.js
- src/features/superadmin/FeatureRequests.jsx
- src/features/superadmin/OrganizationOperations.jsx
- src/features/superadmin/PlatformRequests.jsx
- src/features/superadmin/PlatformStaff.jsx
- src/features/superadmin/platformHelpers.js
- src/features/superadmin/platformPresentation.jsx
- docs/platform-staff-integration-2026-10-28.md

The pre-existing payment-history compatibility fix in src/api/supplierPayments.js and scripts/test-invoice-payment-history-ap.mjs was preserved and was not part of this integration pass. No backend code, tenant role definitions, tenant Admin menu, Product/Category/Brand code, Purchase/Finance code, plan calculations or billing calculations were changed. The billing normalizer and Super Admin error formatter were exported for reuse; their logic is unchanged.

2. Routes added

- /superadmin/staff ? Super Admin only.
- /superadmin/feature-requests ? Super Admin only.
- /superadmin/superadmins ? guarded alias; existing /superadmin/admins remains.
- /platform ? redirects to Organizations.
- /platform/organizations ? both platform roles.
- /platform/organizations/:id ? shared detail component.
- /platform/upgrade-requests ? Sales Manager's requests via mine=true.
- /platform/feature-requests ? Sales Manager's requests via mine=true.

All existing Super Admin routes remain under the Super Admin-only platform guard. The existing /superadmin/upgrade-requests route now uses the shared request workflow and request-ID approval endpoints.

3. Navigation changes

Super Admin retains Dashboard, Organizations, Upgrade Requests, Plans, Platform Analytics and Superadmins; Feature Requests and Platform Staff are inserted before Plans. The upgrade badge reads the new request queue, not legacy organization upgrade flags. Sales Manager gets only Organizations, Upgrade Requests and Feature Requests, in the existing sidebar/header shell. No separate visual theme was introduced. No optional large Sales Manager dashboard was added; landing directly on Organizations is the approved alternative in the brief.

4. Role routing

Platform identity is read from user.system_role, with organization_id=null for Sales Manager. Only super_admin and sales_manager qualify. A tenant user whose role happens to be sales_manager remains a tenant user. The internal shell key platform_sales_manager prevents collisions with tenant role keys; API staff creation still sends role=sales_manager.

Auth normalization reuses the existing auth store and getCurrentProfile. Platform home routing takes priority over tenant full_access/workspace hints, including Google callbacks through the existing home resolver. Email/phone login retain their existing authentication mechanisms. Cached/restored platform sessions are checked with /auth/me before protected pages render. Platform route changes, focus and a 60-second check revalidate the session. Focus checks preserve open forms. An inactive profile or 401 clears auth; backend session revocation remains authoritative.

5. Platform Staff

Existing header, Card, DataTable, Input, Select, Button and Modal components are reused. The plain-array list supports server search and is_active filtering. Columns: Name, Email, Phone, Sales Manager role, Active/Inactive, Last Login (Never when null), Actions. Add/edit forms validate name/email and password minimum eight characters, keep password blank on edit and expose only Sales Manager. Create uses POST /platform/staff; edit PATCHes only changed fields. Activate/deactivate PATCHes only is_active, uses a confirmation modal and refreshes the list. There is no staff hard-delete action. Deactivation explains that the user will be signed out and lose Platform Operations access. Backend 409 email and 422 field validation are displayed.

6. Organizations integration

The existing OrganizationsList and OrganizationDetail are shared by both platform roles. Reads use /platform/organizations with page/page_size/search/status/upgrade_status/sort parameters and /platform/organizations/{id}. Existing summary metrics remain independent of table filtering. Row actions for Sales Manager contain only View Organization; delete/status overrides/plan-management shortcuts and advanced entitlement controls are Super Admin-only, with handler guards as well as hidden controls.

Organization information, plan, cycle, status, trial, expiry and upgrade status are displayed from backend fields. The Features & Access section reads /platform/organizations/{id}/entitlements and resolves human-readable names/categories using /platform/features. Feature overrides are read-only in that section. Existing Super Admin advanced override controls remain available only to Super Admin; no entitlement computation was duplicated. Subscription/Billing uses /platform/organizations/{id}/subscription-payments with the existing billing response normalizer and has no new mutations. Empty text: No subscription payments found.

7. Upgrade Requests

The existing route delegates to the shared platform request component. It displays Organization, Current/Requested Plan, Billing Cycle, Requested By, Reason, Status, Created and Decision Note. Status counts, search, date filtering, sorting, export and pagination are present. Summary counts use the full scoped dataset independently of filters/search. Sales Manager's global list sends mine=true and is read-only. Organization history sends organization_id. Request Plan Upgrade loads /platform/plans, excludes the current/inactive plan, validates reason (500) and notes (2000), and submits the documented body to the organization-scoped endpoint. Success closes the modal, toasts and reloads organization/request data. Backend 400/404/409/422 messages remain visible.

8. Feature Requests

The new page shares the same table and workflow components. Feature labels come from the catalog, not hardcoded feature keys. Organization history has Plan Upgrade Requests and Feature Requests sub-tabs. The feature-change form groups options by category_name, reads current state from entitlements.features[key], suggests Unlock/Restrict appropriately and requires explicit submission. POST bodies contain entitlement_key/action/reason. Duplicate-pending and validation errors are displayed without optimistic feature changes.

9. Super Admin approval flow

Pending requests expose Approve/Reject only to Super Admin. Confirmation shows organization, plan change or feature/current state/action, requester and reason, with an optional decision note. POSTs target /platform/{upgrade|feature}-requests/{request_id}/{approve|reject}. Exact backend conflicts are retained while the queue refreshes; after a row is no longer pending its confirmation is disabled. A plan no longer being available leaves the approval error visible and does not remove the separate rejection path. Success refetches the queue and affected organization or effective entitlements. An organization detail containing the workflow also refreshes its plan/access/history. Rejections do not manually alter organization features or plan.

10. Sales Manager restrictions

No Platform Staff, Plans, Platform Analytics, Superadmins, status override, delete or direct entitlement-management controls are available. Direct /superadmin/staff, /superadmin/plans, /superadmin/admins, /superadmin/superadmins and /superadmin/analytics entries are inside the Super Admin-only guard. Tenant users cannot enter platform pages. The role and route checks do not use full_access as a platform bypass. Backend authorization remains the actual security boundary.

11. Error/state handling

New screens have loading states, empty states, backend error messages and retry controls. The shared API layer preserves backend detail and structured validation errors. A platform 401 logs out without refresh-looping; 403 shows an explicit access-denied message and does not route to a random dashboard; 409 shows the conflict and refetches applicable data. Normal tenant and email/Google API behavior is preserved. No hardcoded organization/plan/feature IDs appear in implementation code.

12. Manual QA results

All requested manual Super Admin, Sales Manager, approval-effect and viewport checks are NOT EXECUTED / NOT VERIFIED, rather than marked PASS:

- Super Admin login/navigation; multiple staff creation; duplicate email; edit; activate/deactivate; organization, plan, access, billing and request-history reads; approve/reject plan and feature requests; repeated-decision conflicts.
- Sales Manager login/sidebar; forbidden menu entries/direct URLs; read-only organization/billing/access; create/track upgrade and feature requests; duplicate requests; absence of decision controls; deactivated account/session behavior.
- Approval effects on backend plan/entitlements and unchanged state after rejection.
- Visual verification at 1366px, 1440px, tablet and mobile; screenshots and browser console evidence.

Browser initialization failed before navigation with: `failed to write kernel assets: The system cannot find the path specified. (os error 3)`. This is a tooling failure, not an application failure. No live staff, requests, subscriptions or entitlements were mutated. Browser responsive behavior is source-level only: shared responsive shell, scrollable table containers, stacked control rows and existing scrollable-body/fixed-header/footer modals are reused.

Automated verification: 252 tests passed, 0 failed. Eighteen platform tests cover identity separation, home/menu/route restrictions, auth normalization, staff list/create/changed-field PATCH/status contracts, field errors, session/403 behavior, organization queries, mine/organization history scopes, request bodies and decisions, detail/catalog/access/billing reads, actual decision handler restrictions/conflict refresh/post-approval refetch ordering, and actual Sales Manager request action menus. Existing auth, listing-summary and skeleton tests were updated for the new shared components and pass.

13. Build

npm run build: PASS. Existing large-bundle warning remains.

14. Lint

npm run lint: 0 errors, 36 existing warnings, no new warnings. Targeted changed-source lint is clean. A supplemental undefined-variable audit passed. git diff --check reports no whitespace errors.

15. Remaining known gaps

Live acceptance and deployed response compatibility remain unverified. The deployed public OpenAPI at https://crm-saas-backend.bsmart.workers.dev/openapi.json exposes system_role in UserOut but listed no /platform/* endpoints during this pass. Endpoint paths, staff/request payloads and role rules therefore follow the user-supplied contract, as explicitly authorized. List reading supports the existing plain-array/items pagination patterns and named list envelopes. Actual new platform response bodies must be checked when the backend is deployed; absent response fields show unavailable states instead of fabricated values. No frontend TODO placeholders remain. No production deploy or push was requested or performed in this pass.
