// =============================================================================
// Warehouse - shared derivation helpers.
// -----------------------------------------------------------------------------
// All REAL backend features now:
//   GET/POST   /warehouses
//   GET/PATCH/DELETE /warehouses/{id}
//   GET        /warehouses/stock                      (on_hand / reserved / available / minimum_stock_level)
//   POST       /warehouses/{id}/stock/adjust
//   GET        /warehouses/{id}/movements             (stock movement ledger)
//   GET/POST   /transfers                             (warehouse -> warehouse)
//   GET        /transfers/{id}
//   POST       /transfers/{id}/dispatch | /receive | /cancel
//
// Warehouse permissions are mapped to the `inventory` module (Admin/Org Admin).
//
// This file only holds pure UI logic - no API calls, no persistence.
// =============================================================================

import { safeNumber } from '../purchases/purchaseHelpers'

export const WAREHOUSE_STATUS_META = {
  active: { key: 'active', label: 'Active', variant: 'success' },
  inactive: { key: 'inactive', label: 'Inactive', variant: 'neutral' },
}

export function warehouseStatusMeta(isActive) {
  return isActive ? WAREHOUSE_STATUS_META.active : WAREHOUSE_STATUS_META.inactive
}

export const STOCK_STATUS_META = {
  in_stock: { key: 'in_stock', label: 'In Stock', variant: 'success' },
  low_stock: { key: 'low_stock', label: 'Low Stock', variant: 'warning' },
  out_of_stock: { key: 'out_of_stock', label: 'Out of Stock', variant: 'danger' },
}

export const STOCK_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Stock' },
  { value: 'in_stock', label: 'In Stock' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
]

// Prefer the backend-provided `available`; otherwise Available = On Hand - Reserved.
export function availableQty(row) {
  if (row?.available !== undefined && row?.available !== null && row?.available !== '') {
    return safeNumber(row.available)
  }
  return safeNumber(row?.onHand) - safeNumber(row?.reserved)
}

// Stock status is driven by AVAILABLE stock, never On Hand:
//   available <= 0                              -> Out of Stock
//   minimum > 0 AND available <= minimum        -> Low Stock
//   otherwise                                   -> In Stock
// A missing / zero minimum_stock_level never marks stock as Low.
export function deriveStockStatus(row) {
  const available = availableQty(row)
  const minimum = safeNumber(row?.reorderLevel)
  if (available <= 0) return STOCK_STATUS_META.out_of_stock
  if (minimum > 0 && available <= minimum) return STOCK_STATUS_META.low_stock
  return STOCK_STATUS_META.in_stock
}

// True only for the "Low Stock" band (Available > 0 AND Available <= Reorder Level). Out of
// Stock is a separate status and is NOT counted as low stock.
export function isLowStock(row) {
  return deriveStockStatus(row).key === 'low_stock'
}

// Roll-up used by the list summary cards and the detail Overview tab.
export function summarizeStock(rows) {
  const list = Array.isArray(rows) ? rows : []
  return list.reduce(
    (acc, row) => {
      const available = availableQty(row)
      return {
        products: acc.products + 1,
        onHand: acc.onHand + safeNumber(row.onHand),
        reserved: acc.reserved + safeNumber(row.reserved),
        available: acc.available + Math.max(available, 0),
        lowStock: acc.lowStock + (isLowStock(row) ? 1 : 0),
      }
    },
    { products: 0, onHand: 0, reserved: 0, available: 0, lowStock: 0 },
  )
}

export const WAREHOUSE_SORT_OPTIONS = [
  { value: 'recent', label: 'Recent' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'stock', label: 'Highest Stock' },
]

export const WAREHOUSE_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

export const MOVEMENT_TYPE_LABEL = {
  // Canonical backend movement types.
  opening: 'Opening',
  purchase_in: 'Purchase In',
  sale_out: 'Sale Out',
  delivery_out: 'Vehicle Loading / Delivery Out',
  sales_return: 'Sales Return',
  purchase_return: 'Purchase Return',
  damaged: 'Damaged',
  expired: 'Expired',
  adjustment: 'Adjustment',
  transfer_out: 'Transfer Out',
  transfer_in: 'Transfer In',
  // Legacy / demo-only labels kept so demo movement rows still render.
  goods_received: 'Goods Received',
  reservation: 'Reservation',
  reservation_released: 'Reservation Released',
  vehicle_loading: 'Vehicle Loading',
  delivery_return: 'Delivery Return',
}

export function movementTypeLabel(value) {
  if (MOVEMENT_TYPE_LABEL[value]) return MOVEMENT_TYPE_LABEL[value]
  if (!value) return '—'
  // Fallback: turn an unknown snake_case type into Title Case rather than showing the raw value.
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export const TRANSFER_STATUS_META = {
  draft: { key: 'draft', label: 'Draft', variant: 'neutral' },
  in_transit: { key: 'in_transit', label: 'In Transit', variant: 'warning' },
  received: { key: 'received', label: 'Received', variant: 'success' },
  cancelled: { key: 'cancelled', label: 'Cancelled', variant: 'neutral' },
}

export function transferStatusMeta(key) {
  return TRANSFER_STATUS_META[String(key || '').toLowerCase()] || TRANSFER_STATUS_META.draft
}

// Stock-changing / lifecycle actions allowed per status (task sections 15-18).
export function canDispatchTransfer(transfer) {
  return String(transfer?.status || '').toLowerCase() === 'draft'
}
export function canReceiveTransfer(transfer) {
  return String(transfer?.status || '').toLowerCase() === 'in_transit'
}
export function canCancelTransfer(transfer) {
  return String(transfer?.status || '').toLowerCase() === 'draft'
}

// Create Transfer validation (task section 13). `transferDate` is UI-only (demo) and never
// sent to the backend, so it is not validated here.
export function validateTransfer({ fromWarehouse, toWarehouse, items }) {
  if (!fromWarehouse?.id) return 'Select the source warehouse.'
  if (!toWarehouse?.id) return 'Select the destination warehouse.'
  if (fromWarehouse.id === toWarehouse.id) return 'Source and destination warehouses must be different.'
  if (fromWarehouse.isActive === false) return 'Stock cannot be transferred out of an inactive warehouse.'
  if (toWarehouse.isActive === false) return 'Stock cannot be transferred into an inactive warehouse.'
  const lines = (items || []).filter((item) => safeNumber(item.quantity) > 0)
  if (lines.length === 0) return 'Add at least one item with a transfer quantity.'
  for (const item of lines) {
    if (safeNumber(item.quantity) > safeNumber(item.available)) {
      return `${item.productName || 'Item'}: transfer quantity cannot exceed the available ${safeNumber(item.available)}.`
    }
  }
  return ''
}
