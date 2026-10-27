# Numeric input editing correction — 25 October 2026

Fixed the default-zero editing problem across the frontend. Shared labelled inputs and 47 direct numeric editors now use `NumericInput`.

## Behavior

- Focusing/clicking an editable zero shows an empty editing draft, so typing `8` produces `8`, regardless of whether the original caret was before or after the zero. Focus does not change the parent form's stored value or fire its change handler.
- Clearing a field stays visually empty while editing even if the existing parent handler immediately converts an empty string back to numeric zero.
- Existing change and blur handlers still receive the input events. On blur the field returns to the parent's value/normalization, preserving legitimate zero amounts and existing required/min/max/step rules.
- Nonzero values retain normal cursor editing. Read-only and disabled zeros are not cleared. Decimal and negative values still follow each caller's own rules.
- Native numeric-text quantity controls retain their original text input type; explicit number controls retain number type. Phone/password/text fields do not gain numeric behavior unless explicitly marked numeric/decimal.

No API payloads, financial calculations, rounding handlers, stock limits, backend code or dependencies were changed. The page edits replace native numeric tags with the shared control and add its import; their existing attributes and handlers remain intact.

## Verification

- 23 focused event/render-prop and SSR checks cover zero replacement, backspace with parent coercion, blur/zero preservation, normal nonzero editing, decimal/negative values, disabled/read-only controls, forwarded handlers/ref/validation attributes, external stepper values, and project-wide numeric-editor coverage.
- Combined regression run: **169 passed, 0 failed** across the numeric, field settings, products, order addresses, listings, loading and invoice suites.
- Production build passed. Oxlint: **0 errors, 34 existing warnings**. Existing Vite chunk-size advisory remains.
- Browser interaction acceptance remains **NOT VERIFIED**: the browser runtime still fails before connection with the trusted-RPC dependency error. The focused tests run the actual component handlers/render props with a deterministic hook/event driver; they do not claim to be browser clicks.

## Manual check

In a price, discount, amount, stock or quantity field displaying zero: click it, type `8`, then click elsewhere. It should show `8`, not `80`. Repeat by clearing an existing value before typing. Also check an explicit zero, a permitted decimal/negative adjustment, disabled existing stock, and the quantity +/- controls.

## Files changed (26)

- `src/components/ui/NumericInput.jsx` (new shared primitive)
- `src/components/ui/Input.jsx`
- `src/features/deliveries/DeliveryDetail.jsx`
- `src/features/deliveries/RecordCollectionModal.jsx`
- `src/features/inventory/StockEntryForm.jsx`
- `src/features/invoices/CreateSalesInvoice.jsx`
- `src/features/invoices/InvoiceSettings.jsx`
- `src/features/orders/CreateSalesOrder.jsx`
- `src/features/orders/OrderDetail.jsx`
- `src/features/orders/ProductPickerList.jsx`
- `src/features/products/ProductForm.jsx`
- `src/features/purchaseReturns/PurchaseReturnFormPage.jsx`
- `src/features/purchases/PurchaseGrnPanel.jsx`
- `src/features/purchases/PurchaseInvoiceDetail.jsx`
- `src/features/purchases/PurchaseInvoiceForm.jsx`
- `src/features/quotations/QuotationFormPage.jsx`
- `src/features/reconciliation/CashReconciliation.jsx`
- `src/features/reports/FinancialReports.jsx`
- `src/features/salesReturns/SalesReturnFormPage.jsx`
- `src/features/supplierInvoices/SupplierInvoiceForm.jsx`
- `src/features/supplierPayments/RecordSupplierPaymentDrawer.jsx`
- `src/features/suppliers/SupplierForm.jsx`
- `src/features/vehicleStock/EndOfDayReturn.jsx`
- `src/features/warehouses/WarehouseDetail.jsx`
- `scripts/test-numeric-inputs.mjs` (new)
- `docs/numeric-input-editing.md` (this report)
