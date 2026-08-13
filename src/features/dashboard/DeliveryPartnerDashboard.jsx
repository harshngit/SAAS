import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock,
  Circle,
  MoreVertical,
  PackageX,
  Search,
  Truck,
  Undo2,
  Wallet,
  XCircle,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import { useAuthStore } from '../../store/authStore'

function StatusPill({ children, tone = 'neutral' }) {
  const toneClasses = {
    neutral: 'bg-neutral-100 text-neutral-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-700',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-black/5 ${toneClasses[tone]}`}>
      {children}
    </span>
  )
}

function StatCard({ icon: Icon, iconClassName, label, value, footer, footerClassName = 'text-primary-700' }) {
  return (
    <article className="rounded-[1.35rem] border border-neutral-100 bg-white p-5 shadow-[0_14px_32px_-26px_rgb(15_23_42/0.22)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-neutral-500">{label}</p>
        <div className={`flex size-11 items-center justify-center rounded-[1rem] ${iconClassName}`}>
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-4 font-(--font-display) text-[2.1rem] font-semibold tracking-tight text-neutral-900">{value}</p>
      <p className={`mt-2 text-sm font-medium ${footerClassName}`}>
        {footer} <ArrowRight className="ml-1 inline size-4 align-[-2px]" />
      </p>
    </article>
  )
}

function ShellCard({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-[1.5rem] border border-neutral-100 bg-white p-5 shadow-[0_16px_36px_-26px_rgb(15_23_42/0.22)] ${className}`}>
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

function DeliveryRow({ row }) {
  return (
    <tr className="transition-colors hover:bg-primary-50/25">
      <td className="px-4 py-3.5 text-neutral-700">{row.id}</td>
      <td className="px-4 py-3.5 text-neutral-700">{row.customer}</td>
      <td className="px-4 py-3.5 text-neutral-700">{row.scheduled}</td>
      <td className="px-4 py-3.5">
        <StatusPill tone={row.statusTone}>{row.status}</StatusPill>
      </td>
      <td className="px-4 py-3.5 text-neutral-700">{row.amount}</td>
      <td className="px-4 py-3.5">
        <StatusPill tone={row.collectionTone}>{row.collection}</StatusPill>
      </td>
      <td className="px-4 py-3.5 text-right text-neutral-400">
        <MoreVertical className="inline size-4" />
      </td>
    </tr>
  )
}

function ActivityRow({ icon: Icon, iconClassName, title, subtitle, timestamp }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${iconClassName}`}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-800">{title}</p>
        <p className="truncate text-xs text-neutral-400">{subtitle}</p>
      </div>
      <span className="shrink-0 text-xs text-neutral-400">{timestamp}</span>
    </div>
  )
}

const stats = [
  {
    label: 'Deliveries Today',
    value: '8',
    footer: 'View all deliveries',
    footerClassName: 'text-primary-700',
    icon: Truck,
    iconClassName: 'bg-primary-50 text-primary-700',
  },
  {
    label: 'Completed Today',
    value: '5',
    footer: "62% of today's deliveries",
    footerClassName: 'text-primary-700',
    icon: CheckCircle2,
    iconClassName: 'bg-emerald-100 text-emerald-700',
  },
  {
    label: 'Pending Today',
    value: '3',
    footer: 'View pending',
    footerClassName: 'text-orange-600',
    icon: Clock,
    iconClassName: 'bg-orange-100 text-orange-600',
  },
  {
    label: 'Collection Due Today',
    value: '₹12,799',
    footer: 'View collection summary',
    footerClassName: 'text-blue-600',
    icon: Wallet,
    iconClassName: 'bg-blue-100 text-blue-600',
  },
]

const priorities = [
  {
    label: 'Pending deliveries',
    description: 'Deliveries yet to be completed',
    count: '3',
    icon: Clock,
    iconClassName: 'bg-red-50 text-red-500',
  },
  {
    label: 'Failed reattempts',
    description: 'Require immediate attention',
    count: '1',
    icon: AlertTriangle,
    iconClassName: 'bg-red-50 text-red-500',
  },
  {
    label: 'Payment pending',
    description: 'Cash to collect from customers',
    count: '2',
    icon: Wallet,
    iconClassName: 'bg-orange-50 text-orange-500',
  },
  {
    label: 'Partial deliveries pending',
    description: 'Awaiting remaining items',
    count: '1',
    icon: PackageX,
    iconClassName: 'bg-orange-50 text-orange-500',
  },
]

const stockAlerts = [
  { name: 'Sparkling Water (750ml)', left: '12 left' },
  { name: 'Flavored Water - Orange (500ml)', left: '8 left' },
  { name: 'Alkaline Water (1L)', left: '5 left' },
  { name: 'Bottle Stand (Standard)', left: '4 left' },
]

const collectionSummary = [
  { label: 'Expected', value: '₹6,200', color: 'text-blue-600' },
  { label: 'Collected', value: '₹4,500', color: 'text-primary-700' },
  { label: 'Pending', value: '₹1,700', color: 'text-orange-600' },
]

const deliveryStatus = [
  { label: 'Ready', value: '2', icon: Truck, iconClassName: 'bg-neutral-50 text-neutral-500' },
  { label: 'In Transit', value: '2', icon: Truck, iconClassName: 'bg-blue-50 text-blue-600' },
  { label: 'Delivered', value: '5', icon: CheckCircle2, iconClassName: 'bg-green-50 text-green-600' },
  { label: 'Failed', value: '1', icon: XCircle, iconClassName: 'bg-red-50 text-red-600' },
  { label: 'Partial', value: '1', icon: Clock, iconClassName: 'bg-orange-50 text-orange-600' },
]

const deliveries = [
  { id: 'SO-2026-1011', customer: 'TechNova Solutions Pvt Ltd', scheduled: '10:00 AM', status: 'Ready', statusTone: 'blue', amount: '₹10,017', collection: 'Due', collectionTone: 'orange' },
  { id: 'SO-2026-1012', customer: 'Vinayaka Medical Store', scheduled: '10:30 AM', status: 'In Transit', statusTone: 'blue', amount: '₹1,239', collection: 'Paid', collectionTone: 'green' },
  { id: 'SO-2026-1010', customer: 'Star Public School', scheduled: '11:00 AM', status: 'Partial', statusTone: 'orange', amount: '₹4,484', collection: 'Due', collectionTone: 'orange' },
  { id: 'SO-2026-1009', customer: 'Blue Orchid Banquet Hall', scheduled: '11:30 AM', status: 'Delivered', statusTone: 'green', amount: '₹6,073', collection: 'Paid', collectionTone: 'green' },
  { id: 'SO-2026-1008', customer: 'Café Mocha', scheduled: '12:00 PM', status: 'Delivered', statusTone: 'green', amount: '₹2,242', collection: 'Paid', collectionTone: 'green' },
  { id: 'SO-2026-1013', customer: 'Cloud Nine Café', scheduled: '02:00 PM', status: 'Failed', statusTone: 'red', amount: '₹1,534', collection: 'Due', collectionTone: 'orange' },
]

const activity = [
  { icon: Truck, iconClassName: 'bg-primary-700 text-white', title: 'POD uploaded for SO-2026-1009', subtitle: 'Blue Orchid Banquet Hall', timestamp: 'Today, 10:12 AM' },
  { icon: Wallet, iconClassName: 'bg-primary-700 text-white', title: 'Collection received from Café Mocha', subtitle: 'Amount: ₹2,242', timestamp: 'Today, 9:55 AM' },
  { icon: CheckCircle2, iconClassName: 'bg-primary-700 text-white', title: 'Delivery completed for SO-2026-1008', subtitle: 'Café Mocha', timestamp: 'Today, 9:30 AM' },
  { icon: Clock, iconClassName: 'bg-orange-500 text-white', title: 'Partial delivery marked for SO-2026-1010', subtitle: 'Star Public School', timestamp: 'Yesterday, 6:40 PM' },
  { icon: XCircle, iconClassName: 'bg-red-600 text-white', title: 'Failed delivery marked for SO-2026-1013', subtitle: 'Cloud Nine Café', timestamp: 'Yesterday, 4:15 PM' },
  { icon: Truck, iconClassName: 'bg-blue-600 text-white', title: 'Vehicle checked in', subtitle: 'TS09AB1234', timestamp: 'Yesterday, 8:45 AM' },
]

export default function DeliveryPartnerDashboard() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const displayName = currentUser?.name || 'Deepak Delivery'
  const firstName = displayName.split(' ')[0]

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="relative overflow-hidden rounded-[1.25rem] bg-linear-to-br from-[#0d5d12] via-[#0f4f10] to-[#0c3f0d] px-5 py-5 shadow-[0_16px_36px_-16px_rgb(6_59_0/0.55)] sm:px-6 sm:py-6">
        
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
                <span className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  </span>
                  Checked In <span className="font-semibold text-white">8:45 AM</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-white/80">
                    <Truck className="size-3.5" aria-hidden="true" />
                  </span>
                  Vehicle <span className="font-semibold text-white">TS09AB1234</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-white/80">
                    <Box className="size-3.5" aria-hidden="true" />
                  </span>
                  Today&apos;s Deliveries <span className="font-semibold text-white">8</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
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
          <button type="button" className="mt-4 flex w-full items-center justify-center gap-1 text-sm font-medium text-primary-700 hover:underline">
            View all priorities <ArrowRight className="size-4" />
          </button>
        </ShellCard>

        <ShellCard
          title="Vehicle Stock Alerts"
          action={<span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-600">Low Stock</span>}
        >
          <p className="text-xs text-neutral-400">Reorder soon to avoid stockouts</p>
          <div className="mt-3 space-y-2.5">
            {stockAlerts.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-neutral-700">
                  <Circle className="size-2 fill-orange-500 text-orange-500" aria-hidden="true" />
                  {item.name}
                </span>
                <span className="shrink-0 font-medium text-neutral-900">{item.left}</span>
              </div>
            ))}
          </div>
          <button type="button" className="mt-4 flex w-full items-center justify-center gap-1 text-sm font-medium text-primary-700 hover:underline">
            View all vehicle stock <ArrowRight className="size-4" />
          </button>
        </ShellCard>

        <ShellCard
          title="Collection Summary"
          action={
            <button type="button" className="text-sm font-medium text-primary-700 hover:underline">
              View details <ArrowRight className="size-4 inline align-[-2px]" />
            </button>
          }
        >
          <div className="grid grid-cols-3 gap-3 text-center">
            {collectionSummary.map((item) => (
              <div key={item.label} className="rounded-2xl border border-neutral-100 bg-neutral-50/50 p-3">
                <p className="text-xs text-neutral-400">{item.label}</p>
                <p className={`mt-1 text-base font-semibold ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-neutral-100 pt-4">
            <p className="text-sm font-semibold text-neutral-800">Delivery Status</p>
            <p className="text-xs text-neutral-400">Today at a glance</p>
            <div className="mt-3 flex gap-2">
              {deliveryStatus.map((item) => (
                <StatusTile key={item.label} {...item} />
              ))}
            </div>
          </div>
        </ShellCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ShellCard
          title="My Deliveries"
          action={
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  readOnly
                  value=""
                  placeholder="Search deliveries..."
                  className="w-56 rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-9 pr-4 text-sm text-neutral-700 placeholder:text-neutral-400"
                />
              </div>
              <button type="button" className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-700">
                All Statuses <ChevronDown className="ml-1 inline size-4 align-[-2px]" />
              </button>
            </div>
          }
        >
          <div className="overflow-hidden rounded-[1.15rem] border border-neutral-100">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80">
                  <th className="px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Delivery #</th>
                  <th className="px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Customer</th>
                  <th className="px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Scheduled</th>
                  <th className="px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Status</th>
                  <th className="px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Amount Due</th>
                  <th className="px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Collection</th>
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {deliveries.map((row) => (
                  <DeliveryRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-neutral-400">
            <p>Showing 1 to 6 of 8 deliveries</p>
            <div className="flex items-center gap-2">
              <button type="button" className="flex size-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500">
                <ChevronLeft className="size-4" />
              </button>
              <button type="button" className="flex size-8 items-center justify-center rounded-full bg-primary-700 text-white">1</button>
              <button type="button" className="flex size-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-700">2</button>
              <button type="button" className="flex size-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500">
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </ShellCard>

        <ShellCard
          title="Recent Activity"
          action={
            <button type="button" className="text-sm font-medium text-primary-700 hover:underline">
              View all <ArrowRight className="size-4 inline align-[-2px]" />
            </button>
          }
        >
          <div className="space-y-4">
            {activity.map((item) => (
              <ActivityRow key={item.title} {...item} />
            ))}
          </div>
        </ShellCard>
      </div>
    </div>
  )
}
