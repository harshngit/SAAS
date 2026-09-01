import { QrCode } from 'lucide-react'

// Shared sample data for the Invoice Settings page's "how will this look" preview - real
// invoice data (see InvoiceDetail.jsx) is shaped identically and passed as the `data` prop.
export const sampleInvoice = {
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

export function money(value) {
  const amount = Number(value) || 0
  return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDateLabel(dateString) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Shapes real invoice + organization data exactly like sampleInvoice above, so the same
// template renderers used for the Invoice Settings preview work unmodified for a real invoice
// (InvoiceDetail.jsx's on-screen preview and InvoicePrintView.jsx's headless-render-to-PDF page
// both call this - one place that defines what "the invoice" looks like as template props).
export function buildInvoicePreviewData(invoice, org) {
  const company = org || {}

  return {
    company: {
      name: company.name || 'Your Company',
      address: company.registered_address || company.address || '',
      cityLine: [company.city, company.state, company.pin_code].filter(Boolean).join(', '),
      gstin: company.gst_number || '',
    },
    invoiceNo: invoice.invoiceNumber,
    invoiceDate: formatDateLabel(invoice.invoiceDate),
    dueDate: formatDateLabel(invoice.dueDate),
    billTo: {
      name: invoice.customerName || invoice.walkInName || 'Walk-in Customer',
      address: invoice.billingAddress || '',
      cityLine: '',
    },
    items: (invoice.items || []).map((item) => ({
      name: item.productName,
      hsn: item.hsnCode,
      qty: item.quantity,
      unit: '',
      rate: item.unitPrice,
      taxRate: item.taxRate,
      amount: item.lineTotal,
    })),
    subtotal: invoice.subtotal,
    taxTotal: invoice.tax,
    total: invoice.total,
    bank: {
      name: company.bank_name || '',
      account: company.bank_account_details || '',
      ifsc: company.bank_ifsc || '',
    },
  }
}

export function ClassicPreview({ primaryColor, fields, footerText, terms, data = sampleInvoice }) {
  const { company, billTo, items, subtotal, taxTotal, total, bank } = data

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-start justify-between border-b-2 pb-3" style={{ borderColor: primaryColor }}>
        <div>
          <p className="text-sm font-bold" style={{ color: primaryColor }}>{company.name}</p>
          <p className="mt-1 leading-4 text-neutral-500">{company.address}<br />{company.cityLine}</p>
          {fields.show_company_gstin && company.gstin && <p className="mt-1 text-neutral-500">GSTIN: {company.gstin}</p>}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tracking-wide text-neutral-900">TAX INVOICE</p>
          <p className="mt-1 text-neutral-500">Invoice No: {data.invoiceNo}</p>
          <p className="text-neutral-500">Date: {data.invoiceDate}</p>
          <p className="text-neutral-500">Due: {data.dueDate}</p>
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

      <div className="overflow-x-auto">
        <table className="w-full border-t border-neutral-200 text-left">
          <thead>
            <tr className="border-b border-neutral-200 text-[0.6rem] uppercase text-neutral-400">
              <th className="py-1.5 pr-2">#</th>
              <th className="py-1.5 pr-2">Item</th>
              {fields.show_hsn_sac && <th className="whitespace-nowrap py-1.5 pr-2">HSN</th>}
              <th className="whitespace-nowrap py-1.5 pr-2">Qty</th>
              <th className="whitespace-nowrap py-1.5 pr-2">Rate</th>
              {fields.show_tax_rate && <th className="whitespace-nowrap py-1.5 pr-2">Tax</th>}
              <th className="whitespace-nowrap py-1.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.name + index} className="border-b border-neutral-50">
                <td className="py-1.5 pr-2">{index + 1}</td>
                <td className="py-1.5 pr-2">{item.name}</td>
                {fields.show_hsn_sac && <td className="whitespace-nowrap py-1.5 pr-2">{item.hsn}</td>}
                <td className="whitespace-nowrap py-1.5 pr-2">{item.qty}</td>
                <td className="whitespace-nowrap py-1.5 pr-2">{money(item.rate)}</td>
                {fields.show_tax_rate && <td className="whitespace-nowrap py-1.5 pr-2">{item.taxRate ? `${item.taxRate}%` : '—'}</td>}
                <td className="whitespace-nowrap py-1.5 text-right">{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap justify-between gap-4 border-t border-neutral-200 pt-3">
        <div className="space-y-2">
          {fields.show_bank_details && bank?.name && (
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

      {fields.show_terms && terms && (
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

export function ModernPreview({ primaryColor, fields, footerText, terms, data = sampleInvoice }) {
  const { company, billTo, items, subtotal, taxTotal, total, bank } = data

  return (
    <div className="space-y-4 font-sans">
      <div className="rounded-xl p-4 text-white" style={{ backgroundColor: primaryColor }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-bold tracking-wide">{company.name}</p>
            <p className="mt-1 leading-4 text-white/80">{company.address}<br />{company.cityLine}</p>
            {fields.show_company_gstin && company.gstin && <p className="mt-1 text-white/80">GSTIN: {company.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-widest">Invoice</p>
            <p className="mt-1 text-white/80">{data.invoiceNo}</p>
            <p className="text-white/80">{data.invoiceDate}</p>
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
        {items.map((item, index) => (
          <div key={item.name + index} className="flex items-center justify-between rounded-lg border border-neutral-100 p-2.5">
            <div>
              <p className="font-medium text-neutral-800">{item.name}</p>
              <p className="text-neutral-400">
                {item.qty} × {money(item.rate)}
                {fields.show_hsn_sac && item.hsn ? ` · HSN ${item.hsn}` : ''}
                {fields.show_tax_rate && item.taxRate ? ` · ${item.taxRate}% tax` : ''}
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
          {fields.show_bank_details && bank?.name && <p>{bank.name} · {bank.account}</p>}
          {fields.show_upi_qr && (
            <div className="flex items-center gap-1.5">
              <QrCode className="size-4" /> Scan to pay
            </div>
          )}
        </div>
      )}

      {fields.show_terms && terms && (
        <p className="whitespace-pre-line border-t border-neutral-100 pt-3 text-neutral-500">{terms}</p>
      )}

      <div className="flex items-end justify-between border-t border-neutral-100 pt-3">
        <p className="text-neutral-500">{footerText}</p>
        {fields.show_signature && <p className="text-right italic text-neutral-400">Authorised Signatory</p>}
      </div>
    </div>
  )
}

export function CompactPreview({ fields, footerText, terms, primaryColor, data = sampleInvoice }) {
  const { company, items, subtotal, taxTotal, total } = data

  return (
    <div className="space-y-2 font-sans text-[0.65rem] leading-tight">
      <div className="flex items-center justify-between">
        <p className="font-bold" style={{ color: primaryColor }}>{company.name}</p>
        <p className="text-neutral-500">{data.invoiceNo} · {data.invoiceDate}</p>
      </div>
      {fields.show_company_gstin && company.gstin && <p className="text-neutral-400">GSTIN: {company.gstin}</p>}

      <div className="overflow-x-auto">
        <table className="w-full border-t border-neutral-200 text-left">
          <thead>
            <tr className="text-[0.55rem] uppercase text-neutral-400">
              <th className="py-1 pr-2">Item</th>
              <th className="whitespace-nowrap py-1 pl-2 text-right">Qty</th>
              <th className="whitespace-nowrap py-1 pl-2 text-right">Rate</th>
              <th className="whitespace-nowrap py-1 pl-2 text-right">Amt</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.name + index} className="border-t border-neutral-100">
                <td className="py-0.5 pr-2">{item.name}</td>
                <td className="whitespace-nowrap py-0.5 pl-2 text-right">{item.qty}</td>
                <td className="whitespace-nowrap py-0.5 pl-2 text-right">{money(item.rate)}</td>
                <td className="whitespace-nowrap py-0.5 pl-2 text-right">{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between border-t border-neutral-200 pt-1">
        <span>Subtotal</span><span>{money(subtotal)}</span>
      </div>
      {fields.show_tax_amount && (
        <div className="flex justify-between"><span>Tax</span><span>{money(taxTotal)}</span></div>
      )}
      <div className="flex justify-between border-t border-neutral-200 pt-1 font-bold" style={{ color: primaryColor }}>
        <span>Total</span><span>{money(total)}</span>
      </div>

      {fields.show_terms && terms && <p className="border-t border-neutral-100 pt-1 text-neutral-400">{terms}</p>}
      <p className="text-neutral-400">{footerText}</p>
    </div>
  )
}

export function ThermalPreview({ fields, footerText, primaryColor, data = sampleInvoice }) {
  const { company, items, subtotal, taxTotal, total } = data

  return (
    <div className="space-y-2 font-mono text-[0.65rem] leading-tight text-neutral-700">
      <div className="text-center">
        <p className="font-bold" style={{ color: primaryColor }}>{company.name}</p>
        <p className="text-neutral-500">{company.address}</p>
        <p className="text-neutral-500">{company.cityLine}</p>
        {fields.show_company_gstin && company.gstin && <p className="text-neutral-500">GSTIN {company.gstin}</p>}
      </div>
      <div className="border-t border-dashed border-neutral-300 pt-1.5 text-center text-neutral-500">
        <p>{data.invoiceNo}</p>
        <p>{data.invoiceDate}</p>
      </div>
      <div className="space-y-1 border-t border-dashed border-neutral-300 pt-1.5">
        {items.map((item, index) => (
          <div key={item.name + index}>
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

export const templateComponents = {
  classic: ClassicPreview,
  modern: ModernPreview,
  compact: CompactPreview,
  thermal: ThermalPreview,
}
