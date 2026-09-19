import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Download, Eye, Pencil, Plus, RotateCw, Search, SlidersHorizontal, Target, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { deleteQuotation, listQuotations } from '../../api/quotations'
import { formatCurrency } from '../../utils/format'
import {
  QUOTATION_FILTER_STATUS_OPTIONS,
  QUOTATION_STATUS_VARIANT,
  deriveQuotationStatus,
  formatQuotationStatus,
  getQuotationActions,
} from './quotationHelpers'
import { DEMO_QUOTATIONS_ENABLED, demoQuotationsResolved, isDemoQuotation } from './quotationDemoData'

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export default function QuotationList() {
  const navigate = useNavigate()
  const isSalesOfficer = window.location.pathname.startsWith('/sales')
  const basePath = isSalesOfficer ? '/sales/quotations' : '/admin/quotations'
  const [quotations, setQuotations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [salespersonFilter, setSalespersonFilter] = useState('all')
  const [pageSize, setPageSize] = useState('10')
  const [page, setPage] = useState(1)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadQuotations = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const result = await listQuotations()
    // Demo rows (UI testing only) are appended locally - never sent to the backend,
    // and still shown even if the real list call fails.
    const demoRows = DEMO_QUOTATIONS_ENABLED ? demoQuotationsResolved() : []

    if (!result.success) {
      setQuotations(demoRows)
      setListError(demoRows.length ? '' : result.error)
      setIsLoading(false)
      return
    }

    setQuotations([...result.quotations, ...demoRows])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadQuotations()
  }, [loadQuotations])

  const salespersonOptions = useMemo(() => {
    const names = Array.from(new Set(quotations.map((q) => q.salespersonName).filter(Boolean))).sort()
    return [{ value: 'all', label: 'All Salespersons' }, ...names.map((name) => ({ value: name, label: name }))]
  }, [quotations])

  const filteredQuotations = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()

    return quotations.filter((quotation) => {
      const matchesSearch =
        !search ||
        [quotation.quotationNumber, quotation.customerName, quotation.leadName, quotation.salespersonName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search))
      const matchesStatus = statusFilter === 'all' || deriveQuotationStatus(quotation) === statusFilter
      const matchesSalesperson = salespersonFilter === 'all' || quotation.salespersonName === salespersonFilter

      return matchesSearch && matchesStatus && matchesSalesperson
    })
  }, [quotations, searchTerm, statusFilter, salespersonFilter])

  const quotationSummary = useMemo(() => ({
    total: filteredQuotations.length,
    sent: filteredQuotations.filter((quotation) => deriveQuotationStatus(quotation) === 'sent').length,
    accepted: filteredQuotations.filter((quotation) => deriveQuotationStatus(quotation) === 'accepted').length,
    value: filteredQuotations.reduce((sum, quotation) => sum + Number(quotation.total || 0), 0),
  }), [filteredQuotations])

  const totalPages = Math.max(1, Math.ceil(filteredQuotations.length / Number(pageSize)))
  const currentPage = Math.min(page, totalPages)
  const visibleQuotations = filteredQuotations.slice((currentPage - 1) * Number(pageSize), currentPage * Number(pageSize))
  const rangeStart = filteredQuotations.length === 0 ? 0 : (currentPage - 1) * Number(pageSize) + 1
  const rangeEnd = Math.min(filteredQuotations.length, currentPage * Number(pageSize))
  const allVisibleSelected = visibleQuotations.length > 0 && visibleQuotations.every((quotation) => selectedIds.includes(quotation.id))

  const toggleAllVisible = () => {
    setSelectedIds((current) => allVisibleSelected
      ? current.filter((id) => !visibleQuotations.some((quotation) => quotation.id === id))
      : [...new Set([...current, ...visibleQuotations.map((quotation) => quotation.id)])])
  }

  const exportQuotationsCsv = (onlySelected = false) => {
    const quotationsToExport = onlySelected ? filteredQuotations.filter((quotation) => selectedIds.includes(quotation.id)) : filteredQuotations
    const rows = [
      ['Quotation', 'Customer / Prospect', 'Salesperson', 'Date', 'Valid Until', 'Amount', 'Status'],
      ...quotationsToExport.map((quotation) => [quotation.quotationNumber, quotation.customerName || quotation.leadName || '', quotation.salespersonName || '', formatDate(quotation.quotationDate), formatDate(quotation.validUntil), formatCurrency(quotation.total), formatQuotationStatus(deriveQuotationStatus(quotation))]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'quotations.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const dropQuotation = (id) => setQuotations((current) => current.filter((quotation) => quotation.id !== id))

  const handleDeleteQuotation = async () => {
    if (!deleteTarget) return

    // Demo rows are local-only.
    if (isDemoQuotation(deleteTarget.id)) {
      dropQuotation(deleteTarget.id)
      setDeleteTarget(null)
      return
    }

    setIsDeleting(true)
    setDeleteError('')

    const result = await deleteQuotation(deleteTarget.id)

    if (!result.success) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }

    dropQuotation(deleteTarget.id)
    setSelectedIds((current) => current.filter((id) => id !== deleteTarget.id))
    setIsDeleting(false)
    setDeleteTarget(null)
  }

  const handleBulkDelete = async () => {
    if (!selectedIds.length || !window.confirm(`Delete ${selectedIds.length} selected quotation${selectedIds.length === 1 ? '' : 's'}?`)) return

    setIsDeleting(true)
    const selectedQuotations = quotations.filter((quotation) => selectedIds.includes(quotation.id))
    const results = await Promise.all(selectedQuotations.map((quotation) => isDemoQuotation(quotation.id) ? Promise.resolve({ success: true }) : deleteQuotation(quotation.id)))
    const failed = results.find((result) => !result.success)

    if (failed) {
      setDeleteError(failed.error || 'Some quotations could not be deleted.')
      setIsDeleting(false)
      return
    }

    setQuotations((current) => current.filter((quotation) => !selectedIds.includes(quotation.id)))
    setSelectedIds([])
    setIsDeleting(false)
  }

  return (
    <div className="listing-page space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-5 py-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><h1 className="text-xl font-semibold tracking-tight text-neutral-900">Quotations</h1><p className="mt-1 text-xs text-neutral-400">{filteredQuotations.length} quotations in view</p></div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="relative w-full sm:w-60"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" /><input type="search" value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setPage(1) }} placeholder="Search quotations..." className="h-9 w-full rounded-xl border border-neutral-100 bg-white py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12" /></div>
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => setIsFilterOpen(true)}><SlidersHorizontal className="size-4" aria-hidden="true" />Filter</Button>
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => exportQuotationsCsv()}><Download className="size-4" aria-hidden="true" />Export</Button>
                <Button type="button" size="sm" className="h-9 rounded-2xl px-3.5" onClick={() => navigate(`${basePath}/new`)}><Plus className="size-4" aria-hidden="true" />New Quotation</Button>
              </div>
            </div>
          </div>
          <div className="-mx-5 -mb-5 mt-5 grid grid-cols-2 border-t border-neutral-100 lg:grid-cols-4">
            {[
              { label: 'Total Quotations', value: quotationSummary.total, detail: 'all quotations', icon: Copy },
              { label: 'Sent', value: quotationSummary.sent, detail: 'awaiting response', icon: Eye },
              { label: 'Accepted', value: quotationSummary.accepted, detail: 'converted quotations', icon: Target },
              { label: 'Quotation Value', value: formatCurrency(quotationSummary.value), detail: 'current total', icon: Pencil },
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

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3"><p className="text-sm font-medium text-primary-900">{selectedIds.length} quotation{selectedIds.length === 1 ? '' : 's'} selected</p><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" className="h-8 rounded-lg bg-white px-3" onClick={() => exportQuotationsCsv(true)}><Download className="size-4" aria-hidden="true" />Download</Button><Button type="button" variant="danger" size="sm" className="h-8 rounded-lg px-3" loading={isDeleting} onClick={handleBulkDelete}><Trash2 className="size-4" aria-hidden="true" />Delete</Button></div></div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto bg-white px-0 py-0">
          {listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadQuotations}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <LoadingSpinner label="Loading quotations..." />
          ) : filteredQuotations.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-neutral-900">No quotations found</p>
              <p className="mt-1 text-sm text-neutral-500">Create a quotation estimate for a customer.</p>
              <Button type="button" className="mt-4" onClick={() => navigate(`${basePath}/new`)}>
                <Plus className="size-4" aria-hidden="true" />
                New Quotation
              </Button>
            </div>
          ) : (
            <table className="listing-table w-full min-w-[72rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[#e3e9f3] bg-[#f8faff] text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#a0b0cf]">
                  <th className="w-14 px-6 py-6"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" aria-label="Select all quotations" /></th>
                  <th className="whitespace-nowrap px-6 py-6">Quotation</th>
                  <th className="whitespace-nowrap px-6 py-6">Customer / Prospect</th>
                  <th className="whitespace-nowrap px-6 py-6">Salesperson</th>
                  <th className="whitespace-nowrap px-6 py-6">Date</th>
                  <th className="whitespace-nowrap px-6 py-6">Valid Until</th>
                  <th className="whitespace-nowrap px-6 py-6">Amount</th>
                  <th className="whitespace-nowrap px-6 py-6">Status</th>
                  <th className="whitespace-nowrap px-6 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleQuotations.map((quotation) => {
                  const displayStatus = deriveQuotationStatus(quotation)
                  const actions = getQuotationActions(quotation)
                  return (
                  <tr
                    key={quotation.id}
                    onClick={() => navigate(`${basePath}/${encodeURIComponent(quotation.id)}`)}
                    className="cursor-pointer bg-white transition-colors hover:bg-primary-50/30"
                  >
                    <td className="px-6 py-5 align-middle" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(quotation.id)} onChange={() => setSelectedIds((current) => current.includes(quotation.id) ? current.filter((id) => id !== quotation.id) : [...current, quotation.id])} className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" aria-label={`Select ${quotation.quotationNumber}`} /></td>
                    <td className="px-6 py-5">
                      <p className="font-semibold text-neutral-900">
                        {quotation.quotationNumber}
                        {isDemoQuotation(quotation.id) && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-700">Demo</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-400">{quotation.itemCount} item(s)</p>
                    </td>
                    <td className="px-6 py-5">
                      {quotation.customerId ? (
                        <>
                          <p className="text-neutral-800">{quotation.customerName || quotation.leadName || 'Customer'}</p>
                          <span className="mt-0.5 inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-[0.62rem] font-medium text-neutral-500">
                            Customer{quotation.leadId ? ' · from lead' : ''}
                          </span>
                        </>
                      ) : quotation.leadId ? (
                        <>
                          <p className="text-neutral-800">{quotation.leadName || 'Lead'}</p>
                          <span className="mt-0.5 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[0.62rem] font-medium text-blue-600">Lead</span>
                        </>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-neutral-600">{quotation.salespersonName || '-'}</td>
                    <td className="px-6 py-5 text-neutral-600">{formatDate(quotation.quotationDate)}</td>
                    <td className="px-6 py-5 text-neutral-600">{formatDate(quotation.validUntil)}</td>
                    <td className="px-6 py-5 font-medium text-neutral-900">{formatCurrency(quotation.total)}</td>
                    <td className="px-6 py-5">
                      <Badge variant={QUOTATION_STATUS_VARIANT[displayStatus] || 'neutral'}>{formatQuotationStatus(displayStatus)}</Badge>
                    </td>
                    <td className="px-6 py-5 text-right" onClick={(event) => event.stopPropagation()}>
                      <ActionMenu
                        items={[
                          { label: 'View Details', icon: Eye, onClick: () => navigate(`${basePath}/${encodeURIComponent(quotation.id)}`) },
                          ...(actions.includes('edit')
                            ? [{ label: 'Edit', icon: Pencil, onClick: () => navigate(`${basePath}/${encodeURIComponent(quotation.id)}/edit`) }]
                            : []),
                          ...(actions.includes('editResend')
                            ? [{ label: 'Edit & Resend', icon: Pencil, onClick: () => navigate(`${basePath}/${encodeURIComponent(quotation.id)}/edit`) }]
                            : []),
                          ...(actions.includes('duplicate')
                            ? [{ label: 'Duplicate', icon: Copy, onClick: () => navigate(`${basePath}/new?from=${encodeURIComponent(quotation.id)}`) }]
                            : []),
                          ...(actions.includes('delete')
                            ? [{ label: 'Delete', icon: Trash2, danger: true, onClick: () => setDeleteTarget(quotation) }]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-white px-5 py-4 text-xs text-[#6f89b0]">
          <div className="flex items-center gap-3"><span>Showing <span className="font-semibold text-[#082445]">{rangeStart}-{rangeEnd}</span> of <span className="font-semibold text-[#082445]">{filteredQuotations.length}</span></span><span className="hidden text-neutral-300 sm:inline">|</span><label className="flex items-center gap-2">Rows per page<Select options={[{ value: '10', label: '10' }, { value: '25', label: '25' }, { value: '50', label: '50' }]} value={pageSize} onChange={(event) => { setPageSize(event.target.value); setPage(1) }} className="w-20" triggerClassName="h-8 bg-white py-1 text-xs" /></label></div>
          <div className="flex items-center gap-1.5"><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button><span className="min-w-14 text-center font-medium text-[#082445]">{currentPage} / {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button></div>
        </div>
      </Card>

      {isFilterOpen && (
        <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Quotation filters">
          <button type="button" className="absolute inset-0 cursor-default bg-neutral-950/20" onClick={() => setIsFilterOpen(false)} aria-label="Close filters" />
          <aside className="relative z-10 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4"><div><h2 className="text-lg font-semibold text-neutral-900">Filter Quotations</h2><p className="mt-0.5 text-xs text-neutral-400">Refine the quotations shown in the table.</p></div><button type="button" onClick={() => setIsFilterOpen(false)} className="flex size-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-50" aria-label="Close filters"><X className="size-5" /></button></div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
              <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Status<Select options={[{ value: 'all', label: 'All status' }, ...QUOTATION_FILTER_STATUS_OPTIONS]} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} /></label>
              {!isSalesOfficer && salespersonOptions.length > 1 && <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Salesperson<Select options={salespersonOptions} value={salespersonFilter} onChange={(event) => { setSalespersonFilter(event.target.value); setPage(1) }} /></label>}
            </div>
            <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-4"><button type="button" onClick={() => { setStatusFilter('all'); setSalespersonFilter('all'); setSearchTerm(''); setPage(1) }} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">Clear all</button><Button type="button" onClick={() => setIsFilterOpen(false)}>Apply filters</Button></div>
          </aside>
        </div>
      )}

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return
          setDeleteError('')
          setDeleteTarget(null)
        }}
        title="Delete Quotation"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete {deleteTarget?.quotationNumber || 'this quotation'}? This cannot be undone.
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
                setDeleteTarget(null)
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDeleteQuotation}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
