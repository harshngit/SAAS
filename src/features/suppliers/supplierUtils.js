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
