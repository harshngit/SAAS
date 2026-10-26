# Beas Suite CRM — Backend API Reference (from Backend to Frontend)

**From:** Backend team · **To:** Web (React) and mobile (Flutter) frontend teams

This file is the backend's list of the endpoints you build against. The backend owns it and
updates it with every backend change, so treat it as the source of truth for paths. If your
code calls something that isn't listed here, ask the backend team before you build on it.

**How to use this file:**
1. Start with **API_USAGE_GUIDE.md → "Action required"** at the top. It lists what changed in
   the backend and exactly what you need to do about it.
2. Use this file to look up paths. 🆕 marks something new, and ⚠️ marks something whose
   behaviour changed. The full request/response contract for each is in API_USAGE_GUIDE.md,
   in the section with the same number.

**Rules for every call:**
- **Base URL:** `https://crm-saas-backend.bsmart.workers.dev`
- **Authentication:** send `Authorization: Bearer <access_token>` on every call, except login,
  register, forgot/reset-password, Google sign-in and phone OTP. You get the access token from
  `POST /auth/login`, `POST /auth/phone/verify-otp` or the Google flow.
- **File uploads:** send `multipart/form-data` with the file in a field named `file`.
- **Payloads:** JSON in `snake_case`.

---

## 1. Authentication & Session
- `POST /auth/login`
- `POST /auth/register`
- ⚠️ `POST /auth/forgot-password` — `{email}` → 200, the same answer for every address; 429 when rate limited
- ⚠️ `POST /auth/reset-password` — `{token, new_password, confirm_password?}` → 200; 400 for a bad, expired or used token; 422
- 🆕 `POST /auth/phone/send-otp` — staff mobile OTP login, step 1: `{phone}` → 200 `{detail, resend_after}`
- 🆕 `POST /auth/phone/verify-otp` — step 2: `{phone, code}` → the same response as `/auth/login`
- ❌ Removed: `POST /auth/reset-password-direct` and `POST /auth/check-email`. Don't call them.
- `POST /auth/change-password`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /auth/exchange` (Google OAuth code exchange)
- `POST /auth/google/registration-info`
- `POST /auth/google/complete-registration`
- `DELETE /auth/users/{id}/permanent`

## 2. Organization / Company Settings
- `GET /organizations/settings`
- `PUT /organizations/settings`
- `GET /organizations/overview`
- `GET /organizations/me`
- `GET /organizations/settings/documents/other`
- `DELETE /organizations/settings/documents/other`
- `POST /organizations/settings/logo`
- `POST /organizations/settings/signature`
- `POST /organizations/settings/upload-file`
- `POST /organizations/settings/documents/other`
- `POST /organizations/upgrade-request`
- `GET /companies`
- `GET /organizations/settings/fields`
- `PUT /organizations/settings/fields`

## 3. Appearance / Theme
- `GET /organization/theme`
- `PATCH /organization/theme`
- `POST /organization/theme/background`
- `DELETE /organization/theme/background`
- `POST /organization/theme/reset`

## 4. Users / Staff / Employees
- `POST /users`
- `GET /users`
- `GET /users/assignable`
- `GET /users/{id}`
- `GET /users/{id}/overview`
- `PATCH /users/{id}`
- `DELETE /users/{id}`
- `POST /users/{id}/reset-password`
- `POST /users/me/location`
- `DELETE /users/{id}/documents/{field}`
- `GET /roles` (alias, also used as the staff-role catalog)

## 5. Roles & Permissions
- `GET /roles/catalog`
- `GET /roles`
- `GET /roles/{id}`
- `POST /roles`
- `PATCH /roles/{id}`
- `DELETE /roles/{id}`

## 6. Customers
- `POST /customers`
- `GET /customers`
- `GET /customers/{id}`
- `PATCH /customers/{id}`
- `DELETE /customers/{id}`
- `GET /customers/{id}/documents`
- `DELETE /customers/{id}/documents/{docId}`
- `POST /customers/{id}/payments`
- `GET /customers/{id}/payments`
- `GET /customers/{id}/account-statement`
- `GET /customers/{id}/payments/receipt/{paymentId}`
- `DELETE /customers/{id}/payments/{paymentId}`
- `GET /customers/{id}/visits`
- `GET /customers/{id}/follow-ups`
- `POST /customer-payments/collections`

## 7. Suppliers
- `POST /suppliers`
- `GET /suppliers`
- `GET /suppliers/{id}`
- `PUT /suppliers/{id}`
- `PATCH /suppliers/{id}/status`
- `DELETE /suppliers/{id}`
- `POST /suppliers/{id}/payments`
- `GET /suppliers/{id}/payments`
- `DELETE /suppliers/{id}/payments/{paymentId}`
- `GET /suppliers/{id}/products`
- `POST /suppliers/{id}/products`
- `DELETE /suppliers/{id}/products/{productId}`
- `GET /suppliers/{id}/brands`
- `POST /suppliers/{id}/brands`
- `DELETE /suppliers/{id}/brands/{brandId}`

## 8. Products
- `POST /products`
- `GET /products`
- `GET /products/{id}`
- `PATCH /products/{id}`
- `DELETE /products/{id}`
- `POST /products/bulk-delete`
- `GET /products/{id}/batches`
- `GET /products/{id}/serials`
- `GET /products/{id}/attachments`
- `POST /products/{id}/attachments`
- `DELETE /products/{id}/attachments/{attachmentId}`

## 9. Brands
- `POST /brands`
- `GET /brands`
- `GET /brands/{id}`
- `PATCH /brands/{id}`
- `DELETE /brands/{id}`
- `POST /brands/bulk-delete`
- ⚠️ `GET /brands` — each brand now also carries `categories: [{id, name}]`
- `GET /brands/{id}/categories`
- ⚠️ `POST /brands/{id}/categories` — answers 422 if you send a sub category
- `DELETE /brands/{id}/categories/{categoryId}`

## 10. Categories
- `POST /categories`
- `GET /categories`
- `GET /categories/{id}`
- `PATCH /categories/{id}`
- `DELETE /categories/{id}`
- `POST /categories/bulk-delete`
- 🆕 `GET /categories/{id}/brands` — the brands a product in this category can use
- 🆕 `PUT /categories/{id}/brands` — `{brand_ids: [...]}` replaces the category's brand list
- `GET /categories/{subcategoryId}/variants` — a sub category's Product Types
- `POST /categories/{subcategoryId}/variants`
- `PATCH /categories/{subcategoryId}/variants/{variantId}`

## 11. Warehouses, Stock & Transfers
- `GET /warehouses`
- `POST /warehouses`
- `GET /warehouses/{id}`
- `PATCH /warehouses/{id}`
- `DELETE /warehouses/{id}`
- `GET /warehouses/stock`
- `POST /warehouses/{id}/stock/adjust`
- `GET /warehouses/{id}/movements`
- `GET /transfers`
- `GET /transfers/{id}`
- `POST /transfers`
- `POST /transfers/{id}/dispatch`
- `POST /transfers/{id}/receive`
- `POST /transfers/{id}/cancel`
- `GET /inventory`
- `GET /inventory/{productId}`
- `POST /inventory/adjustments`
- `GET /inventory/expiring`
- `PATCH /inventory/{productId}`

## 12. Leads
- `GET /leads`
- `GET /leads/{id}`
- `POST /leads`
- `PATCH /leads/{id}`
- `POST /leads/{id}/convert-to-customer`
- `DELETE /leads/{id}`

## 13. Visits & Follow-ups
- `GET /visits`
- `GET /visits/{id}`
- `POST /visits`
- `PATCH /visits/{id}`
- `DELETE /visits/{id}`
- `POST /visits/{id}/follow-ups`
- `POST /follow-ups`
- `GET /follow-ups`
- `PATCH /follow-ups/{id}`
- `POST /follow-ups/{id}/complete`
- `DELETE /follow-ups/{id}`

## 14. Quotations
- `GET /quotations`
- `GET /quotations/{id}`
- `POST /quotations`
- `PATCH /quotations/{id}` (also used for status-only updates)
- `POST /quotations/{id}/convert-to-order`
- `GET /quotations/{id}/pdf`
- `DELETE /quotations/{id}`

## 15. Sales Orders
- `GET /orders`
- `GET /orders/{id}`
- `POST /orders`
- `PATCH /orders/{id}`
- `POST /orders/{id}/confirm`
- `PATCH /orders/{id}/assign-delivery-partner`
- `POST /orders/{id}/pickup/start`
- `POST /orders/{id}/pickup/ready`
- `POST /orders/{id}/pickup/confirm`
- `PATCH /orders/{id}/cancel`
- `DELETE /orders/{id}`
- `POST /orders/{id}/invoice`

## 16. Deliveries
- `GET /deliveries/partners`
- `GET /deliveries`
- `GET /deliveries/by-id/{id}`
- `POST /deliveries`
- `PATCH /deliveries/by-id/{id}`
- `POST /deliveries/{id}/load`
- `POST /deliveries/load-batch`
- `POST /deliveries/{id}/accept`
- `POST /deliveries/{id}/reject`
- `POST /deliveries/{id}/pick`
- `POST /deliveries/{id}/ready`
- `POST /deliveries/{id}/confirm`
- `GET /deliveries/{id}/challan/pdf`
- `GET /deliveries/assigned`
- `PATCH /deliveries/{orderId}/status` (legacy, kept for backward compatibility)

## 17. Delivery Collections (cash/UPI collected on delivery)
- `POST /deliveries/{id}/collections`
- `GET /deliveries/{id}/collections`
- `GET /deliveries/collections`
- `GET /deliveries/collections/{id}`
- `POST /deliveries/collections/{id}/reconcile`
- `POST /deliveries/collections/{id}/void`

## 18. Vehicles & Vehicle Stock
- `GET /vehicles`
- `POST /vehicles`
- `GET /vehicles/{id}`
- `PATCH /vehicles/{id}`
- `DELETE /vehicles/{id}`
- `GET /vehicles/{id}/assignments`
- `GET /vehicles/{id}/activity`
- `POST /vehicle-stock/loading`
- `GET /vehicle-stock/current/{deliveryPartnerId}`
- `POST /vehicle-stock/{sessionId}/extra-load`
- `POST /vehicle-stock/{sessionId}/end-of-day`
- `GET /vehicle-stock`
- `POST /vehicle-stock/{sessionId}/reconcile`
- `GET /vehicle-stock/{sessionId}/reconciliations`

## 19. Purchases & Goods Receipt (GRN)
- `GET /purchases`
- `GET /purchases/{id}`
- `POST /purchases`
- `PATCH /purchases/{id}`
- `POST /purchases/{id}/confirm`
- `POST /purchases/{id}/close`
- `PATCH /purchases/{id}/payment-status`
- `POST /purchases/{id}/cancel`
- `POST /purchases/{id}/documents`
- `POST /purchases/{id}/returns` (legacy, superseded by Purchase Returns module below)
- `DELETE /purchases/{id}`
- `GET /grns`
- `GET /grns/{id}`
- `POST /grns`
- `PATCH /grns/{id}`
- `POST /grns/{id}/confirm`
- `POST /grns/{id}/cancel`
- `DELETE /grns/{id}`

## 20. Purchase Returns
- `GET /purchase-returns`
- `GET /purchase-returns/{id}`
- `POST /purchase-returns`
- `PATCH /purchase-returns/{id}`
- `POST /purchase-returns/{id}/confirm`
- `POST /purchase-returns/{id}/dispatch`
- `POST /purchase-returns/{id}/complete`
- `POST /purchase-returns/{id}/cancel`

## 21. Sales Returns
- `GET /sales-returns`
- `GET /sales-returns/{id}`
- `POST /sales-returns`
- `PATCH /sales-returns/{id}`
- `PATCH /sales-returns/{id}/receive`
- `PATCH /sales-returns/{id}/approve`
- `PATCH /sales-returns/{id}/reject`
- `DELETE /sales-returns/{id}`

## 22. Sales Invoices & Payment Links
- `GET /invoices`
- `GET /invoices/{id}`
- `POST /invoices`
- `GET /invoices/{id}/pdf`
- `POST /invoices/{id}/credit-note`
- `GET /invoice-settings`
- `PATCH /invoice-settings`
- `POST /invoices/{id}/payment-link`
- `GET /invoices/{id}/payment-links`
- `POST /invoices/{id}/payment-links/{linkId}/cancel`
- `GET /invoices/{id}/payment-links/{linkId}/refresh`

## 23. Customer Payments (receipts ledger)
- `GET /payment-receipts`
- `GET /payment-receipts/{id}`
- `POST /payment-receipts`
- `PATCH /payment-receipts/{id}`
- `DELETE /payment-receipts/{id}`

## 24. Supplier Invoices & Accounts Payable
- `GET /supplier-invoices`
- `GET /supplier-invoices/{id}`
- `POST /supplier-invoices`
- `PUT /supplier-invoices/{id}`
- `POST /supplier-invoices/{id}/record`
- `POST /supplier-invoices/{id}/cancel`
- `DELETE /supplier-invoices/{id}`
- `GET /accounts-payable`
- `GET /accounts-payable/summary`
- `GET /accounts-payable/supplier/{supplierId}`

## 25. Supplier Payments
- `GET /supplier-payments`
- `GET /supplier-payments/{id}`
- `POST /supplier-payments`
- `POST /supplier-payments/{id}/void`
- `GET /supplier-invoices/{id}/payments`

## 26. Expenses
- `GET /expenses/categories`
- `GET /expenses`
- `GET /expenses/{id}`
- `POST /expenses`
- `PATCH /expenses/{id}`
- `POST /expenses/{id}/receipt`
- `PATCH /expenses/{id}/approve`
- `PATCH /expenses/{id}/reject`
- `PATCH /expenses/{id}/request-clarification`
- `DELETE /expenses/{id}`

## 27. Attendance
- `POST /attendance/check-in`
- `GET /attendance/me`
- `GET /attendance`

## 28. Leaves
- `POST /leaves`
- `GET /leaves/me`
- `GET /leaves`
- `GET /leaves/{id}`
- `PATCH /leaves/{id}`
- `PATCH /leaves/{id}/approve`
- `PATCH /leaves/{id}/reject`
- `DELETE /leaves/{id}`

## 29. Notifications
- `GET /notifications`
- `GET /notifications/unread-count`
- `PATCH /notifications/{id}/read`
- `PATCH /notifications/read-all`

## 30. Reports & Dashboard
- `GET /reports/{type}` (e.g. `gst-summary`, and others FinancialReports/GSTSummary ask for)
- `GET /reports/{type}/export`
- `GET /dashboard/admin`

## 31. Files
- `GET /files/{id}`
- `POST /files/upload`
- `DELETE /files/{id}`

## 32. Billing (organization's own subscription) & Payment Gateway settings
- `POST /billing/razorpay/order`
- `POST /billing/razorpay/verify`
- `GET /billing/payments`
- `GET /plans` (active subscription plans to choose from)
- `GET /settings/payment-gateway`
- `PUT /settings/payment-gateway`
- `DELETE /settings/payment-gateway`
- `POST /settings/payment-gateway/test`

## 33. Super Admin (platform-level, cross-organization)
- `GET /superadmin/organizations`
- `GET /superadmin/organizations/{id}`
- `DELETE /superadmin/organizations/{id}`
- `PATCH /superadmin/organizations/{id}/approve-upgrade`
- `PATCH /superadmin/organizations/{id}/reject-upgrade`
- `PATCH /superadmin/organizations/{id}/status`
- `GET /superadmin/admins`
- `POST /superadmin/admins`
- `PATCH /superadmin/admins/{id}`
- `DELETE /superadmin/admins/{id}`
- `GET /superadmin/plans`
- `POST /superadmin/plans`
- `PUT /superadmin/plans/{id}`
- `PATCH /superadmin/plans/{id}/status`
- `PATCH /superadmin/plans/{id}/deactivate`
- `DELETE /superadmin/plans/{id}`
- `GET /superadmin/subscription-payments`

## 34. Bulk Import (Excel, 3 modules only today)
- `GET /customers/import/template` · `POST /customers/import`
- `GET /suppliers/import/template` · `POST /suppliers/import`
- `GET /orders/import/template` · `POST /orders/import`

## 35. Object Field Settings (which fields are mandatory per module)
- `GET /organizations/settings/fields`
- `PUT /organizations/settings/fields`

---

## 36. Cash Reconciliation
The backend has a full Cash Reconciliation API. Earlier versions of this file said it didn't
exist, which was wrong. You can build against these:
- `GET /cash-reconciliation`
- `POST /cash-reconciliation`
- `GET /cash-reconciliation/{id}`
- `PATCH /cash-reconciliation/{id}`
- `DELETE /cash-reconciliation/{id}`
- `POST /cash-reconciliation/{id}/close`
- `GET /cash-reconciliation/expected`
- `GET /cash-reconciliation/preview`
- `GET /cash-reconciliation/for-date/{business_date}`

Ask the backend team for the full request/response contract before you build these screens.
