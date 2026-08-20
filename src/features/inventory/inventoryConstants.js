export const movementTypes = [
  { value: 'opening', label: 'Opening Stock', badge: 'neutral', direction: 'in' },
  { value: 'purchase_in', label: 'Purchase Receipt', badge: 'success', direction: 'in' },
  { value: 'sales_return', label: 'Sales Return', badge: 'primary', direction: 'in' },
  { value: 'sale_out', label: 'Sales Deduction', badge: 'info', direction: 'out' },
  { value: 'delivery_out', label: 'Vehicle Load', badge: 'info', direction: 'out' },
  { value: 'purchase_return', label: 'Purchase Return', badge: 'warning', direction: 'out' },
  { value: 'damaged', label: 'Damaged Stock', badge: 'danger', direction: 'out' },
  { value: 'expired', label: 'Expired Stock', badge: 'danger', direction: 'out' },
  { value: 'adjustment', label: 'Manual Adjustment', badge: 'neutral', direction: 'either' },
]

export function getMovementMeta(type) {
  return (
    movementTypes.find((entry) => entry.value === type) || {
      value: type,
      label: type,
      badge: 'neutral',
      direction: 'either',
    }
  )
}
