import { useEffect, useState } from 'react'
import { Building2, LogIn, LogOut, MapPin } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { checkIn, getMyAttendance } from '../../api/attendance'
import { attendance as sampleAttendance } from '../../mockData/attendance'
import { useAuthStore } from '../../store/authStore'
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

export default function MyAttendance() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const [today, setToday] = useState(emptyToday)
  const [history, setHistory] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [submittingType, setSubmittingType] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadAttendance() {
      setIsLoading(true)

      const result = await getMyAttendance({})

      if (!isMounted) return
      setIsLoading(false)

      if (result.success && result.records.length > 0) {
        setHistory(result.records)
        return
      }

      const sample = sampleAttendance.find((entry) => entry.role === currentUser?.role) || sampleAttendance[0]
      setHistory(sample?.records || [])
    }

    loadAttendance()

    return () => {
      isMounted = false
    }
  }, [currentUser?.role])

  const handleCheckIn = async (type) => {
    setSubmittingType(type)
    const result = await checkIn(type)
    setSubmittingType('')

    const timestamp = result.success ? result.record?.timestamp || new Date().toISOString() : new Date().toISOString()
    setToday((current) => ({ ...current, [type]: timestamp }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">My Attendance</h1>
        <p className="mt-1 text-sm text-neutral-500">Record today's checkpoints and review your attendance history</p>
      </div>

      <Card title="Today's Checkpoints">
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
                {history.map((record, index) => (
                  <tr key={index}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-900">{record.date}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge variant={statusVariant[record.status] || 'neutral'} dot>
                        {record.status}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-600">{record.checkIn || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-600">{record.checkOut || '-'}</td>
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
