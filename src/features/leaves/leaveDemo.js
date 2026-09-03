// Local-only demo layer for the self-service Leaves screen. NEVER calls an API.
// Objects match the normalizeLeave() output shape so the page renders them directly.

const KEY = 'saas.leaveDemo.v1' // { created: [leave], cancelled: [id] }

const DEMO_USER = { id: 'demo-user-ravi', name: 'Ravi Kumar' }

const iso = (offsetDays) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}
const daysBetween = (start, end) => {
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(Math.round((b - a) / 86_400_000) + 1, 0)
}
const stamp = (offsetDays) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString()
}

function read() {
  try {
    return JSON.parse(window.localStorage.getItem(KEY)) || { created: [], cancelled: [] }
  } catch {
    return { created: [], cancelled: [] }
  }
}
function write(value) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    /* storage disabled - demo leave edits just won't survive a refresh */
  }
}

function leave({ id, leaveType, start, end, reason, status, approverName = '', rejectReason = '', createdOffset }) {
  return {
    id,
    userId: DEMO_USER.id,
    userName: DEMO_USER.name,
    userEmail: '',
    leaveType,
    startDate: start,
    endDate: end,
    daysCount: daysBetween(start, end),
    reason,
    status,
    approvedBy: approverName ? 'demo-mgr' : '',
    approverName,
    rejectReason,
    createdAt: stamp(createdOffset),
    updatedAt: status === 'pending' ? stamp(createdOffset) : stamp(createdOffset + 1),
    isDemo: true,
  }
}

const STATIC = [
  leave({ id: 'demo-lv-1', leaveType: 'casual', start: iso(3), end: iso(3), reason: 'Personal errand', status: 'pending', createdOffset: -1 }),
  leave({ id: 'demo-lv-2', leaveType: 'annual', start: iso(12), end: iso(14), reason: 'Family function out of town', status: 'pending', createdOffset: -2 }),
  leave({ id: 'demo-lv-3', leaveType: 'sick', start: iso(-20), end: iso(-19), reason: 'Fever, advised rest', status: 'approved', approverName: 'Operations Manager', createdOffset: -22 }),
  leave({ id: 'demo-lv-4', leaveType: 'casual', start: iso(-6), end: iso(-6), reason: 'Personal work', status: 'rejected', rejectReason: 'Peak delivery week — please re-plan for later.', createdOffset: -8 }),
]

export function demoLeavesResolved() {
  const { created, cancelled } = read()
  return [...created, ...STATIC]
    .filter((l) => !cancelled.includes(l.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function simulateDemoCreateLeave({ leaveType, startDate, endDate, reason }) {
  const { created, cancelled } = read()
  const record = leave({
    id: `demo-lv-${Date.now().toString(36)}`,
    leaveType,
    start: startDate,
    end: endDate,
    reason,
    status: 'pending',
    createdOffset: 0,
  })
  write({ created: [record, ...created], cancelled })
  return record
}

export function simulateDemoCancelLeave(id) {
  const { created, cancelled } = read()
  write({ created, cancelled: [...new Set([...cancelled, id])] })
}
