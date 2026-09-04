// Shared with SupplierForm.jsx so the Add/Edit dropdown and the Detail display always agree on
// the same value -> label mapping (Payment Terms is stored as a raw code like '30'/'immediate').
export const PAYMENT_TERMS_OPTIONS = [
  { value: 'immediate', label: 'Immediate' },
  { value: '7', label: '7 Days' },
  { value: '15', label: '15 Days' },
  { value: '30', label: '30 Days' },
  { value: '45', label: '45 Days' },
  { value: '60', label: '60 Days' },
  { value: 'custom', label: 'Custom' },
]

export function formatPaymentTerms(value) {
  if (!value) return null
  return PAYMENT_TERMS_OPTIONS.find((option) => option.value === value)?.label || value
}

export function supplierFormFallback(data, id) {
  return {
    id,
    name: data.name,
    contactPerson: data.contactPerson,
    phone: data.phone,
    email: data.email,
    gstNumber: data.gstNumber,
    category: data.category,
    address: data.address,
    city: data.city,
    openingBalance: data.openingBalance,
    status: data.status,
  }
}

export function normalizeApiSupplier(supplier, fallback = {}) {
  return {
    ...fallback,
    id: supplier.id || fallback.id,
    organizationId: supplier.organization_id || fallback.organizationId,
    name: supplier.name || fallback.name || '',
    contactPerson: supplier.contact_person ?? fallback.contactPerson ?? '',
    phone: supplier.phone ?? fallback.phone ?? '',
    email: supplier.email ?? fallback.email ?? '',
    gstNumber: supplier.gst_number ?? fallback.gstNumber ?? '',
    category: supplier.category ?? fallback.category ?? '',
    address: supplier.address ?? fallback.address ?? '',
    city: supplier.city ?? fallback.city ?? '',
    openingBalance: supplier.opening_balance ?? fallback.openingBalance ?? 0,
    totalPurchases: supplier.total_purchases ?? fallback.totalPurchases ?? 0,
    totalPaid: supplier.total_paid ?? fallback.totalPaid ?? 0,
    outstandingPayable: supplier.outstanding_payable ?? fallback.outstandingPayable ?? 0,
    productsSupplied: supplier.products_supplied || supplier.products || fallback.productsSupplied || [],
    status: supplier.is_active === false ? 'inactive' : 'active',
    createdAt: supplier.created_at || fallback.createdAt,
    updatedAt: supplier.updated_at || fallback.updatedAt,
  }
}

export function normalizeApiPayment(payment) {
  return {
    id: payment.id,
    supplierId: payment.supplier_id,
    amount: payment.amount,
    paymentMode: payment.payment_mode,
    reference: payment.reference || '',
    note: payment.note || '',
    paidOn: payment.paid_on,
    createdAt: payment.created_at,
  }
}
