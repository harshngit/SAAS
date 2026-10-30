import { SkeletonValue } from '../../components/ui/Skeleton'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import { resolveDateRange, isWithinDateRange } from '../../utils/dateRange'
import { exportRowsToExcel } from '../../utils/exportToExcel'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Search } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import DataTable from '../../components/ui/DataTable'
import { useToast } from '../../components/ui/toastContext'
import { loadSummaryRows } from '../../utils/listSummary'
import { listPlatformRequests, decidePlatformRequest, listPlatformFeatures, getPlatformEntitlements, getPlatformOrganization } from '../../api/platform'
import SuperAdminPageHeader from './SuperAdminPageHeader'
import { usePlatformAccess, dateLabel, label, featureKey, featureName } from './platformHelpers'
import { RequestStatus, PlatformError } from './platformPresentation'

export default function PlatformRequests({ kind = 'upgrade', organizationId, onChanged }) {
  const { isSuperAdmin, basePath } = usePlatformAccess()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [tick, setTick] = useState(0)
  const [decision, setDecision] = useState(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [decisionError, setDecisionError] = useState('')
  const [currentState, setCurrentState] = useState(null)
  const [stateLoading, setStateLoading] = useState(false)
  const refresh = useCallback(() => setTick(value => value + 1), [])
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    const scope = organizationId ? { organization_id: organizationId } : isSuperAdmin ? {} : { mine: true }
    Promise.all([
      loadSummaryRows(params => listPlatformRequests(kind, { ...params, ...scope }), 'requests'),
      kind === 'feature' ? listPlatformFeatures() : Promise.resolve({ success: true, features: [] }),
    ]).then(([result, catalog]) => {
      if (!active) return
      setLoading(false)
      setRows(result.success ? result.requests : [])
      setFeatures(catalog.success ? catalog.features : [])
      setError(!result.success ? result.error : !catalog.success ? catalog.error : '')
    })
    return () => { active = false }
  }, [kind, organizationId, isSuperAdmin, tick])
  useEffect(() => {
    if (kind !== 'feature' || !decision) return
    let active = true
    const orgId = decision.row.organization_id ?? decision.row.organization?.id
    setStateLoading(true); setCurrentState(null)
    if (!orgId) { setStateLoading(false); return }
    getPlatformEntitlements(orgId).then(result => {
      if (!active) return
      setStateLoading(false)
      if (!result.success) setDecisionError(result.error)
      else setCurrentState(result.data?.features?.[decision.row.entitlement_key] ?? null)
    })
    return () => { active = false }
  }, [kind, decision])
  const summaryRequests = rows
  const requestSummary = useMemo(() => ({
    total: summaryRequests.length,
    pending: summaryRequests.filter(row => row.status === 'pending').length,
    approved: summaryRequests.filter(row => row.status === 'approved').length,
    rejected: summaryRequests.filter(row => row.status === 'rejected').length,
  }), [summaryRequests])
  const featureLabel = row => featureName(features.find(feature => featureKey(feature) === row.entitlement_key) || {})
  const organizationName = row => row.organization?.name ?? row.organization_name ?? 'Organization unavailable'
  // requested_by can now be null (the platform staff member who raised it was deleted - the
  // request itself is kept) - see crm_changes15.md "Delete platform staff".
  const person = row => row.requested_by?.name ?? row.requested_by?.email ?? row.requested_by_name ?? 'Deleted user'
  const columns = [
    { key: 'organization', header: 'Organization', render: organizationName },
    ...(kind === 'upgrade' ? [
      { key: 'current_plan', header: 'Current Plan', render: row => row.current_plan?.name ?? row.current_plan_name ?? 'Not available' },
      { key: 'requested_plan', header: 'Requested Plan', render: row => row.requested_plan?.name ?? row.requested_plan_name ?? 'Not available' },
      { key: 'billing_cycle', header: 'Billing Cycle', render: row => label(row.billing_cycle) },
    ] : [
      { key: 'entitlement_key', header: 'Feature', render: featureLabel },
      { key: 'action', header: 'Requested Action', render: row => label(row.action) },
    ]),
    { key: 'requested_by', header: 'Requested By', render: person },
    { key: 'reason', header: 'Reason', render: row => <p className="max-w-xs whitespace-pre-wrap break-words">{row.reason || 'Not provided'}</p> },
    { key: 'status', header: 'Status', render: row => <RequestStatus value={row.status} /> },
    { key: 'created_at', header: 'Created', render: row => row.created_at ? dateLabel(row.created_at) : 'Not available' },
    { key: 'decision_note', header: 'Decision Note', render: row => row.decision_note ?? row.note ?? 'Not provided' },
  ]
  const range = resolveDateRange(datePreset, customFrom, customTo)
  const visibleRequests = rows.map(row => ({ ...row, _search: [organizationName(row), featureLabel(row), row.current_plan?.name, row.current_plan_name, row.requested_plan?.name, row.requested_plan_name, person(row), row.reason, row.status, row.decision_note].filter(Boolean).join(' ') }))
    .filter(row => (status === 'all' || row.status === status) && isWithinDateRange(row.created_at, range.dateFrom, range.dateTo) && row._search.toLowerCase().includes(search.trim().toLowerCase()))
  const exportRequests = () => exportRowsToExcel(`${kind}-requests`, [
    ['Organization', ...(kind === 'upgrade' ? ['Current Plan', 'Requested Plan', 'Billing Cycle'] : ['Feature', 'Requested Action']), 'Requested By', 'Reason', 'Status', 'Created', 'Decision Note'],
    ...visibleRequests.map(row => [organizationName(row), ...(kind === 'upgrade' ? [row.current_plan?.name ?? row.current_plan_name, row.requested_plan?.name ?? row.requested_plan_name, row.billing_cycle] : [featureLabel(row), row.action]), person(row), row.reason, row.status, row.created_at, row.decision_note ?? row.note]),
  ])
  function open(row, action) { setDecision({ row, action }); setNote(''); setDecisionError('') }
  async function decide() {
    if (!isSuperAdmin || !decision || decision.row.status !== 'pending') return
    setSaving(true); setDecisionError('')
    const result = await decidePlatformRequest(kind, decision.row.id, decision.action, note)
    setSaving(false)
    if (!result.success) {
      setDecisionError(result.error)
      if (result.status === 409) refresh()
      return
    }
    setDecision(null); refresh(); onChanged?.(); showToast({ title: `Request ${decision.action === 'approve' ? 'approved' : 'rejected'}` })
    const orgId = decision.row.organization_id ?? decision.row.organization?.id
    if (decision.action === 'approve' && orgId) {
      const updated = kind === 'feature' ? await getPlatformEntitlements(orgId) : await getPlatformOrganization(orgId)
      if (!updated.success) showToast({ title: 'Request approved; refresh failed', message: updated.error })
      else if (kind === 'feature') setCurrentState(updated.data?.features?.[decision.row.entitlement_key] ?? null)
    }
  }
  const title = kind === 'upgrade' ? 'Upgrade Requests' : 'Feature Requests'
  const queueTitle = kind === 'upgrade' ? 'Upgrade Request Queue' : 'Feature Request Queue'
  return <div className="space-y-4">
    {!organizationId && <SuperAdminPageHeader title={title} subtitle={isSuperAdmin ? 'Review organization requests.' : 'Track requests you raised for organizations.'} />}
    {!organizationId && <Card><div className="grid grid-cols-2 divide-x divide-surface-border lg:grid-cols-4">{['total', 'pending', 'approved', 'rejected'].map(key => <div key={key} className="p-4"><p className="text-xs text-fg-muted">{label(key)}</p><p className="mt-3 text-2xl font-semibold"><SkeletonValue loading={loading} className="h-7 w-12 rounded-lg">{requestSummary[key]}</SkeletonValue></p></div>)}</div></Card>}
    <Card>
      <PlatformError error={error} retry={refresh} />
      <DataTable
        columns={columns.map(column => ({ ...column, sortable: ['status', 'created_at', 'billing_cycle', 'action'].includes(column.key) }))}
        data={visibleRequests}
        loading={loading}
        searchable={false}
        emptyTitle={kind === 'upgrade' ? 'No upgrade requests yet' : 'No feature requests yet'}
        renderToolbar={({ resultCount }) => (
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-(--font-display) text-base font-semibold tracking-tight text-fg">{queueTitle}</h3>
              <p className="mt-2 text-xs font-medium text-neutral-400">{resultCount} {resultCount === 1 ? 'result' : 'results'}</p>
            </div>
            <div className="flex flex-wrap items-start gap-3">
              <div className="relative w-full sm:w-56">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                <input
                  type="text"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search requests..."
                  className="w-full rounded-full border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-(--modal-bg) focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Select
                value={status}
                onChange={event => setStatus(event.target.value)}
                options={[{ value: 'all', label: 'All' }, ...['pending', 'approved', 'rejected'].map(value => ({ value, label: label(value) }))]}
                className="w-32"
                triggerClassName="h-9 rounded-xl bg-surface py-1.5 text-xs"
              />
              <DateRangeFilter
                preset={datePreset}
                onPresetChange={setDatePreset}
                customFrom={customFrom}
                customTo={customTo}
                onCustomChange={({ from, to }) => { setCustomFrom(from); setCustomTo(to) }}
                className="w-36"
              />
              <Button variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={exportRequests} disabled={loading || !visibleRequests.length}>
                <Download className="size-4" aria-hidden="true" />
                Export
              </Button>
            </div>
          </div>
        )}
        actions={row => [
          ...(isSuperAdmin && row.status === 'pending' ? [{ label: 'Approve', onClick: () => open(row, 'approve') }, { label: 'Reject', onClick: () => open(row, 'reject') }] : []),
          { label: 'View Organization', onClick: () => { const id = row.organization_id ?? row.organization?.id; if (id) navigate(`${basePath}/organizations/${id}`) }, disabled: !(row.organization_id ?? row.organization?.id) },
        ]}
      />
    </Card>
    <Modal isOpen={!!decision} onClose={() => !saving && setDecision(null)} title={`${decision?.action === 'approve' ? 'Approve' : 'Reject'} ${kind === 'upgrade' ? 'plan upgrade' : 'feature change'}?`} footer={<><Button variant="outline" disabled={saving} onClick={() => setDecision(null)}>Cancel</Button><Button loading={saving} disabled={stateLoading || loading || rows.find(row => row.id === decision?.row.id)?.status !== 'pending'} onClick={decide}>Confirm</Button></>}>
      {decision && <div className="space-y-3"><PlatformError error={decisionError} /><p><strong>Organization:</strong> {organizationName(decision.row)}</p>{kind === 'upgrade' ? <p><strong>Plan:</strong> {decision.row.current_plan?.name ?? decision.row.current_plan_name ?? 'Not available'} to {decision.row.requested_plan?.name ?? decision.row.requested_plan_name ?? 'Not available'}</p> : <><p><strong>Feature:</strong> {featureLabel(decision.row)}</p><p><strong>Current State:</strong> {stateLoading ? 'Loading...' : currentState === true ? 'Enabled' : currentState === false ? 'Restricted' : 'Not available'}</p><p><strong>Requested Action:</strong> {label(decision.row.action)}</p></>}<p><strong>Requested By:</strong> {person(decision.row)}</p><p className="whitespace-pre-wrap break-words"><strong>Reason:</strong> {decision.row.reason}</p><Input label="Decision note (optional)" value={note} onChange={event => setNote(event.target.value)} /></div>}
    </Modal>
  </div>
}
