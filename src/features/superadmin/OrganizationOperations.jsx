import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import DataTable from '../../components/ui/DataTable'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/toastContext'
import { listPlatformPlans, listPlatformFeatures, getPlatformEntitlements, createPlatformUpgrade, createPlatformFeature } from '../../api/platform'
import PlatformRequests from './PlatformRequests'
import { featureKey, featureName } from './platformHelpers'
import { PlatformError } from './platformPresentation'

export default function OrganizationOperations({ organization, onOrganizationChanged }) {
  const { showToast } = useToast()
  const id = organization.id
  const [features, setFeatures] = useState([])
  const [entitlements, setEntitlements] = useState(null)
  const [plans, setPlans] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [tab, setTab] = useState('upgrade')
  const [modal, setModal] = useState(null)
  const [draft, setDraft] = useState({})
  const [fields, setFields] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([listPlatformFeatures(), getPlatformEntitlements(id), listPlatformPlans()]).then(([catalog, access, plansResult]) => {
      if (!active) return
      setFeatures(catalog.success ? catalog.features : [])
      setEntitlements(access.success ? access.data : null)
      setPlans(plansResult.success ? plansResult.plans : [])
      setError([catalog, access, plansResult].filter(result => !result.success).map(result => result.error).join(' '))
      setLoading(false)
    })
    return () => { active = false }
  }, [id, tick])
  const refresh = () => { setTick(value => value + 1); onOrganizationChanged?.() }
  const availablePlans = plans.filter(plan => plan.id !== (organization.plan?.id ?? organization.plan_id) && plan.is_active !== false)
  const groups = new Map()
  features.forEach(feature => {
    const category = feature.category_name || 'Other'
    if (!groups.has(category)) groups.set(category, [])
    groups.get(category).push(feature)
  })
  function open(kind) {
    setModal(kind); setDraft(kind === 'upgrade' ? { requested_plan_id: '', billing_cycle: 'monthly', reason: '', notes: '' } : { entitlement_key: '', action: '', reason: '' }); setFields({}); setFormError('')
  }
  async function submit(event) {
    event.preventDefault()
    const errors = {}
    if (!draft.reason?.trim()) errors.reason = 'Reason is required.'
    if (modal === 'upgrade' && draft.reason?.length > 500) errors.reason = 'Reason must be 500 characters or less.'
    if (modal === 'upgrade') {
      if (!availablePlans.some(plan => plan.id === draft.requested_plan_id)) errors.requested_plan_id = 'Select an available plan.'
      if (draft.notes?.length > 2000) errors.notes = 'Notes must be 2000 characters or less.'
    } else {
      if (!features.some(feature => featureKey(feature) === draft.entitlement_key)) errors.entitlement_key = 'Select a feature.'
      if (!['unlock', 'restrict'].includes(draft.action)) errors.action = 'Select the requested action.'
    }
    setFields(errors)
    if (Object.keys(errors).length) return
    setSaving(true); setFormError('')
    const body = { ...draft, reason: draft.reason.trim() }
    const result = modal === 'upgrade' ? await createPlatformUpgrade(id, body) : await createPlatformFeature(id, body)
    setSaving(false)
    if (!result.success) { setFormError(result.error); setFields(result.fieldErrors || {}); if (result.status === 409) setTick(value => value + 1); return }
    setModal(null); refresh(); showToast({ title: 'Request submitted' })
  }
  const currentFeature = entitlements?.features?.[draft.entitlement_key]
  return <div className="space-y-4">
    <Card title="Subscription Status"><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><div><p className="text-xs text-fg-muted">Trial Ends</p><p>{organization.trial_ends_at ? new Date(organization.trial_ends_at).toLocaleDateString('en-IN') : 'Not available'}</p></div><div><p className="text-xs text-fg-muted">Plan Expiry</p><p>{organization.plan_expires_at ? new Date(organization.plan_expires_at).toLocaleDateString('en-IN') : 'Not available'}</p></div><div><p className="text-xs text-fg-muted">Upgrade Status</p><p>{organization.upgrade_status || 'No upgrade requested'}</p></div></div></Card>
    <Card title="Organization Requests"><div className="flex flex-wrap gap-3"><Button disabled={loading || !availablePlans.length} onClick={() => open('upgrade')}>Request Plan Upgrade</Button><Button variant="outline" disabled={loading || !features.length || !entitlements} onClick={() => open('feature')}>Request Feature Change</Button></div><PlatformError error={error} retry={() => setTick(value => value + 1)} /></Card>
    <Card title="Features & Access" subtitle="Effective feature access returned by the backend.">
      {loading ? <LoadingSpinner variant="table" layout="invoice" label="Loading features..." columns={3} /> : <DataTable columns={[
        { key: 'name', header: 'Feature Name', render: featureName },
        { key: 'category_name', header: 'Category', render: row => row.category_name || 'Other' },
        { key: 'enabled', header: 'Current Status', render: row => { const value = entitlements?.features?.[featureKey(row)]; return <Badge variant={value === true ? 'success' : 'neutral'}>{value === true ? 'Enabled' : value === false ? 'Restricted' : 'Not available'}</Badge> } },
      ]} data={features.map(feature => ({ ...feature, id: feature.id ?? featureKey(feature), name: featureName(feature) }))} searchKeys={['name', 'category_name']} emptyTitle="No features available" />}
      {Array.isArray(entitlements?.feature_overrides) && entitlements.feature_overrides.length > 0 && <div className="mt-4"><h3 className="mb-2 text-sm font-medium">Feature Overrides</h3><DataTable searchable={false} columns={[
        { key: 'entitlement_key', header: 'Feature', render: row => featureName(features.find(feature => featureKey(feature) === row.entitlement_key) || {}) },
        { key: 'effect', header: 'Effect', render: row => row.is_allowed === true ? 'Enabled' : row.is_allowed === false ? 'Restricted' : 'Not available' },
        { key: 'is_active', header: 'Status', render: row => row.is_active ? 'Active' : 'Inactive' },
        { key: 'reason', header: 'Reason' },
      ]} data={entitlements.feature_overrides} /></div>}

    </Card>
    <Card title="Requests"><div role="tablist" aria-label="Organization request history" className="flex flex-wrap gap-2">{[['upgrade', 'Plan Upgrade Requests'], ['feature', 'Feature Requests']].map(([value, title]) => <Button key={value} role="tab" aria-selected={tab === value} variant={tab === value ? 'primary' : 'outline'} onClick={() => setTab(value)}>{title}</Button>)}</div></Card>
    <PlatformRequests key={`${id}-${tab}-${tick}`} organizationId={id} kind={tab} onChanged={refresh} />
    <Modal isOpen={!!modal} onClose={() => !saving && setModal(null)} title={modal === 'upgrade' ? 'Request Plan Upgrade' : 'Request Feature Change'} footer={<><Button variant="outline" disabled={saving} onClick={() => setModal(null)}>Cancel</Button><Button type="submit" form="platform-organization-request" loading={saving}>Submit Request</Button></>}>
      <form id="platform-organization-request" onSubmit={submit} className="space-y-4"><PlatformError error={formError} /><fieldset disabled={saving} className="space-y-4">
        {modal === 'upgrade' ? <><Input label="Current Plan" readOnly value={organization.plan?.name || 'No plan'} /><Select label="Requested Plan" required value={draft.requested_plan_id || ''} error={fields.requested_plan_id} onChange={event => setDraft(value => ({ ...value, requested_plan_id: event.target.value }))} options={availablePlans.map(plan => ({ value: plan.id, label: plan.name }))} /><Select label="Billing Cycle" value={draft.billing_cycle || 'monthly'} error={fields.billing_cycle} onChange={event => setDraft(value => ({ ...value, billing_cycle: event.target.value }))} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]} /></> : <><label className="flex flex-col gap-2 text-sm font-medium">Feature *<select className="w-full rounded-xl border border-surface-border bg-(--input-bg) p-3" required value={draft.entitlement_key || ''} onChange={event => { const key = event.target.value; const enabled = entitlements?.features?.[key]; setDraft(value => ({ ...value, entitlement_key: key, action: enabled === false ? 'unlock' : enabled === true ? 'restrict' : '' })) }}><option value="">Select feature</option>{[...groups].map(([category, options]) => <optgroup key={category} label={category}>{options.map(feature => <option key={featureKey(feature)} value={featureKey(feature)}>{featureName(feature)}</option>)}</optgroup>)}</select>{fields.entitlement_key && <span className="text-xs text-red-600">{fields.entitlement_key}</span>}</label><Input label="Current State" readOnly value={currentFeature === true ? 'Enabled' : currentFeature === false ? 'Restricted' : 'Select a feature'} /><Select label="Requested Action" required value={draft.action || ''} error={fields.action} onChange={event => setDraft(value => ({ ...value, action: event.target.value }))} options={[{ value: 'unlock', label: 'Unlock' }, { value: 'restrict', label: 'Restrict' }]} /></>}
        <label className="flex flex-col gap-2 text-sm font-medium">Reason *<textarea required maxLength={modal === 'upgrade' ? 500 : undefined} className="min-h-24 rounded-xl border border-surface-border bg-(--input-bg) p-3" value={draft.reason || ''} onChange={event => setDraft(value => ({ ...value, reason: event.target.value }))} />{fields.reason && <span className="text-xs text-red-600">{fields.reason}</span>}</label>
        {modal === 'upgrade' && <label className="flex flex-col gap-2 text-sm font-medium">Notes (optional)<textarea maxLength={2000} className="min-h-20 rounded-xl border border-surface-border bg-(--input-bg) p-3" value={draft.notes || ''} onChange={event => setDraft(value => ({ ...value, notes: event.target.value }))} />{fields.notes && <span className="text-xs text-red-600">{fields.notes}</span>}</label>}
      </fieldset></form>
    </Modal>
  </div>
}
