import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) {
    return fallbackMessage
  }

  if (typeof errorData === 'string') {
    return errorData
  }

  if (Array.isArray(errorData)) {
    return errorData.map((error) => formatApiError(error)).filter(Boolean).join(', ')
  }

  if (typeof errorData === 'object') {
    if (errorData.msg) {
      const field = Array.isArray(errorData.loc) ? errorData.loc.filter((part) => part !== 'body').join('.') : ''
      return field ? `${field}: ${errorData.msg}` : errorData.msg
    }

    if (errorData.message || errorData.error) {
      return formatApiError(errorData.message || errorData.error)
    }

    return Object.entries(errorData)
      .map(([field, value]) => `${field}: ${formatApiError(value)}`)
      .join(', ')
  }

  return String(errorData)
}

function authHeader() {
  const accessToken = useAuthStore.getState().authTokens?.access_token
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

function toIsoDateTime(value) {
  if (!value) return undefined

  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function toDateOnly(value) {
  if (!value) return undefined

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10)
}

function parseMapsCoordinates(value) {
  if (!value) return null

  const text = String(value).trim()

  const plainMatch = text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (plainMatch) {
    return { lat: Number(plainMatch[1]), lng: Number(plainMatch[2]) }
  }

  const urlMatch = text.match(/[@=](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (urlMatch) {
    return { lat: Number(urlMatch[1]), lng: Number(urlMatch[2]) }
  }

  return null
}

function toStringArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (!value) return []

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

// The API takes a "sectioned" body (basic_information, contact_information, address_information, ...).
// CustomerForm keeps working with a flat camelCase shape, so this is the only place that knows the split.
function buildCustomerRequestBody(payload) {
  const customerName = (payload.customerName || payload.name || '').trim()
  const coordinates = parseMapsCoordinates(payload.googleMapsLocation || payload.google_maps_location)

  return {
    basic_information: {
      customer_type: payload.customerType || payload.type || payload.category || '',
      customer_name: customerName,
      legal_business_name: (payload.legalBusinessName || payload.businessName || customerName || '').trim(),
      display_name: (payload.displayName || '').trim(),
      industry: payload.industry || '',
      customer_category: payload.customerCategory || '',
      customer_since: toIsoDateTime(payload.customerSince || payload.customer_since),
      status: payload.status || 'active',
    },
    contact_information: {
      primary_contact_person: (payload.primaryContactPerson || payload.primary_contact_person || '').trim(),
      designation: payload.designation || '',
      mobile_number: (payload.mobileNumber || payload.phone || '').trim(),
      alternate_mobile_number: payload.alternateMobileNumber || '',
      email_address: payload.email?.trim().toLowerCase() || '',
      website: payload.website || '',
    },
    address_information: {
      billing_address: payload.billingAddress?.trim() || '',
      shipping_address: payload.shippingAddress?.trim() || payload.deliveryAddress?.trim() || payload.billingAddress?.trim() || '',
      city: payload.city || '',
      state: payload.state || '',
      country: payload.country || '',
      pin_zip_code: payload.pinZipCode || '',
      ...(coordinates
        ? { google_maps_location: { latitude: coordinates.lat, longitude: coordinates.lng } }
        : {}),
    },
    business_tax_information: {
      gstin_tax_id: (payload.gstNumber || payload.gst_number || '').trim().toUpperCase(),
      pan_business_registration_no: payload.panBusinessRegistrationNo || '',
      tax_exempt: Boolean(payload.taxExempt),
      tax_category: payload.taxCategory || '',
      currency: payload.currency || '',
    },
    payment_information: {
      payment_terms: payload.paymentTerms || '',
      credit_limit: Number(payload.creditLimit) || 0,
      opening_balance: Number(payload.openingBalance) || 0,
      preferred_payment_method: payload.preferredPaymentMethod || '',
      upi_id: payload.upiId || '',
      bank_name: payload.bankName || '',
      account_number: payload.accountNumber || '',
      ifsc_swift_code: payload.ifscSwiftCode || '',
    },
    sales_crm_information: {
      sales_representative_id: payload.assignedSalesOfficerId || payload.assigned_sales_officer_id || '',
      lead_source: payload.leadSource || '',
      territory: payload.territory || '',
      customer_priority: payload.customerPriority || '',
      preferred_communication: toStringArray(payload.preferredCommunication),
      customer_tags: toStringArray(payload.customerTags),
    },
    social_media_online_presence: {
      facebook_url: payload.facebook || '',
      instagram_url: payload.instagram || '',
      linkedin_url: payload.linkedin || '',
      x_twitter_url: payload.twitter || '',
      youtube_url: payload.youtube || '',
    },
    additional_information: {
      date_of_birth: toIsoDateTime(payload.dateOfBirth),
      anniversary_date: toIsoDateTime(payload.anniversaryDate),
      referral_customer_id: payload.referralCustomer || '',
      loyalty_number: payload.loyaltyNumber || '',
      notes: payload.notes?.trim() || '',
    },
  }
}

// GET/POST/PATCH all return the same "sectioned" customer profile — flatten it back to the
// camelCase shape CustomerForm/CustomerDetail/CustomerEdit already know how to read.
function normalizeSectionedCustomer(data) {
  if (!data) return data

  const basic = data.basic_information || {}
  const contact = data.contact_information || {}
  const address = data.address_information || {}
  const businessTax = data.business_tax_information || {}
  const paymentInfo = data.payment_information || {}
  const salesCrm = data.sales_crm_information || {}
  const social = data.social_media_online_presence || {}
  const documents = data.documents || {}
  const additional = data.additional_information || {}
  const financial = data.financial_summary || {}
  const salesSummary = data.sales_summary || {}
  const mapsLocation = address.google_maps_location || {}
  const hasCoordinates = typeof mapsLocation.latitude === 'number' && typeof mapsLocation.longitude === 'number'

  return {
    id: data.id,
    customerId: data.customer_id,
    organizationId: data.organization_id,

    customerType: basic.customer_type || '',
    customerName: basic.customer_name || '',
    name: basic.customer_name || '',
    legalBusinessName: basic.legal_business_name || '',
    businessName: basic.legal_business_name || basic.customer_name || '',
    displayName: basic.display_name || '',
    industry: basic.industry || '',
    customerCategory: basic.customer_category || '',
    category: basic.customer_category || '',
    customerSince: basic.customer_since,
    status: basic.status || (data.is_active === false ? 'inactive' : 'active'),

    primaryContactPerson: contact.primary_contact_person || '',
    designation: contact.designation || '',
    mobileNumber: contact.mobile_number || '',
    phone: contact.mobile_number || '',
    alternateMobileNumber: contact.alternate_mobile_number || '',
    email: contact.email_address || '',
    website: contact.website || '',

    billingAddress: address.billing_address || '',
    shippingAddress: address.shipping_address || '',
    deliveryAddress: address.shipping_address || '',
    city: address.city || '',
    state: address.state || '',
    country: address.country || '',
    pinZipCode: address.pin_zip_code || '',
    googleMapsLocation: hasCoordinates ? `${mapsLocation.latitude}, ${mapsLocation.longitude}` : '',
    mapsLatitude: mapsLocation.latitude,
    mapsLongitude: mapsLocation.longitude,

    gstNumber: businessTax.gstin_tax_id || '',
    panBusinessRegistrationNo: businessTax.pan_business_registration_no || '',
    taxExempt: Boolean(businessTax.tax_exempt),
    taxCategory: businessTax.tax_category || '',
    currency: businessTax.currency || '',

    paymentTerms: paymentInfo.payment_terms || '',
    creditLimit: paymentInfo.credit_limit ?? 0,
    openingBalance: paymentInfo.opening_balance ?? 0,
    preferredPaymentMethod: paymentInfo.preferred_payment_method || '',
    upiId: paymentInfo.upi_id || '',
    bankName: paymentInfo.bank_name || '',
    accountNumber: paymentInfo.account_number || '',
    ifscSwiftCode: paymentInfo.ifsc_swift_code || '',

    assignedSalesOfficerId: salesCrm.sales_representative_id || '',
    assignedSalesOfficer: salesCrm.sales_representative || null,
    leadSource: salesCrm.lead_source || '',
    territory: salesCrm.territory || '',
    customerPriority: salesCrm.customer_priority || '',
    preferredCommunication: (salesCrm.preferred_communication || []).join(', '),
    customerTags: (salesCrm.customer_tags || []).join(', '),

    facebook: social.facebook_url || '',
    instagram: social.instagram_url || '',
    linkedin: social.linkedin_url || '',
    twitter: social.x_twitter_url || '',
    youtube: social.youtube_url || '',

    gstCertificate: documents.gst_certificate_id ? 'Uploaded' : '',
    panCard: documents.pan_card_id ? 'Uploaded' : '',
    businessRegistrationCertificate: documents.business_registration_certificate_id ? 'Uploaded' : '',
    addressProof: documents.address_proof_id ? 'Uploaded' : '',
    purchaseAgreement: documents.purchase_agreement_id ? 'Uploaded' : '',
    otherDocuments: documents.other_document_ids?.length ? `${documents.other_document_ids.length} file(s)` : '',
    documentIds: documents,

    dateOfBirth: toDateOnly(additional.date_of_birth),
    anniversaryDate: toDateOnly(additional.anniversary_date),
    referralCustomer: additional.referral_customer_id || '',
    loyaltyNumber: additional.loyalty_number || '',
    notes: additional.notes || '',

    outstandingBalance: financial.outstanding_balance ?? 0,
    totalBilled: financial.total_billed ?? 0,
    totalReceived: financial.total_received ?? 0,
    availableCredit: financial.available_credit ?? 0,

    totalOrders: salesSummary.total_orders ?? 0,
    totalPurchases: salesSummary.total_purchases ?? 0,
    lastPurchaseDate: salesSummary.last_purchase_date,
    customerLifetimeValue: salesSummary.customer_lifetime_value ?? 0,

    isActive: data.is_active,
    is_active: data.is_active,
    createdAt: data.created_at,
    created_at: data.created_at,
    updatedAt: data.updated_at,
    updated_at: data.updated_at,
  }
}

export async function createCustomer(payload) {
  try {
    const requestBody = buildCustomerRequestBody(payload)

    const { data } = await apiClient.post('/customers', requestBody, {
      headers: authHeader(),
    })

    return { success: true, customer: normalizeSectionedCustomer(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create customer. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateCustomer(customerId, payload) {
  try {
    const { data } = await apiClient.patch(`/customers/${customerId}`, buildCustomerRequestBody(payload), {
      headers: authHeader(),
    })

    return { success: true, customer: normalizeSectionedCustomer(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update customer. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function listCustomers(params = {}) {
  try {
    const queryParams = {}

    if (params.search) queryParams.search = params.search
    if (params.category) queryParams.category = params.category
    if (params.is_active !== undefined && params.is_active !== null) queryParams.is_active = params.is_active
    if (params.assigned_sales_officer_id) queryParams.assigned_sales_officer_id = params.assigned_sales_officer_id

    const { data } = await apiClient.get('/customers', {
      headers: authHeader(),
      params: queryParams,
    })

    return { success: true, customers: Array.isArray(data) ? data : data?.customers || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load customers. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getCustomer(customerId) {
  try {
    const { data } = await apiClient.get(`/customers/${customerId}`, {
      headers: authHeader(),
    })

    return { success: true, customer: normalizeSectionedCustomer(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load customer details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteCustomer(customerId) {
  try {
    await apiClient.delete(`/customers/${customerId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete customer. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function uploadCustomerDocument(customerId, documentType, file) {
  try {
    const formData = new FormData()
    formData.append('document_type', documentType)
    formData.append('file', file)

    const { data } = await apiClient.post(`/customers/${customerId}/documents`, formData, {
      headers: {
        ...authHeader(),
        'Content-Type': 'multipart/form-data',
      },
    })

    return { success: true, document: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to upload document. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function uploadOtherCustomerDocuments(customerId, files) {
  try {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))

    const { data } = await apiClient.post(`/customers/${customerId}/documents/other`, formData, {
      headers: {
        ...authHeader(),
        'Content-Type': 'multipart/form-data',
      },
    })

    return { success: true, documents: Array.isArray(data) ? data : [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to upload documents. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function listCustomerDocuments(customerId, documentType) {
  try {
    const { data } = await apiClient.get(`/customers/${customerId}/documents`, {
      headers: authHeader(),
      params: documentType ? { document_type: documentType } : undefined,
    })

    return { success: true, documents: Array.isArray(data) ? data : [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load customer documents. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function recordCustomerPayment(customerId, payload) {
  try {
    const requestBody = {
      amount: Number(payload.amount),
      payment_mode: payload.paymentMode || payload.payment_mode || 'cash',
      reference: payload.reference || '',
      note: payload.note || '',
      order_id: payload.orderId || payload.order_id || '',
      invoice_id: payload.invoiceId || payload.invoice_id || '',
      received_on: payload.receivedOn || payload.received_on || new Date().toISOString(),
    }

    const { data } = await apiClient.post(`/customers/${customerId}/payments`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, customer: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to record customer payment. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getCustomerPayments(customerId) {
  try {
    const { data } = await apiClient.get(`/customers/${customerId}/payments`, {
      headers: authHeader(),
    })

    return { success: true, payments: Array.isArray(data) ? data : data?.payments || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load customer payments. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getCustomerPaymentReceipt(customerId, paymentId) {
  try {
    const { data } = await apiClient.get(`/customers/${customerId}/payments/receipt/${paymentId}`, {
      headers: authHeader(),
    })

    return { success: true, receipt: data?.url || data?.receipt_url || data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to download customer payment receipt. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function voidCustomerPayment(customerId, paymentId) {
  try {
    const { data } = await apiClient.delete(`/customers/${customerId}/payments/${paymentId}`, {
      headers: authHeader(),
    })

    return { success: true, customer: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to void customer payment. Please try again.',
    )

    return { success: false, error: message }
  }
}
