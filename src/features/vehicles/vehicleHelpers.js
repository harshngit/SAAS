// =============================================================================
// Vehicles - shared derivation helpers.
// -----------------------------------------------------------------------------
// Vehicle CRUD is a REAL backend feature:
//   GET/POST  /vehicles
//   GET/PATCH/DELETE /vehicles/{id}
//   Fields: vehicle_number (required), vehicle_type, capacity_kg,
//           default_driver_id, is_active
//
// NOT backed by the API (demo-only / future-state):
//   - vehicle name / model, capacity unit, notes
//   - a "Maintenance" state (backend only has is_active true/false)
//   - assignment history, vehicle activity/history
//   - server-side "don't use inactive/maintenance vehicles operationally" validation
//
// This file only holds pure UI logic - no API calls, no persistence.
// =============================================================================

import { safeNumber } from '../purchases/purchaseHelpers'

export const VEHICLE_STATUS_META = {
  active: { key: 'active', label: 'Active', variant: 'success' },
  inactive: { key: 'inactive', label: 'Inactive', variant: 'neutral' },
  maintenance: { key: 'maintenance', label: 'Maintenance', variant: 'warning' },
}

// Real vehicles only carry is_active; demo vehicles carry an explicit status.
export function vehicleStatus(vehicle) {
  const explicit = String(vehicle?.status || '').toLowerCase()
  if (VEHICLE_STATUS_META[explicit]) return explicit
  return vehicle?.isActive === false ? 'inactive' : 'active'
}

export function vehicleStatusMeta(vehicle) {
  return VEHICLE_STATUS_META[vehicleStatus(vehicle)] || VEHICLE_STATUS_META.active
}

// Availability is DERIVED, never manually set. A vehicle that is not Active is not
// operationally available at all.
export const AVAILABILITY_META = {
  available: { key: 'available', label: 'Available', variant: 'success' },
  assigned: { key: 'assigned', label: 'Assigned', variant: 'info' },
  unavailable: { key: 'unavailable', label: 'Unavailable', variant: 'neutral' },
}

export function deriveAvailability(vehicle) {
  if (vehicleStatus(vehicle) !== 'active') return AVAILABILITY_META.unavailable
  return vehicle?.defaultDriverId ? AVAILABILITY_META.assigned : AVAILABILITY_META.available
}

// A vehicle is operationally usable (loading / delivery) only while Active.
export function isOperationallyUsable(vehicle) {
  return vehicleStatus(vehicle) === 'active'
}

export const VEHICLE_TYPE_OPTIONS = [
  { value: 'Mini Truck', label: 'Mini Truck' },
  { value: 'Pickup', label: 'Pickup' },
  { value: 'Van', label: 'Van' },
  { value: 'Tempo', label: 'Tempo' },
  { value: 'Truck', label: 'Truck' },
  { value: 'Other', label: 'Other' },
]

export const CAPACITY_UNIT_OPTIONS = [
  { value: 'kg', label: 'kg' },
  { value: 'ton', label: 'ton' },
]

export const VEHICLE_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'maintenance', label: 'Maintenance' },
]

export const AVAILABILITY_FILTER_OPTIONS = [
  { value: 'all', label: 'All Availability' },
  { value: 'available', label: 'Available' },
  { value: 'assigned', label: 'Assigned' },
]

export const VEHICLE_TYPE_FILTER_OPTIONS = [{ value: 'all', label: 'All Types' }, ...VEHICLE_TYPE_OPTIONS]

export const VEHICLE_SORT_OPTIONS = [
  { value: 'recent', label: 'Recent' },
  { value: 'number', label: 'Vehicle Number' },
  { value: 'name', label: 'Name A–Z' },
]

export function vehicleDisplayName(vehicle) {
  return vehicle?.name?.trim() || vehicle?.vehicleType || vehicle?.vehicleNumber || 'Vehicle'
}

// Resolve a delivery-partner record to a human-readable name. The /deliveries/partners payload
// is not normalized and can put a role slug ("delivery") in `name`, so role-like values are
// rejected and we fall through: full_name -> display_name -> name -> first+last -> email.
const ROLE_LIKE = /^(delivery|delivery[\s_-]?partner|admin|administrator|sales([\s_-]?officer)?|accountant|super[\s_-]?admin|staff|user)$/i

export function partnerDisplayName(partner) {
  if (!partner) return ''
  const first = String(partner.first_name || partner.firstName || '').trim()
  const last = String(partner.last_name || partner.lastName || '').trim()
  const candidates = [
    partner.full_name || partner.fullName,
    partner.display_name || partner.displayName,
    partner.name,
    `${first} ${last}`.trim(),
    partner.email,
  ]
  const picked = candidates
    .map((value) => String(value || '').trim())
    .find((value) => value && !ROLE_LIKE.test(value))
  return picked || 'Delivery Partner'
}

export function capacityLabel(vehicle) {
  const value = safeNumber(vehicle?.capacityKg ?? vehicle?.capacity)
  if (value <= 0) return '—'
  const unit = vehicle?.capacityUnit === 'ton' ? 'ton' : 'kg'
  return `${value} ${unit}`
}

// Add / Edit validation (task sections 8 + 10). `existingNumbers` = other vehicles' numbers.
export function validateVehicle(form, { existingNumbers = [] } = {}) {
  if (!form.name?.trim()) return 'Enter the vehicle name / model.'
  if (!form.vehicleNumber?.trim()) return 'Enter the vehicle number.'
  if (!form.vehicleType?.trim()) return 'Select a vehicle type.'
  const capacity = Number(form.capacityKg)
  if (form.capacityKg !== '' && form.capacityKg !== undefined && (!Number.isFinite(capacity) || capacity < 0)) {
    return 'Capacity cannot be negative.'
  }
  const number = form.vehicleNumber.trim().toLowerCase()
  if (existingNumbers.map((value) => String(value || '').trim().toLowerCase()).includes(number)) {
    return 'A vehicle with this number already exists.'
  }
  return ''
}

// Frontend guard copy (task section 12) - not a hard block.
export function assignmentWarning(form) {
  const status = String(form?.status || (form?.isActive === false ? 'inactive' : 'active')).toLowerCase()
  if (form?.defaultDriverId && (status === 'inactive' || status === 'maintenance')) {
    return 'This vehicle will not be available for delivery operations.'
  }
  return ''
}

export const VEHICLE_ACTIVITY_NOTE = 'Vehicle activity history will appear here once operations tracking is enabled.'
export const VEHICLE_ASSIGNMENT_HISTORY_NOTE = 'Assignment history will appear here once assignment tracking is enabled.'
