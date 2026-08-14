// Sales invoices are not backed by a real API yet, so this mirrors the pattern already used for
// mockData/orders.js and mockData/purchases.js - a deterministic, fully-computed dataset that the
// List, Detail, Create, and Record Payment screens can all read from consistently.

export const INVOICE_PAYMENT_STATUSES = [
  { value: 'Paid', label: 'Paid', badge: 'success' },
  { value: 'Partial', label: 'Partial', badge: 'warning' },
  { value: 'Unpaid', label: 'Unpaid', badge: 'danger' },
  { value: 'Overdue', label: 'Overdue', badge: 'danger' },
]

export const INVOICE_STATUSES = [
  { value: 'Draft', label: 'Draft', badge: 'neutral' },
  { value: 'Issued', label: 'Issued', badge: 'success' },
  { value: 'Cancelled', label: 'Cancelled', badge: 'danger' },
]

export const paymentStatusBadgeVariant = (status) =>
  INVOICE_PAYMENT_STATUSES.find((item) => item.value === status)?.badge || 'neutral'

export const invoiceStatusBadgeVariant = (status) =>
  INVOICE_STATUSES.find((item) => item.value === status)?.badge || 'neutral'

export const customerPool = [
  { name: 'Hotel Grand Meridian', address: '45, Residency Road', city: 'Bangalore', state: 'Karnataka', pincode: '560025', gstin: '29AAACH9876Q1Z5' },
  { name: 'Spice Route Restaurant', address: '123, MG Road, Connaught Place', city: 'New Delhi', state: 'Delhi', pincode: '110001', gstin: '07AABCS1234D1Z5' },
  { name: 'Sunrise Corporate Park', address: '7th Floor, Tech Tower', city: 'Pune', state: 'Maharashtra', pincode: '411001', gstin: '27AABCS5566K1Z2' },
  { name: 'Mr. Arjun Reddy', address: 'Plot 12, Jubilee Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500033', gstin: '' },
  { name: 'Green Leaf Caterers', address: '12/B, Kings Road, Banjara Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034', gstin: '36AACST1234F1Z5' },
  { name: 'The Coastal Kitchen', address: '221, Marine Drive', city: 'Kochi', state: 'Kerala', pincode: '682031', gstin: '32AABCC7788L1Z9' },
  { name: 'Om Sai General Store', address: '9, Market Yard Road', city: 'Nashik', state: 'Maharashtra', pincode: '422001', gstin: '27AACSO4455M1Z3' },
  { name: 'Blue Water Solutions', address: '18, Industrial Estate', city: 'Ahmedabad', state: 'Gujarat', pincode: '380015', gstin: '24AABCB2233N1Z7' },
  { name: 'City Heights Apartments', address: 'Tower C, City Heights', city: 'Mumbai', state: 'Maharashtra', pincode: '400071', gstin: '27AABCC9911P1Z4' },
  { name: 'Fresh Mart Supermarket', address: '56, Ring Road', city: 'Indore', state: 'Madhya Pradesh', pincode: '452001', gstin: '23AABCF3344Q1Z8' },
  { name: 'TechNova Solutions Pvt Ltd', address: 'B-Wing, Cyber Park', city: 'Bangalore', state: 'Karnataka', pincode: '560103', gstin: '29AABCT6677R1Z1' },
  { name: 'Vinayaka Medical Store', address: '4, Gandhi Chowk', city: 'Nagpur', state: 'Maharashtra', pincode: '440001', gstin: '27AABCV8899S1Z6' },
  { name: 'Star Public School', address: '2, School Lane', city: 'Jaipur', state: 'Rajasthan', pincode: '302001', gstin: '' },
  { name: 'Blue Orchid Banquet Hall', address: '33, Lake View Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600028', gstin: '33AABCB1122T1Z5' },
  { name: 'Cafe Mocha', address: '5, Cafe Street', city: 'Bangalore', state: 'Karnataka', pincode: '560001', gstin: '' },
  { name: 'Cloud Nine Cafe', address: '18, Skywalk Plaza', city: 'Pune', state: 'Maharashtra', pincode: '411014', gstin: '' },
]

export const productPool = [
  { name: '20L Water Jar (Refill)', hsn: '22011010', unit: 'Jar', rate: 90, gstRate: 0.05 },
  { name: '1L Water Bottle (Case of 12)', hsn: '22011020', unit: 'Case', rate: 180, gstRate: 0.05 },
  { name: '500ml Water Bottle (Case of 24)', hsn: '22011020', unit: 'Case', rate: 210, gstRate: 0.05 },
  { name: 'Sparkling Water 750ml (Case of 12)', hsn: '22021010', unit: 'Case', rate: 480, gstRate: 0.12 },
  { name: 'Flavored Water - Orange 500ml (Case of 24)', hsn: '22021090', unit: 'Case', rate: 620, gstRate: 0.12 },
  { name: 'Alkaline Water 1L (Case of 12)', hsn: '22011030', unit: 'Case', rate: 340, gstRate: 0.05 },
  { name: 'Water Dispenser Rental (Monthly)', hsn: '99733100', unit: 'Unit', rate: 500, gstRate: 0.18 },
  { name: 'Bottle Stand (Standard)', hsn: '39249090', unit: 'Piece', rate: 650, gstRate: 0.18 },
  { name: 'Delivery & Handling Charges', hsn: '996812', unit: 'Service', rate: 150, gstRate: 0.18 },
]

export const salesPersonPool = ['Hitarth Sharma', 'Priya Nair', 'Rohan Mehta', 'Aniket Jha']

export const bankDetails = { bankName: 'HDFC Bank', accountNumber: '50200012345678', ifsc: 'HDFC0001234' }

function round2(value) {
  return Math.round(value * 100) / 100
}

function buildInvoiceItems(lines) {
  return lines.map(({ productIndex, qty, discountPercent = 0 }) => {
    const product = productPool[productIndex]
    const lineSubtotal = product.rate * qty
    const discountAmount = round2(lineSubtotal * (discountPercent / 100))
    const taxableAmount = lineSubtotal - discountAmount
    const taxAmount = round2(taxableAmount * product.gstRate)
    const amount = round2(taxableAmount + taxAmount)

    return {
      name: product.name,
      hsn: product.hsn,
      qty,
      unit: product.unit,
      rate: product.rate,
      discountAmount,
      gstRate: product.gstRate,
      taxAmount,
      amount,
    }
  })
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const today = new Date('2026-07-31T00:00:00')

function buildSalesInvoice({
  sequence,
  customer,
  orderNumber,
  invoiceDate,
  dueInDays = 15,
  items,
  paidAmount = 0,
  invoiceStatus = 'Issued',
  salesPerson,
  payments = [],
  notes = 'Thank you for your business. We appreciate your continued trust in us.',
  termsAndConditions = [
    'Payment is due within 15 days from the invoice date.',
    'Late payments are subject to 1.5% interest per month.',
    'Goods once sold will not be taken back or exchanged.',
  ],
}) {
  const invoiceNumber = `INV-2026-${String(1000 + sequence)}`
  const dueDate = addDays(invoiceDate, dueInDays)
  const lineItems = buildInvoiceItems(items)
  const subtotal = round2(lineItems.reduce((sum, item) => sum + item.rate * item.qty, 0))
  const discountAmount = round2(lineItems.reduce((sum, item) => sum + item.discountAmount, 0))
  const taxAmount = round2(lineItems.reduce((sum, item) => sum + item.taxAmount, 0))
  const total = round2(subtotal - discountAmount + taxAmount)
  const dueAmount = invoiceStatus === 'Cancelled' ? 0 : round2(total - paidAmount)
  const isPastDue = new Date(`${dueDate}T00:00:00`) < today

  const paymentStatus =
    invoiceStatus === 'Cancelled'
      ? 'Unpaid'
      : paidAmount <= 0
        ? isPastDue
          ? 'Overdue'
          : 'Unpaid'
        : dueAmount > 0
          ? 'Partial'
          : 'Paid'

  return {
    id: invoiceNumber,
    invoiceNumber,
    type: 'sales',
    invoiceStatus,
    paymentStatus,
    customerName: customer.name,
    billingAddress: customer,
    shippingAddress: customer,
    orderNumber,
    invoiceDate,
    dueDate,
    salesPerson: salesPerson || salesPersonPool[sequence % salesPersonPool.length],
    items: lineItems,
    subtotal,
    discountAmount,
    taxAmount,
    total,
    paidAmount: round2(paidAmount),
    dueAmount,
    payments,
    notes,
    termsAndConditions,
    bankDetails,
  }
}

// The first 10 mirror the reference List screenshot 1:1 (same customers, dates, and status mix);
// everything after is generated so every invoice in the list has real, clickable detail data.
const seedInvoices = [
  buildSalesInvoice({
    sequence: 1,
    customer: customerPool[0],
    orderNumber: 'SO-2026-1001',
    invoiceDate: '2026-07-01',
    items: [{ productIndex: 0, qty: 40 }, { productIndex: 6, qty: 2 }],
    paidAmount: 4884,
    payments: [{ date: '2026-07-01', method: 'Bank Transfer', reference: 'TXN110023344', amount: 4884 }],
  }),
  buildSalesInvoice({
    sequence: 2,
    customer: customerPool[1],
    orderNumber: 'SO-2026-1002',
    invoiceDate: '2026-07-02',
    items: [{ productIndex: 1, qty: 10 }, { productIndex: 5, qty: 5, discountPercent: 5 }],
    paidAmount: 1206,
    payments: [{ date: '2026-07-02', method: 'Bank Transfer', reference: 'HDFC123456789', amount: 1206 }],
  }),
  buildSalesInvoice({
    sequence: 3,
    customer: customerPool[2],
    orderNumber: 'SO-2026-1003',
    invoiceDate: '2026-07-03',
    items: [{ productIndex: 6, qty: 12 }, { productIndex: 7, qty: 8 }],
    paidAmount: 11996,
    payments: [{ date: '2026-07-03', method: 'Bank Transfer', reference: 'TXN110023399', amount: 11996 }],
  }),
  buildSalesInvoice({
    sequence: 4,
    customer: customerPool[3],
    orderNumber: 'SO-2026-1004',
    invoiceDate: '2026-07-04',
    items: [{ productIndex: 0, qty: 4 }],
    paidAmount: 378,
    payments: [{ date: '2026-07-04', method: 'UPI', reference: 'UPI554433221', amount: 378 }],
  }),
  buildSalesInvoice({
    sequence: 5,
    customer: customerPool[4],
    orderNumber: 'SO-2026-1005',
    invoiceDate: '2026-07-05',
    items: [{ productIndex: 4, qty: 6 }, { productIndex: 3, qty: 4 }],
    paidAmount: 0,
  }),
  buildSalesInvoice({
    sequence: 6,
    customer: customerPool[5],
    orderNumber: 'SO-2026-1006',
    invoiceDate: '2026-07-06',
    items: [{ productIndex: 1, qty: 8 }, { productIndex: 8, qty: 3 }],
    paidAmount: 1000,
    payments: [{ date: '2026-07-06', method: 'Cash', reference: '-', amount: 1000 }],
  }),
  buildSalesInvoice({
    sequence: 7,
    customer: customerPool[6],
    orderNumber: 'SO-2026-1007',
    invoiceDate: '2026-07-07',
    dueInDays: 10,
    items: [{ productIndex: 2, qty: 10 }, { productIndex: 0, qty: 8 }],
    paidAmount: 0,
  }),
  buildSalesInvoice({
    sequence: 8,
    customer: customerPool[7],
    orderNumber: 'SO-2026-1008',
    invoiceDate: '2026-07-08',
    items: [{ productIndex: 6, qty: 10 }, { productIndex: 7, qty: 6 }],
    paidAmount: 7593,
    payments: [{ date: '2026-07-08', method: 'Bank Transfer', reference: 'TXN110023410', amount: 7593 }],
  }),
  buildSalesInvoice({
    sequence: 9,
    customer: customerPool[8],
    orderNumber: 'SO-2026-1009',
    invoiceDate: '2026-07-09',
    items: [{ productIndex: 0, qty: 50 }, { productIndex: 5, qty: 4 }],
    paidAmount: 2000,
    payments: [{ date: '2026-07-09', method: 'UPI', reference: 'UPI554433299', amount: 2000 }],
  }),
  buildSalesInvoice({
    sequence: 10,
    customer: customerPool[9],
    orderNumber: 'SO-2026-1010',
    invoiceDate: '2026-07-10',
    invoiceStatus: 'Draft',
    items: [{ productIndex: 1, qty: 6 }, { productIndex: 2, qty: 4 }],
    paidAmount: 0,
  }),
]

// Fills the list out to a realistic 128 records for pagination, cycling through the same
// customer/product pools with varied quantities and payment states.
const generatedInvoices = Array.from({ length: 118 }, (_, index) => {
  const sequence = index + 11
  const customer = customerPool[sequence % customerPool.length]
  const dayOffset = sequence - 1
  const invoiceDate = addDays('2026-06-01', dayOffset)
  const productIndexA = sequence % productPool.length
  const productIndexB = (sequence + 3) % productPool.length
  const qtyA = 3 + (sequence % 12)
  const qtyB = 2 + (sequence % 6)
  const paidRatio = [1, 1, 0.5, 0, 1, 0.7][sequence % 6]
  const invoiceStatus = sequence % 17 === 0 ? 'Cancelled' : sequence % 9 === 0 ? 'Draft' : 'Issued'

  const draftInvoice = buildSalesInvoice({
    sequence,
    customer,
    orderNumber: `SO-2026-${String(1000 + sequence)}`,
    invoiceDate,
    invoiceStatus,
    items: [{ productIndex: productIndexA, qty: qtyA }, { productIndex: productIndexB, qty: qtyB }],
    paidAmount: 0,
  })

  const paidAmount = round2(draftInvoice.total * paidRatio)

  return buildSalesInvoice({
    sequence,
    customer,
    orderNumber: `SO-2026-${String(1000 + sequence)}`,
    invoiceDate,
    invoiceStatus,
    items: [{ productIndex: productIndexA, qty: qtyA }, { productIndex: productIndexB, qty: qtyB }],
    paidAmount,
    payments: paidAmount > 0 ? [{ date: invoiceDate, method: 'Bank Transfer', reference: `TXN${900000 + sequence}`, amount: paidAmount }] : [],
  })
})

export const salesInvoicesData = [...seedInvoices, ...generatedInvoices]

export function getInvoiceByNumber(invoiceNumber) {
  return salesInvoicesData.find((invoice) => invoice.invoiceNumber === invoiceNumber)
}

export function getInvoiceByOrderNumber(orderNumber) {
  return salesInvoicesData.find((invoice) => invoice.orderNumber === orderNumber)
}

export function getInvoiceStats(invoices = salesInvoicesData) {
  const totalInvoices = invoices.length
  const totalReceivable = round2(invoices.reduce((sum, invoice) => sum + invoice.dueAmount, 0))
  const overdueAmount = round2(
    invoices.filter((invoice) => invoice.paymentStatus === 'Overdue').reduce((sum, invoice) => sum + invoice.dueAmount, 0),
  )
  const paidThisMonth = round2(
    invoices
      .filter((invoice) => invoice.invoiceDate.startsWith('2026-07'))
      .reduce((sum, invoice) => sum + invoice.paidAmount, 0),
  )

  return { totalInvoices, totalReceivable, overdueAmount, paidThisMonth }
}
