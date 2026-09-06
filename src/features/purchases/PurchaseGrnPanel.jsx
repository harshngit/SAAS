import { Fragment, useMemo, useState } from 'react'
import { PackageCheck, PackageSearch } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/toastContext'
import {
  computeGrnLine,
  cumulativeAcceptedByProduct,
  deriveReceivingStatusFromGrns,
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

const REAL_MODE_NOTE = 'Goods receipt posting will be available once receiving integration is enabled.'

function GrnHistoryRow({ grn, onView }) {
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
        <Button type="button" variant="outline" size="sm" onClick={() => onView(grn)}>View GRN</Button>
      </td>
    </tr>
  )
}

export default function PurchaseGrnPanel({ purchase, isDemo, currentUserName, purchaseStatusKey, onGrnChange }) {
  const { showToast } = useToast()
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [receiveNotes, setReceiveNotes] = useState('')
  const [lines, setLines] = useState([])
  const [receiveError, setReceiveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [detailGrn, setDetailGrn] = useState(null)
  const [refreshTick, setRefreshTick] = useState(0)

  // refreshTick is bumped after a local GRN is added so this re-reads the demo store.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const grns = useMemo(() => (isDemo ? getDemoGrns(purchase.id) : []), [isDemo, purchase.id, refreshTick])

  // Attach a cumulative-through-this-GRN status to each history row.
  const grnRows = useMemo(() => {
    let running = []
    return grns.map((grn) => {
      running = [...running, grn]
      return { ...grn, cumulativeStatus: deriveReceivingStatusFromGrns(purchase.items, running).key }
    })
  }, [grns, purchase.items])

  // Goods can be received only while the purchase is Confirmed (never Draft / Closed / Cancelled).
  const canReceive = isDemo && purchaseStatusKey === 'confirmed'
  const alreadyReceived = useMemo(() => cumulativeAcceptedByProduct(grns), [grns])
  const fullyReceived = useMemo(
    () => deriveReceivingStatusFromGrns(purchase.items, grns).key === 'fully_received',
    [purchase.items, grns],
  )

  const openReceiveModal = () => {
    setReceiveError('')
    setReceiveNotes('')
    setReceiptDate(new Date().toISOString().slice(0, 10))
    setLines(
      purchase.items.map((item) => {
        const previousReceived = alreadyReceived[item.productId] || 0
        const remaining = Math.max((Number(item.quantity) || 0) - previousReceived, 0)
        return {
          productId: item.productId,
          productName: item.productName || 'Item',
          sku: item.sku || '',
          orderedQty: Number(item.quantity) || 0,
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

  const updateLine = (index, field, value) => {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, [field]: value } : line)))
  }

  const handleSaveReceipt = () => {
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

    if (!isDemo) {
      // Real mode never reaches here (the action is disabled). Guard anyway - no fake persistence.
      setReceiveError(REAL_MODE_NOTE)
      return
    }

    setIsSaving(true)
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
  }

  return (
    <div className="space-y-4">
      <Card
        title="Goods Receipts"
        subtitle={isDemo ? 'Simulated receiving for this demo purchase.' : 'Receipts recorded against this purchase.'}
        className="p-0"
        bodyClassName="p-0"
        actions={
          <Button
            type="button"
            size="sm"
            disabled={!canReceive || fullyReceived}
            title={
              !isDemo
                ? REAL_MODE_NOTE
                : purchaseStatusKey !== 'confirmed'
                  ? 'Goods can only be received while the purchase is Confirmed.'
                  : fullyReceived
                    ? 'All ordered quantity has been received.'
                    : undefined
            }
            onClick={openReceiveModal}
          >
            <PackageCheck className="size-4" aria-hidden="true" />
            Receive Goods
          </Button>
        }
      >
        {grnRows.length > 0 ? (
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
                {grnRows.map((grn) => (
                  <GrnHistoryRow key={grn.id} grn={grn} onView={setDetailGrn} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              icon={PackageSearch}
              title="No goods receipts yet"
              description={
                isDemo
                  ? 'Use "Receive Goods" to simulate a receipt for this demo purchase.'
                  : 'Goods receipt tracking will appear here once receiving is enabled.'
              }
            />
          </div>
        )}
      </Card>

      {!isDemo && (
        <Card title="Receiving integration">
          <p className="text-sm text-neutral-600">{REAL_MODE_NOTE}</p>
        </Card>
      )}

      <Modal isOpen={receiveOpen} onClose={() => !isSaving && setReceiveOpen(false)} title="Receive Goods" size="4xl">
        <div className="space-y-5">
          {receiveError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{receiveError}</div>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="GRN Number" value={nextDemoGrnNumber()} disabled />
            <Input label="Receipt Date" type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} />
            <Input label="Received By" value={currentUserName || 'Current user'} disabled />
            <Input label="Supplier" value={purchase.supplierName || '—'} disabled />
            <Input label="Purchase #" value={purchase.purchaseNumber || purchase.invoiceNumber} disabled />
            <Input label="Warehouse" value={purchase.warehouseName || '—'} disabled />
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-100">
            <table className="w-full min-w-4xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.66rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5">SKU</th>
                  <th className="px-3 py-2.5 text-right">Ordered</th>
                  <th className="px-3 py-2.5 text-right">Prev. Received</th>
                  <th className="px-3 py-2.5 text-right">Receiving Now</th>
                  <th className="px-3 py-2.5 text-right">Damaged</th>
                  <th className="px-3 py-2.5 text-right">Rejected</th>
                  <th className="px-3 py-2.5 text-right">Accepted</th>
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
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={line.receivingNow}
                            onChange={(event) => updateLine(index, 'receivingNow', event.target.value)}
                            className="w-20 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-sm"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={line.damagedQty}
                            onChange={(event) => updateLine(index, 'damagedQty', event.target.value)}
                            className="w-16 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-sm"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={line.rejectedQty}
                            onChange={(event) => updateLine(index, 'rejectedQty', event.target.value)}
                            className="w-16 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-sm"
                          />
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
                            <button
                              type="button"
                              className="text-xs font-medium text-primary-600 hover:text-primary-700"
                              onClick={() => updateLine(index, 'showTracking', true)}
                            >
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

          <Input as="textarea" label="Notes" value={receiveNotes} onChange={(event) => setReceiveNotes(event.target.value)} placeholder="Anything worth recording about this receipt" />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isSaving} onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button type="button" loading={isSaving} onClick={handleSaveReceipt}>Save Goods Receipt</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(detailGrn)} onClose={() => setDetailGrn(null)} title={detailGrn?.grnNumber || 'Goods Receipt'} size="4xl">
        {detailGrn && (
          <GrnDetailBody grn={detailGrn} />
        )}
      </Modal>
    </div>
  )
}

function GrnDetailBody({ grn }) {
  const totals = summarizeGrn(grn)
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DetailPair label="GRN Number" value={grn.grnNumber} />
        <DetailPair label="Purchase #" value={grn.purchaseNumber} />
        <DetailPair label="Supplier" value={grn.supplierName} />
        <DetailPair label="Receipt Date" value={formatDate(grn.receiptDate)} />
        <DetailPair label="Warehouse" value={grn.warehouseName} />
        <DetailPair label="Received By" value={grn.receivedBy} />
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
              <th className="px-3 py-2.5 text-right">Received (this GRN)</th>
              <th className="px-3 py-2.5 text-right">Accepted</th>
              <th className="px-3 py-2.5 text-right">Damaged</th>
              <th className="px-3 py-2.5 text-right">Rejected</th>
              <th className="px-3 py-2.5 text-right">Remaining</th>
              <th className="px-3 py-2.5">Batch / Serial / Expiry</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {(grn.lines || []).map((line) => (
              <tr key={line.productId}>
                <td className="px-3 py-2.5 font-medium text-neutral-900">{line.productName}</td>
                <td className="px-3 py-2.5 text-neutral-500">{line.sku || '—'}</td>
                <td className="px-3 py-2.5 text-right text-neutral-600">{line.orderedQty}</td>
                <td className="px-3 py-2.5 text-right text-neutral-600">{line.previousReceived}</td>
                <td className="px-3 py-2.5 text-right text-neutral-600">{line.receivingNow}</td>
                <td className="px-3 py-2.5 text-right font-medium text-neutral-900">{line.acceptedQty}</td>
                <td className="px-3 py-2.5 text-right text-neutral-600">{line.damagedQty}</td>
                <td className="px-3 py-2.5 text-right text-neutral-600">{line.rejectedQty}</td>
                <td className="px-3 py-2.5 text-right text-neutral-600">{line.remainingQty}</td>
                <td className="px-3 py-2.5 text-neutral-500">
                  {grnLineHasTracking(line)
                    ? [line.batchNumber, line.serialNumber, line.expiryDate ? formatDate(line.expiryDate) : ''].filter(Boolean).join(' · ')
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
