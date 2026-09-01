import { useEffect, useMemo, useState } from 'react'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { ROLES } from '../../auth/roles'
import { convertLeadToCustomer, getLead } from '../../api/leads'
import { listUsers } from '../../api/users'
import { normalizeApiUser } from '../users/userRoleUtils'
import { useAuthStore } from '../../store/authStore'
import { ConvertLeadForm } from './LeadForms'
import { isDemoRecord } from './demoData'

// The ONE Convert-to-Customer implementation. Reused by Lead Detail, the Leads list,
// the Follow-ups page and the Visits page - nobody duplicates the form, the customer
// mapping, the validation or the `convertLeadToCustomer` call.
//
// Pass either a full `lead` object (Lead Detail / Leads list already have one) or a
// `leadId` (Follow-ups / Visits only know the id) - the modal fetches it on open.
// `salespersonOptions` is optional; when omitted the modal loads them itself.
// `onConverted({ leadId, customerId, customer })` fires after a successful convert.
export default function ConvertLeadModal({
  isOpen,
  onClose,
  lead: leadProp = null,
  leadId = '',
  salespersonOptions: salespersonOptionsProp,
  onConverted,
}) {
  const currentUser = useAuthStore((state) => state.currentUser)
  const isSalesOfficer = currentUser?.role === ROLES.SALES_OFFICER
  const isDemo = isDemoRecord(leadId || leadProp?.id)

  const [lead, setLead] = useState(leadProp)
  const [isLoadingLead, setIsLoadingLead] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [salespeople, setSalespeople] = useState([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!isOpen) return undefined
    setFormError('')

    if (leadProp) {
      setLead(leadProp)
      return undefined
    }
    if (!leadId || isDemo) return undefined

    let alive = true
    setIsLoadingLead(true)
    setLoadError('')
    getLead(leadId).then((result) => {
      if (!alive) return
      setIsLoadingLead(false)
      if (result.success) setLead(result.lead)
      else setLoadError(result.error)
    })
    return () => {
      alive = false
    }
  }, [isOpen, leadId, leadProp])

  useEffect(() => {
    if (!isOpen || salespersonOptionsProp) return undefined

    if (isSalesOfficer) {
      setSalespeople(
        currentUser?.id
          ? [{ id: currentUser.id, name: currentUser.name || 'Current user', role: currentUser.role, isActive: true }]
          : [],
      )
      return undefined
    }

    let alive = true
    listUsers().then((result) => {
      if (!alive || !result.success) return
      setSalespeople(
        result.users
          .map(normalizeApiUser)
          .filter((user) => user.role === ROLES.SALES_OFFICER || user.role === ROLES.ADMIN),
      )
    })
    return () => {
      alive = false
    }
  }, [isOpen, salespersonOptionsProp, isSalesOfficer, currentUser?.id, currentUser?.name, currentUser?.role])

  const salespersonOptions = useMemo(
    () => salespersonOptionsProp || salespeople.map((user) => ({ value: user.id, label: user.name })),
    [salespersonOptionsProp, salespeople],
  )

  const handleSave = async (formData) => {
    if (!lead) return
    setSaving(true)
    setFormError('')

    const result = await convertLeadToCustomer(lead.id, formData)

    if (!result.success) {
      setFormError(result.error)
      setSaving(false)
      return
    }

    setSaving(false)
    onClose()
    onConverted?.({ leadId: lead.id, customerId: result.customerId, customer: result.customer })
  }

  return (
    <Modal isOpen={isOpen} onClose={() => { if (!saving) onClose() }} title="Convert to Customer" className="max-w-2xl">
      {isDemo ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This is a <strong>demo lead</strong> (UI testing data). Conversion is simulated here — no
            backend record is created. On a real lead this opens the same form with the lead's details prefilled.
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              type="button"
              onClick={() => {
                onClose()
                onConverted?.({ leadId: leadId || leadProp?.id, customerId: `demo-customer-${(leadId || '').replace('demo-lead-', '')}`, customer: null })
              }}
            >
              Simulate Conversion
            </Button>
          </div>
        </div>
      ) : isLoadingLead ? (
        <LoadingSpinner label="Loading lead..." />
      ) : loadError ? (
        <p className="py-6 text-center text-sm text-red-600">{loadError}</p>
      ) : lead ? (
        <ConvertLeadForm
          lead={lead}
          salespersonOptions={salespersonOptions}
          saving={saving}
          formError={formError}
          onClose={onClose}
          onSave={handleSave}
        />
      ) : null}
    </Modal>
  )
}
