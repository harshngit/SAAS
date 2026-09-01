import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  Clock,
  MapPin,
  MoreVertical,
  Package,
  PackageX,
  RotateCw,
  Truck,
  Undo2,
  Wallet,
  XCircle,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/ui/toastContext'
import { listDeliveries } from '../../api/deliveries'
import { getDeliveryStage } from '../deliveries/deliveryStage'
import { getCurrentVehicleStock } from '../../api/vehicleStock'
import { getMyAttendance } from '../../api/attendance'
import { postLocationPing } from '../../api/users'
import { formatCurrency } from '../../utils/format'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function StatCard({ icon: Icon, iconClassName, label, value, footer, footerClassName = 'text-primary-700', onClick }) {
  return (
    <article className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-[0_14px_32px_-26px_rgb(15_23_42/0.22)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-neutral-500">{label}</p>
        <div className={`flex size-11 items-center justify-center rounded-2xl ${iconClassName}`}>
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-4 font-(--font-display) text-[2.1rem] font-semibold tracking-tight text-neutral-900">{value}</p>
      {footer && (
        <button type="button" onClick={onClick} className={`mt-2 text-sm font-medium ${footerClassName}`}>
          {footer} <ArrowRight className="ml-1 inline size-4 align-[-2px]" />
        </button>
      )}
    </article>
  )
}

function ShellCard({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-neutral-100 bg-white p-5 shadow-[0_16px_36px_-26px_rgb(15_23_42/0.22)] ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-neutral-900">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function PriorityRow({ icon: Icon, iconClassName, label, description, count }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl px-2 py-2.5">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-800">{label}</p>
        <p className="truncate text-xs text-neutral-400">{description}</p>
      </div>
      <span className="shrink-0 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1 text-sm font-medium text-red-500">{count}</span>
    </div>
  )
}

function StatusTile({ icon: Icon, iconClassName, label, count }) {
  return (
    <div className="flex min-w-[5.75rem] flex-1 flex-col items-center gap-2 rounded-2xl border border-neutral-100 bg-neutral-50/60 px-2 py-3 text-center">
      <div className={`flex size-9 items-center justify-center rounded-full ${iconClassName}`}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <p className="text-[0.7rem] text-neutral-500">{label}</p>
      <p className="text-base font-semibold text-neutral-900">{count}</p>
    </div>
  )
}

export default function DeliveryPartnerDashboard() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)
  const displayName = currentUser?.name || 'there'
  const firstName = displayName.split(' ')[0]

  const [deliveries, setDeliveries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [vehicleSession, setVehicleSession] = useState(null)
  const [todaysAttendance, setTodaysAttendance] = useState(null)
  const [isSharingLocation, setIsSharingLocation] = useState(false)

  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      showToast({ title: 'Not supported', message: 'This device does not support location sharing.', variant: 'error' })
      return
    }

    setIsSharingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const result = await postLocationPing({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        })

        setIsSharingLocation(false)

        if (!result.success) {
          showToast({ title: 'Unable to share location', message: result.error, variant: 'error' })
          return
        }

        showToast({ title: 'Location shared', message: 'Your current location has been updated.' })
      },
      (geoError) => {
        setIsSharingLocation(false)
        showToast({ title: 'Location unavailable', message: geoError.message, variant: 'error' })
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const loadDeliveries = useCallback(async () => {
    if (!currentUser?.id) return

    setIsLoading(true)
    setLoadError('')

    const result = await listDeliveries({ delivery_partner_id: currentUser.id })

    setIsLoading(false)

    if (!result.success) {
      setDeliveries([])
      setLoadError(result.error)
      return
    }

    setDeliveries(result.deliveries)
  }, [currentUser?.id])

  useEffect(() => {
    loadDeliveries()
  }, [loadDeliveries])

  useEffect(() => {
    let isMounted = true

    async function loadExtras() {
      if (!currentUser?.id) return

      // A 404 here just means "no active loading session right now" - expected, not an error.
      const stockResult = await getCurrentVehicleStock(currentUser.id)
      if (isMounted && stockResult.success) {
        setVehicleSession(stockResult.session)
      }

      const attendanceResult = await getMyAttendance()
      if (isMounted && attendanceResult.success) {
        const today = todayIso()
        const record = attendanceResult.records.find((entry) => entry.date === today)
        setTodaysAttendance(record || null)
      }
    }

    loadExtras()

    return () => {
      isMounted = false
    }
  }, [currentUser?.id])

  if (isLoading) {
    return <LoadingSpinner label="Loading your dashboard..." />
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">{loadError}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={loadDeliveries}>
          <RotateCw className="size-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    )
  }

  const today = todayIso()
  const todaysDeliveries = deliveries.filter((delivery) => (delivery.scheduledDate || '').slice(0, 10) === today)

  // Display stages are derived from the backend's collapsed status - see features/deliveries/deliveryStage.
  const stageOf = (delivery) => getDeliveryStage(delivery).key
  const countStage = (...keys) => todaysDeliveries.filter((delivery) => keys.includes(stageOf(delivery))).length
  const completedToday = countStage('delivered')
  const pendingToday = countStage('assigned', 'accepted', 'picking', 'loaded', 'in_transit')
  const paymentPendingToday = todaysDeliveries.filter((delivery) => (delivery.amountDue || 0) > 0).length
  const failedToday = countStage('failed')
  const partialToday = countStage('partially_delivered')
  const awaitingAcceptanceToday = countStage('assigned', 'rejected')
  const pickingToday = countStage('accepted', 'picking')
  const loadedToday = countStage('loaded')
  const inTransitToday = countStage('in_transit')
  const completedPercent = todaysDeliveries.length > 0 ? Math.round((completedToday / todaysDeliveries.length) * 100) : 0

  const stats = [
    {
      label: 'Deliveries Today',
      value: todaysDeliveries.length,
      footer: 'View all deliveries',
      footerClassName: 'text-primary-700',
      icon: Truck,
      iconClassName: 'bg-primary-50 text-primary-700',
      onClick: () => navigate('/delivery/deliveries'),
    },
    {
      label: 'Completed Today',
      value: completedToday,
      footer: `${completedPercent}% of today's deliveries`,
      footerClassName: 'text-primary-700',
      icon: CheckCircle2,
      iconClassName: 'bg-emerald-100 text-emerald-700',
    },
    {
      label: 'Pending Today',
      value: pendingToday,
      footer: 'View pending',
      footerClassName: 'text-orange-600',
      icon: Clock,
      iconClassName: 'bg-orange-100 text-orange-600',
      onClick: () => navigate('/delivery/deliveries'),
    },
    {
      label: 'Payment Pending Deliveries',
      value: paymentPendingToday,
      footer: 'View deliveries',
      footerClassName: 'text-blue-600',
      icon: Wallet,
      iconClassName: 'bg-blue-100 text-blue-600',
      onClick: () => navigate('/delivery/deliveries'),
    },
  ]

  const priorities = [
    {
      label: 'Needs your response',
      description: 'Accept or reject before loading can start',
      count: awaitingAcceptanceToday,
      icon: AlertTriangle,
      iconClassName: 'bg-red-50 text-red-500',
    },
    {
      label: 'Pending deliveries',
      description: 'Deliveries yet to be completed',
      count: pendingToday,
      icon: Clock,
      iconClassName: 'bg-red-50 text-red-500',
    },
    {
      label: 'Failed reattempts',
      description: 'Require immediate attention',
      count: failedToday,
      icon: AlertTriangle,
      iconClassName: 'bg-red-50 text-red-500',
    },
    {
      label: 'Payment pending',
      description: 'Cash to collect from customers',
      count: paymentPendingToday,
      icon: Wallet,
      iconClassName: 'bg-orange-50 text-orange-500',
    },
    {
      label: 'Partial deliveries pending',
      description: 'Awaiting remaining items',
      count: partialToday,
      icon: PackageX,
      iconClassName: 'bg-orange-50 text-orange-500',
    },
  ]

  const deliveryStatusTiles = [
    { label: 'Assigned', value: awaitingAcceptanceToday, icon: Clock, iconClassName: 'bg-red-50 text-red-500' },
    { label: 'Picking', value: pickingToday, icon: Package, iconClassName: 'bg-amber-50 text-amber-600' },
    { label: 'Vehicle Loaded', value: loadedToday, icon: Truck, iconClassName: 'bg-neutral-50 text-neutral-500' },
    { label: 'In Transit', value: inTransitToday, icon: Truck, iconClassName: 'bg-blue-50 text-blue-600' },
    { label: 'Delivered', value: completedToday, icon: CheckCircle2, iconClassName: 'bg-green-50 text-green-600' },
    { label: 'Failed', value: failedToday, icon: XCircle, iconClassName: 'bg-red-50 text-red-600' },
    { label: 'Partial', value: partialToday, icon: Clock, iconClassName: 'bg-orange-50 text-orange-600' },
  ]

  const vehicleLoadItems = vehicleSession?.items || []

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-[#0d5d12] via-[#0f4f10] to-[#0c3f0d] px-5 py-5 shadow-[0_16px_36px_-16px_rgb(6_59_0/0.55)] sm:px-6 sm:py-6">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg font-semibold text-white ring-1 ring-white/25">
              {firstName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="font-(--font-display) text-2xl font-semibold tracking-tight text-white">
                Good Morning, {firstName} <span aria-hidden="true">👋</span>
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/88">
                {todaysAttendance?.checkIn && (
                  <span className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    </span>
                    Checked In <span className="font-semibold text-white">{todaysAttendance.checkIn}</span>
                  </span>
                )}
                {vehicleSession?.vehicleNumber && (
                  <span className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-white/80">
                      <Truck className="size-3.5" aria-hidden="true" />
                    </span>
                    Vehicle <span className="font-semibold text-white">{vehicleSession.vehicleNumber}</span>
                  </span>
                )}
                <span className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-white/80">
                    <Box className="size-3.5" aria-hidden="true" />
                  </span>
                  Today&apos;s Deliveries <span className="font-semibold text-white">{todaysDeliveries.length}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border-white/40 bg-white/10 px-5 py-3 text-sm font-medium text-white hover:border-white hover:bg-white/20 hover:text-white"
              loading={isSharingLocation}
              onClick={handleShareLocation}
            >
              <MapPin className="size-4" aria-hidden="true" />
              Share Location
            </Button>
            <Button
              type="button"
              className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-primary-800 shadow-[0_10px_22px_-12px_rgb(0_0_0/0.3)] hover:bg-white/90"
              onClick={() => navigate('/delivery/deliveries')}
            >
              <Truck className="size-4" aria-hidden="true" />
              View Pending Deliveries
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border-white/40 bg-white/10 px-5 py-3 text-sm font-medium text-white hover:border-white hover:bg-white/20 hover:text-white"
              onClick={() => navigate('/delivery/end-of-day')}
            >
              <Undo2 className="size-4" aria-hidden="true" />
              End Day Return
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ShellCard title="Today's Priorities">
          <div className="space-y-1">
            {priorities.map((item) => (
              <PriorityRow key={item.label} {...item} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate('/delivery/deliveries')}
            className="mt-4 flex w-full items-center justify-center gap-1 text-sm font-medium text-primary-700 hover:underline"
          >
            View all priorities <ArrowRight className="size-4" />
          </button>
        </ShellCard>

        <ShellCard title="Current Vehicle Load">
          {vehicleLoadItems.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No active loading session"
              description="Load your vehicle to see the current stock here."
            />
          ) : (
            <>
              <p className="text-xs text-neutral-400">{vehicleSession?.vehicleNumber || 'Vehicle'} · loaded stock</p>
              <div className="mt-3 space-y-2.5">
                {vehicleLoadItems.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-neutral-700">
                      <Package className="size-3.5 text-neutral-400" aria-hidden="true" />
                      {item.productName}
                    </span>
                    <span className="shrink-0 font-medium text-neutral-900">{item.loadedQuantity} units</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => navigate('/delivery/vehicle-stock')}
                className="mt-4 flex w-full items-center justify-center gap-1 text-sm font-medium text-primary-700 hover:underline"
              >
                View vehicle stock <ArrowRight className="size-4" />
              </button>
            </>
          )}
        </ShellCard>

        <ShellCard title="Delivery Status">
          <p className="text-xs text-neutral-400">Today at a glance</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {deliveryStatusTiles.map((item) => (
              <StatusTile key={item.label} {...item} />
            ))}
          </div>
        </ShellCard>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <ShellCard title="My Deliveries">
          <DataTable
            columns={[
              { key: 'orderNumber', header: 'Order #', sortable: true },
              { key: 'customerName', header: 'Customer', sortable: true },
              { key: 'scheduledDate', header: 'Scheduled Date', sortable: true },
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                render: (row) => {
                  const stage = getDeliveryStage(row)
                  return <Badge variant={stage.variant} dot>{stage.label}</Badge>
                },
              },
              { key: 'amountDue', header: 'Amount Due', sortable: true, align: 'right', render: (row) => formatCurrency(row.amountDue) },
            ]}
            data={deliveries}
            searchKeys={['orderNumber', 'customerName', 'status']}
            searchPlaceholder="Search deliveries…"
            emptyTitle="No deliveries assigned"
            emptyDescription="Deliveries assigned to you will show up here."
            actions={(row) => [
              { label: 'View Details', icon: MoreVertical, onClick: () => navigate(`/delivery/deliveries/${row.id}`) },
            ]}
          />
        </ShellCard>
      </div>
    </div>
  )
}
