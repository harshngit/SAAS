import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, ArrowRightCircle, ChevronLeft, ChevronRight, Download, Edit, Eye, Globe2, Plus, RotateCw, Search, SlidersHorizontal, Target, Trash2, TrendingUp, X } from 'lucide-react'
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
import { listUsers } from '../../api/users'
import { normalizeApiUser } from '../users/userRoleUtils'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/format'
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
  const [salespeople, setSalespeople] = useState([])

  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [pageSize, setPageSize] = useState('10')
  const [page, setPage] = useState(1)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
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
      const usersResult = currentUser?.role === ROLES.SALES_OFFICER ? { success: true, users: [] } : await listUsers()
      if (!isMounted) return

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

  const leadSummary = useMemo(() => {
    const closedLeads = leads.filter((lead) => ['won', 'lost'].includes(lead.leadStatus))
    const wonLeads = leads.filter((lead) => lead.leadStatus === 'won')
    const pipelineValue = leads.reduce((sum, lead) => sum + Number(lead.value ?? lead.estimatedValue ?? lead.amount ?? 0), 0)
    return {
      total: filteredLeads.length,
      pipelineValue,
      sources: new Set(filteredLeads.map((lead) => lead.leadSource).filter(Boolean)).size,
      conversion: closedLeads.length ? Math.round((wonLeads.length / closedLeads.length) * 100) : 0,
      newLeads: leads.filter((lead) => lead.leadStatus === 'new').length,
      wonLeads: wonLeads.length,
    }
  }, [filteredLeads, leads])

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / Number(pageSize)))
  const currentPage = Math.min(page, totalPages)
  const visibleLeads = filteredLeads.slice((currentPage - 1) * Number(pageSize), currentPage * Number(pageSize))
  const rangeStart = filteredLeads.length === 0 ? 0 : (currentPage - 1) * Number(pageSize) + 1
  const rangeEnd = Math.min(filteredLeads.length, currentPage * Number(pageSize))
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

  const exportCsv = (onlySelected = false) => {
    const leadsToExport = onlySelected ? filteredLeads.filter((lead) => selectedIds.includes(lead.id)) : filteredLeads
    const rows = [
      ['Lead ID', 'Lead', 'Mobile', 'Email', 'Source', 'Assigned', 'Status', 'Last Activity', 'Next Follow-up', 'Created'],
      ...leadsToExport.map((lead) => {
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

  const handleBulkDelete = async () => {
    if (!selectedIds.length || !window.confirm(`Delete ${selectedIds.length} selected lead${selectedIds.length === 1 ? '' : 's'}?`)) return

    setIsDeleting(true)
    const selectedLeads = leads.filter((lead) => selectedIds.includes(lead.id))
    const results = await Promise.all(selectedLeads.map((lead) => deleteLead(lead.id)))
    const failed = results.find((result) => !result.success)

    if (failed) {
      setDeleteError(failed.error || 'Some leads could not be deleted.')
      setIsDeleting(false)
      return
    }

    setLeads((current) => current.filter((lead) => !selectedIds.includes(lead.id)))
    setSelectedIds([])
    setIsDeleting(false)
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
    <div className="listing-page space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-5 py-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Leads</h1>
              <p className="mt-1 text-xs text-neutral-400">{filteredLeads.length} leads in view</p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="relative w-full sm:w-60">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => { setSearchTerm(event.target.value); setPage(1) }}
                    placeholder="Search leads..."
                    className="h-9 w-full rounded-xl border border-neutral-100 bg-white py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => setIsFilterOpen(true)}>
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  Filter
                </Button>
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

          <div className="-mx-5 -mb-5 mt-5 grid grid-cols-2 border-t border-neutral-100 lg:grid-cols-4">
            {[
              { label: 'Total Leads', value: leadSummary.total, detail: `${leadSummary.newLeads} new`, icon: Activity },
              { label: 'Pipeline Value', value: formatCurrency(leadSummary.pipelineValue), detail: `${leadSummary.wonLeads} won`, icon: TrendingUp },
              { label: 'Sources', value: leadSummary.sources, detail: 'active channels', icon: Globe2 },
              { label: 'Conversion', value: `${leadSummary.conversion}%`, detail: 'won from closed leads', icon: Target },
            ].map(({ label, value, detail, icon: Icon }, index) => (
              <div key={label} className={`min-h-32 border-neutral-100 px-5 py-4 lg:px-6 ${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b lg:border-b-0' : ''} ${index < 3 ? 'lg:border-r' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-medium text-[#6b86ad]">{label}</p>
                  <span className="flex size-9 items-center justify-center rounded-full bg-[#f5f7fb] text-[#55749f]">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-4 font-(--font-display) text-[2rem] font-semibold leading-none tracking-tight text-[#082445]">{value}</p>
                <p className="mt-2 text-xs font-medium text-emerald-600">{detail}</p>
              </div>
            ))}
          </div>
        </div>

      </Card>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3">
          <p className="text-sm font-medium text-primary-900">{selectedIds.length} lead{selectedIds.length === 1 ? '' : 's'} selected</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg bg-white px-3" onClick={() => exportCsv(true)}>
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
            <table className="listing-table w-full min-w-280 text-left text-sm">
              <thead>
                <tr className="border-b border-[#e3e9f3] bg-[#f8faff] text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#a0b0cf]">
                  <th className="w-10 px-6 py-6">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" aria-label="Select all leads" />
                  </th>
                  <th className="min-w-[20rem] whitespace-nowrap px-6 py-6">Lead</th>
                  <th className="whitespace-nowrap px-6 py-6">Contact</th>
                  <th className="whitespace-nowrap px-6 py-6">Source</th>
                  <th className="whitespace-nowrap px-6 py-6">Assigned To</th>
                  <th className="whitespace-nowrap px-6 py-6">Status</th>
                  <th className="whitespace-nowrap px-6 py-6">Next Follow-up</th>
                  <th className="whitespace-nowrap px-6 py-6">Created</th>
                  <th className="w-16 whitespace-nowrap px-6 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {visibleLeads.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center">
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
                      className="cursor-pointer bg-white transition-colors hover:bg-primary-50/30"
                    >
                      <td className="px-6 py-5 align-middle" onClick={(event) => event.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.includes(lead.id)} onChange={() => toggleSelection(lead.id)} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" aria-label={`Select ${lead.leadId}`} />
                      </td>
                      <td className="min-w-[20rem] px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarClasses[index % avatarClasses.length]}`}>
                            {getInitials(lead.name || lead.customerName || lead.mobileNumber)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#082445]">{lead.name || lead.customerName || 'New prospect'}</p>
                            <p className="mt-0.5 text-sm text-[#6f89b0]">{lead.leadId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5" onClick={(event) => event.stopPropagation()}>
                        <a href={`tel:${lead.mobileNumber}`} className="font-medium text-[#315987] hover:text-primary-700">
                          {lead.mobileNumber || '—'}
                        </a>
                        {lead.email && <p className="mt-0.5 max-w-48 truncate text-sm text-[#6f89b0]" title={lead.email}>{lead.email}</p>}
                      </td>
                      <td className="px-6 py-5">
                        <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
                          {lead.leadSource || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          {lead.assignedSalespersonName && (
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[0.65rem] font-semibold text-white">
                              {getInitials(lead.assignedSalespersonName)}
                            </span>
                          )}
                          <span className="max-w-28 text-[#315987]">{lead.assignedSalespersonName || 'Unassigned'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <Badge variant={statusVariant[lead.leadStatus] || 'neutral'}>{formatLeadStatus(lead.leadStatus)}</Badge>
                      </td>
                      <td className={`px-6 py-5 ${activity.nextFollowUp.tone === 'danger' ? 'font-medium text-red-600' : activity.nextFollowUp.tone === 'warning' ? 'font-medium text-amber-600' : 'text-[#315987]'}`}>
                        {activity.nextFollowUp.label}
                      </td>
                      <td className="px-6 py-5 text-[#315987]">{formatDate(lead.createdAt)}</td>
                      <td className="px-6 py-5 text-right" onClick={(event) => event.stopPropagation()}>
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-white px-5 py-4 text-xs text-[#6f89b0]">
          <div className="flex items-center gap-3">
            <span>
              Showing <span className="font-semibold text-[#082445]">{rangeStart}-{rangeEnd}</span> of{' '}
              <span className="font-semibold text-[#082445]">{filteredLeads.length}</span>
            </span>
            <span className="hidden text-neutral-300 sm:inline">|</span>
            <label className="flex items-center gap-2">
              Rows per page
              <Select
                options={[
                  { value: '10', label: '10' },
                  { value: '25', label: '25' },
                  { value: '50', label: '50' },
                ]}
                value={pageSize}
                onChange={(event) => { setPageSize(event.target.value); setPage(1) }}
                className="w-20"
                triggerClassName="h-8 bg-white py-1 text-xs"
              />
            </label>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-14 text-center font-medium text-[#082445]">{currentPage} / {totalPages}</span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </Card>

      {isFilterOpen && (
        <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Lead filters">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-neutral-950/20"
            onClick={() => setIsFilterOpen(false)}
            aria-label="Close filters"
          />
          <aside className="relative z-10 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Filter Leads</h2>
                <p className="mt-0.5 text-xs text-neutral-400">Refine the leads shown in the table.</p>
              </div>
              <button type="button" onClick={() => setIsFilterOpen(false)} className="flex size-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-50" aria-label="Close filters">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
                Status
                <Select
                  options={[{ value: 'all', label: 'All Statuses' }, ...LEAD_STATUS_OPTIONS]}
                  value={statusFilter}
                  onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
                Source
                <Select
                  options={[{ value: 'all', label: 'All Sources' }, ...LEAD_SOURCE_OPTIONS]}
                  value={sourceFilter}
                  onChange={(event) => { setSourceFilter(event.target.value); setPage(1) }}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
                Salesperson
                {isSalesOfficer ? (
                  <span className="flex h-10 items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm font-medium text-neutral-500">My Leads</span>
                ) : (
                  <Select
                    options={[{ value: 'all', label: 'All Salespersons' }, { value: 'unassigned', label: 'Unassigned' }, ...salespersonOptions]}
                    value={teamFilter}
                    onChange={(event) => { setTeamFilter(event.target.value); setPage(1) }}
                  />
                )}
              </label>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-4">
              <button
                type="button"
                onClick={() => { setStatusFilter('all'); setSourceFilter('all'); setTeamFilter('all'); setSearchTerm(''); setPage(1) }}
                className="text-sm font-medium text-neutral-500 hover:text-neutral-900"
              >
                Clear all
              </button>
              <Button type="button" onClick={() => setIsFilterOpen(false)}>Apply filters</Button>
            </div>
          </aside>
        </div>
      )}

      <LeadEditForm
        isOpen={Boolean(editingLead)}
        lead={editingLead}
        salespersonOptions={salespersonOptions}
        saving={isSaving}
        formError={formError}
        lockAssignee={isSalesOfficer}
        onClose={() => setEditingLead(null)}
        onSave={handleSaveLead}
      />

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
