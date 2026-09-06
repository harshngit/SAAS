// =============================================================================
// FRONTEND DEMO VEHICLES - UI TESTING ONLY
// -----------------------------------------------------------------------------
// Ids are prefixed `demo-veh-` so they can never be mistaken for a real backend
// id. Drivers reference the shared demo delivery partners (demo-dp-*). Real
// vehicles use the live /vehicles API; nothing here touches it.
//
// The demo layer carries fields the backend does not (name/model, capacity unit,
// a Maintenance state, notes) plus a lightweight assignment + activity history.
// =============================================================================

import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'
import { DEMO_DELIVERY_PARTNERS } from '../orders/orderDemoData'

export const VEHICLES_DEMO_ENABLED = DEMO_MODE && !DEMO_EMPTY

export function isDemoVehicle(id) {
  return typeof id === 'string' && id.startsWith('demo-veh-')
}

export function getDemoDeliveryPartners() {
  return DEMO_DELIVERY_PARTNERS.map((partner) => ({ id: partner.id, name: partner.name, isActive: true }))
}

const SEED_VEHICLES = [
  {
    id: 'demo-veh-1',
    name: 'Tata Ace Gold',
    vehicleNumber: 'MH-02-AB-1234',
    vehicleType: 'Mini Truck',
    capacityKg: 750,
    capacityUnit: 'kg',
    make: 'Tata',
    model: 'Ace Gold',
    year: 2023,
    defaultDriverId: 'demo-dp-ravi',
    status: 'active',
    isActive: true,
    notes: 'Primary city-delivery vehicle.',
    createdAt: '2026-01-12T09:00:00.000Z',
    updatedAt: '2026-08-20T10:00:00.000Z',
    assignedOn: '2026-06-01',
  },
  {
    id: 'demo-veh-2',
    name: 'Mahindra Bolero Pickup',
    vehicleNumber: 'MH-04-KL-5678',
    vehicleType: 'Pickup',
    capacityKg: 1000,
    capacityUnit: 'kg',
    make: 'Mahindra',
    model: 'Bolero Pickup',
    year: 2022,
    defaultDriverId: '',
    status: 'active',
    isActive: true,
    notes: '',
    createdAt: '2026-02-18T09:00:00.000Z',
    updatedAt: '2026-08-10T09:00:00.000Z',
    assignedOn: '',
  },
  {
    id: 'demo-veh-3',
    name: 'Ashok Leyland Dost',
    vehicleNumber: 'MH-12-CD-9012',
    vehicleType: 'Mini Truck',
    capacityKg: 1200,
    capacityUnit: 'kg',
    make: 'Ashok Leyland',
    model: 'Dost',
    year: 2021,
    defaultDriverId: '',
    status: 'maintenance',
    isActive: true,
    notes: 'In for clutch replacement — expected back next week.',
    createdAt: '2026-03-05T09:00:00.000Z',
    updatedAt: '2026-08-28T09:00:00.000Z',
    assignedOn: '',
  },
]

const OVERRIDE_KEY = 'saas.vehicleDemoOverride.v1'
const CUSTOM_KEY = 'saas.vehicleDemoCustom.v1'
const ASSIGNMENT_LOG_KEY = 'saas.vehicleDemoAssignmentLog.v1'

function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key))
    return parsed ?? fallback
  } catch {
    return fallback
  }
}
function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage disabled - demo edits just won't persist across refresh */
  }
}
const readOverrides = () => readJson(OVERRIDE_KEY, {})
const readCustom = () => (Array.isArray(readJson(CUSTOM_KEY, [])) ? readJson(CUSTOM_KEY, []) : [])
const readAssignmentLog = () => (Array.isArray(readJson(ASSIGNMENT_LOG_KEY, [])) ? readJson(ASSIGNMENT_LOG_KEY, []) : [])

function driverName(driverId) {
  return getDemoDeliveryPartners().find((partner) => partner.id === driverId)?.name || '—'
}

export function getDemoVehicles() {
  const overrides = readOverrides()
  return [...SEED_VEHICLES, ...readCustom()].map((vehicle) =>
    overrides[vehicle.id] ? { ...vehicle, ...overrides[vehicle.id] } : vehicle,
  )
}

export function getDemoVehicle(id) {
  return getDemoVehicles().find((vehicle) => vehicle.id === id) || null
}

export function patchDemoVehicle(id, partial) {
  if (!isDemoVehicle(id)) return
  const before = getDemoVehicle(id)
  const map = readOverrides()
  map[id] = { ...(map[id] || {}), ...partial, updatedAt: new Date().toISOString() }
  writeJson(OVERRIDE_KEY, map)

  // Log an assignment change if the driver moved.
  if (partial.defaultDriverId !== undefined && before && partial.defaultDriverId !== before.defaultDriverId) {
    const log = readAssignmentLog()
    const now = new Date().toISOString().slice(0, 10)
    if (before.defaultDriverId) {
      log.push({ id: `demo-va-${Date.now().toString(36)}-u`, vehicleId: id, date: now, driverName: driverName(before.defaultDriverId), action: 'Unassigned', performedBy: 'Admin User' })
    }
    if (partial.defaultDriverId) {
      log.push({ id: `demo-va-${Date.now().toString(36)}-a`, vehicleId: id, date: now, driverName: driverName(partial.defaultDriverId), action: 'Assigned', performedBy: 'Admin User' })
    }
    writeJson(ASSIGNMENT_LOG_KEY, log)
  }
}

export function createDemoVehicle(data) {
  const list = readCustom()
  const now = new Date().toISOString()
  const record = {
    id: `demo-veh-custom-${Date.now().toString(36)}`,
    status: 'active',
    isActive: true,
    capacityUnit: 'kg',
    defaultDriverId: '',
    createdAt: now,
    updatedAt: now,
    ...data,
  }
  writeJson(CUSTOM_KEY, [...list, record])
  return record
}

// Current assignment + any logged history for one vehicle.
export function getDemoVehicleAssignments(vehicleId) {
  const vehicle = getDemoVehicle(vehicleId)
  const history = readAssignmentLog()
    .filter((entry) => entry.vehicleId === vehicleId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Seed the initial assignment for demo-veh-1 so history is never empty when it matters.
  if (vehicleId === 'demo-veh-1' && !history.some((entry) => entry.action === 'Assigned')) {
    history.push({ id: 'demo-va-seed-1', vehicleId, date: '2026-06-01', driverName: 'Ravi Kumar', action: 'Assigned', performedBy: 'Admin User' })
  }

  return {
    current: vehicle?.defaultDriverId
      ? { driverName: driverName(vehicle.defaultDriverId), assignedOn: vehicle.assignedOn || '', status: 'Active' }
      : null,
    history: history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  }
}

// Demo vehicle activity - illustrative operational references (loading / dispatch / EOD).
export function getDemoVehicleActivity(vehicleId) {
  if (vehicleId === 'demo-veh-1') {
    return [
      { id: 'demo-vact-1', date: '2026-08-19', activity: 'Vehicle Loaded', reference: 'VL-2026-041', warehouse: 'Central Mumbai Warehouse', deliveryPartner: 'Ravi Kumar' },
      { id: 'demo-vact-2', date: '2026-08-19', activity: 'Delivery Dispatched', reference: 'DLV-2026-118', warehouse: 'Central Mumbai Warehouse', deliveryPartner: 'Ravi Kumar' },
      { id: 'demo-vact-3', date: '2026-08-19', activity: 'EOD Return Completed', reference: 'EOD-2026-041', warehouse: 'Central Mumbai Warehouse', deliveryPartner: 'Ravi Kumar' },
    ]
  }
  return []
}
