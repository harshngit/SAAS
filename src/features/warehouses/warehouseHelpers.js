// =============================================================================
// Warehouse - shared derivation helpers.
// -----------------------------------------------------------------------------
// Warehouse CRUD and stock aggregation are REAL backend features:
//   GET/POST   /warehouses
//   GET/PATCH/DELETE /warehouses/{id}
//   GET        /warehouses/stock            (on_hand / reserved / available / minimum_stock_level)
//
// NOT yet backed by an endpoint (demo-only / future-state):
//   - warehouse-scoped stock movement history
//   - warehouse-to-warehouse transfers (entity + lifecycle + stock transaction)
//   - dedicated warehouse permissions (mapped to the `inventory` module for now)
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

// Available = On Hand - Reserved. Status (task section 11):
//   Available <= 0                         -> Out of Stock
//   0 < Available <= Reorder Level         -> Low Stock
//   Available > Reorder Level              -> In Stock
export function availableQty(row) {
  return safeNumber(row?.onHand) - safeNumber(row?.reserved)
}

export function deriveStockStatus(row) {
  const available = availableQty(row)
  const reorder = safeNumber(row?.reorderLevel)
  if (available <= 0) return STOCK_STATUS_META.out_of_stock
  if (available <= reorder) return STOCK_STATUS_META.low_stock
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
  goods_received: 'Goods Received',
  reservation: 'Reservation',
  reservation_released: 'Reservation Released',
  vehicle_loading: 'Vehicle Loading',
  delivery_return: 'Delivery Return',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  adjustment: 'Adjustment',
}

export function movementTypeLabel(value) {
  return MOVEMENT_TYPE_LABEL[value] || value || '—'
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

// Create Transfer validation (task section 15).
export function validateTransfer({ fromWarehouse, toWarehouse, transferDate, items }) {
  if (!fromWarehouse?.id) return 'Select the source warehouse.'
  if (!toWarehouse?.id) return 'Select the destination warehouse.'
  if (fromWarehouse.id === toWarehouse.id) return 'Source and destination warehouses must be different.'
  if (fromWarehouse.isActive === false) return 'Stock cannot be transferred out of an inactive warehouse.'
  if (toWarehouse.isActive === false) return 'Stock cannot be transferred into an inactive warehouse.'
  if (!transferDate) return 'Enter a transfer date.'
  const lines = (items || []).filter((item) => safeNumber(item.quantity) > 0)
  if (lines.length === 0) return 'Add at least one item with a transfer quantity.'
  for (const item of lines) {
    if (safeNumber(item.quantity) > safeNumber(item.available)) {
      return `${item.productName || 'Item'}: transfer quantity cannot exceed the available ${safeNumber(item.available)}.`
    }
  }
  return ''
}

export const WAREHOUSE_REAL_MODE_STOCK_NOTE =
  'Warehouse inventory integration will be available once stock integration is enabled.'
export const WAREHOUSE_MOVEMENTS_NOTE =
  'Warehouse movement history will appear here once movement tracking is enabled.'
export const WAREHOUSE_TRANSFERS_NOTE =
  'Warehouse transfers will be available once transfer posting is enabled.'
