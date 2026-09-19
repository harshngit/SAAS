import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  MapPin,
  Phone,
  Plus,
  RotateCw,
  Search,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  Users,
  UserX,
  Wallet,
  X,
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
import { getFileUrl } from '../../api/files'
import { listUsers } from '../../api/users'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/format'
import CustomerForm from './CustomerForm'
import { customerCategoryOptions } from './customerConstants'
import { getSystemRoleFromRoleName } from '../users/userRoleUtils'

const normalizeCustomer = (customer) => ({
  ...customer,
  organizationId: customer.organization_id || customer.organizationId,
  businessName: customer.business_name || customer.businessName || customer.name,
  profileImage: getFileUrl(
    customer.profile_image_id
    || customer.profile_image_url
    || customer.profile_image
    || customer.basic_information?.profile_image_id,
  ),
  type: customer.category || customer.type || '',
  billingAddress: customer.billing_address || customer.billingAddress || customer.address || '',
  deliveryAddress: customer.delivery_address || customer.deliveryAddress || customer.address || '',
  assignedSalesOfficerId: customer.assigned_sales_officer_id || customer.assignedSalesOfficerId || '',
  assignedSalesOfficer: customer.assigned_sales_officer || customer.assignedSalesOfficer,
  outstandingBalance: customer.outstanding_balance || customer.outstandingBalance || 0,
  creditLimit: customer.credit_limit ?? customer.creditLimit ?? 0,
  gstNumber: customer.gst_number || customer.gstNumber || '',
  contactPerson: customer.primary_contact_person || customer.contactPerson || '',
  city: customer.city || '',
  lastOrderDate: customer.last_order_date || customer.lastOrderDate || null,
  lastVisitDate: customer.last_visit_date || customer.lastVisitDate || null,
  mapsLatitude: customer.maps_latitude ?? customer.mapsLatitude ?? null,
  mapsLongitude: customer.maps_longitude ?? customer.mapsLongitude ?? null,
  joinedAt: customer.created_at || customer.joinedAt,
  updatedAt: customer.updated_at || customer.updatedAt,
  notes: customer.notes || '',
  isActive: customer.is_active ?? customer.isActive,
  status: customer.is_active === false || customer.status === 'inactive' ? 'inactive' : 'active',
})

function formatListDate(value, emptyLabel) {
  if (!value) return emptyLabel
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return emptyLabel
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

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
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [pageSize, setPageSize] = useState('10')
  const [page, setPage] = useState(1)
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([])
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
    if (isSalesOfficer) {
      setStaffUsers(
        currentUser?.id
          ? [
              {
                id: currentUser.id,
                name: currentUser.name || 'Current user',
                role: currentUser.role,
                status: 'active',
              },
            ]
          : [],
      )
      return
    }

    const userResult = await listUsers()

    if (userResult.success) {
      setStaffUsers(userResult.users.map(normalizeUser))
    }
  }, [currentUser?.id, currentUser?.name, currentUser?.role, isSalesOfficer])

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

  const customerSummary = useMemo(() => ({
    total: filteredCustomers.length,
    active: filteredCustomers.filter((customer) => customer.status === 'active').length,
    inactive: filteredCustomers.filter((customer) => customer.status === 'inactive').length,
    outstanding: filteredCustomers.reduce((sum, customer) => sum + Number(customer.outstandingBalance || 0), 0),
  }), [filteredCustomers])

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / Number(pageSize)))
  const currentPage = Math.min(page, totalPages)
  const visibleCustomers = filteredCustomers.slice((currentPage - 1) * Number(pageSize), currentPage * Number(pageSize))
  const rangeStart = filteredCustomers.length === 0 ? 0 : (currentPage - 1) * Number(pageSize) + 1
  const rangeEnd = Math.min(filteredCustomers.length, currentPage * Number(pageSize))
  const allVisibleSelected = visibleCustomers.length > 0 && visibleCustomers.every((customer) => selectedCustomerIds.includes(customer.id))

  const toggleCustomerSelection = (customerId) => {
    setSelectedCustomerIds((current) => (
      current.includes(customerId)
        ? current.filter((id) => id !== customerId)
        : [...current, customerId]
    ))
  }

  const toggleAllVisibleCustomers = () => {
    setSelectedCustomerIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleCustomers.some((customer) => customer.id === id))
      }

      return [...new Set([...current, ...visibleCustomers.map((customer) => customer.id)])]
    })
  }

  const exportCustomersCsv = () => {
    const customersToExport = filteredCustomers.filter((customer) => selectedCustomerIds.includes(customer.id))
    const rows = [
      ['Customer', 'Category', 'Contact Person', 'Location', 'Sales Officer', 'Last Order', 'Last Visit', 'Outstanding', 'Status'],
      ...customersToExport.map((customer) => [
        customer.name,
        customer.type,
        customer.contactPerson,
        customer.city,
        salesOfficerById.get(customer.assignedSalesOfficerId) || 'Unassigned',
        formatListDate(customer.lastOrderDate, 'No order yet'),
        formatListDate(customer.lastVisitDate, 'No visit yet'),
        formatCurrency(customer.outstandingBalance),
        customer.status,
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'customers.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleBulkDelete = async () => {
    if (!selectedCustomerIds.length || !window.confirm(`Delete ${selectedCustomerIds.length} selected customer${selectedCustomerIds.length === 1 ? '' : 's'}?`)) return

    setIsDeleting(true)
    const results = await Promise.all(selectedCustomerIds.map((id) => deleteCustomerApi(id)))
    const failed = results.find((result) => !result.success)

    if (failed) {
      setDeleteError(failed.error || 'Some customers could not be deleted.')
      setIsDeleting(false)
      return
    }

    setCustomers((current) => current.filter((customer) => !selectedCustomerIds.includes(customer.id)))
    setSelectedCustomerIds([])
    setIsDeleting(false)
  }

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
    <div className="listing-page space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-5 py-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Customers</h1>
                <p className="mt-1 text-xs text-neutral-400">{filteredCustomers.length} customers in view</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="relative w-full sm:w-60">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                  <input type="search" value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setPage(1) }} placeholder="Search customers..." className="h-9 w-full rounded-xl border border-neutral-100 bg-white py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12" />
                </div>
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => setIsFilterOpen(true)}><SlidersHorizontal className="size-4" />Filter</Button>
                <RequirePermission module="customers" action="create">
                  <Button onClick={() => handleOpenForm()} size="sm" className="h-9 rounded-2xl px-3.5"><Plus className="size-4" />Add Customer</Button>
                </RequirePermission>
              </div>
            </div>
          </div>

          <div className="-mx-5 -mb-5 mt-5 grid grid-cols-2 border-t border-neutral-100 lg:grid-cols-4">
            {[
              { label: 'Total Customers', value: customerSummary.total, detail: `${customerSummary.active} active`, icon: Users },
              { label: 'Active Customers', value: customerSummary.active, detail: 'currently active', icon: UserCheck },
              { label: 'Inactive Customers', value: customerSummary.inactive, detail: 'needs follow-up', icon: UserX },
              { label: 'Outstanding', value: formatCurrency(customerSummary.outstanding), detail: 'total balance', icon: Wallet },
            ].map(({ label, value, detail, icon: Icon }, index) => (
              <div key={label} className={`min-h-32 border-neutral-100 px-5 py-4 lg:px-6 ${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b lg:border-b-0' : ''} ${index < 3 ? 'lg:border-r' : ''}`}>
                <div className="flex items-start justify-between gap-3"><p className="text-xs font-medium text-[#6b86ad]">{label}</p><span className="flex size-9 items-center justify-center rounded-full bg-[#f5f7fb] text-[#55749f]"><Icon className="size-4" /></span></div>
                <p className="mt-4 font-(--font-display) text-[2rem] font-semibold leading-none tracking-tight text-[#082445]">{value}</p>
                <p className="mt-2 text-xs font-medium text-emerald-600">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {selectedCustomerIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3">
          <p className="text-sm font-medium text-primary-900">{selectedCustomerIds.length} customer{selectedCustomerIds.length === 1 ? '' : 's'} selected</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg bg-white px-3" onClick={exportCustomersCsv}>
              <Download className="size-4" aria-hidden="true" />
              Download
            </Button>
            <Button type="button" variant="danger" size="sm" className="h-8 rounded-lg px-3" loading={isDeleting} onClick={handleBulkDelete}>
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto bg-white px-0 py-0">
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
            <table className="listing-table w-full min-w-[72rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[#e3e9f3] bg-[#f8faff] text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#a0b0cf]">
                  <th className="w-14 px-6 py-6">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisibleCustomers}
                      className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      aria-label="Select all customers"
                    />
                  </th>
                  <th className="min-w-[20rem] whitespace-nowrap px-6 py-6">Customer</th>
                  <th className="whitespace-nowrap px-6 py-6">Contact Person</th>
                  <th className="whitespace-nowrap px-6 py-6">Location</th>
                  <th className="whitespace-nowrap px-6 py-6">Sales Officer</th>
                  <th className="whitespace-nowrap px-6 py-6">Last Order</th>
                  <th className="whitespace-nowrap px-6 py-6">Last Visit</th>
                  <th className="whitespace-nowrap px-6 py-6">Outstanding</th>
                  <th className="whitespace-nowrap px-6 py-6">Status</th>
                  <th className="whitespace-nowrap px-6 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => navigate(`${basePath}/${customer.id}`)}
                    className="cursor-pointer bg-white transition-colors hover:bg-primary-50/30"
                  >
                    <td className="px-6 py-5 align-middle" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedCustomerIds.includes(customer.id)}
                        onChange={() => toggleCustomerSelection(customer.id)}
                        className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                        aria-label={`Select ${customer.name}`}
                      />
                    </td>
                    <td className="min-w-[20rem] px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-primary-50 text-xs font-semibold text-primary-700 ring-1 ring-primary-100">
                          {customer.profileImage ? (
                            <img src={customer.profileImage} alt={customer.name} className="size-full object-cover" />
                          ) : (
                            getInitials(customer.name)
                          )}
                        </div>
                        <div>
                          <span className="font-medium text-neutral-900">{customer.name}</span>
                          <p className="mt-0.5 text-xs text-neutral-400">{customer.type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-[#315987]">{customer.contactPerson || '—'}</td>
                    <td className="px-6 py-5 text-[#315987]">{customer.city || '—'}</td>
                    <td className="px-6 py-5 text-[#315987]">
                      {salesOfficerById.get(customer.assignedSalesOfficerId) || 'Unassigned'}
                    </td>
                    <td className="px-6 py-5 text-[#315987]">
                      {formatListDate(customer.lastOrderDate, 'No order yet')}
                    </td>
                    <td className="px-6 py-5 text-[#315987]">
                      {formatListDate(customer.lastVisitDate, 'No visit yet')}
                    </td>
                    <td className="px-6 py-5">
                      {customer.outstandingBalance > 0 ? (
                        <Badge variant="warning">{formatCurrency(customer.outstandingBalance)}</Badge>
                      ) : (
                        <span className="font-medium text-neutral-700">{formatCurrency(0)}</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <Badge variant={customer.status === 'active' ? 'success' : 'neutral'}>
                        {customer.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-5 text-right" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={!customer.phone}
                          onClick={() => { window.location.href = `tel:${customer.phone}` }}
                          className="flex size-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Call ${customer.name}`}
                          title={customer.phone ? `Call ${customer.phone}` : 'No phone number on file'}
                        >
                          <Phone className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={customer.mapsLatitude == null || customer.mapsLongitude == null}
                          onClick={() =>
                            window.open(
                              `https://www.google.com/maps?q=${customer.mapsLatitude},${customer.mapsLongitude}`,
                              '_blank',
                              'noopener,noreferrer',
                            )
                          }
                          className="flex size-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`View ${customer.name} on map`}
                          title={customer.mapsLatitude != null && customer.mapsLongitude != null ? 'View on map' : 'No saved location'}
                        >
                          <MapPin className="size-4" aria-hidden="true" />
                        </button>
                        <ActionMenu
                          items={[
                            { label: 'View Details', icon: UserCheck, onClick: () => navigate(`${basePath}/${customer.id}`) },
                            { label: 'Edit', icon: Edit, onClick: () => handleOpenForm(customer) },
                            {
                              label: 'Delete',
                              icon: Trash2,
                              danger: true,
                              onClick: () => setDeleteCustomer(customer),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-white px-5 py-4 text-xs text-[#6f89b0]">
          <div className="flex items-center gap-3">
            <span>Showing <span className="font-semibold text-[#082445]">{rangeStart}-{rangeEnd}</span> of <span className="font-semibold text-[#082445]">{filteredCustomers.length}</span></span>
            <span className="hidden text-neutral-300 sm:inline">|</span>
            <label className="flex items-center gap-2">Rows per page
              <Select options={[{ value: '10', label: '10' }, { value: '25', label: '25' }, { value: '50', label: '50' }]} value={pageSize} onChange={(event) => { setPageSize(event.target.value); setPage(1) }} className="w-20" triggerClassName="h-8 bg-white py-1 text-xs" />
            </label>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button>
            <span className="min-w-14 text-center font-medium text-[#082445]">{currentPage} / {totalPages}</span>
            <button type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button>
          </div>
        </div>
      </Card>

      {isFilterOpen && (
        <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Customer filters">
          <button type="button" className="absolute inset-0 cursor-default bg-neutral-950/20" onClick={() => setIsFilterOpen(false)} aria-label="Close filters" />
          <aside className="relative z-10 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4"><div><h2 className="text-lg font-semibold text-neutral-900">Filter Customers</h2><p className="mt-0.5 text-xs text-neutral-400">Refine the customers shown in the table.</p></div><button type="button" onClick={() => setIsFilterOpen(false)} className="flex size-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-50" aria-label="Close filters"><X className="size-5" /></button></div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Status<Select options={[{ value: 'all', label: 'All Statuses' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} /></label>
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Category<Select options={[{ value: 'all', label: 'All categories' }, ...customerCategoryOptions]} value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1) }} /></label>
              {isAdmin && <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Sales officer<Select options={salesOfficerFilterOptions} value={salesOfficerFilter} onChange={(event) => { setSalesOfficerFilter(event.target.value); setPage(1) }} /></label>}
            </div>
            <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-4"><button type="button" onClick={() => { setStatusFilter('all'); setTypeFilter('all'); setSalesOfficerFilter('all'); setSearchTerm(''); setPage(1) }} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">Clear all</button><Button type="button" onClick={() => setIsFilterOpen(false)}>Apply filters</Button></div>
          </aside>
        </div>
      )}

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
