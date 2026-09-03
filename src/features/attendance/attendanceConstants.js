// The simplified attendance flow only ever sends these two `type` values to
// POST /attendance/check-in. "Check In" -> office_check_in, "Check Out" -> final_check_out.
//
// BACKEND LATER: the current backend enforces an ordered 4-checkpoint state machine
// (office_check_in -> departure -> return_to_office -> final_check_out) and can reject a
// direct final_check_out with "Record 'departure' before 'final_check_out'". The frontend
// does NOT paper over this by posting the intermediate checkpoints - that would write
// attendance/movement history the Delivery Partner never actually performed. The backend
// should either allow final_check_out directly after office_check_in, or expose an explicit
// check-out endpoint. Do not invent that endpoint here.
export const ATTENDANCE_CHECK_IN_TYPE = 'office_check_in'
export const ATTENDANCE_CHECK_OUT_TYPE = 'final_check_out'

export function formatTime(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
