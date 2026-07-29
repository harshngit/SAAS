import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Edit,
  Plus,
  Power,
  RotateCw,
  Search,
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
import { listUsers } from '../../api/users'
import { customers as seedCustomers } from '../../mockData/customers'
import { users as seedUsers } from '../../mockData/users'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/format'
import CustomerForm from './CustomerForm'
import { customerTypeOptions } from './customerConstants'

const customerStatusTabs = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const normalizeCustomer = (customer) => ({
  ...customer,
  status: customer.status || 'active',
  billingAddress: customer.billingAddress || customer.address || '',
  deliveryAddress: customer.deliveryAddress || customer.address || '',
  outstandingBalance: customer.outstandingBalance || 0,
  creditLimit: customer.creditLimit || 0,
})

const normalizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
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
  const currentUser = useAuthStore((state) => state.currentUser)
  const isAdmin = currentUser?.role === ROLES.ADMIN
  const isSalesOfficer = currentUser?.role === ROLES.SALES_OFFICER

  const [customers, setCustomers] = useState([])
  const [staffUsers, setStaffUsers] = useState(seedUsers.map(normalizeUser))
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [salesOfficerFilter, setSalesOfficerFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [statusCustomer, setStatusCustomer] = useState(null)

  const salesOfficers = useMemo(
    () => staffUsers.filter((user) => user.role === ROLES.SALES_OFFICER && user.status === 'active'),
    [staffUsers],
  )

  const salesOfficerById = useMemo(
    () => new Map(staffUsers.map((user) => [user.id, user.name])),
    [staffUsers],
  )

  const loadCustomers = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    try {
      const usersResult = await listUsers()

      if (usersResult.success) {
        setStaffUsers((usersResult.users || []).map(normalizeUser))
      }

      const nextCustomers = seedCustomers.map(normalizeCustomer).map((customer) => {
        if (isSalesOfficer && currentUser?.id) {
          return { ...customer, assignedSalesOfficerId: currentUser.id }
        }
        return customer
      })

      setCustomers(nextCustomers)
    } catch {
      setListError('Unable to load customers. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [currentUser?.id, isSalesOfficer])

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

  const handleOpenForm = (customer = null) => {
    setEditingCustomer(customer)
    setFormError('')
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingCustomer(null)
    setFormError('')
  }

  const handleSaveCustomer = (customerData) => {
    setIsSaving(true)
    setFormError('')

    window.setTimeout(() => {
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
        setCustomers((current) =>
          current.map((customer) =>
            customer.id === editingCustomer.id
              ? { ...customer, ...customerData }
              : customer,
          ),
        )
      } else {
        setCustomers((current) => [
          {
            ...customerData,
            id: `cust-${Date.now()}`,
            joinedAt: new Date().toISOString().slice(0, 10),
            status: 'active',
            outstandingBalance: 0,
          },
          ...current,
        ])
      }

      setIsSaving(false)
      handleCloseForm()
    }, 250)
  }

  const handleToggleStatus = () => {
    if (!statusCustomer) return

    setCustomers((current) =>
      current.map((customer) =>
        customer.id === statusCustomer.id
          ? { ...customer, status: customer.status === 'active' ? 'inactive' : 'active' }
          : customer,
      ),
    )
    setStatusCustomer(null)
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
        <div className="border-b border-neutral-100 px-5 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="flex flex-wrap gap-10">
                {customerStatusTabs.map((tab) => {
                  const isActive = statusFilter === tab.value

                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setStatusFilter(tab.value)}
                      className={`relative py-2 text-md font-medium transition-colors ${
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
            <Button onClick={() => handleOpenForm()} size="sm" className="w-full sm:w-auto">
              <Plus className="size-4" aria-hidden="true" />
              Add Customer
            </Button>
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
              <Button type="button" className="mt-4" onClick={() => handleOpenForm()}>
                <Plus className="size-4" aria-hidden="true" />
                Add Customer
              </Button>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No customers match these filters.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3">Customer</th>
                  <th className="whitespace-nowrap px-4 py-3">Phone</th>
                  <th className="whitespace-nowrap px-4 py-3">City</th>
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
                    className="bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35"
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
                    <td className="px-4 py-3.5 text-neutral-600">{customer.city || '-'}</td>
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
                    <td className="px-4 py-3.5 text-right">
                      <ActionMenu
                        items={[
                          { label: 'Edit', icon: Edit, onClick: () => handleOpenForm(customer) },
                          { label: 'Reassign Sales Officer', icon: UserCheck, onClick: () => handleOpenForm(customer) },
                          {
                            label: customer.status === 'active' ? 'Deactivate' : 'Activate',
                            icon: Power,
                            danger: customer.status === 'active',
                            onClick: () => setStatusCustomer(customer),
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
        isOpen={Boolean(statusCustomer)}
        onClose={() => setStatusCustomer(null)}
        title={`${statusCustomer?.status === 'active' ? 'Deactivate' : 'Activate'} Customer`}
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            {statusCustomer?.status === 'active'
              ? 'This customer will be moved to inactive status. Existing invoices and outstanding balances will remain unchanged.'
              : 'This customer will be marked active and available for sales workflows again.'}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setStatusCustomer(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={statusCustomer?.status === 'active' ? 'danger' : 'primary'}
              onClick={handleToggleStatus}
            >
              {statusCustomer?.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
