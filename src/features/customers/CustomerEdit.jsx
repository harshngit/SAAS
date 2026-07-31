import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { getCustomer, updateCustomer } from '../../api/customers'
import { ROLES } from '../../auth/roles'
import { users } from '../../mockData/users'
import { useAuthStore } from '../../store/authStore'
import CustomerForm from './CustomerForm'
import { UsersRound } from 'lucide-react'

const normalizeCustomer = (customer) => ({
  ...customer,
  organizationId: customer.organization_id || customer.organizationId,
  businessName: customer.business_name || customer.businessName || customer.name,
  type: customer.category || customer.type || '',
  billingAddress: customer.billing_address || customer.billingAddress || customer.address || '',
  deliveryAddress: customer.delivery_address || customer.deliveryAddress || customer.address || '',
  assignedSalesOfficerId: customer.assigned_sales_officer_id || customer.assignedSalesOfficerId || '',
  assignedSalesOfficer: customer.assigned_sales_officer || customer.assignedSalesOfficer,
  outstandingBalance: customer.outstanding_balance || customer.outstandingBalance || 0,
  creditLimit: customer.credit_limit ?? customer.creditLimit ?? 0,
  gstNumber: customer.gst_number || customer.gstNumber || '',
  joinedAt: customer.created_at || customer.joinedAt,
  updatedAt: customer.updated_at || customer.updatedAt,
  notes: customer.notes || '',
  isActive: customer.is_active ?? customer.isActive,
  status: customer.is_active === false || customer.status === 'inactive' ? 'inactive' : 'active',
})

export default function CustomerEdit() {
  const { customer_id: customerId } = useParams()
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const [customer, setCustomer] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')

  const salesOfficers = useMemo(
    () => users.filter((user) => user.role === ROLES.SALES_OFFICER && user.status === 'active'),
    [],
  )

  useEffect(() => {
    let isMounted = true

    async function loadCustomer() {
      setIsLoading(true)
      setLoadError('')

      const result = await getCustomer(customerId)

      if (!isMounted) return

      setIsLoading(false)

      if (!result.success) {
        setCustomer(null)
        setLoadError(result.error)
        return
      }

      setCustomer(normalizeCustomer(result.customer))
    }

    loadCustomer()

    return () => {
      isMounted = false
    }
  }, [customerId])

  const handleSaveCustomer = async (customerData) => {
    setIsSaving(true)
    setFormError('')

    const result = await updateCustomer(customerId, {
      ...customer,
      ...customerData,
    })

    if (!result.success) {
      setFormError(result.error)
      setIsSaving(false)
      return
    }

    setIsSaving(false)
    navigate('/admin/customers')
  }

  if (isLoading) {
    return <LoadingSpinner label="Loading customer edit form..." />
  }

  if (!customer) {
    return (
      <Card>
        <EmptyState
          icon={UsersRound}
          title="Customer not found"
          description={loadError || 'This customer may have been deleted or the link is out of date.'}
          action={{ label: 'Back to Customers', onClick: () => navigate('/admin/customers') }}
        />
      </Card>
    )
  }

  return (
    <CustomerForm
      isOpen
      onClose={() => navigate('/admin/customers')}
      customer={customer}
      onSave={handleSaveCustomer}
      salesOfficers={salesOfficers}
      currentUser={currentUser}
      saving={isSaving}
      formError={formError}
    />
  )
}
