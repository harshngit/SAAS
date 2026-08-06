import { useMemo, useRef, useState } from 'react'
import { Download, Edit, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { ROLES } from '../../auth/roles'
import { leads as seedLeads } from '../../mockData/leads'
import { products as seedProducts } from '../../mockData/products'
import { users as seedUsers } from '../../mockData/users'
import { formatCurrency } from '../../utils/format'
import { readStoredLeads } from './leadStorage'

const leadSourceOptions = [
  { value: 'Website', label: 'Website' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Walk-in', label: 'Walk-in' },
  { value: 'Phone Call', label: 'Phone Call' },
  { value: 'Campaign', label: 'Campaign' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'Data Calling', label: 'Data Calling' },
]

const leadStatusOptions = [
  { value: 'New', label: 'New' },
  { value: 'Interested', label: 'Interested' },
  { value: 'Qualified', label: 'Qualified' },
  { value: 'Follow-up', label: 'Follow-up' },
  { value: 'Warm', label: 'Warm' },
  { value: 'Cold', label: 'Cold' },
  { value: 'Proposal', label: 'Proposal' },
  { value: 'Won', label: 'Won' },
  { value: 'Lost', label: 'Lost' },
]

const statusVariant = {
  New: 'info',
  Interested: 'purple',
  Qualified: 'success',
  'Follow-up': 'warning',
  Warm: 'warning',
  Cold: 'info',
  Proposal: 'neutral',
  Won: 'success',
  Lost: 'danger',
}

const avatarClasses = [
  'bg-blue-500 text-white',
  'bg-rose-500 text-white',
  'bg-violet-500 text-white',
  'bg-primary-600 text-white',
  'bg-cyan-500 text-white',
]

const emptyLead = {
  id: '',
  source: '',
  customer: '',
  contactPerson: '',
  mobile: '',
  email: '',
  interestedProducts: [],
  expectedBudget: '',
  expectedClosingDate: '',
  assignedSalesperson: '',
  status: 'New',
  notes: '',
}

const getInitials = (name = '') =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

function nextLeadId(leads) {
  const nextNumber = leads.reduce((highest, lead) => {
    const number = Number(String(lead.id || '').replace(/\D/g, ''))
    return Number.isFinite(number) ? Math.max(highest, number) : highest
  }, 1000) + 1

  return `LEAD-${nextNumber}`
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function LeadForm({ isOpen, onClose, lead, onSave, productOptions, salespersonOptions, leadId }) {
  const [formData, setFormData] = useState(() => ({
    ...emptyLead,
    id: lead?.id || leadId,
    ...lead,
  }))
  const [errors, setErrors] = useState({})

  const updateField = (field) => (event) => {
    setFormData((current) => ({ ...current, [field]: event.target.value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const toggleProduct = (productName) => {
    setFormData((current) => ({
      ...current,
      interestedProducts: current.interestedProducts.includes(productName)
        ? current.interestedProducts.filter((name) => name !== productName)
        : [...current.interestedProducts, productName],
    }))
  }

  const validate = () => {
    const nextErrors = {}

    if (!formData.source) nextErrors.source = 'Lead source is required.'
    if (!formData.customer.trim()) nextErrors.customer = 'Customer is required.'
    if (!formData.mobile.trim()) nextErrors.mobile = 'Mobile number is required.'
    if (formData.mobile.trim() && !/^[0-9+\-\s()]{7,16}$/.test(formData.mobile.trim())) {
      nextErrors.mobile = 'Enter a valid mobile number.'
    }
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      nextErrors.email = 'Enter a valid email address.'
    }
    if (!formData.assignedSalesperson) nextErrors.assignedSalesperson = 'Assigned salesperson is required.'
    if (!formData.status) nextErrors.status = 'Lead status is required.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validate()) return

    onSave({
      ...formData,
      customer: formData.customer.trim(),
      contactPerson: formData.contactPerson.trim(),
      mobile: formData.mobile.trim(),
      email: formData.email.trim(),
      expectedBudget: Number(formData.expectedBudget) || 0,
      createdAt: formData.createdAt || new Date().toISOString().slice(0, 10),
      notes: formData.notes.trim(),
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={lead ? 'Edit Lead' : 'Add Lead'} className="max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Lead ID" value={formData.id} disabled />
          <Select label="Lead Source" required options={leadSourceOptions} value={formData.source} onChange={updateField('source')} placeholder="Select source" error={errors.source} />
          <Input label="Customer" required value={formData.customer} onChange={updateField('customer')} placeholder="Search or create customer" error={errors.customer} />
          <Input label="Contact Person" value={formData.contactPerson} onChange={updateField('contactPerson')} placeholder="Primary contact person" />
          <Input label="Mobile Number" required value={formData.mobile} onChange={updateField('mobile')} placeholder="Contact mobile number" error={errors.mobile} />
          <Input label="Email Address" type="email" value={formData.email} onChange={updateField('email')} placeholder="Contact email address" error={errors.email} />
          <Input label="Expected Budget" type="number" min="0" value={formData.expectedBudget} onChange={updateField('expectedBudget')} placeholder="Estimated customer budget" />
          <Input label="Expected Closing Date" type="date" value={formData.expectedClosingDate} onChange={updateField('expectedClosingDate')} />
          <Select label="Assigned Salesperson" required options={salespersonOptions} value={formData.assignedSalesperson} onChange={updateField('assignedSalesperson')} placeholder="Select salesperson" error={errors.assignedSalesperson} />
          <Select label="Lead Status" required options={leadStatusOptions} value={formData.status} onChange={updateField('status')} placeholder="Select status" error={errors.status} />
        </div>

        <div>
          <p className="text-sm font-medium text-neutral-700">Interested Products</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {productOptions.map((product) => (
              <label key={product} className="flex items-center gap-2 rounded-xl border border-neutral-100 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-700">
                <input type="checkbox" checked={formData.interestedProducts.includes(product)} onChange={() => toggleProduct(product)} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
                <span className="min-w-0 truncate">{product}</span>
              </label>
            ))}
          </div>
        </div>

        <Input as="textarea" label="Notes" value={formData.notes} onChange={updateField('notes')} placeholder="Additional lead remarks" />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">{lead ? 'Save Lead' : 'Add Lead'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function LeadList() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState(() => [...readStoredLeads(), ...seedLeads])
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [pageSize, setPageSize] = useState('10')
  const [selectedIds, setSelectedIds] = useState([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingLead, setEditingLead] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const fileInputRef = useRef(null)
  const leadBasePath = window.location.pathname.startsWith('/sales') ? '/sales/leads' : '/admin/leads'

  const productOptions = useMemo(() => seedProducts.map((product) => product.fullName || product.name), [])

  const salespersonOptions = useMemo(() => {
    const names = new Set([
      ...seedUsers.filter((user) => user.role === ROLES.SALES_OFFICER).map((user) => user.name),
      ...leads.map((lead) => lead.assignedSalesperson).filter(Boolean),
    ])

    return Array.from(names).map((name) => ({ value: name, label: name }))
  }, [leads])

  const filteredLeads = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const normalizedProject = projectFilter.trim().toLowerCase()

    return leads.filter((lead) => {
      const matchesSearch =
        !normalizedSearch ||
        [lead.id, lead.customer, lead.contactPerson, lead.mobile, lead.email]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter
      const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter
      const matchesTeam = teamFilter === 'all' || lead.assignedSalesperson === teamFilter
      const matchesProject =
        !normalizedProject ||
        lead.interestedProducts.some((product) => product.toLowerCase().includes(normalizedProject))

      return matchesSearch && matchesStatus && matchesSource && matchesTeam && matchesProject
    })
  }, [leads, projectFilter, searchTerm, sourceFilter, statusFilter, teamFilter])

  const visibleLeads = filteredLeads.slice(0, Number(pageSize))
  const allVisibleSelected = visibleLeads.length > 0 && visibleLeads.every((lead) => selectedIds.includes(lead.id))

  const handleOpenForm = (lead = null) => {
    setEditingLead(lead)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingLead(null)
  }

  const handleSaveLead = (leadData) => {
    if (editingLead) {
      setLeads((current) => current.map((lead) => (lead.id === editingLead.id ? { ...lead, ...leadData } : lead)))
    } else {
      setLeads((current) => [{ ...leadData, id: nextLeadId(current) }, ...current])
    }

    handleCloseForm()
  }

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
    setProjectFilter('')
    setSelectedIds([])
  }

  const exportCsv = () => {
    const rows = [
      ['Lead ID', 'Customer', 'Mobile', 'Source', 'Assigned', 'Status', 'Products', 'Budget', 'Expected Closing Date', 'Created'],
      ...filteredLeads.map((lead) => [
        lead.id,
        lead.customer,
        lead.mobile,
        lead.source,
        lead.assignedSalesperson,
        lead.status,
        lead.interestedProducts.join('; '),
        lead.expectedBudget,
        lead.expectedClosingDate,
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

  const handleDeleteLead = () => {
    setLeads((current) => current.filter((lead) => lead.id !== deleteTarget?.id))
    setSelectedIds((current) => current.filter((id) => id !== deleteTarget?.id))
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-4">
      <Card className="p-0">
        <div className="relative border-b border-neutral-100 px-5 py-3">
          <div className="flex  gap-4">
            <div className="grid grid-cols-2 gap-2 w-full">
             <div>
               {/* Search first row */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center py-1">
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
                <Select className="sm:w-40" options={[{ value: 'all', label: 'All Status' }, ...leadStatusOptions]} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} triggerClassName="h-9 bg-white py-1.5" />
                <Select className="sm:w-40" options={[{ value: 'all', label: 'All Sources' }, ...leadSourceOptions]} value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} triggerClassName="h-9 bg-white py-1.5" />
              </div>
              {/* Search two row */}
              <div className="flex flex-wrap items-center gap-2 py-1">
                <Select className="sm:w-40" options={[{ value: 'all', label: 'All Team' }, ...salespersonOptions]} value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} triggerClassName="h-9 bg-white py-1.5" />
                <div className="relative w-full sm:w-72">
                  <input
                    type="search"
                    value={projectFilter}
                    onChange={(event) => setProjectFilter(event.target.value)}
                    placeholder="Filter by product..."
                    className="h-9 w-full rounded-xl border border-neutral-100 bg-white py-1.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                  />
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-300" />
                </div>
                <button type="button" onClick={resetFilters} className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-neutral-100 bg-white text-neutral-500 shadow-(--shadow-xs) transition-colors hover:text-primary-700" aria-label="Reset filters">
                  <RefreshCw className="size-4" />
                </button>
              </div>
              {/* Shearch Thrid */}
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
               <div className="flex w-full flex-wrap items-center justify-end gap-2 md:absolute md:right-5 md:top-[4.7rem] md:w-auto md:min-w-fit">
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={resetFilters}>
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Manage
              </Button>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" />
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-4" aria-hidden="true" />
                Bulk Upload
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
        </div>

        <div className="overflow-x-auto bg-white">
          <table className="w-full min-w-[1040px] text-left text-sm">
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
                <th className="whitespace-nowrap px-4 py-3">Product</th>
                <th className="whitespace-nowrap px-4 py-3">Closing Date</th>
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
                visibleLeads.map((lead, index) => (
                  <tr key={lead.id} className="transition-colors hover:bg-primary-50/30">
                    <td className="px-4 py-4 align-middle">
                      <input type="checkbox" checked={selectedIds.includes(lead.id)} onChange={() => toggleSelection(lead.id)} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" aria-label={`Select ${lead.customer}`} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarClasses[index % avatarClasses.length]}`}>
                          {getInitials(lead.customer)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-900">{lead.customer}</p>
                          <p className="mt-0.5 text-xs text-neutral-400">
                            {lead.id} {lead.expectedBudget ? `- ${formatCurrency(lead.expectedBudget)}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <a href={`tel:${lead.mobile}`} className="font-semibold text-primary-600 hover:text-primary-700">
                        {lead.mobile}
                      </a>
                      {lead.email && <p className="mt-0.5 text-xs text-neutral-400">{lead.email}</p>}
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
                        {lead.source}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[0.65rem] font-semibold text-white">
                          {getInitials(lead.assignedSalesperson)}
                        </span>
                        <span className="max-w-28 text-neutral-600">{lead.assignedSalesperson}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={statusVariant[lead.status] || 'neutral'}>{lead.status}</Badge>
                    </td>
                    <td className="max-w-44 px-4 py-4 text-neutral-500">
                      <span className="line-clamp-2">{lead.interestedProducts.join(', ') || '-'}</span>
                    </td>
                    <td className="px-4 py-4 text-neutral-500">{formatDate(lead.expectedClosingDate)}</td>
                    <td className="px-4 py-4 text-neutral-500">{formatDate(lead.createdAt)}</td>
                    <td className="px-4 py-4 text-right">
                      <ActionMenu
                        items={[
                          { label: 'Edit', icon: Edit, onClick: () => handleOpenForm(lead) },
                          { label: 'Delete', icon: Trash2, danger: true, onClick: () => setDeleteTarget(lead) },
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {isFormOpen && (
        <LeadForm
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          lead={editingLead}
          onSave={handleSaveLead}
          productOptions={productOptions}
          salespersonOptions={salespersonOptions}
          leadId={nextLeadId(leads)}
        />
      )}

      <Modal isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete Lead">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete {deleteTarget?.customer || 'this lead'} from the lead list?
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="danger" onClick={handleDeleteLead}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
