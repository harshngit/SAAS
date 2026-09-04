const demoProducts = [
  { id: 'demo-product-anchor', name: 'Anchor Roma 6A One-Way Switch', sku: 'ANCHOR-6A', categoryLabel: 'Electrical', category: 'Electrical', status: 'active', preferredSupplierId: 'demo-supplier-reliance', variants: [{ purchasePrice: 185 }] },
  { id: 'demo-product-extension', name: 'Industrial Extension Board', sku: 'EXT-IND-01', categoryLabel: 'Electrical', category: 'Electrical', status: 'active', preferredSupplierId: 'demo-supplier-reliance', variants: [{ purchasePrice: 760 }] },
  { id: 'demo-product-havells', name: 'Havells LED Batten', sku: 'HAV-LED-20', categoryLabel: 'Lighting', category: 'Lighting', status: 'active', preferredSupplierId: 'demo-supplier-reliance', variants: [{ purchasePrice: 420 }] },
  { id: 'demo-product-water', name: 'Mineral Water', sku: 'WATER-1L', categoryLabel: 'Beverages', category: 'Beverages', status: 'active', preferredSupplierId: 'demo-supplier-coastal', variants: [{ purchasePrice: 18 }] },
  { id: 'demo-product-juice', name: 'Juice', sku: 'JUICE-200', categoryLabel: 'Beverages', category: 'Beverages', status: 'active', preferredSupplierId: 'demo-supplier-coastal', variants: [{ purchasePrice: 32 }] },
  { id: 'demo-product-soft-drinks', name: 'Soft Drinks', sku: 'SOFT-500', categoryLabel: 'Beverages', category: 'Beverages', status: 'active', preferredSupplierId: 'demo-supplier-coastal', variants: [{ purchasePrice: 38 }] },
  { id: 'demo-product-cables', name: 'Copper Cable Roll', sku: 'CAB-CU-90', categoryLabel: 'Electrical', category: 'Electrical', status: 'active', preferredSupplierId: 'demo-supplier-apex', variants: [{ purchasePrice: 2400 }] },
]

// `category` stores the Supplier TYPE (the only classification the backend persists - see
// SupplierForm.jsx). `supplierCategories` is the separate, frontend-only multi-select business
// category (Raw Material / Packaging / Service / Transport / Maintenance / Contractor / Other) -
// there is no backend field for it, so it is demo-only until the schema grows one.
const demoSuppliers = [
  {
    id: 'demo-supplier-reliance', name: 'Reliance Industries', contactPerson: 'Anil Mehta', phone: '+91 98765 41001', email: 'procurement@reliance-demo.example',
    city: 'Mumbai', category: 'Manufacturer', supplierCategories: ['Raw Material', 'Contractor'],
    address: 'Plot 14, Andheri Industrial Estate, Andheri East',
    gstNumber: '27AAECR1234F1Z5', gstRegistered: true, pan: 'AAECR1234F', state: 'Maharashtra', pinCode: '400001', country: 'India',
    paymentTerms: '30', creditLimit: 100000, purchaseCurrency: 'INR', openingBalance: 0,
    totalPurchases: 185000, totalPaid: 125000, outstandingPayable: 60000, status: 'active', productsSupplied: demoProducts.slice(0, 3),
    createdAt: '2026-01-10T09:00:00.000Z', updatedAt: '2026-08-20T15:00:00.000Z',
  },
  {
    id: 'demo-supplier-coastal', name: 'Coastal Beverages Distribution', contactPerson: 'Priya Nair', phone: '+91 98765 41002', email: 'orders@coastal-demo.example',
    city: 'Kochi', category: 'Distributor', supplierCategories: ['Other'],
    address: 'Warehouse 3, Willingdon Island Port Road',
    gstNumber: '', gstRegistered: false, pan: 'AABCC5678K', state: 'Kerala', pinCode: '682001', country: 'India',
    paymentTerms: '15', creditLimit: 50000, purchaseCurrency: 'INR', openingBalance: 0,
    totalPurchases: 92000, totalPaid: 92000, outstandingPayable: 0, status: 'active', productsSupplied: demoProducts.slice(3, 6),
    createdAt: '2026-02-05T09:00:00.000Z', updatedAt: '2026-08-22T11:30:00.000Z',
  },
  {
    id: 'demo-supplier-metro', name: 'Metro Wholesale Supplies', contactPerson: 'Rakesh Shah', phone: '+91 98765 41003', email: 'hello@metro-demo.example',
    city: 'Pune', category: 'Wholesaler', supplierCategories: ['Other'],
    address: 'Shop 22, Market Yard, Gultekdi',
    gstNumber: '27AABCM5678G1Z2', gstRegistered: true, pan: 'AABCM5678G', state: 'Maharashtra', pinCode: '411001', country: 'India',
    paymentTerms: 'immediate', creditLimit: 20000, purchaseCurrency: 'INR', openingBalance: 0,
    totalPurchases: 0, totalPaid: 0, outstandingPayable: 0, status: 'inactive', productsSupplied: [],
    createdAt: '2026-03-01T09:00:00.000Z', updatedAt: '2026-03-01T09:00:00.000Z',
  },
  {
    id: 'demo-supplier-apex', name: 'Apex Electricals', contactPerson: 'Neeraj Kapoor', phone: '+91 98765 41004', email: 'sales@apex-demo.example',
    city: 'Delhi', category: 'Distributor', supplierCategories: ['Raw Material', 'Maintenance'],
    address: 'B-45, Bhagirath Palace, Chandni Chowk',
    gstNumber: '07AABCA9012H1Z8', gstRegistered: true, pan: 'AABCA9012H', state: 'Delhi', pinCode: '110001', country: 'India',
    paymentTerms: '45', creditLimit: 60000, purchaseCurrency: 'INR', openingBalance: 0,
    totalPurchases: 45000, totalPaid: 0, outstandingPayable: 45000, status: 'active', productsSupplied: [demoProducts[6]],
    createdAt: '2026-04-12T09:00:00.000Z', updatedAt: '2026-08-25T10:00:00.000Z',
  },
]

const demoPurchases = [
  { id: 'demo-purchase-rel-001', invoiceNumber: 'REL-2026-001', supplierId: 'demo-supplier-reliance', supplierName: 'Reliance Industries', purchaseDate: '2026-08-08', invoiceDate: '2026-08-08', warehouseId: 'Mumbai Central', total: 185000, receivingStatus: 'Received', paymentStatus: 'Partially Paid', purchaseStatus: 'Received' },
  { id: 'demo-purchase-cst-001', invoiceNumber: 'CST-2026-014', supplierId: 'demo-supplier-coastal', supplierName: 'Coastal Beverages Distribution', purchaseDate: '2026-08-18', invoiceDate: '2026-08-18', warehouseId: 'Kochi Main', total: 92000, receivingStatus: 'Received', paymentStatus: 'Paid', purchaseStatus: 'Received' },
  { id: 'demo-purchase-apx-001', invoiceNumber: 'APX-2026-006', supplierId: 'demo-supplier-apex', supplierName: 'Apex Electricals', purchaseDate: '2026-08-25', invoiceDate: '2026-08-25', warehouseId: 'Delhi North', total: 45000, receivingStatus: 'Pending', paymentStatus: 'Unpaid', purchaseStatus: 'Pending' },
]

const demoPayments = [
  { id: 'demo-payment-rel-001', supplierId: 'demo-supplier-reliance', amount: 125000, paymentMode: 'bank_transfer', reference: 'REL-NEFT-8821', note: 'August part payment', paidOn: '2026-08-20' },
  { id: 'demo-payment-cst-001', supplierId: 'demo-supplier-coastal', amount: 92000, paymentMode: 'upi', reference: 'CST-UPI-1442', note: 'Invoice settled', paidOn: '2026-08-22' },
]

export { demoProducts, demoSuppliers, demoPurchases, demoPayments }

export function getDemoSupplier(id) {
  return demoSuppliers.find((supplier) => supplier.id === id) || null
}

export function getDemoSupplierPayments(id) {
  return demoPayments.filter((payment) => payment.supplierId === id)
}

export function getDemoSupplierPurchases(id) {
  return demoPurchases.filter((purchase) => purchase.supplierId === id)
}

// Human-friendly display references for demo records - the internal `demo-supplier-*` /
// `demo-payment-*` ids stay exactly as they are for logic/safety (isDemoRecord checks, API
// guards); these are purely cosmetic labels for what the UI shows the user.
export function getDemoSupplierDisplayId(id) {
  const index = demoSuppliers.findIndex((supplier) => supplier.id === id)
  return index === -1 ? id : `SUP-${String(index + 1).padStart(4, '0')}`
}

export function getDemoPaymentDisplayId(paymentId) {
  const index = demoPayments.findIndex((payment) => payment.id === paymentId)
  if (index === -1) return paymentId
  const year = demoPayments[index].paidOn ? new Date(demoPayments[index].paidOn).getFullYear() : new Date().getFullYear()
  return `PAY-${year}-${String(index + 1).padStart(3, '0')}`
}
