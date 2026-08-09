import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Ban,
  CalendarCheck,
  Clock,
  Gauge,
  UsersRound,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { getAttendance } from '../../api/attendance'
import { listUsers } from '../../api/users'
import { attendance as sampleAttendance } from '../../mockData/attendance'
import { roleLabels } from '../../auth/roles'
import { getSystemRoleFromRoleName } from '../users/userRoleUtils'
import {
  formatDateLabel,
  formatTimeLabel,
  isCheckInOnTime,
  statusVariant,
  workHoursLabel,
  workMinutes,
} from './attendanceUtils'

function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function normalizeUser(user) {
  return {
    id: user.id,
    name: user.name || '',
    role: user.role || user.system_role || getSystemRoleFromRoleName(user.role_detail?.name) || '',
    employeeId: user.employee_id || user.employeeId || '',
    photo: user.profile_photo || user.profilePhoto || '',
    phone: user.phone || '',
    email: user.email || '',
  }
}

function normalizeAttendanceRecord(record) {
  return {
    userId: record.user_id || record.userId || '',
    date: record.date || record.attendance_date || '',
    status: record.status || 'Present',
    checkIn: record.check_in || record.checkIn || null,
    checkOut: record.check_out || record.checkOut || null,
    name: record.name || '',
    role: record.role || '',
  }
}

function flattenSampleAttendance() {
  return sampleAttendance.flatMap((user) =>
    user.records.map((record) => ({
      userId: user.userId,
      name: user.name,
      role: user.role,
      ...record,
    })),
  )
}

export default function AttendanceDetail() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [allRows, setAllRows] = useState([])
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function load() {
      setIsLoading(true)

      const [attendanceResult, usersResult] = await Promise.all([getAttendance({ user_id: userId }), listUsers()])

      if (!isMounted) return

      const nextUsersById = new Map(
        usersResult.success ? usersResult.users.map((item) => [item.id, normalizeUser(item)]) : [],
      )

      setUser(nextUsersById.get(userId) || null)

      const records =
        attendanceResult.success && attendanceResult.records.length > 0
          ? attendanceResult.records.map(normalizeAttendanceRecord)
          : flattenSampleAttendance()

      setAllRows(records)
      setIsLoading(false)
    }

    load()

    return () => {
      isMounted = false
    }
  }, [userId])

  const records = useMemo(() => allRows.filter((row) => row.userId === userId), [allRows, userId])

  const fallbackFromRecord = records[0]
  const displayName = user?.name || fallbackFromRecord?.name || 'Unknown staff'
  const displayRole = user?.role || fallbackFromRecord?.role || ''
  const displayEmployeeId = user?.employeeId || userId

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [records],
  )

  const presentCount = records.filter((row) => row.status === 'Present').length
  const absentCount = records.filter((row) => row.status === 'Absent').length
  const onLeaveCount = records.filter((row) => row.status === 'On Leave').length
  const weekOffCount = records.filter((row) => row.status === 'Week Off').length

  const avgWorkingHoursLabel = useMemo(() => {
    const minutesList = records.map((row) => workMinutes(row.checkIn, row.checkOut)).filter((value) => value != null)
    if (minutesList.length === 0) return '—'
    const average = minutesList.reduce((sum, value) => sum + value, 0) / minutesList.length
    return `${Math.floor(average / 60)}h ${String(Math.round(average % 60)).padStart(2, '0')}m`
  }, [records])

  if (isLoading) {
    return <LoadingSpinner label="Loading attendance history..." />
  }

  if (records.length === 0 && !user) {
    return (
      <Card>
        <EmptyState
          icon={UsersRound}
          title="No attendance history found"
          description="This staff member has no recorded attendance yet, or the link is out of date."
          action={{ label: 'Back to Attendance', onClick: () => navigate('/admin/attendance') }}
        />
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/attendance')}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            {user?.photo ? (
              <img src={user.photo} alt="" className="size-11 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700 ring-1 ring-primary-100">
                {getInitials(displayName) || <UsersRound className="size-5" aria-hidden="true" />}
              </span>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-neutral-900">{displayName}</h1>
                <Badge variant="neutral">{displayEmployeeId}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-neutral-400">{roleLabels[displayRole] || displayRole || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card bodyClassName="flex items-center gap-3" className="p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <CalendarCheck className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-neutral-500">Present</p>
            <p className="text-xl font-semibold text-neutral-900">{presentCount}</p>
          </div>
        </Card>
        <Card bodyClassName="flex items-center gap-3" className="p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
            <Ban className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-neutral-500">Absent</p>
            <p className="text-xl font-semibold text-neutral-900">{absentCount}</p>
          </div>
        </Card>
        <Card bodyClassName="flex items-center gap-3" className="p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
            <Clock className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-neutral-500">On Leave</p>
            <p className="text-xl font-semibold text-neutral-900">{onLeaveCount}</p>
          </div>
        </Card>
        <Card bodyClassName="flex items-center gap-3" className="p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
            <UsersRound className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-neutral-500">Week Off</p>
            <p className="text-xl font-semibold text-neutral-900">{weekOffCount}</p>
          </div>
        </Card>
        <Card bodyClassName="flex items-center gap-3" className="p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200">
            <Gauge className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-neutral-500">Avg. Hours</p>
            <p className="text-xl font-semibold text-neutral-900">{avgWorkingHoursLabel}</p>
          </div>
        </Card>
      </div>

      <Card title="Attendance History" subtitle="Every recorded day for this staff member" className="p-0" bodyClassName="p-0">
        <div className="overflow-x-auto">
          {sortedRecords.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No attendance records yet" />
          ) : (
            <table className="w-full min-w-2xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="whitespace-nowrap px-5 py-3">Date</th>
                  <th className="whitespace-nowrap px-5 py-3">Status</th>
                  <th className="whitespace-nowrap px-5 py-3">Check In</th>
                  <th className="whitespace-nowrap px-5 py-3">Check Out</th>
                  <th className="whitespace-nowrap px-5 py-3">Work Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {sortedRecords.map((row) => {
                  const dateLabel = formatDateLabel(row.date)
                  const onTime = isCheckInOnTime(row.checkIn)

                  return (
                    <tr key={`${row.date}`} className="transition-colors hover:bg-primary-50/35">
                      <td className="whitespace-nowrap px-5 py-3.5 text-neutral-700">
                        <span className="block font-medium text-neutral-900">{dateLabel.full}</span>
                        <span className="block text-xs text-neutral-400">{dateLabel.weekday}</span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <Badge variant={statusVariant[row.status] || 'neutral'} dot>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">
                        {formatTimeLabel(row.checkIn) ? (
                          <span className="flex items-center gap-1.5">
                            {formatTimeLabel(row.checkIn)}
                            {onTime != null && (
                              <Badge variant={onTime ? 'success' : 'warning'} className="px-1.5 py-0.5 text-[0.62rem]">
                                {onTime ? 'On time' : 'Late'}
                              </Badge>
                            )}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">{formatTimeLabel(row.checkOut) || '-'}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-medium text-primary-700">
                        {workHoursLabel(row.checkIn, row.checkOut) || '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}
