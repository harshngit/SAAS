#!/usr/bin/env python3
"""
Complete CRM/ERP demo data seeder.

Different purpose from scripts/e2e_full_business_flow.py: that script proves the
transactional flow is *correct* (asserts inventory math, status transitions, etc.) with
minimal data. This script exists purely to populate the dev organization with enough
REAL, interconnected data - created only through actual APIs, never inserted directly
into a database and never backdated - so every implemented frontend screen has
something meaningful to show.

USAGE
    python scripts/seed_complete_demo_data.py

Writes scripts/demo_seed_report_<RUN_ID>.json with every created id, every backend gap,
and a page-by-page dashboard coverage check.
"""

import json
import os
import time
import traceback
from datetime import datetime
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
BASE_URL = os.environ.get("DEMO_API_BASE_URL", "https://crm-saas-backend-9nom.onrender.com").rstrip("/")
SCRIPT_DIR = Path(__file__).resolve().parent
DUMMY_DIR = SCRIPT_DIR.parent / "public" / "dummy-photo"
RUN_ID = datetime.now().strftime("DEMO-%Y%m%d-%H%M%S")

CREDENTIALS = {
    "admin": (os.environ.get("DEMO_ADMIN_EMAIL", "admin@demo.com"), os.environ.get("DEMO_ADMIN_PASSWORD", "Admin@123")),
    "sales": (os.environ.get("DEMO_SALES_EMAIL", "sales@demo.com"), os.environ.get("DEMO_SALES_PASSWORD", "Sales@1234")),
    "delivery": (os.environ.get("DEMO_DELIVERY_EMAIL", "delivery@demo.com"), os.environ.get("DEMO_DELIVERY_PASSWORD", "Deliver@1234")),
    "accountant": (os.environ.get("DEMO_ACCOUNTANT_EMAIL", "accountant@demo.com"), os.environ.get("DEMO_ACCOUNTANT_PASSWORD", "Account@1234")),
}

IMAGE_FILES = sorted(DUMMY_DIR.glob("dummyimage*.png"))
PDF_FILES = sorted(DUMMY_DIR.glob("dummypdf*.pdf"))


def _cursor(files):
    i = 0
    while True:
        yield files[i % len(files)] if files else None
        i += 1


_img_cursor = _cursor(IMAGE_FILES)
_pdf_cursor = _cursor(PDF_FILES)
_doc_cursor = _cursor(IMAGE_FILES + PDF_FILES)


def next_image():
    return next(_img_cursor)


def next_pdf():
    return next(_pdf_cursor)


def next_document():
    return next(_doc_cursor)


def _mime_for(path):
    return "application/pdf" if path.suffix.lower() == ".pdf" else f"image/{path.suffix.lstrip('.')}"


# ---------------------------------------------------------------------------
# Result tracking
# ---------------------------------------------------------------------------
class SeedReport:
    def __init__(self):
        self.counts = {}
        self.created_ids = {}
        self.errors = []
        self.backend_gaps = []
        self.frontend_gaps = []
        self.notes = []

    def created(self, kind, item_id, label=""):
        self.counts[kind] = self.counts.get(kind, 0) + 1
        self.created_ids.setdefault(kind, []).append({"id": item_id, "label": label})
        print(f"  + {kind}: {label or item_id}")

    def error(self, stage, detail):
        self.errors.append({"stage": stage, "detail": detail})
        print(f"  ! ERROR [{stage}]: {detail}")

    def gap(self, kind, area, description):
        target = self.backend_gaps if kind == "backend" else self.frontend_gaps
        target.append({"area": area, "description": description})
        print(f"  ~ {kind.upper()} GAP [{area}]: {description}")

    def note(self, text):
        self.notes.append(text)
        print(f"  i {text}")


report = SeedReport()


# ---------------------------------------------------------------------------
# HTTP client (mirrors e2e_full_business_flow.py's Client)
# ---------------------------------------------------------------------------
class Client:
    def __init__(self, role):
        self.role = role
        self.token = None
        self.user = None

    def login(self):
        email, password = CREDENTIALS[self.role]
        r = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=30)
        if r.status_code != 200:
            raise RuntimeError(f"login failed for {self.role}: {r.status_code} {r.text[:300]}")
        data = r.json()
        self.token = (data.get("tokens") or data)["access_token"]
        self.user = data.get("user")
        return data

    def _headers(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    def get(self, path, params=None):
        return requests.get(f"{BASE_URL}{path}", headers=self._headers(), params=params, timeout=30)

    def post(self, path, json_body=None):
        return requests.post(f"{BASE_URL}{path}", headers=self._headers(), json=json_body, timeout=30)

    def patch(self, path, json_body=None):
        return requests.patch(f"{BASE_URL}{path}", headers=self._headers(), json=json_body, timeout=30)

    def put(self, path, json_body=None):
        return requests.put(f"{BASE_URL}{path}", headers=self._headers(), json=json_body, timeout=30)

    def upload(self, path, file_path, field_name="file", extra_data=None):
        f = open(file_path, "rb")
        try:
            files = {field_name: (file_path.name, f, _mime_for(file_path))}
            return requests.post(f"{BASE_URL}{path}", headers=self._headers(), files=files, data=extra_data or {}, timeout=30)
        finally:
            f.close()


def ok(r, codes=(200, 201)):
    return r.status_code in codes


def body(r):
    try:
        return r.json()
    except Exception:
        return r.text


def upload_generic(client, file_path):
    r = client.upload("/files/upload", file_path)
    return (body(r), r) if ok(r) else (None, r)


ctx = {}


# ---------------------------------------------------------------------------
# 1. Auth
# ---------------------------------------------------------------------------
def seed_auth():
    print("\n=== 1. AUTH ===")
    clients = {}
    for role in ("admin", "sales", "delivery", "accountant"):
        c = Client(role)
        try:
            c.login()
            clients[role] = c
            report.note(f"{role} logged in ({c.user.get('name')}, id={c.user.get('id')})")
        except Exception as e:
            report.error("auth", f"{role}: {e}")
    return clients


# ---------------------------------------------------------------------------
# 2. Staff profile enrichment
# ---------------------------------------------------------------------------
def seed_staff_profiles(admin, clients):
    print("\n=== 2. STAFF PROFILES ===")
    territories = {"sales": "North Delhi", "delivery": "South Delhi", "accountant": "Head Office"}
    designations = {"sales": "Sales Officer", "delivery": "Delivery Partner", "accountant": "Accountant"}

    r = admin.get("/roles")
    role_names = [ro.get("name") for ro in body(r)] if ok(r) else []
    if not any("warehouse" in (n or "").lower() for n in role_names):
        report.gap("backend", "Staff/Roles", "No 'Warehouse Staff' role exists on the backend (GET /roles only returns Accountant/Delivery Partner/Sales Officer/HR) - cannot create this staff type as requested.")

    for role in ("sales", "delivery", "accountant"):
        client = clients.get(role)
        if not client or not client.user:
            continue
        user_id = client.user["id"]

        photo = next_image()
        photo_url = None
        if photo:
            data, r = upload_generic(admin, photo)
            if data:
                photo_url = data.get("url") or data.get("file_id")

        resume = next_pdf()
        resume_url = None
        if resume:
            data, r = upload_generic(admin, resume)
            if data:
                resume_url = data.get("url") or data.get("file_id")

        patch_body = {
            "basic_information": {"profile_photo": photo_url} if photo_url else {},
            "contact_information": {"mobile_number": f"98{int(time.time()) % 100000000:08d}"},
            "address_information": {"city": "Delhi", "state": "Delhi", "country": "India"},
            "employment_information": {
                "designation": designations[role],
                "work_location": territories[role],
                "employment_type": "full_time",
                "date_of_joining": "2026-01-15T00:00:00Z",
                "employee_status": "active",
            },
            "documents": {"resume_cv": resume_url} if resume_url else {},
        }
        patch_body = {k: v for k, v in patch_body.items() if v}

        r = admin.patch(f"/users/{user_id}", patch_body)
        if ok(r):
            report.created("staff_profiles_enriched", user_id, f"{role} profile updated (territory={territories[role]})")
        else:
            report.error("staff_profiles", f"PATCH /users/{user_id} ({role}): {r.status_code} {body(r)}")

    # Vehicle assignment for delivery partner - reuse+rename the one leftover from the E2E
    # run rather than creating a duplicate.
    delivery_client = clients.get("delivery")
    r = admin.get("/vehicles")
    vehicles = body(r) if ok(r) else []
    if vehicles:
        vehicle = vehicles[0]
        r2 = admin.patch(f"/vehicles/{vehicle['id']}", {"vehicle_number": f"{RUN_ID}-VEH-01", "vehicle_type": "Mini Truck", "capacity_kg": 1200, "default_driver_id": delivery_client.user["id"] if delivery_client else None})
        if ok(r2):
            report.created("vehicles", vehicle["id"], f"{RUN_ID}-VEH-01 (reassigned to delivery partner)")
            ctx["vehicle_id"] = vehicle["id"]
        else:
            report.error("vehicles", f"PATCH /vehicles/{vehicle['id']}: {r2.status_code} {body(r2)}")
    else:
        r2 = admin.post("/vehicles", {"vehicle_number": f"{RUN_ID}-VEH-01", "vehicle_type": "Mini Truck", "capacity_kg": 1200, "default_driver_id": delivery_client.user["id"] if delivery_client else None})
        if ok(r2):
            ctx["vehicle_id"] = body(r2)["id"]
            report.created("vehicles", ctx["vehicle_id"], f"{RUN_ID}-VEH-01")
        else:
            report.error("vehicles", f"POST /vehicles: {r2.status_code} {body(r2)}")


# ---------------------------------------------------------------------------
# 3. Categories
# ---------------------------------------------------------------------------
CATEGORY_DEFS = [
    ("Beverages", "Soft drinks, juices and packaged water"),
    ("Snacks & Namkeen", "Packaged snacks and savouries"),
    ("Personal Care", "Grooming and personal hygiene products"),
    ("Electronics", "Small electronics and accessories"),
    ("Office Supplies", "Stationery and office essentials"),
]


def seed_categories(admin):
    print("\n=== 3. CATEGORIES ===")
    categories = []
    for name, desc in CATEGORY_DEFS:
        img = next_image()
        image_url = None
        if img:
            data, _ = upload_generic(admin, img)
            if data:
                image_url = data.get("url") or data.get("file_id")
        r = admin.post("/categories", {"name": f"{RUN_ID} {name}", "description": desc, "image": image_url or ""})
        if ok(r):
            cat = body(r)
            categories.append(cat)
            report.created("categories", cat["id"], cat["name"])
        else:
            report.error("categories", f"POST /categories ({name}): {r.status_code} {body(r)}")
    ctx["categories"] = categories
    return categories


# ---------------------------------------------------------------------------
# 4. Suppliers
# ---------------------------------------------------------------------------
SUPPLIER_DEFS = [
    ("Bharat FMCG Distributors", "Ramesh Iyer", "Mumbai", "27AABCU9603R1ZM"),
    ("Sunrise Wholesale Co.", "Anita Deshmukh", "Pune", "27AAACS1234F1Z2"),
    ("Metro Home Essentials", "Farhan Sheikh", "Thane", "27AAECM5678G1Z9"),
    ("Global Electronics Supply", "Karan Mehta", "Bengaluru", "29AABCE4321H1Z3"),
]


def _slug_email(prefix, index):
    import re
    slug = re.sub(r"[^a-z0-9]+", "", prefix.lower())[:12]
    return f"{slug}{index}.{int(time.time() * 1000) % 100000}@example.com"


def seed_suppliers(admin):
    print("\n=== 4. SUPPLIERS ===")
    suppliers = []
    for i, (name, contact, city, gst) in enumerate(SUPPLIER_DEFS):
        payload = {
            "name": f"{RUN_ID} {name}",
            "contact_person": contact,
            "phone": f"98{int(time.time() * 1000) % 100000000:08d}",
            "email": _slug_email(name, i),
            "gst_number": gst,
            "category": "FMCG",
            "address": f"{city} Industrial Estate",
            "city": city,
            "opening_balance": 0,
        }
        r = admin.post("/suppliers", payload)
        if ok(r):
            sup = body(r)
            suppliers.append(sup)
            report.created("suppliers", sup["id"], sup["name"])
            time.sleep(0.15)
        else:
            report.error("suppliers", f"POST /suppliers ({name}): {r.status_code} {body(r)}")
    ctx["suppliers"] = suppliers
    return suppliers


# ---------------------------------------------------------------------------
# 5. Products (5 simple + 3 variant)
# ---------------------------------------------------------------------------
def seed_products(admin, categories, suppliers):
    print("\n=== 5. PRODUCTS ===")
    cat_id = lambda name_part: next((c["id"] for c in categories if name_part.lower() in c["name"].lower()), categories[0]["id"] if categories else None)
    sup_id = lambda i: suppliers[i % len(suppliers)]["id"] if suppliers else None

    simple_defs = [
        {"name": "Sparkling Mineral Water 1L", "category": cat_id("Beverages"), "price": 45, "hsn_code": "2201", "tax_rate": 12, "opening_stock": 500, "minimum_stock_level": 100, "batch_tracking": True, "expiry_tracking": True},
        {"name": "Cola Can 330ml (Case of 24)", "category": cat_id("Beverages"), "price": 720, "hsn_code": "2202", "tax_rate": 18, "opening_stock": 30, "minimum_stock_level": 40},  # deliberately low stock
        {"name": "Classic Salted Chips 150g", "category": cat_id("Snacks"), "price": 60, "hsn_code": "1905", "tax_rate": 12, "opening_stock": 300, "minimum_stock_level": 40, "batch_tracking": True, "expiry_tracking": True},
        {"name": "Herbal Shampoo 340ml", "category": cat_id("Personal Care"), "price": 210, "hsn_code": "3305", "tax_rate": 18, "opening_stock": 8, "minimum_stock_level": 25, "batch_tracking": True, "expiry_tracking": True},  # deliberately reorder-required
        {"name": "USB-C Charging Cable 1m", "category": cat_id("Electronics"), "price": 199, "hsn_code": "8544", "tax_rate": 18, "opening_stock": 150, "minimum_stock_level": 20},
    ]

    variant_defs = [
        {
            "name": "Mango Juice", "category": cat_id("Beverages"), "hsn_code": "2202", "tax_rate": 12,
            "variations": [
                {"name": "500 ml", "sku_suffix": "500ML", "price": 40, "inventory": 120, "minimum_stock_level": 20},
                {"name": "1 Litre", "sku_suffix": "1L", "price": 70, "inventory": 80, "minimum_stock_level": 15},
                {"name": "2 Litre", "sku_suffix": "2L", "price": 130, "inventory": 40, "minimum_stock_level": 10},
            ],
        },
        {
            "name": "Cotton T-Shirt", "category": cat_id("Personal Care"), "hsn_code": "6109", "tax_rate": 5,
            "variations": [
                {"name": "Small", "sku_suffix": "S", "price": 349, "inventory": 60, "minimum_stock_level": 10},
                {"name": "Medium", "sku_suffix": "M", "price": 349, "inventory": 90, "minimum_stock_level": 15},
                {"name": "Large", "sku_suffix": "L", "price": 379, "inventory": 50, "minimum_stock_level": 10},
            ],
        },
        {
            "name": "Ballpoint Pen Pack", "category": cat_id("Office Supplies"), "hsn_code": "9608", "tax_rate": 12,
            "variations": [
                {"name": "Pack of 5", "sku_suffix": "P5", "price": 45, "inventory": 200, "minimum_stock_level": 30},
                {"name": "Pack of 10", "sku_suffix": "P10", "price": 85, "inventory": 120, "minimum_stock_level": 20},
            ],
        },
    ]

    products = []
    for i, d in enumerate(simple_defs):
        payload = {
            "name": f"{RUN_ID} {d['name']}",
            "sku": f"{RUN_ID}-{d['name'][:6].upper().replace(' ', '')}",
            "category_id": d["category"],
            "preferred_supplier_id": sup_id(i),
            "hsn_code": d["hsn_code"],
            "tax_rate": d["tax_rate"],
            "price": d["price"],
            "total_inventory": d["opening_stock"],
            "opening_stock": d["opening_stock"],
            "minimum_stock_level": d["minimum_stock_level"],
            "inventory_tracking": True,
            "batch_tracking": bool(d.get("batch_tracking")),
            "expiry_tracking": bool(d.get("expiry_tracking")),
            "description": f"{d['name']} - demo catalogue item",
        }
        r = admin.post("/products", payload)
        if not ok(r):
            report.error("products", f"POST /products ({d['name']}): {r.status_code} {body(r)}")
            continue
        product = body(r)
        products.append({"product": product, "opening_stock": d["opening_stock"], "min_level": d["minimum_stock_level"]})
        report.created("products", product["id"], product["name"])

        img = next_image()
        if img:
            admin.upload(f"/products/{product['id']}/files/cover_image", img)
        brochure = next_pdf()
        if brochure:
            admin.upload(f"/products/{product['id']}/files/product_catalog_brochure", brochure)
        manual = next_pdf()
        if manual:
            admin.upload(f"/products/{product['id']}/files/product_manual", manual)
        datasheet = next_pdf()
        if datasheet:
            admin.upload(f"/products/{product['id']}/files/product_datasheet", datasheet)
        time.sleep(0.15)

    for i, d in enumerate(variant_defs):
        variations_payload = [
            {"name": v["name"], "sku": f"{RUN_ID}-{d['name'][:4].upper().replace(' ', '')}-{v['sku_suffix']}", "price": v["price"], "inventory": v["inventory"], "minimum_stock_level": v["minimum_stock_level"]}
            for v in d["variations"]
        ]
        payload = {
            "name": f"{RUN_ID} {d['name']}",
            "category_id": d["category"],
            "preferred_supplier_id": sup_id(i),
            "hsn_code": d["hsn_code"],
            "tax_rate": d["tax_rate"],
            "price": d["variations"][0]["price"],
            "inventory_tracking": True,
            "description": f"{d['name']} - demo variant catalogue item",
            "variations": variations_payload,
        }
        r = admin.post("/products", payload)
        if not ok(r):
            report.error("products", f"POST /products ({d['name']}, variants): {r.status_code} {body(r)}")
            continue
        product = body(r)
        variations = product.get("variations") or product.get("variants") or []
        products.append({"product": product, "opening_stock": sum(v.get("inventory", 0) for v in variations), "min_level": None, "variants": variations})
        report.created("products", product["id"], f"{product['name']} ({len(variations)} variants)")
        for v in variations:
            report.created("variants", v.get("id"), f"{product['name']} / {v.get('name')}")

        img = next_image()
        if img:
            admin.upload(f"/products/{product['id']}/files/cover_image", img)
        time.sleep(0.15)

    ctx["products"] = products
    return products


# ---------------------------------------------------------------------------
# 6. Warehouses
# ---------------------------------------------------------------------------
def seed_warehouses(admin):
    print("\n=== 6. WAREHOUSES ===")
    r = admin.get("/warehouses")
    warehouses = body(r) if ok(r) else []
    main = next((w for w in warehouses if w.get("is_default")), warehouses[0] if warehouses else None)

    secondary = next((w for w in warehouses if not w.get("is_default")), None)
    if not secondary:
        r = admin.post("/warehouses", {"name": f"{RUN_ID} Secondary Warehouse", "address": "Sector 18, Industrial Area", "city": "Gurugram", "contact_number": "9876500099", "is_default": False})
        if ok(r):
            secondary = body(r)
            report.created("warehouses", secondary["id"], secondary["name"])
        else:
            report.error("warehouses", f"POST /warehouses: {r.status_code} {body(r)}")
    else:
        report.note(f"reusing existing secondary warehouse: {secondary['name']}")

    ctx["warehouse_main"] = main
    ctx["warehouse_secondary"] = secondary
    return main, secondary


# ---------------------------------------------------------------------------
# 7. Purchases - lands stock into both warehouses, varied payment states
# ---------------------------------------------------------------------------
def seed_purchases(admin, suppliers, products, warehouses):
    print("\n=== 7. PURCHASES ===")
    main, secondary = warehouses
    plans = [
        {"warehouse": main, "status": "approve", "payment_status": "paid", "amount_paid_ratio": 1.0},
        {"warehouse": main, "status": "approve", "payment_status": "partial", "amount_paid_ratio": 0.5},
        {"warehouse": secondary, "status": "approve", "payment_status": "unpaid", "amount_paid_ratio": 0.0},
        {"warehouse": secondary, "status": "approve", "payment_status": "paid", "amount_paid_ratio": 1.0},
        {"warehouse": main, "status": "leave_pending", "payment_status": None, "amount_paid_ratio": 0.0},
    ]

    purchases = []
    for i, plan in enumerate(plans):
        supplier = suppliers[i % len(suppliers)]
        line_entries = products[i:i + 2] or [products[0]]
        items = []
        for entry in line_entries:
            product = entry["product"]
            variants = entry.get("variants") or []
            item = {"product_id": product["id"], "quantity": 40 + i * 5}
            if variants:
                variant = variants[i % len(variants)]
                item["variant_id"] = variant.get("id")
                item["purchase_price"] = round((variant.get("price") or product.get("price") or 100) * 0.65, 2)
            else:
                item["purchase_price"] = round((product.get("price") or 100) * 0.65, 2)
            items.append(item)

        r = admin.post("/purchase-invoices", {
            "invoice_number": f"{RUN_ID}-PUR-{i + 1}",
            "supplier_id": supplier["id"],
            "warehouse_id": plan["warehouse"]["id"] if plan["warehouse"] else None,
            "items": items,
            "purchase_type": "Direct Purchase",
        })
        if not ok(r):
            report.error("purchases", f"POST /purchase-invoices #{i+1}: {r.status_code} {body(r)}")
            continue
        purchase = body(r)
        report.created("purchases", purchase["id"], f"{purchase.get('invoice_number')} ({plan['status']}/{plan['payment_status']})")
        purchases.append(purchase)

        if plan["status"] == "approve":
            r2 = admin.patch(f"/purchase-invoices/{purchase['id']}/approve")
            if not ok(r2):
                report.error("purchases", f"approve {purchase['id']}: {r2.status_code} {body(r2)}")
                continue
            total = body(r2).get("total") or purchase.get("total") or 0
            amount_paid = round(total * plan["amount_paid_ratio"], 2)
            r3 = admin.patch(f"/purchase-invoices/{purchase['id']}/payment-status", {"payment_status": plan["payment_status"], "amount_paid": amount_paid})
            if not ok(r3):
                report.error("purchases", f"payment-status {purchase['id']}: {r3.status_code} {body(r3)}")
        else:
            report.note(f"purchase {purchase.get('invoice_number')} left pending approval (for Purchases 'Pending Approval' card)")

        time.sleep(0.2)

    ctx["purchases"] = purchases
    return purchases


# ---------------------------------------------------------------------------
# 8. Leads (+ one "won" -> customer)
# ---------------------------------------------------------------------------
LEAD_SOURCES = ["Website", "Referral", "Cold Call", "Trade Show", "Social Media"]
LEAD_STATUSES = ["new", "new", "contacted", "contacted", "qualified", "qualified", "won", "lost", "lost", "new"]


def seed_leads(admin, sales_officer_id):
    print("\n=== 8. LEADS ===")
    leads = []
    for i in range(10):
        payload = {
            "lead_source": LEAD_SOURCES[i % len(LEAD_SOURCES)],
            "mobile_number": f"97{int(time.time() * 10) % 100000000 + i:08d}",
            "assigned_salesperson_id": sales_officer_id,
            "lead_status": LEAD_STATUSES[i],
        }
        r = admin.post("/leads", payload)
        if ok(r):
            lead = body(r)
            leads.append(lead)
            report.created("leads", lead["id"], f"{lead.get('lead_id')} ({lead.get('lead_status')})")
        else:
            report.error("leads", f"POST /leads #{i+1}: {r.status_code} {body(r)}")
        time.sleep(0.1)

    r = admin.get("/leads")
    if ok(r):
        report.note(f"GET /leads confirms {len(body(r))} lead(s) visible")
    else:
        report.error("leads", f"GET /leads verification failed: {r.status_code}")

    ctx["leads"] = leads
    ctx["won_lead"] = next((l for l in leads if l.get("lead_status") == "won"), None)
    return leads


# ---------------------------------------------------------------------------
# 9. Customers (incl. converting the "won" lead)
# ---------------------------------------------------------------------------
CUSTOMER_DEFS = [
    ("Sharma Retail Store", "Retail", "Karol Bagh", 30000, "cash"),
    ("Gupta Wholesale Traders", "Wholesale", "Chandni Chowk", 150000, "credit_30"),
    ("Kwality Cash Mart", "Retail", "Rajouri Garden", 0, "cash"),
    ("Verma Enterprises (GST)", "Distributor", "Lajpat Nagar", 200000, "credit_15"),
    ("City Non-GST Store", "Retail", "Dwarka", 20000, "cash"),
    ("Metro Wholesale Hub", "Wholesale", "Azadpur", 100000, "credit_30"),
    ("Prime Electronics Retail", "Retail", "Nehru Place", 50000, "credit_15"),
]


def seed_customers(admin, sales_officer_id, won_lead):
    print("\n=== 9. CUSTOMERS ===")
    customers = []
    for name, category, city, credit_limit, terms in CUSTOMER_DEFS:
        ts = int(time.time() * 1000) % 10_000_000
        payload = {
            "customer_name": f"{RUN_ID} {name}",
            "display_name": f"{RUN_ID} {name}",
            "city": city, "state": "Delhi", "country": "India",
            "mobile_number": f"91{ts % 100000000:08d}",
            "email_address": f"{RUN_ID.lower()}.{name.lower().split()[0]}@example.com",
            "customer_category": category,
            "credit_limit": credit_limit,
            "payment_terms": terms,
            "gstin_tax_id": "07AAACP1234F1ZQ" if "GST" in name and "Non" not in name else "",
            "tax_exempt": "Non-GST" in name,
            "billing_address": f"Shop 12, {city} Market",
            "shipping_address": f"Shop 12, {city} Market",
            "sales_representative_id": sales_officer_id,
            "notes": f"Seeded demo customer ({category})",
        }
        r = admin.post("/customers", payload)
        if ok(r):
            customer = body(r)
            customers.append(customer)
            report.created("customers", customer["id"], customer.get("name") or customer.get("customer_name"))
        else:
            report.error("customers", f"POST /customers ({name}): {r.status_code} {body(r)}")
        time.sleep(0.15)

    if won_lead:
        conv_name = f"{RUN_ID} Converted Lead Customer"
        r = admin.post("/customers", {
            "customer_name": conv_name, "display_name": conv_name,
            "mobile_number": won_lead.get("mobile_number") or "9800000000",
            "city": "Delhi", "state": "Delhi", "country": "India",
            "customer_category": "Retail", "credit_limit": 0, "payment_terms": "cash",
            "sales_representative_id": sales_officer_id,
            "notes": f"Converted from lead {won_lead.get('lead_id') or won_lead.get('id')}",
        })
        if ok(r):
            new_customer = body(r)
            customers.append(new_customer)
            report.created("customers", new_customer["id"], f"{new_customer.get('name')} (from won lead)")
            # No POST /leads/{id}/convert endpoint exists on this backend - link manually by
            # setting customer_id on the lead via PUT, the only real linkage field available.
            r2 = admin.put(f"/leads/{won_lead['id']}", {"customer_id": new_customer["id"]})
            if ok(r2):
                report.note(f"linked won lead {won_lead.get('lead_id')} to new customer via PUT /leads/{{id}} customer_id (no dedicated convert endpoint exists)")
            else:
                report.error("leads", f"link lead->customer: {r2.status_code} {body(r2)}")
        else:
            report.error("customers", f"POST /customers (converted lead): {r.status_code} {body(r)}")

    if not any("no dedicated" in n for n in [""]):
        pass
    report.gap("backend", "Leads", "No POST /leads/{id}/convert endpoint exists - 'converting' a won lead to a customer means manually creating a Customer and linking it back via PUT /leads/{id} {customer_id}, not a single atomic conversion action.")

    ctx["customers"] = customers
    return customers


# ---------------------------------------------------------------------------
# Line-item builder - a product entry may be a variant product (no stock exists
# against product_id alone, only per-variant rows in /warehouses/stock), so any
# order/quotation line referencing one MUST include variant_id or the backend
# correctly reports 0 available stock against a non-existent "no variant" row.
# ---------------------------------------------------------------------------
def build_line_item(product_entry, quantity, discount=None, variant_offset=0):
    product = product_entry["product"]
    variants = product_entry.get("variants") or []
    item = {"product_id": product["id"], "quantity": quantity}

    if variants:
        variant = variants[variant_offset % len(variants)]
        item["variant_id"] = variant.get("id")
        item["unit_price"] = variant.get("price") or product.get("price") or 100
    else:
        item["unit_price"] = product.get("price") or 100

    item["tax_rate"] = product.get("tax_rate") or 18
    if discount is not None:
        item["discount"] = discount
    return item


# ---------------------------------------------------------------------------
# 10. Quotations (2 draft, 2 accepted, 1 rejected) + convert 2 accepted
# ---------------------------------------------------------------------------
def seed_quotations(admin, customers, products, sales_officer_id, warehouse_id):
    print("\n=== 10. QUOTATIONS ===")
    plans = ["draft", "draft", "accepted", "accepted", "rejected"]
    quotations = []
    for i, target_status in enumerate(plans):
        customer = customers[i % len(customers)]
        line_entries = [products[i % len(products)], products[(i + 1) % len(products)]]
        items = [build_line_item(entry, 5 + i, discount=10, variant_offset=i) for entry in line_entries]

        r = admin.post("/quotations", {"customer_id": customer["id"], "salesperson_id": sales_officer_id, "currency": "INR", "status": "draft", "items": items, "valid_until": None})
        if not ok(r):
            report.error("quotations", f"POST /quotations #{i+1}: {r.status_code} {body(r)}")
            continue
        quotation = body(r)
        report.created("quotations", quotation["id"], f"{quotation.get('quotation_number')} -> {target_status}")

        if target_status != "draft":
            r2 = admin.patch(f"/quotations/{quotation['id']}", {"status": target_status})
            if ok(r2):
                quotation = body(r2)
            else:
                report.error("quotations", f"status->({target_status}) {quotation['id']}: {r2.status_code} {body(r2)}")

        quotations.append(quotation)
        time.sleep(0.15)

    converted_orders = []
    for q in [q for q in quotations if q.get("status") == "accepted"]:
        r = admin.post(f"/quotations/{q['id']}/convert-to-order", {"warehouse_id": warehouse_id, "fulfilment_method": "delivery", "payment_type": "cash"})
        if ok(r):
            conversion = body(r)
            order = conversion.get("order") or conversion
            converted_orders.append(order)
            report.created("orders", order.get("id"), f"{order.get('order_number')} (from quotation {q.get('quotation_number')})")
        else:
            report.error("quotations", f"convert-to-order {q['id']}: {r.status_code} {body(r)}")
        time.sleep(0.2)

    ctx["quotations"] = quotations
    ctx["orders_from_quotations"] = converted_orders
    return quotations, converted_orders


# ---------------------------------------------------------------------------
# 11. Direct sales orders
# ---------------------------------------------------------------------------
def seed_direct_orders(admin, customers, products, warehouse_id, sales_officer_id, count=8):
    print("\n=== 11. DIRECT SALES ORDERS ===")
    orders = []
    for i in range(count):
        customer = customers[i % len(customers)]
        line_entries = [products[i % len(products)], products[(i + 2) % len(products)]]
        items = [build_line_item(entry, 4 + (i % 5), variant_offset=i) for entry in line_entries]
        payload = {
            "customer_id": customer["id"], "warehouse_id": warehouse_id, "salesperson_id": sales_officer_id,
            "fulfilment_method": "delivery", "source": "office", "payment_type": "cash" if i % 3 else "credit",
            "items": items,
        }
        if payload["payment_type"] == "credit":
            payload["payment_terms_days"] = 15
        r = admin.post("/orders", payload)
        if ok(r):
            order = body(r)
            orders.append(order)
            report.created("orders", order["id"], f"{order.get('order_number')} ({customer.get('name')})")
        else:
            report.error("orders", f"POST /orders #{i+1}: {r.status_code} {body(r)}")
        time.sleep(0.2)

    # Cancel one for status variety
    if orders:
        target = orders[-1]
        r = admin.patch(f"/orders/{target['id']}/cancel", {"reason": "Seeded demo cancellation for status variety"})
        if ok(r):
            report.note(f"cancelled order {target.get('order_number')} for status variety")
            orders[-1] = body(r)
        else:
            report.error("orders", f"cancel {target['id']}: {r.status_code} {body(r)}")

    return orders


# ---------------------------------------------------------------------------
# 12. Deliveries (full + partial, POD)
# ---------------------------------------------------------------------------
def seed_deliveries(admin, orders, delivery_partner_id, vehicle_id, warehouse_id):
    print("\n=== 12. DELIVERIES ===")
    deliverable_orders = [o for o in orders if o.get("status") not in ("cancelled",)]
    deliveries = []

    for i, order in enumerate(deliverable_orders[:8]):
        r = admin.post("/deliveries", {
            "order_id": order["id"], "delivery_partner_id": delivery_partner_id, "vehicle_id": vehicle_id,
            "warehouse_id": warehouse_id, "scheduled_date": datetime.now().strftime("%Y-%m-%d"),
            "delivery_address": "Demo delivery address, Test Lane", "notes": f"{RUN_ID} planned delivery",
        })
        if not ok(r):
            report.error("deliveries", f"plan for order {order.get('order_number')}: {r.status_code} {body(r)}")
            continue
        delivery = body(r)
        report.created("deliveries", delivery["id"], f"for {order.get('order_number')}")

        r2 = admin.post(f"/deliveries/{delivery['id']}/load")
        if not ok(r2):
            report.error("deliveries", f"load {delivery['id']}: {r2.status_code} {body(r2)}")
            deliveries.append(delivery)
            continue
        admin.patch(f"/deliveries/by-id/{delivery['id']}", {"status": "in_transit"})

        r3 = admin.get(f"/deliveries/by-id/{delivery['id']}")
        full_delivery = body(r3) if ok(r3) else delivery
        items = full_delivery.get("items") or []
        if not items:
            deliveries.append(full_delivery)
            continue

        is_partial = i % 4 == 3  # every 4th one is a partial delivery for variety
        pod_photo_ids = []
        photo = next_image()
        if photo:
            data, _ = upload_generic(admin, photo)
            if data:
                pod_photo_ids.append(data.get("file_id") or data.get("id"))
        signature_id = None
        sig = next_image()
        if sig:
            data, _ = upload_generic(admin, sig)
            if data:
                signature_id = data.get("file_id") or data.get("id")

        if is_partial:
            first_item = items[0]
            planned = first_item.get("planned_quantity") or first_item.get("loaded_quantity") or 1
            delivered_qty = max(1, int(planned * 0.6))
            confirm_items = [{"delivery_item_id": first_item.get("id"), "delivered_quantity": delivered_qty}]
        else:
            confirm_items = [{"delivery_item_id": it.get("id"), "delivered_quantity": it.get("planned_quantity") or it.get("loaded_quantity")} for it in items]

        confirm_payload = {"failed": False, "items": confirm_items, "notes": f"{RUN_ID} {'partial' if is_partial else 'full'} delivery"}
        if pod_photo_ids:
            confirm_payload["pod_photo_file_ids"] = pod_photo_ids
        if signature_id:
            confirm_payload["signature_file_id"] = signature_id

        r4 = admin.post(f"/deliveries/{delivery['id']}/confirm", confirm_payload)
        if ok(r4):
            confirmed = body(r4)
            deliveries.append(confirmed)
            report.note(f"confirmed {'PARTIAL' if is_partial else 'FULL'} delivery for {order.get('order_number')} -> {confirmed.get('status')}")
        else:
            report.error("deliveries", f"confirm {delivery['id']}: {r4.status_code} {body(r4)}")
            deliveries.append(full_delivery)

        time.sleep(0.2)

    ctx["deliveries"] = deliveries
    return deliveries


# ---------------------------------------------------------------------------
# 13. Sales returns (against invoiced orders - run AFTER invoicing, see main())
# ---------------------------------------------------------------------------
def seed_sales_returns(admin, invoices, warehouse_id, count=3):
    print("\n=== 13. SALES RETURNS ===")
    returns = []
    candidates = [inv for inv in invoices if inv.get("items")]
    for i, invoice in enumerate(candidates[:count]):
        line = invoice["items"][0]
        is_full = i == 0
        qty = line.get("quantity") if is_full else max(1, int((line.get("quantity") or 2) / 2))

        r = admin.post("/sales-returns", {
            "invoice_reference_id": invoice["id"],
            "return_reason": "Demo return - " + ("full item return" if is_full else "partial quantity return"),
            "items": [{"invoice_item_id": line.get("id"), "product_id": line.get("product_id"), "quantity_returned": qty}],
        })
        if not ok(r):
            report.error("sales_returns", f"create for invoice {invoice.get('invoice_number')}: {r.status_code} {body(r)}")
            continue
        created = body(r)
        report.created("sales_returns", created["id"], f"{created.get('return_number')} ({'full' if is_full else 'partial'})")

        r2 = admin.patch(f"/sales-returns/{created['id']}/receive", {"items": [{"return_item_id": created["items"][0]["id"], "received_quantity": qty, "condition": "saleable", "restock": True}]})
        if not ok(r2):
            report.error("sales_returns", f"receive {created['id']}: {r2.status_code} {body(r2)}")
            returns.append(created)
            continue

        r3 = admin.patch(f"/sales-returns/{created['id']}/approve", {"warehouse_id": warehouse_id, "credit_note": True, "items": [{"return_item_id": created["items"][0]["id"], "condition": "saleable", "restock": True}]})
        if ok(r3):
            approved = body(r3)
            returns.append(approved)
            report.note(f"approved return {created.get('return_number')} - restocked + credit note issued")
        else:
            report.error("sales_returns", f"approve {created['id']}: {r3.status_code} {body(r3)}")
            returns.append(created)

        time.sleep(0.2)

    ctx["sales_returns"] = returns
    return returns


# ---------------------------------------------------------------------------
# 14. Invoices
# ---------------------------------------------------------------------------
def seed_invoices(admin, orders_with_deliveries):
    print("\n=== 14. INVOICES ===")
    invoices = []
    for order in orders_with_deliveries:
        r = admin.post(f"/orders/{order['id']}/invoice", {})
        if ok(r):
            invoice = body(r)
            invoices.append(invoice)
            report.created("invoices", invoice["id"], f"{invoice.get('invoice_number')} for {order.get('order_number')}")
        elif r.status_code in (400, 409):
            report.note(f"order {order.get('order_number')} not yet invoiceable ({body(r)}) - skipped, expected for undelivered orders")
        else:
            report.error("invoices", f"invoice order {order.get('order_number')}: {r.status_code} {body(r)}")
        time.sleep(0.2)

    ctx["invoices"] = invoices
    return invoices


# ---------------------------------------------------------------------------
# 15. Payments (full / partial x2 / credit customer stays outstanding)
# ---------------------------------------------------------------------------
def seed_payments(admin, invoices):
    print("\n=== 15. PAYMENTS ===")
    if not invoices:
        return []

    payments = []
    # Invoice 0: full payment
    inv0 = invoices[0]
    r0 = admin.get(f"/invoices/{inv0['id']}")
    total0 = (body(r0) if ok(r0) else inv0).get("total") or 0
    if total0:
        r = admin.post("/payment-receipts", {"invoice_reference_id": inv0["id"], "amount_received": total0, "payment_method": "cash", "receipt_date": datetime.now().strftime("%Y-%m-%d")})
        if ok(r):
            payments.append(body(r))
            report.created("payments", body(r)["id"], f"full payment on {inv0.get('invoice_number')}")

    # Invoice 1: two partial payments completing it
    if len(invoices) > 1:
        inv1 = invoices[1]
        r1 = admin.get(f"/invoices/{inv1['id']}")
        total1 = (body(r1) if ok(r1) else inv1).get("total") or 0
        if total1:
            p1 = round(total1 * 0.4, 2)
            r = admin.post("/payment-receipts", {"invoice_reference_id": inv1["id"], "amount_received": p1, "payment_method": "upi", "receipt_date": datetime.now().strftime("%Y-%m-%d")})
            if ok(r):
                payments.append(body(r))
                report.created("payments", body(r)["id"], f"partial payment 1 on {inv1.get('invoice_number')}")
            p2 = round(total1 - p1, 2)
            r = admin.post("/payment-receipts", {"invoice_reference_id": inv1["id"], "amount_received": p2, "payment_method": "upi", "receipt_date": datetime.now().strftime("%Y-%m-%d")})
            if ok(r):
                payments.append(body(r))
                report.created("payments", body(r)["id"], f"partial payment 2 (completes) on {inv1.get('invoice_number')}")

    # Invoice 2: single partial payment, left partially paid
    if len(invoices) > 2:
        inv2 = invoices[2]
        r2 = admin.get(f"/invoices/{inv2['id']}")
        total2 = (body(r2) if ok(r2) else inv2).get("total") or 0
        if total2:
            r = admin.post("/payment-receipts", {"invoice_reference_id": inv2["id"], "amount_received": round(total2 * 0.3, 2), "payment_method": "bank_transfer", "receipt_date": datetime.now().strftime("%Y-%m-%d")})
            if ok(r):
                payments.append(body(r))
                report.created("payments", body(r)["id"], f"partial payment (left outstanding) on {inv2.get('invoice_number')}")

    # Remaining invoices: leave unpaid (credit customers) - deliberately no payment.
    for inv in invoices[3:]:
        report.note(f"invoice {inv.get('invoice_number')} left unpaid deliberately (credit/receivable demo data)")

    ctx["payments"] = payments
    return payments


# ---------------------------------------------------------------------------
# 16. Expenses
# ---------------------------------------------------------------------------
EXPENSE_DEFS = [
    ("Petrol/Diesel", 1200, "Fuel for delivery vehicle"),
    ("Office Expenses", 850, "Stationery and printing"),
    ("Travel", 2200, "Client visit travel costs"),
    ("Miscellaneous", 450, "Sundry office purchase"),
    ("Delivery", 600, "Local courier for urgent delivery"),
    ("Staff Expenses", 500, "Team lunch"),
]


def seed_expenses(admin):
    print("\n=== 16. EXPENSES ===")
    expenses = []
    for i, (category, amount, desc) in enumerate(EXPENSE_DEFS):
        r = admin.post("/expenses", {"category": category, "amount": amount, "description": f"{RUN_ID} {desc}", "payment_mode": "cash"})
        if not ok(r):
            report.error("expenses", f"POST /expenses ({category}): {r.status_code} {body(r)}")
            continue
        expense = body(r)
        report.created("expenses", expense["id"], f"{category} - Rs.{amount}")

        receipt = next_document()
        if receipt:
            admin.upload(f"/expenses/{expense['id']}/receipt", receipt)

        if i % 2 == 0:
            r2 = admin.patch(f"/expenses/{expense['id']}/approve")
            if ok(r2):
                report.note(f"approved expense {category}")
        expenses.append(expense)
        time.sleep(0.15)

    ctx["expenses"] = expenses
    return expenses


# ---------------------------------------------------------------------------
# 17. Attendance + location ping
# ---------------------------------------------------------------------------
def seed_attendance(clients):
    print("\n=== 17. ATTENDANCE ===")
    for role in ("sales", "delivery", "accountant"):
        client = clients.get(role)
        if not client:
            continue
        r = client.post("/attendance/check-in", {"type": "office_check_in"})
        if ok(r):
            report.created("attendance", body(r).get("id", role), f"{role} office_check_in")
        elif r.status_code == 400:
            report.note(f"{role} already checked in today (400 'already recorded') - expected on reruns")
        elif r.status_code == 403:
            # Confirmed via GET /roles: the Accountant role's permissions dict has no
            # `attendance` key at all (unlike Sales Officer/Delivery Partner) - this 403 is
            # correct, permission-scoped backend behavior, not a script bug.
            report.note(f"{role} check-in correctly denied (403) - this role's permission set has no 'attendance' module at all")
        else:
            report.error("attendance", f"{role} check-in: {r.status_code} {body(r)}")

        if role == "delivery":
            r2 = client.post("/users/me/location", {"latitude": 28.6315, "longitude": 77.2167, "accuracy_meters": 12, "label": "Connaught Place, New Delhi", "captured_at": datetime.now().isoformat()})
            if ok(r2):
                report.created("location_pings", client.user["id"], "delivery partner GPS ping")
            else:
                report.error("attendance", f"location ping: {r2.status_code} {body(r2)}")

    report.gap(
        "backend", "Attendance",
        "Only real-time office_check_in/departure/return_to_office/final_check_out are supported "
        "(POST /attendance/check-in with today's server timestamp). There is no way to create "
        "historical attendance records for past dates, so multi-day attendance charts will only "
        "ever show today's point from this seeder - NOT backdated, per instructions.",
    )


# ---------------------------------------------------------------------------
# 18. Dashboard coverage check
# ---------------------------------------------------------------------------
PAGES_TO_CHECK = [
    ("Dashboard (Admin)", "GET /dashboard/admin", lambda admin: admin.get("/dashboard/admin")),
    ("Customers", "GET /customers", lambda admin: admin.get("/customers")),
    ("Leads", "GET /leads", lambda admin: admin.get("/leads")),
    ("Quotations", "GET /quotations", lambda admin: admin.get("/quotations")),
    ("Suppliers", "GET /suppliers", lambda admin: admin.get("/suppliers")),
    ("Categories", "GET /categories", lambda admin: admin.get("/categories")),
    ("Products", "GET /products", lambda admin: admin.get("/products")),
    ("Inventory", "GET /inventory", lambda admin: admin.get("/inventory")),
    ("Warehouses", "GET /warehouses", lambda admin: admin.get("/warehouses")),
    ("Orders", "GET /orders", lambda admin: admin.get("/orders")),
    ("Sales Returns", "GET /sales-returns", lambda admin: admin.get("/sales-returns")),
    ("Vehicle Stock", "GET /vehicle-stock", lambda admin: admin.get("/vehicle-stock")),
    ("Vehicles", "GET /vehicles", lambda admin: admin.get("/vehicles")),
    ("Purchases", "GET /purchase-invoices", lambda admin: admin.get("/purchase-invoices")),
    ("Deliveries", "GET /deliveries", lambda admin: admin.get("/deliveries")),
    ("Invoices", "GET /invoices", lambda admin: admin.get("/invoices")),
    ("Expenses", "GET /expenses", lambda admin: admin.get("/expenses")),
    ("Reports", "GET /reports/daily-transaction", lambda admin: admin.get("/reports/daily-transaction")),
    ("Staff", "GET /users", lambda admin: admin.get("/users")),
    ("Attendance", "GET /attendance", lambda admin: admin.get("/attendance")),
    ("Audit Logs", "GET /audit-logs (probed)", lambda admin: admin.get("/audit-logs")),
]


def dashboard_coverage_check(admin):
    print("\n=== 18. DASHBOARD DATA COVERAGE CHECK ===")
    coverage = []
    for label, endpoint, call in PAGES_TO_CHECK:
        try:
            r = call(admin)
        except Exception as e:
            coverage.append({"page": label, "status": "EMPTY - API EXISTS BUT SEED FAILED", "endpoint": endpoint, "detail": str(e)})
            continue

        if r.status_code == 404:
            coverage.append({"page": label, "status": "EMPTY - BACKEND FEATURE NOT IMPLEMENTED", "endpoint": endpoint, "detail": "404 - no such endpoint"})
            continue
        if not ok(r):
            coverage.append({"page": label, "status": "EMPTY - API EXISTS BUT SEED FAILED", "endpoint": endpoint, "detail": f"{r.status_code} {body(r)}"})
            continue

        data = body(r)
        count = len(data) if isinstance(data, list) else (1 if data else 0)
        status = "POPULATED" if count > 0 else "EMPTY - API EXISTS BUT SEED FAILED"
        coverage.append({"page": label, "status": status, "endpoint": endpoint, "detail": f"{count} record(s)"})

    for row in coverage:
        print(f"  {row['status']:38s} {row['page']:20s} ({row['endpoint']}) - {row['detail']}")

    return coverage


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 78)
    print(f"COMPLETE DEMO DATA SEEDER - run {RUN_ID}")
    print(f"Target: {BASE_URL}")
    print(f"Dummy files: {len(IMAGE_FILES)} image(s), {len(PDF_FILES)} pdf(s)")
    print("=" * 78)

    def safe(fn, *args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            report.error(fn.__name__, f"unhandled exception: {e}")
            traceback.print_exc()
            return None

    clients = safe(seed_auth) or {}
    admin = clients.get("admin")
    if not admin:
        print("FATAL: admin login failed.")
        finalize(None)
        return

    sales_officer_id = (clients.get("sales").user or {}).get("id") if clients.get("sales") else None
    delivery_partner_id = (clients.get("delivery").user or {}).get("id") if clients.get("delivery") else None

    safe(seed_staff_profiles, admin, clients)
    categories = safe(seed_categories, admin) or []
    suppliers = safe(seed_suppliers, admin) or []
    products = safe(seed_products, admin, categories, suppliers) or []
    main_wh, secondary_wh = safe(seed_warehouses, admin) or (None, None)
    safe(seed_purchases, admin, suppliers, products, (main_wh, secondary_wh))

    leads = safe(seed_leads, admin, sales_officer_id) or []
    won_lead = ctx.get("won_lead")
    customers = safe(seed_customers, admin, sales_officer_id, won_lead) or []

    warehouse_id = main_wh["id"] if main_wh else None
    quotations, orders_from_quotes = safe(seed_quotations, admin, customers, products, sales_officer_id, warehouse_id) or ([], [])
    direct_orders = safe(seed_direct_orders, admin, customers, products, warehouse_id, sales_officer_id, 8) or []

    all_orders = orders_from_quotes + direct_orders
    deliveries = safe(seed_deliveries, admin, all_orders, delivery_partner_id, ctx.get("vehicle_id"), warehouse_id) or []

    invoiceable_orders = [o for o in all_orders if o.get("status") != "cancelled"]
    invoices = safe(seed_invoices, admin, invoiceable_orders) or []

    safe(seed_sales_returns, admin, invoices, warehouse_id, 3)
    safe(seed_payments, admin, invoices)
    safe(seed_expenses, admin)
    safe(seed_attendance, clients)

    coverage = safe(dashboard_coverage_check, admin) or []

    finalize(coverage)


def finalize(coverage):
    print("\n" + "=" * 78)
    print("SEEDER RESULT")
    print("=" * 78)
    for kind in ["leads", "customers", "categories", "suppliers", "products", "variants", "quotations", "orders",
                 "purchases", "deliveries", "sales_returns", "invoices", "payments", "expenses", "attendance",
                 "warehouses", "vehicles", "staff_profiles_enriched", "location_pings"]:
        print(f"  {kind}: {report.counts.get(kind, 0)}")

    print(f"\nErrors: {len(report.errors)}")
    for e in report.errors:
        print(f"  [{e['stage']}] {e['detail']}")

    print(f"\nBackend gaps: {len(report.backend_gaps)}")
    for g in report.backend_gaps:
        print(f"  [{g['area']}] {g['description']}")

    out_path = SCRIPT_DIR / f"demo_seed_report_{RUN_ID}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({
            "run_id": RUN_ID, "base_url": BASE_URL, "counts": report.counts,
            "created_ids": report.created_ids, "errors": report.errors,
            "backend_gaps": report.backend_gaps, "frontend_gaps": report.frontend_gaps,
            "notes": report.notes, "dashboard_coverage": coverage,
        }, f, indent=2, default=str)
    print(f"\nFull report written to {out_path}")


if __name__ == "__main__":
    main()
