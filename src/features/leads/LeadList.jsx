import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Edit, Plus, RefreshCw, RotateCw, Search, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { ROLES } from '../../auth/roles'
import { LEAD_SOURCE_OPTIONS, LEAD_STATUS_OPTIONS, deleteLead, listLeads, updateLead } from '../../api/leads'
import { listCustomers } from '../../api/customers'
import { listUsers } from '../../api/users'
import { normalizeApiUser } from '../users/userRoleUtils'
import { useAuthStore } from '../../store/authStore'

const statusVariant = {
  new: 'info',
  contacted: 'warning',
  qualified: 'purple',
  won: 'success',
  lost: 'danger',
}

const avatarClasses = [
  'bg-blue-500 text-white',
  'bg-rose-500 text-white',
  'bg-violet-500 text-white',
  'bg-primary-600 text-white',
  'bg-cyan-500 text-white',
]

const getInitials = (name = '') =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function LeadEditForm({ lead, customerOptions, salespersonOptions, saving, formError, onClose, onSave }) {
  const [formData, setFormData] = useState(lead)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setFormData(lead)
    setErrors({})
  }, [lead])

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const validate = () => {
    const nextErrors = {}
    if (!formData.leadSource) nextErrors.leadSource = 'Lead source is required.'
    if (!formData.mobileNumber?.trim()) nextErrors.mobileNumber = 'Mobile number is required.'
    if (!formData.assignedSalespersonId) nextErrors.assignedSalespersonId = 'Assigned salesperson is required.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validate()) return
    onSave(formData)
  }

  if (!formData) return null

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {formError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Lead Source"
          required
          options={LEAD_SOURCE_OPTIONS}
          value={formData.leadSource}
          onChange={(event) => updateField('leadSource', event.target.value)}
          error={errors.leadSource}
        />
        <Select
          label="Existing Customer"
          options={[{ value: '', label: 'No existing customer' }, ...customerOptions]}
          value={formData.customerId}
          onChange={(event) => updateField('customerId', event.target.value)}
        />
        <Input
          label="Mobile Number"
          required
          value={formData.mobileNumber}
          onChange={(event) => updateField('mobileNumber', event.target.value)}
          error={errors.mobileNumber}
        />
        <Select
          label="Assigned Salesperson"
          required
          options={salespersonOptions}
          value={formData.assignedSalespersonId}
          onChange={(event) => updateField('assignedSalespersonId', event.target.value)}
          error={errors.assignedSalespersonId}
        />
        <Select
          label="Lead Status"
          required
          options={LEAD_STATUS_OPTIONS}
          value={formData.leadStatus}
          onChange={(event) => updateField('leadStatus', event.target.value)}
        />
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving}>Save Lead</Button>
      </div>
    </form>
  )
}

export default function LeadList() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const leadBasePath = currentUser?.role === ROLES.SALES_OFFICER ? '/sales/leads' : '/admin/leads'

  const [leads, setLeads] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [customers, setCustomers] = useState([])
  const [salespeople, setSalespeople] = useState([])

  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [pageSize, setPageSize] = useState('10')
  const [selectedIds, setSelectedIds] = useState([])
  const [editingLead, setEditingLead] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadLeads = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const result = await listLeads(statusFilter !== 'all' ? { status: statusFilter } : {})

    if (!result.success) {
      setLeads([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    setLeads(result.leads)
    setIsLoading(false)
  }, [statusFilter])

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  useEffect(() => {
    let isMounted = true

    async function loadOptions() {
      const [customersResult, usersResult] = await Promise.all([listCustomers(), listUsers()])
      if (!isMounted) return

      if (customersResult.success) setCustomers(customersResult.customers)
      if (usersResult.success) {
        setSalespeople(
          usersResult.users
            .map(normalizeApiUser)
            .filter((user) => user.role === ROLES.SALES_OFFICER || user.role === ROLES.ADMIN),
        )
      }
    }

    loadOptions()
    return () => {
      isMounted = false
    }
  }, [])

  const customerOptions = useMemo(
    () => customers.map((customer) => ({ value: customer.id, label: `${customer.name}${customer.phone ? ` • ${customer.phone}` : ''}` })),
    [customers],
  )
  const salespersonOptions = useMemo(
    () => salespeople.map((user) => ({ value: user.id, label: user.name })),
    [salespeople],
  )

  const filteredLeads = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return leads.filter((lead) => {
      const matchesSearch =
        !normalizedSearch ||
        [lead.leadId, lead.customerName, lead.mobileNumber]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      const matchesSource = sourceFilter === 'all' || lead.leadSource === sourceFilter
      const matchesTeam = teamFilter === 'all' || lead.assignedSalespersonId === teamFilter

      return matchesSearch && matchesSource && matchesTeam
    })
  }, [leads, searchTerm, sourceFilter, teamFilter])

  const visibleLeads = filteredLeads.slice(0, Number(pageSize))
  const allVisibleSelected = visibleLeads.length > 0 && visibleLeads.every((lead) => selectedIds.includes(lead.id))

  const toggleSelection = (leadId) => {
    setSelectedIds((current) =>
      current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId],
    )
  }

  const toggleAllVisible = () => {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleLeads.some((lead) => lead.id === id))
        : Array.from(new Set([...current, ...visibleLeads.map((lead) => lead.id)])),
    )
  }

  const resetFilters = () => {
    setStatusFilter('all')
    setSourceFilter('all')
    setTeamFilter('all')
    setSearchTerm('')
    setSelectedIds([])
  }

  const exportCsv = () => {
    const rows = [
      ['Lead ID', 'Customer', 'Mobile', 'Source', 'Assigned', 'Status', 'Created'],
      ...filteredLeads.map((lead) => [
        lead.leadId,
        lead.customerName,
        lead.mobileNumber,
        lead.leadSource,
        lead.assignedSalespersonName,
        lead.leadStatus,
        lead.createdAt,
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'leads.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleSaveLead = async (formData) => {
    setIsSaving(true)
    setFormError('')

    const result = await updateLead(editingLead.id, formData)

    if (!result.success) {
      setFormError(result.error)
      setIsSaving(false)
      return
    }

    await loadLeads()
    setIsSaving(false)
    setEditingLead(null)
  }

  const handleDeleteLead = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setDeleteError('')

    const result = await deleteLead(deleteTarget.id)

    if (!result.success) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }

    setLeads((current) => current.filter((lead) => lead.id !== deleteTarget.id))
    setSelectedIds((current) => current.filter((id) => id !== deleteTarget.id))
    setDeleteTarget(null)
    setIsDeleting(false)
  }

  return (
    <div className="space-y-4">
      <Card className="p-0">
        <div className="relative border-b border-neutral-100 px-5 py-3">
          <div className="flex gap-4">
            <div className="grid w-full grid-cols-2 gap-2">
              <div>
                <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center">
                  <div className="relative sm:w-64">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search leads..."
                      className="h-9 w-full rounded-xl border border-neutral-100 bg-white py-1.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                    />
                  </div>
                  <Select className="sm:w-40" options={[{ value: 'all', label: 'All Status' }, ...LEAD_STATUS_OPTIONS]} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} triggerClassName="h-9 bg-white py-1.5" />
                  <Select className="sm:w-40" options={[{ value: 'all', label: 'All Sources' }, ...LEAD_SOURCE_OPTIONS]} value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} triggerClassName="h-9 bg-white py-1.5" />
                </div>
                <div className="flex flex-wrap items-center gap-2 py-1">
                  <Select className="sm:w-40" options={[{ value: 'all', label: 'All Team' }, ...salespersonOptions]} value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} triggerClassName="h-9 bg-white py-1.5" />
                  <button type="button" onClick={resetFilters} className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-neutral-100 bg-white text-neutral-500 shadow-(--shadow-xs) transition-colors hover:text-primary-700" aria-label="Reset filters">
                    <RefreshCw className="size-4" />
                  </button>
                </div>
                <div className="flex flex-col gap-2 pt-1 text-sm text-neutral-500 sm:flex-row sm:items-center py-1">
                  <span>
                    Showing <span className="font-semibold text-neutral-900">{visibleLeads.length}</span> of{' '}
                    <span className="font-semibold text-neutral-900">{filteredLeads.length}</span> leads
                  </span>
                  <Select
                    options={[
                      { value: '10', label: '10 / page' },
                      { value: '25', label: '25 / page' },
                      { value: '50', label: '50 / page' },
                    ]}
                    value={pageSize}
                    onChange={(event) => setPageSize(event.target.value)}
                    className="w-32"
                    triggerClassName="h-8 bg-white py-1"
                  />
                  {selectedIds.length > 0 && (
                    <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
                      {selectedIds.length} selected
                    </span>
                  )}
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center justify-end gap-2 md:absolute md:right-5 md:top-[1.1rem] md:w-auto md:min-w-fit">
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={exportCsv}>
                  <Download className="size-4" aria-hidden="true" />
                  Export
                </Button>
                <Button onClick={() => navigate(`${leadBasePath}/new`)} size="sm" className="h-9 rounded-2xl px-3.5">
                  <Plus className="size-4" aria-hidden="true" />
                  Add Lead
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-white">
          {listError ? (
            <div className="py-10 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadLeads}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <LoadingSpinner label="Loading leads..." />
          ) : (
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" aria-label="Select all leads" />
                  </th>
                  <th className="whitespace-nowrap px-4 py-3">Lead</th>
                  <th className="whitespace-nowrap px-4 py-3">Phone</th>
                  <th className="whitespace-nowrap px-4 py-3">Source</th>
                  <th className="whitespace-nowrap px-4 py-3">Assigned</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3">Created</th>
                  <th className="w-16 whitespace-nowrap px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {visibleLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center">
                      <p className="text-sm font-medium text-neutral-900">No leads found</p>
                      <p className="mt-1 text-sm text-neutral-500">Add a lead to start tracking the sales life cycle.</p>
                      <Button type="button" className="mt-4" onClick={() => navigate(`${leadBasePath}/new`)}>
                        <Plus className="size-4" aria-hidden="true" />
                        Add Lead
                      </Button>
                    </td>
                  </tr>
                ) : (
                  visibleLeads.map((lead, index) => (
                    <tr key={lead.id} className="transition-colors hover:bg-primary-50/30">
                      <td className="px-4 py-4 align-middle">
                        <input type="checkbox" checked={selectedIds.includes(lead.id)} onChange={() => toggleSelection(lead.id)} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" aria-label={`Select ${lead.leadId}`} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarClasses[index % avatarClasses.length]}`}>
                            {getInitials(lead.customerName || lead.mobileNumber)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-900">{lead.customerName || 'New prospect'}</p>
                            <p className="mt-0.5 text-xs text-neutral-400">{lead.leadId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <a href={`tel:${lead.mobileNumber}`} className="font-semibold text-primary-600 hover:text-primary-700">
                          {lead.mobileNumber}
                        </a>
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
                          {lead.leadSource}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[0.65rem] font-semibold text-white">
                            {getInitials(lead.assignedSalespersonName)}
                          </span>
                          <span className="max-w-28 text-neutral-600">{lead.assignedSalespersonName || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={statusVariant[lead.leadStatus] || 'neutral'}>{lead.leadStatus}</Badge>
                      </td>
                      <td className="px-4 py-4 text-neutral-500">{formatDate(lead.createdAt)}</td>
                      <td className="px-4 py-4 text-right">
                        <ActionMenu
                          items={[
                            { label: 'Edit', icon: Edit, onClick: () => setEditingLead(lead) },
                            { label: 'Delete', icon: Trash2, danger: true, onClick: () => setDeleteTarget(lead) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Modal isOpen={Boolean(editingLead)} onClose={() => setEditingLead(null)} title="Edit Lead" className="max-w-2xl">
        <LeadEditForm
          lead={editingLead}
          customerOptions={customerOptions}
          salespersonOptions={salespersonOptions}
          saving={isSaving}
          formError={formError}
          onClose={() => setEditingLead(null)}
          onSave={handleSaveLead}
        />
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return
          setDeleteError('')
          setDeleteTarget(null)
        }}
        title="Delete Lead"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete {deleteTarget?.customerName || deleteTarget?.leadId || 'this lead'} from the lead list?
          </p>
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isDeleting} onClick={() => { setDeleteError(''); setDeleteTarget(null) }}>Cancel</Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDeleteLead}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
