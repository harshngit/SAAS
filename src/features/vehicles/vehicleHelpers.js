// =============================================================================
// Vehicles - shared derivation helpers.
// -----------------------------------------------------------------------------
// All REAL backend features now:
//   GET/POST         /vehicles                       (skip, limit, status, search)
//   GET/PATCH/DELETE /vehicles/{id}
//   GET              /vehicles/{id}/assignments      (assignment history)
//   GET              /vehicles/{id}/activity         (vehicle event timeline)
//   Master fields: vehicle_number, vehicle_type, capacity, capacity_unit, make,
//                  model, year, status (active|inactive|maintenance), default_driver_id, notes
//   `assigned_delivery_partner` = { id, name, email, phone } brief on list + detail.
//   Assignment = PATCH /vehicles/{id} { default_driver_id }; backend opens/closes history.
//   Backend blocks status->inactive/maintenance while an active loading session exists.
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

// Availability (task section 6): not-active -> Unavailable; active + a driver -> Assigned;
// active + no driver -> Available. A driver is present if `assigned_delivery_partner` exists
// or `default_driver_id` is set.
export function vehicleHasDriver(vehicle) {
  return Boolean(vehicle?.assignedDeliveryPartner?.id || vehicle?.assignedDeliveryPartner?.name || vehicle?.defaultDriverId)
}

export function deriveAvailability(vehicle) {
  if (vehicleStatus(vehicle) !== 'active') return AVAILABILITY_META.unavailable
  return vehicleHasDriver(vehicle) ? AVAILABILITY_META.assigned : AVAILABILITY_META.available
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

// Display name (task section 4): make + model, then vehicle_type, then number. `name` is a
// demo-only field; never a persisted real field.
export function vehicleDisplayName(vehicle) {
  const makeModel = [vehicle?.make, vehicle?.model].map((value) => String(value || '').trim()).filter(Boolean).join(' ')
  return vehicle?.name?.trim() || makeModel || vehicle?.vehicleType || vehicle?.vehicleNumber || 'Vehicle'
}

// The human-readable assigned driver - straight from the backend `assigned_delivery_partner`
// brief. Never a role slug, never a raw id.
export function assignedPartnerName(vehicle) {
  return vehicle?.assignedDeliveryPartner?.name?.trim() || 'Unassigned'
}

export const VEHICLE_ACTIVITY_LABEL = {
  vehicle_created: 'Vehicle Created',
  status_changed: 'Status Changed',
  driver_assigned: 'Driver Assigned',
  driver_unassigned: 'Driver Unassigned',
  loading_session_started: 'Loading Session Started',
  loading_session_closed: 'Loading Session Closed',
}

export function vehicleActivityLabel(type) {
  if (VEHICLE_ACTIVITY_LABEL[type]) return VEHICLE_ACTIVITY_LABEL[type]
  if (!type) return 'Activity'
  return String(type).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
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
  const value = safeNumber(vehicle?.capacity ?? vehicle?.capacityKg)
  if (value <= 0) return '—'
  const unit = String(vehicle?.capacityUnit || 'kg').trim() || 'kg'
  return `${value} ${unit}`
}

// Add / Edit validation. `existingNumbers` = other vehicles' numbers.
export function validateVehicle(form, { existingNumbers = [], requireName = false } = {}) {
  if (requireName && !form.name?.trim()) return 'Enter the vehicle name / model.'
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
