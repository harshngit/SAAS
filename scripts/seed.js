/**
 * CRM SaaS — full-flow dummy data seeder
 * ---------------------------------------
 * Walks the ENTIRE backend API surface end to end so every screen in the
 * frontend has real data to show: org profile, warehouse, categories,
 * products (batch + serial tracked), suppliers, purchase invoices (approved,
 * so stock actually lands), staff (Sales Executive + Delivery Partner, with
 * real login credentials so you can view their dashboards), vehicles,
 * customers, leads, quotations -> orders, deliveries (planned -> loaded ->
 * confirmed), invoices (order-billed + direct/walk-in), payment receipts,
 * a sales return (requested -> received -> approved), expenses, attendance
 * check-ins, and a location ping.
 *
 * Every created record's ID is written to seed-output.json as we go, so if
 * something fails halfway through you still keep what was created, and you
 * have every login / ID handy for manual testing afterwards.
 *
 * USAGE
 *   cp .env.example .env      # fill in real values
 *   npm install
 *   npm run seed
 *
 * This talks to your LIVE backend. Point it at a throwaway/staging org
 * unless you're fine with a pile of "Seed Demo" records in production data.
 */

import axios from 'axios'
import FormData from 'form-data'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Config / .env loading (no dotenv dependency — just parse it manually)
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.join(__dirname, '.env')
  if (!fs.existsSync(envPath)) {
    console.error('Missing .env — copy .env.example to .env and fill it in first.')
    process.exit(1)
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (!(key in process.env)) process.env[key] = value
  }
}
loadEnv()

const API_BASE_URL = process.env.API_BASE_URL || 'https://crm-saas-backend-9nom.onrender.com/'
const REGISTER_NEW_ORG = (process.env.REGISTER_NEW_ORG || 'true').toLowerCase() === 'true'
const ORG_NAME = process.env.ORG_NAME || 'Seed Demo Traders'
const ADMIN_NAME = process.env.ADMIN_NAME || 'Demo Admin'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'demo.admin@seedtest.local'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'DemoPass123!'
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'StaffPass123!'
const ASSETS_DIR = path.resolve(__dirname, process.env.ASSETS_DIR || '../public/dummy-photo')

// ---------------------------------------------------------------------------
// Output tracking — every created ID gets written here as we go
// ---------------------------------------------------------------------------
const OUTPUT_PATH = path.join(__dirname, 'seed-output.json')
const output = {
  startedAt: new Date().toISOString(),
  apiBaseUrl: API_BASE_URL,
  admin: null,
  staff: [],
  warehouse: null,
  categories: [],
  products: [],
  suppliers: [],
  purchaseInvoices: [],
  vehicles: [],
  customers: [],
  leads: [],
  quotations: [],
  orders: [],
  deliveries: [],
  invoices: [],
  paymentReceipts: [],
  salesReturns: [],
  expenses: [],
  errors: [],
}
function saveOutput() {
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function log(stage, message) {
  console.log(`[${stage}] ${message}`)
}

function logError(stage, error) {
  const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message
  console.error(`[${stage}] ERROR: ${detail}`)
  output.errors.push({ stage, detail, at: new Date().toISOString() })
}

// Runs fn, logs + records failure, but never throws — one broken stage
// should never take down the whole seed run.
async function step(stage, fn) {
  try {
    const result = await fn()
    saveOutput()
    return result
  } catch (error) {
    logError(stage, error)
    saveOutput()
    return null
  }
}

function randomOf(array) {
  return array[Math.floor(Math.random() * array.length)]
}

function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Asset files to cycle through for every upload slot. Two pools:
//   - ASSET_IMAGES: image-only slots (product cover, staff photo, logo) —
//     several backend upload endpoints reject non-image content here.
//   - ASSET_DOCUMENTS: images + PDFs, for genuine "document" slots (customer
//     documents, expense receipts) where a PDF is realistic and the backend
//     accepts it.
// ---------------------------------------------------------------------------
function collectAssetFiles(pattern, patternLabel) {
  if (!fs.existsSync(ASSETS_DIR)) {
    console.warn(`ASSETS_DIR "${ASSETS_DIR}" does not exist — uploads will be skipped.`)
    return []
  }
  const files = fs
    .readdirSync(ASSETS_DIR)
    .filter((name) => pattern.test(name))
    .map((name) => path.join(ASSETS_DIR, name))
  if (files.length === 0) {
    console.warn(`No ${patternLabel} files found in "${ASSETS_DIR}" — uploads will be skipped.`)
  }
  return files
}
const ASSET_IMAGES = collectAssetFiles(/\.(jpe?g|png|webp)$/i, '.jpg/.jpeg/.png/.webp')
const ASSET_DOCUMENTS = collectAssetFiles(/\.(jpe?g|png|webp|pdf)$/i, '.jpg/.jpeg/.png/.webp/.pdf')
let assetImageCursor = 0
let assetDocumentCursor = 0
function nextAssetImage() {
  if (ASSET_IMAGES.length === 0) return null
  const file = ASSET_IMAGES[assetImageCursor % ASSET_IMAGES.length]
  assetImageCursor += 1
  return file
}
function nextAssetDocument() {
  if (ASSET_DOCUMENTS.length === 0) return null
  const file = ASSET_DOCUMENTS[assetDocumentCursor % ASSET_DOCUMENTS.length]
  assetDocumentCursor += 1
  return file
}

// ---------------------------------------------------------------------------
// Authenticated API client factory — one per "actor" (admin, each staff
// member) since several endpoints (attendance, location ping) are scoped to
// whoever's token is used.
// ---------------------------------------------------------------------------
function makeClient(accessToken) {
  const client = axios.create({ baseURL: API_BASE_URL, timeout: 30000 })
  if (accessToken) {
    client.defaults.headers.common.Authorization = `Bearer ${accessToken}`
  }
  return client
}

async function uploadFile(client, filePath, stageLabel = 'upload') {
  if (!filePath) return null
  try {
    const form = new FormData()
    form.append('file', fs.createReadStream(filePath))
    const { data } = await client.post('/files/upload', form, {
      headers: form.getHeaders(),
    })
    return data // { url, file_id, name, content_type, size }
  } catch (error) {
    logError(stageLabel, error)
    return null
  }
}

// ===========================================================================
// STAGE 1 — Admin auth
// ===========================================================================
async function authenticateAdmin() {
  const bare = axios.create({ baseURL: API_BASE_URL, timeout: 30000 })

  if (REGISTER_NEW_ORG) {
    log('auth', `Registering new org "${ORG_NAME}"...`)
    try {
      const { data } = await bare.post('/auth/register', {
        organization_name: ORG_NAME,
        admin_name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        role: 'admin',
      })
      output.admin = { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, organizationId: data.organization?.id }
      log('auth', `Registered. Organization ID: ${data.organization?.id}`)
      return makeClient(data.tokens.access_token)
    } catch (error) {
      if (error.response?.status === 409) {
        log('auth', 'Org email already registered — logging in instead.')
      } else {
        throw error
      }
    }
  }

  log('auth', `Logging in as ${ADMIN_EMAIL}...`)
  const { data } = await bare.post('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  output.admin = { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  log('auth', 'Logged in.')
  return makeClient(data.tokens.access_token)
}

// ===========================================================================
// STAGE 2 — Company profile + logo/signature + invoice settings
// ===========================================================================
async function seedCompanyProfile(admin) {
  await step('company-settings', async () => {
    await admin.put('/organizations/settings', {
      legal_name: `${ORG_NAME} Pvt Ltd`,
      industry: 'Wholesale Trading',
      gst_number: '27ABCDE1234F1Z5',
      pan_number: 'ABCDE1234F',
      primary_mobile: '9876500001',
      website: 'https://seedtest.local',
      registered_address: '221B Industrial Estate, Andheri East',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      pin_code: '400069',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      bank_account_holder: `${ORG_NAME} Pvt Ltd`,
      bank_name: 'HDFC Bank',
      bank_account_details: '50100123456789',
      bank_ifsc: 'HDFC0000123',
      upi_id: 'seedtest@hdfcbank',
      business_hours: 'Mon–Sat, 9:30 AM – 6:30 PM',
      mission_vision: 'Reliable wholesale distribution, delivered on time, every time.',
    })
    log('company-settings', 'Company profile filled.')

    const logo = nextAssetImage()
    if (logo) {
      const form = new FormData()
      form.append('file', fs.createReadStream(logo))
      await admin.post('/organizations/settings/logo', form, { headers: form.getHeaders() })
      log('company-settings', 'Logo uploaded.')
    }
  })

  await step('invoice-settings', async () => {
    await admin.patch('/invoice-settings', {
      template: 'modern',
      paper_size: 'A4',
      branding: { primary_color: '#16A34A' },
      fields: {
        show_company_gstin: true,
        show_customer_gstin: true,
        show_billing_address: true,
        show_shipping_address: true,
        show_hsn_sac: true,
        show_discount: true,
        show_tax_rate: true,
        show_tax_amount: true,
        show_bank_details: true,
        show_upi_qr: true,
        show_terms: true,
        show_signature: true,
      },
      terms: '1. Goods once sold will not be taken back.\n2. Payment due within agreed credit terms.',
      footer_text: 'Thank you for your business!',
      notes: 'This is a seeded demo invoice configuration.',
    })
    log('invoice-settings', 'Invoice template/branding/field toggles set.')
  })

  await step('sales-workflow-settings', async () => {
    await admin.patch('/sales-workflow-settings', {
      order_requires_approval: false,
      reserve_stock_on_order: true,
      allow_partial_delivery: true,
      allow_backorder: false,
      invoice_timing: 'after_delivery',
      allow_direct_invoice: true,
      credit_limit_action: 'warn',
    })
    log('sales-workflow-settings', 'Sales workflow rules set.')
  })
}

// ===========================================================================
// STAGE 3 — Roles (find the seeded Sales / Delivery workspace roles)
// ===========================================================================
async function resolveWorkspaceRoles(admin) {
  return step('roles', async () => {
    const { data: roles } = await admin.get('/roles')
    let salesRole = roles.find((r) => r.workspace === 'sales')
    let deliveryRole = roles.find((r) => r.workspace === 'delivery')

    if (!salesRole) {
      const { data } = await admin.post('/roles', {
        name: 'Sales Executive',
        workspace: 'sales',
        data_scope: 'own',
        permissions: { customers: { view: true, create: true, edit: true }, orders: { view: true, create: true, edit: true }, quotations: { view: true, create: true, edit: true }, leads: { view: true, create: true, edit: true } },
      })
      salesRole = data
      log('roles', 'Created custom Sales Executive role (none was seeded).')
    }
    if (!deliveryRole) {
      const { data } = await admin.post('/roles', {
        name: 'Delivery Partner',
        workspace: 'delivery',
        data_scope: 'own',
        permissions: { deliveries: { view: true, edit: true }, vehicle_stock: { view: true, edit: true } },
      })
      deliveryRole = data
      log('roles', 'Created custom Delivery Partner role (none was seeded).')
    }

    log('roles', `Sales role: ${salesRole.id} | Delivery role: ${deliveryRole.id}`)
    return { salesRole, deliveryRole }
  })
}

// ===========================================================================
// STAGE 4 — Warehouse
// ===========================================================================
async function seedWarehouse(admin) {
  return step('warehouse', async () => {
    const { data: existing } = await admin.get('/warehouses')
    let warehouse = existing.find((w) => w.is_default) || existing[0]
    if (!warehouse) {
      const { data } = await admin.post('/warehouses', {
        name: 'Main Warehouse',
        address: 'Plot 14, MIDC Industrial Area',
        city: 'Mumbai',
        contact_number: '9876500002',
        is_default: true,
      })
      warehouse = data
    }
    output.warehouse = warehouse
    log('warehouse', `Using warehouse: ${warehouse.name} (${warehouse.id})`)
    return warehouse
  })
}

// ===========================================================================
// STAGE 5 — Categories
// ===========================================================================
const CATEGORY_DEFS = [
  { name: 'Beverages', description: 'Soft drinks, juices and packaged water' },
  { name: 'Snacks & Namkeen', description: 'Packaged snacks and savouries' },
  { name: 'Home Care', description: 'Cleaning and household essentials' },
  { name: 'Personal Care', description: 'Grooming and personal hygiene products' },
]
async function seedCategories(admin) {
  return step('categories', async () => {
    const categories = []
    for (const def of CATEGORY_DEFS) {
      try {
        const { data } = await admin.post('/categories', { name: def.name, description: def.description })
        categories.push(data)
        log('categories', `Created "${data.name}"`)
      } catch (error) {
        if (error.response?.status === 409) {
          const { data: existing } = await admin.get('/categories', { params: { search: def.name } })
          if (existing[0]) categories.push(existing[0])
        } else {
          logError('categories', error)
        }
      }
      await sleep(150)
    }
    output.categories = categories
    return categories
  })
}

// ===========================================================================
// STAGE 6 — Products (mix of plain / batch-tracked / serial-tracked)
// ===========================================================================
function buildProductDefs(categories) {
  const catId = (name) => categories.find((c) => c.name === name)?.id
  return [
    {
      name: 'Sparkling Mineral Water 1L', category: catId('Beverages'), price: 45, hsn_code: '2201',
      tax_rate: 12, opening_stock: 500, minimum_stock_level: 50, batch_tracking: true, expiry_tracking: true,
    },
    {
      name: 'Cola Can 330ml (Case of 24)', category: catId('Beverages'), price: 720, hsn_code: '2202',
      tax_rate: 18, opening_stock: 120, minimum_stock_level: 20,
    },
    {
      name: 'Classic Salted Chips 150g', category: catId('Snacks & Namkeen'), price: 60, hsn_code: '1905',
      tax_rate: 12, opening_stock: 300, minimum_stock_level: 40, batch_tracking: true, expiry_tracking: true,
    },
    {
      name: 'Mixture Namkeen 400g', category: catId('Snacks & Namkeen'), price: 110, hsn_code: '2106',
      tax_rate: 5, opening_stock: 200, minimum_stock_level: 30, batch_tracking: true, expiry_tracking: true,
    },
    {
      name: 'Floor Cleaner 1L', category: catId('Home Care'), price: 155, hsn_code: '3402',
      tax_rate: 18, opening_stock: 150, minimum_stock_level: 20,
    },
    {
      name: 'Dish Wash Bar (Pack of 5)', category: catId('Home Care'), price: 90, hsn_code: '3401',
      tax_rate: 18, opening_stock: 250, minimum_stock_level: 30,
    },
    {
      name: 'Premium Electric Trimmer', category: catId('Personal Care'), price: 1299, hsn_code: '8510',
      tax_rate: 18, opening_stock: 40, minimum_stock_level: 5, serial_number_tracking: true,
    },
    {
      name: 'Herbal Shampoo 340ml', category: catId('Personal Care'), price: 210, hsn_code: '3305',
      tax_rate: 18, opening_stock: 180, minimum_stock_level: 25, batch_tracking: true, expiry_tracking: true,
    },
  ]
}

async function seedProducts(admin, categories) {
  return step('products', async () => {
    const defs = buildProductDefs(categories)
    const products = []
    for (const def of defs) {
      try {
        const image = nextAssetImage()
        const { data } = await admin.post('/products', {
          name: def.name,
          category_id: def.category,
          price: def.price,
          hsn_code: def.hsn_code,
          tax_rate: def.tax_rate,
          total_inventory: def.opening_stock,
          opening_stock: def.opening_stock,
          minimum_stock_level: def.minimum_stock_level,
          inventory_tracking: true,
          batch_tracking: Boolean(def.batch_tracking),
          expiry_tracking: Boolean(def.expiry_tracking),
          serial_number_tracking: Boolean(def.serial_number_tracking),
          description: `${def.name} — seeded demo product.`,
        })
        products.push(data)
        log('products', `Created "${data.name}" (₹${def.price})`)

        if (image) {
          const form = new FormData()
          form.append('file', fs.createReadStream(image))
          await admin.post(`/products/${data.id}/files/cover_image`, form, { headers: form.getHeaders() })
        }
      } catch (error) {
        logError('products', error)
      }
      await sleep(150)
    }
    output.products = products
    return products
  })
}

// ===========================================================================
// STAGE 7 — Suppliers
// ===========================================================================
const SUPPLIER_DEFS = [
  { name: 'Bharat FMCG Distributors', contact_person: 'Ramesh Iyer', phone: '9876512001', email: 'ramesh@bharatfmcg.local', city: 'Mumbai' },
  { name: 'Sunrise Wholesale Co.', contact_person: 'Anita Deshmukh', phone: '9876512002', email: 'anita@sunrisewholesale.local', city: 'Pune' },
  { name: 'Metro Home Essentials', contact_person: 'Farhan Sheikh', phone: '9876512003', email: 'farhan@metrohome.local', city: 'Thane' },
]
async function seedSuppliers(admin) {
  return step('suppliers', async () => {
    const suppliers = []
    for (const def of SUPPLIER_DEFS) {
      const { data } = await admin.post('/suppliers', { ...def, category: 'FMCG', opening_balance: 0 })
      suppliers.push(data)
      log('suppliers', `Created "${data.name}"`)
      await sleep(150)
    }
    output.suppliers = suppliers
    return suppliers
  })
}

// ===========================================================================
// STAGE 8 — Purchase invoices (created + approved, so stock actually lands)
// ===========================================================================
async function seedPurchaseInvoices(admin, suppliers, products, warehouse) {
  return step('purchase-invoices', async () => {
    const invoices = []
    for (let i = 0; i < 3; i += 1) {
      const supplier = suppliers[i % suppliers.length]
      const lineProducts = products.slice(i * 2, i * 2 + 3)
      if (lineProducts.length === 0) continue

      const items = lineProducts.map((p) => ({
        product_id: p.id,
        quantity: 50 + i * 10,
        purchase_price: Math.round((p.price || 100) * 0.7),
      }))

      try {
        const { data } = await admin.post('/purchase-invoices', {
          invoice_number: `SEED-PUR-${Date.now()}-${i}`,
          supplier_id: supplier.id,
          warehouse_id: warehouse?.id,
          items,
          purchase_type: 'Direct Purchase',
        })
        await admin.patch(`/purchase-invoices/${data.id}/approve`)
        invoices.push(data)
        log('purchase-invoices', `Created + approved purchase from "${supplier.name}" (stock added)`)
      } catch (error) {
        logError('purchase-invoices', error)
      }
      await sleep(200)
    }
    output.purchaseInvoices = invoices
    return invoices
  })
}

// ===========================================================================
// STAGE 9 — Staff (Sales Executive + Delivery Partner), with photo + docs
// ===========================================================================
async function seedStaff(admin, roles) {
  return step('staff', async () => {
    const staffDefs = [
      {
        key: 'salesExecutive',
        first_name: 'Aniket', last_name: 'Jha', display_name: 'Aniket Jha',
        designation: 'Sales Executive', role_id: roles.salesRole.id, work_location: 'North Delhi',
        official_email: 'aniket.jha@seedtest.local', mobile_number: '9876543210',
      },
      {
        key: 'deliveryPartner',
        first_name: 'Rohit', last_name: 'Verma', display_name: 'Rohit Verma',
        designation: 'Delivery Partner', role_id: roles.deliveryRole.id, work_location: 'South Delhi',
        official_email: 'rohit.verma@seedtest.local', mobile_number: '9876543211',
      },
    ]

    const staff = {}
    for (const def of staffDefs) {
      try {
        const photo = nextAssetImage()
        let profilePhotoUrl = null
        if (photo) {
          const uploaded = await uploadFile(admin, photo, 'staff-photo')
          profilePhotoUrl = uploaded?.url
        }

        const { data } = await admin.post('/users', {
          first_name: def.first_name,
          last_name: def.last_name,
          display_name: def.display_name,
          designation: def.designation,
          role_id: def.role_id,
          work_location: def.work_location,
          official_email: def.official_email,
          mobile_number: def.mobile_number,
          username: def.official_email.split('@')[0],
          password: STAFF_PASSWORD,
          confirm_password: STAFF_PASSWORD,
          employment_type: 'full_time',
          employee_status: 'active',
          date_of_joining: daysFromNow(-30),
          profile_photo: profilePhotoUrl,
        })

        staff[def.key] = { ...data, email: def.official_email, password: STAFF_PASSWORD }
        output.staff.push({ id: data.id, name: def.display_name, role: def.designation, email: def.official_email, password: STAFF_PASSWORD })
        log('staff', `Created ${def.designation}: ${def.display_name} (login: ${def.official_email} / ${STAFF_PASSWORD})`)
      } catch (error) {
        logError('staff', error)
      }
      await sleep(200)
    }
    return staff
  })
}

// ===========================================================================
// STAGE 10 — Vehicles (assigned to the delivery partner)
// ===========================================================================
async function seedVehicles(admin, deliveryPartner) {
  return step('vehicles', async () => {
    const { data } = await admin.post('/vehicles', {
      vehicle_number: `DL 8S AB ${2400 + Math.floor(Math.random() * 90)}`,
      vehicle_type: 'Mini Truck',
      capacity_kg: 1200,
      default_driver_id: deliveryPartner?.id,
    })
    output.vehicles.push(data)
    log('vehicles', `Registered vehicle ${data.vehicle_number}, assigned to delivery partner`)
    return data
  })
}

// ===========================================================================
// STAGE 11 — Customers (with a document upload each)
// ===========================================================================
const CUSTOMER_DEFS = [
  { name: 'Sharma Retail Store', city: 'Karol Bagh', category: 'Retail', credit_limit: 50000 },
  { name: 'Gupta Traders', city: 'Chandni Chowk', category: 'Wholesale', credit_limit: 100000 },
  { name: 'Kwality Mart', city: 'Rajouri Garden', category: 'Retail', credit_limit: 30000 },
  { name: 'Verma Enterprises', city: 'Lajpat Nagar', category: 'Distributor', credit_limit: 150000 },
  { name: 'City Mart', city: 'Dwarka', category: 'Retail', credit_limit: 40000 },
]
async function seedCustomers(admin, salesExecutive) {
  return step('customers', async () => {
    const customers = []
    for (const def of CUSTOMER_DEFS) {
      try {
        const { data } = await admin.post('/customers', {
          customer_name: def.name,
          display_name: def.name,
          city: def.city,
          state: 'Delhi',
          country: 'India',
          mobile_number: `98${Math.floor(10000000 + Math.random() * 89999999)}`,
          email_address: `${def.name.toLowerCase().replace(/\s+/g, '.')}@seedtest.local`,
          customer_category: def.category,
          credit_limit: def.credit_limit,
          billing_address: `Shop 12, ${def.city} Market`,
          shipping_address: `Shop 12, ${def.city} Market`,
          sales_representative_id: salesExecutive?.id,
        })
        customers.push(data)
        log('customers', `Created "${def.name}"`)

        const doc = nextAssetDocument()
        if (doc) {
          const form = new FormData()
          form.append('document_type', 'other')
          form.append('file', fs.createReadStream(doc))
          await admin.post(`/customers/${data.id}/documents`, form, { headers: form.getHeaders() })
        }
      } catch (error) {
        logError('customers', error)
      }
      await sleep(150)
    }
    output.customers = customers
    return customers
  })
}

// ===========================================================================
// STAGE 12 — Leads
// ===========================================================================
async function seedLeads(admin, customers, salesExecutive) {
  return step('leads', async () => {
    const leads = []
    const sources = ['Website', 'Referral', 'Cold Call', 'Trade Show']
    const statuses = ['new', 'contacted', 'qualified']
    for (let i = 0; i < 4; i += 1) {
      const { data } = await admin.post('/leads', {
        lead_source: sources[i % sources.length],
        customer_id: customers[i % customers.length]?.id,
        mobile_number: `97${Math.floor(10000000 + Math.random() * 89999999)}`,
        assigned_salesperson_id: salesExecutive?.id,
        lead_status: statuses[i % statuses.length],
      })
      leads.push(data)
      log('leads', `Created lead ${data.lead_id || data.id} (${data.lead_status})`)
      await sleep(150)
    }
    output.leads = leads
    return leads
  })
}

// ===========================================================================
// STAGE 13 — Quotations (one gets converted to an order)
// ===========================================================================
async function seedQuotations(admin, customers, products, salesExecutive) {
  return step('quotations', async () => {
    const quotations = []
    for (let i = 0; i < 2; i += 1) {
      const customer = customers[i % customers.length]
      const lineProducts = products.slice(i * 2, i * 2 + 2)
      if (!customer || lineProducts.length === 0) continue

      const items = lineProducts.map((p) => ({
        product_id: p.id,
        quantity: 10 + i * 5,
        unit_price: p.price,
        tax_rate: p.tax_rate ?? 12,
      }))

      const { data } = await admin.post('/quotations', {
        customer_id: customer.id,
        salesperson_id: salesExecutive?.id,
        valid_until: daysFromNow(14),
        items,
        status: i === 0 ? 'accepted' : 'sent',
      })
      quotations.push(data)
      log('quotations', `Created quotation ${data.quotation_number} for ${customer.customer_name || customer.name}`)
      await sleep(200)
    }
    output.quotations = quotations
    return quotations
  })
}

async function convertFirstQuotation(admin, quotations, warehouse) {
  return step('quotation-convert', async () => {
    const accepted = quotations.find((q) => q.status === 'accepted')
    if (!accepted) return null

    const { data } = await admin.post(`/quotations/${accepted.id}/convert-to-order`, {
      warehouse_id: warehouse?.id,
      delivery_date: daysFromNow(3),
      fulfilment_method: 'delivery',
      payment_type: 'credit',
      payment_terms_days: 15,
    })
    log('quotation-convert', `Converted quotation ${accepted.quotation_number} -> order ${data.order?.order_number}`)
    return data.order
  })
}

// ===========================================================================
// STAGE 14 — Direct sales orders (in addition to the converted one)
// ===========================================================================
async function seedDirectOrders(admin, customers, products, warehouse, salesExecutive) {
  return step('orders', async () => {
    const orders = []
    for (let i = 0; i < 2; i += 1) {
      const customer = customers[(i + 2) % customers.length]
      const lineProducts = products.slice(i * 2, i * 2 + 3)
      if (!customer || lineProducts.length === 0) continue

      const items = lineProducts.map((p) => ({
        product_id: p.id,
        quantity: 8 + i * 3,
        unit_price: p.price,
        tax_rate: p.tax_rate ?? 12,
      }))

      try {
        const { data } = await admin.post('/orders', {
          customer_id: customer.id,
          warehouse_id: warehouse?.id,
          salesperson_id: salesExecutive?.id,
          delivery_date: daysFromNow(2),
          fulfilment_method: 'delivery',
          payment_type: 'credit',
          payment_terms_days: 15,
          items,
        })
        orders.push(data)
        log('orders', `Created order ${data.order_number} for ${customer.customer_name || customer.name}`)
      } catch (error) {
        logError('orders', error)
      }
      await sleep(200)
    }
    output.orders.push(...orders)
    return orders
  })
}

// ===========================================================================
// STAGE 15 — Deliveries: assign partner -> plan -> load -> confirm
// ===========================================================================
async function seedDeliveries(admin, orders, deliveryPartner, vehicle) {
  return step('deliveries', async () => {
    const deliveries = []
    for (const order of orders) {
      if (!order) continue
      try {
        await admin.patch(`/orders/${order.id}/assign-delivery-partner`, {
          delivery_partner_id: deliveryPartner?.id,
        })

        const { data: deliveryList } = await admin.get('/deliveries', { params: { order_id: order.id } })
        let delivery = deliveryList[0]
        if (!delivery) {
          const { data } = await admin.post('/deliveries', {
            order_id: order.id,
            delivery_partner_id: deliveryPartner?.id,
            vehicle_id: vehicle?.id,
            scheduled_date: daysFromNow(1),
          })
          delivery = data
        }

        await admin.post(`/deliveries/${delivery.id}/load`)
        log('deliveries', `Loaded delivery for order ${order.order_number} onto vehicle`)

        const { data: fullDelivery } = await admin.get(`/deliveries/by-id/${delivery.id}`)
        const confirmItems = (fullDelivery.items || []).map((item) => ({
          delivery_item_id: item.id,
          delivered_quantity: item.planned_quantity ?? item.loaded_quantity ?? item.quantity,
        }))

        const { data: confirmed } = await admin.post(`/deliveries/${delivery.id}/confirm`, {
          items: confirmItems,
          notes: 'Seeded demo delivery — confirmed in full.',
        })
        deliveries.push(confirmed)
        log('deliveries', `Confirmed delivery for order ${order.order_number}`)
      } catch (error) {
        logError('deliveries', error)
      }
      await sleep(250)
    }
    output.deliveries = deliveries
    return deliveries
  })
}

// ===========================================================================
// STAGE 16 — Invoices: bill the delivered orders, plus one direct walk-in sale
// ===========================================================================
async function seedOrderInvoices(admin, orders) {
  return step('invoices-from-orders', async () => {
    const invoices = []
    for (const order of orders) {
      if (!order) continue
      try {
        const { data } = await admin.post(`/orders/${order.id}/invoice`, {})
        invoices.push(data)
        log('invoices-from-orders', `Invoiced order ${order.order_number} -> ${data.invoice_number}`)
      } catch (error) {
        logError('invoices-from-orders', error)
      }
      await sleep(200)
    }
    output.invoices.push(...invoices)
    return invoices
  })
}

async function seedWalkInInvoice(admin, products, warehouse) {
  return step('walk-in-invoice', async () => {
    const lineProducts = products.slice(0, 2)
    if (lineProducts.length === 0) return null

    const items = lineProducts.map((p) => ({
      product_id: p.id,
      quantity: 3,
      unit_price: p.price,
      tax_rate: p.tax_rate ?? 12,
    }))

    const { data } = await admin.post('/invoices', {
      walk_in_customer: { name: 'Cash Customer', mobile_number: '9800000000' },
      warehouse_id: warehouse?.id,
      items,
      payment: { payment_method: 'cash', amount: items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0) },
    })
    output.invoices.push(data)
    log('walk-in-invoice', `Created + paid walk-in invoice ${data.invoice_number}`)
    return data
  })
}

// ===========================================================================
// STAGE 17 — Payment receipts (partial payment against one order-billed invoice)
// ===========================================================================
async function seedPaymentReceipt(admin, invoices) {
  return step('payment-receipts', async () => {
    const unpaid = invoices.find((inv) => inv && (inv.payment_status === 'Unpaid' || !inv.payment_status))
    if (!unpaid) return null

    const partialAmount = Math.round((unpaid.total || 1000) * 0.5)
    const { data } = await admin.post('/payment-receipts', {
      invoice_reference_id: unpaid.id,
      amount_received: partialAmount,
      payment_method: 'upi',
      transaction_reference: `SEEDPAY-${Date.now()}`,
      receipt_date: daysFromNow(0),
    })
    output.paymentReceipts.push(data)
    log('payment-receipts', `Recorded partial payment of ₹${partialAmount} against ${unpaid.invoice_number}`)
    return data
  })
}

// ===========================================================================
// STAGE 18 — Sales return: request -> receive -> approve (restocks + credit note)
// ===========================================================================
async function seedSalesReturn(admin, invoices, warehouse) {
  return step('sales-returns', async () => {
    const invoiceWithItems = invoices.find((inv) => inv && Array.isArray(inv.items) && inv.items.length > 0)
    if (!invoiceWithItems) return null

    const line = invoiceWithItems.items[0]
    const { data: created } = await admin.post('/sales-returns', {
      invoice_reference_id: invoiceWithItems.id,
      return_reason: 'Customer reported minor packaging damage',
      items: [{ invoice_item_id: line.id, product_id: line.product_id, quantity_returned: 1 }],
    })
    log('sales-returns', `Requested return ${created.return_number}`)

    const { data: received } = await admin.patch(`/sales-returns/${created.id}/receive`, {
      items: [{ return_item_id: created.items[0].id, received_quantity: 1, condition: 'saleable', restock: true }],
    })
    log('sales-returns', `Marked return ${created.return_number} as received`)

    const { data: approved } = await admin.patch(`/sales-returns/${created.id}/approve`, {
      warehouse_id: warehouse?.id,
      credit_note: true,
      items: [{ return_item_id: created.items[0].id, condition: 'saleable', restock: true }],
    })
    log('sales-returns', `Approved return ${created.return_number} — restocked + credit note issued`)

    output.salesReturns.push(approved)
    return approved
  })
}

// ===========================================================================
// STAGE 19 — Expenses (submitted + one approved)
// ===========================================================================
async function seedExpenses(admin) {
  return step('expenses', async () => {
    const defs = [
      { category: 'Petrol/Diesel', amount: 1200, description: 'Fuel for delivery vehicle' },
      { category: 'Office Expenses', amount: 850, description: 'Stationery and printing' },
      { category: 'Staff Expenses', amount: 500, description: 'Team lunch' },
    ]
    const expenses = []
    for (let i = 0; i < defs.length; i += 1) {
      const receipt = nextAssetDocument()
      const { data } = await admin.post('/expenses', { ...defs[i], payment_mode: 'cash' })
      expenses.push(data)

      if (receipt) {
        const form = new FormData()
        form.append('file', fs.createReadStream(receipt))
        await admin.post(`/expenses/${data.id}/receipt`, form, { headers: form.getHeaders() })
      }

      if (i === 0) {
        await admin.patch(`/expenses/${data.id}/approve`)
        log('expenses', `Submitted + approved "${defs[i].category}"`)
      } else {
        log('expenses', `Submitted "${defs[i].category}" (left pending for manual approve/reject testing)`)
      }
      await sleep(150)
    }
    output.expenses = expenses
    return expenses
  })
}

// ===========================================================================
// STAGE 20 — Attendance check-in + location ping, as each staff member
// (these endpoints are scoped to the caller's own token, so we log in as
// each staff member using the credentials created in Stage 9)
// ===========================================================================
async function seedAttendanceAndLocation(staff) {
  await step('attendance', async () => {
    for (const key of Object.keys(staff)) {
      const person = staff[key]
      if (!person?.email) continue

      const bare = axios.create({ baseURL: API_BASE_URL, timeout: 30000 })
      const { data: loginData } = await bare.post('/auth/login', { email: person.email, password: person.password })
      const personClient = makeClient(loginData.tokens.access_token)

      try {
        await personClient.post('/attendance/check-in', { type: 'office_check_in' })
        log('attendance', `${person.display_name || key} checked in`)
      } catch (error) {
        logError('attendance', error)
      }

      try {
        await personClient.post('/users/me/location', {
          latitude: 28.6315 + Math.random() * 0.01,
          longitude: 77.2167 + Math.random() * 0.01,
          accuracy_meters: 12,
          label: 'Connaught Place, New Delhi',
          captured_at: new Date().toISOString(),
        })
        log('attendance', `${person.display_name || key} posted a location ping`)
      } catch (error) {
        logError('attendance', error)
      }
    }
  })
}

// ===========================================================================
// MAIN — runs every stage in dependency order
// ===========================================================================
async function main() {
  console.log('='.repeat(70))
  console.log('CRM SaaS full-flow seed run')
  console.log(`Target: ${API_BASE_URL}`)
  console.log(`Assets: ${ASSET_IMAGES.length} image(s), ${ASSET_DOCUMENTS.length} document(s) found in ${ASSETS_DIR}`)
  console.log('='.repeat(70))

  const admin = await authenticateAdmin()

  await seedCompanyProfile(admin)

  const roles = await resolveWorkspaceRoles(admin)
  const warehouse = await seedWarehouse(admin)
  const categories = (await seedCategories(admin)) || []
  const products = (await seedProducts(admin, categories)) || []
  const suppliers = (await seedSuppliers(admin)) || []
  await seedPurchaseInvoices(admin, suppliers, products, warehouse)

  const staff = (roles && (await seedStaff(admin, roles))) || {}
  const salesExecutive = staff.salesExecutive
  const deliveryPartner = staff.deliveryPartner

  const vehicle = deliveryPartner ? await seedVehicles(admin, deliveryPartner) : null
  const customers = (await seedCustomers(admin, salesExecutive)) || []
  await seedLeads(admin, customers, salesExecutive)

  const quotations = (await seedQuotations(admin, customers, products, salesExecutive)) || []
  const convertedOrder = await convertFirstQuotation(admin, quotations, warehouse)
  const directOrders = (await seedDirectOrders(admin, customers, products, warehouse, salesExecutive)) || []
  const allOrders = [convertedOrder, ...directOrders].filter(Boolean)

  await seedDeliveries(admin, allOrders, deliveryPartner, vehicle)

  const orderInvoices = (await seedOrderInvoices(admin, allOrders)) || []
  await seedWalkInInvoice(admin, products, warehouse)
  await seedPaymentReceipt(admin, orderInvoices)
  await seedSalesReturn(admin, orderInvoices, warehouse)

  await seedExpenses(admin)
  await seedAttendanceAndLocation(staff)

  output.finishedAt = new Date().toISOString()
  saveOutput()

  console.log('='.repeat(70))
  console.log(`Done. ${output.errors.length} error(s) logged.`)
  console.log(`Full record of everything created: ${OUTPUT_PATH}`)
  if (output.staff.length) {
    console.log('\nStaff logins (use these to view the Sales Executive / Delivery Partner dashboards):')
    for (const person of output.staff) {
      console.log(`  ${person.role.padEnd(18)} ${person.email}  /  ${person.password}`)
    }
  }
  if (output.errors.length) {
    console.log('\nStages with errors (see seed-output.json for details):')
    for (const err of output.errors) console.log(`  - ${err.stage}: ${err.detail}`)
  }
  console.log('='.repeat(70))
}

main().catch((error) => {
  console.error('Fatal error — could not even authenticate:', error.response?.data || error.message)
  process.exit(1)
})
