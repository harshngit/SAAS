import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, Check, PackageCheck, PackageSearch, Pencil, Trash2 } from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/toastContext'
import { usePermission } from '../../auth/usePermission'
import {
  cancelGrn,
  confirmGrn,
  createGrn,
  deleteGrn,
  getGrn,
  listGrns,
  updateGrn,
} from '../../api/grns'
import {
  computeGrnLine,
  cumulativeAcceptedByProduct,
  deriveReceivingStatusFromGrns,
  grnActions,
  grnLifecycleMeta,
  grnLineHasTracking,
  grnStatusMeta,
  summarizeGrn,
  validateGrn,
} from './purchaseGrnHelpers'
import { addDemoGrn, getDemoGrns, nextDemoGrnNumber } from './purchaseGrnDemoData'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

// --- Demo history row (cumulative receiving progress, no lifecycle) -------------------------
function DemoGrnHistoryRow({ grn, onView }) {
  const totals = summarizeGrn(grn)
  const status = grnStatusMeta(grn.cumulativeStatus || 'partially_received')
  return (
    <tr className="hover:bg-primary-50/35">
      <td className="px-5 py-3.5 font-medium text-neutral-900">{grn.grnNumber}</td>
      <td className="px-5 py-3.5 text-neutral-600">{formatDate(grn.receiptDate)}</td>
      <td className="px-5 py-3.5 text-neutral-600">{grn.warehouseName || '—'}</td>
      <td className="px-5 py-3.5 text-right text-neutral-600">{totals.accepted}</td>
      <td className="px-5 py-3.5 text-right text-neutral-600">{totals.damaged}</td>
      <td className="px-5 py-3.5 text-right text-neutral-600">{totals.rejected}</td>
      <td className="px-5 py-3.5 text-neutral-600">{grn.receivedBy || '—'}</td>
      <td className="px-5 py-3.5"><Badge variant={status.variant}>{status.label}</Badge></td>
      <td className="px-5 py-3.5 text-right">
        <Button type="button" variant="outline" size="sm" onClick={() => onView(grn.id)}>View GRN</Button>
      </td>
    </tr>
  )
}

export default function PurchaseGrnPanel({ purchase, isDemo, currentUserName, purchaseStatusKey, receivingKey, onGrnChange, onGrnCount }) {
  const { showToast } = useToast()
  const { can } = usePermission()
  // Backend permission contract: create=grn:create, edit=grn:edit, confirm/cancel=grn:approve,
  // delete=grn:delete. Kept as distinct variables - never collapsed, never a role check.
  const canCreateGrn = can('grn', 'create')
  const canEditGrn = can('grn', 'edit')
  const canApproveGrn = can('grn', 'approve')
  const canDeleteGrn = can('grn', 'delete')

  const [receiveOpen, setReceiveOpen] = useState(false)
  const [editingGrnId, setEditingGrnId] = useState(null)
  // Edit mode preserves the Draft GRN's OWN warehouse - never silently replaced with the
  // Purchase warehouse (even though the backend currently keeps them equal).
  const [editGrnWarehouse, setEditGrnWarehouse] = useState({ id: '', name: '' })
  const [isPreparingEdit, setIsPreparingEdit] = useState(false)
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [receiveNotes, setReceiveNotes] = useState('')
  const [lines, setLines] = useState([])
  const [receiveError, setReceiveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const [detailGrnId, setDetailGrnId] = useState(null)
  const [detailGrn, setDetailGrn] = useState(null)
  const [detailTick, setDetailTick] = useState(0)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  const [realGrns, setRealGrns] = useState([])
  const [isLoadingGrns, setIsLoadingGrns] = useState(!isDemo)
  const [listErr, setListErr] = useState('')
  const [busyId, setBusyId] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  // ---- Demo GRNs -------------------------------------------------------------------------
  // refreshTick re-reads the local demo store after a demo receipt is recorded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const demoGrns = useMemo(() => (isDemo ? getDemoGrns(purchase.id) : []), [isDemo, purchase.id, refreshTick])
  const demoGrnRows = useMemo(() => {
    let running = []
    return demoGrns.map((grn) => {
      running = [...running, grn]
      return { ...grn, cumulativeStatus: deriveReceivingStatusFromGrns(purchase.items, running).key }
    })
  }, [demoGrns, purchase.items])

  // ---- Real GRNs ----------------------------------------------------------------------------
  const loadRealGrns = useCallback(async () => {
    if (isDemo) return
    setIsLoadingGrns(true)
    setListErr('')
    const result = await listGrns({ purchaseId: purchase.id })
    setIsLoadingGrns(false)
    if (!result.success) {
      setRealGrns([])
      setListErr(result.error)
      return
    }
    setRealGrns(result.grns)
    onGrnCount?.(result.grns.filter((grn) => grn.status !== 'cancelled').length)
  }, [isDemo, purchase.id, onGrnCount])

  useEffect(() => {
    loadRealGrns()
  }, [loadRealGrns])

  const grns = isDemo ? demoGrns : realGrns

  // "Received so far" per product - real: confirmed GRNs only; demo: all demo GRNs.
  const alreadyReceived = useMemo(() => {
    if (isDemo) return cumulativeAcceptedByProduct(demoGrns)
    return cumulativeAcceptedByProduct(realGrns.filter((grn) => grn.status === 'confirmed'))
  }, [isDemo, demoGrns, realGrns])

  const fullyReceived = isDemo
    ? deriveReceivingStatusFromGrns(purchase.items, demoGrns).key === 'fully_received'
    : receivingKey === 'fully_received'

  // Create GRN only when the Purchase is Confirmed and not yet fully received.
  const canReceive =
    (isDemo || canCreateGrn) && purchaseStatusKey === 'confirmed' && !fullyReceived

  const receiveDisabledReason =
    purchaseStatusKey !== 'confirmed'
      ? 'Goods can only be received while the purchase is Confirmed.'
      : fullyReceived
        ? 'All ordered quantity has been received.'
        : !isDemo && !canCreateGrn
          ? 'You do not have permission to create a goods receipt.'
          : undefined

  const openReceiveModal = () => {
    setReceiveError('')
    setEditingGrnId(null)
    setEditGrnWarehouse({ id: '', name: '' })
    setReceiveNotes('')
    setReceiptDate(new Date().toISOString().slice(0, 10))
    setLines(
      purchase.items.map((item) => {
        const backendRemaining = !isDemo && item.remainingQty != null ? Number(item.remainingQty) : null
        const previousReceived = !isDemo
          ? Number(item.receivedQty) || 0
          : alreadyReceived[item.productId] || 0
        const ordered = Number(item.orderedQty ?? item.quantity) || 0
        const remaining = backendRemaining != null ? backendRemaining : Math.max(ordered - previousReceived, 0)
        return {
          purchaseItemId: item.id || item.purchaseItemId || '',
          productId: item.productId,
          variantId: item.variantId || '',
          productName: item.productName || 'Item',
          sku: item.sku || '',
          orderedQty: ordered,
          previousReceived,
          receivingNow: String(remaining),
          damagedQty: '0',
          rejectedQty: '0',
          batchNumber: '',
          serialNumber: '',
          expiryDate: '',
          showTracking: false,
        }
      }),
    )
    setReceiveOpen(true)
  }

  // Edit a real DRAFT GRN - reuses the Create Goods Receipt modal. Fetches the GRN fresh so the
  // line values / tracking fields are authoritative, then PATCHes on save. Never auto-confirms.
  const openEditModal = async (grn) => {
    setActionErr('')
    setReceiveError('')
    setIsPreparingEdit(true)
    const result = await getGrn(grn.id)
    setIsPreparingEdit(false)
    if (!result.success) {
      setActionErr(result.error)
      return
    }
    const fresh = result.grn
    setEditingGrnId(fresh.id)
    setEditGrnWarehouse({
      id: fresh.warehouseId || purchase.warehouseId || '',
      name: fresh.warehouseName || purchase.warehouseName || '',
    })
    setReceiveNotes(fresh.notes || '')
    setReceiptDate((fresh.receivedDate || new Date().toISOString().slice(0, 10)).slice(0, 10))
    setLines(
      (fresh.items || []).map((gi) => {
        // Resolve the parent Purchase line: exact purchase_item_id wins, then product+variant,
        // then product-only (legacy). Never collapse two variants of one product into one row.
        const pi =
          purchase.items.find(
            (p) =>
              (gi.purchaseItemId && (p.id === gi.purchaseItemId || p.purchaseItemId === gi.purchaseItemId)),
          ) ||
          purchase.items.find(
            (p) =>
              p.productId === gi.productId &&
              String(p.variantId || '') === String(gi.variantId || ''),
          ) ||
          purchase.items.find((p) => p.productId === gi.productId) ||
          {}
        const ordered = Number(gi.orderedQty) || Number(pi.orderedQty ?? pi.quantity) || 0
        // This GRN is still a Draft, so "previously received" is what OTHER confirmed GRNs
        // already booked - i.e. the purchase item's backend received_qty.
        const previousReceived = Number(pi.receivedQty) || Number(gi.previousReceived) || 0
        const serials = Array.isArray(gi.serialNumbers) ? gi.serialNumbers : []
        return {
          // Keep the exact GRN-linked purchase item id; fall back to the resolved line only
          // when the GRN item didn't carry one.
          purchaseItemId: gi.purchaseItemId || pi.id || pi.purchaseItemId || '',
          productId: gi.productId,
          variantId: gi.variantId || pi.variantId || '',
          productName: gi.productName || pi.productName || 'Item',
          sku: gi.sku || pi.sku || '',
          orderedQty: ordered,
          previousReceived,
          receivingNow: String(Number(gi.receivedQty) || 0),
          damagedQty: String(Number(gi.damagedQty) || 0),
          rejectedQty: String(Number(gi.rejectedQty) || 0),
          batchNumber: gi.batchNumber || '',
          serialNumber: serials[0] || '',
          expiryDate: gi.expiryDate || '',
          showTracking: Boolean(gi.batchNumber || serials.length || gi.expiryDate),
        }
      }),
    )
    setReceiveOpen(true)
  }

  const updateLine = (index, field, value) => {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, [field]: value } : line)))
  }

  const handleSaveReceipt = async () => {
    setReceiveError('')
    const normalized = lines.map((line) => ({
      ...line,
      receivingNow: Number(line.receivingNow) || 0,
      damagedQty: Number(line.damagedQty) || 0,
      rejectedQty: Number(line.rejectedQty) || 0,
    }))

    const validationError = validateGrn(normalized)
    if (validationError) {
      setReceiveError(validationError)
      return
    }

    setIsSaving(true)

    if (isDemo) {
      const grnLines = normalized
        .filter((line) => line.receivingNow > 0)
        .map((line) => ({
          productId: line.productId,
          productName: line.productName,
          sku: line.sku,
          batchNumber: line.batchNumber.trim(),
          serialNumber: line.serialNumber.trim(),
          expiryDate: line.expiryDate,
          ...computeGrnLine(line),
        }))
      addDemoGrn({
        grnNumber: nextDemoGrnNumber(),
        purchaseId: purchase.id,
        purchaseNumber: purchase.purchaseNumber || purchase.invoiceNumber,
        supplierId: purchase.supplierId,
        supplierName: purchase.supplierName,
        warehouseId: purchase.warehouseId,
        warehouseName: purchase.warehouseName,
        receiptDate,
        receivedBy: currentUserName || 'Current user',
        notes: receiveNotes.trim(),
        lines: grnLines,
      })
      setIsSaving(false)
      setReceiveOpen(false)
      setRefreshTick((tick) => tick + 1)
      showToast({ title: 'Goods receipt recorded', message: 'Simulated locally for this demo purchase.' })
      onGrnChange?.()
      return
    }

    // Real GRN body. Backend calculates accepted_qty; purchase_id + purchase_item_id + variant_id
    // preserve the exact purchase-item relationships. A Draft GRN moves NO stock (create or edit).
    // Warehouse: create uses the Purchase's warehouse; edit keeps the Draft GRN's own warehouse.
    const payload = {
      purchaseId: purchase.id,
      warehouseId: (editingGrnId ? editGrnWarehouse.id : purchase.warehouseId) || undefined,
      receivedDate: receiptDate,
      notes: receiveNotes.trim() || undefined,
      items: normalized
        .filter((line) => line.receivingNow > 0)
        .map((line) => ({
          purchaseItemId: line.purchaseItemId || undefined,
          productId: line.productId,
          variantId: line.variantId || undefined,
          receivedQty: line.receivingNow,
          damagedQty: line.damagedQty,
          rejectedQty: line.rejectedQty,
          batchNumber: line.batchNumber.trim() || undefined,
          serialNumbers: line.serialNumber.trim() ? [line.serialNumber.trim()] : undefined,
          expiryDate: line.expiryDate || undefined,
        })),
    }

    if (editingGrnId) {
      // PATCH /grns/{id} - stays a Draft, never auto-confirms, moves no stock.
      const result = await updateGrn(editingGrnId, payload)
      setIsSaving(false)
      if (!result.success) {
        setReceiveError(result.error)
        return
      }
      const editedId = editingGrnId
      setReceiveOpen(false)
      setEditingGrnId(null)
      setEditGrnWarehouse({ id: '', name: '' })
      showToast({ title: 'Draft goods receipt updated.' })
      await loadRealGrns()
      // Refresh the detail modal if it is showing the GRN we just edited. No Purchase
      // receiving/stock refresh - a Draft edit changes nothing on the Purchase.
      if (detailGrnId === editedId) setDetailTick((tick) => tick + 1)
      return
    }

    const result = await createGrn(payload)
    setIsSaving(false)
    if (!result.success) {
      setReceiveError(result.error)
      return
    }
    setReceiveOpen(false)
    showToast({ title: 'Goods receipt saved as Draft', message: 'Confirm it to receive the goods into the warehouse.' })
    await loadRealGrns()
    onGrnChange?.()
  }

  // ---- Real GRN lifecycle actions ---------------------------------------------------------
  const runGrnAction = async (grn, kind) => {
    setBusyId(grn.id)
    setActionErr('')
    let result
    if (kind === 'confirm') result = await confirmGrn(grn.id)
    else if (kind === 'cancel') result = await cancelGrn(grn.id)
    else result = await deleteGrn(grn.id)
    setBusyId('')
    if (!result.success) {
      setActionErr(result.error)
      return
    }
    if (kind === 'confirm') {
      showToast({ title: 'Goods receipt confirmed. Warehouse inventory updated.', message: `${grn.grnNumber} accepted quantity has been added to stock.` })
    } else if (kind === 'cancel') {
      showToast({ title: 'Goods receipt cancelled', message: `${grn.grnNumber} was cancelled. No stock was moved.` })
    } else {
      showToast({ title: 'Draft goods receipt deleted', message: `${grn.grnNumber} was removed.` })
    }
    await loadRealGrns()
    // Confirm / cancel change the parent Purchase's received_qty / receiving_status.
    onGrnChange?.()
  }

  // ---- GRN detail (real: fetch fresh; demo: from local store) ----------------------------
  useEffect(() => {
    if (!detailGrnId) {
      setDetailGrn(null)
      return
    }
    if (isDemo) {
      setDetailGrn(getDemoGrns(purchase.id).find((grn) => grn.id === detailGrnId) || null)
      return
    }
    let active = true
    setIsLoadingDetail(true)
    getGrn(detailGrnId).then((result) => {
      if (!active) return
      setDetailGrn(result.success ? result.grn : null)
      setIsLoadingDetail(false)
    })
    return () => {
      active = false
    }
    // detailTick forces a re-fetch after the open GRN is edited in place.
  }, [detailGrnId, detailTick, isDemo, purchase.id])

  return (
    <div className="space-y-4">
      {actionErr && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionErr}</div>}

      <Card
        title="Goods Receipts"
        subtitle={isDemo ? 'Simulated receiving for this demo purchase.' : 'Goods receipts recorded against this purchase.'}
        className="p-0"
        bodyClassName="p-0"
        actions={
          <Button
            type="button"
            size="sm"
            disabled={!canReceive}
            title={canReceive ? undefined : receiveDisabledReason}
            onClick={openReceiveModal}
          >
            <PackageCheck className="size-4" aria-hidden="true" />
            Create Goods Receipt
          </Button>
        }
      >
        {!isDemo && isLoadingGrns ? (
          <div className="p-5"><LoadingSpinner label="Loading goods receipts..." /></div>
        ) : !isDemo && listErr ? (
          <div className="p-5">
            <p className="text-sm text-red-600">{listErr}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadRealGrns}>Retry</Button>
          </div>
        ) : grns.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={PackageSearch}
              title="No goods receipts yet"
              description={
                canReceive
                  ? 'Use "Create Goods Receipt" to record what has physically arrived.'
                  : receiveDisabledReason || 'Goods receipts recorded against this purchase will appear here.'
              }
            />
          </div>
        ) : isDemo ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-4xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="px-5 py-3">GRN #</th>
                  <th className="px-5 py-3">Receipt Date</th>
                  <th className="px-5 py-3">Warehouse</th>
                  <th className="px-5 py-3 text-right">Accepted Qty</th>
                  <th className="px-5 py-3 text-right">Damaged Qty</th>
                  <th className="px-5 py-3 text-right">Rejected Qty</th>
                  <th className="px-5 py-3">Received By</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {demoGrnRows.map((grn) => (
                  <DemoGrnHistoryRow key={grn.id} grn={grn} onView={setDetailGrnId} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-4xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="px-5 py-3">GRN #</th>
                  <th className="px-5 py-3">Received Date</th>
                  <th className="px-5 py-3">Warehouse</th>
                  <th className="px-5 py-3 text-right">Accepted</th>
                  <th className="px-5 py-3 text-right">Damaged</th>
                  <th className="px-5 py-3 text-right">Rejected</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Confirmed</th>
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {realGrns.map((grn) => {
                  const meta = grnLifecycleMeta(grn.status)
                  const acts = grnActions(grn)
                  const busy = busyId === grn.id
                  const menuItems = [{ label: 'View GRN', onClick: () => setDetailGrnId(grn.id) }]
                  // Draft only: Edit=grn:edit, Confirm/Cancel=grn:approve, Delete=grn:delete.
                  if (acts.includes('edit') && canEditGrn) {
                    menuItems.push({ label: isPreparingEdit ? 'Opening…' : 'Edit Draft', icon: Pencil, onClick: () => openEditModal(grn) })
                  }
                  if (acts.includes('confirm') && canApproveGrn) {
                    menuItems.push({ label: busy ? 'Confirming…' : 'Confirm', icon: Check, onClick: () => runGrnAction(grn, 'confirm') })
                  }
                  if (acts.includes('cancel') && canApproveGrn) {
                    menuItems.push({ label: 'Cancel GRN', icon: Ban, danger: true, onClick: () => runGrnAction(grn, 'cancel') })
                  }
                  if (acts.includes('delete') && canDeleteGrn) {
                    menuItems.push({ label: 'Delete Draft', icon: Trash2, danger: true, onClick: () => runGrnAction(grn, 'delete') })
                  }
                  return (
                    <tr key={grn.id} className="cursor-pointer transition-colors hover:bg-primary-50/35" onClick={() => setDetailGrnId(grn.id)}>
                      <td className="px-5 py-3.5 font-medium text-primary-700">{grn.grnNumber}</td>
                      <td className="px-5 py-3.5 text-neutral-600">{formatDate(grn.receivedDate)}</td>
                      <td className="px-5 py-3.5 text-neutral-600">{grn.warehouseName || '—'}</td>
                      <td className="px-5 py-3.5 text-right font-medium text-neutral-900">{grn.acceptedTotal}</td>
                      <td className="px-5 py-3.5 text-right text-neutral-600">{grn.damagedTotal}</td>
                      <td className="px-5 py-3.5 text-right text-neutral-600">{grn.rejectedTotal}</td>
                      <td className="px-5 py-3.5"><Badge variant={meta.variant}>{meta.label}</Badge></td>
                      <td className="px-5 py-3.5 text-neutral-500">{formatDate(grn.createdAt)}</td>
                      <td className="px-5 py-3.5 text-neutral-500">{grn.confirmedAt ? formatDate(grn.confirmedAt) : '—'}</td>
                      <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                        <ActionMenu items={menuItems} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create / Edit Goods Receipt (same modal - editing a real Draft GRN reuses it) */}
      <Modal
        isOpen={receiveOpen}
        onClose={() => {
          if (isSaving) return
          setReceiveOpen(false)
          setEditingGrnId(null)
          setEditGrnWarehouse({ id: '', name: '' })
        }}
        title={editingGrnId ? 'Edit Draft Goods Receipt' : 'Create Goods Receipt'}
        size="4xl"
      >
        <div className="space-y-5">
          {receiveError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{receiveError}</div>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Receipt Date" type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} />
            <Input label="Supplier" value={purchase.supplierName || '—'} disabled />
            <Input label="Purchase #" value={purchase.purchaseNumber || purchase.invoiceNumber} disabled />
            <Input
              label="Warehouse"
              value={(editingGrnId ? editGrnWarehouse.name : purchase.warehouseName) || '—'}
              disabled
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-100">
            <table className="w-full min-w-4xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.66rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5">SKU</th>
                  <th className="px-3 py-2.5 text-right">Ordered</th>
                  <th className="px-3 py-2.5 text-right">Prev. Received</th>
                  <th className="px-3 py-2.5 text-right">Received Now</th>
                  <th className="px-3 py-2.5 text-right">Damaged</th>
                  <th className="px-3 py-2.5 text-right">Rejected</th>
                  <th className="px-3 py-2.5 text-right">Accepted (preview)</th>
                  <th className="px-3 py-2.5 text-right">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {lines.map((line, index) => {
                  const computed = computeGrnLine(line)
                  return (
                    <Fragment key={line.productId}>
                      <tr>
                        <td className="px-3 py-2.5 font-medium text-neutral-900">{line.productName}</td>
                        <td className="px-3 py-2.5 text-neutral-500">{line.sku || '—'}</td>
                        <td className="px-3 py-2.5 text-right text-neutral-600">{line.orderedQty}</td>
                        <td className="px-3 py-2.5 text-right text-neutral-600">{line.previousReceived}</td>
                        <td className="px-3 py-2.5 text-right">
                          <input type="number" min="0" step="1" value={line.receivingNow}
                            onChange={(event) => updateLine(index, 'receivingNow', event.target.value)}
                            className="w-20 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-sm" />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <input type="number" min="0" step="1" value={line.damagedQty}
                            onChange={(event) => updateLine(index, 'damagedQty', event.target.value)}
                            className="w-16 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-sm" />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <input type="number" min="0" step="1" value={line.rejectedQty}
                            onChange={(event) => updateLine(index, 'rejectedQty', event.target.value)}
                            className="w-16 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-sm" />
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-neutral-900">{computed.acceptedQty}</td>
                        <td className="px-3 py-2.5 text-right text-neutral-600">{computed.remainingQty}</td>
                      </tr>
                      <tr>
                        <td colSpan={9} className="px-3 pb-3">
                          {line.showTracking ? (
                            <div className="grid grid-cols-1 gap-3 rounded-lg bg-neutral-50 p-3 sm:grid-cols-3">
                              <Input label="Batch Number" value={line.batchNumber} onChange={(event) => updateLine(index, 'batchNumber', event.target.value)} compact />
                              <Input label="Serial Number" value={line.serialNumber} onChange={(event) => updateLine(index, 'serialNumber', event.target.value)} compact />
                              <Input label="Expiry Date" type="date" value={line.expiryDate} onChange={(event) => updateLine(index, 'expiryDate', event.target.value)} compact />
                            </div>
                          ) : (
                            <button type="button" className="text-xs font-medium text-primary-600 hover:text-primary-700"
                              onClick={() => updateLine(index, 'showTracking', true)}>
                              + Add batch / serial / expiry
                            </button>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="rounded-xl bg-neutral-50 px-4 py-2.5 text-xs text-neutral-500">
            {isDemo
              ? 'Accepted quantity is previewed here; the demo simulates the receipt locally.'
              : editingGrnId
                ? 'Updates this Draft goods receipt. It stays a Draft and moves no stock — Confirm the GRN to add stock.'
                : 'Saves as a Draft goods receipt — accepted quantity is calculated by the backend. Confirm the GRN to add stock.'}
          </p>

          <Input as="textarea" label="Notes" value={receiveNotes} onChange={(event) => setReceiveNotes(event.target.value)} placeholder="Anything worth recording about this receipt" />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isSaving} onClick={() => { setReceiveOpen(false); setEditingGrnId(null); setEditGrnWarehouse({ id: '', name: '' }) }}>Cancel</Button>
            <Button type="button" loading={isSaving} onClick={handleSaveReceipt}>
              {isDemo ? 'Save Goods Receipt' : editingGrnId ? 'Save Changes' : 'Save Draft GRN'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* GRN detail */}
      <Modal isOpen={Boolean(detailGrnId)} onClose={() => setDetailGrnId(null)} title={detailGrn?.grnNumber || 'Goods Receipt'} size="4xl">
        {isLoadingDetail ? (
          <LoadingSpinner label="Loading goods receipt..." />
        ) : detailGrn ? (
          <GrnDetailBody grn={detailGrn} isDemo={isDemo} />
        ) : (
          <p className="py-6 text-center text-sm text-neutral-500">Goods receipt not found.</p>
        )}
      </Modal>
    </div>
  )
}

function GrnDetailBody({ grn, isDemo }) {
  // Demo GRNs carry the client-computed line shape; real GRNs carry backend fields.
  const totals = isDemo
    ? summarizeGrn(grn)
    : {
        ordered: (grn.items || []).reduce((sum, line) => sum + (Number(line.orderedQty) || 0), 0),
        accepted: grn.acceptedTotal ?? 0,
        damaged: grn.damagedTotal ?? 0,
        rejected: grn.rejectedTotal ?? 0,
      }
  const meta = isDemo ? null : grnLifecycleMeta(grn.status)
  const rows = grn.lines || grn.items || []

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DetailPair label="GRN Number" value={grn.grnNumber} />
        <DetailPair label="Purchase #" value={grn.purchaseNumber} />
        <DetailPair label="Supplier" value={grn.supplierName} />
        <DetailPair label="Received Date" value={formatDate(grn.receivedDate || grn.receiptDate)} />
        <DetailPair label="Warehouse" value={grn.warehouseName} />
        {meta ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Status</p>
            <div className="mt-1"><Badge variant={meta.variant}>{meta.label}</Badge></div>
          </div>
        ) : (
          <DetailPair label="Received By" value={grn.receivedBy} />
        )}
        {!isDemo && <DetailPair label="Created At" value={grn.createdAt ? formatDate(grn.createdAt) : '—'} />}
        {!isDemo && <DetailPair label="Confirmed At" value={grn.confirmedAt ? formatDate(grn.confirmedAt) : '—'} />}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Total Ordered" value={totals.ordered} />
        <SummaryTile label="Accepted" value={totals.accepted} />
        <SummaryTile label="Damaged" value={totals.damaged} />
        <SummaryTile label="Rejected" value={totals.rejected} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-100">
        <table className="w-full min-w-4xl text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.66rem] font-semibold uppercase tracking-widest text-neutral-400">
              <th className="px-3 py-2.5">Product</th>
              <th className="px-3 py-2.5">SKU</th>
              <th className="px-3 py-2.5 text-right">Ordered</th>
              <th className="px-3 py-2.5 text-right">Prev. Received</th>
              <th className="px-3 py-2.5 text-right">Received</th>
              <th className="px-3 py-2.5 text-right">Damaged</th>
              <th className="px-3 py-2.5 text-right">Rejected</th>
              <th className="px-3 py-2.5 text-right">Accepted</th>
              <th className="px-3 py-2.5">Batch / Serial / Expiry</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {rows.map((line, index) => (
              <tr key={line.id || line.productId || index}>
                <td className="px-3 py-2.5 font-medium text-neutral-900">{line.productName}</td>
                <td className="px-3 py-2.5 text-neutral-500">{line.sku || '—'}</td>
                <td className="px-3 py-2.5 text-right text-neutral-600">{line.orderedQty ?? '—'}</td>
                <td className="px-3 py-2.5 text-right text-neutral-600">{line.previousReceived ?? '—'}</td>
                <td className="px-3 py-2.5 text-right text-neutral-600">{line.receivedQty ?? line.receivingNow ?? 0}</td>
                <td className="px-3 py-2.5 text-right text-neutral-600">{line.damagedQty ?? 0}</td>
                <td className="px-3 py-2.5 text-right text-neutral-600">{line.rejectedQty ?? 0}</td>
                <td className="px-3 py-2.5 text-right font-medium text-neutral-900">{line.acceptedQty ?? 0}</td>
                <td className="px-3 py-2.5 text-neutral-500">
                  {grnLineHasTracking(line)
                    ? [line.batchNumber, ...(line.serialNumbers || []), line.serialNumber, line.expiryDate ? formatDate(line.expiryDate) : '']
                        .filter(Boolean)
                        .join(' · ')
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Notes</p>
        <p className="mt-1 text-sm text-neutral-700">{grn.notes || 'No notes recorded.'}</p>
      </div>
    </div>
  )
}

function DetailPair({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-sm text-neutral-800">{value || '—'}</p>
    </div>
  )
}

function SummaryTile({ label, value }) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-neutral-900">{value}</p>
    </div>
  )
}
