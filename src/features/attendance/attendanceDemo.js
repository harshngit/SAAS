// Local-only demo layer for the self-service Attendance screen. NEVER calls an API.
// Records use the same raw shape the backend returns so they pass through
// normalizeAttendanceRecord() unchanged (plus an `isDemo` marker + optional location).

const KEY = 'saas.attendanceDemo.v1'

const todayIso = () => new Date().toISOString().slice(0, 10)
const dayIso = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
const dayAt = (n, h, m = 0) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

function read() {
  try {
    return JSON.parse(window.localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}
function write(value) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    /* storage disabled - demo check-in just won't survive a refresh */
  }
}

export function simulateDemoCheckIn() {
  const map = read()
  map[todayIso()] = { office_check_in: new Date().toISOString(), final_check_out: null }
  write(map)
}

export function simulateDemoCheckOut() {
  const map = read()
  const today = map[todayIso()] || { office_check_in: new Date().toISOString() }
  map[todayIso()] = { ...today, final_check_out: new Date().toISOString() }
  write(map)
}

// Historical demo days (raw backend shape). Covers: complete day, incomplete day,
// location present, location absent.
const HISTORY = [
  {
    date: dayIso(1),
    office_check_in: dayAt(1, 9, 12),
    final_check_out: dayAt(1, 18, 30),
    check_in_location: 'Main Warehouse, Pune',
    check_out_location: 'Main Warehouse, Pune',
    isDemo: true,
  },
  {
    date: dayIso(2),
    office_check_in: dayAt(2, 9, 40),
    final_check_out: null, // incomplete - checked in, never checked out
    check_in_location: 'Main Warehouse, Pune',
    isDemo: true,
  },
  {
    date: dayIso(3),
    office_check_in: dayAt(3, 8, 55),
    final_check_out: dayAt(3, 17, 10),
    check_in_location: 'Baner Depot, Pune',
    check_out_location: 'Main Warehouse, Pune',
    notes: 'Covered the Baner delivery route.',
    isDemo: true,
  },
  {
    date: dayIso(4),
    office_check_in: dayAt(4, 9, 5),
    final_check_out: dayAt(4, 19, 0),
    isDemo: true, // no location data
  },
]

export function attendanceDemoResolved() {
  const sim = read()[todayIso()]
  const todayRecord = sim ? { date: todayIso(), isDemo: true, ...sim } : null
  return {
    today: todayRecord,
    history: [...(todayRecord ? [todayRecord] : []), ...HISTORY],
  }
}
