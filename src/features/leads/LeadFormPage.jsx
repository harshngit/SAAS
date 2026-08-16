import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

  useEffect(() => {
    let isMounted = true

    async function loadOptions() {
      const [customersResult, usersResult] = await Promise.all([
        listCustomers(),
        listUsers({ role_id: undefined }),
      ])

      if (!isMounted) return

      if (customersResult.success) setCustomers(customersResult.customers)
      if (usersResult.success) {
        setSalespeople(
          usersResult.users
            .map(normalizeApiUser)
            .filter((user) => user.role === ROLES.SALES_OFFICER || user.role === ROLES.ADMIN),
        )
      }

      setIsLoadingOptions(false)
    }

    loadOptions()
    return () => {
      isMounted = false
    }
  }, [])

  const customerOptions = useMemo(
    () => [
      { value: '', label: 'No existing customer (new prospect)' },
      ...customers.map((customer) => ({
        value: customer.id,
        label: `${customer.name}${customer.phone ? ` • ${customer.phone}` : ''}`,
      })),
    ],
    [customers],
  )

  const salespersonOptions = useMemo(
    () => salespeople.map((user) => ({ value: user.id, label: user.name })),
    [salespeople],
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
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl overflow-hidden rounded-[1.75rem] border border-neutral-100 bg-white p-6 shadow-(--shadow-card)"
    >
      <div className="flex flex-col gap-4 border-b border-neutral-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-semibold text-neutral-900">Add Lead</p>
          <p className="mt-1 text-sm text-neutral-500">Capture a new prospect and assign it to a salesperson.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => navigate(basePath)}>
          Back to Leads
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 py-5 sm:grid-cols-2">
        {submitError && (
          <div className="sm:col-span-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

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
          placeholder={isLoadingOptions ? 'Loading customers...' : 'Link to an existing customer (optional)'}
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

      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => navigate(basePath)}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          Add Lead
        </Button>
      </div>
    </form>
  )
}
