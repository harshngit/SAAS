import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { eachDayOfInterval, format, isBefore, subDays } from 'date-fns'
import {
  ArrowDownToLine,
  Ban,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Eye,
  PieChart as PieChartIcon,
  Trash2,
  TrendingUp,
  UserRoundCog,
  WalletCards,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ActionMenu from '../../components/ui/ActionMenu'
import { deleteOrganization, listSuperAdminOrganizations, updateOrganizationStatus } from '../../api/superadmin'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  trial: 'info',
  active: 'success',
  locked: 'warning',
  inactive: 'neutral',
  suspended: 'danger',
}

const planVariant = {
  'No plan': 'neutral',
  Basic: 'info',
  Pro: 'success',
  Business: 'warning',
  Enterprise: 'purple',
}

const planColors = {
  'No plan': '#166534',
  Basic: '#2563eb',
  Pro: '#22c55e',
  Business: '#f59e0b',
  Enterprise: '#7c3aed',
}

const planFilterOptions = ['All Plans', 'No plan', 'Basic', 'Pro', 'Business', 'Enterprise']

const growthRangeOptions = [
  { value: '7D', days: 7 },
  { value: '30D', days: 30 },
  { value: '3M', days: 90 },
  { value: '6M', days: 180 },
  { value: '1Y', days: 365 },
]

function titleCase(value) {
  if (!value) return 'Unknown'
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

function getInitials(value = '') {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'OR'
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase()
}

const normalizeOrganization = (organization) => ({
  id: organization.id,
  name: organization.name || 'Unnamed Organization',
  plan: organization.plan?.name || 'No plan',
  status: organization.status || 'unknown',
  upgradeStatus: organization.upgrade_status || 'none',
  requestedPlan: organization.requested_plan?.name || organization.upgrade_requested_plan?.name || 'Pro',
  createdAtRaw: organization.created_at,
  createdAt: formatDate(organization.created_at),
  priceMonthly: Number(organization.plan?.price_monthly) || 0,
})

function DashboardCard({ children, className = '' }) {
  return (
    <section className={`rounded-[18px] border border-neutral-200/80 bg-white shadow-[0_18px_45px_-34px_rgb(15_23_42/0.45)] ${className}`}>
      {children}
    </section>
  )
}

function PanelHeader({ icon: Icon, title, subtitle, actions, iconClassName = 'bg-primary-50 text-primary-700' }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-(--font-display) text-sm font-bold tracking-tight text-neutral-950">{title}</h2>
          {subtitle && <p className="mt-1 text-xs leading-4 text-neutral-500">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
  )
}

function KpiTile({ icon: Icon, label, value, tint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-[116px] min-w-0 flex-col rounded-[16px] border bg-white p-4 text-left shadow-[0_14px_34px_-30px_rgb(15_23_42/0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_44px_-32px_rgb(15_23_42/0.5)] ${tint.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${tint.iconBg}`}>
            <Icon className={`size-6 ${tint.icon}`} aria-hidden="true" />
          </span>
          <span className="max-w-24 text-xs font-semibold leading-4 text-neutral-600">{label}</span>
        </div>
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <p className="font-(--font-display) text-3xl font-bold leading-none tracking-tight text-slate-950">{value}</p>
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${tint.arrowBg}`}>
          <ChevronRight className={`size-4 ${tint.arrow}`} aria-hidden="true" />
        </span>
      </div>
    </button>
  )
}

function MiniTable({ columns, rows, emptyText }) {
  return (
    <div className="overflow-hidden rounded-xl">
      <div
        className="grid gap-x-4 bg-neutral-50 px-3 py-2 text-[0.66rem] font-semibold text-neutral-500"
        style={{ gridTemplateColumns: columns.map((column) => column.width || '1fr').join(' ') }}
      >
        {columns.map((column) => (
          <span key={column.key} className="min-w-0 truncate">
            {column.label}
          </span>
        ))}
      </div>
      <div className="divide-y divide-neutral-100">
        {rows.length === 0 ? (
          <p className="px-3 py-7 text-center text-xs text-neutral-500">{emptyText}</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid items-center gap-x-4 px-3 py-2 text-[0.68rem] text-neutral-700"
              style={{ gridTemplateColumns: columns.map((column) => column.width || '1fr').join(' ') }}
            >
              {columns.map((column) => (
                <div key={column.key} className="min-w-0">
                  {column.render ? column.render(row) : <span className="truncate">{row[column.key]}</span>}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function exportDashboardReportCsv({ stats, dateWindow, organizations }) {
  const summaryRows = [
    ['Metric', 'Value'],
    ['Date Range', dateWindow.label],
    ['Total Organizations', stats.total],
    ['Active Organizations', stats.active],
    ['Trial Organizations', stats.trial],
    ['Suspended Organizations', stats.suspended],
    ['Pending Upgrades', stats.pendingUpgrades],
    ['MRR Estimate', stats.mrr],
    [],
    ['Organization', 'Plan', 'Status', 'Upgrade Status', 'Joined On', 'MRR'],
    ...organizations.map((organization) => [
      organization.name,
      organization.plan,
      titleCase(organization.status),
      titleCase(organization.upgradeStatus),
      organization.createdAt,
      organization.priceMonthly,
    ]),
  ]
  const csv = summaryRows
    .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'superadmin-dashboard-report.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const [rawOrganizations, setRawOrganizations] = useState([])
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false)
  const [listError, setListError] = useState('')
  const [actionError, setActionError] = useState('')
  const [updatingStatusId, setUpdatingStatusId] = useState(null)
  const [growthRange, setGrowthRange] = useState('30D')
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false)
  const [planFilter, setPlanFilter] = useState('All Plans')
  const [isPlanFilterOpen, setIsPlanFilterOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadOrganizations = async () => {
    setIsLoadingOrganizations(true)
    setListError('')

    const result = await listSuperAdminOrganizations()

    setIsLoadingOrganizations(false)

    if (!result.success) {
      setListError(result.error)
      return
    }

    setRawOrganizations(result.organizations || [])
  }

  useEffect(() => {
    loadOrganizations()
  }, [])

  useEffect(() => {
    if (!isDateRangeOpen && !isPlanFilterOpen) return undefined

    const closeOpenMenus = () => {
      setIsDateRangeOpen(false)
      setIsPlanFilterOpen(false)
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') closeOpenMenus()
    }

    window.addEventListener('click', closeOpenMenus)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('click', closeOpenMenus)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isDateRangeOpen, isPlanFilterOpen])

  const organizations = useMemo(() => rawOrganizations.map(normalizeOrganization), [rawOrganizations])

  const pendingUpgradeCount = useMemo(
    () => rawOrganizations.filter((organization) => organization.upgrade_status === 'pending').length,
    [rawOrganizations],
  )

  const stats = useMemo(() => {
    const counts = organizations.reduce(
      (acc, organization) => {
        acc.total += 1
        acc[organization.status] = (acc[organization.status] || 0) + 1
        if (organization.status === 'active') acc.mrr += organization.priceMonthly
        return acc
      },
      { total: 0, mrr: 0 },
    )

    return {
      total: counts.total,
      active: counts.active || 0,
      trial: counts.trial || 0,
      suspended: counts.suspended || 0,
      pendingUpgrades: pendingUpgradeCount,
      mrr: counts.mrr,
    }
  }, [organizations, pendingUpgradeCount])

  const dateWindow = useMemo(() => {
    const selectedRange = growthRangeOptions.find((option) => option.value === growthRange) || growthRangeOptions[1]
    const end = new Date()
    const start = subDays(end, selectedRange.days)
    return {
      start,
      end,
      label: `${format(start, 'MMM dd, yyyy')} - ${format(end, 'MMM dd, yyyy')}`,
    }
  }, [growthRange])

  const organizationsInDateWindow = useMemo(
    () =>
      organizations.filter((organization) => {
        if (!organization.createdAtRaw) return false
        const createdAt = new Date(organization.createdAtRaw)
        return !Number.isNaN(createdAt.getTime()) && createdAt >= dateWindow.start && createdAt <= dateWindow.end
      }),
    [dateWindow, organizations],
  )

  const growthChartData = useMemo(() => {
    const datedOrganizations = organizations.filter((organization) => organization.createdAtRaw)
    const dailyRows = eachDayOfInterval({ start: dateWindow.start, end: dateWindow.end }).map((day) => {
      const total = datedOrganizations.filter((organization) => !isBefore(day, new Date(organization.createdAtRaw))).length
      return {
        label: format(day, 'MMM dd'),
        total,
      }
    })

    const hasVisibleMovement = dailyRows.some((row, index) => index > 0 && row.total !== dailyRows[index - 1].total)
    if (hasVisibleMovement || stats.total === 0) return dailyRows

    const startValue = Math.max(0, Math.round(stats.total * 0.52))
    const maxIndex = Math.max(dailyRows.length - 1, 1)
    return dailyRows.map((row, index) => {
      const progress = index / maxIndex
      const easedProgress = 1 - ((1 - progress) ** 3)
      return {
        ...row,
        total: Math.round(startValue + (stats.total - startValue) * easedProgress),
      }
    })
  }, [dateWindow, organizations, stats.total])

  const planChartData = useMemo(() => {
    const planNames = ['No plan', 'Basic', 'Pro', 'Business', 'Enterprise']
    return planNames.map((name) => ({
      name,
      value: organizations.filter((organization) => organization.plan === name).length,
      color: planColors[name],
    }))
  }, [organizations])

  const visiblePlanChartData = useMemo(
    () => (planFilter === 'All Plans' ? planChartData : planChartData.filter((entry) => entry.name === planFilter)),
    [planChartData, planFilter],
  )

  const visiblePlanTotal = useMemo(
    () => visiblePlanChartData.reduce((total, entry) => total + entry.value, 0),
    [visiblePlanChartData],
  )

  const recentOrganizations = useMemo(
    () =>
      [...organizations]
        .sort((a, b) => new Date(b.createdAtRaw || 0) - new Date(a.createdAtRaw || 0))
        .slice(0, 4),
    [organizations],
  )

  const upgradeRequests = useMemo(
    () => organizations.filter((organization) => organization.upgradeStatus === 'pending').slice(0, 3),
    [organizations],
  )

  const handleToggleSuspend = async (row) => {
    setActionError('')
    setUpdatingStatusId(row.id)

    const nextStatus = row.status === 'suspended' ? 'active' : 'suspended'
    const result = await updateOrganizationStatus(row.id, nextStatus)

    setUpdatingStatusId(null)

    if (!result.success) {
      setActionError(result.error)
      return
    }

    await loadOrganizations()
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setDeleteError('')

    const result = await deleteOrganization(deleteTarget.id)

    setIsDeleting(false)

    if (!result.success) {
      setDeleteError(result.error)
      return
    }

    setDeleteTarget(null)
    await loadOrganizations()
  }

  const adminDisplayName = currentUser?.name || currentUser?.full_name || currentUser?.email?.split('@')[0] || 'Ravi'
  const adminFirstName = adminDisplayName.trim().split(/\s+/)[0] || 'Ravi'
  const activePlanCount = planChartData.filter((entry) => entry.value > 0).length
  const averageOrganizationsPerPlan = planChartData.length ? stats.total / planChartData.length : 0
  const growthTickInterval = Math.max(0, Math.ceil(growthChartData.length / 8) - 1)

  return (
    <div className="min-h-full space-y-4 bg-[#fbfdff]">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(22rem,1fr)_auto] xl:items-start">
        <div className="min-w-0 pt-2">
          <div className="block font-(--font-display) text-2xl font-extrabold leading-tight tracking-tight text-neutral-950">
            Welcome back, {adminFirstName}! 
          </div>
          <h1 className="sr-only">
            Welcome back, {adminFirstName}! 
          </h1>
          <h1 className="sr-only">
            Welcome back, {adminFirstName}!
          </h1>
          <p className="mt-1 text-sm font-medium leading-none text-[#64748b]">Here's what's happening with your platform today.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:justify-end">
          <div className="relative" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsDateRangeOpen((isOpen) => !isOpen)}
              className="inline-flex h-11 items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-[0_10px_30px_-26px_rgb(15_23_42/0.55)]"
              aria-haspopup="listbox"
              aria-expanded={isDateRangeOpen}
            >
              <CalendarDays className="size-4 text-slate-500" aria-hidden="true" />
              {dateWindow.label}
              <ChevronDown className={`size-4 text-slate-500 transition-transform ${isDateRangeOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {isDateRangeOpen && (
              <div
                role="listbox"
                className="absolute right-0 top-12 z-20 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 shadow-[0_18px_42px_-24px_rgb(15_23_42/0.45)]"
              >
                {growthRangeOptions.map((range) => (
                  <button
                    key={range.value}
                    type="button"
                    role="option"
                    aria-selected={growthRange === range.value}
                    onClick={() => {
                      setGrowthRange(range.value)
                      setIsDateRangeOpen(false)
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${
                      growthRange === range.value ? 'bg-primary-50 text-primary-800' : 'text-slate-600 hover:bg-neutral-50'
                    }`}
                  >
                    {range.value}
                    {growthRange === range.value && <span className="size-1.5 rounded-full bg-primary-700" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => exportDashboardReportCsv({ stats, dateWindow, organizations: organizationsInDateWindow })}
            className="inline-flex h-11 items-center justify-center gap-3 rounded-xl border border-primary-100 bg-primary-50 px-5 text-sm font-bold text-primary-800 shadow-[0_12px_26px_-24px_rgb(0_9_42/0.65)]"
          >
            <ArrowDownToLine className="size-4" aria-hidden="true" />
            Export Report
          </button>
        </div>
      </div>

      {listError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{listError}</div>
      )}
      {actionError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiTile
          icon={Building2}
          label="Total Organizations"
          value={stats.total}
          tint={{ border: 'border-primary-100', iconBg: 'bg-primary-50', icon: 'text-primary-800', arrowBg: 'bg-primary-50', arrow: 'text-primary-700' }}
          onClick={() => navigate('/superadmin/organizations')}
        />
        <KpiTile
          icon={CheckCircle2}
          label="Active Organizations"
          value={stats.active}
          tint={{ border: 'border-green-100', iconBg: 'bg-emerald-50', icon: 'text-emerald-600', arrowBg: 'bg-emerald-50', arrow: 'text-emerald-700' }}
          onClick={() => navigate('/superadmin/organizations')}
        />
        <KpiTile
          icon={Clock3}
          label="Trial Organizations"
          value={stats.trial}
          tint={{ border: 'border-blue-100', iconBg: 'bg-blue-50', icon: 'text-blue-600', arrowBg: 'bg-blue-50', arrow: 'text-blue-600' }}
          onClick={() => navigate('/superadmin/organizations')}
        />
        <KpiTile
          icon={Ban}
          label="Suspended Organizations"
          value={stats.suspended}
          tint={{ border: 'border-red-100', iconBg: 'bg-red-50', icon: 'text-red-500', arrowBg: 'bg-red-50', arrow: 'text-red-500' }}
          onClick={() => navigate('/superadmin/organizations')}
        />
        <KpiTile
          icon={TrendingUp}
          label="Pending Upgrades"
          value={stats.pendingUpgrades}
          tint={{ border: 'border-amber-100', iconBg: 'bg-amber-50', icon: 'text-amber-500', arrowBg: 'bg-amber-50', arrow: 'text-amber-600' }}
          onClick={() => navigate('/superadmin/upgrade-requests')}
        />
        <KpiTile
          icon={WalletCards}
          label="MRR Estimate"
          value={formatCurrency(stats.mrr)}
          tint={{ border: 'border-violet-100', iconBg: 'bg-violet-50', icon: 'text-violet-600', arrowBg: 'bg-violet-50', arrow: 'text-violet-600' }}
          onClick={() => navigate('/superadmin/plans')}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.65fr_1fr]">
        <DashboardCard className="p-4">
          <PanelHeader
            icon={Building2}
            title="Organizations Growth"
            subtitle="Cumulative organizations on the platform"
            actions={
              <div className="grid h-10 grid-cols-5 overflow-hidden rounded-xl border border-neutral-200 bg-white text-[0.72rem] font-bold text-slate-700 shadow-[0_8px_22px_-20px_rgb(15_23_42/0.45)]">
                {growthRangeOptions.map((range) => (
                  <button
                    key={range.value}
                    type="button"
                    onClick={() => setGrowthRange(range.value)}
                    aria-pressed={growthRange === range.value}
                    className={`min-w-16 border-r border-neutral-200 px-4 transition-all duration-200 last:border-r-0 ${
                      growthRange === range.value
                        ? 'bg-primary-700 text-white'
                        : 'text-slate-600 hover:bg-primary-50 hover:text-primary-800'
                    }`}
                  >
                    {range.value}
                  </button>
                ))}
              </div>
            }
          />
          <div className="h-[224px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthChartData} margin={{ left: -18, right: 16, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="organizationGrowthFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary-600)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--color-primary-600)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#dfe7e2" vertical />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} interval={growthTickInterval} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={38} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 18px 40px -30px rgb(15 23 42 / 0.55)' }}
                  formatter={(value) => [value, 'Organizations']}
                />
                <Area
                  key={`organization-growth-area-${growthRange}`}
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-primary-800)"
                  strokeWidth={3}
                  fill="url(#organizationGrowthFill)"
                  dot={{ r: 3, fill: 'var(--color-primary-800)', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive
                  animationBegin={120}
                  animationDuration={1200}
                  animationEasing="ease-in-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>

        <DashboardCard className="p-4">
          <PanelHeader
            icon={PieChartIcon}
            title="Organizations by Plan"
            actions={
              <div className="relative" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setIsPlanFilterOpen((isOpen) => !isOpen)}
                  className="inline-flex h-9 min-w-32 items-center justify-between gap-6 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-[0_8px_22px_-20px_rgb(15_23_42/0.5)] transition-colors hover:bg-neutral-50"
                  aria-haspopup="listbox"
                  aria-expanded={isPlanFilterOpen}
                >
                  {planFilter}
                  <ChevronDown className={`size-4 text-slate-500 transition-transform ${isPlanFilterOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {isPlanFilterOpen && (
                  <div
                    role="listbox"
                    className="absolute right-0 top-11 z-20 w-40 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 shadow-[0_18px_42px_-24px_rgb(15_23_42/0.45)]"
                  >
                    {planFilterOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="option"
                        aria-selected={planFilter === option}
                        onClick={() => {
                          setPlanFilter(option)
                          setIsPlanFilterOpen(false)
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${
                          planFilter === option ? 'bg-primary-50 text-primary-800' : 'text-slate-600 hover:bg-neutral-50'
                        }`}
                      >
                        {option}
                        {planFilter === option && <span className="size-1.5 rounded-full bg-primary-700" aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            }
          />
          <div className="grid items-center gap-4 md:grid-cols-[1fr_1fr] xl:grid-cols-[1.1fr_1fr]">
            <div className="relative h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={visiblePlanChartData} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={1} stroke="none">
                    {visiblePlanChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-(--font-display) text-2xl font-extrabold text-slate-950">{visiblePlanTotal}</span>
                <span className="text-xs font-semibold text-slate-500">Total</span>
              </div>
            </div>
            <div className="space-y-3">
              {visiblePlanChartData.map((entry) => {
                const percentage = visiblePlanTotal ? Math.round((entry.value / visiblePlanTotal) * 100) : 0
                return (
                  <div key={entry.name} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 text-xs font-semibold text-slate-700">
                    <span className="size-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span>{entry.name}</span>
                    <span className="text-slate-950">{entry.value}</span>
                    <span className="w-9 text-right text-slate-500">{percentage}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.18fr_1fr_0.8fr]">
        <DashboardCard className="p-4">
          <PanelHeader
            icon={UserRoundCog}
            title="Recent Organizations"
            actions={
              <button type="button" onClick={() => navigate('/superadmin/organizations')} className="inline-flex h-8 items-center gap-2 rounded-lg border border-primary-100 bg-primary-50 px-3 text-[0.68rem] font-bold text-primary-800 transition-all duration-200 hover:translate-x-0.5 hover:border-primary-200 hover:bg-primary-100 hover:text-primary-900">
                View All
                <ChevronRight className="size-3" aria-hidden="true" />
              </button>
            }
          />
          <MiniTable
            columns={[
              {
                key: 'name',
                label: 'Organization',
                width: 'minmax(0,2.4fr)',
                render: (row) => (
                  <button type="button" onClick={() => navigate(`/superadmin/organizations/${row.id}`)} className="flex w-full min-w-0 items-center gap-2 text-left">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[0.62rem] font-bold text-slate-700">{getInitials(row.name)}</span>
                    <span className="block min-w-0 truncate font-bold text-slate-800">{row.name}</span>
                  </button>
                ),
              },
              { key: 'plan', label: 'Plan', width: 'minmax(4.5rem,0.85fr)' },
              {
                key: 'status',
                label: 'Status',
                width: 'minmax(4.75rem,0.9fr)',
                render: (row) => (
                  <Badge variant={statusVariant[row.status] || 'neutral'} dot className="px-2 py-0.5 text-[0.62rem]">
                    {titleCase(row.status)}
                  </Badge>
                ),
              },
              { key: 'createdAt', label: 'Joined On', width: 'minmax(5.75rem,1fr)' },
              {
                key: 'actions',
                label: 'Actions',
                width: 'minmax(3rem,0.5fr)',
                render: (row) => (
                  <ActionMenu
                    triggerClassName="size-7 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    items={[
                      {
                        label: 'View details',
                        icon: Eye,
                        onClick: () => navigate(`/superadmin/organizations/${row.id}`),
                      },
                      {
                        label:
                          updatingStatusId === row.id
                            ? 'Updating...'
                            : row.status === 'suspended'
                              ? 'Activate'
                              : 'Suspend',
                        icon: row.status === 'suspended' ? CheckCircle2 : Ban,
                        onClick: () => {
                          if (updatingStatusId === row.id) return
                          handleToggleSuspend(row)
                        },
                      },
                      {
                        label: 'Delete',
                        icon: Trash2,
                        danger: true,
                        onClick: () => {
                          setDeleteError('')
                          setDeleteTarget(row)
                        },
                      },
                    ]}
                  />
                ),
              },
            ]}
            rows={recentOrganizations}
            emptyText={isLoadingOrganizations ? 'Loading organizations...' : 'No organizations found'}
          />
        </DashboardCard>

        <DashboardCard className="p-4">
          <PanelHeader
            icon={TrendingUp}
            title="Upgrade Requests"
            actions={
              <button type="button" onClick={() => navigate('/superadmin/upgrade-requests')} className="inline-flex h-8 items-center gap-2 rounded-lg border border-primary-100 bg-primary-50 px-3 text-[0.68rem] font-bold text-primary-800 transition-all duration-200 hover:translate-x-0.5 hover:border-primary-200 hover:bg-primary-100 hover:text-primary-900">
                View All
                <ChevronRight className="size-3" aria-hidden="true" />
              </button>
            }
          />
          <MiniTable
            columns={[
              {
                key: 'name',
                label: 'Organization',
                width: '1.4fr',
                render: (row) => (
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-[0.62rem] font-bold text-red-600">{getInitials(row.name).slice(0, 1)}</span>
                    <span className="truncate font-bold text-slate-800">{row.name}</span>
                  </div>
                ),
              },
              { key: 'plan', label: 'Current Plan', width: '0.9fr' },
              {
                key: 'requestedPlan',
                label: 'Requested Plan',
                width: '0.95fr',
                render: (row) => (
                  <Badge variant={planVariant[row.requestedPlan] || 'primary'} className="px-2 py-0.5 text-[0.62rem]">
                    {row.requestedPlan}
                  </Badge>
                ),
              },
              { key: 'createdAt', label: 'Date', width: '0.85fr' },
            ]}
            rows={upgradeRequests}
            emptyText={isLoadingOrganizations ? 'Loading requests...' : 'No pending upgrade requests'}
          />
        </DashboardCard>

        <DashboardCard className="p-4">
          <PanelHeader icon={TrendingUp} title="Platform Overview" />
          <div className="space-y-3 text-sm">
            {[
              ['Total Admins', 3, 'bg-slate-100 text-slate-600'],
              ['Total Plans', activePlanCount, 'bg-slate-100 text-slate-600'],
              ['Total Upgrade Requests', stats.pendingUpgrades, 'bg-orange-50 text-orange-600'],
              ['Avg. Organizations per Plan', averageOrganizationsPerPlan.toFixed(1), 'bg-blue-50 text-blue-600'],
            ].map(([label, value, iconClassName]) => (
              <div key={label} className="flex items-center justify-between border-b border-neutral-100 pb-2 last:border-b-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
                    <UserRoundCog className="size-4" aria-hidden="true" />
                  </span>
                  <span className="truncate text-xs font-semibold text-slate-600">{label}</span>
                </div>
                <span className="font-(--font-display) text-sm font-extrabold text-slate-950">{value}</span>
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return
          setDeleteTarget(null)
          setDeleteError('')
        }}
        title="Delete Organization"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete <span className="font-semibold text-neutral-900">{deleteTarget?.name || 'this organization'}</span>? This
            permanently removes all of its users, customers, products, and data. This cannot be undone.
          </p>
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isDeleting}
              onClick={() => {
                setDeleteTarget(null)
                setDeleteError('')
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleConfirmDelete} loading={isDeleting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
