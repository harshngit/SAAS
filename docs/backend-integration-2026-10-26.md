# Backend integration — 26 October 2026

The supplied API_LIST.md and API_USAGE_GUIDE.md were read completely and copied byte-for-byte into the repository root. Only those two reference files were committed, in `08ee675`. The frontend implementation remains uncommitted alongside the existing workspace changes. No backend source was modified.

## Implemented

- Staff Mobile OTP retains the existing email-login session sequence and dashboard redirect. The toggle says Email / Mobile and explains that admins use email or Google. API failures include HTTP status. 400/422 remain field errors; 429 shows the server detail and reapplies the documented minimum resend cooldown without auto-retrying; 502 suggests email login; 503 hides Mobile and returns to Email for the current browser-tab session. A generic 200 never claims an account exists.
- Forgot Password displays the backend's generic response. The existing public `/reset-password?token=...` route sends token, new_password and confirm_password. A 400 shows the required expired/used-link message and a Send a new link button. Structured 422 errors map to password fields. Success clears the local session and returns to Login with the required green message.
- Duplicate staff-phone conflicts render the required message using the existing inline registration/User Create/User Edit/Profile error wiring. Email conflicts remain separate.
- User normalization preserves last_login and phone_verified, including the top-level `/auth/me` verification flag. Staff Detail shows the last login or Never, and verified phones have a badge in Staff Detail and My Profile. Verification resets when the authoritative backend response says false.
- Product Brand choices now load from GET /categories/{id}/brands. Supplier selection no longer overrides Brand options or restricts Category choices. Brand is disabled before Category selection and while its allowed list is loading. Changing Category clears disallowed brands after the new response arrives. Stale responses are ignored. An unchanged saved Brand remains visible even if inactive/unmapped; unrelated brand choices are not merged into the response. Clearing a Brand sends null. Plain and structured Brand validation errors reach the Brand field.
- Category Create and the existing Category Edit form have an Allowed brands selector for top-level categories, gated by products.edit. Explicit mappings are loaded from the inline Brand.categories links: an unrestricted effective GET response is never mistaken for a configured list. Empty selection means no restriction. Saves use PUT /categories/{id}/brands, including the specified 409 message. Partial Category creation retries retain the created parent and completed Brand mapping.
- Brands displays inline category chips and includes categories in export without issuing a request per Brand.
- Email/password and Google login API paths and success behavior were retained. No stock, Order or Quotation selection behavior was changed in this pass.

## Validation

- Full frontend regression run: 207 tests passed, zero failures.
- `npm run build`: passed; existing large-bundle warning remains.
- `npm run lint`: passed with zero errors and 36 existing warnings. Changed implementation files have no lint warnings.
- Frontend env files checked: .env, .env.local, .env.example and scripts/.env.example contain no TWILIO_* references. Secret values were not printed.
- The two supplied API documents were verified as exact byte-for-byte copies before their commit.

## Live acceptance — NOT VERIFIED

The browser could not initialize: `failed to write kernel assets: The system cannot find the path specified. (os error 3)`. This is a tooling failure, not evidence of an application failure. No SMS or reset email was sent, no account was changed on the deployed backend, and no live checks are marked passed.

Still requires live UI acceptance:

1. Registered staff number: SMS arrival, OTP sign-in and correct dashboard.
2. Admin/unregistered numbers: identical generic response and no SMS/account disclosure.
3. Wrong OTP, server rate limits and service-unavailable responses.
4. Reset email delivery, new password login, used/expired links and server-side revocation of other sessions.
5. Category Brand mappings, inactive saved Brand preservation, live 422 field errors and live concurrent-save conflicts.

The intended backend setting is `FRONTEND_RESET_URL=https://beassuite.com/reset-password`. The deployed frontend must serve this public route after the changes are deployed. The local equivalent is `http://localhost:5173/reset-password`.

## Files touched in this pass

- API_LIST.md (committed reference)
- API_USAGE_GUIDE.md (committed reference)
- src/api/auth.js
- src/api/categories.js
- src/api/products.js
- src/api/users.js
- src/store/authStore.js
- src/features/auth/Login.jsx
- src/features/auth/PhoneOtpLogin.jsx
- src/features/auth/ResetPassword.jsx
- src/utils/phoneConflict.js
- src/features/users/userRoleUtils.js
- src/features/users/UserDetail.jsx
- src/features/profile/Profile.jsx
- src/features/products/ProductForm.jsx
- src/features/categories/CategoryFormPage.jsx
- src/features/categories/CategoryList.jsx
- src/features/brands/BrandList.jsx
- src/hooks/useCategoryBrandSelection.js (new)
- src/components/ui/AllowedBrandsField.jsx (new)
- scripts/test-phone-otp.mjs
- scripts/test-field-settings-products.mjs
- scripts/test-category-brand-integration.mjs (new)
- docs/backend-integration-2026-10-26.md (this report)

Env cleanup found no remaining Twilio entries to remove in this pass; those entries had been removed in the previous auth work. Other pre-existing workspace changes were retained.
