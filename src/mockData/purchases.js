const buildPurchase = ({ id, invoiceNumber, supplierName, purchaseDate, dueDate, amountPaid, items }) => {
  const lineItems = items.map((item) => {
    const lineTotal = item.qty * item.rate
    const gstAmount = lineTotal * item.gstRate
    return { ...item, lineTotal, gstAmount }
  })

  const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0)
  const gstAmount = lineItems.reduce((sum, item) => sum + item.gstAmount, 0)
  const total = subtotal + gstAmount
  const balance = total - amountPaid
  const status = amountPaid <= 0 ? 'Unpaid' : amountPaid < total ? 'Partial' : 'Paid'

  return {
    id,
    invoiceNumber,
    supplierName,
    purchaseDate,
    dueDate,
    items: lineItems,
    subtotal,
    gstAmount,
    total,
    amountPaid,
    balance,
    status,
  }
}

export const purchases = [
  buildPurchase({
    id: 'PUR-1',
    invoiceNumber: 'PI-2026-0601',
    supplierName: 'Bluepack Preforms Pvt Ltd',
    purchaseDate: '2026-06-15',
    dueDate: '2026-06-30',
    amountPaid: 31152,
    items: [
      { description: 'PET Preforms 250ml', qty: 10000, rate: 1.2, gstRate: 0.18 },
      { description: 'PET Preforms 500ml', qty: 8000, rate: 1.8, gstRate: 0.18 },
    ],
  }),
  buildPurchase({
    id: 'PUR-2',
    invoiceNumber: 'PI-2026-0602',
    supplierName: 'EcoCan Packaging Solutions',
    purchaseDate: '2026-06-20',
    dueDate: '2026-07-05',
    amountPaid: 10620,
    items: [{ description: 'Shrink Wrap Labels (roll)', qty: 200, rate: 45, gstRate: 0.18 }],
  }),
  buildPurchase({
    id: 'PUR-3',
    invoiceNumber: 'PI-2026-0701',
    supplierName: 'Metro Fuel Station',
    purchaseDate: '2026-07-01',
    dueDate: '2026-07-08',
    amountPaid: 30000,
    items: [{ description: 'Diesel (litres)', qty: 500, rate: 92, gstRate: 0 }],
  }),
  buildPurchase({
    id: 'PUR-4',
    invoiceNumber: 'PI-2026-0702',
    supplierName: 'RO TechCare Services',
    purchaseDate: '2026-07-03',
    dueDate: '2026-07-18',
    amountPaid: 0,
    items: [{ description: 'RO Plant AMC Service - Q3', qty: 1, rate: 18000, gstRate: 0.18 }],
  }),
  buildPurchase({
    id: 'PUR-5',
    invoiceNumber: 'PI-2026-0703',
    supplierName: 'Swift Logistics Parts',
    purchaseDate: '2026-07-05',
    dueDate: '2026-07-12',
    amountPaid: 17700,
    items: [
      { description: 'Delivery Van Tyres', qty: 4, rate: 3200, gstRate: 0.18 },
      { description: 'Brake Pads Set', qty: 2, rate: 1100, gstRate: 0.18 },
    ],
  }),
  buildPurchase({
    id: 'PUR-6',
    invoiceNumber: 'PI-2026-0704',
    supplierName: 'PureSource Raw Water Supply',
    purchaseDate: '2026-07-06',
    dueDate: '2026-07-20',
    amountPaid: 20000,
    items: [{ description: 'Bulk Raw Water (tanker loads)', qty: 20, rate: 1500, gstRate: 0.12 }],
  }),
  buildPurchase({
    id: 'PUR-7',
    invoiceNumber: 'PI-2026-0705',
    supplierName: 'SafeSeal Cap Manufacturers',
    purchaseDate: '2026-07-08',
    dueDate: '2026-07-22',
    amountPaid: 0,
    items: [{ description: 'Bottle Caps (gross)', qty: 500, rate: 22, gstRate: 0.18 }],
  }),
  buildPurchase({
    id: 'PUR-8',
    invoiceNumber: 'PI-2026-0706',
    supplierName: 'National Water Testing Labs',
    purchaseDate: '2026-07-09',
    dueDate: '2026-07-16',
    amountPaid: 7080,
    items: [{ description: 'Water Quality Testing (monthly)', qty: 1, rate: 6000, gstRate: 0.18 }],
  }),
  buildPurchase({
    id: 'PUR-9',
    invoiceNumber: 'PI-2026-0707',
    supplierName: 'Apex Electricals',
    purchaseDate: '2026-07-10',
    dueDate: '2026-07-24',
    amountPaid: 10000,
    items: [
      { description: 'Submersible Pump Motor', qty: 1, rate: 14500, gstRate: 0.18 },
      { description: 'Wiring & Fittings', qty: 1, rate: 2500, gstRate: 0.18 },
    ],
  }),
  buildPurchase({
    id: 'PUR-10',
    invoiceNumber: 'PI-2026-0708',
    supplierName: 'GreenBox Cartons',
    purchaseDate: '2026-07-12',
    dueDate: '2026-07-26',
    amountPaid: 0,
    items: [{ description: 'Corrugated Cartons (12-bottle)', qty: 1000, rate: 14, gstRate: 0.12 }],
  }),
  buildPurchase({
    id: 'PUR-11',
    invoiceNumber: 'PI-2026-0709',
    supplierName: 'CityGas Distributors',
    purchaseDate: '2026-07-14',
    dueDate: '2026-07-21',
    amountPaid: 6615,
    items: [{ description: 'LPG Cylinder Refill', qty: 6, rate: 1050, gstRate: 0.05 }],
  }),
  buildPurchase({
    id: 'PUR-12',
    invoiceNumber: 'PI-2026-0710',
    supplierName: 'Prime Printers',
    purchaseDate: '2026-07-15',
    dueDate: '2026-07-29',
    amountPaid: 4000,
    items: [{ description: 'Product Label Printing', qty: 5000, rate: 1.4, gstRate: 0.18 }],
  }),
]
