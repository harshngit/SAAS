import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRightCircle, Download, Edit, Eye, Plus, RefreshCw, RotateCw, Search, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { ROLES } from '../../auth/roles'
import { LEAD_SOURCE_OPTIONS, LEAD_STATUS_OPTIONS, deleteLead, listLeads, updateLead } from '../../api/leads'
import { listCustomers } from '../../api/customers'
import { listUsers } from '../../api/users'
import { normalizeApiUser } from '../users/userRoleUtils'
import { useAuthStore } from '../../store/authStore'
import { LeadEditForm } from './LeadForms'
import ConvertLeadModal from './ConvertLeadModal'
import { LEAD_STATUS_VARIANT, formatLeadStatus, getLeadActivity } from './leadActivity'

const statusVariant = LEAD_STATUS_VARIANT

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

export default function LeadList() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isSalesOfficer = currentUser?.role === ROLES.SALES_OFFICER
  const leadBasePath = isSalesOfficer ? '/sales/leads' : '/admin/leads'

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

  const [convertTarget, setConvertTarget] = useState(null)

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
        [lead.leadId, lead.name, lead.customerName, lead.mobileNumber, lead.email]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      const matchesSource = sourceFilter === 'all' || lead.leadSource === sourceFilter
      const matchesTeam =
        teamFilter === 'all' ||
        (teamFilter === 'unassigned' ? !lead.assignedSalespersonId : lead.assignedSalespersonId === teamFilter)

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
      ['Lead ID', 'Lead', 'Mobile', 'Email', 'Source', 'Assigned', 'Status', 'Last Activity', 'Next Follow-up', 'Created'],
      ...filteredLeads.map((lead) => {
        const activity = getLeadActivity(lead)
        return [
          lead.leadId,
          lead.name || lead.customerName,
          lead.mobileNumber,
          lead.email,
          lead.leadSource,
          lead.assignedSalespersonName,
          lead.leadStatus,
          activity.lastActivity.label,
          activity.nextFollowUp.label,
          lead.createdAt,
        ]
      }),
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

  const handleLeadConverted = async ({ customerId }) => {
    await loadLeads()
    if (customerId) navigate(`/admin/customers/${customerId}`)
  }

  return (
    <div className="space-y-4">
      <Card className="p-0">
        <div className="border-b border-neutral-100 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-60">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search leads..."
                  className="h-9 w-full rounded-xl border border-neutral-100 bg-white py-1.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Select className="w-[calc(50%-0.25rem)] sm:w-36" options={[{ value: 'all', label: 'All Status' }, ...LEAD_STATUS_OPTIONS]} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} triggerClassName="h-9 bg-white py-1.5" />
              <Select className="w-[calc(50%-0.25rem)] sm:w-36" options={[{ value: 'all', label: 'All Sources' }, ...LEAD_SOURCE_OPTIONS]} value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} triggerClassName="h-9 bg-white py-1.5" />
              {isSalesOfficer ? (
                <span className="flex h-9 items-center rounded-xl border border-neutral-100 bg-neutral-50 px-3 text-sm font-medium text-neutral-500">
                  My Leads
                </span>
              ) : (
                <Select
                  className="w-[calc(50%-0.25rem)] sm:w-44"
                  options={[
                    { value: 'all', label: 'All Salespersons' },
                    { value: 'unassigned', label: 'Unassigned' },
                    ...salespersonOptions,
                  ]}
                  value={teamFilter}
                  onChange={(event) => setTeamFilter(event.target.value)}
                  triggerClassName="h-9 bg-white py-1.5"
                />
              )}
              <button type="button" onClick={resetFilters} className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-neutral-100 bg-white text-neutral-500 shadow-(--shadow-xs) transition-colors hover:text-primary-700" aria-label="Reset filters">
                <RefreshCw className="size-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2">
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

          {/* Result count + page size */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-50 pt-2.5 text-sm text-neutral-500">
            <span>
              Showing <span className="font-semibold text-neutral-900">{visibleLeads.length}</span> of{' '}
              <span className="font-semibold text-neutral-900">{filteredLeads.length}</span> leads
            </span>
            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
                  {selectedIds.length} selected
                </span>
              )}
              <Select
                options={[
                  { value: '10', label: '10 / page' },
                  { value: '25', label: '25 / page' },
                  { value: '50', label: '50 / page' },
                ]}
                value={pageSize}
                onChange={(event) => setPageSize(event.target.value)}
                className="w-28"
                triggerClassName="h-8 bg-white py-1"
              />
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
            <table className="w-full min-w-280 text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" aria-label="Select all leads" />
                  </th>
                  <th className="whitespace-nowrap px-4 py-3">Lead</th>
                  <th className="whitespace-nowrap px-4 py-3">Contact</th>
                  <th className="whitespace-nowrap px-4 py-3">Source</th>
                  <th className="whitespace-nowrap px-4 py-3">Assigned To</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3">Last Activity</th>
                  <th className="whitespace-nowrap px-4 py-3">Next Follow-up</th>
                  <th className="whitespace-nowrap px-4 py-3">Created</th>
                  <th className="w-16 whitespace-nowrap px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {visibleLeads.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-10 text-center">
                      <p className="text-sm font-medium text-neutral-900">No leads found</p>
                      <p className="mt-1 text-sm text-neutral-500">Add a lead to start tracking the sales life cycle.</p>
                      <Button type="button" className="mt-4" onClick={() => navigate(`${leadBasePath}/new`)}>
                        <Plus className="size-4" aria-hidden="true" />
                        Add Lead
                      </Button>
                    </td>
                  </tr>
                ) : (
                  visibleLeads.map((lead, index) => {
                    const activity = getLeadActivity(lead)
                    return (
                    <tr
                      key={lead.id}
                      onClick={() => navigate(`${leadBasePath}/${lead.id}`)}
                      className="cursor-pointer transition-colors hover:bg-primary-50/30"
                    >
                      <td className="px-4 py-4 align-middle" onClick={(event) => event.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.includes(lead.id)} onChange={() => toggleSelection(lead.id)} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" aria-label={`Select ${lead.leadId}`} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarClasses[index % avatarClasses.length]}`}>
                            {getInitials(lead.name || lead.customerName || lead.mobileNumber)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-900">{lead.name || lead.customerName || 'New prospect'}</p>
                            <p className="mt-0.5 text-xs text-neutral-400">{lead.leadId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                        <a href={`tel:${lead.mobileNumber}`} className="font-semibold text-primary-600 hover:text-primary-700">
                          {lead.mobileNumber || '—'}
                        </a>
                        {lead.email && <p className="mt-0.5 max-w-40 truncate text-xs text-neutral-400" title={lead.email}>{lead.email}</p>}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
                          {lead.leadSource || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {lead.assignedSalespersonName && (
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[0.65rem] font-semibold text-white">
                              {getInitials(lead.assignedSalespersonName)}
                            </span>
                          )}
                          <span className="max-w-28 text-neutral-600">{lead.assignedSalespersonName || 'Unassigned'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={statusVariant[lead.leadStatus] || 'neutral'}>{formatLeadStatus(lead.leadStatus)}</Badge>
                      </td>
                      <td className="px-4 py-4 text-neutral-500">{activity.lastActivity.label}</td>
                      <td className={`px-4 py-4 ${activity.nextFollowUp.tone === 'danger' ? 'font-medium text-red-600' : activity.nextFollowUp.tone === 'warning' ? 'font-medium text-amber-600' : 'text-neutral-500'}`}>
                        {activity.nextFollowUp.label}
                      </td>
                      <td className="px-4 py-4 text-neutral-500">{formatDate(lead.createdAt)}</td>
                      <td className="px-4 py-4 text-right" onClick={(event) => event.stopPropagation()}>
                        <ActionMenu
                          items={[
                            { label: 'View Details', icon: Eye, onClick: () => navigate(`${leadBasePath}/${lead.id}`) },
                            { label: 'Edit', icon: Edit, onClick: () => setEditingLead(lead) },
                            ...(lead.convertedCustomerId
                              ? [{ label: 'View Customer', icon: ArrowRightCircle, onClick: () => navigate(`/admin/customers/${lead.convertedCustomerId}`) }]
                              : lead.leadStatus === 'won' || lead.leadStatus === 'lost'
                                ? []
                                : [{ label: 'Convert to Customer', icon: ArrowRightCircle, onClick: () => setConvertTarget(lead) }]),
                            { label: 'Delete', icon: Trash2, danger: true, onClick: () => setDeleteTarget(lead) },
                          ]}
                        />
                      </td>
                    </tr>
                    )
                  })
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
          lockAssignee={isSalesOfficer}
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

      <ConvertLeadModal
        isOpen={Boolean(convertTarget)}
        onClose={() => setConvertTarget(null)}
        lead={convertTarget}
        salespersonOptions={salespersonOptions}
        onConverted={handleLeadConverted}
      />
    </div>
  )
}
