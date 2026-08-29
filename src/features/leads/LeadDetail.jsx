import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRightCircle,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  StickyNote,
  Tag,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/toastContext'
import { ROLES } from '../../auth/roles'
import {
  LEAD_STATUS_OPTIONS,
  convertLeadToCustomer,
  deleteLead,
  getLead,
  updateLead,
} from '../../api/leads'
import { listCustomers } from '../../api/customers'
import { listUsers } from '../../api/users'
import { listVisits } from '../../api/visits'
import { normalizeApiUser } from '../users/userRoleUtils'
import { useAuthStore } from '../../store/authStore'
import { customerBasePathByRole } from '../customers/customerConstants'
import { LeadEditForm, ConvertLeadForm } from './LeadForms'

const statusVariant = {
  new: 'info',
  contacted: 'warning',
  qualified: 'purple',
  won: 'success',
  lost: 'danger',
}

const journeyStatuses = ['new', 'contacted', 'qualified', 'won']

const getInitials = (name = '') =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return `${new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)}, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

function daysSince(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const diffMs = Date.now() - date.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

function formatLabel(value = '') {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function StatTile({ icon: Icon, label, children }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-card)">
      <div className="flex items-center gap-2 text-neutral-400">
        <Icon className="size-3.5" aria-hidden="true" />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <div className="mt-2.5">{children}</div>
    </div>
  )
}

function Section({ title, icon: Icon, actions, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-card) ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
            <Icon className="size-4" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-neutral-900">{title}</p>
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-neutral-900" title={value || '—'}>{value || '—'}</p>
    </div>
  )
}

function TimelineItem({ icon: Icon, iconClass, title, subtitle, timestamp, isLast }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-neutral-100" />}
      </div>
      <div className={`min-w-0 flex-1 ${isLast ? '' : 'pb-5'}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-sm font-semibold text-neutral-900">{title}</p>
          <p className="text-xs text-neutral-400">{formatDateTime(timestamp)}</p>
        </div>
        {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
      </div>
    </div>
  )
}

function LeadJourneyNode({ index, label, state, isLast }) {
  const circleClass =
    state === 'lost'
      ? 'bg-red-50 text-red-600 ring-2 ring-red-500'
      : state === 'done'
        ? 'bg-primary-600 text-white'
        : state === 'current'
          ? 'bg-primary-50 text-primary-700 ring-2 ring-primary-500'
          : 'bg-neutral-100 text-neutral-400'

  return (
    <div className="flex flex-1 items-start gap-0">
      <div className="flex flex-col items-center">
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${circleClass}`}>
          {state === 'lost' ? <X className="size-4" /> : state === 'done' ? <Check className="size-4" /> : index}
        </div>
        <p className={`mt-2 max-w-24 text-center text-xs font-medium ${state === 'pending' ? 'text-neutral-400' : 'text-neutral-800'}`}>
          {label}
        </p>
        {state === 'current' && <p className="text-[0.65rem] font-medium text-primary-600">Current Stage</p>}
      </div>
      {!isLast && <div className={`mt-4 h-0.5 flex-1 ${state === 'done' || state === 'lost' ? 'bg-primary-500' : 'bg-neutral-100'}`} />}
    </div>
  )
}

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)
  const leadBasePath = currentUser?.role === ROLES.SALES_OFFICER ? '/sales/leads' : '/admin/leads'
  const customerBasePath = customerBasePathByRole[currentUser?.role] || '/sales/customers'

  const [lead, setLead] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [customers, setCustomers] = useState([])
  const [salespeople, setSalespeople] = useState([])

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [isConvertOpen, setIsConvertOpen] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [convertError, setConvertError] = useState('')

  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [isNoteOpen, setIsNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [noteError, setNoteError] = useState('')

  const [isStatusOpen, setIsStatusOpen] = useState(false)
  const [statusValue, setStatusValue] = useState('')
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [statusError, setStatusError] = useState('')

  const [visits, setVisits] = useState([])
  const [isLoadingVisits, setIsLoadingVisits] = useState(true)
  const [visitsError, setVisitsError] = useState('')

  const loadLead = async () => {
    setIsLoading(true)
    setLoadError('')

    const result = await getLead(id)

    if (!result.success) {
      setLoadError(result.error)
      setIsLoading(false)
      return
    }

    setLead(result.lead)
    setIsLoading(false)
  }

  useEffect(() => {
    loadLead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    let isMounted = true

    async function loadVisits() {
      setIsLoadingVisits(true)
      setVisitsError('')

      const result = await listVisits({ leadId: id })

      if (!isMounted) return

      if (!result.success) {
        setVisits([])
        setVisitsError(result.error)
        setIsLoadingVisits(false)
        return
      }

      setVisits(result.visits.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate)))
      setIsLoadingVisits(false)
    }

    loadVisits()
    return () => {
      isMounted = false
    }
  }, [id])

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
            ? [{ id: currentUser.id, name: currentUser.name || 'Current user', role: currentUser.role, isActive: true }]
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
  }, [currentUser?.id, currentUser?.name, currentUser?.role])

  const customerOptions = useMemo(
    () => customers.map((customer) => ({ value: customer.id, label: `${customer.name}${customer.phone ? ` • ${customer.phone}` : ''}` })),
    [customers],
  )
  const salespersonOptions = useMemo(
    () => salespeople.map((user) => ({ value: user.id, label: user.name })),
    [salespeople],
  )

  const daysOld = lead ? daysSince(lead.createdAt) : null
  const isConverted = Boolean(lead?.convertedCustomerId)

  const journeyState = useMemo(() => {
    if (!lead) return { index: 0, isLost: false }
    if (lead.leadStatus === 'lost') return { index: 3, isLost: true }
    const index = journeyStatuses.indexOf(lead.leadStatus)
    return { index: index === -1 ? 0 : index, isLost: false }
  }, [lead])

  const timelineEvents = useMemo(() => {
    if (!lead) return []
    const events = []

    events.push({
      id: 'created',
      icon: Sparkles,
      iconClass: 'bg-primary-50 text-primary-700',
      title: 'Lead Created',
      subtitle: 'Lead has been created' + (lead.leadSource ? ` via ${lead.leadSource}` : ''),
      timestamp: lead.createdAt,
    })

    if (lead.assignedSalespersonName) {
      events.push({
        id: 'assigned',
        icon: UserRound,
        iconClass: 'bg-blue-50 text-blue-600',
        title: `Assigned to ${lead.assignedSalespersonName}`,
        subtitle: 'Lead assigned for follow-up',
        timestamp: lead.createdAt,
      })
    }

    const meaningfullyUpdated =
      lead.updatedAt && lead.createdAt && new Date(lead.updatedAt).getTime() - new Date(lead.createdAt).getTime() > 60_000

    if (meaningfullyUpdated && lead.leadStatus !== 'new') {
      events.push({
        id: 'status',
        icon: RefreshCw,
        iconClass: 'bg-amber-50 text-amber-600',
        title: `Status updated to ${formatLabel(lead.leadStatus)}`,
        subtitle: 'Lead status was last changed here',
        timestamp: lead.updatedAt,
      })
    }

    if (lead.convertedAt) {
      events.push({
        id: 'converted',
        icon: ShoppingBag,
        iconClass: 'bg-green-50 text-green-600',
        title: 'Converted to Customer',
        subtitle: 'A customer record was created from this lead',
        timestamp: lead.convertedAt,
      })
    }

    return events.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
  }, [lead])

  const handleSaveLead = async (formData) => {
    setIsSaving(true)
    setFormError('')

    const result = await updateLead(id, formData)

    if (!result.success) {
      setFormError(result.error)
      setIsSaving(false)
      return
    }

    setLead(result.lead)
    setIsSaving(false)
    setIsEditOpen(false)
    showToast({ title: 'Lead updated', message: 'Changes have been saved.' })
  }

  const handleConvertLead = async (formData) => {
    setIsConverting(true)
    setConvertError('')

    const result = await convertLeadToCustomer(id, formData)

    if (!result.success) {
      setConvertError(result.error)
      setIsConverting(false)
      return
    }

    setIsConverting(false)
    setIsConvertOpen(false)
    await loadLead()
    navigate(`${customerBasePath}/${result.customerId}`)
  }

  const handleDeleteLead = async () => {
    setIsDeleting(true)
    setDeleteError('')

    const result = await deleteLead(id)

    if (!result.success) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }

    navigate(leadBasePath)
  }

  const openNoteModal = () => {
    setNoteText('')
    setNoteError('')
    setIsNoteOpen(true)
  }

  const handleSaveNote = async () => {
    if (!noteText.trim()) {
      setNoteError('Enter a note before saving.')
      return
    }

    setIsSavingNote(true)
    setNoteError('')

    const stamp = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date())
    const nextNotes = [`[${stamp}] ${noteText.trim()}`, lead.notes].filter(Boolean).join('\n\n')

    const result = await updateLead(id, { ...lead, notes: nextNotes })

    if (!result.success) {
      setNoteError(result.error)
      setIsSavingNote(false)
      return
    }

    setLead(result.lead)
    setIsSavingNote(false)
    setIsNoteOpen(false)
    showToast({ title: 'Note added', message: 'Your note has been saved to this lead.' })
  }

  const openStatusModal = () => {
    setStatusValue(lead.leadStatus)
    setStatusError('')
    setIsStatusOpen(true)
  }

  const handleSaveStatus = async () => {
    setIsSavingStatus(true)
    setStatusError('')

    const result = await updateLead(id, { ...lead, leadStatus: statusValue })

    if (!result.success) {
      setStatusError(result.error)
      setIsSavingStatus(false)
      return
    }

    setLead(result.lead)
    setIsSavingStatus(false)
    setIsStatusOpen(false)
    showToast({ title: 'Status updated', message: `Lead status set to ${formatLabel(statusValue)}.` })
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-neutral-100 bg-white">
        <LoadingSpinner label="Loading lead..." />
      </div>
    )
  }

  if (loadError || !lead) {
    return (
      <div className="rounded-2xl border border-neutral-100 bg-white py-16 text-center">
        <p className="text-sm text-red-600">{loadError || 'Lead not found.'}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => navigate(leadBasePath)}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Leads
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-10">
      <button
        type="button"
        onClick={() => navigate(leadBasePath)}
        className="flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-primary-700"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to Leads
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-(--font-display) text-2xl font-semibold tracking-tight text-neutral-900">
              {lead.name || lead.customerName || 'New prospect'}
            </h1>
            <Badge variant={statusVariant[lead.leadStatus] || 'neutral'}>{formatLabel(lead.leadStatus)}</Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-500">Lead ID: {lead.leadId}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setFormError(''); setIsEditOpen(true) }}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit Lead
          </Button>
          {isConverted ? (
            <Button variant="outline" size="sm" onClick={() => navigate(`${customerBasePath}/${lead.convertedCustomerId}`)}>
              <ArrowRightCircle className="size-4" aria-hidden="true" />
              View Customer
            </Button>
          ) : (
            <Button size="sm" onClick={() => { setConvertError(''); setIsConvertOpen(true) }}>
              <ArrowRightCircle className="size-4" aria-hidden="true" />
              Convert to Customer
            </Button>
          )}
          <ActionMenu
            items={[
              { label: 'Update Status', icon: RefreshCw, onClick: openStatusModal },
              { label: 'Delete Lead', icon: Trash2, danger: true, onClick: () => { setDeleteError(''); setIsDeleteOpen(true) } },
            ]}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <div className="flex items-start gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary-50 text-lg font-semibold text-primary-700 ring-1 ring-primary-100">
              {getInitials(lead.name || lead.customerName || lead.mobileNumber)}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-neutral-900">{lead.name || lead.customerName || 'New prospect'}</p>
              <p className="text-sm text-neutral-500">Contact Person</p>
              <p className="text-sm font-medium text-neutral-700">{lead.contactPerson || '—'}</p>
              <div className="mt-2 space-y-1 text-sm text-neutral-600">
                {lead.mobileNumber && (
                  <a href={`tel:${lead.mobileNumber}`} className="flex items-center gap-1.5 hover:text-primary-700">
                    <Phone className="size-3.5 text-neutral-400" aria-hidden="true" />
                    {lead.mobileNumber}
                  </a>
                )}
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 hover:text-primary-700">
                    <Mail className="size-3.5 text-neutral-400" aria-hidden="true" />
                    {lead.email}
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-x-6 gap-y-4 border-t border-neutral-100 pt-5 sm:grid-cols-2 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
            <Field label="Lead Source" value={lead.leadSource} />
            <Field label="Assigned Sales Officer" value={lead.assignedSalespersonName} />
            <Field label="Interested Product" value={lead.interestedProduct} />
            <Field label="Created On" value={formatDateTime(lead.createdAt)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={Tag} label="Lead Status">
          <Badge variant={statusVariant[lead.leadStatus] || 'neutral'}>{formatLabel(lead.leadStatus)}</Badge>
        </StatTile>
        <StatTile icon={Clock} label="Days Since Created">
          <p className="text-lg font-semibold text-neutral-900">{daysOld === null ? '—' : daysOld === 0 ? 'Today' : `${daysOld} day${daysOld === 1 ? '' : 's'}`}</p>
        </StatTile>
        <StatTile icon={UserRound} label="Assigned To">
          <p className="truncate text-sm font-semibold text-neutral-900">{lead.assignedSalespersonName || 'Unassigned'}</p>
        </StatTile>
        <StatTile icon={Sparkles} label="Lead Source">
          <p className="truncate text-sm font-semibold text-neutral-900">{lead.leadSource || '—'}</p>
        </StatTile>
        <StatTile icon={ShoppingBag} label="Interested Product">
          <p className="truncate text-sm font-semibold text-neutral-900">{lead.interestedProduct || '—'}</p>
        </StatTile>
        <StatTile icon={CheckCircle2} label="Conversion Status">
          <Badge variant={isConverted ? 'success' : 'neutral'}>{isConverted ? 'Converted' : 'Not Converted'}</Badge>
        </StatTile>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Section title="Contact Information" icon={UserRound}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" value={lead.name || lead.customerName} />
              <Field label="Mobile Number" value={lead.mobileNumber} />
              <Field label="Contact Person" value={lead.contactPerson} />
              <Field label="Email" value={lead.email} />
            </div>
          </Section>

          <Section title="Lead Information" icon={Tag}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Lead Source" value={lead.leadSource} />
              <Field label="Assigned Sales Officer" value={lead.assignedSalespersonName} />
              <div>
                <p className="text-xs text-neutral-400">Lead Status</p>
                <div className="mt-1">
                  <Badge variant={statusVariant[lead.leadStatus] || 'neutral'}>{formatLabel(lead.leadStatus)}</Badge>
                </div>
              </div>
              <Field label="Interested Product" value={lead.interestedProduct} />
            </div>
          </Section>

          <Section
            title="Notes / Requirements"
            icon={StickyNote}
            actions={
              <Button type="button" variant="outline" size="sm" onClick={openNoteModal}>
                <Plus className="size-4" aria-hidden="true" />
                Add Note
              </Button>
            }
          >
            <div className="min-h-20 whitespace-pre-line rounded-xl border border-neutral-100 bg-neutral-50/60 p-3 text-sm text-neutral-700">
              {lead.notes || '—'}
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Conversion" icon={ArrowRightCircle}>
            {isConverted ? (
              <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-green-900">This lead has been converted.</p>
                    <p className="mt-1 text-xs text-green-700">Converted on {formatDate(lead.convertedAt)}</p>
                  </div>
                </div>
                <Button className="mt-4 w-full" size="sm" onClick={() => navigate(`${customerBasePath}/${lead.convertedCustomerId}`)}>
                  <ArrowRightCircle className="size-4" aria-hidden="true" />
                  View Customer
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                <div className="flex items-start gap-2.5">
                  <UserPlus className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">This lead is not converted yet.</p>
                    <p className="mt-1 text-xs text-amber-700">Convert this lead to a customer to start doing business.</p>
                  </div>
                </div>
                <Button className="mt-4 w-full" size="sm" onClick={() => { setConvertError(''); setIsConvertOpen(true) }}>
                  <ArrowRightCircle className="size-4" aria-hidden="true" />
                  Convert to Customer
                </Button>
              </div>
            )}
          </Section>

          <Section title="Activity Timeline" icon={Clock}>
            {timelineEvents.length === 0 ? (
              <p className="text-sm text-neutral-400">No activity recorded yet.</p>
            ) : (
              <div>
                {timelineEvents.map((event, index) => (
                  <TimelineItem key={event.id} {...event} isLast={index === timelineEvents.length - 1} />
                ))}
              </div>
            )}
          </Section>

          <Section title="Quick Actions" icon={Sparkles}>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={lead.mobileNumber ? `tel:${lead.mobileNumber}` : undefined}
                aria-disabled={!lead.mobileNumber}
                className={`flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-700 transition-colors ${lead.mobileNumber ? 'hover:border-primary-300 hover:bg-primary-50/60 hover:text-primary-700' : 'pointer-events-none opacity-50'}`}
              >
                <Phone className="size-4" aria-hidden="true" />
                Call
              </a>
              <a
                href={lead.email ? `mailto:${lead.email}` : undefined}
                aria-disabled={!lead.email}
                className={`flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-700 transition-colors ${lead.email ? 'hover:border-primary-300 hover:bg-primary-50/60 hover:text-primary-700' : 'pointer-events-none opacity-50'}`}
              >
                <Mail className="size-4" aria-hidden="true" />
                Email
              </a>
              <button
                type="button"
                onClick={openNoteModal}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-primary-300 hover:bg-primary-50/60 hover:text-primary-700"
              >
                <StickyNote className="size-4" aria-hidden="true" />
                Add Note
              </button>
              <button
                type="button"
                onClick={openStatusModal}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-primary-300 hover:bg-primary-50/60 hover:text-primary-700"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Update Status
              </button>
            </div>
          </Section>
        </div>
      </div>

      <Section title="Lead Journey" icon={Calendar}>
        <div className="flex items-start px-1">
          <LeadJourneyNode index={1} label="New" state={journeyState.index > 0 ? 'done' : journeyState.index === 0 ? 'current' : 'pending'} />
          <LeadJourneyNode index={2} label="Contacted" state={journeyState.index > 1 ? 'done' : journeyState.index === 1 ? 'current' : 'pending'} />
          <LeadJourneyNode index={3} label="Qualified" state={journeyState.index > 2 ? 'done' : journeyState.index === 2 ? 'current' : 'pending'} />
          <LeadJourneyNode
            index={4}
            label={journeyState.isLost ? 'Lost' : 'Won'}
            state={journeyState.isLost ? 'lost' : journeyState.index >= 3 ? 'done' : journeyState.index === 2 ? 'pending' : 'pending'}
            isLast
          />
        </div>
      </Section>

      <Section title="Visits & Follow-ups" icon={MapPin}>
        {visitsError ? (
          <div className="py-6 text-center">
            <p className="text-sm text-red-600">{visitsError}</p>
          </div>
        ) : isLoadingVisits ? (
          <LoadingSpinner label="Loading visits..." />
        ) : visits.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-400">No visits recorded for this lead yet.</p>
        ) : (
          <div className="space-y-3">
            {visits.map((visit) => (
              <div key={visit.id} className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                      <Calendar className="size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                      {formatDateTime(visit.visitDate)}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {formatLabel(visit.visitType)}
                      {visit.purpose ? ` · ${visit.purpose}` : ''}
                    </p>
                  </div>
                  <Badge
                    variant={visit.status === 'completed' ? 'success' : visit.status === 'cancelled' ? 'neutral' : 'info'}
                  >
                    {formatLabel(visit.status)}
                  </Badge>
                </div>

                {visit.notes && (
                  <p className="mt-3 whitespace-pre-line border-t border-neutral-100 pt-3 text-sm text-neutral-700">{visit.notes}</p>
                )}
                {visit.outcome && (
                  <p className="mt-2 text-sm text-neutral-600">
                    <span className="font-medium text-neutral-800">Outcome:</span> {visit.outcome}
                  </p>
                )}

                {visit.followUps.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
                    {visit.followUps.map((task) => (
                      <div key={task.id} className="flex items-start gap-2.5 rounded-lg bg-white p-2.5 shadow-(--shadow-xs)">
                        <ClipboardList className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-neutral-900">{task.title}</p>
                            <Badge variant={task.status === 'completed' ? 'success' : 'warning'}>
                              {formatLabel(task.status)}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            Due {formatDateTime(task.dueDate)}
                            {task.assignedToName ? ` · ${task.assignedToName}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Lead" className="max-w-2xl">
        <LeadEditForm
          lead={lead}
          customerOptions={customerOptions}
          salespersonOptions={salespersonOptions}
          saving={isSaving}
          formError={formError}
          onClose={() => setIsEditOpen(false)}
          onSave={handleSaveLead}
        />
      </Modal>

      <Modal isOpen={isConvertOpen} onClose={() => { if (!isConverting) setIsConvertOpen(false) }} title="Convert to Customer" className="max-w-2xl">
        <ConvertLeadForm
          lead={lead}
          salespersonOptions={salespersonOptions}
          saving={isConverting}
          formError={convertError}
          onClose={() => setIsConvertOpen(false)}
          onSave={handleConvertLead}
        />
      </Modal>

      <Modal
        isOpen={isDeleteOpen}
        onClose={() => { if (!isDeleting) { setDeleteError(''); setIsDeleteOpen(false) } }}
        title="Delete Lead"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete {lead.name || lead.leadId} from the lead list? This cannot be undone.
          </p>
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isDeleting} onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDeleteLead}>Delete</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isNoteOpen} onClose={() => { if (!isSavingNote) setIsNoteOpen(false) }} title="Add Note">
        <div className="space-y-4">
          <Input
            as="textarea"
            label="Note"
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Add a follow-up note or requirement..."
            inputClassName="min-h-24"
            error={noteError}
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isSavingNote} onClick={() => setIsNoteOpen(false)}>Cancel</Button>
            <Button type="button" loading={isSavingNote} onClick={handleSaveNote}>Save Note</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isStatusOpen} onClose={() => { if (!isSavingStatus) setIsStatusOpen(false) }} title="Update Lead Status">
        <div className="space-y-4">
          <Select
            label="Lead Status"
            options={LEAD_STATUS_OPTIONS}
            value={statusValue}
            onChange={(event) => setStatusValue(event.target.value)}
            error={statusError}
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isSavingStatus} onClick={() => setIsStatusOpen(false)}>Cancel</Button>
            <Button type="button" loading={isSavingStatus} onClick={handleSaveStatus}>Save Status</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
