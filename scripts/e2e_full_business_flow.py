#!/usr/bin/env python3
"""
E2E full-business-flow test runner for the CRM SaaS backend.

Runs the whole quotation -> order -> delivery -> invoice -> payment lifecycle
against the LIVE dev backend using real API calls, verifying inventory and
status state after every step. Creates real records prefixed with a unique
run ID; nothing is faked or mocked.

USAGE
    python scripts/e2e_full_business_flow.py

Reads credentials from environment variables (see CREDENTIALS below) with
the demo defaults as fallback. Writes a JSON report to
scripts/e2e_report_<RUN_ID>.json and prints a human-readable summary.
"""

import json
import os
import sys
import time
import traceback
from datetime import datetime
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
BASE_URL = os.environ.get("E2E_API_BASE_URL", "https://crm-saas-backend-9nom.onrender.com").rstrip("/")
SCRIPT_DIR = Path(__file__).resolve().parent
DUMMY_DIR = SCRIPT_DIR.parent / "public" / "dummy-photo"
RUN_ID = datetime.now().strftime("E2E-%Y%m%d-%H%M%S")

CREDENTIALS = {
    "admin": (os.environ.get("E2E_ADMIN_EMAIL", "admin@demo.com"), os.environ.get("E2E_ADMIN_PASSWORD", "Admin@123")),
    "sales": (os.environ.get("E2E_SALES_EMAIL", "sales@demo.com"), os.environ.get("E2E_SALES_PASSWORD", "Sales@1234")),
    "delivery": (os.environ.get("E2E_DELIVERY_EMAIL", "delivery@demo.com"), os.environ.get("E2E_DELIVERY_PASSWORD", "Deliver@1234")),
    "accountant": (os.environ.get("E2E_ACCOUNTANT_EMAIL", "accountant@demo.com"), os.environ.get("E2E_ACCOUNTANT_PASSWORD", "Account@1234")),
}

IMAGE_FILES = sorted(DUMMY_DIR.glob("dummyimage*.png"))
PDF_FILES = sorted(DUMMY_DIR.glob("dummypdf*.pdf"))


def next_image():
    if not IMAGE_FILES:
        return None
    next_image.i = getattr(next_image, "i", 0)
    f = IMAGE_FILES[next_image.i % len(IMAGE_FILES)]
    next_image.i += 1
    return f


def next_pdf():
    if not PDF_FILES:
        return None
    next_pdf.i = getattr(next_pdf, "i", 0)
    f = PDF_FILES[next_pdf.i % len(PDF_FILES)]
    next_pdf.i += 1
    return f


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------
PASS, FAIL, SKIP, WARN = "PASS", "FAIL", "SKIPPED", "WARNING"


class Report:
    def __init__(self):
        self.results = []
        self.bugs = []
        self.status_observations = {}  # field -> set of observed values with context

    def record(self, tc_id, name, status, detail=None, evidence=None):
        entry = {"tc_id": tc_id, "name": name, "status": status, "detail": detail, "evidence": evidence}
        self.results.append(entry)
        line = f"[{status:8s}] {tc_id:6s} {name}"
        if detail and status != PASS:
            line += f" -- {detail}"
        print(line)
        if evidence and status in (FAIL, WARN):
            print(f"           evidence: {json.dumps(evidence, default=str)[:500]}")
        return entry

    def bug(self, bug_id, module, layer, endpoint, method, request_body, actual, expected, impact, cause, fix, severity="P1"):
        self.bugs.append({
            "bug_id": bug_id, "module": module, "layer": layer, "severity": severity,
            "endpoint": endpoint, "method": method, "request_body": request_body,
            "actual_response": actual, "expected_behavior": expected,
            "business_impact": impact, "probable_cause": cause, "recommended_fix": fix,
        })

    def observe_status(self, field, value, context):
        self.status_observations.setdefault(field, {})
        self.status_observations[field].setdefault(value, []).append(context)

    def summary(self):
        counts = {PASS: 0, FAIL: 0, SKIP: 0, WARN: 0}
        for r in self.results:
            counts[r["status"]] += 1
        return counts


report = Report()


# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------
class Client:
    def __init__(self, role):
        self.role = role
        self.token = None
        self.refresh_token = None
        self.user = None
        self.organization = None

    def login(self):
        email, password = CREDENTIALS[self.role]
        r = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=30)
        if r.status_code != 200:
            raise RuntimeError(f"login failed for {self.role} ({email}): {r.status_code} {r.text[:300]}")
        data = r.json()
        tokens = data.get("tokens") or data
        self.token = tokens["access_token"]
        self.refresh_token = tokens.get("refresh_token")
        self.user = data.get("user")
        self.organization = data.get("organization")
        return data

    def _headers(self, extra=None):
        h = {}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        if extra:
            h.update(extra)
        return h

    def request(self, method, path, json_body=None, params=None, files=None, data=None, expect=None):
        url = f"{BASE_URL}{path}"
        kwargs = {"headers": self._headers(), "timeout": 30, "params": params}
        if files is not None:
            kwargs["files"] = files
            kwargs["data"] = data
        elif json_body is not None:
            kwargs["json"] = json_body
        r = requests.request(method, url, **kwargs)
        return r

    def get(self, path, **kw):
        return self.request("GET", path, **kw)

    def post(self, path, json_body=None, **kw):
        return self.request("POST", path, json_body=json_body, **kw)

    def patch(self, path, json_body=None, **kw):
        return self.request("PATCH", path, json_body=json_body, **kw)

    def put(self, path, json_body=None, **kw):
        return self.request("PUT", path, json_body=json_body, **kw)

    def delete(self, path, **kw):
        return self.request("DELETE", path, **kw)

    def upload(self, path, file_path, field_name="file", extra_data=None, extra_files=None):
        files = {field_name: (file_path.name, open(file_path, "rb"), _mime_for(file_path))}
        if extra_files:
            files.update(extra_files)
        try:
            return self.request("POST", path, files=files, data=extra_data or {})
        finally:
            for f in files.values():
                try:
                    f[1].close()
                except Exception:
                    pass


def _mime_for(path):
    return "application/pdf" if path.suffix.lower() == ".pdf" else f"image/{path.suffix.lstrip('.')}"


def upload_generic_file(client, file_path):
    """POST /files/upload -> {file_id/url}. Returns the raw response json or None."""
    r = client.upload("/files/upload", file_path)
    if r.status_code not in (200, 201):
        return None, r
    return r.json(), r


# ---------------------------------------------------------------------------
# Small assertion helpers (never raise past the calling test - caller decides)
# ---------------------------------------------------------------------------
def ok(resp, codes=(200, 201)):
    return resp.status_code in codes


def body(resp):
    try:
        return resp.json()
    except Exception:
        return resp.text


# ---------------------------------------------------------------------------
# Context shared across test cases
# ---------------------------------------------------------------------------
ctx = {}


# ---------------------------------------------------------------------------
# TC01 - Authentication
# ---------------------------------------------------------------------------
def tc01_authentication():
    tc = "TC01"
    clients = {}
    expected_workspace = {"sales": "sales", "delivery": "delivery", "accountant": "accounts"}

    for role in ("admin", "sales", "delivery", "accountant"):
        c = Client(role)
        try:
            c.login()
            clients[role] = c
            report.record(tc, f"{role} login", PASS)
        except Exception as e:
            report.record(tc, f"{role} login", FAIL, str(e))
            continue

        if role == "admin":
            continue

        role_detail = (c.user or {}).get("role_detail") or {}
        workspace = role_detail.get("workspace")
        if workspace == expected_workspace[role]:
            report.record(tc, f"{role} workspace", PASS, f"workspace={workspace}")
        else:
            report.record(tc, f"{role} workspace", FAIL,
                           f"expected {expected_workspace[role]!r}, got {workspace!r}",
                           evidence=role_detail)
            report.bug(
                f"BUG-{tc}-1", "Auth/Roles", "Backend", "/auth/login", "POST", {"email": "<redacted>"},
                {"role_detail.workspace": workspace}, f"workspace={expected_workspace[role]!r}",
                "Frontend workspace-based UI branching would render the wrong staff profile.",
                "role_detail.workspace not set correctly for this role on the backend.",
                "Verify workspace field on the Role record for this role_id.", severity="P0",
            )

    # GET /auth/me
    if "admin" in clients:
        r = clients["admin"].get("/auth/me")
        if ok(r):
            report.record(tc, "GET /auth/me (admin)", PASS)
        else:
            report.record(tc, "GET /auth/me (admin)", FAIL, f"{r.status_code}", evidence=body(r))

    # Token refresh
    if "admin" in clients and clients["admin"].refresh_token:
        r = requests.post(f"{BASE_URL}/auth/refresh", json={"refresh_token": clients["admin"].refresh_token}, timeout=30)
        if ok(r):
            new_tokens = r.json()
            new_access = (new_tokens.get("tokens") or new_tokens).get("access_token")
            if new_access:
                clients["admin"].token = new_access
                report.record(tc, "POST /auth/refresh", PASS)
            else:
                report.record(tc, "POST /auth/refresh", WARN, "200 but no access_token in response", evidence=new_tokens)
        else:
            report.record(tc, "POST /auth/refresh", FAIL, f"{r.status_code}", evidence=body(r))
    else:
        report.record(tc, "POST /auth/refresh", SKIP, "no refresh_token available")

    ctx["clients"] = clients
    return clients


# ---------------------------------------------------------------------------
# TC02 - Category
# ---------------------------------------------------------------------------
def tc02_category(admin):
    tc = "TC02"
    name = f"{RUN_ID} Beverages"
    image_url = None

    img = next_image()
    if img:
        data, r = upload_generic_file(admin, img)
        if data:
            image_url = data.get("url") or data.get("file_id")
            report.record(tc, "upload category image via /files/upload", PASS)
        else:
            report.record(tc, "upload category image via /files/upload", WARN, f"{r.status_code}", evidence=body(r))

    payload = {"name": name, "description": "Created by automated E2E testing", "image": image_url or ""}
    r = admin.post("/categories", payload)
    if not ok(r):
        report.record(tc, "create category", FAIL, f"{r.status_code}", evidence=body(r))
        report.bug(f"BUG-{tc}-1", "Categories", "Backend", "/categories", "POST", payload, body(r), "201 with created category",
                    "Cannot create master data needed for downstream product tests.", "See response body.", "Investigate validation error.", "P0")
        return None
    category = body(r)
    category_id = category.get("id")
    report.record(tc, "create category", PASS, evidence={"id": category_id})

    r = admin.get("/categories")
    report.record(tc, "list categories", PASS if ok(r) and any(c.get("id") == category_id for c in body(r)) else FAIL,
                   None if ok(r) else f"{r.status_code}")

    r = admin.get(f"/categories/{category_id}")
    report.record(tc, "get category", PASS if ok(r) else FAIL, None if ok(r) else f"{r.status_code}", evidence=body(r) if not ok(r) else None)

    r = admin.patch(f"/categories/{category_id}", {"name": name, "description": "Updated by E2E", "image": image_url or ""})
    if ok(r) and body(r).get("description") == "Updated by E2E":
        report.record(tc, "update category", PASS)
    else:
        report.record(tc, "update category", FAIL, f"{r.status_code}", evidence=body(r))

    # Bulk-delete contract check only (create a throwaway 2nd category to delete, keep the main one)
    throwaway = admin.post("/categories", {"name": f"{RUN_ID} Throwaway Category", "description": "", "image": ""})
    if ok(throwaway):
        throwaway_id = body(throwaway).get("id")
        r = admin.post("/categories/bulk-delete", {"ids": [throwaway_id]})
        if ok(r):
            report.record(tc, "POST /categories/bulk-delete contract", PASS)
        else:
            report.record(tc, "POST /categories/bulk-delete contract", FAIL, f"{r.status_code}", evidence=body(r))
    else:
        report.record(tc, "POST /categories/bulk-delete contract", SKIP, "could not create throwaway category to delete")

    ctx["category_id"] = category_id
    return category_id


# ---------------------------------------------------------------------------
# TC03 - Supplier
# ---------------------------------------------------------------------------
def tc03_supplier(admin):
    tc = "TC03"
    payload = {
        "name": f"{RUN_ID} Test Supplier",
        "contact_person": "E2E Contact",
        "phone": f"98{int(time.time()) % 100000000:08d}",
        "email": f"e2e.supplier.{int(time.time())}@example.com",
        "gst_number": "29ABCDE1234F1Z5",
        "category": "FMCG",
        "address": "E2E Industrial Estate",
        "city": "Bengaluru",
        "opening_balance": 0,
    }
    r = admin.post("/suppliers", payload)
    if not ok(r):
        report.record(tc, "create supplier", FAIL, f"{r.status_code}", evidence=body(r))
        report.bug(f"BUG-{tc}-1", "Suppliers", "Backend", "/suppliers", "POST", payload, body(r), "201 with created supplier",
                    "Cannot create supplier needed for product preferred_supplier_id.", "See response body.", "Investigate validation error.", "P0")
        return None
    supplier = body(r)
    supplier_id = supplier.get("id")
    report.record(tc, "create supplier", PASS, evidence={"id": supplier_id})

    r = admin.get(f"/suppliers/{supplier_id}")
    report.record(tc, "get supplier", PASS if ok(r) else FAIL, None if ok(r) else f"{r.status_code}")

    r = admin.put(f"/suppliers/{supplier_id}", {**payload, "city": "Mumbai"})
    if ok(r) and body(r).get("city") == "Mumbai":
        report.record(tc, "update supplier", PASS)
    else:
        report.record(tc, "update supplier", FAIL, f"{r.status_code}", evidence=body(r))

    ctx["supplier_id"] = supplier_id
    return supplier_id


# ---------------------------------------------------------------------------
# TC04 - Product without variant
# ---------------------------------------------------------------------------
def tc04_product_simple(admin, category_id, supplier_id):
    tc = "TC04"
    sku = f"{RUN_ID}-WATER-1L"
    payload = {
        "name": f"{RUN_ID} Water Bottle",
        "sku": sku,
        "category_id": category_id,
        "preferred_supplier_id": supplier_id,
        "hsn_code": "2201",
        "tax_rate": 18,
        "price": 100,
        "total_inventory": 100,
        "opening_stock": 100,
        "minimum_stock_level": 10,
        "inventory_tracking": True,
        "description": "E2E simple product",
    }
    r = admin.post("/products", payload)
    if not ok(r):
        report.record(tc, "create product (no variant)", FAIL, f"{r.status_code}", evidence=body(r))
        report.bug(f"BUG-{tc}-1", "Products", "Backend", "/products", "POST", payload, body(r), "201 with created product",
                    "Cannot create product needed for the whole downstream sales flow.", "See response body.", "Investigate validation error.", "P0")
        return None
    product = body(r)
    product_id = product.get("id")
    report.record(tc, "create product (no variant)", PASS, evidence={"id": product_id})

    # Uploads
    img = next_image()
    if img:
        r = admin.upload(f"/products/{product_id}/files/cover_image", img)
        report.record(tc, "upload cover_image", PASS if ok(r) else WARN, None if ok(r) else f"{r.status_code}", evidence=None if ok(r) else body(r))
    pdf = next_pdf()
    if pdf:
        r = admin.upload(f"/products/{product_id}/files/product_manual", pdf)
        report.record(tc, "upload product_manual", PASS if ok(r) else WARN, None if ok(r) else f"{r.status_code}", evidence=None if ok(r) else body(r))
        r = admin.upload(f"/products/{product_id}/files/product_datasheet", pdf)
        report.record(tc, "upload product_datasheet", PASS if ok(r) else WARN, None if ok(r) else f"{r.status_code}", evidence=None if ok(r) else body(r))

    r = admin.get(f"/products/{product_id}")
    fetched = body(r) if ok(r) else None
    report.record(tc, "get product", PASS if ok(r) else FAIL, None if ok(r) else f"{r.status_code}")

    r = admin.patch(f"/products/{product_id}", {"price": 105})
    updated_ok = ok(r) and body(r).get("price") == 105
    report.record(tc, "update product price", PASS if updated_ok else FAIL, None if updated_ok else f"{r.status_code}", evidence=None if updated_ok else body(r))

    r = admin.get(f"/products/{product_id}")
    persisted_ok = ok(r) and body(r).get("price") == 105 and body(r).get("sku") == sku
    report.record(tc, "field persistence after re-fetch", PASS if persisted_ok else FAIL,
                   None if persisted_ok else "price/sku mismatch on re-fetch", evidence=None if persisted_ok else body(r))

    ctx["product_a_id"] = product_id
    ctx["product_a_price"] = 105
    return product_id


# ---------------------------------------------------------------------------
# TC05 - Product with variants
# ---------------------------------------------------------------------------
def tc05_product_variants(admin, category_id, supplier_id):
    tc = "TC05"
    payload = {
        "name": f"{RUN_ID} Juice",
        "category_id": category_id,
        "preferred_supplier_id": supplier_id,
        "hsn_code": "2202",
        "tax_rate": 12,
        "price": 40,
        "inventory_tracking": True,
        "description": "E2E variant product",
        "variations": [
            {"name": "500 ml", "sku": f"{RUN_ID}-JUICE-500ML", "price": 40, "inventory": 60, "minimum_stock_level": 10},
            {"name": "1 Litre", "sku": f"{RUN_ID}-JUICE-1L", "price": 70, "inventory": 40, "minimum_stock_level": 10},
        ],
    }
    r = admin.post("/products", payload)
    if not ok(r):
        report.record(tc, "create product with variants", FAIL, f"{r.status_code}", evidence=body(r))
        report.bug(f"BUG-{tc}-1", "Products", "Backend", "/products", "POST", payload, body(r), "201 with 2 variant IDs",
                    "Cannot verify per-variant stock isolation.", "See response body.", "Investigate validation error.", "P0")
        return None
    product = body(r)
    product_id = product.get("id")
    variations = product.get("variations") or product.get("variants") or []
    if len(variations) == 2 and all(v.get("id") for v in variations):
        report.record(tc, "create product with variants", PASS, evidence={"id": product_id, "variant_ids": [v["id"] for v in variations]})
    else:
        report.record(tc, "create product with variants", FAIL, "expected 2 variants each with an id", evidence=product)
        report.bug(f"BUG-{tc}-2", "Products", "Backend", "/products", "POST", payload, {"variations": variations}, "each variant has a persisted id",
                    "Frontend cannot address a specific variant for stock/pricing.", "Variant id not assigned on create.", "Ensure variant rows get a UUID on insert.", "P1")

    ctx["product_b_id"] = product_id
    ctx["product_b_variants"] = variations

    if len(variations) < 2:
        return product_id

    variant_500 = variations[0]
    variant_1l = variations[1]

    # GET returns same data
    r = admin.get(f"/products/{product_id}")
    refetched = body(r) if ok(r) else {}
    refetched_variations = refetched.get("variations") or refetched.get("variants") or []
    same_ids = {v.get("id") for v in refetched_variations} == {v.get("id") for v in variations}
    report.record(tc, "GET returns same variant ids", PASS if same_ids else FAIL, None if same_ids else "variant id set differs", evidence=None if same_ids else refetched_variations)

    # Update existing variant (preserve id) + add a new variant (new id) in one PATCH
    updated_payload_variations = [
        {"id": variant_500["id"], "name": "500 ml", "sku": variant_500.get("sku"), "price": 45, "inventory": variant_500.get("inventory", 60), "minimum_stock_level": 10},
        {"id": variant_1l["id"], "name": "1 Litre", "sku": variant_1l.get("sku"), "price": 70, "inventory": variant_1l.get("inventory", 40), "minimum_stock_level": 10},
        {"name": "2 Litre", "sku": f"{RUN_ID}-JUICE-2L", "price": 130, "inventory": 20, "minimum_stock_level": 5},
    ]
    r = admin.patch(f"/products/{product_id}", {"variations": updated_payload_variations})
    if not ok(r):
        report.record(tc, "update variant + add new variant", FAIL, f"{r.status_code}", evidence=body(r))
    else:
        result_variations = body(r).get("variations") or body(r).get("variants") or []
        ids_after = {v.get("id") for v in result_variations}
        preserved = variant_500["id"] in ids_after and variant_1l["id"] in ids_after
        added_new = len(result_variations) == 3
        price_updated = any(v.get("id") == variant_500["id"] and float(v.get("price", 0)) == 45 for v in result_variations)
        if preserved and added_new and price_updated:
            report.record(tc, "update variant + add new variant", PASS, evidence={"variant_ids": list(ids_after)})
        else:
            report.record(
                tc, "update variant + add new variant", FAIL,
                f"preserved={preserved} added_new={added_new}(count={len(result_variations)}) price_updated={price_updated}",
                evidence=result_variations,
            )
            report.bug(
                f"BUG-{tc}-3", "Products", "Backend", f"/products/{product_id}", "PATCH", updated_payload_variations,
                result_variations, "existing variant ids preserved, price updated, new variant added with a new id",
                "Editing one variant could silently delete/recreate siblings, breaking stock history tied to the old variant id.",
                "PATCH variations may fully replace the set without preserving ids that were sent back, or may not honor sent ids.",
                "Ensure variant PATCH matches incoming rows by id, only inserting rows with no id.", "P0",
            )

    return product_id


# ---------------------------------------------------------------------------
# TC06 - Customers
# ---------------------------------------------------------------------------
def tc06_customers(admin, sales_officer_id):
    tc = "TC06"
    ts = int(time.time())

    payload_a = {
        "customer_name": f"{RUN_ID} Retail Store",
        "display_name": f"{RUN_ID} Retail Store",
        "city": "Bengaluru", "state": "Karnataka", "country": "India",
        "mobile_number": f"91{ts % 100000000:08d}",
        "email_address": f"e2e.retail.{ts}@example.com",
        "customer_category": "Retail",
        "credit_limit": 0,
        "payment_terms": "cash",
        "billing_address": "E2E Retail Address",
        "shipping_address": "E2E Retail Address",
        "sales_representative_id": sales_officer_id,
    }
    r = admin.post("/customers", payload_a)
    customer_a_id = None
    if ok(r):
        customer_a_id = body(r).get("id")
        report.record(tc, "create customer A (cash)", PASS, evidence={"id": customer_a_id})
    else:
        report.record(tc, "create customer A (cash)", FAIL, f"{r.status_code}", evidence=body(r))
        report.bug(f"BUG-{tc}-1", "Customers", "Backend", "/customers", "POST", payload_a, body(r), "201 created customer",
                    "Blocks entire downstream sales flow for customer A.", "See response.", "Investigate validation.", "P0")

    payload_b = {
        "customer_name": f"{RUN_ID} Credit Customer",
        "display_name": f"{RUN_ID} Credit Customer",
        "city": "Mumbai", "state": "Maharashtra", "country": "India",
        "mobile_number": f"92{ts % 100000000:08d}",
        "email_address": f"e2e.credit.{ts}@example.com",
        "customer_category": "Wholesale",
        "credit_limit": 100000,
        "payment_terms": "credit_15",
        "billing_address": "E2E Credit Address",
        "shipping_address": "E2E Credit Address",
        "sales_representative_id": sales_officer_id,
    }
    r = admin.post("/customers", payload_b)
    customer_b_id = None
    if ok(r):
        customer_b_id = body(r).get("id")
        report.record(tc, "create customer B (credit)", PASS, evidence={"id": customer_b_id})
    else:
        report.record(tc, "create customer B (credit)", FAIL, f"{r.status_code}", evidence=body(r))

    for label, cid in (("A", customer_a_id), ("B", customer_b_id)):
        if not cid:
            continue
        r = admin.get(f"/customers/{cid}")
        report.record(tc, f"get customer {label}", PASS if ok(r) else FAIL, None if ok(r) else f"{r.status_code}")
        r = admin.patch(f"/customers/{cid}", {"notes": "updated by E2E"})
        report.record(tc, f"update customer {label}", PASS if ok(r) else FAIL, None if ok(r) else f"{r.status_code}", evidence=None if ok(r) else body(r))

    ctx["customer_a_id"] = customer_a_id
    ctx["customer_b_id"] = customer_b_id
    return customer_a_id, customer_b_id


# ---------------------------------------------------------------------------
# TC07 - Quotation flow
# ---------------------------------------------------------------------------
def tc07_quotation(admin, customer_a_id, product_a_id):
    tc = "TC07"
    if not customer_a_id or not product_a_id:
        report.record(tc, "quotation flow", SKIP, "missing prerequisite customer/product")
        return None

    payload = {
        "customer_id": customer_a_id,
        "currency": "INR",
        "status": "draft",
        "items": [{"product_id": product_a_id, "quantity": 5, "unit_price": ctx.get("product_a_price", 100), "discount": 5, "tax_rate": 18}],
    }
    r = admin.post("/quotations", payload)
    if not ok(r):
        report.record(tc, "create draft quotation", FAIL, f"{r.status_code}", evidence=body(r))
        report.bug(f"BUG-{tc}-1", "Quotations", "Backend", "/quotations", "POST", payload, body(r), "201 created quotation",
                    "Blocks quotation->order conversion test.", "See response.", "Investigate validation.", "P0")
        return None
    quotation = body(r)
    quotation_id = quotation.get("id")
    report.record(tc, "create draft quotation", PASS, evidence={"id": quotation_id, "status": quotation.get("status")})
    report.observe_status("quotation.status", quotation.get("status"), "on create")

    r = admin.get(f"/quotations/{quotation_id}")
    report.record(tc, "get quotation", PASS if ok(r) else FAIL, None if ok(r) else f"{r.status_code}")

    # Verify totals
    fetched = body(r) if ok(r) else {}
    # Confirmed live (isolated calc match): item.discount on quotations/orders/invoices is a
    # FLAT amount subtracted from the line subtotal, NOT a percentage - unlike tax_rate, the API
    # doc never says "0-100" for discount, just ">=0". qty*rate - flat_discount, then + tax%.
    qty, rate, discount_flat, tax_pct = 5, ctx.get("product_a_price", 100), 5, 18
    subtotal = qty * rate
    taxable = subtotal - discount_flat
    tax_amt = taxable * tax_pct / 100
    expected_total = round(taxable + tax_amt, 2)
    reported_total = fetched.get("total") or fetched.get("grand_total")
    if reported_total is not None:
        totals_ok = abs(float(reported_total) - expected_total) < 1.0
        report.record(tc, "quotation totals correct (discount is a flat amount, not %)", PASS if totals_ok else WARN,
                       None if totals_ok else f"expected ~{expected_total}, got {reported_total}",
                       evidence=None if totals_ok else {"quotation": fetched})
    else:
        report.record(tc, "quotation totals correct", WARN, "no total/grand_total field found on quotation response", evidence=fetched)

    # Update
    r = admin.patch(f"/quotations/{quotation_id}", payload)
    report.record(tc, "update quotation", PASS if ok(r) else FAIL, None if ok(r) else f"{r.status_code}", evidence=None if ok(r) else body(r))

    # Accept
    r = admin.patch(f"/quotations/{quotation_id}", {"status": "accepted"})
    if ok(r) and body(r).get("status") == "accepted":
        report.record(tc, "accept quotation", PASS)
        report.observe_status("quotation.status", "accepted", "after accept transition")
    else:
        report.record(tc, "accept quotation", FAIL, f"{r.status_code}", evidence=body(r))

    # Convert to order
    warehouse_id = ctx.get("warehouse_id")
    convert_payload = {"warehouse_id": warehouse_id, "fulfilment_method": "delivery", "payment_type": "cash"}
    r = admin.post(f"/quotations/{quotation_id}/convert-to-order", convert_payload)
    if ok(r):
        conversion = body(r)
        order = conversion.get("order") or conversion
        order_id = order.get("id")
        report.record(tc, "convert quotation to order", PASS, evidence={"order_id": order_id})

        # No duplicate customer/product check: the conversion response may be a trimmed summary
        # (no customer_id field at all), so re-fetch the full order before judging a mismatch.
        full_r = admin.get(f"/orders/{order_id}")
        full_order = body(full_r) if ok(full_r) else order
        same_customer = full_order.get("customer_id") == customer_a_id or (full_order.get("customer") or {}).get("id") == customer_a_id
        report.record(tc, "converted order references same customer (no duplicate)", PASS if same_customer else FAIL,
                       None if same_customer else "order.customer_id differs from source customer_id", evidence=None if same_customer else full_order)

        ctx["quotation_order_id"] = order_id
    else:
        report.record(tc, "convert quotation to order", FAIL, f"{r.status_code}", evidence=body(r))
        report.bug(f"BUG-{tc}-2", "Quotations", "Backend", f"/quotations/{quotation_id}/convert-to-order", "POST", convert_payload, body(r),
                    "201 with created order referencing the quotation", "Quotation-to-order path unusable.", "See response.", "Investigate.", "P1")

    ctx["quotation_id"] = quotation_id
    return quotation_id


# ---------------------------------------------------------------------------
# TC08 - Direct sales order
# ---------------------------------------------------------------------------
def tc08_direct_order(admin, customer_a_id, product_a_id, warehouse_id, sales_officer_id, qty=20, payment_type="cash", payment_terms_days=None):
    tc = "TC08"
    if not customer_a_id or not product_a_id:
        report.record(tc, "create direct order", SKIP, "missing prerequisite customer/product")
        return None

    payload = {
        "customer_id": customer_a_id,
        "warehouse_id": warehouse_id,
        "salesperson_id": sales_officer_id,
        "fulfilment_method": "delivery",
        "source": "office",
        "payment_type": payment_type,
        "items": [{"product_id": product_a_id, "quantity": qty, "unit_price": ctx.get("product_a_price", 100), "tax_rate": 18}],
    }
    if payment_terms_days is not None:
        payload["payment_terms_days"] = payment_terms_days
    r = admin.post("/orders", payload)
    if not ok(r):
        report.record(tc, "create direct order", FAIL, f"{r.status_code}", evidence=body(r))
        report.bug(f"BUG-{tc}-1", "Orders", "Backend", "/orders", "POST", payload, body(r), "201 created order",
                    "Blocks the entire delivery/invoice/payment chain.", "See response.", "Investigate.", "P0")
        return None
    order = body(r)
    order_id = order.get("id")
    report.record(tc, "create direct order", PASS, evidence={"id": order_id, "status": order.get("status")})
    report.observe_status("order.status", order.get("status"), "on create (direct)")
    return order_id, qty


# ---------------------------------------------------------------------------
# TC09 - Stock check around confirmation
# ---------------------------------------------------------------------------
def get_inventory_snapshot(admin, product_id, variant_id=None, warehouse_id=None):
    """Reserved/available/on-hand quantities live on GET /warehouses/stock (StockRow), NOT on
    GET /inventory/{id} - the latter is a stock+movement-history view with no reservation
    breakdown at all (confirmed live: its response has no reserved/available fields whatsoever).
    This aggregates across warehouses if warehouse_id isn't given, and picks the row matching
    variant_id (None = the base/no-variant row)."""
    params = {"product_id": product_id}
    if warehouse_id:
        params["warehouse_id"] = warehouse_id
    r = admin.get("/warehouses/stock", params=params)
    if not ok(r):
        return None, r
    rows = body(r)
    matching = [row for row in rows if row.get("variant_id") == variant_id] if rows else []
    if not matching and rows:
        matching = rows  # fall back to whatever rows exist (e.g. variant_id shape mismatch)
    physical = sum((row.get("on_hand") or 0) for row in matching)
    reserved = sum((row.get("reserved") or 0) for row in matching)
    available = sum((row.get("available") or 0) for row in matching)
    return {"physical": physical, "reserved": reserved, "available": available, "raw": rows}, r


def ensure_order_active(admin, order_id):
    """Confirm the order is ready to proceed to delivery. Discovered live behavior on this org
    (sales-workflow-settings.order_requires_approval=false): POST /orders reserves stock and sets
    status='placed' IMMEDIATELY on creation - there is no separate draft/unconfirmed state to
    transition out of, and /orders/{id}/approve correctly 400s ("Only an order awaiting approval
    can be approved") because the order is already active. Per the API docs, status is
    'awaiting_approval' instead of 'placed' only when order_requires_approval=true for the org -
    in that case an explicit approve call IS required. This helper checks the order's actual
    status and only calls approve when it's actually awaiting approval, instead of assuming one
    universal flow.

    NOTE: this contradicts the flow described in the test brief (Draft -> Confirmed with
    reservation happening only at confirmation) - reservation actually happens at order CREATION
    on this backend/config. Reported as a discrepancy, not silently special-cased away."""
    r = admin.get(f"/orders/{order_id}")
    if not ok(r):
        return None, r
    order = body(r)
    if order.get("status") == "awaiting_approval":
        r2 = admin.patch(f"/orders/{order_id}/approve", {})
        if not ok(r2):
            return order, r2
        return body(r2), r2
    return order, r


def tc09_stock_check_and_confirm(admin, order_id, product_id, order_qty, inventory_before_create):
    tc = "TC09"
    if not order_id:
        report.record(tc, "stock check around order creation", SKIP, "no order created")
        return

    if inventory_before_create is None:
        report.record(tc, "read inventory before order creation", FAIL, "snapshot was not captured before POST /orders")
        return
    report.record(tc, "read inventory before order creation", PASS, evidence=inventory_before_create)

    order, r = ensure_order_active(admin, order_id)
    if order is None:
        report.record(tc, "resolve order to active/confirmed state", FAIL, f"{r.status_code}", evidence=body(r))
        report.bug(f"BUG-{tc}-1", "Orders", "Backend", f"/orders/{order_id}", "GET", None, body(r), "200 with the order",
                    "Cannot proceed to delivery/invoice.", "See response.", "Investigate.", "P0")
        return
    report.record(tc, "resolve order to active/confirmed state", PASS, evidence={"status": order.get("status")})
    report.observe_status("order.status", order.get("status"), "resolved/active before delivery planning")
    report.observe_status("order.fulfilment_status", order.get("fulfilment_status"), "resolved/active before delivery planning")

    after, r = get_inventory_snapshot(admin, product_id)
    if after is None:
        report.record(tc, "read inventory after order creation", FAIL, f"{r.status_code}", evidence=body(r))
        return
    report.record(tc, "read inventory after order creation", PASS, evidence=after)

    before = inventory_before_create
    physical_unchanged = before["physical"] == after["physical"]
    reserved_increased = (after["reserved"] or 0) - (before["reserved"] or 0) == order_qty
    available_decreased = (before["available"] or 0) - (after["available"] or 0) == order_qty

    if physical_unchanged and reserved_increased and available_decreased:
        report.record(tc, "reservation math correct (physical unchanged, reserved+qty, available-qty)", PASS,
                       evidence={"before": before, "after": after})
    else:
        report.record(
            tc, "reservation math correct (physical unchanged, reserved+qty, available-qty)", FAIL,
            f"physical_unchanged={physical_unchanged} reserved_increased={reserved_increased} available_decreased={available_decreased}",
            evidence={"before": before, "after": after, "order_qty": order_qty},
        )
        report.bug(
            f"BUG-{tc}-2", "Inventory", "Backend", f"/inventory/{product_id}", "GET", None,
            {"before": before, "after": after}, f"physical unchanged, reserved +{order_qty}, available -{order_qty}",
            "Incorrect inventory math breaks stock-availability decisions across the app (overselling or false shortages).",
            "Order-creation reservation logic not updating the expected counters.",
            "Verify reservation write path in order-creation handler.", "P0",
        )

    ctx["order_a_id"] = order_id
    ctx["order_a_qty"] = order_qty


# ---------------------------------------------------------------------------
# TC10 - Stock shortage
# ---------------------------------------------------------------------------
def tc10_stock_shortage(admin, customer_a_id, product_id, warehouse_id, sales_officer_id, allow_backorder):
    tc = "TC10"
    if not customer_a_id or not product_id:
        report.record(tc, "stock shortage order", SKIP, "missing prerequisite")
        return

    before, _ = get_inventory_snapshot(admin, product_id)
    available = (before or {}).get("available") or 0
    huge_qty = int(available) + 100000

    payload = {
        "customer_id": customer_a_id, "warehouse_id": warehouse_id, "salesperson_id": sales_officer_id,
        "fulfilment_method": "delivery", "source": "office", "payment_type": "cash",
        "items": [{"product_id": product_id, "quantity": huge_qty, "unit_price": ctx.get("product_a_price", 100), "tax_rate": 18}],
    }
    r = admin.post("/orders", payload)

    if r.status_code == 400:
        resp = body(r)
        shortages_present = isinstance(resp, dict) and (
            resp.get("error") == "INSUFFICIENT_STOCK" or (isinstance(resp.get("detail"), dict) and resp["detail"].get("error") == "INSUFFICIENT_STOCK")
        )
        if shortages_present:
            report.record(tc, "over-quantity order rejected with structured shortage", PASS, evidence=resp)
        else:
            report.record(tc, "over-quantity order rejected with structured shortage", WARN, "400 but not the documented INSUFFICIENT_STOCK shape", evidence=resp)
    elif r.status_code in (200, 201):
        created = body(r)
        report.record(
            tc, "over-quantity order rejected with structured shortage", FAIL if not allow_backorder else WARN,
            f"order was CREATED (status {r.status_code}) despite requesting {huge_qty} against available {available}, and allow_backorder={allow_backorder}",
            evidence={"order": created, "available_before": available},
        )
        if not allow_backorder:
            report.bug(
                f"BUG-{tc}-1", "Orders/Inventory", "Backend", "/orders", "POST", payload, created,
                "400 INSUFFICIENT_STOCK (sales-workflow-settings.allow_backorder=false)",
                "Orders can be placed for stock the warehouse doesn't have, risking negative stock and undeliverable promises to customers.",
                "Order creation does not check available quantity against allow_backorder=false, or reservation exceeds available.",
                "Enforce available-quantity check at order confirmation using sales-workflow-settings.allow_backorder.", "P0",
            )
        # cancel this bad order so it doesn't pollute later stock math
        oid = created.get("id")
        if oid:
            admin.patch(f"/orders/{oid}/cancel", {"reason": "E2E cleanup - shortage test"})
    else:
        report.record(tc, "over-quantity order rejected with structured shortage", FAIL, f"unexpected status {r.status_code}", evidence=body(r))

    after, _ = get_inventory_snapshot(admin, product_id)
    if after and before and after.get("reserved") == before.get("reserved") and after.get("physical") == before.get("physical"):
        report.record(tc, "shortage attempt did not move stock", PASS)
    else:
        report.record(tc, "shortage attempt did not move stock", WARN, "inventory changed after a rejected/cancelled shortage order", evidence={"before": before, "after": after})


# ---------------------------------------------------------------------------
# TC11 - Delivery planning
# ---------------------------------------------------------------------------
def tc11_delivery_planning(admin, order_id, delivery_partner_id, vehicle_id, warehouse_id):
    tc = "TC11"
    if not order_id:
        report.record(tc, "delivery planning", SKIP, "no confirmed order")
        return None

    payload = {
        "order_id": order_id,
        "delivery_partner_id": delivery_partner_id,
        "vehicle_id": vehicle_id,
        "warehouse_id": warehouse_id,
        "scheduled_date": datetime.now().strftime("%Y-%m-%d"),
        "delivery_address": "E2E Delivery Address, Test Lane",
        "notes": f"{RUN_ID} planned delivery",
    }
    r = admin.post("/deliveries", payload)
    if not ok(r):
        report.record(tc, "plan delivery", FAIL, f"{r.status_code}", evidence=body(r))
        report.bug(f"BUG-{tc}-1", "Deliveries", "Backend", "/deliveries", "POST", payload, body(r), "201 created delivery",
                    "Blocks vehicle-load/dispatch/POD chain.", "See response.", "Investigate.", "P0")
        return None
    delivery = body(r)
    delivery_id = delivery.get("id")
    if delivery_id and delivery_id != order_id:
        report.record(tc, "plan delivery (delivery.id distinct from order.id)", PASS, evidence={"delivery_id": delivery_id, "order_id": order_id})
    else:
        report.record(tc, "plan delivery (delivery.id distinct from order.id)", FAIL, "delivery.id missing or equals order.id", evidence=delivery)
        report.bug(f"BUG-{tc}-2", "Deliveries", "Backend", "/deliveries", "POST", payload, delivery, "delivery.id is its own UUID, distinct from order.id",
                    "Delivery and order records would be conflated, breaking multi-delivery-per-order (partial delivery) scenarios.",
                    "Delivery creation reusing order id instead of generating its own.", "Assign a dedicated UUID/sequence to Delivery.", "P0")

    report.observe_status("delivery.status", delivery.get("status"), "on plan")
    ctx["delivery_id"] = delivery_id
    return delivery_id


# ---------------------------------------------------------------------------
# TC12/TC13 - Picking / Ready for delivery
# ---------------------------------------------------------------------------
def tc12_picking(admin, delivery_id):
    tc = "TC12"
    # No dedicated picking endpoint is documented or present in the frontend's deliveries API
    # (src/api/deliveries.js: plan -> load -> confirm, plus by-id GET/PATCH). Report honestly
    # rather than inventing a call.
    candidate_paths = [f"/deliveries/{delivery_id}/pick", f"/deliveries/{delivery_id}/picking"]
    found = False
    for p in candidate_paths:
        r = admin.post(p, {})
        if r.status_code != 404:
            found = True
            report.record(tc, f"probe {p}", WARN, f"unexpected {r.status_code} - endpoint may exist after all", evidence=body(r))
    if not found:
        report.record(tc, "picking flow", WARN,
                       "No picking endpoint exists on this backend (checked /deliveries/{id}/pick, /picking - both 404). "
                       "Physical warehouse stock is only debited at /deliveries/{id}/load. Picking is not a distinct API-tracked step.")


def tc13_ready_for_delivery(admin, delivery_id):
    tc = "TC13"
    r = admin.patch(f"/deliveries/by-id/{delivery_id}", {"status": "ready"})
    if ok(r):
        report.record(tc, "transition delivery to 'ready'", WARN, "accepted a 'ready' status - not documented, verify this is intentional", evidence=body(r))
    else:
        report.record(tc, "transition delivery to 'ready'", WARN,
                       f"No 'ready' state on this backend ({r.status_code} rejecting status='ready'). "
                       "Documented delivery lifecycle is planned -> loaded (via /load) -> in_transit -> delivered/partially_delivered/failed. "
                       "There is no distinct 'Ready for Delivery' status/action.", evidence=body(r))


# ---------------------------------------------------------------------------
# TC14 - Vehicle load
# ---------------------------------------------------------------------------
def tc14_vehicle_load(admin, delivery_id, product_id, qty):
    tc = "TC14"
    if not delivery_id:
        report.record(tc, "vehicle load", SKIP, "no delivery to load")
        return

    before, _ = get_inventory_snapshot(admin, product_id)
    report.record(tc, "inventory before load", PASS if before else FAIL, evidence=before)

    r = admin.post(f"/deliveries/{delivery_id}/load", {})
    if not ok(r):
        report.record(tc, "load delivery onto vehicle", FAIL, f"{r.status_code}", evidence=body(r))
        report.bug(f"BUG-{tc}-1", "Deliveries", "Backend", f"/deliveries/{delivery_id}/load", "POST", {}, body(r), "200 with status=loaded",
                    "Cannot dispatch or confirm delivery.", "See response.", "Investigate load preconditions.", "P0")
        return
    loaded = body(r)
    report.record(tc, "load delivery onto vehicle", PASS, evidence={"status": loaded.get("status")})
    report.observe_status("delivery.status", loaded.get("status"), "after load")

    after, _ = get_inventory_snapshot(admin, product_id)
    report.record(tc, "inventory after load", PASS if after else FAIL, evidence=after)

    if before and after:
        physical_decreased = (before["physical"] or 0) - (after["physical"] or 0) == qty
        reserved_decreased = (before["reserved"] or 0) - (after["reserved"] or 0) == qty
        if physical_decreased and reserved_decreased:
            report.record(tc, "warehouse physical/reserved decreased by loaded qty", PASS, evidence={"before": before, "after": after})
        else:
            report.record(tc, "warehouse physical/reserved decreased by loaded qty", FAIL,
                           f"physical_decreased={physical_decreased} reserved_decreased={reserved_decreased}",
                           evidence={"before": before, "after": after, "qty": qty})
            report.bug(f"BUG-{tc}-2", "Inventory/Deliveries", "Backend", f"/deliveries/{delivery_id}/load", "POST", {},
                        {"before": before, "after": after}, f"physical -{qty}, reserved -{qty} on load",
                        "Warehouse stock and reservation would drift from reality once goods physically leave the warehouse.",
                        "Load handler not decrementing both counters atomically.", "Verify stock-movement write in load handler.", "P0")

    # Cross-check via vehicle-stock/current if the delivery partner id is known
    dp_id = ctx.get("delivery_partner_id")
    if dp_id:
        r = admin.get(f"/vehicle-stock/current/{dp_id}")
        report.record(tc, "GET /vehicle-stock/current shows loaded items", PASS if ok(r) else WARN,
                       None if ok(r) else f"{r.status_code} (may be delivery-linked-only and not surfaced here)", evidence=None if ok(r) else body(r))


# ---------------------------------------------------------------------------
# TC15 - Dispatch
# ---------------------------------------------------------------------------
def tc15_dispatch(admin, delivery_id):
    tc = "TC15"
    if not delivery_id:
        report.record(tc, "dispatch delivery", SKIP, "no delivery loaded")
        return

    r = admin.patch(f"/deliveries/by-id/{delivery_id}", {"status": "in_transit"})
    if ok(r):
        d = body(r)
        status_ok = d.get("status") == "in_transit"
        report.record(tc, "dispatch (loaded -> in_transit)", PASS if status_ok else WARN, None if status_ok else f"status={d.get('status')}", evidence=d)
        report.observe_status("delivery.status", d.get("status"), "after dispatch")
        if "dispatched_at" in d:
            report.record(tc, "dispatched_at timestamp recorded", PASS if d.get("dispatched_at") else WARN, None if d.get("dispatched_at") else "field present but null")
        else:
            report.record(tc, "dispatched_at timestamp recorded", WARN, "no dispatched_at field on delivery response")
    else:
        report.record(tc, "dispatch (loaded -> in_transit)", FAIL, f"{r.status_code}", evidence=body(r))
        report.bug(f"BUG-{tc}-1", "Deliveries", "Backend", f"/deliveries/by-id/{delivery_id}", "PATCH", {"status": "in_transit"}, body(r),
                    "200 with status=in_transit", "Cannot progress delivery to in-transit/delivered.", "See response.", "Investigate status-transition rules.", "P0")


# ---------------------------------------------------------------------------
# TC16 - Full delivery + POD
# ---------------------------------------------------------------------------
def tc16_full_delivery_pod(admin, delivery_id, product_id, qty):
    tc = "TC16"
    if not delivery_id:
        report.record(tc, "full delivery + POD", SKIP, "no dispatched delivery")
        return

    r = admin.get(f"/deliveries/by-id/{delivery_id}")
    if not ok(r):
        report.record(tc, "get delivery detail for items", FAIL, f"{r.status_code}", evidence=body(r))
        return
    delivery = body(r)
    items = delivery.get("items") or []
    if not items:
        report.record(tc, "get delivery detail for items", FAIL, "no items on delivery", evidence=delivery)
        return

    pod_file_ids = []
    img = next_image()
    if img:
        data, resp = upload_generic_file(admin, img)
        if data:
            pod_file_ids.append(data.get("file_id") or data.get("id"))
            report.record(tc, "upload POD photo", PASS)
        else:
            report.record(tc, "upload POD photo", WARN, f"{resp.status_code}", evidence=body(resp))

    signature_file_id = None
    img2 = next_image()
    if img2:
        data, resp = upload_generic_file(admin, img2)
        if data:
            signature_file_id = data.get("file_id") or data.get("id")
            report.record(tc, "upload signature", PASS)
        else:
            report.record(tc, "upload signature", WARN, f"{resp.status_code}", evidence=body(resp))

    confirm_payload = {
        "failed": False,
        "items": [{"delivery_item_id": it.get("id"), "delivered_quantity": it.get("planned_quantity") or it.get("loaded_quantity") or it.get("quantity") or qty} for it in items],
        "notes": f"{RUN_ID} full delivery confirmed by E2E",
    }
    if pod_file_ids:
        confirm_payload["pod_photo_file_ids"] = pod_file_ids
    if signature_file_id:
        confirm_payload["signature_file_id"] = signature_file_id

    before, _ = get_inventory_snapshot(admin, product_id)

    r = admin.post(f"/deliveries/{delivery_id}/confirm", confirm_payload)
    if not ok(r):
        report.record(tc, "confirm full delivery", FAIL, f"{r.status_code}", evidence=body(r))
        report.bug(f"BUG-{tc}-1", "Deliveries", "Backend", f"/deliveries/{delivery_id}/confirm", "POST", confirm_payload, body(r),
                    "200 with status=delivered", "Cannot complete delivery or invoice the order.", "See response.", "Investigate confirm preconditions.", "P0")
        return
    confirmed = body(r)
    report.record(tc, "confirm full delivery", PASS, evidence={"status": confirmed.get("status")})
    report.observe_status("delivery.status", confirmed.get("status"), "after full confirm")

    delivered_ok = confirmed.get("status") == "delivered"
    report.record(tc, "delivery status = delivered", PASS if delivered_ok else FAIL, None if delivered_ok else f"got {confirmed.get('status')}")

    order_id = ctx.get("order_a_id")
    if order_id:
        r = admin.get(f"/orders/{order_id}")
        order = body(r) if ok(r) else {}
        report.observe_status("order.fulfilment_status", order.get("fulfilment_status"), "after full delivery")
        fulfilled_ok = order.get("fulfilment_status") in ("delivered", "fulfilled")
        report.record(tc, "order fulfilment_status reflects full delivery", PASS if fulfilled_ok else WARN,
                       None if fulfilled_ok else f"fulfilment_status={order.get('fulfilment_status')}", evidence=None if fulfilled_ok else order)

    after, _ = get_inventory_snapshot(admin, product_id)
    if before and after:
        vehicle_note = "vehicle stock is tracked separately from /inventory/{id} - see VehicleLoading records; physical/reserved should stay as they were after load"
        report.record(tc, "post-delivery inventory read", PASS, evidence={"before": before, "after": after, "note": vehicle_note})

    ctx["pod_confirmed_delivery_id"] = delivery_id


# ---------------------------------------------------------------------------
# TC17 - Partial delivery (full independent sub-flow)
# ---------------------------------------------------------------------------
def tc17_partial_delivery(admin, customer_a_id, product_id, warehouse_id, sales_officer_id, delivery_partner_id, vehicle_id):
    tc = "TC17"
    ordered_qty, delivered_qty, pending_qty = 20, 12, 8

    order_id, _qty = tc08_direct_order(admin, customer_a_id, product_id, warehouse_id, sales_officer_id, qty=ordered_qty) or (None, None)
    if not order_id:
        report.record(tc, "partial delivery flow", SKIP, "could not create order for partial-delivery test")
        return

    order, r = ensure_order_active(admin, order_id)
    if order is None:
        report.record(tc, "confirm order for partial delivery", FAIL, f"{r.status_code}", evidence=body(r))
        return
    report.record(tc, "confirm order for partial delivery", PASS, evidence={"status": order.get("status")})

    delivery_id = tc11_delivery_planning(admin, order_id, delivery_partner_id, vehicle_id, warehouse_id)
    if not delivery_id:
        report.record(tc, "partial delivery flow", FAIL, "could not plan delivery")
        return

    r = admin.post(f"/deliveries/{delivery_id}/load", {})
    if not ok(r):
        report.record(tc, "load for partial delivery", FAIL, f"{r.status_code}", evidence=body(r))
        return
    report.record(tc, "load for partial delivery", PASS)

    admin.patch(f"/deliveries/by-id/{delivery_id}", {"status": "in_transit"})

    r = admin.get(f"/deliveries/by-id/{delivery_id}")
    delivery = body(r) if ok(r) else {}
    items = delivery.get("items") or []
    if not items:
        report.record(tc, "partial delivery flow", FAIL, "no delivery items to confirm partially", evidence=delivery)
        return

    img = next_image()
    pod_file_ids = []
    if img:
        data, _resp = upload_generic_file(admin, img)
        if data:
            pod_file_ids.append(data.get("file_id") or data.get("id"))

    confirm_payload = {
        "failed": False,
        "items": [{"delivery_item_id": items[0].get("id"), "delivered_quantity": delivered_qty}],
        "notes": f"{RUN_ID} partial delivery - {delivered_qty} of {ordered_qty}",
    }
    if pod_file_ids:
        confirm_payload["pod_photo_file_ids"] = pod_file_ids

    r = admin.post(f"/deliveries/{delivery_id}/confirm", confirm_payload)
    if not ok(r):
        report.record(tc, "confirm partial delivery", FAIL, f"{r.status_code}", evidence=body(r))
        report.bug(f"BUG-{tc}-1", "Deliveries", "Backend", f"/deliveries/{delivery_id}/confirm", "POST", confirm_payload, body(r),
                    "200 with status=partially_delivered", "Cannot verify partial-delivery business logic at all.", "See response.", "Investigate.", "P0")
        return
    confirmed = body(r)
    report.record(tc, "confirm partial delivery", PASS, evidence={"status": confirmed.get("status")})
    report.observe_status("delivery.status", confirmed.get("status"), "after partial confirm")

    partial_ok = confirmed.get("status") == "partially_delivered"
    report.record(tc, "delivery status = partially_delivered", PASS if partial_ok else FAIL, None if partial_ok else f"got {confirmed.get('status')}", evidence=None if partial_ok else confirmed)

    r = admin.get(f"/orders/{order_id}")
    order = body(r) if ok(r) else {}
    report.observe_status("order.fulfilment_status", order.get("fulfilment_status"), "after partial delivery")
    order_partial_ok = order.get("fulfilment_status") == "partially_delivered"
    report.record(tc, "order fulfilment_status = partially_delivered", PASS if order_partial_ok else WARN,
                   None if order_partial_ok else f"got {order.get('fulfilment_status')}", evidence=None if order_partial_ok else order)

    delivered_items = confirmed.get("items") or []
    line = next((i for i in delivered_items if i.get("id") == items[0].get("id")), delivered_items[0] if delivered_items else {})
    actual_delivered = line.get("delivered_quantity")
    delivered_qty_ok = actual_delivered == delivered_qty
    report.record(tc, f"delivered_quantity == {delivered_qty}", PASS if delivered_qty_ok else FAIL,
                   None if delivered_qty_ok else f"got {actual_delivered}", evidence=None if delivered_qty_ok else line)

    pending_field = line.get("pending_quantity")
    if pending_field is not None:
        pending_ok = pending_field == pending_qty
        report.record(tc, f"pending_quantity == {pending_qty} (identifiable)", PASS if pending_ok else WARN,
                       None if pending_ok else f"got {pending_field}", evidence=None if pending_ok else line)
    else:
        planned = line.get("planned_quantity") or ordered_qty
        derivable = (planned - actual_delivered) == pending_qty if actual_delivered is not None else False
        report.record(tc, f"pending_quantity == {pending_qty} (identifiable)", WARN if derivable else FAIL,
                       "no explicit pending_quantity field - derived from planned_quantity - delivered_quantity" if derivable else "cannot derive pending quantity from response",
                       evidence=line)

    ctx["partial_order_id"] = order_id
    ctx["partial_delivery_id"] = delivery_id
    ctx["partial_delivered_qty"] = delivered_qty
    ctx["partial_pending_qty"] = pending_qty


# ---------------------------------------------------------------------------
# TC18 - Invoice
# ---------------------------------------------------------------------------
def tc18_invoice(admin, order_id, expect_delivered_qty=None):
    tc = "TC18"
    if not order_id:
        report.record(tc, "invoice order", SKIP, "no delivered order")
        return None

    r = admin.post(f"/orders/{order_id}/invoice", {})
    if not ok(r):
        report.record(tc, "invoice order", FAIL, f"{r.status_code}", evidence=body(r))
        report.bug(f"BUG-{tc}-1", "Invoices", "Backend", f"/orders/{order_id}/invoice", "POST", {}, body(r), "201 created invoice",
                    "Cannot bill the customer despite completed delivery.", "See response.", "Check invoice_timing/allow_direct_invoice settings and delivery status precondition.", "P0")
        return None
    invoice = body(r)
    invoice_id = invoice.get("id")
    report.record(tc, "invoice order", PASS, evidence={"id": invoice_id, "invoice_number": invoice.get("invoice_number")})
    report.observe_status("invoice.invoice_status", invoice.get("invoice_status") or invoice.get("status"), "on create")
    report.observe_status("invoice.payment_status", invoice.get("payment_status"), "on create")

    required_fields = ["invoice_number", "order_id", "customer", "items", "total"]
    missing = [f for f in required_fields if invoice.get(f) in (None, [], "")]
    if not missing:
        report.record(tc, "invoice has required fields", PASS)
    else:
        report.record(tc, "invoice has required fields", WARN, f"missing/empty: {missing}", evidence=invoice)

    if expect_delivered_qty is not None:
        items = invoice.get("items") or []
        qty_sum = sum((it.get("quantity") or 0) for it in items)
        qty_ok = qty_sum == expect_delivered_qty
        report.record(tc, f"invoice quantity follows delivered quantity ({expect_delivered_qty})", PASS if qty_ok else FAIL,
                       None if qty_ok else f"invoice items sum to {qty_sum}, expected {expect_delivered_qty}", evidence=None if qty_ok else items)
        if not qty_ok:
            report.bug(
                f"BUG-{tc}-2", "Invoices", "Backend", f"/orders/{order_id}/invoice", "POST", {},
                {"invoice_items_qty_sum": qty_sum}, f"invoice item quantity == delivered quantity ({expect_delivered_qty}), per invoice_timing=after_delivery and partial_delivery_invoice_mode=per_delivery",
                "Customer would be billed for goods not yet physically delivered on a partially-delivered order - a real overbilling/accounting-correctness issue, not cosmetic.",
                "Order-to-invoice conversion appears to bill the full ORDERED quantity rather than the actually-DELIVERED quantity when the order was only partially delivered.",
                "Verify the invoice line-item quantity source: should sum delivered_quantity from the order's deliveries, not the original order line quantity, when partial_delivery_invoice_mode=per_delivery.",
                "P0",
            )

    r2 = admin.get(f"/invoices/{invoice_id}/pdf", params={"format": "detailed"})
    r3 = admin.get(f"/invoices/{invoice_id}/pdf", params={"format": "simple"})
    detailed_ok = ok(r2)
    simple_ok = ok(r3)
    if detailed_ok and simple_ok:
        report.record(tc, "invoice PDF: detailed and simple formats are the SAME record (two views)", PASS, evidence={"invoice_id": invoice_id})
    else:
        report.record(tc, "invoice PDF: detailed and simple formats are the SAME record (two views)", WARN,
                       f"detailed={r2.status_code} simple={r3.status_code}", evidence={"detailed": None if detailed_ok else body(r2), "simple": None if simple_ok else body(r3)})

    # Second invoice attempt on the same order - should not silently duplicate
    r4 = admin.post(f"/orders/{order_id}/invoice", {})
    if r4.status_code in (400, 409):
        report.record(tc, "prevent duplicate invoice for same order", PASS, evidence={"status": r4.status_code})
    elif ok(r4):
        second_invoice_id = body(r4).get("id")
        if second_invoice_id == invoice_id:
            report.record(tc, "prevent duplicate invoice for same order", PASS, evidence="idempotent - returned same invoice")
        else:
            report.record(tc, "prevent duplicate invoice for same order", WARN,
                           "a second distinct invoice was created for the same order - may be intentional under partial_delivery_invoice_mode=per_delivery, needs product confirmation",
                           evidence={"first": invoice_id, "second": second_invoice_id})
    else:
        report.record(tc, "prevent duplicate invoice for same order", WARN, f"unexpected {r4.status_code}", evidence=body(r4))

    ctx["invoice_a_id"] = invoice_id
    ctx["invoice_a_total"] = invoice.get("total")
    return invoice_id


# ---------------------------------------------------------------------------
# TC19/20/21 - Payments
# ---------------------------------------------------------------------------
def tc19_cash_payment_full(admin, invoice_id):
    tc = "TC19"
    if not invoice_id:
        report.record(tc, "cash payment (full)", SKIP, "no invoice")
        return

    r = admin.get(f"/invoices/{invoice_id}")
    invoice = body(r) if ok(r) else {}
    total = invoice.get("total") or 0

    payload = {"invoice_reference_id": invoice_id, "amount_received": total, "payment_method": "cash", "receipt_date": datetime.now().strftime("%Y-%m-%d")}
    r = admin.post("/payment-receipts", payload)
    if not ok(r):
        report.record(tc, "record full cash payment", FAIL, f"{r.status_code}", evidence=body(r))
        report.bug(f"BUG-{tc}-1", "Payments", "Backend", "/payment-receipts", "POST", payload, body(r), "201 created payment receipt", "Cannot close out cash sales.", "See response.", "Investigate.", "P0")
        return
    report.record(tc, "record full cash payment", PASS, evidence={"amount": total})

    r = admin.get(f"/invoices/{invoice_id}")
    invoice_after = body(r) if ok(r) else {}
    report.observe_status("invoice.payment_status", invoice_after.get("payment_status"), "after full payment")
    paid_ok = invoice_after.get("payment_status") == "Paid"
    balance = invoice_after.get("outstanding_amount") or invoice_after.get("balance")
    balance_ok = (balance or 0) == 0
    if paid_ok and balance_ok:
        report.record(tc, "payment_status=Paid, balance=0", PASS)
    else:
        report.record(tc, "payment_status=Paid, balance=0", FAIL, f"payment_status={invoice_after.get('payment_status')} balance={balance}", evidence=invoice_after)


def tc20_partial_payment(admin, invoice_id):
    tc = "TC20"
    if not invoice_id:
        report.record(tc, "partial payment (2 receipts)", SKIP, "no invoice")
        return

    r = admin.get(f"/invoices/{invoice_id}")
    invoice = body(r) if ok(r) else {}
    total = float(invoice.get("total") or 0)
    if total <= 0:
        report.record(tc, "partial payment (2 receipts)", SKIP, "invoice total is 0")
        return

    p1 = round(total * 0.4, 2)
    p2 = round(total - p1, 2)

    r = admin.post("/payment-receipts", {"invoice_reference_id": invoice_id, "amount_received": p1, "payment_method": "upi", "receipt_date": datetime.now().strftime("%Y-%m-%d")})
    if not ok(r):
        report.record(tc, "record payment 1 (partial)", FAIL, f"{r.status_code}", evidence=body(r))
        return
    receipt_1_id = body(r).get("id")
    report.record(tc, "record payment 1 (partial)", PASS, evidence={"amount": p1})

    r = admin.get(f"/invoices/{invoice_id}")
    mid = body(r) if ok(r) else {}
    report.observe_status("invoice.payment_status", mid.get("payment_status"), "after first partial payment")
    # Confirmed live: the actual value is the short form "Partial", not "Partially Paid" - the
    # test brief's expected wording doesn't match this backend's real enum, noted in status review.
    partial_ok = mid.get("payment_status") == "Partial"
    report.record(tc, "payment_status=Partial after payment 1", PASS if partial_ok else FAIL,
                   None if partial_ok else f"got {mid.get('payment_status')}", evidence=None if partial_ok else mid)

    r = admin.post("/payment-receipts", {"invoice_reference_id": invoice_id, "amount_received": p2, "payment_method": "upi", "receipt_date": datetime.now().strftime("%Y-%m-%d")})
    if not ok(r):
        report.record(tc, "record payment 2 (remaining balance)", FAIL, f"{r.status_code}", evidence=body(r))
        return
    receipt_2_id = body(r).get("id")
    report.record(tc, "record payment 2 (remaining balance)", PASS, evidence={"amount": p2})

    distinct_receipts = receipt_1_id and receipt_2_id and receipt_1_id != receipt_2_id
    report.record(tc, "two distinct payment receipt records", PASS if distinct_receipts else FAIL, None if distinct_receipts else "receipt ids missing or equal")

    r = admin.get(f"/invoices/{invoice_id}")
    final = body(r) if ok(r) else {}
    report.observe_status("invoice.payment_status", final.get("payment_status"), "after second payment (fully paid)")
    fully_paid = final.get("payment_status") == "Paid" and (final.get("outstanding_amount") or final.get("balance") or 0) == 0
    report.record(tc, "payment_status=Paid, balance=0 after both payments", PASS if fully_paid else FAIL,
                   None if fully_paid else f"payment_status={final.get('payment_status')} balance={final.get('outstanding_amount')}", evidence=None if fully_paid else final)


def tc21_credit_customer_flow(admin, customer_b_id, product_id, warehouse_id, sales_officer_id, delivery_partner_id, vehicle_id):
    tc = "TC21"
    if not customer_b_id:
        report.record(tc, "credit customer flow", SKIP, "no credit customer")
        return

    order_id, qty = tc08_direct_order(admin, customer_b_id, product_id, warehouse_id, sales_officer_id, qty=5, payment_type="credit", payment_terms_days=15) or (None, None)
    if not order_id:
        report.record(tc, "credit customer flow", FAIL, "could not create order for credit customer")
        return

    r = admin.get(f"/orders/{order_id}")
    order = body(r) if ok(r) else {}
    terms_ok = order.get("payment_terms_days") == 15
    report.record(tc, "payment_terms_days=15 set at order creation", PASS if terms_ok else WARN,
                   None if terms_ok else f"got {order.get('payment_terms_days')!r} (no generic PATCH /orders/{{id}} exists - confirmed 405 - so this must be set at creation)",
                   evidence=None if terms_ok else order)

    order, r = ensure_order_active(admin, order_id)
    if order is None:
        report.record(tc, "confirm credit-customer order", FAIL, f"{r.status_code}", evidence=body(r))
        return
    report.record(tc, "confirm credit-customer order", PASS, evidence={"status": order.get("status")})

    delivery_id = tc11_delivery_planning(admin, order_id, delivery_partner_id, vehicle_id, warehouse_id)
    if delivery_id:
        admin.post(f"/deliveries/{delivery_id}/load", {})
        admin.patch(f"/deliveries/by-id/{delivery_id}", {"status": "in_transit"})
        r = admin.get(f"/deliveries/by-id/{delivery_id}")
        delivery = body(r) if ok(r) else {}
        items = delivery.get("items") or []
        if items:
            confirm_payload = {"failed": False, "items": [{"delivery_item_id": it.get("id"), "delivered_quantity": it.get("planned_quantity") or qty} for it in items]}
            admin.post(f"/deliveries/{delivery_id}/confirm", confirm_payload)

    invoice_before_date = datetime.now()
    r = admin.post(f"/orders/{order_id}/invoice", {})
    if not ok(r):
        report.record(tc, "issue invoice for credit customer (no payment)", FAIL, f"{r.status_code}", evidence=body(r))
        return
    invoice = body(r)
    report.record(tc, "issue invoice for credit customer (no payment)", PASS, evidence={"id": invoice.get("id")})

    unpaid_ok = invoice.get("payment_status") in ("Unpaid", None) and (invoice.get("outstanding_amount") or invoice.get("total")) not in (0,)
    report.record(tc, "payment_status = Unpaid immediately after issue", PASS if unpaid_ok else WARN,
                   None if unpaid_ok else f"payment_status={invoice.get('payment_status')}", evidence=None if unpaid_ok else invoice)

    due_date = invoice.get("due_date")
    invoice_date = invoice.get("invoice_date") or invoice_before_date.strftime("%Y-%m-%d")
    if due_date:
        try:
            d_due = datetime.fromisoformat(str(due_date)[:10])
            d_inv = datetime.fromisoformat(str(invoice_date)[:10])
            days = (d_due - d_inv).days
            due_ok = days == 15
            report.record(tc, "due_date = invoice_date + 15 days", PASS if due_ok else WARN, None if due_ok else f"got {days} days", evidence=None if due_ok else invoice)
        except Exception as e:
            report.record(tc, "due_date = invoice_date + 15 days", WARN, f"could not parse dates: {e}", evidence=invoice)
    else:
        report.record(tc, "due_date = invoice_date + 15 days", WARN, "no due_date field on invoice response", evidence=invoice)

    r = admin.get(f"/orders/{order_id}")
    order = body(r) if ok(r) else {}
    fulfilled_independent_of_payment = order.get("fulfilment_status") in ("delivered", "fulfilled", "partially_delivered")
    report.record(tc, "order operationally fulfilled while invoice remains unpaid (fulfilment independent of payment)",
                   PASS if fulfilled_independent_of_payment else WARN,
                   None if fulfilled_independent_of_payment else f"fulfilment_status={order.get('fulfilment_status')}", evidence=None if fulfilled_independent_of_payment else order)


# ---------------------------------------------------------------------------
# TC22 - Staff detail / workspace
# ---------------------------------------------------------------------------
def tc22_staff_detail(admin, clients):
    tc = "TC22"
    expected = {"sales": "sales", "delivery": "delivery", "accountant": "accounts"}
    for role, exp_ws in expected.items():
        c = clients.get(role)
        if not c or not c.user:
            report.record(tc, f"{role} staff detail", SKIP, "no client/user")
            continue
        user_id = c.user.get("id")

        r = admin.get(f"/users/{user_id}")
        if not ok(r):
            report.record(tc, f"GET /users/{{id}} ({role})", FAIL, f"{r.status_code}", evidence=body(r))
            continue
        report.record(tc, f"GET /users/{{id}} ({role})", PASS)

        r = admin.get(f"/users/{user_id}/overview")
        if not ok(r):
            report.record(tc, f"GET /users/{{id}}/overview ({role})", FAIL, f"{r.status_code}", evidence=body(r))
            continue
        overview = body(r)
        ws = overview.get("workspace")
        report.record(tc, f"overview.workspace == {exp_ws!r} ({role})", PASS if ws == exp_ws else FAIL,
                       None if ws == exp_ws else f"got {ws!r}", evidence=None if ws == exp_ws else overview)


# ---------------------------------------------------------------------------
# TC23 - Organization isolation
# ---------------------------------------------------------------------------
def tc23_org_isolation(admin, customer_a_id, product_a_id, order_a_id):
    tc = "TC23"
    ts = int(time.time())
    reg_payload = {
        "organization_name": f"{RUN_ID} Isolation Org B",
        "admin_name": "E2E Org B Admin",
        "email": f"e2e.orgb.{ts}@example.com",
        "password": "OrgBPass123!",
        "role": "admin",
    }
    r = requests.post(f"{BASE_URL}/auth/register", json=reg_payload, timeout=30)
    if not ok(r):
        report.record(tc, "register throwaway Org B", WARN, f"{r.status_code} - cannot test isolation without a second org", evidence=body(r))
        return
    org_b_data = body(r)
    org_b_admin = Client("org_b_admin")
    tokens = org_b_data.get("tokens") or org_b_data
    org_b_admin.token = tokens.get("access_token")
    report.record(tc, "register throwaway Org B", PASS, evidence={"org_id": (org_b_data.get("organization") or {}).get("id")})

    checks = [
        ("customers", customer_a_id, f"/customers/{customer_a_id}"),
        ("products", product_a_id, f"/products/{product_a_id}"),
        ("orders", order_a_id, f"/orders/{order_a_id}"),
    ]
    for label, entity_id, path in checks:
        if not entity_id:
            report.record(tc, f"org B cannot access org A's {label}", SKIP, "no entity id available")
            continue
        r = org_b_admin.get(path)
        denied = r.status_code in (403, 404)
        report.record(tc, f"org B cannot access org A's {label}", PASS if denied else FAIL,
                       None if denied else f"org B admin got {r.status_code} reading org A's {label}", evidence=None if denied else body(r))
        if not denied:
            report.bug(f"BUG-{tc}-1", "Organization Isolation", "Backend", path, "GET", None, body(r), "403 or 404 - cross-org access must be denied",
                        "A CRITICAL multi-tenant data leak: one organization can read another organization's data.",
                        "Missing organization_id scoping on the lookup query.", "Add organization_id filter to every entity lookup.", "P0")


# ---------------------------------------------------------------------------
# TC24 - Role / permission checks
# ---------------------------------------------------------------------------
def tc24_permissions(clients):
    tc = "TC24"
    sales = clients.get("sales")
    delivery = clients.get("delivery")
    accountant = clients.get("accountant")
    admin = clients.get("admin")

    if sales:
        r = sales.post("/users", {"first_name": "Should", "last_name": "Fail", "official_email": "shouldfail@example.com", "password": "x", "role_id": "x"})
        denied = r.status_code in (401, 403)
        report.record(tc, "sales cannot create staff (admin-only)", PASS if denied else FAIL,
                       None if denied else f"got {r.status_code}", evidence=None if denied else body(r))

    if delivery:
        product_id = ctx.get("product_a_id")
        if product_id:
            r = delivery.patch(f"/products/{product_id}", {"price": 1})
            denied = r.status_code in (401, 403)
            report.record(tc, "delivery cannot edit product master data", PASS if denied else FAIL,
                           None if denied else f"got {r.status_code}", evidence=None if denied else body(r))
        else:
            report.record(tc, "delivery cannot edit product master data", SKIP, "no product id")

    if accountant:
        product_id = ctx.get("product_a_id")
        if product_id:
            r = accountant.post("/inventory/adjustments", {"product_id": product_id, "quantity": 1, "movement_type": "adjustment"})
            denied = r.status_code in (401, 403)
            report.record(tc, "accountant cannot perform inventory adjustments", PASS if denied else FAIL,
                           None if denied else f"got {r.status_code}", evidence=None if denied else body(r))
        else:
            report.record(tc, "accountant cannot perform inventory adjustments", SKIP, "no product id")

    if admin:
        r = admin.get("/superadmin/organizations")
        denied = r.status_code in (401, 403)
        report.record(tc, "org admin cannot access superadmin endpoints", PASS if denied else FAIL,
                       None if denied else f"got {r.status_code}", evidence=None if denied else body(r))


# ---------------------------------------------------------------------------
# TC25 - File upload
# ---------------------------------------------------------------------------
def tc25_file_upload(admin):
    tc = "TC25"
    img = next_image()
    pdf = next_pdf()

    for label, f in (("image", img), ("pdf", pdf)):
        if not f:
            report.record(tc, f"upload {label} via /files/upload", SKIP, "no dummy file available")
            continue
        data, r = upload_generic_file(admin, f)
        if not data:
            report.record(tc, f"upload {label} via /files/upload", FAIL, f"{r.status_code}", evidence=body(r))
            continue
        file_id = data.get("file_id") or data.get("id")
        url = data.get("url")
        if file_id or url:
            report.record(tc, f"upload {label} via /files/upload", PASS, evidence={"file_id": file_id, "url": url})
        else:
            report.record(tc, f"upload {label} via /files/upload", WARN, "200 but no file_id/url in response", evidence=data)

        if file_id:
            r2 = admin.get(f"/files/{file_id}")
            report.record(tc, f"retrieve {label} via GET /files/{{id}}", PASS if ok(r2) else WARN, None if ok(r2) else f"{r2.status_code}")


# ---------------------------------------------------------------------------
# Status audit compilation
# ---------------------------------------------------------------------------
def print_status_review():
    print("\n" + "=" * 78)
    print("STATUS REVIEW (observed live, not assumed)")
    print("=" * 78)
    for field, values in report.status_observations.items():
        print(f"\n{field}:")
        for value, contexts in values.items():
            print(f"  - {value!r}  (seen: {', '.join(sorted(set(contexts)))})")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 78)
    print(f"E2E FULL BUSINESS FLOW - run {RUN_ID}")
    print(f"Target: {BASE_URL}")
    print(f"Dummy files: {len(IMAGE_FILES)} image(s), {len(PDF_FILES)} pdf(s) in {DUMMY_DIR}")
    print("=" * 78)

    def safe(fn, *args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            report.record(fn.__name__, fn.__name__, FAIL, f"unhandled exception: {e}")
            traceback.print_exc()
            return None

    clients = safe(tc01_authentication) or {}
    admin = clients.get("admin")
    if not admin:
        print("FATAL: admin login failed, cannot continue.")
        finalize()
        return

    # Resolve prerequisites admin needs throughout (warehouse, staff ids, vehicle)
    r = admin.get("/warehouses")
    warehouses = body(r) if ok(r) else []
    warehouse = next((w for w in warehouses if w.get("is_default")), warehouses[0] if warehouses else None)
    ctx["warehouse_id"] = warehouse.get("id") if warehouse else None

    sales_client = clients.get("sales")
    delivery_client = clients.get("delivery")
    ctx["sales_officer_id"] = (sales_client.user or {}).get("id") if sales_client else None
    ctx["delivery_partner_id"] = (delivery_client.user or {}).get("id") if delivery_client else None

    r = admin.get("/vehicles")
    vehicles = body(r) if ok(r) else []
    vehicle_id = vehicles[0]["id"] if vehicles else None
    if not vehicle_id:
        vr = admin.post("/vehicles", {"vehicle_number": f"{RUN_ID}-VEH", "vehicle_type": "Van", "capacity_kg": 500, "default_driver_id": ctx.get("delivery_partner_id")})
        if ok(vr):
            vehicle_id = body(vr).get("id")
    ctx["vehicle_id"] = vehicle_id

    r = admin.get("/sales-workflow-settings")
    settings = body(r) if ok(r) else {}
    allow_backorder = bool(settings.get("allow_backorder"))
    print(f"\nsales-workflow-settings: {json.dumps(settings)}\n")

    category_id = safe(tc02_category, admin)
    supplier_id = safe(tc03_supplier, admin)
    product_a_id = safe(tc04_product_simple, admin, category_id, supplier_id)
    product_b_id = safe(tc05_product_variants, admin, category_id, supplier_id)
    customer_a_id, customer_b_id = safe(tc06_customers, admin, ctx.get("sales_officer_id")) or (None, None)

    safe(tc07_quotation, admin, customer_a_id, product_a_id)

    inventory_before_order = safe(lambda: get_inventory_snapshot(admin, product_a_id)[0]) if product_a_id else None
    order_result = safe(tc08_direct_order, admin, customer_a_id, product_a_id, ctx.get("warehouse_id"), ctx.get("sales_officer_id"), 20)
    order_id, order_qty = order_result if order_result else (None, None)
    safe(tc09_stock_check_and_confirm, admin, order_id, product_a_id, order_qty, inventory_before_order)

    safe(tc10_stock_shortage, admin, customer_a_id, product_a_id, ctx.get("warehouse_id"), ctx.get("sales_officer_id"), allow_backorder)

    delivery_id = safe(tc11_delivery_planning, admin, ctx.get("order_a_id"), ctx.get("delivery_partner_id"), ctx.get("vehicle_id"), ctx.get("warehouse_id"))
    safe(tc12_picking, admin, delivery_id)
    safe(tc13_ready_for_delivery, admin, delivery_id)
    safe(tc14_vehicle_load, admin, delivery_id, product_a_id, ctx.get("order_a_qty"))
    safe(tc15_dispatch, admin, delivery_id)
    safe(tc16_full_delivery_pod, admin, delivery_id, product_a_id, ctx.get("order_a_qty"))

    safe(tc17_partial_delivery, admin, customer_a_id, product_a_id, ctx.get("warehouse_id"), ctx.get("sales_officer_id"), ctx.get("delivery_partner_id"), ctx.get("vehicle_id"))

    invoice_id = safe(tc18_invoice, admin, ctx.get("order_a_id"), ctx.get("order_a_qty"))
    safe(tc19_cash_payment_full, admin, invoice_id)

    partial_invoice_id = safe(tc18_invoice, admin, ctx.get("partial_order_id"), ctx.get("partial_delivered_qty"))
    safe(tc20_partial_payment, admin, partial_invoice_id)

    safe(tc21_credit_customer_flow, admin, customer_b_id, product_a_id, ctx.get("warehouse_id"), ctx.get("sales_officer_id"), ctx.get("delivery_partner_id"), ctx.get("vehicle_id"))

    safe(tc22_staff_detail, admin, clients)
    safe(tc23_org_isolation, admin, customer_a_id, product_a_id, ctx.get("order_a_id"))
    safe(tc24_permissions, clients)
    safe(tc25_file_upload, admin)

    finalize()


def finalize():
    counts = report.summary()
    print("\n" + "=" * 78)
    print("FINAL REPORT")
    print("=" * 78)
    print(f"TOTAL TESTS: {len(report.results)}")
    print(f"PASSED:      {counts[PASS]}")
    print(f"FAILED:      {counts[FAIL]}")
    print(f"WARNINGS:    {counts[WARN]}")
    print(f"SKIPPED:     {counts[SKIP]}")

    if report.bugs:
        print("\nBUGS FOUND:")
        by_sev = {"P0": [], "P1": [], "P2": []}
        for b in report.bugs:
            by_sev.setdefault(b["severity"], []).append(b)
        for sev in ("P0", "P1", "P2"):
            if by_sev[sev]:
                print(f"\n-- {sev} --")
                for b in by_sev[sev]:
                    print(f"  {b['bug_id']} [{b['module']}/{b['layer']}] {b['method']} {b['endpoint']}")
                    print(f"    actual:   {json.dumps(b['actual_response'], default=str)[:200]}")
                    print(f"    expected: {b['expected_behavior']}")

    print_status_review()

    out_path = SCRIPT_DIR / f"e2e_report_{RUN_ID}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({
            "run_id": RUN_ID, "base_url": BASE_URL, "summary": counts,
            "results": report.results, "bugs": report.bugs,
            "status_observations": report.status_observations, "context_ids": ctx,
        }, f, indent=2, default=str)
    print(f"\nFull report written to {out_path}")


if __name__ == "__main__":
    main()
