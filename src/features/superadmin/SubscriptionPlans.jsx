import { useCallback, useEffect, useState } from 'react'
import { Check, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import { listPlans, createPlan, updatePlan, updatePlanStatus, deletePlan } from '../../api/superadmin'
import { formatCurrency } from '../../utils/format'
import PlanForm from './PlanForm'

export default function SubscriptionPlans() {
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [plans, setPlans] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const [updatingStatusId, setUpdatingStatusId] = useState(null)
  const [actionError, setActionError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadPlans = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const result = await listPlans()

    setIsLoading(false)

    if (!result.success) {
      setListError(result.error)
      return
    }

    setPlans(result.plans)
  }, [])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  const openCreateForm = () => {
    setEditingPlan(null)
    setFormError('')
    setIsFormOpen(true)
  }

  const openEditForm = (plan) => {
    setEditingPlan(plan)
    setFormError('')
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setFormError('')
  }

  const handleSave = async (payload) => {
    setIsSubmitting(true)
    setFormError('')

    const result = editingPlan ? await updatePlan(editingPlan.id, payload) : await createPlan(payload)

    setIsSubmitting(false)

    if (!result.success) {
      setFormError(result.error)
      return
    }

    setIsFormOpen(false)
    await loadPlans()
  }

  const handleStatusChange = async (plan, isActive) => {
    setActionError('')
    setUpdatingStatusId(plan.id)

    const result = await updatePlanStatus(plan.id, isActive)

    setUpdatingStatusId(null)

    if (!result.success) {
      setActionError(result.error)
      return
    }

    await loadPlans()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setDeleteError('')

    const result = await deletePlan(deleteTarget.id)

    if (!result.success) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }

    setIsDeleting(false)
    setDeleteTarget(null)
    await loadPlans()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Subscription Plans</h1>
          <p className="mt-1 text-sm text-neutral-500">Manage subscription plans available to organizations</p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="size-4" aria-hidden="true" />
          Create Plan
        </Button>
      </div>

      {actionError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <Tabs value={billingCycle} onValueChange={setBillingCycle} className="flex justify-center sm:justify-start">
        <TabsList>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="yearly">Yearly</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <Card>
          <LoadingSpinner label="Loading plans…" />
        </Card>
      ) : plans.length === 0 ? (
        <Card>
          <EmptyState
            title={listError ? 'Unable to load plans' : 'No plans yet'}
            description={listError || 'Create your first subscription plan to get started.'}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const isActive = plan.is_active !== false
            const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly
            const originalPrice = billingCycle === 'monthly' ? plan.original_price_monthly : plan.original_price_yearly
            const cycleLabel = billingCycle === 'monthly' ? 'month' : 'year'

            return (
              <Card
                key={plan.id}
                className={`h-full ${!isActive ? 'opacity-60' : ''}`}
                bodyClassName="flex h-full flex-col space-y-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-neutral-900">{plan.name}</h3>
                      <Badge variant={isActive ? 'success' : 'neutral'} dot>{isActive ? 'Active' : 'Inactive'}</Badge>
                      {plan.is_default && <Badge variant="primary">Default</Badge>}
                    </div>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">
                      {formatCurrency(price)}
                      {originalPrice != null && (
                        <span className="ml-2 align-middle text-base font-medium text-neutral-400 line-through">
                          {formatCurrency(originalPrice)}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500">
                      per {cycleLabel} · {plan.max_users ? `${plan.max_users} users` : 'Unlimited users'} ·{' '}
                      {plan.max_orders ? `${plan.max_orders} orders` : 'Unlimited orders'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-pressed={isActive}
                      aria-label={`${isActive ? 'Deactivate' : 'Activate'} ${plan.name}`}
                      onClick={() => handleStatusChange(plan, !isActive)}
                      disabled={updatingStatusId === plan.id}
                      className={`inline-flex size-8 items-center justify-center rounded-full border transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:opacity-60 ${
                        isActive
                          ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                          : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                      }`}
                    >
                      <Power className="size-4" strokeWidth={2.5} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditForm(plan)}
                      aria-label={`Edit ${plan.name}`}
                      className="rounded-lg p-2 text-neutral-500 hover:bg-primary-50 hover:text-primary-600"
                    >
                      <Pencil className="size-4" />
                    </button>
                    {!plan.is_default && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError('')
                          setDeleteTarget(plan)
                        }}
                        aria-label={`Delete ${plan.name}`}
                        className="rounded-lg p-2 text-neutral-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </div>

                <ul className="flex-1 space-y-2">
                  {(plan.features || []).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-neutral-600">
                      <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )
          })}
        </div>
      )}

      <PlanForm
        key={isFormOpen ? editingPlan?.id || 'create' : 'closed'}
        isOpen={isFormOpen}
        onClose={closeForm}
        plan={editingPlan}
        onSave={handleSave}
        isSubmitting={isSubmitting}
        submitError={formError}
      />

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return
          setDeleteError('')
          setDeleteTarget(null)
        }}
        title="Delete Plan"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Permanently delete {deleteTarget?.name || 'this plan'}? This cannot be undone. If any organization is
            currently subscribed to it, or it has upgrade requests referencing it, the deletion will be refused —
            deactivate the plan instead so existing subscribers keep functioning.
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
                setDeleteError('')
                setDeleteTarget(null)
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
