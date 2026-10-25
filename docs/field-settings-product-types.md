# Objects & Fields / Product Type integration — 24 October 2026

Frontend integration against the deployed backend contract. No backend code, live catalog records, field settings or stock balances were changed during verification.

## Completed behavior

- Existing controls in all nine modules consume organization field visibility: Company, Lead (create/edit), Customer (including Quick Add), Quotation, Product, Sales Order, Supplier, Purchase and Expense (self-service create/edit; the admin screen has no expense creation form).
- Hidden controls unmount, including native required inputs. Hidden-field validation errors are excluded from save guards. Existing form state remains intact; hiding a field does not clear saved values. Unknown/unavailable settings fail open. Mandatory, conditional and non-configurable catalog classifications remain visible.
- Saving Objects & Fields refreshes the shared provider. Organization changes invalidate pending responses and prevent another organization's cached visibility from being applied. Shared company phone/GST inputs respect both backend alias toggles.
- Category Create accepts comma-separated Product Types for each new subcategory, or for the category itself when it has a parent. These save through the existing `/categories/{subcategory_id}/variants` endpoint after the category exists. Partial failures retain created IDs and successful types so retry does not recreate them. Previously saved records are not rolled back.
- Product Create/Edit fetches Product Type choices from the selected subcategory. New products see active options; edit keeps an existing inactive/unavailable selection identifiable. Failed loads show an error and preserve the selection. No choices are inferred from other products.
- `product_type_id` saves/loads separately from legacy `product_type`. Clearing the ID sends null. The resolved reference name is displayed; legacy free text remains available as a fallback and is not silently converted into an ID.
- Category, subcategory, brand and supplier changes clear downstream Product Type IDs. `has_variants` has an explicit checkbox. Enabled variants show variant/stock controls and hide parent pricing; disabled variants show parent pricing and opening stock. Switching off retains unsaved row drafts until save; saving with variants off sends an empty variation list.
- Preserved the existing PATCH protection against `total_inventory` and existing variant `inventory`; added protection against replaying parent `opening_stock`. Saved opening-stock controls are disabled. A new variant may still send an opening balance, including zero. Real stock adjustments continue through Inventory.

The backend catalog includes fields that do not have controls in the existing forms. This pass wires existing form controls; it does not invent editors or payload behavior for those absent fields. Company overview metrics, supplier summaries and other read-only listing/detail data remain separate from form visibility.

## Contract and verification

Read the live public OpenAPI plus an authenticated, read-only GET of `/organizations/settings/fields`. Confirmed nine canonical module names, exact nested field keys, `product_type_id`, `product_type_ref`, and subcategory variant GET/POST shapes. Demo Admin credentials were used only in memory for those reads and were not stored in project files.

- Build: `npm.cmd run build` passed; existing large-chunk advisory remains.
- Lint: `npx.cmd oxlint src/ scripts/test-field-settings-products.mjs` — 0 errors, 34 warnings. No diagnostics in the new field-settings helpers or new test suite.
- All seven test suites: **146 passed, 0 failed**, including 18 new integration/SSR checks. API writes in tests are mocked. Existing product and delivery tests were updated for the new visibility dependency and stock-preserving backend behavior.
- Browser click/visual acceptance: **NOT VERIFIED**. Browser bootstrap still fails with the trusted-RPC dependency error. SSR checks verify rendered control presence/absence, not interactive layout or browser event execution.

## Manual acceptance

1. As Admin, open Objects & Fields. In each of the nine modules, switch off an optional field, Save, then open the matching create/edit form. Verify the whole input is absent, hidden required fields do not block saving, and locked fields cannot be hidden. Switch the field on and verify an existing record's value is retained.
2. Category Create: add a category and subcategory, then enter Product Types such as `Ceiling Fan, Table Fan` for the subcategory. Save. Alternatively, choose a Parent Category and configure types for the new subcategory itself.
3. Product Create: select the category/subcategory. Product Type should offer only its configured active choices. Choose one, save, reopen Edit, and confirm the selected ID/label survives.
4. Change the subcategory: the old Product Type clears and the new list loads. Open a legacy product without `product_type_id`: its old text should remain visible as the legacy fallback. Do not delete/recreate a legacy type to migrate it.
5. Toggle “This product has variants.” Check the parent pricing tab disappears when enabled and returns when disabled. Enter separate variant prices. Turning variants off and saving removes the saved variation set, so use a disposable test product for this acceptance case.
6. Edit an existing product without changing stock. In Network, confirm its PATCH contains neither `total_inventory` nor parent `opening_stock`, and existing variation rows contain no `inventory`. New variant rows may contain opening inventory. Use Inventory for an actual stock adjustment.

## Files changed by this pass (24)

- `src/api/categories.js`
- `src/api/products.js` (extended existing edits)
- `src/features/categories/CategoryFormPage.jsx`
- `src/features/company/CompanySettings.jsx`
- `src/features/customers/CustomerForm.jsx`
- `src/features/customers/QuickAddCustomerModal.jsx`
- `src/features/expenses/MyExpenses.jsx`
- `src/features/leads/LeadFormPage.jsx`
- `src/features/leads/LeadForms.jsx`
- `src/features/orders/CreateSalesOrder.jsx`
- `src/features/products/ProductForm.jsx` (extended existing edits)
- `src/features/products/productUtils.js`
- `src/features/purchases/PurchaseInvoiceForm.jsx`
- `src/features/quotations/QuotationFormPage.jsx`
- `src/features/settings/ObjectFieldsSettings.jsx` (extended existing edits)
- `src/features/suppliers/SupplierForm.jsx`
- `src/fieldSettings/FieldSettingsProvider.jsx` (extended existing untracked provider)
- `src/fieldSettings/ConfiguredField.jsx` (new)
- `src/fieldSettings/formFieldKeys.js` (new)
- `src/fieldSettings/useFormFieldSettings.js` (new)
- `scripts/test-field-settings-products.mjs` (new)
- `scripts/test-product-variants.mjs`
- `scripts/test-order-delivery-address.mjs`
- `docs/field-settings-product-types.md` (new)

Pre-existing edits to `package-lock.json`, `yarn.lock`, `src/App.jsx`, `CustomerDetail.jsx` and `PurchaseInvoiceDetail.jsx`, and the existing untracked `FieldSettingsContext.jsx`, were preserved without modification in this pass. No dependency changes were made.
