import { QrCode } from 'lucide-react'
import { normalizeOrganizationBranding } from '../../api/organizations'
import { getFileUrl } from '../../api/files'
import { resolveActiveColumns } from './invoiceColumns'
import { REGULAR_THEME_PRESETS, THERMAL_THEME_PRESETS, findRegularPreset, findThermalPreset } from './invoiceThemePresets'
import { resolveInvoiceBranding } from './invoiceBranding'

// Shared sample data for the Invoice Settings preview - real invoice data (InvoiceDetail.jsx)
// is shaped identically via buildInvoicePreviewData, so the same template renderers work for both.
export const sampleInvoice = {
  company: {
    name: 'SAAS CRM',
    address: '123, Business Park, Koramangala',
    cityLine: 'Bangalore, Karnataka - 560095',
    gstin: '29ABCDE1234F1Z5',
    phone: '+91 98765 43210',
    email: 'billing@saascrm.in',
    pan: 'ABCDE1234F',
  },
  invoiceNo: 'INV-2026-1001',
  invoiceDate: '01 Jul 2026',
  dueDate: '16 Jul 2026',
  orderNumber: 'SO-2026-1044',
  poNumber: '',
  ewayBillNumber: '',
  vehicleNumber: '',
  billTo: {
    name: 'Hotel Grand Meridian',
    address: '45, Residency Road',
    cityLine: 'Bangalore, Karnataka - 560025',
    phone: '+91 90000 12345',
    gstin: '29XYZAB5678C1Z2',
  },
  items: [
    {
      name: '20L Water Jar (Refill)', hsn: '22011010', qty: 40, unit: 'Jar', rate: 90, taxRate: 5, amount: 3780,
      description: 'Packaged drinking water, food grade jar', mrp: 100, discount: 5, taxAmount: 180,
      batchNumber: 'B-2026-07', expiryDate: '30 Dec 2026',
      productImage: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=80&h=80&fit=crop',
    },
    {
      name: 'Water Dispenser Rental', hsn: '99733100', qty: 2, unit: 'Unit', rate: 500, taxRate: 18, amount: 1180,
      description: 'Monthly rental, hot & cold', mrp: 600, discount: 0, taxAmount: 180,
      batchNumber: '', expiryDate: '',
      productImage: 'https://images.unsplash.com/photo-1560269507-e8ddb8b74e74?w=80&h=80&fit=crop',
    },
  ],
  subtotal: 4600,
  taxTotal: 360,
  total: 4960,
  bank: { name: 'HDFC Bank', account: '50200012345678', ifsc: 'HDFC0001234' },
  notes: 'Handle with care — fragile items included.',
}

export function money(value) {
  const amount = Number(value) || 0
  return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDateLabel(dateString) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Shapes real invoice + organization data exactly like sampleInvoice above. `poNumber` /
// `ewayBillNumber` / `vehicleNumber` are read defensively (no fabricated data) - the backend's
// Invoice/Order models don't carry these fields yet (see the backend-changes writeup), so they
// stay blank on a real invoice today; wiring is already here for whenever that data exists.
//
// `invoiceSettings` (optional, the normalized object from getInvoiceSettings()) lets all four
// branding assets (logo, signature, stamp, payment QR) resolve through the invoice-specific
// override -> Company Settings precedence (resolveInvoiceBranding) instead of always showing the
// raw Company Settings asset. See invoiceBranding.js for which of these fields are live on the
// current backend snapshot vs. pending the backend's branding.stamp_file_id/payment_qr_file_id
// addition.
export function buildInvoicePreviewData(invoice, org, invoiceSettings) {
  const company = org || {}
  const companyBranding = normalizeOrganizationBranding(org)
  const resolvedBranding = resolveInvoiceBranding(companyBranding, invoiceSettings?.branding)

  return {
    company: {
      name: company.name || 'Your Company',
      address: company.registered_address || company.address || '',
      cityLine: [company.city, company.state, company.pin_code].filter(Boolean).join(', '),
      gstin: company.gst_number || '',
      phone: company.phone || company.contact_phone || '',
      email: company.email || company.contact_email || '',
      pan: company.pan_number || company.gstin_pan || '',
      letterheadUrl: companyBranding.letterheadUrl,
      bannerUrl: companyBranding.bannerUrl,
      logoUrl: resolvedBranding.logo.url,
      signatureUrl: resolvedBranding.signature.url,
      stampSealUrl: resolvedBranding.stamp.url,
      qrCodeUrl: resolvedBranding.qr.url,
    },
    invoiceNo: invoice.invoiceNumber,
    invoiceDate: formatDateLabel(invoice.invoiceDate),
    dueDate: formatDateLabel(invoice.dueDate),
    orderNumber: invoice.orderNumber || '',
    poNumber: invoice.poNumber || '',
    ewayBillNumber: invoice.ewayBillNumber || '',
    vehicleNumber: invoice.vehicleNumber || '',
    billTo: {
      name: invoice.customerName || invoice.walkInName || 'Walk-in Customer',
      address: invoice.billingAddress || '',
      cityLine: '',
      phone: invoice.customerPhone || invoice.walkInPhone || '',
      gstin: invoice.customerGstin || '',
    },
    items: (invoice.items || []).map((item) => ({
      name: item.productName,
      hsn: item.hsnCode,
      qty: item.quantity,
      unit: item.unit || '',
      rate: item.unitPrice,
      taxRate: item.taxRate,
      amount: item.lineTotal,
      description: item.description || '',
      mrp: item.mrp,
      discount: item.discount,
      taxAmount: item.taxAmount,
      batchNumber: item.batchNumber || '',
      expiryDate: item.expiryDate || '',
      productImage: getFileUrl(item.productImage || ''),
    })),
    subtotal: invoice.subtotal,
    taxTotal: invoice.tax,
    total: invoice.total,
    notes: invoice.notes || '',
    bank: {
      name: company.bank_name || '',
      account: company.bank_account_details || '',
      ifsc: company.bank_ifsc || '',
    },
  }
}

// Mirrors app/core/pdf_docs.py's _TEMPLATE_STYLES exactly. The real PDF's font sizing is driven
// entirely by these fixed per-template values (every _font() call there passes an explicit
// custom_size) - typography.headingSize/bodySize/tableSize are accepted and saved by the backend
// but never actually read by the PDF renderer (see the backend-changes writeup), so the preview
// intentionally does NOT resize from those sliders either: doing so would make the preview lie
// about what the real PDF looks like, which is the one thing this redesign must not do.
const TEMPLATE_STYLES = {
  classic: { heading: '1rem', body: '0.75rem', table: '0.68rem', rowPad: 'py-1.5' },
  modern: { heading: '1.2rem', body: '0.75rem', table: '0.68rem', rowPad: 'py-2' },
  compact: { heading: '0.8rem', body: '0.6rem', table: '0.56rem', rowPad: 'py-1' },
  thermal: { heading: '0.8rem', body: '0.6rem', table: '0.56rem', rowPad: 'py-1' },
}

const FONT_STACKS = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  Times: "'Times New Roman', Times, serif",
  Courier: "'Courier New', Courier, monospace",
}

function resolveFontFamily(typography) {
  return FONT_STACKS[typography?.fontFamily] || FONT_STACKS.Helvetica
}

const DENSITY_GAP = { compact: 'space-y-2', normal: 'space-y-3', spacious: 'space-y-4' }

// ---- Item table: weighted flex grid (see COLUMN_WEIGHTS in invoiceColumns.js, mirroring
// app/core/pdf_docs.py's proportional-width algorithm exactly) - any combination of the up-to-5
// selected columns always fills the document width with no horizontal scrollbar, never a plain
// HTML table that just grows wider than its container. `tableStyle`/`accentHeading` are the new
// per-preset styling axes (Part 5/10 of the theme redesign) - purely cosmetic, the column
// resolution itself is identical for every preset so the same selected columns always render. ----
const TABLE_HEADER_BORDER = {
  bordered: 'border-b-2 border-neutral-200',
  lined: 'border-b-2 border-neutral-200',
  grid: 'border-2 border-neutral-300',
  wide: 'border-b-2 border-neutral-200',
  banded: 'border-b-2 border-neutral-200',
  minimal: 'border-b border-neutral-200',
}
const TABLE_ROW_BORDER = {
  bordered: 'border-b border-neutral-100',
  lined: 'border-b border-neutral-100',
  grid: 'border border-neutral-200',
  wide: 'border-b border-neutral-100',
  banded: 'border-b border-neutral-50',
  minimal: '',
}

function ItemTable({ items, columns, showProductImage, style, tableStyle = 'lined', accentHeading = false, primaryColor }) {
  const activeColumns = resolveActiveColumns(columns, { showProductImage })
  const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' }
  const justifyClass = { left: 'justify-start', center: 'justify-center', right: 'justify-end' }
  const wide = tableStyle === 'wide'
  const cellPad = wide ? 'px-3' : 'px-1.5'

  const cellText = (col, item) => {
    switch (col.key) {
      case 'description': return item.description || '—'
      case 'hsn_sac': return item.hsn || '—'
      case 'quantity': return item.qty
      case 'uom': return item.unit || '—'
      case 'rate': return money(item.rate)
      case 'mrp': return item.mrp != null && item.mrp !== '' ? money(item.mrp) : '—'
      case 'discount': return item.discount ? `${item.discount}%` : '—'
      case 'tax_rate': return item.taxRate ? `${item.taxRate}%` : '—'
      case 'tax_amount': return item.taxAmount != null ? money(item.taxAmount) : '—'
      case 'batch_number': return item.batchNumber || '—'
      case 'expiry_date': return item.expiryDate || '—'
      case 'amount': return money(item.amount)
      default: return '—'
    }
  }

  return (
    <div className="w-full overflow-hidden" style={{ fontSize: style.table }}>
      <div
        className={`flex text-[0.62em] font-semibold uppercase tracking-wide ${TABLE_HEADER_BORDER[tableStyle] || TABLE_HEADER_BORDER.lined} ${accentHeading ? '' : 'text-neutral-400'}`}
        style={accentHeading ? { color: primaryColor } : undefined}
      >
        {activeColumns.map((col) => (
          <div key={col.key} style={{ flexGrow: col.weight, flexBasis: 0 }} className={`min-w-0 truncate ${cellPad} py-1.5 ${alignClass[col.align]}`}>
            {col.key === 'product' ? 'Item' : col.label}
          </div>
        ))}
      </div>
      {items.map((item, index) => (
        <div
          key={item.name + index}
          className={`flex items-center ${TABLE_ROW_BORDER[tableStyle] || TABLE_ROW_BORDER.lined} ${tableStyle === 'banded' && index % 2 === 1 ? 'bg-neutral-50/70' : ''}`}
        >
          {activeColumns.map((col) => (
            <div key={col.key} style={{ flexGrow: col.weight, flexBasis: 0 }} className={`min-w-0 ${cellPad} ${style.rowPad} ${alignClass[col.align]}`}>
              {col.key === 'product' ? (
                <span className={`flex min-w-0 items-center gap-1.5 ${justifyClass[col.align]}`}>
                  {col.key === 'product' && showProductImage && item.productImage && (
                    <img
                      src={item.productImage}
                      alt=""
                      className="size-6 shrink-0 rounded object-cover"
                      onError={(event) => { event.currentTarget.style.display = 'none' }}
                    />
                  )}
                  <span className="truncate">{item.name}</span>
                </span>
              ) : (
                <span className="truncate">{cellText(col, item)}</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// `totalsStyle` is the other half of the accent-usage fix (Part 1/2): 'banded' puts the Total
// row on a solid primaryColor background (white text) instead of just tinting the text, which is
// what makes the selected color visibly, unmistakably present instead of a single thin line of
// colored text easy to read as "still basically black/grey".
function SummaryTotals({ data, showDiscount, showTax, primaryColor, style, totalsStyle = 'plain' }) {
  const rows = (
    <>
      <div className="flex justify-between"><span>Subtotal</span><span>{money(data.subtotal)}</span></div>
      {showDiscount && data.discount ? <div className="flex justify-between"><span>Discount</span><span>-{money(data.discount)}</span></div> : null}
      {showTax && data.taxTotal ? <div className="flex justify-between"><span>Tax</span><span>{money(data.taxTotal)}</span></div> : null}
    </>
  )

  if (totalsStyle === 'inline') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-4" style={{ fontSize: style.body }}>
        <span>Subtotal: {money(data.subtotal)}</span>
        {showTax && data.taxTotal ? <span>Tax: {money(data.taxTotal)}</span> : null}
        <span className="rounded px-2 py-1 font-bold text-white" style={{ backgroundColor: primaryColor }}>Total: {money(data.total)}</span>
      </div>
    )
  }

  const totalRowClass = totalsStyle === 'banded'
    ? 'flex justify-between rounded px-2 py-1.5 font-bold text-white'
    : 'flex justify-between border-t border-neutral-200 pt-1 font-bold'
  const totalRowStyle = totalsStyle === 'banded' ? { backgroundColor: primaryColor } : { color: primaryColor }

  const block = (
    <div className="space-y-1" style={{ fontSize: style.body }}>
      {rows}
      <div className={totalRowClass} style={totalRowStyle}>
        <span>Total</span><span>{money(data.total)}</span>
      </div>
    </div>
  )

  if (totalsStyle === 'boxed' || totalsStyle === 'grid') {
    return (
      <div className={`ml-auto w-full max-w-56 rounded-lg ${totalsStyle === 'grid' ? 'border border-neutral-200 divide-y divide-neutral-200 [&>div]:px-2 [&>div]:py-1' : 'border border-neutral-200 p-2'}`}>
        {block}
      </div>
    )
  }

  return <div className="ml-auto w-full max-w-56">{block}</div>
}

function InvoiceFooter({ company, data, payment, footer, style }) {
  return (
    <div className="space-y-1.5 border-t border-neutral-200 pt-3" style={{ fontSize: style.body }}>
      {payment.showBankDetails && data.bank?.name && (
        <p className="text-neutral-500">Bank: {data.bank.name} | A/c {data.bank.account} | IFSC {data.bank.ifsc}</p>
      )}
      {payment.showUpiQr && (
        <div className="flex items-center gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
            {company.qrCodeUrl ? (
              <img src={company.qrCodeUrl} alt="Payment QR code" className="size-full object-contain" onError={(event) => { event.currentTarget.style.display = 'none' }} />
            ) : (
              <QrCode className="size-4 text-neutral-400" />
            )}
          </div>
          <p className="text-neutral-500">Scan to pay via UPI</p>
        </div>
      )}
      {footer.showTerms && footer.terms && (
        <p className="text-neutral-500"><span className="font-semibold text-neutral-700">Terms: </span>{footer.terms}</p>
      )}
      {data.notes && <p className="text-neutral-500"><span className="font-semibold text-neutral-700">Note: </span>{data.notes}</p>}
      {footer.footerText && <p className="text-neutral-500">{footer.footerText}</p>}
      {footer.showSignature && (
        <div className="flex items-end justify-end gap-2 pt-3">
          {footer.showStamp && company.stampSealUrl && (
            <img src={company.stampSealUrl} alt="Company stamp" className="size-11 object-contain" onError={(event) => { event.currentTarget.style.display = 'none' }} />
          )}
          {company.signatureUrl ? (
            <img src={company.signatureUrl} alt="Authorised signatory" className="h-9 max-w-28 object-contain" onError={(event) => { event.currentTarget.style.display = 'none' }} />
          ) : (
            <p className="italic text-neutral-400">Signature</p>
          )}
        </div>
      )}
      {footer.showSignature && <p className="text-right text-neutral-500">Authorised Signatory</p>}
    </div>
  )
}

// Common shape every template renders from - all nested settings blocks the backend's real
// InvoiceSettings schema defines (see app/schemas/workflow_settings.py), never a flat guessed set.
function withDefaults(props) {
  return {
    primaryColor: props.primaryColor || '#063b00',
    data: props.data,
    businessDetails: { showBusinessName: true, showLogo: true, showAddress: true, showPhone: true, showEmail: true, showGstin: true, showPan: false, ...props.businessDetails },
    invoiceDetails: { showInvoiceNumber: true, showInvoiceDate: true, showDueDate: true, showOrderReference: true, showPoNumber: false, showEwayBillNumber: false, showVehicleNumber: false, ...props.invoiceDetails },
    partyDetails: { showCustomerName: true, showCustomerGstin: true, showBillingAddress: true, showShippingAddress: true, showCustomerPhone: true, ...props.partyDetails },
    itemTable: { showProductImage: false, columns: undefined, ...props.itemTable },
    paymentDetails: { showBankDetails: true, showUpiQr: true, ...props.paymentDetails },
    footer: { showTerms: true, showSignature: true, showStamp: true, terms: '', footerText: '', ...props.footer },
    fields: { show_discount: true, show_tax_amount: true, ...props.fields },
    typography: { fontFamily: 'Helvetica', ...props.typography },
  }
}

// ---- Header block: one component covering every `header` axis value instead of a separate
// component per preset. `accentColor` here is deliberately generous (Part 2: the preview "must
// not remain mostly black/grey") - business name, the title, and the divider/band all carry the
// selected color; customer/body data (handled in PartyBlock) stays neutral on purpose. ----
function HeaderBlock({ preset, primaryColor, company, businessDetails, invoiceDetails, data, style }) {
  const spacious = preset.density === 'spacious'
  const titleNode = (
    <p className="font-semibold tracking-wide" style={{ fontSize: spacious ? '1.05em' : undefined }}>TAX INVOICE</p>
  )
  const metaRows = (
    <>
      {invoiceDetails.showInvoiceNumber && <p className="mt-0.5">Invoice No: {data.invoiceNo}</p>}
      {invoiceDetails.showInvoiceDate && <p>Date: {data.invoiceDate}</p>}
      {invoiceDetails.showDueDate && <p>Due: {data.dueDate}</p>}
      {invoiceDetails.showOrderReference && data.orderNumber && <p>Order: {data.orderNumber}</p>}
      {invoiceDetails.showPoNumber && data.poNumber && <p>PO: {data.poNumber}</p>}
      {invoiceDetails.showEwayBillNumber && data.ewayBillNumber && <p>E-Way Bill: {data.ewayBillNumber}</p>}
      {invoiceDetails.showVehicleNumber && data.vehicleNumber && <p>Vehicle: {data.vehicleNumber}</p>}
    </>
  )
  const companyBlock = (isOnColor) => (
    <div className="flex items-start gap-2.5">
      {businessDetails.showLogo && company.logoUrl && (
        <img src={company.logoUrl} alt="" className={`size-9 shrink-0 rounded object-contain ${isOnColor ? 'bg-white/90 p-0.5' : ''}`} onError={(event) => { event.currentTarget.style.display = 'none' }} />
      )}
      <div>
        {businessDetails.showBusinessName && (
          <p className="font-bold" style={{ color: isOnColor ? undefined : primaryColor, fontSize: style.heading }}>{company.name}</p>
        )}
        {businessDetails.showAddress && <p className={`mt-0.5 leading-4 ${isOnColor ? 'text-white/85' : 'text-neutral-500'}`}>{company.address}<br />{company.cityLine}</p>}
        {businessDetails.showGstin && company.gstin && <p className={isOnColor ? 'text-white/85' : 'text-neutral-500'}>GSTIN: {company.gstin}</p>}
        {businessDetails.showPan && company.pan && <p className={isOnColor ? 'text-white/85' : 'text-neutral-500'}>PAN: {company.pan}</p>}
        {businessDetails.showPhone && company.phone && <p className={isOnColor ? 'text-white/85' : 'text-neutral-500'}>Ph: {company.phone}</p>}
        {businessDetails.showEmail && company.email && <p className={isOnColor ? 'text-white/85' : 'text-neutral-500'}>{company.email}</p>}
      </div>
    </div>
  )

  if (preset.header === 'band' || preset.header === 'band-sm' || preset.header === 'banner') {
    const pad = preset.header === 'band-sm' ? 'p-2.5' : preset.header === 'banner' ? 'p-5' : 'p-3.5'
    return (
      <div className={`rounded-xl ${pad} text-white`} style={{ backgroundColor: primaryColor }}>
        <div className="flex items-start justify-between gap-3">
          {companyBlock(true)}
          <div className="text-right text-white">
            <p className="font-semibold uppercase tracking-widest" style={{ fontSize: preset.header === 'banner' ? '1.1em' : undefined }}>Invoice</p>
            <div className="text-white/85">{metaRows}</div>
          </div>
        </div>
      </div>
    )
  }

  if (preset.header === 'banner-split') {
    return (
      <div className="space-y-2.5">
        <div className="rounded-xl p-4 text-center text-white" style={{ backgroundColor: primaryColor }}>
          {businessDetails.showBusinessName && <p className="font-bold tracking-wide" style={{ fontSize: style.heading }}>{company.name}</p>}
          <p className="mt-0.5 text-xs uppercase tracking-[0.2em] text-white/85">Tax Invoice</p>
        </div>
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-2.5 text-neutral-500">
          <div>
            {businessDetails.showAddress && <p>{company.address}, {company.cityLine}</p>}
            {businessDetails.showGstin && company.gstin && <p>GSTIN: {company.gstin}</p>}
          </div>
          <div className="text-right">{metaRows}</div>
        </div>
      </div>
    )
  }

  if (preset.header === 'split' || preset.header === 'split-alt') {
    const first = companyBlock(false)
    const second = (
      <div className="text-right">
        <p className="font-semibold tracking-wide" style={{ color: primaryColor }}>TAX INVOICE</p>
        {metaRows}
      </div>
    )
    return (
      <div className="flex items-start justify-between gap-4 border-b-2 pb-2.5" style={{ borderColor: primaryColor }}>
        {preset.header === 'split-alt' ? <>{second}{first}</> : <>{first}{second}</>}
      </div>
    )
  }

  // 'plain' / 'plain-spacious'
  return (
    <div className={`flex items-start justify-between border-b-${spacious ? '' : '2'} ${spacious ? 'pb-3.5' : 'pb-2.5'}`} style={{ borderColor: primaryColor, borderBottomWidth: spacious ? '1px' : undefined }}>
      {companyBlock(false)}
      <div className="text-right">
        {titleNode}
        {metaRows}
      </div>
    </div>
  )
}

function PartyBlock({ primaryColor, partyDetails, billTo, accentHeading }) {
  if (!partyDetails.showCustomerName && !partyDetails.showBillingAddress) return null
  return (
    <div>
      <p className="font-semibold" style={accentHeading ? { color: primaryColor } : undefined}>Bill To</p>
      {partyDetails.showCustomerName && <p className="mt-0.5 font-medium text-neutral-800">{billTo.name}</p>}
      {partyDetails.showBillingAddress && <p className="text-neutral-500">{billTo.address}, {billTo.cityLine}</p>}
      {partyDetails.showCustomerPhone && billTo.phone && <p className="text-neutral-500">Ph: {billTo.phone}</p>}
      {partyDetails.showCustomerGstin && billTo.gstin && <p className="text-neutral-500">GSTIN: {billTo.gstin}</p>}
    </div>
  )
}

// ---- The single configurable regular-invoice renderer every preset (the original 3 AND the 11
// new ones - Part 10/14) goes through. `preset` supplies the style axes (header/table/totals/
// accent/density); `baseTemplate` drives font sizing (TEMPLATE_STYLES) since that's the one
// thing the real backend PDF renderer also varies by actual `template` value. ----
function RegularInvoiceDocument({ preset, ...props }) {
  const { primaryColor, data = sampleInvoice, businessDetails, invoiceDetails, partyDetails, itemTable, paymentDetails, footer, fields, typography } = withDefaults(props)
  const { company, billTo, items } = data
  const style = TEMPLATE_STYLES[preset.baseTemplate] || TEMPLATE_STYLES.classic
  const fontFamily = resolveFontFamily(typography)
  const accentHeading = preset.accent === 'bold'

  return (
    <div className={DENSITY_GAP[preset.density] || DENSITY_GAP.normal} style={{ fontFamily, fontSize: style.body }}>
      {company.letterheadUrl && (
        <img src={company.letterheadUrl} alt="" className="max-h-14 w-full rounded object-contain" onError={(event) => { event.currentTarget.style.display = 'none' }} />
      )}
      <HeaderBlock preset={preset} primaryColor={primaryColor} company={company} businessDetails={businessDetails} invoiceDetails={invoiceDetails} data={data} style={style} />
      <PartyBlock primaryColor={accentHeading ? primaryColor : undefined} partyDetails={partyDetails} billTo={billTo} accentHeading={accentHeading} />
      <ItemTable
        items={items}
        columns={itemTable.columns}
        showProductImage={itemTable.showProductImage}
        style={style}
        tableStyle={preset.table}
        accentHeading={accentHeading}
        primaryColor={primaryColor}
      />
      <SummaryTotals
        data={data}
        showDiscount={fields.show_discount}
        showTax={fields.show_tax_amount}
        primaryColor={primaryColor}
        style={style}
        totalsStyle={preset.totals}
      />
      <InvoiceFooter company={company} data={data} payment={paymentDetails} footer={footer} style={style} />
    </div>
  )
}

// Backward-compatible exports - these are what InvoiceDetail.jsx/InvoicePrintView.jsx resolve
// via templateComponents[invoiceSettings.template] for a REAL invoice, so each must render
// exactly what it always has: the "classic"/"modern"/"compact" preset's own axes are defined to
// match that prior look precisely (see invoiceThemePresets.js).
export function ClassicPreview(props) {
  return <RegularInvoiceDocument preset={findRegularPreset('classic')} {...props} />
}
export function ModernPreview(props) {
  return <RegularInvoiceDocument preset={findRegularPreset('modern')} {...props} />
}
export function CompactPreview(props) {
  return <RegularInvoiceDocument preset={findRegularPreset('compact')} {...props} />
}

// New: any of the 14 regular presets (Invoice Settings' expanded Theme picker) render through
// here directly - same shared component, just a different preset id.
export function RegularThemePreview({ presetId, ...props }) {
  return <RegularInvoiceDocument preset={findRegularPreset(presetId)} {...props} />
}

// Thermal is its own compact receipt layout (never a scaled-down A4 template): centered header,
// dashed dividers, monospace-leaning stack instead of a bordered table. `thermalLayout` covers
// the 4 backend-recognized layout names; `thermalVariant` (1-4, from the extra "Theme N"
// thermal presets) adds small presentational differences on top of the same structure - not 4
// more bespoke components, matching Part 6/10's "own layout configuration, not a full rebuild".
export function ThermalPreview(props) {
  const { primaryColor, data = sampleInvoice, businessDetails, invoiceDetails, itemTable, footer, thermalLayout = 'standard', thermalVariant } = withDefaults(props)
  const { company, items } = data
  const style = TEMPLATE_STYLES.thermal
  const activeColumns = resolveActiveColumns(itemTable.columns, { showProductImage: itemTable.showProductImage })
  const showTax = activeColumns.some((col) => col.key === 'tax_rate')
  const dividerClass = thermalLayout === 'simple' || thermalLayout === 'compact' ? 'border-t border-neutral-200' : 'border-t border-dashed border-neutral-300'
  const spacing = thermalLayout === 'compact' ? 'space-y-0.5 pt-1' : 'space-y-1 pt-1.5'
  const centerAll = thermalLayout === 'classic' ? 'text-center' : ''
  // Variant 1/3 = totals right-aligned like a normal receipt (default); 2/4 = totals emphasised
  // with the accent color, a small nod to "Theme 1-4" being distinct from the base 4 without a
  // different structural layout (thermal receipts don't have room for structural variety).
  const emphasizeTotal = thermalVariant === 2 || thermalVariant === 4

  return (
    <div className={`space-y-2 font-mono leading-tight text-neutral-700 ${centerAll}`} style={{ fontSize: style.body }}>
      <div className="text-center">
        {businessDetails.showLogo && company.logoUrl && (
          <img src={company.logoUrl} alt="" className="mx-auto mb-1 size-7 object-contain" onError={(event) => { event.currentTarget.style.display = 'none' }} />
        )}
        {businessDetails.showBusinessName && <p className="font-bold" style={{ color: primaryColor }}>{company.name}</p>}
        {businessDetails.showAddress && <p className="text-neutral-500">{company.address}</p>}
        {businessDetails.showAddress && <p className="text-neutral-500">{company.cityLine}</p>}
        {businessDetails.showGstin && company.gstin && <p className="text-neutral-500">GSTIN {company.gstin}</p>}
      </div>
      <div className={`${dividerClass} ${spacing} text-center text-neutral-500`}>
        {invoiceDetails.showInvoiceNumber && <p>{data.invoiceNo}</p>}
        {invoiceDetails.showInvoiceDate && <p>{data.invoiceDate}</p>}
      </div>
      <div className={`${dividerClass} ${spacing}`}>
        {items.map((item, index) => (
          <div key={item.name + index}>
            <p className="truncate">{item.name}</p>
            <div className="flex justify-between text-neutral-500">
              <span>{item.qty} x {money(item.rate)}{showTax && item.taxRate ? ` +${item.taxRate}%` : ''}</span>
              <span>{money(item.amount)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className={`${dividerClass} space-y-0.5 pt-1.5`}>
        <div className="flex justify-between"><span>Subtotal</span><span>{money(data.subtotal)}</span></div>
        {data.taxTotal ? <div className="flex justify-between"><span>Tax</span><span>{money(data.taxTotal)}</span></div> : null}
        <div className="flex justify-between font-bold" style={emphasizeTotal ? { color: primaryColor } : undefined}><span>TOTAL</span><span>{money(data.total)}</span></div>
      </div>
      {footer.showSignature && (
        <div className={`flex flex-col items-center gap-0.5 ${dividerClass} pt-1.5`}>
          {footer.showStamp && company.stampSealUrl && (
            <img src={company.stampSealUrl} alt="" className="size-6 object-contain" onError={(event) => { event.currentTarget.style.display = 'none' }} />
          )}
          {company.signatureUrl ? (
            <img src={company.signatureUrl} alt="" className="h-5 max-w-20 object-contain" onError={(event) => { event.currentTarget.style.display = 'none' }} />
          ) : (
            <span className="italic text-neutral-400">Signature</span>
          )}
          <span className="text-neutral-500">Authorised Signatory</span>
        </div>
      )}
      <p className={`${dividerClass} pt-1.5 text-center text-neutral-500`}>{footer.footerText || 'Thank you!'}</p>
    </div>
  )
}

// Thermal preset -> ThermalPreview prop wiring (layout + variant), used by the Thermal Printer
// theme picker in InvoiceSettings.jsx.
export function ThermalThemePreview({ presetId, ...props }) {
  const preset = findThermalPreset(presetId)
  return <ThermalPreview {...props} thermalLayout={preset.layout} thermalVariant={preset.variant} />
}

export const templateComponents = {
  classic: ClassicPreview,
  modern: ModernPreview,
  compact: CompactPreview,
  thermal: ThermalPreview,
}

export { REGULAR_THEME_PRESETS, THERMAL_THEME_PRESETS, findRegularPreset, findThermalPreset }
