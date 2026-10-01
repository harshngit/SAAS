import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, Link2, RotateCcw, Save, ShieldCheck, Trash2 } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/toastContext'
import { deletePaymentGateway, getPaymentGateway, testPaymentGateway, updatePaymentGateway } from '../../api/paymentGateway'

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const SETUP_STEPS = [
  'Open your Razorpay Dashboard and go to Settings.',
  'Click Webhooks, then Add New Webhook.',
  'Paste the webhook URL below and tick the required events listed below.',
  'Set the webhook secret to the same value you save here, then click Save.',
]

export default function OnlinePayments() {
  const { showToast } = useToast()
  const [gateway, setGateway] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [keyId, setKeyId] = useState('')
  const [keySecret, setKeySecret] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    setIsLoading(true)
    setLoadError('')
    const result = await getPaymentGateway()
    setIsLoading(false)
    if (!result.success) {
      setLoadError(result.error)
      return
    }
    setGateway(result.gateway)
    setKeyId(result.gateway.keyId)
  }

  useEffect(() => {
    load()
  }, [])

  const handleSave = async () => {
    if (!keyId.trim()) {
      setSaveError('Enter your Razorpay Key ID.')
      return
    }
    setSaveError('')
    setTestResult(null)
    setIsSaving(true)
    const result = await updatePaymentGateway({
      keyId: keyId.trim(),
      keySecret: keySecret.trim() || undefined,
      webhookSecret: webhookSecret.trim() || undefined,
    })
    setIsSaving(false)
    if (!result.success) {
      setSaveError(result.error)
      return
    }
    setGateway(result.gateway)
    setKeyId(result.gateway.keyId)
    setKeySecret('')
    setWebhookSecret('')
    showToast({ title: 'Saved', message: 'Razorpay connection details saved.' })
  }

  const handleTest = async () => {
    setIsTesting(true)
    setTestResult(null)
    const result = await testPaymentGateway()
    setIsTesting(false)
    setTestResult(result)
    if (result.success) {
      if (result.gateway) setGateway(result.gateway)
      else load()
      showToast({ title: 'Connection verified', message: 'Your Razorpay credentials are valid.' })
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    const result = await deletePaymentGateway()
    setIsDisconnecting(false)
    setIsDisconnectOpen(false)
    if (!result.success) {
      showToast({ title: 'Disconnect failed', message: result.error, variant: 'error' })
      return
    }
    setKeyId('')
    setKeySecret('')
    setWebhookSecret('')
    setTestResult(null)
    showToast({ title: 'Disconnected', message: 'Razorpay has been disconnected. Existing invoices and payment history are unaffected.' })
    load()
  }

  const handleCopyWebhookUrl = async () => {
    if (!gateway?.webhookUrl) return
    try {
      await navigator.clipboard.writeText(gateway.webhookUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast({ title: 'Copy failed', message: 'Could not copy the webhook URL. Select and copy it manually.', variant: 'error' })
    }
  }

  if (isLoading) {
    return (
      <Card>
        <LoadingSpinner label="Loading payment gateway settings..." />
      </Card>
    )
  }

  const statusLabel = !gateway?.configured
    ? 'Not connected'
    : gateway.mode === 'live'
      ? 'Connected (Live)'
      : 'Connected (Test)'
  const statusVariant = !gateway?.configured ? 'neutral' : gateway.mode === 'live' ? 'success' : 'warning'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Online Payments</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Connect your own Razorpay account to collect invoice payments online. Payments go directly to your own Razorpay account.
        </p>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-neutral-900">Razorpay Status</p>
                <Badge variant={statusVariant} dot>{statusLabel}</Badge>
              </div>
              {gateway?.verifiedAt && (
                <p className="mt-0.5 text-xs text-neutral-400">Last verified {formatDateTime(gateway.verifiedAt)}</p>
              )}
            </div>
          </div>
          {gateway?.configured && (
            <Button type="button" variant="outline" onClick={() => setIsDisconnectOpen(true)}>
              <Trash2 className="size-4" aria-hidden="true" />
              Disconnect
            </Button>
          )}
        </div>
      </Card>

      <Card title="Connection Details">
        <div className="space-y-4">
          <Input label="Razorpay Key ID" placeholder="rzp_test_xxxxxxxxxxxxx" value={keyId} onChange={(event) => setKeyId(event.target.value)} />
          <Input
            label="Key Secret"
            type="password"
            placeholder={gateway?.configured ? '•••• saved' : 'Enter your Razorpay key secret'}
            value={keySecret}
            onChange={(event) => setKeySecret(event.target.value)}
          />
          <Input
            label="Webhook Secret"
            type="password"
            placeholder={gateway?.configured ? '•••• saved' : 'Enter your Razorpay webhook secret'}
            value={webhookSecret}
            onChange={(event) => setWebhookSecret(event.target.value)}
          />
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          {testResult && !testResult.success && <p className="text-sm text-red-600">{testResult.error}</p>}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="button" loading={isSaving} onClick={handleSave}>
              <Save className="size-4" aria-hidden="true" />
              Save
            </Button>
            <Button type="button" variant="outline" loading={isTesting} disabled={!gateway?.configured && !keySecret} onClick={handleTest}>
              <ShieldCheck className="size-4" aria-hidden="true" />
              Test Connection
            </Button>
          </div>
        </div>
      </Card>

      {gateway?.configured && (
        <Card title="Setup in your Razorpay Dashboard" subtitle="Configure the webhook so payment status updates reach this CRM automatically">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-neutral-700">Webhook URL</p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="flex-1 truncate rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs text-neutral-700">
                  {gateway.webhookUrl}
                </code>
                <Button type="button" variant="outline" size="sm" onClick={handleCopyWebhookUrl}>
                  {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-neutral-700">Required Events</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {gateway.requiredEvents.map((event) => (
                  <span key={event} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
                    {event}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-neutral-700">Steps</p>
              <ol className="mt-1.5 space-y-1.5">
                {SETUP_STEPS.map((step, index) => (
                  <li key={step} className="flex items-start gap-2 text-sm text-neutral-600">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[0.65rem] font-semibold text-primary-700">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <a
              href="https://dashboard.razorpay.com/app/keys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline"
            >
              <Link2 className="size-3.5" aria-hidden="true" />
              Open Razorpay API Keys page
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        </Card>
      )}

      <Modal
        isOpen={isDisconnectOpen}
        onClose={() => setIsDisconnectOpen(false)}
        title="Disconnect Razorpay?"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setIsDisconnectOpen(false)}>Cancel</Button>
            <Button type="button" variant="danger" loading={isDisconnecting} onClick={handleDisconnect}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Disconnect
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          New invoice payment links can&apos;t be created until Razorpay is configured again. Existing invoices, payment history, and
          payment-link history are preserved.
        </p>
      </Modal>
    </div>
  )
}
