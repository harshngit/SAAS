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

function normalizeVariantInventory(variant = {}) {
  const inventory = variant.inventory && typeof variant.inventory === 'object' ? variant.inventory : {}

  return {
    openingStock: Number(inventory.openingStock ?? variant.inventory ?? variant.stock) || 0,
    minimumStockLevel: Number(inventory.minimumStockLevel ?? variant.minimumStockLevel ?? variant.minimum_stock_level) || 0,
    maximumStockLevel: Number(inventory.maximumStockLevel ?? variant.maximumStockLevel ?? variant.maximum_stock_level) || 0,
    reorderLevel: Number(inventory.reorderLevel ?? variant.reorderLevel ?? variant.reorder_level) || 0,
    reorderQuantity: Number(inventory.reorderQuantity ?? variant.reorderQuantity ?? variant.reorder_quantity) || 0,
  }
}

// Every remaining product field the form already collects but the request body never sent -
// [camelCase form field, snake_case backend field, value kind]. Kept as a table instead of one
// `if` per field since the mapping itself (not the coercion logic) is the only thing that varies.
const PRODUCT_FIELD_MAP = [
  ['barcode', 'barcode', 'string'],
  ['shortName', 'short_name', 'string'],
  ['manufacturer', 'manufacturer', 'string'],
  ['modelNumber', 'model_number', 'string'],
  ['status', 'status', 'string'],
  ['mrp', 'msrp_mrp', 'number'],
  ['wholesalePrice', 'wholesale_price', 'number'],
  ['dealerPrice', 'dealer_price', 'number'],
  ['discountPercent', 'discount', 'number'],
  ['taxInclusivePrice', 'tax_inclusive_price', 'boolean'],
  ['currency', 'currency', 'string'],
  ['inventoryTracking', 'inventory_tracking', 'boolean'],
  ['openingStock', 'opening_stock', 'number'],
  ['minimumStockLevel', 'minimum_stock_level', 'number'],
  ['maximumStockLevel', 'maximum_stock_level', 'number'],
  ['reorderLevel', 'reorder_level', 'number'],
  ['reorderQuantity', 'reorder_quantity', 'number'],
  ['binShelfLocation', 'bin_shelf_location', 'string'],
  ['batchTracking', 'batch_tracking', 'boolean'],
  ['serialNumberTracking', 'serial_number_tracking', 'boolean'],
  ['expiryTracking', 'expiry_tracking', 'boolean'],
  ['hsnSacCode', 'hsn_code', 'string'],
  ['gstVatRate', 'tax_rate', 'number'],
  ['taxCategory', 'tax_category', 'string'],
  ['taxInclusive', 'tax_inclusive', 'boolean'],
  ['preferredSupplierId', 'preferred_supplier_id', 'string'],
  ['supplierProductCode', 'supplier_product_code', 'string'],
  ['leadTime', 'lead_time', 'string'],
  ['minimumOrderQuantity', 'minimum_order_quantity', 'number'],
  ['purchaseUnit', 'purchase_unit', 'string'],
  ['salesUnit', 'sales_unit', 'string'],
  ['commissionEligible', 'commission_eligible', 'boolean'],
  ['commissionPercent', 'commission', 'number'],
  ['defaultDiscount', 'default_discount', 'number'],
  ['weight', 'weight', 'number'],
  ['weightUnit', 'weight_unit', 'string'],
  ['length', 'length', 'number'],
  ['width', 'width', 'number'],
  ['height', 'height', 'number'],
  ['volume', 'volume', 'number'],
  ['color', 'color', 'string'],
  ['material', 'material', 'string'],
  ['size', 'physical_size', 'string'],
  ['hasVariants', 'has_variants', 'boolean'],
  ['variantAttributes', 'variant_attributes', 'list'],
  ['downloadableProduct', 'downloadable_product', 'boolean'],
  ['licenseKeyRequired', 'license_key_required', 'boolean'],
  ['downloadLimit', 'download_limit', 'number'],
  ['warrantyPeriod', 'warranty_period', 'string'],
  ['warrantyPeriodUnit', 'warranty_period_unit', 'string'],
  ['shelfLife', 'shelf_life', 'string'],
  ['shelfLifeUnit', 'shelf_life_unit', 'string'],
  ['countryOfOrigin', 'country_of_origin', 'string'],
  ['launchDate', 'launch_date', 'date'],
  ['endOfLifeDate', 'end_of_life_date', 'date'],
  ['productTags', 'product_tags', 'list'],
  ['notes', 'notes', 'string'],
  ['uom', 'uom', 'string'],
  ['subCategoryId', 'sub_category_id', 'string'],
  ['brandId', 'brand_id', 'string'],
]

// Fields set directly in createProduct/updateProduct's request body rather than through
// PRODUCT_FIELD_MAP - kept separate so a backend validation error on one of these (e.g.
// "name", "category_id") can still be traced back to the form field that produced it.
const PRODUCT_TOP_LEVEL_FIELD_MAP = [
  ['name', 'name'],
  ['description', 'description'],
  ['sellingPrice', 'price'],
  ['coverImage', 'cover_image'],
  ['images', 'images'],
  ['videoUrl', 'product_video'],
  ['catalogBrochure', 'product_catalog_brochure'],
  ['productManual', 'product_manual'],
  ['productDatasheet', 'product_datasheet'],
  ['complianceCertificate', 'compliance_certificate'],
  ['warrantyDocument', 'warranty_document'],
  ['downloadFile', 'download_file'],
  ['productType', 'product_type'],
  ['brand', 'brand'],
  ['productCode', 'sku'],
  ['category', 'category_id'],
  ['status', 'is_active'],
]

const BACKEND_TO_FRONTEND_FIELD = Object.fromEntries([
  ...PRODUCT_FIELD_MAP.map(([formField, backendField]) => [backendField, formField]),
  ...PRODUCT_TOP_LEVEL_FIELD_MAP.map(([formField, backendField]) => [backendField, formField]),
])

// Maps a raw backend field name (from a 422 error's `loc`, e.g. "launch_date") back to the
// camelCase form field name (e.g. "launchDate") so a validation error can jump to the right tab.
export function mapProductBackendField(backendField) {
  return BACKEND_TO_FRONTEND_FIELD[backendField]
}

// FastAPI 422s shape errors as { detail: [{ loc: ["body", "field_name", ...], msg, type }, ...] }.
// Pulls out just the field name (first loc segment after "body") from each entry.
function extractErrorFields(detail) {
  if (!Array.isArray(detail)) return []

  return detail
    .map((entry) => {
      const loc = Array.isArray(entry?.loc) ? entry.loc.filter((part) => part !== 'body') : []
      return typeof loc[0] === 'string' ? loc[0] : null
    })
    .filter(Boolean)
}

function coerceFieldValue(kind, value) {
  if (kind === 'number') return Number(value) || 0
  if (kind === 'boolean') return Boolean(value)
  if (kind === 'list') {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
    return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean)
  }
  // The backend's date fields are `datetime | None` - an empty string fails validation
  // ("input is too short"), so an untouched/cleared date has to be omitted, not sent as ''.
  if (kind === 'date') {
    const trimmed = String(value ?? '').trim()
    return trimmed || undefined
  }
  return value ?? ''
}

// `unitOfMeasure` is the form's existing name for what the backend calls `uom` - map it in
// alongside the rest rather than making callers rename it. Guarding on `!== undefined` lets the
// same table serve both full-object creation and partial PATCH updates.
function applyProductFieldMap(requestBody, payload) {
  PRODUCT_FIELD_MAP.forEach(([formField, backendField, kind]) => {
    const value = formField === 'uom' ? (payload.uom ?? payload.unitOfMeasure) : payload[formField]
    if (value === undefined) return

    const coerced = coerceFieldValue(kind, value)
    if (coerced === undefined || coerced === null) return
    requestBody[backendField] = coerced
  })
}

function toVariationPayload(variant, includeId = false) {
  const inventory = normalizeVariantInventory(variant)
  const variation = {
    name: variant.size || variant.name || 'Default',
    length: Number(variant.length) || 0,
    width: Number(variant.width) || 0,
    height: Number(variant.height) || 0,
    weight: Number(variant.weight) || 0,
    price: Number(variant.sellingPrice ?? variant.price) || 0,
    mrp: Number(variant.mrp) || 0,
    image_url: variant.imageUrl || variant.image_url || null,
    inventory: inventory.openingStock,
    minimum_stock_level: inventory.minimumStockLevel,
    maximum_stock_level: inventory.maximumStockLevel,
    reorder_level: inventory.reorderLevel,
    reorder_quantity: inventory.reorderQuantity,
  }

  if (includeId && variant.id) {
    variation.id = variant.id
  }

  return variation
}

export async function createProduct(payload) {
  try {
    const variations = (payload.variants || []).map((variant) => toVariationPayload(variant))

    const requestBody = {
      name: payload.name.trim(),
      description: payload.description?.trim() || '',
      price: Number(payload.price ?? variations[0]?.price) || 0,
      cover_image: payload.coverImage || payload.cover_image || '',
      images: payload.images || [],
      product_video: payload.productVideo || payload.videoUrl || payload.product_video || '',
      product_catalog_brochure: payload.catalogBrochure || payload.product_catalog_brochure || '',
      product_manual: payload.productManual || payload.product_manual || '',
      product_datasheet: payload.productDatasheet || payload.product_datasheet || '',
      compliance_certificate: payload.complianceCertificate || payload.compliance_certificate || '',
      warranty_document: payload.warrantyDocument || payload.warranty_document || '',
      download_file: payload.downloadFile || payload.download_file || '',
      product_type: payload.productType || payload.product_type || payload.category || '',
      vendor: payload.vendor || '',
      brand: payload.brand?.trim() || '',
      sku: payload.sku || payload.variants?.[0]?.sku || '',
      category_id: payload.categoryId || payload.category_id || payload.category || '',
      total_inventory: Number(payload.totalInventory ?? payload.total_inventory) || variations.reduce((sum, variant) => sum + variant.inventory, 0),
      variations,
    }

    applyProductFieldMap(requestBody, payload)

    const { data } = await apiClient.post('/products', requestBody, {
      headers: authHeader(),
    })

    return { success: true, product: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create product. Please try again.',
    )

    return { success: false, error: message, errorFields: extractErrorFields(errorData?.detail) }
  }
}

export async function getProduct(productId) {
  try {
    const { data } = await apiClient.get(`/products/${productId}`, {
      headers: authHeader(),
    })

    return { success: true, product: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load product details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateProduct(productId, payload) {
  try {
    const requestBody = {}

    if (payload.name !== undefined) requestBody.name = payload.name.trim()
    if (payload.description !== undefined) requestBody.description = payload.description?.trim() || ''
    if (payload.price !== undefined) requestBody.price = Number(payload.price) || 0
    if (payload.coverImage !== undefined || payload.cover_image !== undefined) {
      requestBody.cover_image = payload.coverImage ?? payload.cover_image ?? ''
    }
    if (payload.images !== undefined) requestBody.images = payload.images
    if (payload.productVideo !== undefined || payload.videoUrl !== undefined || payload.product_video !== undefined) {
      requestBody.product_video = payload.productVideo || payload.videoUrl || payload.product_video || ''
    }
    if (payload.catalogBrochure !== undefined || payload.product_catalog_brochure !== undefined) {
      requestBody.product_catalog_brochure = payload.catalogBrochure || payload.product_catalog_brochure || ''
    }
    if (payload.productManual !== undefined || payload.product_manual !== undefined) {
      requestBody.product_manual = payload.productManual || payload.product_manual || ''
    }
    if (payload.productDatasheet !== undefined || payload.product_datasheet !== undefined) {
      requestBody.product_datasheet = payload.productDatasheet || payload.product_datasheet || ''
    }
    if (payload.complianceCertificate !== undefined || payload.compliance_certificate !== undefined) {
      requestBody.compliance_certificate = payload.complianceCertificate || payload.compliance_certificate || ''
    }
    if (payload.warrantyDocument !== undefined || payload.warranty_document !== undefined) {
      requestBody.warranty_document = payload.warrantyDocument || payload.warranty_document || ''
    }
    if (payload.downloadFile !== undefined || payload.download_file !== undefined) {
      requestBody.download_file = payload.downloadFile || payload.download_file || ''
    }
    if (payload.productType !== undefined || payload.product_type !== undefined || payload.category !== undefined) {
      requestBody.product_type = payload.productType || payload.product_type || payload.category || ''
    }
    if (payload.vendor !== undefined) requestBody.vendor = payload.vendor || ''
    if (payload.brand !== undefined) requestBody.brand = payload.brand?.trim() || ''
    if (payload.sku !== undefined) requestBody.sku = payload.sku || payload.variants?.[0]?.sku || ''
    if (payload.categoryId !== undefined || payload.category_id !== undefined || payload.category !== undefined) {
      requestBody.category_id = payload.categoryId || payload.category_id || payload.category || ''
    }
    if (payload.isActive !== undefined || payload.is_active !== undefined) {
      requestBody.is_active = payload.isActive ?? payload.is_active
    }
    if (payload.totalInventory !== undefined || payload.total_inventory !== undefined) {
      requestBody.total_inventory = Number(payload.totalInventory ?? payload.total_inventory) || 0
    }
    if (payload.variants !== undefined) {
      requestBody.variations = payload.variants.map((variant) => toVariationPayload(variant, true))

      if (requestBody.total_inventory === undefined) {
        requestBody.total_inventory = requestBody.variations.reduce((sum, variant) => sum + variant.inventory, 0)
      }
    }

    applyProductFieldMap(requestBody, payload)

    const { data } = await apiClient.patch(`/products/${productId}`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, product: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update product. Please try again.',
    )

    return { success: false, error: message, errorFields: extractErrorFields(errorData?.detail) }
  }
}

export async function deleteProduct(productId) {
  try {
    await apiClient.delete(`/products/${productId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete product. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getProductBatches(productId, params = {}) {
  try {
    const queryParams = {}
    if (params.warehouse_id) queryParams.warehouse_id = params.warehouse_id
    if (params.in_stock_only !== undefined) queryParams.in_stock_only = params.in_stock_only

    const { data } = await apiClient.get(`/products/${productId}/batches`, {
      headers: authHeader(),
      params: queryParams,
    })

    return { success: true, batches: Array.isArray(data) ? data : data?.batches || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load product batches. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getProductSerials(productId, params = {}) {
  try {
    const queryParams = {}
    if (params.status) queryParams.status = params.status

    const { data } = await apiClient.get(`/products/${productId}/serials`, {
      headers: authHeader(),
      params: queryParams,
    })

    return { success: true, serials: Array.isArray(data) ? data : data?.serials || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load product serial numbers. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function listProductAttachments(productId) {
  try {
    const { data } = await apiClient.get(`/products/${productId}/attachments`, {
      headers: authHeader(),
    })

    return { success: true, attachments: Array.isArray(data) ? data : data?.attachments || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load product attachments. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function addProductAttachments(productId, files) {
  try {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))

    const { data } = await apiClient.post(`/products/${productId}/attachments`, formData, {
      headers: {
        ...authHeader(),
        'Content-Type': 'multipart/form-data',
      },
    })

    return { success: true, attachments: Array.isArray(data) ? data : data?.attachments || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to upload attachments. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteProductAttachment(productId, attachmentId) {
  try {
    await apiClient.delete(`/products/${productId}/attachments/${attachmentId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete attachment. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteProductsBulk(productIds) {
  try {
    const { data } = await apiClient.post(
      '/products/bulk-delete',
      { ids: productIds },
      { headers: authHeader() },
    )

    return { success: true, deleted: data?.deleted ?? productIds.length }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete selected products. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function listProducts(params = {}) {
  try {
    const queryParams = {}

    if (params.search) queryParams.search = params.search
    if (params.category_id) queryParams.category_id = params.category_id
    if (params.is_active !== undefined && params.is_active !== null) queryParams.is_active = params.is_active
    if (params.barcode) queryParams.barcode = params.barcode

    const { data } = await apiClient.get('/products', {
      headers: authHeader(),
      params: queryParams,
    })

    return { success: true, products: Array.isArray(data) ? data : data?.products || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load products. Please try again.',
    )

    return { success: false, error: message }
  }
}
