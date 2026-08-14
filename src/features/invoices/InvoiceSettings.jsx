import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Droplet, QrCode, RotateCcw, Save, Upload } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs'
import { useToast } from '../../components/ui/toastContext'

const templates = [
  { value: 'classic', label: 'Classic' },
  { value: 'modern', label: 'Modern' },
  { value: 'compact', label: 'Compact' },
  { value: 'thermal', label: 'Thermal' },
]

const paperSizes = ['A4', 'A5', 'Thermal']

const colorOptions = [
  { value: '#16A34A', label: '#16A34A' },
  { value: '#2563EB', label: '#2563EB' },
  { value: '#DC2626', label: '#DC2626' },
  { value: '#7C3AED', label: '#7C3AED' },
  { value: '#0F172A', label: '#0F172A' },
]

const defaultFields = {
  gstin: true,
  hsnSac: true,
  discount: true,
  tax: true,
  batch: false,
  expiry: false,
  bankDetails: true,
  upiQrCode: true,
  termsAndConditions: true,
  signature: true,
}

const fieldRows = [
  [{ key: 'gstin', label: 'GSTIN' }, { key: 'hsnSac', label: 'HSN / SAC' }],
  [{ key: 'discount', label: 'Discount' }, { key: 'tax', label: 'Tax' }],
  [{ key: 'batch', label: 'Batch' }, { key: 'expiry', label: 'Expiry' }],
  [{ key: 'bankDetails', label: 'Bank Details' }, { key: 'upiQrCode', label: 'UPI / QR Code' }],
  [{ key: 'termsAndConditions', label: 'Terms & Conditions' }, { key: 'signature', label: 'Signature' }],
]

const defaultFooterText = 'Thank you for your business!'
const defaultTerms = [
  '1. Goods once sold will not be taken back.',
  '2. Interest @ 18% p.a. will be charged on overdue payments.',
  '3. Subject to jurisdiction of Bangalore courts only.',
].join('\n')

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
  invoiceNo: 'SO-2026-1001',
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
          {fields.gstin && <p className="mt-1 text-neutral-500">GSTIN: {company.gstin}</p>}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tracking-wide text-neutral-900">TAX INVOICE</p>
          <p className="mt-1 text-neutral-500">Invoice No: {sampleInvoice.invoiceNo}</p>
          <p className="text-neutral-500">Date: {sampleInvoice.invoiceDate}</p>
          <p className="text-neutral-500">Due: {sampleInvoice.dueDate}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="font-semibold text-neutral-700">Bill To</p>
          <p className="mt-1 text-neutral-500">{billTo.name}<br />{billTo.address}<br />{billTo.cityLine}</p>
        </div>
        <div>
          <p className="font-semibold text-neutral-700">Ship To</p>
          <p className="mt-1 text-neutral-500">{billTo.name}<br />{billTo.address}<br />{billTo.cityLine}</p>
        </div>
      </div>

      <table className="w-full border-t border-neutral-200 text-left">
        <thead>
          <tr className="border-b border-neutral-200 text-[0.6rem] uppercase text-neutral-400">
            <th className="py-1.5">#</th>
            <th className="py-1.5">Item</th>
            {fields.hsnSac && <th className="py-1.5">HSN</th>}
            <th className="py-1.5">Qty</th>
            <th className="py-1.5">Rate</th>
            {fields.tax && <th className="py-1.5">Tax</th>}
            <th className="py-1.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.name} className="border-b border-neutral-50">
              <td className="py-1.5">{index + 1}</td>
              <td className="py-1.5">{item.name}</td>
              {fields.hsnSac && <td className="py-1.5">{item.hsn}</td>}
              <td className="py-1.5">{item.qty}</td>
              <td className="py-1.5">{money(item.rate)}</td>
              {fields.tax && <td className="py-1.5">{item.taxRate}%</td>}
              <td className="py-1.5 text-right">{money(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap justify-between gap-4 border-t border-neutral-200 pt-3">
        <div className="space-y-2">
          {fields.bankDetails && (
            <div>
              <p className="font-semibold text-neutral-700">Bank Details</p>
              <p className="mt-1 text-neutral-500">{bank.name}<br />A/C: {bank.account} · IFSC: {bank.ifsc}</p>
            </div>
          )}
          {fields.upiQrCode && (
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
          <div className="flex justify-between"><span>Tax</span><span>{money(taxTotal)}</span></div>
          <div className="flex justify-between border-t border-neutral-200 pt-1 font-semibold text-neutral-900" style={{ color: primaryColor }}>
            <span>Total</span><span>{money(total)}</span>
          </div>
        </div>
      </div>

      {fields.termsAndConditions && (
        <div className="border-t border-neutral-200 pt-3">
          <p className="font-semibold text-neutral-700">Terms & Conditions</p>
          <p className="mt-1 whitespace-pre-line text-neutral-500">{terms}</p>
        </div>
      )}

      <div className="flex items-end justify-between border-t border-neutral-200 pt-3">
        <p className="text-neutral-500">{footerText}</p>
        {fields.signature && (
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
    <div className="-m-4 overflow-hidden font-sans">
      <div className="flex items-start justify-between px-4 py-4 text-white" style={{ backgroundColor: primaryColor }}>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold"><Droplet className="size-3.5" />{company.name}</p>
          <p className="mt-1 text-[0.65rem] leading-4 text-white/80">{company.address}, {company.cityLine}</p>
          {fields.gstin && <p className="text-[0.65rem] text-white/80">GSTIN: {company.gstin}</p>}
        </div>
        <div className="text-right">
          <p className="text-base font-bold tracking-wide">INVOICE</p>
          <p className="mt-1 text-[0.65rem] text-white/80">{sampleInvoice.invoiceNo}</p>
        </div>
      </div>

      <div className="space-y-4 p-4 text-neutral-600">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-neutral-50 p-2.5">
            <p className="text-[0.6rem] font-semibold uppercase tracking-wide text-neutral-400">Billed To</p>
            <p className="mt-1 font-medium text-neutral-800">{billTo.name}</p>
            <p className="text-neutral-500">{billTo.address}, {billTo.cityLine}</p>
          </div>
          <div className="rounded-lg bg-neutral-50 p-2.5">
            <p className="text-[0.6rem] font-semibold uppercase tracking-wide text-neutral-400">Details</p>
            <p className="mt-1 text-neutral-600">Date: {sampleInvoice.invoiceDate}</p>
            <p className="text-neutral-600">Due: {sampleInvoice.dueDate}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.name} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-neutral-800">{item.name}</p>
                <p className="text-[0.65rem] text-neutral-400">
                  {item.qty} {item.unit} × {money(item.rate)}{fields.tax ? ` · ${item.taxRate}% tax` : ''}{fields.hsnSac ? ` · HSN ${item.hsn}` : ''}
                </p>
              </div>
              <p className="shrink-0 font-semibold text-neutral-900">{money(item.amount)}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: `${primaryColor}14` }}>
          <div className="space-y-0.5 text-[0.65rem] text-neutral-500">
            <p>Subtotal {money(subtotal)}</p>
            <p>Tax {money(taxTotal)}</p>
          </div>
          <div className="rounded-full px-3.5 py-1.5 text-sm font-bold text-white" style={{ backgroundColor: primaryColor }}>
            Total {money(total)}
          </div>
        </div>

        {(fields.bankDetails || fields.upiQrCode) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3">
            {fields.bankDetails && <p className="text-neutral-500">{bank.name} · A/C {bank.account} · IFSC {bank.ifsc}</p>}
            {fields.upiQrCode && (
              <div className="flex items-center gap-2">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white">
                  <QrCode className="size-4.5 text-neutral-400" />
                </div>
                <p className="text-neutral-500">Scan to pay</p>
              </div>
            )}
          </div>
        )}

        {fields.termsAndConditions && (
          <div className="border-t border-neutral-100 pt-3">
            <p className="font-semibold text-neutral-700">Terms & Conditions</p>
            <p className="mt-1 whitespace-pre-line text-neutral-500">{terms}</p>
          </div>
        )}

        <div className="flex items-end justify-between border-t border-neutral-100 pt-3">
          <p className="font-medium" style={{ color: primaryColor }}>{footerText}</p>
          {fields.signature && (
            <div className="text-right">
              <p className="italic text-neutral-400">Signature</p>
              <p className="mt-1 text-neutral-500">Authorised Signatory</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CompactPreview({ primaryColor, fields, footerText, terms }) {
  const { company, billTo, items, subtotal, taxTotal, total, bank } = sampleInvoice

  return (
    <div className="space-y-1.5 font-sans text-[0.65rem] leading-tight">
      <div className="flex items-center justify-between border-b pb-1" style={{ borderColor: primaryColor }}>
        <p className="font-bold" style={{ color: primaryColor }}>{company.name}{fields.gstin ? ` · GSTIN ${company.gstin}` : ''}</p>
        <p className="font-semibold text-neutral-900">{sampleInvoice.invoiceNo} · {sampleInvoice.invoiceDate}</p>
      </div>

      <p className="text-neutral-500">Bill To: <span className="font-medium text-neutral-800">{billTo.name}</span>, {billTo.address}, {billTo.cityLine}</p>

      <table className="w-full border-t border-neutral-200 text-left">
        <thead>
          <tr className="border-b border-neutral-200 text-[0.55rem] uppercase text-neutral-400">
            <th className="py-1">Item</th>
            {fields.hsnSac && <th className="py-1">HSN</th>}
            <th className="py-1">Qty</th>
            <th className="py-1">Rate</th>
            {fields.tax && <th className="py-1">Tax</th>}
            <th className="py-1 text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.name} className="border-b border-neutral-50">
              <td className="py-0.5">{item.name}</td>
              {fields.hsnSac && <td className="py-0.5">{item.hsn}</td>}
              <td className="py-0.5">{item.qty}</td>
              <td className="py-0.5">{money(item.rate)}</td>
              {fields.tax && <td className="py-0.5">{item.taxRate}%</td>}
              <td className="py-0.5 text-right">{money(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between border-t border-neutral-200 pt-1">
        <p className="text-neutral-400">
          {fields.bankDetails ? `${bank.name} · A/C ${bank.account} · IFSC ${bank.ifsc}` : ''}
        </p>
        <p className="font-semibold text-neutral-900">
          Sub {money(subtotal)} + Tax {money(taxTotal)} = <span style={{ color: primaryColor }}>{money(total)}</span>
        </p>
      </div>

      {fields.termsAndConditions && <p className="border-t border-neutral-200 pt-1 whitespace-pre-line text-neutral-400">{terms}</p>}

      <div className="flex items-center justify-between border-t border-neutral-200 pt-1 text-neutral-400">
        <span>{footerText}</span>
        {fields.signature && <span className="italic">Authorised Signatory</span>}
      </div>
    </div>
  )
}

function ThermalPreview({ primaryColor, fields, footerText, terms }) {
  const { company, billTo, items, subtotal, taxTotal, total } = sampleInvoice
  const dashedLine = '- - - - - - - - - - - - - -'

  return (
    <div className="space-y-2 text-center font-mono text-[0.65rem] leading-tight text-neutral-700">
      <p className="text-sm font-bold" style={{ color: primaryColor }}>{company.name}</p>
      <p className="text-neutral-500">{company.address}</p>
      <p className="text-neutral-500">{company.cityLine}</p>
      {fields.gstin && <p className="text-neutral-500">GSTIN {company.gstin}</p>}
      <p className="text-neutral-300">{dashedLine}</p>
      <p>{sampleInvoice.invoiceNo}</p>
      <p className="text-neutral-500">{sampleInvoice.invoiceDate}</p>
      <p className="text-neutral-500">Bill To: {billTo.name}</p>
      <p className="text-neutral-300">{dashedLine}</p>

      <div className="space-y-1 text-left">
        {items.map((item) => (
          <div key={item.name}>
            <p className="truncate">{item.name}</p>
            <div className="flex justify-between text-neutral-500">
              <span>{item.qty} x {money(item.rate)}{fields.tax ? ` (${item.taxRate}%)` : ''}</span>
              <span>{money(item.amount)}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-neutral-300">{dashedLine}</p>
      <div className="space-y-0.5 text-left">
        <div className="flex justify-between text-neutral-500"><span>Subtotal</span><span>{money(subtotal)}</span></div>
        <div className="flex justify-between text-neutral-500"><span>Tax</span><span>{money(taxTotal)}</span></div>
        <div className="flex justify-between text-sm font-bold" style={{ color: primaryColor }}><span>TOTAL</span><span>{money(total)}</span></div>
      </div>
      <p className="text-neutral-300">{dashedLine}</p>

      {fields.upiQrCode && (
        <div className="flex justify-center py-1">
          <div className="flex size-12 items-center justify-center rounded border border-neutral-300">
            <QrCode className="size-6 text-neutral-400" />
          </div>
        </div>
      )}

      {fields.termsAndConditions && <p className="whitespace-pre-line text-neutral-400">{terms}</p>}
      <p className="font-semibold text-neutral-700">{footerText}</p>
      {fields.signature && <p className="text-neutral-400">* Authorised Signatory *</p>}
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
  const paperClass = paperSize === 'A5' ? 'max-w-sm' : paperSize === 'Thermal' ? 'max-w-52' : 'max-w-lg'
  const TemplateComponent = templateComponents[template] || ClassicPreview

  return (
    <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
      <p className="text-sm font-semibold text-neutral-900">Invoice Preview</p>
      <p className="text-xs text-neutral-400">This is how your invoice will look like ({templates.find((t) => t.value === template)?.label} template)</p>

      <div className={`mx-auto mt-4 overflow-hidden rounded-xl border border-neutral-100 bg-white p-4 text-xs text-neutral-600 shadow-(--shadow-xs) ${paperClass}`}>
        <TemplateComponent primaryColor={primaryColor} fields={fields} footerText={footerText} terms={terms} />
      </div>
    </div>
  )
}

function TemplateThumbnail({ value, primaryColor }) {
  if (value === 'modern') {
    return (
      <div className="flex aspect-3/4 w-full flex-col overflow-hidden rounded-lg border border-neutral-100 bg-white">
        <div className="h-6 w-full shrink-0" style={{ backgroundColor: primaryColor }} />
        <div className="flex flex-1 flex-col gap-1 p-2">
          <div className="h-2.5 w-full rounded bg-neutral-100" />
          <div className="h-2.5 w-full rounded bg-neutral-100" />
          <div className="mt-auto h-2 w-2/3 self-end rounded-full" style={{ backgroundColor: primaryColor, opacity: 0.85 }} />
        </div>
      </div>
    )
  }

  if (value === 'compact') {
    return (
      <div className="flex aspect-3/4 w-full flex-col gap-0.75 rounded-lg border border-neutral-100 bg-neutral-50 p-2">
        <div className="h-1 w-2/3 rounded-full" style={{ backgroundColor: primaryColor }} />
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-0.75 w-full rounded-full bg-neutral-200" />
        ))}
      </div>
    )
  }

  if (value === 'thermal') {
    return (
      <div className="flex aspect-3/4 w-full items-center justify-center rounded-lg border border-neutral-100 bg-neutral-50 p-2">
        <div className="flex w-2/3 flex-col items-center gap-1">
          <div className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: primaryColor }} />
          <div className="h-1 w-full rounded-full border border-dashed border-neutral-300" />
          <div className="h-1 w-full rounded-full bg-neutral-200" />
          <div className="h-1 w-full rounded-full bg-neutral-200" />
          <div className="h-1 w-full rounded-full border border-dashed border-neutral-300" />
          <div className="h-1.5 w-1/2 rounded-full bg-neutral-300" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex aspect-3/4 w-full flex-col gap-1 rounded-lg border border-neutral-100 bg-neutral-50 p-2">
      <div className="h-1.5 w-1/2 rounded-full" style={{ backgroundColor: primaryColor }} />
      <div className="mt-1 h-px w-full bg-neutral-200" />
      <div className="h-1 w-full rounded-full bg-neutral-200" />
      <div className="h-1 w-full rounded-full bg-neutral-200" />
      <div className="h-1 w-2/3 rounded-full bg-neutral-200" />
    </div>
  )
}

function TemplatesTab({ template, setTemplate, primaryColor, setPrimaryColor, paperSize, setPaperSize, fields, setFields, footerText, setFooterText, terms, setTerms }) {
  const toggleField = (key) => setFields((current) => ({ ...current, [key]: !current[key] }))

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
          <p className="text-sm font-semibold text-neutral-900">1. Choose Template</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {templates.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTemplate(option.value)}
                className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-colors ${
                  template === option.value ? 'border-primary-500 bg-primary-50/40' : 'border-neutral-100 hover:border-neutral-200'
                }`}
              >
                {template === option.value && (
                  <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-primary-600 text-white">
                    <Check className="size-2.5" />
                  </span>
                )}
                <TemplateThumbnail value={option.value} primaryColor={primaryColor} />
                <p className="text-xs font-medium text-neutral-700">{option.label}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
          <p className="text-sm font-semibold text-neutral-900">2. Branding & Appearance</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-neutral-700">Business Logo</p>
              <label className="mt-1.5 flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 text-xs text-neutral-400 hover:border-primary-300">
                <Upload className="size-4" />
                Upload Logo
                <span>PNG, JPG up to 2MB</span>
                <input type="file" accept="image/*" className="hidden" />
              </label>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-700">Primary Color</p>
              <Select className="mt-1.5" options={colorOptions} value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-700">Paper Size</p>
              <div className="mt-1.5 flex gap-2">
                {paperSizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setPaperSize(size)}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium ${
                      paperSize === size ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-neutral-200 text-neutral-600'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
          <p className="text-sm font-semibold text-neutral-900">3. Show / Hide Fields</p>
          <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {fieldRows.flat().map((field) => (
              <div key={field.key} className="flex items-center justify-between gap-3">
                <p className="text-sm text-neutral-700">{field.label}</p>
                <Toggle checked={fields[field.key]} onChange={() => toggleField(field.key)} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
          <p className="text-sm font-semibold text-neutral-900">4. Footer Text</p>
          <textarea
            value={footerText}
            maxLength={200}
            onChange={(event) => setFooterText(event.target.value)}
            className="mt-3 h-16 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
          />
          <p className="mt-1 text-right text-xs text-neutral-400">{footerText.length}/200</p>
        </div>

        <div className="rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
          <p className="text-sm font-semibold text-neutral-900">5. Terms & Conditions</p>
          <textarea
            value={terms}
            maxLength={500}
            onChange={(event) => setTerms(event.target.value)}
            className="mt-3 h-28 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
          />
          <p className="mt-1 text-right text-xs text-neutral-400">{terms.length}/500</p>
        </div>
      </div>

      <InvoicePreviewPanel template={template} primaryColor={primaryColor} paperSize={paperSize} fields={fields} footerText={footerText} terms={terms} />
    </div>
  )
}

function GeneralTab({ dueDays, setDueDays, currency, setCurrency, dateFormat, setDateFormat }) {
  return (
    <div className="max-w-2xl space-y-4 rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
      <p className="text-sm font-semibold text-neutral-900">General</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Default Due Period (days)" type="number" min="0" value={dueDays} onChange={(event) => setDueDays(event.target.value)} />
        <Select
          label="Currency"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          options={[{ value: 'INR', label: 'Indian Rupee (₹)' }, { value: 'USD', label: 'US Dollar ($)' }]}
        />
        <Select
          label="Date Format"
          value={dateFormat}
          onChange={(event) => setDateFormat(event.target.value)}
          options={[{ value: 'dd-mmm-yyyy', label: '01 Jul 2026' }, { value: 'dd/mm/yyyy', label: '01/07/2026' }]}
          className="sm:col-span-2"
        />
      </div>
    </div>
  )
}

function NumberingTab({ prefix, setPrefix, startingNumber, setStartingNumber, resetCycle, setResetCycle }) {
  return (
    <div className="max-w-2xl space-y-4 rounded-[1.25rem] border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
      <p className="text-sm font-semibold text-neutral-900">Numbering</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Invoice Prefix" value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="INV-2026-" />
        <Input label="Starting Number" type="number" min="1" value={startingNumber} onChange={(event) => setStartingNumber(event.target.value)} />
        <Select
          label="Reset Cycle"
          value={resetCycle}
          onChange={(event) => setResetCycle(event.target.value)}
          options={[{ value: 'never', label: 'Never' }, { value: 'yearly', label: 'Every Financial Year' }, { value: 'monthly', label: 'Every Month' }]}
          className="sm:col-span-2"
        />
      </div>
      <p className="text-xs text-neutral-400">Next invoice number preview: {prefix}{startingNumber}</p>
    </div>
  )
}

export default function InvoiceSettings() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [template, setTemplate] = useState('classic')
  const [primaryColor, setPrimaryColor] = useState('#16A34A')
  const [paperSize, setPaperSize] = useState('A4')
  const [fields, setFields] = useState(defaultFields)
  const [footerText, setFooterText] = useState(defaultFooterText)
  const [terms, setTerms] = useState(defaultTerms)

  const [dueDays, setDueDays] = useState('15')
  const [currency, setCurrency] = useState('INR')
  const [dateFormat, setDateFormat] = useState('dd-mmm-yyyy')

  const [prefix, setPrefix] = useState('INV-2026-')
  const [startingNumber, setStartingNumber] = useState('1043')
  const [resetCycle, setResetCycle] = useState('yearly')

  const handleReset = () => {
    setTemplate('classic')
    setPrimaryColor('#16A34A')
    setPaperSize('A4')
    setFields(defaultFields)
    setFooterText(defaultFooterText)
    setTerms(defaultTerms)
    showToast({ title: 'Settings reset', message: 'Invoice settings restored to defaults.' })
  }

  const handleSave = () => {
    showToast({ title: 'Settings saved', message: 'Invoice template and numbering preferences updated.' })
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
            <p className="mt-1 text-sm text-neutral-500">Manage invoice templates, appearance and numbering preferences</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Button type="button" variant="outline" onClick={handleReset}>
            <RotateCcw className="size-4" />
            Reset
          </Button>
          <Button type="button" onClick={handleSave}>
            <Save className="size-4" />
            Save Settings
          </Button>
        </div>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="numbering">Numbering</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-5">
          <GeneralTab dueDays={dueDays} setDueDays={setDueDays} currency={currency} setCurrency={setCurrency} dateFormat={dateFormat} setDateFormat={setDateFormat} />
        </TabsContent>

        <TabsContent value="templates" className="mt-5">
          <TemplatesTab
            template={template}
            setTemplate={setTemplate}
            primaryColor={primaryColor}
            setPrimaryColor={setPrimaryColor}
            paperSize={paperSize}
            setPaperSize={setPaperSize}
            fields={fields}
            setFields={setFields}
            footerText={footerText}
            setFooterText={setFooterText}
            terms={terms}
            setTerms={setTerms}
          />
        </TabsContent>

        <TabsContent value="numbering" className="mt-5">
          <NumberingTab
            prefix={prefix}
            setPrefix={setPrefix}
            startingNumber={startingNumber}
            setStartingNumber={setStartingNumber}
            resetCycle={resetCycle}
            setResetCycle={setResetCycle}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
