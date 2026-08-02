export const CHECKPOINTS = [
  { type: 'office_check_in', label: 'Office Check-In' },
  { type: 'departure', label: 'Departure' },
  { type: 'return_to_office', label: 'Return to Office' },
  { type: 'final_check_out', label: 'Final Check-Out' },
]

export function formatTime(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
