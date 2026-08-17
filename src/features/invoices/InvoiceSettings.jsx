import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Droplet, Save, Upload } from 'lucide-react'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/toastContext'
import { getInvoiceSettings, updateInvoiceSettings } from '../../api/invoices'
import { uploadFile } from '../../api/files'
import { templateComponents } from './invoiceTemplates'

const templates = [
  { value: 'classic', label: 'Classic' },
  { value: 'modern', label: 'Modern' },
  { value: 'compact', label: 'Compact' },
  { value: 'thermal', label: 'Thermal' },
]

const paperSizes = [
  { value: 'A4', label: 'A4' },
  { value: 'A5', label: 'A5' },
  { value: 'thermal', label: 'Thermal' },
]

const colorOptions = [
  { value: '#16A34A', label: '#16A34A' },
  { value: '#2563EB', label: '#2563EB' },
  { value: '#DC2626', label: '#DC2626' },
  { value: '#7C3AED', label: '#7C3AED' },
  { value: '#0F172A', label: '#0F172A' },
]

// Exactly the 14 booleans the backend's `fields` object supports - no invented toggles.
const fieldRows = [
  [{ key: 'show_company_gstin', label: 'Company GSTIN' }, { key: 'show_customer_gstin', label: 'Customer GSTIN' }],
  [{ key: 'show_billing_address', label: 'Billing Address' }, { key: 'show_shipping_address', label: 'Shipping Address' }],
  [{ key: 'show_hsn_sac', label: 'HSN / SAC' }, { key: 'show_mrp', label: 'MRP' }],
  [{ key: 'show_discount', label: 'Discount' }, { key: 'show_tax_rate', label: 'Tax Rate' }],
  [{ key: 'show_tax_amount', label: 'Tax Amount' }, { key: 'show_batch_number', label: 'Batch Number' }],
  [{ key: 'show_expiry_date', label: 'Expiry Date' }, { key: 'show_bank_details', label: 'Bank Details' }],
  [{ key: 'show_upi_qr', label: 'UPI / QR Code' }, { key: 'show_terms', label: 'Terms & Conditions' }],
  [{ key: 'show_signature', label: 'Signature' }],
]

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-primary-600' : 'bg-neutral-200'}`}
    >
      <span className={`inline-block size-4.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5.5' : 'translate-x-1'}`} />
    </button>
  )
}

// Template rendering components (ClassicPreview/ModernPreview/CompactPreview/ThermalPreview)
// live in ./invoiceTemplates.jsx so InvoiceDetail.jsx can reuse them with real invoice data
// instead of duplicating a whole invoice-rendering system.
function InvoicePreviewPanel({ template, primaryColor, paperSize, fields, footerText, terms }) {
  const paperClass = paperSize === 'A5' ? 'max-w-sm' : paperSize === 'thermal' ? 'max-w-52' : 'max-w-lg'
  const TemplateComponent = templateComponents[template] || templateComponents.classic

  return (
    <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
      <p className="text-sm font-semibold text-neutral-900">Invoice Preview</p>
      <p className="text-xs text-neutral-400">This is how your invoice will look ({templates.find((t) => t.value === template)?.label} template)</p>

      <div className={`mx-auto mt-4 overflow-hidden rounded-xl border border-neutral-100 bg-white p-4 text-xs text-neutral-600 shadow-(--shadow-xs) ${paperClass}`}>
        <TemplateComponent primaryColor={primaryColor} fields={fields} footerText={footerText} terms={terms} />
      </div>
    </div>
  )
}

export default function InvoiceSettings() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [settings, setSettings] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)

  useEffect(() => {
    getInvoiceSettings().then((result) => {
      if (!result.success) {
        setLoadError(result.error)
        setIsLoading(false)
        return
      }
      setSettings(result.settings)
      setIsLoading(false)
    })
  }, [])

  if (isLoading) {
    return (
      <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-10 shadow-(--shadow-card)">
        <LoadingSpinner label="Loading invoice settings..." />
      </div>
    )
  }

  if (loadError || !settings) {
    return (
      <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-10 text-center shadow-(--shadow-card)">
        <p className="text-sm text-red-600">{loadError || 'Unable to load invoice settings.'}</p>
      </div>
    )
  }

  const toggleField = (key) => setSettings((current) => ({ ...current, fields: { ...current.fields, [key]: !current.fields[key] } }))

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setIsUploadingLogo(true)
    const result = await uploadFile(file)
    setIsUploadingLogo(false)

    if (!result.success) {
      showToast({ title: 'Upload failed', message: result.error, variant: 'error' })
      return
    }

    setSettings((current) => ({ ...current, branding: { ...current.branding, logoFileId: result.file.file_id } }))
  }

  const handleSave = async () => {
    setIsSaving(true)

    const result = await updateInvoiceSettings(settings)

    if (!result.success) {
      showToast({ title: 'Save failed', message: result.error, variant: 'error' })
      setIsSaving(false)
      return
    }

    setSettings(result.settings)
    setIsSaving(false)
    showToast({ title: 'Settings saved', message: 'Invoice template preferences updated.' })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/invoices')}
            aria-label="Back to invoices"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Invoice Settings</h1>
            <p className="mt-1 text-sm text-neutral-500">Manage the invoice template, branding, and which fields print on generated PDFs</p>
          </div>
        </div>
        <Button type="button" loading={isSaving} onClick={handleSave}>
          <Save className="size-4" />
          Save Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <p className="text-sm font-semibold text-neutral-900">1. Choose Template</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {templates.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSettings((current) => ({ ...current, template: option.value }))}
                  className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-colors ${
                    settings.template === option.value ? 'border-primary-500 bg-primary-50/40' : 'border-neutral-100 hover:border-neutral-200'
                  }`}
                >
                  {settings.template === option.value && (
                    <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-primary-600 text-white">
                      <Check className="size-2.5" />
                    </span>
                  )}
                  <div className="flex aspect-3/4 w-full flex-col gap-1 rounded-lg border border-neutral-100 bg-neutral-50 p-2">
                    <div className="h-1.5 w-1/2 rounded-full" style={{ backgroundColor: settings.branding.primaryColor }} />
                    <div className="mt-1 h-px w-full bg-neutral-200" />
                    <div className="h-1 w-full rounded-full bg-neutral-200" />
                    <div className="h-1 w-full rounded-full bg-neutral-200" />
                  </div>
                  <p className="text-xs font-medium text-neutral-700">{option.label}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <p className="text-sm font-semibold text-neutral-900">2. Branding & Paper</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-neutral-700">Business Logo</p>
                <label className="mt-1.5 flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 text-xs text-neutral-400 hover:border-primary-300">
                  {isUploadingLogo ? <LoadingSpinner /> : (
                    <>
                      <Upload className="size-4" />
                      {settings.branding.logoFileId ? 'Replace Logo' : 'Upload Logo'}
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={isUploadingLogo} />
                </label>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-700">Primary Color</p>
                <Select
                  className="mt-1.5"
                  options={colorOptions}
                  value={settings.branding.primaryColor}
                  onChange={(event) => setSettings((current) => ({ ...current, branding: { ...current.branding, primaryColor: event.target.value } }))}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-700">Paper Size</p>
                <Select
                  className="mt-1.5"
                  options={paperSizes}
                  value={settings.paperSize}
                  onChange={(event) => setSettings((current) => ({ ...current, paperSize: event.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <p className="text-sm font-semibold text-neutral-900">3. Show / Hide Fields</p>
            <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {fieldRows.flat().map((field) => (
                <div key={field.key} className="flex items-center justify-between gap-3">
                  <p className="text-sm text-neutral-700">{field.label}</p>
                  <Toggle checked={Boolean(settings.fields[field.key])} onChange={() => toggleField(field.key)} />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <p className="text-sm font-semibold text-neutral-900">4. Footer Text</p>
            <textarea
              value={settings.footerText}
              maxLength={200}
              onChange={(event) => setSettings((current) => ({ ...current, footerText: event.target.value }))}
              className="mt-3 h-16 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
            <p className="mt-1 text-right text-xs text-neutral-400">{settings.footerText.length}/200</p>
          </div>

          <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
            <p className="text-sm font-semibold text-neutral-900">5. Terms & Conditions</p>
            <textarea
              value={settings.terms}
              maxLength={500}
              onChange={(event) => setSettings((current) => ({ ...current, terms: event.target.value }))}
              className="mt-3 h-28 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
            <p className="mt-1 text-right text-xs text-neutral-400">{settings.terms.length}/500</p>
          </div>
        </div>

        <InvoicePreviewPanel
          template={settings.template}
          primaryColor={settings.branding.primaryColor}
          paperSize={settings.paperSize}
          fields={settings.fields}
          footerText={settings.footerText}
          terms={settings.terms}
        />
      </div>
      <p className="text-xs text-neutral-400 flex items-center gap-1.5"><Droplet className="size-3" aria-hidden="true" /> Preview uses sample data — actual invoices pull your real company details.</p>
    </div>
  )
}
