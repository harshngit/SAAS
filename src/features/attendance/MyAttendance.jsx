import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarCheck, Clock, LogIn, LogOut, MapPin } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { checkIn, getMyAttendance } from '../../api/attendance'
import { attendanceLifecycleLabel, durationLabel, normalizeAttendanceRecord } from './attendanceUtils'
import { ATTENDANCE_CHECK_IN_TYPE, ATTENDANCE_CHECK_OUT_TYPE, formatTime } from './attendanceConstants'
import { attendanceDemoResolved, simulateDemoCheckIn, simulateDemoCheckOut } from './attendanceDemo'
import { useToast } from '../../components/ui/toastContext'

const LIFECYCLE_VARIANT = {
  not_checked_in: 'neutral',
  checked_in: 'success',
  checked_out: 'info',
}

const todayIso = () => new Date().toISOString().slice(0, 10)

function fullDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || '—'
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function TodayCard({ record, onCheckIn, onCheckOut, isActing, now }) {
  const lifecycle = record?.lifecycle || 'not_checked_in'
  const activeEnd = lifecycle === 'checked_in' ? now : record?.checkOut
  const duration = durationLabel(record?.checkIn, activeEnd)

  return (
    <Card title="Today's Attendance" subtitle={fullDate(todayIso())}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-[0.7rem] text-neutral-400">Status</p>
          <Badge variant={LIFECYCLE_VARIANT[lifecycle]} dot>{attendanceLifecycleLabel(lifecycle)}</Badge>
        </div>
        <div>
          <p className="text-[0.7rem] text-neutral-400">Check In</p>
          <p className="text-sm font-semibold text-neutral-900">{formatTime(record?.checkIn) || '—'}</p>
        </div>
        <div>
          <p className="text-[0.7rem] text-neutral-400">Check Out</p>
          <p className="text-sm font-semibold text-neutral-900">{formatTime(record?.checkOut) || '—'}</p>
        </div>
        <div>
          <p className="text-[0.7rem] text-neutral-400">{lifecycle === 'checked_in' ? 'Active Duration' : 'Total Duration'}</p>
          <p className="text-sm font-semibold text-neutral-900">{duration || '—'}</p>
        </div>
      </div>

      <div className="mt-5">
        {lifecycle === 'not_checked_in' && (
          <Button type="button" loading={isActing} onClick={onCheckIn}>
            <LogIn className="size-4" aria-hidden="true" />
            Check In
          </Button>
        )}
        {lifecycle === 'checked_in' && (
          <Button type="button" variant="secondary" loading={isActing} onClick={onCheckOut}>
            <LogOut className="size-4" aria-hidden="true" />
            Check Out
          </Button>
        )}
        {lifecycle === 'checked_out' && (
          <p className="flex items-center gap-2 text-sm text-neutral-500">
            <Clock className="size-4" aria-hidden="true" />
            Attendance complete for today.
          </p>
        )}
      </div>
    </Card>
  )
}

function DetailModal({ record, onClose }) {
  return (
    <Modal isOpen={Boolean(record)} onClose={onClose} title="Attendance details" size="lg">
      {record && (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" value={fullDate(record.date)} />
            <Field label="Status" value={attendanceLifecycleLabel(record.lifecycle)} />
            <Field label="Check In" value={formatTime(record.checkIn) || '—'} />
            <Field label="Check Out" value={formatTime(record.checkOut) || '—'} />
            <Field label="Total Duration" value={durationLabel(record.checkIn, record.checkOut) || '—'} />
          </div>
          {(record.checkInLocation || record.checkOutLocation) && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Check-In Location" value={record.checkInLocation || '—'} icon={MapPin} />
              <Field label="Check-Out Location" value={record.checkOutLocation || '—'} icon={MapPin} />
            </div>
          )}
          {record.notes && <Field label="Notes" value={record.notes} />}
        </div>
      )}
    </Modal>
  )
}

function Field({ label, value, icon: Icon }) {
  return (
    <div>
      <p className="text-[0.7rem] text-neutral-400">{label}</p>
      <p className="flex items-center gap-1.5 font-medium text-neutral-900">
        {Icon && <Icon className="size-3.5 text-neutral-400" aria-hidden="true" />}
        {value}
      </p>
    </div>
  )
}

export default function MyAttendance() {
  const { showToast } = useToast()
  const [rawRecords, setRawRecords] = useState([])
  const [demo, setDemo] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isActing, setIsActing] = useState(false)
  const [actionError, setActionError] = useState('')
  const [checkOutGap, setCheckOutGap] = useState(false)
  const [detailRecord, setDetailRecord] = useState(null)
  const [now, setNow] = useState(() => new Date().toISOString())

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    const result = await getMyAttendance({})

    if (!result.success) {
      setDemo(false)
      setRawRecords([])
      setLoadError(result.error)
      setIsLoading(false)
      return
    }

    if (result.records.length === 0) {
      // No real attendance yet - show the demo world so the flow stays testable.
      setDemo(true)
      setRawRecords(attendanceDemoResolved().history)
      setIsLoading(false)
      return
    }

    setDemo(false)
    setRawRecords(result.records)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const records = useMemo(
    () =>
      [...rawRecords]
        .map(normalizeAttendanceRecord)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [rawRecords],
  )
  const todayRecord = records.find((r) => r.date === todayIso()) || null

  // Live "active duration" tick while checked in (once a minute - no need for seconds).
  useEffect(() => {
    if (todayRecord?.lifecycle !== 'checked_in') return
    const id = setInterval(() => setNow(new Date().toISOString()), 60_000)
    return () => clearInterval(id)
  }, [todayRecord?.lifecycle])

  const act = async (kind) => {
    setIsActing(true)
    setActionError('')

    if (demo) {
      if (kind === 'in') simulateDemoCheckIn()
      else simulateDemoCheckOut()
      setRawRecords(attendanceDemoResolved().history)
      setIsActing(false)
      showToast({ title: kind === 'in' ? 'Checked in (demo)' : 'Checked out (demo)', message: 'Recorded locally.' })
      return
    }

    // Check In -> office_check_in. Check Out -> final_check_out ONLY. We never post the
    // legacy "departure" / "return_to_office" checkpoints - the DP never performed them, so
    // fabricating those timestamps would be false history. If the backend still requires
    // them it rejects the call and we surface that honestly (see below).
    const result = await checkIn(kind === 'in' ? ATTENDANCE_CHECK_IN_TYPE : ATTENDANCE_CHECK_OUT_TYPE)
    setIsActing(false)
    if (!result.success) {
      setActionError(result.error)
      if (kind === 'out') setCheckOutGap(true)
      return
    }
    setCheckOutGap(false)
    showToast({ title: kind === 'in' ? 'Checked in' : 'Checked out', message: 'Attendance recorded.' })
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">My Attendance</h1>
        <p className="mt-1 text-sm text-neutral-500">Check in when you start work and check out when you finish.</p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
          {checkOutGap && (
            <p className="mt-1 text-xs text-red-600/80">
              Direct check-out is not supported by the current backend attendance workflow yet. Nothing was changed.
            </p>
          )}
        </div>
      )}

      <TodayCard
        record={todayRecord}
        now={now}
        isActing={isActing}
        onCheckIn={() => act('in')}
        onCheckOut={() => act('out')}
      />

      <Card title="Attendance History" className="p-0" bodyClassName="p-0">
        {isLoading ? (
          <div className="p-6"><LoadingSpinner label="Loading attendance history..." /></div>
        ) : loadError ? (
          <div className="p-6 text-center">
            <p className="text-sm text-red-600">{loadError}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
          </div>
        ) : records.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={CalendarCheck} title="No attendance recorded yet" description="Check in above to start building your history." />
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-3xl text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Check In</th>
                    <th className="px-4 py-3">Check Out</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {records.map((record) => (
                    <tr key={record.date}>
                      <td className="px-4 py-3 font-medium text-neutral-900">{fullDate(record.date)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={LIFECYCLE_VARIANT[record.lifecycle]} dot>{attendanceLifecycleLabel(record.lifecycle)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{formatTime(record.checkIn) || '—'}</td>
                      <td className="px-4 py-3 text-neutral-600">{formatTime(record.checkOut) || '—'}</td>
                      <td className="px-4 py-3 font-medium text-primary-700">{durationLabel(record.checkIn, record.checkOut) || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setDetailRecord(record)}>View Details</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="divide-y divide-neutral-100 sm:hidden">
              {records.map((record) => (
                <button
                  key={record.date}
                  type="button"
                  onClick={() => setDetailRecord(record)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div>
                    <p className="font-medium text-neutral-900">{fullDate(record.date)}</p>
                    <p className="text-xs text-neutral-500">
                      {formatTime(record.checkIn) || '—'} – {formatTime(record.checkOut) || '—'}
                      {durationLabel(record.checkIn, record.checkOut) ? ` · ${durationLabel(record.checkIn, record.checkOut)}` : ''}
                    </p>
                  </div>
                  <Badge variant={LIFECYCLE_VARIANT[record.lifecycle]} dot>{attendanceLifecycleLabel(record.lifecycle)}</Badge>
                </button>
              ))}
            </div>
          </>
        )}
      </Card>

      <DetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />
    </div>
  )
}
