import { useEffect, useMemo, useState } from 'react'
import { Building2, Clock, IndianRupee, RotateCw } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import StatCard from '../../components/ui/StatCard'
import Badge from '../../components/ui/Badge'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { listSuperAdminOrganizations } from '../../api/superadmin'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  active: 'success',
  trial: 'info',
  locked: 'danger',
  suspended: 'danger',
}

function formatDateLabel(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PlatformAnalytics() {
  const [organizations, setOrganizations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

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

  const stats = useMemo(() => {
    const active = organizations.filter((org) => org.status === 'active')
    const trial = organizations.filter((org) => org.status === 'trial')
    // Approximates MRR from each active org's plan price - the platform has no dedicated
    // billing/revenue endpoint, so this is the same convention OrganizationsList.jsx uses.
    const estimatedMrr = active.reduce((sum, org) => sum + (org.plan?.price_monthly || 0), 0)

    const byPlan = organizations.reduce((acc, org) => {
      const planName = org.plan?.name || 'No Plan'
      acc[planName] = (acc[planName] || 0) + 1
      return acc
    }, {})

    const byStatus = organizations.reduce((acc, org) => {
      acc[org.status] = (acc[org.status] || 0) + 1
      return acc
    }, {})

    const recent = [...organizations]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8)

    return { total: organizations.length, active: active.length, trial: trial.length, estimatedMrr, byPlan, byStatus, recent }
  }, [organizations])

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Platform Analytics</h1>
        <p className="mt-1 text-sm text-neutral-500">View platform-wide analytics across every organization</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard icon={Building2} label="Total Organizations" value={stats.total} />
        <StatCard icon={Building2} iconVariant="success" label="Active Organizations" value={stats.active} />
        <StatCard icon={Clock} iconVariant="info" label="On Trial" value={stats.trial} />
        <StatCard icon={IndianRupee} iconVariant="warning" label="Estimated MRR (Active Plans)" value={formatCurrency(stats.estimatedMrr)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Organizations by Plan">
          <div className="space-y-3">
            {Object.entries(stats.byPlan).length === 0 ? (
              <p className="text-sm text-neutral-400">No organizations yet.</p>
            ) : (
              Object.entries(stats.byPlan).map(([planName, count]) => (
                <div key={planName} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-700">{planName}</span>
                  <span className="font-semibold text-neutral-900">{count}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card title="Organizations by Status">
          <div className="space-y-3">
            {Object.entries(stats.byStatus).length === 0 ? (
              <p className="text-sm text-neutral-400">No organizations yet.</p>
            ) : (
              Object.entries(stats.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <Badge variant={statusVariant[status] || 'neutral'} dot>{status}</Badge>
                  <span className="font-semibold text-neutral-900">{count}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card title="Recently Signed Up" subtitle="Newest organizations on the platform">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                <th className="whitespace-nowrap px-4 py-2.5">Organization</th>
                <th className="whitespace-nowrap px-4 py-2.5">Plan</th>
                <th className="whitespace-nowrap px-4 py-2.5">Status</th>
                <th className="whitespace-nowrap px-4 py-2.5">Signed Up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {stats.recent.map((org) => (
                <tr key={org.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-neutral-900">{org.name}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-neutral-600">{org.plan?.name || 'No Plan'}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <Badge variant={statusVariant[org.status] || 'neutral'} dot>{org.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-neutral-500">{formatDateLabel(org.created_at)}</td>
                </tr>
              ))}
              {stats.recent.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-neutral-400">No organizations yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
