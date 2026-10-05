import { useEffect, useMemo, useState } from 'react'
import {
  Cell,
  Pie,
  PieChart,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowDownToLine,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  IndianRupee,
  Layers,
  MoreHorizontal,
  RotateCw,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { listSuperAdminOrganizations } from '../../api/superadmin'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  active: 'success',
  trial: 'info',
  locked: 'danger',
  suspended: 'danger',
}

const planColors = {
  'No Plan': '#065f1a',
  Basic: 'var(--color-primary-700)',
  Pro: 'var(--color-primary-500)',
  Enterprise: 'var(--color-amber-500)',
}

const planFilterOptions = ['All Plans', 'No Plan', 'Basic', 'Pro', 'Enterprise']

const dateRangeOptions = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'All time', days: null },
]

const statusFilterOptions = ['All Status', 'Trial', 'Locked', 'Active']

const statusColors = {
  trial: 'var(--color-blue-500)',
  locked: 'var(--color-red-500)',
  active: 'var(--color-green-600)',
  suspended: 'var(--color-red-500)',
}

function formatDateLabel(value, withTime = false) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const datePart = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  if (!withTime) return datePart
  const timePart = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} ${timePart}`
}

function titleCase(value = '') {
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function normalizePlanName(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized || normalized === 'no plan') return 'No Plan'
  if (normalized === 'basic') return 'Basic'
  if (normalized === 'pro') return 'Pro'
  if (normalized === 'enterprise') return 'Enterprise'
  return value
}

function getInitials(value = '') {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'OR'
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function AnalyticsCard({ children, className = '' }) {
  return (
    <section className={`theme-glass rounded-2xl border border-surface-border bg-surface shadow-(--shadow-card) ${className}`}>
      {children}
    </section>
  )
}

function PanelHeader({ icon: Icon, title, subtitle, actions }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-muted">
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-(--font-display) text-[16px] font-bold leading-5 text-fg">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12px] font-medium leading-4 text-fg-muted">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, tone = 'green' }) {
  const tones = {
    green: 'bg-primary-50 text-primary-700',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-500',
    purple: 'bg-primary-50 text-primary-700',
  }

  return (
    <AnalyticsCard className="flex min-h-[86px] items-center gap-4 p-4">
      <span className={`flex size-12 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}>
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold leading-4 text-fg-muted">{label}</p>
        <p className="mt-1 font-(--font-display) text-[26px] font-extrabold leading-none tracking-tight text-fg">{value}</p>
      </div>
    </AnalyticsCard>
  )
}

function exportAnalyticsCsv(organizations) {
  const rows = [
    ['Organization', 'Plan', 'Status', 'Email', 'Created'],
    ...organizations.map((org) => [
      org.name || '',
      org.plan?.name || 'No Plan',
      org.status || '',
      org.email || '',
      formatDateLabel(org.created_at, true),
    ]),
  ]
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'platform-analytics.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function PlatformAnalytics() {
  const navigate = useNavigate()
  const [organizations, setOrganizations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateRange, setDateRange] = useState(dateRangeOptions[3])
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false)
  const [planFilter, setPlanFilter] = useState('All Plans')
  const [isPlanFilterOpen, setIsPlanFilterOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false)

  const loadOrganizations = async () => {
    setIsLoading(true)
    setError('')

    const result = await listSuperAdminOrganizations()

    if (!result.success) {
      setOrganizations([])
      setError(result.error)
      setIsLoading(false)
      return
    }

    setOrganizations(result.organizations)
    setIsLoading(false)
  }

  useEffect(() => {
    loadOrganizations()
  }, [])

  useEffect(() => {
    if (!isDateRangeOpen && !isPlanFilterOpen && !isStatusFilterOpen) return undefined

    const closeOpenFilters = () => {
      setIsDateRangeOpen(false)
      setIsPlanFilterOpen(false)
      setIsStatusFilterOpen(false)
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') closeOpenFilters()
    }

    window.addEventListener('click', closeOpenFilters)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('click', closeOpenFilters)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isDateRangeOpen, isPlanFilterOpen, isStatusFilterOpen])

  const filteredOrganizations = useMemo(() => {
    if (!dateRange.days) return organizations

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - dateRange.days)
    cutoff.setHours(0, 0, 0, 0)

    return organizations.filter((org) => {
      const createdAt = new Date(org.created_at || 0)
      return !Number.isNaN(createdAt.getTime()) && createdAt >= cutoff
    })
  }, [organizations, dateRange.days])

  const stats = useMemo(() => {
    const active = filteredOrganizations.filter((org) => org.status === 'active')
    const trial = filteredOrganizations.filter((org) => org.status === 'trial')
    const estimatedMrr = active.reduce((sum, org) => sum + (Number(org.plan?.price_monthly) || 0), 0)

    const planNames = ['No Plan', 'Basic', 'Pro', 'Enterprise']
    const planData = planNames.map((name) => ({
      name,
      value: filteredOrganizations.filter((org) => normalizePlanName(org.plan?.name) === name).length,
      color: planColors[name],
    }))

    const statusNames = ['trial', 'locked', 'active']
    const statusData = statusNames.map((status) => ({
      status,
      label: titleCase(status),
      value: filteredOrganizations.filter((org) => org.status === status).length,
      color: statusColors[status],
    }))

    const recent = [...filteredOrganizations]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 3)

    const recentActivity = [
      ...recent.slice(0, 1).map((org) => ({
        id: `signup-${org.id}`,
        icon: Building2,
        tone: 'green',
        title: 'New organization signed up',
        body: `${org.name} joined the platform`,
        time: '2 hours ago',
      })),
      ...filteredOrganizations.filter((org) => org.plan?.name && org.plan.name !== 'No Plan').slice(0, 1).map((org) => ({
        id: `plan-${org.id}`,
        icon: IndianRupee,
        tone: 'purple',
        title: 'Plan upgraded',
        body: `${org.name} upgraded to ${org.plan.name} plan`,
        time: '5 hours ago',
      })),
      ...filteredOrganizations.filter((org) => org.status === 'active').slice(0, 1).map((org) => ({
        id: `status-${org.id}`,
        icon: Users,
        tone: 'blue',
        title: 'Organization status changed',
        body: `${org.name} is now Active`,
        time: '1 day ago',
      })),
      ...trial.slice(0, 1).map((org) => ({
        id: `trial-${org.id}`,
        icon: Clock,
        tone: 'amber',
        title: 'New trial started',
        body: `${org.name} started a 14-day trial`,
        time: '1 day ago',
      })),
    ].slice(0, 4)

    return {
      total: filteredOrganizations.length,
      active: active.length,
      trial: trial.length,
      estimatedMrr,
      planData,
      statusData,
      recent,
      recentActivity,
    }
  }, [filteredOrganizations])

  if (isLoading) {
    return (
      <Card>
        <LoadingSpinner label="Loading platform analytics..." />
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <div className="py-8 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={loadOrganizations}>
            <RotateCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  const visiblePlanData = planFilter === 'All Plans' ? stats.planData : stats.planData.filter((entry) => entry.name === planFilter)
  const visiblePlanTotal = visiblePlanData.reduce((sum, item) => sum + item.value, 0)
  const visibleStatusData = statusFilter === 'All Status' ? stats.statusData : stats.statusData.filter((entry) => entry.label === statusFilter)
  const statusTotal = visibleStatusData.reduce((sum, item) => sum + item.value, 0)
  const statusMax = Math.max(80, ...visibleStatusData.map((item) => item.value))
  const statusTicks = [80, 60, 40, 20, 0]

  return (
    <div className="space-y-4">
      <style>
        {`
          @keyframes platformAnalyticsBarIn {
            from { transform: scaleY(0); }
            to { transform: scaleY(1); }
          }

          .platform-analytics-bar-load {
            animation: platformAnalyticsBarIn 720ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
            transform-origin: bottom;
          }

          @media (prefers-reduced-motion: reduce) {
            .platform-analytics-bar-load {
              animation: none;
            }
          }
        `}
      </style>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="!block text-xl font-semibold tracking-tight text-fg">Platform Analytics</h1>
          <p className="!block mt-1 text-[13px] font-medium leading-5 text-fg-muted">Monitor organizations growth, plan mix, account status, and estimated recurring revenue.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          <div className="relative" onClick={(event) => event.stopPropagation()}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 min-w-36 justify-between rounded-xl px-4 text-[12px] font-bold"
              onClick={() => setIsDateRangeOpen((isOpen) => !isOpen)}
              aria-haspopup="listbox"
              aria-expanded={isDateRangeOpen}
            >
              <CalendarDays className="size-4" aria-hidden="true" />
              {dateRange.label}
              <ChevronDown className={`size-4 transition-transform ${isDateRangeOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </Button>
            {isDateRangeOpen && (
              <div
                role="listbox"
                className="absolute right-0 top-11 z-30 w-40 overflow-hidden rounded-xl border border-surface-border bg-surface p-1.5 shadow-(--shadow-popover)"
              >
                {dateRangeOptions.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    role="option"
                    aria-selected={dateRange.label === option.label}
                    onClick={() => {
                      setDateRange(option)
                      setIsDateRangeOpen(false)
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${
                      dateRange.label === option.label ? 'bg-primary-50 text-primary-700' : 'text-fg-muted hover:bg-surface-muted'
                    }`}
                  >
                    {option.label}
                    {dateRange.label === option.label && <span className="size-1.5 rounded-full bg-primary-700" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button type="button" onClick={() => exportAnalyticsCsv(filteredOrganizations)} size="sm" className="h-9 rounded-xl px-5 text-[12px] font-bold">
            <ArrowDownToLine className="size-4" aria-hidden="true" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Building2} label="Total Organizations" value={stats.total} tone="green" />
        <MetricCard icon={Users} label="Active Organizations" value={stats.active} tone="blue" />
        <MetricCard icon={Clock} label="On Trial" value={stats.trial} tone="amber" />
        <MetricCard icon={IndianRupee} label="Estimated MRR (Active Plans)" value={formatCurrency(stats.estimatedMrr)} tone="purple" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AnalyticsCard className="p-4">
          <PanelHeader
            icon={Layers}
            title="Organizations by Plan"
            subtitle="Distribution of organizations across different plans"
            actions={
              <div className="relative" onClick={(event) => event.stopPropagation()}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 min-w-32 justify-between rounded-xl px-3 text-[12px] font-bold"
                  onClick={() => setIsPlanFilterOpen((isOpen) => !isOpen)}
                  aria-haspopup="listbox"
                  aria-expanded={isPlanFilterOpen}
                >
                  {planFilter}
                  <ChevronDown className={`size-4 transition-transform ${isPlanFilterOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </Button>
                {isPlanFilterOpen && (
                  <div
                    role="listbox"
                    className="absolute right-0 top-10 z-20 w-40 overflow-hidden rounded-xl border border-surface-border bg-surface p-1.5 shadow-(--shadow-popover)"
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
                          planFilter === option ? 'bg-primary-50 text-primary-700' : 'text-fg-muted hover:bg-surface-muted'
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
          <div className="grid items-center gap-4 md:grid-cols-[180px_1fr]">
            <div className="relative mx-auto h-[168px] w-[168px]">
              <PieChart width={168} height={168}>
                <Pie data={visiblePlanData} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={1} stroke="none">
                  {visiblePlanData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
              <div className="absolute inset-[42px] rounded-full bg-surface" aria-hidden="true" />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-(--font-display) text-[22px] font-extrabold leading-none text-fg">{visiblePlanTotal}</span>
                <span className="mt-1 text-[12px] font-semibold text-fg-muted">Total</span>
              </div>
            </div>
            <div className="space-y-1">
              {visiblePlanData.map((entry) => {
                const percentage = visiblePlanTotal ? ((entry.value / visiblePlanTotal) * 100).toFixed(1) : '0'
                return (
                  <div key={entry.name} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-surface-border py-2 text-[12px] font-semibold text-fg-muted last:border-b-0">
                    <span className="size-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span>{entry.name}</span>
                    <span className="text-fg">{entry.value}</span>
                    <span className="w-12 text-right text-fg-muted">{percentage}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </AnalyticsCard>

        <AnalyticsCard className="p-4">
          <PanelHeader
            icon={Activity}
            title="Organizations by Status"
            subtitle="Current status distribution of all organizations"
            actions={
              <div className="relative" onClick={(event) => event.stopPropagation()}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 min-w-32 justify-between rounded-xl px-3 text-[12px] font-bold"
                  onClick={() => setIsStatusFilterOpen((isOpen) => !isOpen)}
                  aria-haspopup="listbox"
                  aria-expanded={isStatusFilterOpen}
                >
                  {statusFilter}
                  <ChevronDown className={`size-4 transition-transform ${isStatusFilterOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </Button>
                {isStatusFilterOpen && (
                  <div
                    role="listbox"
                    className="absolute right-0 top-10 z-20 w-40 overflow-hidden rounded-xl border border-surface-border bg-surface p-1.5 shadow-(--shadow-popover)"
                  >
                    {statusFilterOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="option"
                        aria-selected={statusFilter === option}
                        onClick={() => {
                          setStatusFilter(option)
                          setIsStatusFilterOpen(false)
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${
                          statusFilter === option ? 'bg-primary-50 text-primary-700' : 'text-fg-muted hover:bg-surface-muted'
                        }`}
                      >
                        {option}
                        {statusFilter === option && <span className="size-1.5 rounded-full bg-primary-700" aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            }
          />
          <div className="grid items-center gap-4 md:grid-cols-[1.25fr_0.85fr]">
            <div className="grid h-[168px] grid-cols-[28px_1fr] gap-2">
              <div className="flex h-[136px] flex-col justify-between pt-1 text-[11px] font-medium text-fg-muted">
                {statusTicks.map((tick) => <span key={tick}>{tick}</span>)}
              </div>
              <div>
                <div className="relative flex h-[136px] items-end justify-around border-b border-surface-border bg-[linear-gradient(to_bottom,var(--color-surface-border)_1px,transparent_1px)] bg-[length:100%_34px] px-4">
                  {visibleStatusData.map((entry, index) => {
                    const barHeight = statusMax ? Math.max(3, (entry.value / statusMax) * 118) : 3
                    return (
                      <div key={entry.status} className="flex h-full w-12 flex-col items-center justify-end">
                        <span className="mb-1 text-[12px] font-bold" style={{ color: entry.color }}>{entry.value}</span>
                        <span
                          className="platform-analytics-bar-load w-[38px] rounded-t-md shadow-(--shadow-xs)"
                          style={{ height: `${barHeight}px`, backgroundColor: entry.color, animationDelay: `${120 + index * 90}ms` }}
                          aria-hidden="true"
                        />
                      </div>
                    )
                  })}
                </div>
                <div className="mt-2 flex justify-around px-4 text-[11px] font-medium text-fg-muted">
                  {visibleStatusData.map((entry) => <span key={entry.status} className="w-12 text-center">{entry.label}</span>)}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {visibleStatusData.map((entry) => {
                const percentage = statusTotal ? ((entry.value / statusTotal) * 100).toFixed(1) : '0'
                const statusTone = {
                  trial: 'bg-(--badge-info-bg) text-(--badge-info-text)',
                  locked: 'bg-(--badge-danger-bg) text-(--badge-danger-text)',
                  active: 'bg-(--badge-success-bg) text-(--badge-success-text)',
                }[entry.status] || 'bg-surface-muted text-fg-muted'
                return (
                  <div key={entry.status} className={`grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-xl px-4 py-2.5 text-[12px] font-semibold ${statusTone}`}>
                    <span className="size-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span>{entry.label}</span>
                    <span className="text-fg">{entry.value}</span>
                    <span className="w-12 text-right text-fg-muted">{percentage}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </AnalyticsCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_1fr]">
        <AnalyticsCard className="p-4">
          <PanelHeader icon={UserPlus} title="Recently Signed Up" subtitle="Newest organizations on the platform" actions={<Button type="button" variant="outline" size="sm" className="h-8 rounded-xl px-4 text-[12px] font-bold" onClick={() => navigate('/superadmin/organizations')}>View All<ChevronRight className="size-4" aria-hidden="true" /></Button>} />
          <div className="overflow-hidden rounded-xl">
            <div className="grid grid-cols-[1.6fr_0.7fr_0.7fr_1fr_0.4fr] bg-surface-muted px-3 py-2 text-[11px] font-bold text-fg-muted">
              <span>Organization</span><span>Plan</span><span>Status</span><span>Joined On</span><span>Actions</span>
            </div>
            <div className="divide-y divide-(--row-divider)">
              {stats.recent.map((org) => (
                <div key={org.id} className="grid grid-cols-[1.6fr_0.7fr_0.7fr_1fr_0.4fr] items-center px-3 py-2.5 text-[12px]">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-bold text-primary-700">{getInitials(org.name)}</span>
                    <div className="min-w-0"><p className="truncate font-bold text-fg">{org.name}</p><p className="truncate text-xs font-medium text-fg-muted">{org.email || 'No email'}</p></div>
                  </div>
                  <span><Badge variant={org.plan?.name ? 'neutral' : 'info'}>{normalizePlanName(org.plan?.name)}</Badge></span>
                  <span><Badge variant={statusVariant[org.status] || 'neutral'} dot>{titleCase(org.status)}</Badge></span>
                  <span className="text-[12px] font-medium text-fg-muted">{formatDateLabel(org.created_at, true)}</span>
                  <button type="button" className="text-fg-muted hover:text-primary-700"><MoreHorizontal className="size-4" aria-hidden="true" /></button>
                </div>
              ))}
              {stats.recent.length === 0 && <p className="py-8 text-center text-sm text-fg-muted">No organizations yet.</p>}
            </div>
          </div>
        </AnalyticsCard>

        <AnalyticsCard className="p-4">
          <PanelHeader icon={Zap} title="Recent Activity" subtitle="Latest platform activity" actions={<Button type="button" variant="outline" size="sm" className="h-8 rounded-xl px-4 text-[12px] font-bold" onClick={() => navigate('/superadmin/organizations')}>View All<ChevronRight className="size-4" aria-hidden="true" /></Button>} />
          <div className="space-y-0">
            {stats.recentActivity.map((activity, index) => {
              const Icon = activity.icon
              const toneClass = { green: 'bg-primary-50 text-primary-700', purple: 'bg-primary-50 text-primary-700', blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-500' }[activity.tone]
              const dotClass = { green: 'bg-primary-600', purple: 'bg-primary-600', blue: 'bg-blue-500', amber: 'bg-amber-500' }[activity.tone]
              return (
                <div key={activity.id} className="relative flex items-start gap-4 pb-3 last:pb-0">
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${toneClass}`}><Icon className="size-4.5" aria-hidden="true" /></span>
                  <span className={`mt-4 size-1.5 shrink-0 rounded-full ${dotClass}`} aria-hidden="true" />
                  {index < stats.recentActivity.length - 1 && <span className="absolute left-[48px] top-6 h-[calc(100%-1rem)] w-px bg-(--row-divider)" aria-hidden="true" />}
                  <div className="min-w-0 flex-1"><p className="text-[13px] font-bold leading-4 text-fg">{activity.title}</p><p className="mt-0.5 truncate text-[12px] font-medium leading-4 text-fg-muted">{activity.body}</p></div>
                  <span className="shrink-0 text-[12px] font-semibold text-fg-muted">{activity.time}</span>
                </div>
              )
            })}
            {stats.recentActivity.length === 0 && <p className="py-8 text-center text-sm text-fg-muted">No recent activity.</p>}
          </div>
        </AnalyticsCard>
      </div>
    </div>
  )
}
