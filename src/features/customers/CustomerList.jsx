import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Edit,
  Plus,
  RotateCw,
  Search,
  Trash2,
  UserCheck,
} from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { ROLES } from '../../auth/roles'
import { RequirePermission } from '../../auth/RequirePermission'
import { createCustomer, deleteCustomer as deleteCustomerApi, getCustomer, listCustomers, updateCustomer } from '../../api/customers'
import { listUsers } from '../../api/users'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/format'
import CustomerForm from './CustomerForm'
import { customerTypeOptions } from './customerConstants'
import { getSystemRoleFromRoleName } from '../users/userRoleUtils'

const customerStatusTabs = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

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

const normalizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role || user.system_role || getSystemRoleFromRoleName(user.role_detail?.name),
  status: user.is_active === false || user.status === 'inactive' ? 'inactive' : 'active',
})

const getInitials = (name = '') =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

export default function CustomerList() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isAdmin = currentUser?.role === ROLES.ADMIN
  const isSalesOfficer = currentUser?.role === ROLES.SALES_OFFICER
  const basePath = isAdmin ? '/admin/customers' : '/sales/customers'

  const [customers, setCustomers] = useState([])
  const [staffUsers, setStaffUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [salesOfficerFilter, setSalesOfficerFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [isLoadingEditCustomer, setIsLoadingEditCustomer] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteCustomer, setDeleteCustomer] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const salesOfficers = useMemo(
    () => staffUsers.filter((user) => user.role === ROLES.SALES_OFFICER && user.status === 'active'),
    [staffUsers],
  )

  const salesOfficerById = useMemo(
    () => new Map([
      ...staffUsers.map((user) => [user.id, user.name]),
      ...customers
        .filter((customer) => customer.assignedSalesOfficer?.id)
        .map((customer) => [customer.assignedSalesOfficer.id, customer.assignedSalesOfficer.name]),
    ]),
    [customers, staffUsers],
  )

  const loadStaffUsers = useCallback(async () => {
    const userResult = await listUsers()

    if (userResult.success) {
      setStaffUsers(userResult.users.map(normalizeUser))
    }
  }, [])

  const loadCustomers = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const queryParams = {
      search: searchTerm.trim() || undefined,
      category: typeFilter === 'all' ? undefined : typeFilter,
      is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
      assigned_sales_officer_id: isSalesOfficer
        ? currentUser?.id
        : isAdmin && salesOfficerFilter !== 'all'
          ? salesOfficerFilter
          : undefined,
    }

    const [customerResult] = await Promise.all([
      listCustomers(queryParams),
      loadStaffUsers(),
    ])

    if (!customerResult.success) {
      setCustomers([])
      setListError(customerResult.error)
      setIsLoading(false)
      return
    }

    setCustomers(customerResult.customers.map(normalizeCustomer))
    setIsLoading(false)
  }, [currentUser?.id, isAdmin, isSalesOfficer, loadStaffUsers, salesOfficerFilter, searchTerm, statusFilter, typeFilter])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  const salesOfficerFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All sales officers' },
      ...salesOfficers.map((user) => ({ value: user.id, label: user.name })),
    ],
    [salesOfficers],
  )

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return customers.filter((customer) => {
      const matchesSearch =
        !normalizedSearch ||
        [customer.name, customer.phone]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      const matchesType = typeFilter === 'all' || customer.type === typeFilter
      const matchesSalesOfficer =
        !isAdmin || salesOfficerFilter === 'all' || customer.assignedSalesOfficerId === salesOfficerFilter
      const matchesStatus = statusFilter === 'all' || customer.status === statusFilter
      const matchesSalesScope = !isSalesOfficer || !currentUser?.id || customer.assignedSalesOfficerId === currentUser.id

      return matchesSearch && matchesType && matchesSalesOfficer && matchesStatus && matchesSalesScope
    })
  }, [currentUser?.id, customers, isAdmin, isSalesOfficer, salesOfficerFilter, searchTerm, statusFilter, typeFilter])

  const handleOpenForm = async (customer = null) => {
    setFormError('')

    if (!customer) {
      setEditingCustomer(null)
      setIsFormOpen(true)
      return
    }

    // The row only carries the flat list fields — fetch the full sectioned profile
    // so editing doesn't blank out tax/payment/CRM/social/additional data on save.
    if (isLoadingEditCustomer) return
    setIsLoadingEditCustomer(true)

    const result = await getCustomer(customer.id)

    setIsLoadingEditCustomer(false)

    if (!result.success) {
      setEditingCustomer(customer)
      setFormError(result.error)
      setIsFormOpen(true)
      return
    }

    setEditingCustomer(result.customer)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingCustomer(null)
    setFormError('')
  }

  const handleSaveCustomer = async (customerData) => {
    setIsSaving(true)
    setFormError('')

    const duplicatePhone = customers.some(
      (customer) =>
        customer.phone.replace(/\D/g, '') === customerData.phone.replace(/\D/g, '') &&
        customer.id !== editingCustomer?.id,
    )

    if (duplicatePhone) {
      setFormError('Phone number already exists for another customer.')
      setIsSaving(false)
      return
    }

    if (editingCustomer) {
      const updateResult = await updateCustomer(editingCustomer.id, {
        ...editingCustomer,
        ...customerData,
      })

      if (!updateResult.success) {
        setFormError(updateResult.error)
        setIsSaving(false)
        return
      }

      setCustomers((current) =>
        current.map((customer) =>
          customer.id === editingCustomer.id
            ? normalizeCustomer({
              ...customer,
              ...customerData,
              ...updateResult.customer,
            })
            : customer,
        ),
      )
      setIsSaving(false)
      handleCloseForm()
      return
    }

    const createResult = await createCustomer(customerData)

    if (!createResult.success) {
      setFormError(createResult.error)
      setIsSaving(false)
      return
    }

    setCustomers((current) => [
      normalizeCustomer({
        ...customerData,
        ...createResult.customer,
      }),
      ...current,
    ])

    setIsSaving(false)
    handleCloseForm()
  }

  const handleDeleteCustomer = async () => {
    if (!deleteCustomer) return

    setIsDeleting(true)
    setDeleteError('')

    const result = await deleteCustomerApi(deleteCustomer.id)

    if (!result.success) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }

    setCustomers((current) => current.filter((customer) => customer.id !== deleteCustomer.id))
    setIsDeleting(false)
    setDeleteCustomer(null)
  }

  if (isFormOpen) {
    return (
      <CustomerForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        customer={editingCustomer}
        onSave={handleSaveCustomer}
        salesOfficers={salesOfficers}
        currentUser={currentUser}
        saving={isSaving}
        formError={formError}
      />
    )
  }

  return (
    <div className="space-y-5">
      <Card className="p-0">
        <div className="border-b border-neutral-100 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-5">
              {customerStatusTabs.map((tab) => {
                const isActive = statusFilter === tab.value

                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setStatusFilter(tab.value)}
                    className={`relative py-2 text-sm font-medium transition-colors ${
                      isActive ? 'text-primary-700' : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    {tab.label}
                    {isActive && (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary-600" aria-hidden="true" />
                    )}
                  </button>
                )
              })}
            </div>
            <RequirePermission module="customers" action="create">
              <Button onClick={() => handleOpenForm()} size="sm" className="w-full sm:w-auto">
                <Plus className="size-4" aria-hidden="true" />
                Add Customer
              </Button>
            </RequirePermission>
          </div>
        </div>

        <div className="border-b border-neutral-100 px-5 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search customers"
                  className="w-full rounded-xl border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Select
                options={[{ value: 'all', label: 'All types' }, ...customerTypeOptions]}
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="sm:w-44"
              />
              {isAdmin && (
                <Select
                  options={salesOfficerFilterOptions}
                  value={salesOfficerFilter}
                  onChange={(event) => setSalesOfficerFilter(event.target.value)}
                  className="sm:w-56"
                />
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 px-5 py-4">
          {listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadCustomers}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <LoadingSpinner label="Loading customers..." />
          ) : customers.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-neutral-900">No customers yet</p>
              <p className="mt-1 text-sm text-neutral-500">
                Create the first customer profile to begin tracking billing, delivery, and sales ownership.
              </p>
              <RequirePermission module="customers" action="create">
                <Button type="button" className="mt-4" onClick={() => handleOpenForm()}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add Customer
                </Button>
              </RequirePermission>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No customers match these filters.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3">Customer</th>
                  <th className="whitespace-nowrap px-4 py-3">Phone</th>
                  <th className="whitespace-nowrap px-4 py-3">Sales Officer</th>
                  <th className="whitespace-nowrap px-4 py-3">Credit Limit</th>
                  <th className="whitespace-nowrap px-4 py-3">Outstanding</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => navigate(`${basePath}/${customer.id}`)}
                    className="cursor-pointer bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700 ring-1 ring-primary-100">
                          {getInitials(customer.name)}
                        </div>
                        <div>
                          <span className="font-medium text-neutral-900">{customer.name}</span>
                          <p className="mt-0.5 text-xs text-neutral-400">{customer.type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-600">{customer.phone}</td>
                    <td className="px-4 py-3.5 text-neutral-600">
                      {salesOfficerById.get(customer.assignedSalesOfficerId) || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-neutral-700">
                      {formatCurrency(customer.creditLimit)}
                    </td>
                    <td className="px-4 py-3.5">
                      {customer.outstandingBalance > 0 ? (
                        <Badge variant="warning">{formatCurrency(customer.outstandingBalance)}</Badge>
                      ) : (
                        <span className="font-medium text-neutral-700">{formatCurrency(0)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={customer.status === 'active' ? 'success' : 'neutral'}>
                        {customer.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                      <ActionMenu
                        items={[
                          { label: 'View Details', icon: UserCheck, onClick: () => navigate(`${basePath}/${customer.id}`) },
                          { label: 'Edit', icon: Edit, onClick: () => handleOpenForm(customer) },
                          // { label: 'Reassign Sales Officer', icon: UserCheck, onClick: () => handleOpenForm(customer) },
                          {
                            label: 'Delete',
                            icon: Trash2,
                            danger: true,
                            onClick: () => setDeleteCustomer(customer),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-xs text-neutral-400">
          <span>
            {filteredCustomers.length === 0 ? '0' : `1 to ${filteredCustomers.length}`} of {customers.length}
          </span>
          <span>Customers</span>
        </div>
      </Card>

      <Modal
        isOpen={Boolean(deleteCustomer)}
        onClose={() => {
          if (isDeleting) return
          setDeleteError('')
          setDeleteCustomer(null)
        }}
        title="Delete Customer"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete {deleteCustomer?.name || 'this customer'} from the customer list? Existing invoices and outstanding balances will remain unchanged.
          </p>
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {deleteError}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isDeleting}
              onClick={() => {
                setDeleteError('')
                setDeleteCustomer(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={isDeleting}
              onClick={handleDeleteCustomer}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
