import { useEffect, useMemo, useState } from 'react'
import { Building2, CalendarCheck, LogIn, LogOut, MapPin } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { checkIn, getMyAttendance } from '../../api/attendance'
import { normalizeAttendanceRecord } from './attendanceUtils'
import { CHECKPOINTS, formatTime } from './attendanceConstants'

const checkpointIcons = {
  office_check_in: LogIn,
  departure: MapPin,
  return_to_office: Building2,
  final_check_out: LogOut,
}

const statusVariant = {
  Present: 'success',
  Absent: 'danger',
  'Half Day': 'warning',
  'Week Off': 'info',
  'On Leave': 'info',
}

const emptyToday = { office_check_in: null, departure: null, return_to_office: null, final_check_out: null }
const todayIso = () => new Date().toISOString().slice(0, 10)

export default function MyAttendance() {
  const [history, setHistory] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submittingType, setSubmittingType] = useState('')
  const [checkInError, setCheckInError] = useState('')

  const loadAttendance = async () => {
    setIsLoading(true)
    setLoadError('')

    const result = await getMyAttendance({})

    setIsLoading(false)

    if (!result.success) {
      setLoadError(result.error)
      return
    }

    setHistory(result.records)
  }

  useEffect(() => {
    loadAttendance()
  }, [])

  const today = useMemo(
    () => history.find((record) => record.date === todayIso()) || emptyToday,
    [history],
  )

  const historyRows = useMemo(() => history.map(normalizeAttendanceRecord), [history])

  const handleCheckIn = async (type) => {
    setSubmittingType(type)
    setCheckInError('')
    const result = await checkIn(type)
    setSubmittingType('')

    if (!result.success) {
      setCheckInError(result.error)
      return
    }

    await loadAttendance()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">My Attendance</h1>
        <p className="mt-1 text-sm text-neutral-500">Record today's checkpoints and review your attendance history</p>
      </div>

      <Card title="Today's Checkpoints">
        {checkInError && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {checkInError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CHECKPOINTS.map(({ type, label }) => {
            const Icon = checkpointIcons[type]
            const recordedAt = today[type]

            return (
              <div key={type} className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
                <div className="flex items-center gap-2 text-neutral-700">
                  <Icon className="size-4" aria-hidden="true" />
                  <p className="text-sm font-semibold">{label}</p>
                </div>
                <p className="mt-2 text-lg font-semibold text-neutral-900">
                  {formatTime(recordedAt) || '—'}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 w-full"
                  variant={recordedAt ? 'secondary' : 'primary'}
                  disabled={Boolean(recordedAt) || submittingType === type}
                  loading={submittingType === type}
                  onClick={() => handleCheckIn(type)}
                >
                  {recordedAt ? 'Recorded' : 'Mark now'}
                </Button>
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="Attendance History">
        {isLoading ? (
          <LoadingSpinner label="Loading attendance history..." />
        ) : loadError ? (
          <div className="py-6 text-center">
            <p className="text-sm text-red-600">{loadError}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadAttendance}>
              Retry
            </Button>
          </div>
        ) : historyRows.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="No attendance recorded yet" description="Mark today's checkpoints above to start building your history." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Check In</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Check Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {historyRows.map((record, index) => (
                  <tr key={index}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-900">{record.date}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge variant={statusVariant[record.status] || 'neutral'} dot>
                        {record.status}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-600">{formatTime(record.checkIn) || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-600">{formatTime(record.checkOut) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
