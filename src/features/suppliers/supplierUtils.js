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
    code: data.code,
    companyName: data.companyName,
    contactPerson: data.contactPerson,
    phone: data.phone,
    email: data.email,
    gstNumber: data.gstNumber,
    panNumber: data.panNumber ?? data.pan,
    supplierType: data.supplierType ?? data.category,
    category: data.supplierType ?? data.category,
    supplierCategories: data.supplierCategories,
    address: data.address,
    city: data.city,
    state: data.state,
    pinCode: data.pinCode,
    country: data.country,
    paymentTerms: data.paymentTerms,
    creditLimit: data.creditLimit,
    notes: data.notes,
    openingBalance: data.openingBalance,
    status: data.status,
  }
}

// Legacy single `category` -> [category] fallback when supplier_categories is absent.
function resolveSupplierCategories(supplier, fallback) {
  const raw = supplier.supplier_categories ?? fallback.supplierCategories
  if (Array.isArray(raw)) return raw.filter(Boolean)
  const legacy = supplier.categories ?? supplier.category ?? fallback.category
  return legacy ? [legacy] : []
}

export function normalizeApiSupplier(supplier, fallback = {}) {
  const supplierType = supplier.supplier_type ?? supplier.category ?? fallback.supplierType ?? fallback.category ?? ''
  return {
    ...fallback,
    id: supplier.id || fallback.id,
    organizationId: supplier.organization_id || fallback.organizationId,
    name: supplier.name || fallback.name || '',
    code: supplier.code ?? fallback.code ?? '',
    companyName: supplier.company_name ?? fallback.companyName ?? '',
    contactPerson: supplier.contact_person ?? fallback.contactPerson ?? '',
    phone: supplier.phone ?? fallback.phone ?? '',
    email: supplier.email ?? fallback.email ?? '',
    gstNumber: supplier.gst_number ?? fallback.gstNumber ?? '',
    panNumber: supplier.pan_number ?? fallback.panNumber ?? fallback.pan ?? '',
    pan: supplier.pan_number ?? fallback.panNumber ?? fallback.pan ?? '',
    // Canonical single-select supplier type. `category` kept as an alias for existing readers.
    supplierType,
    category: supplierType,
    supplierCategories: resolveSupplierCategories(supplier, fallback),
    address: supplier.address ?? fallback.address ?? '',
    city: supplier.city ?? fallback.city ?? '',
    state: supplier.state ?? fallback.state ?? '',
    pinCode: supplier.pincode ?? supplier.pin_code ?? fallback.pinCode ?? '',
    country: supplier.country ?? fallback.country ?? '',
    paymentTerms: supplier.payment_terms ?? fallback.paymentTerms ?? '',
    creditLimit: supplier.credit_limit ?? fallback.creditLimit ?? null,
    notes: supplier.notes ?? fallback.notes ?? '',
    openingBalance: supplier.opening_balance ?? fallback.openingBalance ?? 0,
    totalPurchases: supplier.total_purchases ?? fallback.totalPurchases ?? 0,
    totalPaid: supplier.total_paid ?? fallback.totalPaid ?? 0,
    outstandingPayable: supplier.outstanding_payable ?? fallback.outstandingPayable ?? 0,
    productsSupplied: supplier.products_supplied || supplier.products || fallback.productsSupplied || [],
    // Optional backend-provided count of linked products (avoids a per-row fetch on the list).
    productCount: supplier.products_count ?? supplier.product_count ?? supplier.linked_products_count ?? fallback.productCount ?? null,
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
