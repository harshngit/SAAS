import { purchaseInvoices } from './purchaseInvoices'

const rawSuppliers = [
  {
    id: 'sup-1',
    name: 'Prime Manufacturing',
    contactPerson: 'Suresh Rao',
    phone: '+91 98450 22334',
    email: 'accounts@primemanufacturing.in',
    gstNumber: '29AABCP1234M1Z6',
    city: 'Bengaluru',
    category: 'Manufacturer',
    address: 'Plot 14, Industrial Area, Peenya, Bengaluru',
    joinedAt: '2023-02-10',
  },
  {
    id: 'sup-2',
    name: 'Bottle Suppliers Inc',
    contactPerson: 'Meena Iyer',
    phone: '+91 98450 33445',
    email: 'sales@bottlesuppliers.in',
    gstNumber: '29AABCB5678N1Z8',
    city: 'Chennai',
    category: 'Packaging',
    address: '22 Industrial Estate, Guindy, Chennai',
    joinedAt: '2023-05-18',
  },
  {
    id: 'sup-3',
    name: 'Crystal Caps & Labels',
    contactPerson: 'Arvind Nair',
    phone: '+91 98450 44556',
    email: 'orders@crystalcaps.in',
    gstNumber: '29AABCC9012P1Z1',
    city: 'Coimbatore',
    category: 'Packaging',
    address: '7 SIDCO Estate, Coimbatore',
    joinedAt: '2023-09-01',
  },
  {
    id: 'sup-4',
    name: 'Metro Logistics Co.',
    contactPerson: 'Deepak Shetty',
    phone: '+91 98450 55667',
    email: 'billing@metrologistics.in',
    gstNumber: '29AABCM3456Q1Z3',
    city: 'Bengaluru',
    category: 'Logistics',
    address: '4th Cross, Whitefield Industrial Layout, Bengaluru',
    joinedAt: '2024-01-22',
  },
  {
    id: 'sup-5',
    name: 'Fresh Springs Raw Materials',
    contactPerson: 'Kavita Reddy',
    phone: '+91 98450 66778',
    email: 'procurement@freshsprings.in',
    gstNumber: '29AABCF7890R1Z5',
    city: 'Mysuru',
    category: 'Raw Materials',
    address: '11 KIADB Industrial Area, Mysuru',
    joinedAt: '2024-04-05',
  },
]

export const suppliers = rawSuppliers.map((supplier) => {
  const invoices = purchaseInvoices.filter((invoice) => invoice.supplier === supplier.name)
  const totalPurchases = invoices.reduce((sum, invoice) => sum + invoice.total, 0)

  return {
    ...supplier,
    status: 'active',
    totalPurchases,
    outstandingPayable: Math.round(totalPurchases * 0.15),
  }
})
