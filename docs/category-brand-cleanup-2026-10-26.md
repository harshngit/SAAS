# Focused Category / Brand cleanup — 26 October 2026

## Files changed in this pass

- `src/features/categories/CategoryList.jsx`
- `src/features/brands/BrandList.jsx`
- `src/features/brands/brandCategoryMappings.js` (new)
- `scripts/test-brand-management.mjs` (new)
- `docs/category-brand-cleanup-2026-10-26.md` (this report)

Other existing workspace changes were preserved. No backend, Supplier contract, Objects & Fields contract, stock, Purchases/GRN, Product Variant or Order/Quotation code was changed in this pass.

## Category Edit cleanup

The manual Parent Category dropdown and its options were removed. Edit submission explicitly preserves the original Category's parentId, so editing a Subcategory cannot re-parent it through this form. The existing API still sends parent_id internally. Listing hierarchy, nested creation, and Product Type/Variant mappings remain intact.

## Product hierarchy audit

The current frontend already contained the new canonical flow from the preceding integration. It was inspected and retained:

- Category options are the top-level Category list, not filtered by Brand or Supplier.
- Brand choices come from `getCategoryBrands(categoryId)` / `GET /categories/{id}/brands`.
- The backend response supplies both explicit restrictions and unrestricted fallback. The frontend does not recreate that fallback or fetch associations per Brand.
- Category changes reload Brand options and clear invalid selections. Stale responses are ignored.
- An unchanged historical Product keeps its saved Brand label/value even when no longer in the effective list. After an intentional Brand change, only the effective options remain available.
- Preferred Supplier does not redefine the Category or Brand list.
- Category → Subcategory → Product Type remains independent and uses the existing canonical IDs.

No old Supplier → Brand → Category cascade remains in ProductForm.jsx. These existing source behaviors were verified, not rewritten again.

## Brand management

Brand Create/Edit now has an Applicable Categories selector with removable chips and Clear mappings. It loads the Category catalog once per editor, offers only top-level Categories, and validates the same rule before mapping requests. Existing assignments are shown from the inline Brand.categories response. Mapping controls respect the existing products.edit permission.

The helper explains that zero mappings uses the backend's default fallback for unmapped Categories. No synthetic All Categories row is created.

Saving uses the existing Brand-specific POST/DELETE mapping endpoints. It changes only this Brand's links and does not replace other Brands assigned to a Category. A fresh GET /brands snapshot identifies current mappings on each save/retry. Successful partial changes remain visible. If mapping fails after Brand creation, Retry updates the same saved Brand rather than creating another one.

The existing Categories column is retained and now shows at most three compact, truncated chips plus a +N more indicator with remaining names in its tooltip. Export still includes every assigned Category. The listing makes no association request per Brand row; the extra mapping read happens only on Save.

## Acceptance evidence

Source checks and automated execution cover:

1. No Parent Category field in Edit; the saved parent relationship is preserved.
2. Product Category options are independent of Brand and remain top-level only.
3. Explicit Brand responses are used as given.
4. Unrestricted backend fallback responses are used as given.
5. Category changes reload applicable Brands.
6. Invalid new choices clear appropriately; obsolete responses do not overwrite current choices.
7. Historical saved Brands survive unrelated edits.
8. Category/Subcategory/Product Type ID and reset behavior remains working.
9. Brand mapping rejects Subcategories and unknown IDs before mutation.
10. Categories display uses inline Brand data without N+1 row requests.
11. Add, Remove, Clear, partial-failure retry, and one-time Brand creation.

Validation:

- 69 relevant tests passed, zero failures.
- `npm run build`: passed; existing large-bundle warning remains.
- `npm run lint`: passed with zero errors and 36 existing warnings. Changed files have no warnings.
- Changed-file whitespace checks passed.

## Remaining gaps / limits

No known source-integration gaps remain for this request. Live browser acceptance is NOT VERIFIED because the browser connection is unavailable in this session. Tests used mocked API responses and exercised actual frontend handlers; they did not write to the deployed backend.

Brand mapping updates use the existing individual link/unlink endpoints and are not an atomic bulk transaction. A partial failure is reported explicitly, and a retry re-reads the actual mappings to avoid repeating completed changes.
