export const statusVariant = {
  Present: 'success',
  Absent: 'danger',
  'Half Day': 'warning',
  'Week Off': 'info',
  'On Leave': 'purple',
}

export function parseTimeToMinutes(value) {
  if (!value) return null

  if (/^\d{1,2}:\d{2}$/.test(value)) {
    const [hours, minutes] = value.split(':').map(Number)
    return hours * 60 + minutes
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.getHours() * 60 + date.getMinutes()
}

export function formatTimeLabel(value) {
  const minutes = parseTimeToMinutes(value)
  if (minutes == null) return null

  const hours24 = Math.floor(minutes / 60)
  const mins = minutes % 60
  const period = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  return `${String(hours12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${period}`
}

export function isCheckInOnTime(checkIn, thresholdMinutes = 9 * 60 + 30) {
  const minutes = parseTimeToMinutes(checkIn)
  return minutes == null ? null : minutes <= thresholdMinutes
}

export function workMinutes(checkIn, checkOut) {
  const inMinutes = parseTimeToMinutes(checkIn)
  const outMinutes = parseTimeToMinutes(checkOut)
  if (inMinutes == null || outMinutes == null) return null

  const diff = outMinutes - inMinutes
  return diff > 0 ? diff : null
}

export function formatMinutes(minutes) {
  if (minutes == null) return null
  return `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, '0')}m`
}

export function workHoursLabel(checkIn, checkOut) {
  return formatMinutes(workMinutes(checkIn, checkOut))
}

export function normalizeAttendanceRecord(record) {
  const checkIn = record.office_check_in || record.check_in || record.checkIn || null
  const checkOut = record.final_check_out || record.check_out || record.checkOut || null

  return {
    userId: record.user_id || record.userId || '',
    date: record.date || record.attendance_date || '',
    // Backend only records checkpoint timestamps, not an explicit status - a row only
    // exists once office_check_in has been recorded, so it always represents presence.
    status: checkIn ? 'Present' : 'Absent',
    checkIn,
    checkOut,
    departure: record.departure || null,
    returnToOffice: record.return_to_office || null,
    name: record.name || '',
    role: record.role || '',
  }
}

export function formatDateLabel(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { full: value || '—', weekday: '' }

  return {
    full: new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date),
    weekday: new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(date),
  }
}

export function toCsvValue(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function downloadCsv(filename, headers, rows) {
  const lines = [headers.map(toCsvValue).join(','), ...rows.map((row) => row.map(toCsvValue).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
