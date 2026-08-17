import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Lightbulb,
  NotebookText,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { ROLES } from '../../auth/roles'
import { LEAD_SOURCE_OPTIONS, LEAD_STATUS_OPTIONS, createLead } from '../../api/leads'
import { listCustomers } from '../../api/customers'
import { listUsers } from '../../api/users'
import { normalizeApiUser } from '../users/userRoleUtils'
import { useAuthStore } from '../../store/authStore'

const emptyForm = {
  leadSource: '',
  customerId: '',
  mobileNumber: '',
  assignedSalespersonId: '',
  leadStatus: 'new',
}

const leadStatusVariant = {
  new: 'info',
  contacted: 'warning',
  qualified: 'purple',
  won: 'success',
  lost: 'danger',
}

export default function LeadFormPage() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const basePath = currentUser?.role === ROLES.SALES_OFFICER ? '/sales/leads' : '/admin/leads'

  const [formData, setFormData] = useState(() => ({
    ...emptyForm,
    assignedSalespersonId: currentUser?.role === ROLES.SALES_OFFICER ? currentUser.id : '',
  }))
  const [errors, setErrors] = useState({})
  const [customers, setCustomers] = useState([])
  const [salespeople, setSalespeople] = useState([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showLeadNote, setShowLeadNote] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadOptions() {
      const customersPromise = listCustomers()
      const usersPromise = currentUser?.role === ROLES.SALES_OFFICER ? Promise.resolve({ success: true, users: [] }) : listUsers()
      const [customersResult, usersResult] = await Promise.all([customersPromise, usersPromise])

      if (!isMounted) return

      if (customersResult.success) setCustomers(customersResult.customers)
      if (currentUser?.role === ROLES.SALES_OFFICER) {
        setSalespeople(
          currentUser?.id
            ? [
                {
                  id: currentUser.id,
                  name: currentUser.name || 'Current user',
                  role: currentUser.role,
                  isActive: true,
                },
              ]
            : [],
        )
      } else if (usersResult.success) {
        const normalizedUsers = usersResult.users.map(normalizeApiUser).filter((user) => user.isActive !== false)
        const nextSalespeople = normalizedUsers.filter(
          (user) => user.role === ROLES.SALES_OFFICER || user.role === ROLES.ADMIN,
        )

        const currentUserOption =
          currentUser?.id && !nextSalespeople.some((user) => user.id === currentUser.id)
            ? {
                id: currentUser.id,
                name: currentUser.name || 'Current user',
                role: currentUser.role,
                isActive: true,
              }
          : null

        setSalespeople(currentUserOption ? [currentUserOption, ...nextSalespeople] : nextSalespeople)
      }

      setIsLoadingOptions(false)
    }

    loadOptions()
    return () => {
      isMounted = false
    }
  }, [currentUser?.id, currentUser?.name, currentUser?.role])

  const customerOptions = useMemo(
    () => [
      { value: '', label: 'No existing customer (new prospect)' },
      ...customers.map((customer) => ({
        value: customer.id,
        label: `${customer.name}${customer.phone ? ` - ${customer.phone}` : ''}`,
      })),
    ],
    [customers],
  )

  const salespersonOptions = useMemo(
    () => salespeople.map((user) => ({ value: user.id, label: user.name })),
    [salespeople],
  )

  const selectedSalesperson = useMemo(
    () => salespersonOptions.find((option) => option.value === formData.assignedSalespersonId),
    [formData.assignedSalespersonId, salespersonOptions],
  )

  const selectedCustomer = useMemo(
    () => customerOptions.find((option) => option.value === formData.customerId),
    [customerOptions, formData.customerId],
  )

  const selectedLeadStatus = useMemo(
    () => LEAD_STATUS_OPTIONS.find((option) => option.value === formData.leadStatus),
    [formData.leadStatus],
  )

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const validate = () => {
    const nextErrors = {}
    if (!formData.leadSource) nextErrors.leadSource = 'Lead source is required.'
    if (!formData.mobileNumber.trim()) nextErrors.mobileNumber = 'Mobile number is required.'
    if (formData.mobileNumber.trim() && !/^[0-9+\-\s()]{7,16}$/.test(formData.mobileNumber.trim())) {
      nextErrors.mobileNumber = 'Enter a valid mobile number.'
    }
    if (!formData.assignedSalespersonId) nextErrors.assignedSalespersonId = 'Assigned salesperson is required.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    setSubmitError('')

    const result = await createLead(formData)

    if (!result.success) {
      setSubmitError(result.error)
      setIsSubmitting(false)
      return
    }

    navigate(basePath)
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
        <Link to={basePath} className="transition-colors hover:text-neutral-900">
          Home
        </Link>
        <ChevronRight className="size-4 text-neutral-300" aria-hidden="true" />
        <Link to={basePath} className="transition-colors hover:text-neutral-900">
          Leads
        </Link>
        <ChevronRight className="size-4 text-neutral-300" aria-hidden="true" />
        <span className="font-medium text-primary-700">Add Lead</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 text-balance">Add Lead</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500 text-pretty">
            Capture a new prospect and assign it to a salesperson.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-11 rounded-xl px-4" onClick={() => navigate(basePath)}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Leads
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-[1.75rem] border border-neutral-100 bg-white shadow-[0_24px_80px_-48px_rgb(15_23_42/0.35)]"
        >
          <div className="border-b border-neutral-100 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                <UserPlus className="size-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-lg font-semibold text-neutral-900">Lead Information</p>
                <p className="mt-1 text-sm text-neutral-500">Fill in the details below to create a new lead.</p>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-6 py-5">
            {submitError && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            {showLeadNote && (
              <div className="flex items-start gap-3 rounded-2xl border border-primary-100 bg-primary-50/70 px-4 py-3 text-sm text-primary-950">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary-700" aria-hidden="true" />
                <p className="flex-1 leading-6">
                  Leads are important. Add accurate information to help your team follow up effectively.
                </p>
                <button
                  type="button"
                  onClick={() => setShowLeadNote(false)}
                  className="mt-0.5 rounded-md p-1 text-primary-500 transition-colors hover:bg-primary-100 hover:text-primary-700"
                  aria-label="Dismiss lead note"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Lead Source"
                required
                options={LEAD_SOURCE_OPTIONS}
                value={formData.leadSource}
                onChange={(event) => updateField('leadSource', event.target.value)}
                placeholder="Select lead source"
                error={errors.leadSource}
              />
              <Select
                label="Existing Customer"
                options={customerOptions}
                value={formData.customerId}
                onChange={(event) => updateField('customerId', event.target.value)}
                placeholder={isLoadingOptions ? 'Loading customers...' : 'No existing customer (new prospect)'}
                disabled={isLoadingOptions}
              />
              <Input
                label="Mobile Number"
                required
                value={formData.mobileNumber}
                onChange={(event) => updateField('mobileNumber', event.target.value)}
                placeholder="Contact mobile number"
                error={errors.mobileNumber}
              />
              <Select
                label="Assigned Salesperson"
                required
                options={salespersonOptions}
                value={formData.assignedSalespersonId}
                onChange={(event) => updateField('assignedSalespersonId', event.target.value)}
                placeholder={isLoadingOptions ? 'Loading...' : 'Select salesperson'}
                error={errors.assignedSalespersonId}
                disabled={isLoadingOptions}
              />
              <Select
                label="Lead Status"
                required
                options={LEAD_STATUS_OPTIONS}
                value={formData.leadStatus}
                onChange={(event) => updateField('leadStatus', event.target.value)}
              />
            </div>
          </div>

          <div className="border-t border-neutral-100 px-6 py-5">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => navigate(basePath)}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Add Lead
              </Button>
            </div>
          </div>
        </form>

        <aside className="grid gap-4">
          <section className="rounded-[1.5rem] border border-neutral-100 bg-white p-5 shadow-[0_18px_50px_-38px_rgb(15_23_42/0.35)]">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                <Lightbulb className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-base font-semibold text-neutral-900">Lead Tips</p>
                <p className="mt-1 text-sm text-neutral-500">Provide as much detail as possible to help your team engage the right way.</p>
              </div>
            </div>
            <ul className="mt-5 space-y-3 text-sm text-neutral-600">
              {[
                'Choose the right lead source',
                'Assign to the right salesperson',
                'Keep contact details up to date',
                'Update lead status regularly',
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden="true" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-[1.5rem] border border-neutral-100 bg-white p-5 shadow-[0_18px_50px_-38px_rgb(15_23_42/0.35)]">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                <Users className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-base font-semibold text-neutral-900">Assignment Preview</p>
                <p className="mt-1 text-sm text-neutral-500">See who will receive this lead.</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <p className="text-sm text-neutral-500">Salesperson</p>
                <p className="mt-1 font-medium text-neutral-900">{selectedSalesperson?.label || '—'}</p>
              </div>
              <div className="border-t border-dashed border-neutral-200 pt-4">
                <p className="text-sm text-neutral-500">Lead Status</p>
                <div className="mt-2">
                  <Badge variant={leadStatusVariant[formData.leadStatus] || 'info'}>
                    {selectedLeadStatus?.label || 'New'}
                  </Badge>
                </div>
              </div>
              <div className="border-t border-dashed border-neutral-200 pt-4">
                <p className="text-sm text-neutral-500">Existing Customer</p>
                <p className="mt-1 font-medium text-neutral-900">{selectedCustomer?.label || 'No existing customer'}</p>
              </div>
              <div className="border-t border-dashed border-neutral-200 pt-4">
                <p className="text-sm text-neutral-500">Created By</p>
                <p className="mt-1 font-medium text-neutral-900">{currentUser?.name || '—'}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-neutral-100 bg-white p-5 shadow-[0_18px_50px_-38px_rgb(15_23_42/0.35)]">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                <NotebookText className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-base font-semibold text-neutral-900">Notes</p>
                <p className="mt-1 text-sm text-neutral-500">Notes will appear here after the lead is created.</p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
