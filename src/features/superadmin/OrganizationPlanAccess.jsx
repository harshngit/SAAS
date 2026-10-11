import { useEffect, useState } from 'react'
import { Plus, RotateCcw } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import {
  deleteFeatureOverride,
  deleteLimitOverride,
  getOrganizationEntitlementsAdmin,
  resetAllOverrides,
  upsertFeatureOverride,
  upsertLimitOverride,
} from '../../api/entitlements'
import { listPlans } from '../../api/superadmin'
import { ENTITLEMENT_GROUPS, LIMIT_KEYS, entitlementLabel, formatLimitValue, limitLabel } from '../../entitlements/entitlementKeys'

// Only these 3 are real, editable Plan limits surfaced anywhere in this UI today (PlanForm.jsx's
// own Limits section) - max_storage_gb is deliberately excluded, storage usage/limits are out of
// scope for this pass.
const DISPLAYED_LIMIT_KEYS = [LIMIT_KEYS.MAX_USERS, LIMIT_KEYS.MAX_WAREHOUSES, LIMIT_KEYS.MAX_ORDERS]

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const FEATURE_KEY_OPTIONS = ENTITLEMENT_GROUPS.flatMap((group) =>
  group.keys.map((key) => ({ value: key, label: `${group.label} - ${entitlementLabel(key)}` })),
)
const LIMIT_KEY_OPTIONS = Object.values(LIMIT_KEYS).map((key) => ({ value: key, label: limitLabel(key) }))

// Super Admin's view onto this one organization's effective Plan Entitlements + any overrides on
// top of the plan default (§17/§18/§20 of the Plan Entitlements brief). Reads the real
// GET /superadmin/organizations/{org_id}/entitlements contract - never recomputes plan default +
// override + expiry itself, the backend already did that (OrganizationAdminEntitlementsOut's
// `features`/`limits` ARE the effective values).
export default function OrganizationPlanAccess({ orgId }) {
  const [data, setData] = useState(null)
  // GET /superadmin/organizations/{org_id}/entitlements embeds `plan` as a loosely-typed object
  // (OrganizationAdminEntitlementsOut.plan has no declared sub-schema in the backend's own
  // OpenAPI spec) - its max_users/max_warehouses/max_orders can't be trusted to always be
  // present. The real Super Admin Plans list (GET /superadmin/plans, already used by
  // PlanForm.jsx/SubscriptionPlans.jsx) is the one place these fields are formally typed and
  // guaranteed, so it's fetched here too and used to backfill whatever `data.plan` is missing -
  // this is what fixed "Plan Default: Unlimited" actually showing the real configured value.
  const [plansById, setPlansById] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')

  const [editTarget, setEditTarget] = useState(null) // { kind: 'feature' | 'limit', existing?, presetKey? }
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [resetTarget, setResetTarget] = useState(null) // { kind, key }
  const [isResetting, setIsResetting] = useState(false)

  const [isResetAllOpen, setIsResetAllOpen] = useState(false)
  const [isResettingAll, setIsResettingAll] = useState(false)

  const load = async () => {
    setIsLoading(true)
    setLoadError('')
    const [entitlementsResult, plansResult] = await Promise.all([getOrganizationEntitlementsAdmin(orgId), listPlans()])
    setIsLoading(false)
    if (!entitlementsResult.success) {
      setLoadError(entitlementsResult.error)
      return
    }
    setData(entitlementsResult.entitlements)
    if (plansResult.success) {
      setPlansById(Object.fromEntries(plansResult.plans.map((planRecord) => [planRecord.id, planRecord])))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  const handleResetOne = async () => {
    if (!resetTarget) return
    setIsResetting(true)
    setActionError('')
    const result = resetTarget.kind === 'feature'
      ? await deleteFeatureOverride(orgId, resetTarget.key)
      : await deleteLimitOverride(orgId, resetTarget.key)
    setIsResetting(false)
    if (!result.success) {
      setActionError(result.error)
      return
    }
    setResetTarget(null)
    await load()
  }

  const handleResetAll = async () => {
    setIsResettingAll(true)
    setActionError('')
    const result = await resetAllOverrides(orgId)
    setIsResettingAll(false)
    if (!result.success) {
      setActionError(result.error)
      return
    }
    setIsResetAllOpen(false)
    await load()
  }

  if (isLoading) return <Card><LoadingSpinner label="Loading plan & access…" /></Card>

  if (!data) {
    return (
      <Card>
        <EmptyState title="Unable to load plan & access" description={loadError || 'Please try again.'} action={{ label: 'Retry', onClick: load }} />
      </Card>
    )
  }

  const plan = data.plan
  const fullPlan = plan?.id ? plansById[plan.id] : undefined
  const planEntitlements = plan?.entitlements || fullPlan?.entitlements || {}
  const featureOverrides = data.feature_overrides || []
  const limitOverrides = data.limit_overrides || []

  // The embedded `plan` value wins when it genuinely has the field; only falls through to the
  // full Plan record when that field is actually absent (undefined) - never when it's a real 0
  // or a real null (confirmed-unlimited).
  const resolvePlanDefault = (limitKey) => {
    const embedded = plan?.[limitKey]
    if (embedded !== undefined) return embedded
    return fullPlan?.[limitKey]
  }

  return (
    <div className="space-y-4">
      <Card title="Plan & Access" subtitle="Effective entitlements for this organization - plan defaults plus any active overrides.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-neutral-400">Current Plan</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{plan?.name || 'No plan'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-400">Subscription Status</p>
            <p className="mt-1 text-sm font-semibold capitalize text-neutral-900">{data.subscription_status || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-400">Trial</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">
              {data.trial_ends_at ? `Ends ${formatDate(data.trial_ends_at)}${data.trial_days_left != null ? ` (${data.trial_days_left}d left)` : ''}` : 'Not on trial'}
            </p>
          </div>
        </div>
      </Card>

      {actionError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}

      <Card
        title="Custom Feature Overrides"
        subtitle="ALLOW or BLOCK a feature for this organization only, regardless of its plan default."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setSaveError(''); setEditTarget({ kind: 'feature' }) }}>
              <Plus className="size-4" aria-hidden="true" />
              Add Override
            </Button>
            {(featureOverrides.length > 0 || limitOverrides.length > 0) && (
              <Button size="sm" variant="outline" onClick={() => setIsResetAllOpen(true)}>
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset All
              </Button>
            )}
          </div>
        }
      >
        {featureOverrides.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-400">No feature overrides configured - every feature follows its plan default.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-100">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="px-4 py-2.5">Feature</th>
                  <th className="px-4 py-2.5">Plan Default</th>
                  <th className="px-4 py-2.5">Override</th>
                  <th className="px-4 py-2.5">Effective</th>
                  <th className="px-4 py-2.5">Expiry</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {featureOverrides.map((override) => {
                  const planDefault = Boolean(planEntitlements[override.entitlement_key])
                  const effective = Boolean(data.features?.[override.entitlement_key])
                  return (
                    <tr key={override.id}>
                      <td className="px-4 py-2.5 font-medium text-neutral-900">{entitlementLabel(override.entitlement_key)}</td>
                      <td className="px-4 py-2.5"><Badge variant={planDefault ? 'success' : 'neutral'}>{planDefault ? 'On' : 'Off'}</Badge></td>
                      <td className="px-4 py-2.5">
                        {override.is_active ? (
                          <Badge variant={override.effect === 'ALLOW' ? 'success' : 'danger'}>{override.effect === 'ALLOW' ? 'Allow' : 'Block'}</Badge>
                        ) : (
                          <Badge variant="neutral">Expired</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5"><Badge variant={effective ? 'success' : 'neutral'}>{effective ? 'On' : 'Off'}</Badge></td>
                      <td className="px-4 py-2.5 text-neutral-600">{override.expires_at ? formatDate(override.expires_at) : '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => { setSaveError(''); setEditTarget({ kind: 'feature', existing: override }) }} className="text-xs font-medium text-primary-600 hover:underline">Edit</button>
                          <button type="button" onClick={() => setResetTarget({ kind: 'feature', key: override.entitlement_key, label: entitlementLabel(override.entitlement_key) })} className="text-xs font-medium text-neutral-500 hover:text-red-600 hover:underline">Reset</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Limit Overrides"
        subtitle="A custom numeric limit for this organization only - overrides the plan default."
      >
        <div className="overflow-x-auto rounded-xl border border-neutral-100">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                <th className="px-4 py-2.5">Limit</th>
                <th className="px-4 py-2.5">Plan Default</th>
                <th className="px-4 py-2.5">Override</th>
                <th className="px-4 py-2.5">Effective</th>
                <th className="px-4 py-2.5">Expiry</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {/* Every known limit always gets a row, active override or not - a reset override
                  must keep showing its (now-default) effective value rather than the row simply
                  vanishing, which would read as a stale/missing state. */}
              {DISPLAYED_LIMIT_KEYS.map((limitKey) => {
                const override = limitOverrides.find((item) => item.limit_key === limitKey && item.is_active)
                const planDefaultValue = resolvePlanDefault(limitKey)
                const effectiveValue = data.limits?.[limitKey]
                return (
                  <tr key={limitKey}>
                    <td className="px-4 py-2.5 font-medium text-neutral-900">{limitLabel(limitKey)}</td>
                    <td className="px-4 py-2.5 text-neutral-600">{formatLimitValue(planDefaultValue)}</td>
                    <td className="px-4 py-2.5">
                      {override ? <Badge variant="primary">{formatLimitValue(override.value)}</Badge> : <Badge variant="neutral">Default</Badge>}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-neutral-900">{formatLimitValue(effectiveValue)}</td>
                    <td className="px-4 py-2.5 text-neutral-600">{override?.expires_at ? formatDate(override.expires_at) : '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => { setSaveError(''); setEditTarget({ kind: 'limit', existing: override || null, presetKey: limitKey }) }}
                          className="text-xs font-medium text-primary-600 hover:underline"
                        >
                          {override ? 'Edit' : 'Set Override'}
                        </button>
                        {override && (
                          <button
                            type="button"
                            onClick={() => setResetTarget({ kind: 'limit', key: limitKey, label: limitLabel(limitKey) })}
                            className="text-xs font-medium text-neutral-500 hover:text-red-600 hover:underline"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <OverrideEditorModal
        target={editTarget}
        orgId={orgId}
        isSaving={isSaving}
        saveError={saveError}
        onClose={() => setEditTarget(null)}
        onSaved={async () => {
          setEditTarget(null)
          await load()
        }}
        setIsSaving={setIsSaving}
        setSaveError={setSaveError}
      />

      <Modal isOpen={Boolean(resetTarget)} onClose={() => !isResetting && setResetTarget(null)} title="Reset Override">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-neutral-600">
            Reset <span className="font-semibold text-neutral-900">{resetTarget?.label}</span> back to its plan default? This removes the override - it does not change the plan itself.
          </p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setResetTarget(null)} disabled={isResetting}>Cancel</Button>
            <Button type="button" variant="danger" loading={isResetting} onClick={handleResetOne}>Reset</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isResetAllOpen} onClose={() => !isResettingAll && setIsResetAllOpen(false)} title="Reset All Overrides">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-neutral-600">
            Reset every feature and limit override for this organization back to its plan defaults? This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsResetAllOpen(false)} disabled={isResettingAll}>Cancel</Button>
            <Button type="button" variant="danger" loading={isResettingAll} onClick={handleResetAll}>Reset All</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function OverrideEditorModal({ target, orgId, isSaving, saveError, onClose, onSaved, setIsSaving, setSaveError }) {
  const isFeature = target?.kind === 'feature'
  const existing = target?.existing

  const [key, setKey] = useState('')
  const [effect, setEffect] = useState('ALLOW')
  const [limitValue, setLimitValue] = useState('')
  const [isUnlimited, setIsUnlimited] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!target) return
    setKey(target.presetKey || (isFeature ? existing?.entitlement_key || '' : existing?.limit_key || ''))
    setEffect(existing?.effect || 'ALLOW')
    setLimitValue(existing?.value ?? '')
    setIsUnlimited(Boolean(existing) && existing.value === null)
    setExpiresAt(existing?.expires_at ? existing.expires_at.slice(0, 10) : '')
    setReason(existing?.reason || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  if (!target) return null

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!key) {
      setSaveError('Select a feature or limit to override.')
      return
    }

    setIsSaving(true)
    setSaveError('')

    const expiresIso = expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null

    const result = isFeature
      ? await upsertFeatureOverride(orgId, { entitlementKey: key, effect, expiresAt: expiresIso, reason })
      : await upsertLimitOverride(orgId, { limitKey: key, value: isUnlimited ? null : toNullableValue(limitValue), expiresAt: expiresIso, reason })

    setIsSaving(false)

    if (!result.success) {
      setSaveError(result.error)
      return
    }

    onSaved()
  }

  return (
    <Modal isOpen={Boolean(target)} onClose={() => !isSaving && onClose()} title={existing ? 'Edit Override' : `${target?.presetKey ? 'Set' : 'Add'} ${isFeature ? 'Feature' : 'Limit'} Override`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label={isFeature ? 'Feature' : 'Limit'}
          options={[{ value: '', label: 'Select...' }, ...(isFeature ? FEATURE_KEY_OPTIONS : LIMIT_KEY_OPTIONS)]}
          value={key}
          onChange={(event) => setKey(event.target.value)}
          disabled={Boolean(existing) || Boolean(target?.presetKey)}
          searchable
        />

        {isFeature ? (
          <Select
            label="Override"
            options={[{ value: 'ALLOW', label: 'Allow' }, { value: 'BLOCK', label: 'Block' }]}
            value={effect}
            onChange={(event) => setEffect(event.target.value)}
          />
        ) : (
          <div className="space-y-2">
            <Input
              label="Custom Value"
              type="number"
              min="0"
              value={limitValue}
              onChange={(event) => setLimitValue(event.target.value)}
              disabled={isUnlimited}
            />
            <label className="flex items-center gap-2 text-sm text-neutral-600">
              <input type="checkbox" checked={isUnlimited} onChange={(event) => setIsUnlimited(event.target.checked)} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/20" />
              Unlimited
            </label>
          </div>
        )}

        <Input label="Expires At (optional)" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        <Input label="Reason (optional)" as="textarea" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Internal note, e.g. trial extension" />

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" loading={isSaving}>{existing ? 'Save Changes' : 'Add Override'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function toNullableValue(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}
