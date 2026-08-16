import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Droplet, QrCode, Save, Upload } from 'lucide-react'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/toastContext'
import { getInvoiceSettings, updateInvoiceSettings } from '../../api/invoices'
import { uploadFile } from '../../api/files'

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

const sampleInvoice = {
  company: { name: 'SAAS CRM', address: '123, Business Park, Koramangala', cityLine: 'Bangalore, Karnataka - 560095', gstin: '29ABCDE1234F1Z5' },
  invoiceNo: 'INV-2026-1001',
  invoiceDate: '01 Jul 2026',
  dueDate: '16 Jul 2026',
  billTo: { name: 'Hotel Grand Meridian', address: '45, Residency Road', cityLine: 'Bangalore, Karnataka - 560025' },
  items: [
    { name: '20L Water Jar (Refill)', hsn: '22011010', qty: 40, unit: 'Jar', rate: 90, taxRate: 5, amount: 3780 },
    { name: 'Water Dispenser Rental', hsn: '99733100', qty: 2, unit: 'Unit', rate: 500, taxRate: 18, amount: 1180 },
  ],
  subtotal: 4600,
  taxTotal: 360,
  total: 4960,
  bank: { name: 'HDFC Bank', account: '50200012345678', ifsc: 'HDFC0001234' },
}

function money(value) {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ClassicPreview({ primaryColor, fields, footerText, terms }) {
  const { company, billTo, items, subtotal, taxTotal, total, bank } = sampleInvoice

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-start justify-between border-b-2 pb-3" style={{ borderColor: primaryColor }}>
        <div>
          <p className="text-sm font-bold" style={{ color: primaryColor }}>{company.name}</p>
          <p className="mt-1 leading-4 text-neutral-500">{company.address}<br />{company.cityLine}</p>
          {fields.show_company_gstin && <p className="mt-1 text-neutral-500">GSTIN: {company.gstin}</p>}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tracking-wide text-neutral-900">TAX INVOICE</p>
          <p className="mt-1 text-neutral-500">Invoice No: {sampleInvoice.invoiceNo}</p>
          <p className="text-neutral-500">Date: {sampleInvoice.invoiceDate}</p>
          <p className="text-neutral-500">Due: {sampleInvoice.dueDate}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {fields.show_billing_address && (
          <div>
            <p className="font-semibold text-neutral-700">Bill To</p>
            <p className="mt-1 text-neutral-500">{billTo.name}<br />{billTo.address}<br />{billTo.cityLine}</p>
          </div>
        )}
        {fields.show_shipping_address && (
          <div>
            <p className="font-semibold text-neutral-700">Ship To</p>
            <p className="mt-1 text-neutral-500">{billTo.name}<br />{billTo.address}<br />{billTo.cityLine}</p>
          </div>
        )}
      </div>

      <table className="w-full border-t border-neutral-200 text-left">
        <thead>
          <tr className="border-b border-neutral-200 text-[0.6rem] uppercase text-neutral-400">
            <th className="py-1.5">#</th>
            <th className="py-1.5">Item</th>
            {fields.show_hsn_sac && <th className="py-1.5">HSN</th>}
            <th className="py-1.5">Qty</th>
            <th className="py-1.5">Rate</th>
            {fields.show_tax_rate && <th className="py-1.5">Tax</th>}
            <th className="py-1.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.name} className="border-b border-neutral-50">
              <td className="py-1.5">{index + 1}</td>
              <td className="py-1.5">{item.name}</td>
              {fields.show_hsn_sac && <td className="py-1.5">{item.hsn}</td>}
              <td className="py-1.5">{item.qty}</td>
              <td className="py-1.5">{money(item.rate)}</td>
              {fields.show_tax_rate && <td className="py-1.5">{item.taxRate}%</td>}
              <td className="py-1.5 text-right">{money(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap justify-between gap-4 border-t border-neutral-200 pt-3">
        <div className="space-y-2">
          {fields.show_bank_details && (
            <div>
              <p className="font-semibold text-neutral-700">Bank Details</p>
              <p className="mt-1 text-neutral-500">{bank.name}<br />A/C: {bank.account} · IFSC: {bank.ifsc}</p>
            </div>
          )}
          {fields.show_upi_qr && (
            <div className="flex items-center gap-2">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
                <QrCode className="size-5 text-neutral-400" />
              </div>
              <p className="text-neutral-500">Scan to pay via UPI</p>
            </div>
          )}
        </div>
        <div className="min-w-36 space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          {fields.show_tax_amount && <div className="flex justify-between"><span>Tax</span><span>{money(taxTotal)}</span></div>}
          <div className="flex justify-between border-t border-neutral-200 pt-1 font-semibold text-neutral-900" style={{ color: primaryColor }}>
            <span>Total</span><span>{money(total)}</span>
          </div>
        </div>
      </div>

      {fields.show_terms && (
        <div className="border-t border-neutral-200 pt-3">
          <p className="font-semibold text-neutral-700">Terms & Conditions</p>
          <p className="mt-1 whitespace-pre-line text-neutral-500">{terms}</p>
        </div>
      )}

      <div className="flex items-end justify-between border-t border-neutral-200 pt-3">
        <p className="text-neutral-500">{footerText}</p>
        {fields.show_signature && (
          <div className="text-right">
            <p className="italic text-neutral-400">Signature</p>
            <p className="mt-1 text-neutral-500">Authorised Signatory</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ModernPreview({ primaryColor, fields, footerText, terms }) {
  const { company, billTo, items, subtotal, taxTotal, total, bank } = sampleInvoice

  return (
    <div className="space-y-4 font-sans">
      <div className="rounded-xl p-4 text-white" style={{ backgroundColor: primaryColor }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-bold tracking-wide">{company.name}</p>
            <p className="mt-1 leading-4 text-white/80">{company.address}<br />{company.cityLine}</p>
            {fields.show_company_gstin && <p className="mt-1 text-white/80">GSTIN: {company.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-widest">Invoice</p>
            <p className="mt-1 text-white/80">{sampleInvoice.invoiceNo}</p>
            <p className="text-white/80">{sampleInvoice.invoiceDate}</p>
          </div>
        </div>
      </div>

      {fields.show_billing_address && (
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
          <p className="text-[0.6rem] font-semibold uppercase tracking-wide text-neutral-400">Billed To</p>
          <p className="mt-1 font-medium text-neutral-800">{billTo.name}</p>
          <p className="text-neutral-500">{billTo.address}, {billTo.cityLine}</p>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.name} className="flex items-center justify-between rounded-lg border border-neutral-100 p-2.5">
            <div>
              <p className="font-medium text-neutral-800">{item.name}</p>
              <p className="text-neutral-400">
                {item.qty} × {money(item.rate)}
                {fields.show_hsn_sac ? ` · HSN ${item.hsn}` : ''}
                {fields.show_tax_rate ? ` · ${item.taxRate}% tax` : ''}
              </p>
            </div>
            <p className="font-semibold" style={{ color: primaryColor }}>{money(item.amount)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-neutral-100 p-3">
        <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
        {fields.show_tax_amount && <div className="flex justify-between"><span>Tax</span><span>{money(taxTotal)}</span></div>}
        <div className="mt-1 flex justify-between border-t border-neutral-200 pt-1 font-bold" style={{ color: primaryColor }}>
          <span>Total</span><span>{money(total)}</span>
        </div>
      </div>

      {(fields.show_bank_details || fields.show_upi_qr) && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-neutral-500">
          {fields.show_bank_details && <p>{bank.name} · {bank.account}</p>}
          {fields.show_upi_qr && (
            <div className="flex items-center gap-1.5">
              <QrCode className="size-4" /> Scan to pay
            </div>
          )}
        </div>
      )}

      {fields.show_terms && (
        <p className="whitespace-pre-line border-t border-neutral-100 pt-3 text-neutral-500">{terms}</p>
      )}

      <div className="flex items-end justify-between border-t border-neutral-100 pt-3">
        <p className="text-neutral-500">{footerText}</p>
        {fields.show_signature && <p className="text-right italic text-neutral-400">Authorised Signatory</p>}
      </div>
    </div>
  )
}

function CompactPreview({ fields, footerText, terms, primaryColor }) {
  const { company, items, subtotal, taxTotal, total } = sampleInvoice

  return (
    <div className="space-y-2 font-sans text-[0.65rem] leading-tight">
      <div className="flex items-center justify-between">
        <p className="font-bold" style={{ color: primaryColor }}>{company.name}</p>
        <p className="text-neutral-500">{sampleInvoice.invoiceNo} · {sampleInvoice.invoiceDate}</p>
      </div>
      {fields.show_company_gstin && <p className="text-neutral-400">GSTIN: {company.gstin}</p>}

      <table className="w-full border-t border-neutral-200 text-left">
        <thead>
          <tr className="text-[0.55rem] uppercase text-neutral-400">
            <th className="py-1">Item</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">Rate</th>
            <th className="py-1 text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.name} className="border-t border-neutral-100">
              <td className="py-0.5">{item.name}</td>
              <td className="py-0.5 text-right">{item.qty}</td>
              <td className="py-0.5 text-right">{money(item.rate)}</td>
              <td className="py-0.5 text-right">{money(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between border-t border-neutral-200 pt-1">
        <span>Subtotal</span><span>{money(subtotal)}</span>
      </div>
      {fields.show_tax_amount && (
        <div className="flex justify-between"><span>Tax</span><span>{money(taxTotal)}</span></div>
      )}
      <div className="flex justify-between border-t border-neutral-200 pt-1 font-bold" style={{ color: primaryColor }}>
        <span>Total</span><span>{money(total)}</span>
      </div>

      {fields.show_terms && <p className="border-t border-neutral-100 pt-1 text-neutral-400">{terms}</p>}
      <p className="text-neutral-400">{footerText}</p>
    </div>
  )
}

function ThermalPreview({ fields, footerText, primaryColor }) {
  const { company, items, subtotal, taxTotal, total } = sampleInvoice

  return (
    <div className="space-y-2 font-mono text-[0.65rem] leading-tight text-neutral-700">
      <div className="text-center">
        <p className="font-bold" style={{ color: primaryColor }}>{company.name}</p>
        <p className="text-neutral-500">{company.address}</p>
        <p className="text-neutral-500">{company.cityLine}</p>
        {fields.show_company_gstin && <p className="text-neutral-500">GSTIN {company.gstin}</p>}
      </div>
      <div className="border-t border-dashed border-neutral-300 pt-1.5 text-center text-neutral-500">
        <p>{sampleInvoice.invoiceNo}</p>
        <p>{sampleInvoice.invoiceDate}</p>
      </div>
      <div className="space-y-1 border-t border-dashed border-neutral-300 pt-1.5">
        {items.map((item) => (
          <div key={item.name}>
            <p className="truncate">{item.name}</p>
            <div className="flex justify-between text-neutral-500">
              <span>{item.qty} x {money(item.rate)}</span>
              <span>{money(item.amount)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-0.5 border-t border-dashed border-neutral-300 pt-1.5">
        <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
        {fields.show_tax_amount && <div className="flex justify-between"><span>Tax</span><span>{money(taxTotal)}</span></div>}
        <div className="flex justify-between font-bold"><span>TOTAL</span><span>{money(total)}</span></div>
      </div>
      <p className="border-t border-dashed border-neutral-300 pt-1.5 text-center text-neutral-500">{footerText || 'Thank you!'}</p>
    </div>
  )
}

const templateComponents = {
  classic: ClassicPreview,
  modern: ModernPreview,
  compact: CompactPreview,
  thermal: ThermalPreview,
}

function InvoicePreviewPanel({ template, primaryColor, paperSize, fields, footerText, terms }) {
  const paperClass = paperSize === 'A5' ? 'max-w-sm' : paperSize === 'thermal' ? 'max-w-52' : 'max-w-lg'
  const TemplateComponent = templateComponents[template] || ClassicPreview

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
