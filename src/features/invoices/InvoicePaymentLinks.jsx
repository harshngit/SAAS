import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Link2, MessageCircle, Plus, RefreshCw, Send, X, Copy, ExternalLink, Check } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/toastContext'
import { useAuthStore } from '../../store/authStore'
import { getPaymentGateway } from '../../api/paymentGateway'
import {
  cancelInvoicePaymentLink,
  createInvoicePaymentLink,
  listInvoicePaymentLinks,
  refreshInvoicePaymentLink,
} from '../../api/invoicePaymentLinks'
import { formatCurrency } from '../../utils/format'

const EXPIRY_OPTIONS = [
  { value: '1', label: '1 day' },
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
  { value: '15', label: '15 days' },
  { value: '30', label: '30 days' },
]

const STATUS_VARIANT = { created: 'warning', partially_paid: 'warning', paid: 'success', expired: 'neutral', cancelled: 'danger' }
const STATUS_LABEL = {
  created: 'Created',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function buildWhatsAppUrl({ phone, amount, invoiceNumber, orgName, url }) {
  const message = `Hi${phone ? '' : ' there'}, please pay ${formatCurrency(amount)} for Invoice ${invoiceNumber}${orgName ? ` from ${orgName}` : ''}: ${url}`
  const encoded = encodeURIComponent(message)
  const digits = (phone || '').replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`
}

export default function InvoicePaymentLinks({ invoice, canCollectOnline, onLinkChanged }) {
  const { showToast } = useToast()
  const currentOrganization = useAuthStore((state) => state.currentOrganization)
  const [gatewayConfigured, setGatewayConfigured] = useState(null)
  const [links, setLinks] = useState([])
  const [isLoadingLinks, setIsLoadingLinks] = useState(true)
  const [linksError, setLinksError] = useState('')

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isConnectPromptOpen, setIsConnectPromptOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [expireInDays, setExpireInDays] = useState('7')
  const [notifySms, setNotifySms] = useState(true)
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [createError, setCreateError] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const [actioningLinkId, setActioningLinkId] = useState(null)
  const [copiedLinkId, setCopiedLinkId] = useState(null)

  useEffect(() => {
    getPaymentGateway().then((result) => setGatewayConfigured(result.success ? result.gateway.configured : false))
  }, [])

  const loadLinks = async () => {
    if (!invoice?.id) return
    setIsLoadingLinks(true)
    const result = await listInvoicePaymentLinks(invoice.id)
    setIsLoadingLinks(false)
    if (!result.success) {
      setLinksError(result.error)
      return
    }
    setLinksError('')
    setLinks(result.links)
  }

  useEffect(() => {
    loadLinks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id])

  const hasPhone = Boolean(invoice?.customerPhone)
  const hasEmail = Boolean(invoice?.customerEmail)
  const activeLink = links.find((link) => link.status === 'created' || link.status === 'partially_paid')

  const openCreateModal = () => {
    if (gatewayConfigured === false) {
      setIsConnectPromptOpen(true)
      return
    }
    setCreateError('')
    setAmount(String(invoice?.outstandingAmount ?? ''))
    setExpireInDays('7')
    setNotifySms(hasPhone)
    setNotifyEmail(hasEmail)
    setIsCreateOpen(true)
  }

  const handleCreate = async () => {
    const amountNumber = Number(amount)
    if (!amountNumber || amountNumber <= 0) {
      setCreateError('Enter an amount greater than 0.')
      return
    }
    if (amountNumber > (invoice?.outstandingAmount ?? 0)) {
      setCreateError(`Amount can't exceed the outstanding amount (${formatCurrency(invoice.outstandingAmount)}).`)
      return
    }

    setCreateError('')
    setIsCreating(true)
    const result = await createInvoicePaymentLink(invoice.id, {
      amount: amountNumber,
      expireInDays: Number(expireInDays),
      notifySms: notifySms && hasPhone,
      notifyEmail: notifyEmail && hasEmail,
    })
    setIsCreating(false)

    if (!result.success) {
      setCreateError(result.error)
      return
    }

    setIsCreateOpen(false)
    showToast({ title: 'Payment link created', message: 'Share it with the customer to collect payment.' })
    loadLinks()
    onLinkChanged?.()
  }

  const handleCancel = async (link) => {
    if (!window.confirm('Cancel this payment link? The customer will no longer be able to pay through it.')) return
    setActioningLinkId(link.id)
    const result = await cancelInvoicePaymentLink(invoice.id, link.id)
    setActioningLinkId(null)
    if (!result.success) {
      showToast({ title: 'Cancel failed', message: result.error, variant: 'error' })
      return
    }
    showToast({ title: 'Payment link cancelled', message: '' })
    loadLinks()
    onLinkChanged?.()
  }

  const handleRefresh = async (link) => {
    setActioningLinkId(link.id)
    const result = await refreshInvoicePaymentLink(invoice.id, link.id)
    setActioningLinkId(null)
    if (!result.success) {
      showToast({ title: 'Refresh failed', message: result.error, variant: 'error' })
      return
    }
    if (result.link?.status === 'paid') {
      showToast({ title: 'Payment received', message: 'This link has been paid.' })
      onLinkChanged?.()
    }
    loadLinks()
  }

  const handleCopy = async (link) => {
    try {
      await navigator.clipboard.writeText(link.shortUrl)
      setCopiedLinkId(link.id)
      setTimeout(() => setCopiedLinkId(null), 2000)
    } catch {
      showToast({ title: 'Copy failed', message: 'Could not copy the link. Select and copy it manually.', variant: 'error' })
    }
  }

  const handleShare = (link) => {
    const url = buildWhatsAppUrl({
      phone: invoice.customerPhone,
      amount: link.amount,
      invoiceNumber: invoice.invoiceNumber,
      orgName: currentOrganization?.name,
      url: link.shortUrl,
    })
    window.open(url, '_blank')
  }

  if (invoice?.outstandingAmount <= 0 && links.length === 0) return null

  return (
    <div className="rounded-2xl border border-neutral-100 bg-surface p-5 shadow-(--shadow-card)">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <Link2 className="size-4 text-neutral-400" aria-hidden="true" />
          Online Payment Links
        </p>
        {canCollectOnline && invoice?.outstandingAmount > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={openCreateModal}>
            <Plus className="size-3.5" aria-hidden="true" />
            Collect Online
          </Button>
        )}
      </div>

      {activeLink && (
        <div className="mt-4 rounded-xl border border-primary-100 bg-primary-50/40 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <code className="min-w-0 flex-1 truncate text-xs text-primary-800">{activeLink.shortUrl}</code>
            <Badge variant={STATUS_VARIANT[activeLink.status] || 'neutral'}>{STATUS_LABEL[activeLink.status] || activeLink.status}</Badge>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={() => handleCopy(activeLink)}>
              {copiedLinkId === activeLink.id ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
              {copiedLinkId === activeLink.id ? 'Copied' : 'Copy'}
            </Button>
            <a href={activeLink.shortUrl} target="_blank" rel="noreferrer">
              <Button type="button" variant="outline" size="sm">
                <ExternalLink className="size-3.5" aria-hidden="true" />
                Open
              </Button>
            </a>
            <Button type="button" variant="outline" size="sm" onClick={() => handleShare(activeLink)}>
              <MessageCircle className="size-3.5" aria-hidden="true" />
              Share on WhatsApp
            </Button>
            <Button type="button" variant="outline" size="sm" loading={actioningLinkId === activeLink.id} onClick={() => handleRefresh(activeLink)}>
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Refresh
            </Button>
            {canCollectOnline && (
              <Button type="button" variant="outline" size="sm" loading={actioningLinkId === activeLink.id} onClick={() => handleCancel(activeLink)}>
                <X className="size-3.5" aria-hidden="true" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {isLoadingLinks ? null : linksError ? (
        <p className="mt-3 text-xs text-neutral-500">{linksError}</p>
      ) : links.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">No payment links created for this invoice yet.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {links.map((link) => (
            <div key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-100 px-3.5 py-2.5 text-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[link.status] || 'neutral'}>{STATUS_LABEL[link.status] || link.status}</Badge>
                  <span className="font-medium text-neutral-700">{formatCurrency(link.amount)}</span>
                </div>
                <p className="mt-1 text-neutral-400">
                  Created {formatDateTime(link.createdAt)}
                  {link.expireBy && ` · Expires ${formatDateTime(link.expireBy)}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isCreateOpen} onClose={() => (isCreating ? null : setIsCreateOpen(false))} title="Collect Payment Online">
        <div className="space-y-4">
          <Input
            label="Amount"
            type="number"
            min="0"
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <p className="-mt-2 text-xs text-neutral-400">Outstanding: {formatCurrency(invoice?.outstandingAmount || 0)}</p>
          <Select label="Link valid for" options={EXPIRY_OPTIONS} value={expireInDays} onChange={(event) => setExpireInDays(event.target.value)} />
          <div className="space-y-2.5">
            <label className={`flex items-center justify-between gap-3 ${!hasPhone ? 'opacity-50' : ''}`}>
              <span className="text-sm text-neutral-700">Send SMS{!hasPhone && ' (no phone on file)'}</span>
              <input type="checkbox" checked={notifySms} disabled={!hasPhone} onChange={(event) => setNotifySms(event.target.checked)} className="size-4 accent-primary-600" />
            </label>
            <label className={`flex items-center justify-between gap-3 ${!hasEmail ? 'opacity-50' : ''}`}>
              <span className="text-sm text-neutral-700">Send Email{!hasEmail && ' (no email on file)'}</span>
              <input type="checkbox" checked={notifyEmail} disabled={!hasEmail} onChange={(event) => setNotifyEmail(event.target.checked)} className="size-4 accent-primary-600" />
            </label>
          </div>
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <Button type="button" className="w-full" loading={isCreating} onClick={handleCreate}>
            <Send className="size-4" aria-hidden="true" />
            Create Link
          </Button>
        </div>
      </Modal>

      <Modal isOpen={isConnectPromptOpen} onClose={() => setIsConnectPromptOpen(false)} title="Connect Razorpay First">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-neutral-600">
            Online payment collection isn&apos;t set up for this organization yet. Connect your Razorpay account in Online Payments
            settings to start creating payment links.
          </p>
          <RouterLink to="/admin/online-payments">
            <Button type="button" className="w-full">Go to Online Payments Settings</Button>
          </RouterLink>
        </div>
      </Modal>
    </div>
  )
}
