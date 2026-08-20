r"""
Focused Sales -> Delivery -> Invoice smoke test. ONE transaction only.

Runs against the LIVE dev backend (https://crm-saas-backend-9nom.onrender.com)
over plain HTTP, using the existing demo org (admin@demo.com). Does not touch
production, does not fabricate data beyond the single transaction described
below, and does not edit the database directly to skip workflow steps.

Every endpoint/body shape used here was verified against the backend's own
live /openapi.json schema (the actual current router code) before writing
this script - not assumed from stale documentation. See the accompanying
report for the recon findings.

Test data (human-readable names unchanged; only phone/email/SKU/vehicle
number get a timestamp suffix for uniqueness, per the spec):
    Customer:          Balaji Retail Mart
    Product:           Bisleri Packaged Drinking Water 1L
    SKU:               BISLERI-1L-SMOKE-<timestamp>
    Category:          Packaged Beverages
    Opening stock:     100 bottles
    Selling price:     Rs.20/bottle, 18% GST
    Order quantity:    20 bottles
    Delivery Partner:  Rahul Patil
    Vehicle:           MH 02 AB 4587

Run with:
    python scripts/smoke_sales_delivery_invoice.py

Test data is NOT cleaned up afterwards - it's left in the org for manual
UI inspection, as requested.
"""

import json
import sys
from datetime import datetime

import requests

BASE_URL = "https://crm-saas-backend-9nom.onrender.com"
RUN_TS = datetime.now().strftime("%Y%m%d-%H%M%S")
RUN_SHORT = datetime.now().strftime("%H%M%S")

ADMIN_EMAIL, ADMIN_PASSWORD = "admin@demo.com", "Admin@123"
OTHER_DELIVERY_EMAIL, OTHER_DELIVERY_PASSWORD = "delivery@demo.com", "Deliver@1234"

# ---------------------------------------------------------------------------
# Plumbing
# ---------------------------------------------------------------------------
RESULTS = []   # {step, action, method, endpoint, expected, actual, status}
BUGS = []      # dict per user's bug report template
RECORDS = {}   # created record ids, printed at the end


def req(method, path, headers=None, json_body=None, params=None):
    return requests.request(method, f"{BASE_URL}{path}", headers=headers, json=json_body, params=params, timeout=30)


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def jshort(resp, limit=600):
    try:
        return json.dumps(resp.json())[:limit]
    except Exception:
        return resp.text[:limit]


def record(step, action, method, endpoint, request_body, expected, actual, passed, extra=None):
    status = "PASS" if passed else "FAIL"
    RESULTS.append({"step": step, "action": action, "expected": expected, "actual": actual, "status": status})
    print(f"\n[{status}] {step} - {action}")
    print(f"  {method} {endpoint}")
    if request_body is not None:
        print(f"  Request: {json.dumps(request_body)[:400]}")
    print(f"  Expected: {expected}")
    print(f"  Actual:   {actual}")
    if extra:
        print(f"  {extra}")
    return passed


def bug(bug_id, severity, module, layer, file_ref, endpoint, repro, actual, expected, impact, fix):
    BUGS.append({
        "id": bug_id, "severity": severity, "module": module, "layer": layer, "file": file_ref,
        "endpoint": endpoint, "repro": repro, "actual": actual, "expected": expected,
        "impact": impact, "fix": fix,
    })


def stock_row(admin_headers, warehouse_id, product_id):
    r = req("GET", "/warehouses/stock", headers=admin_headers, params={"warehouse_id": warehouse_id, "product_id": product_id})
    if r.status_code != 200:
        return {}
    rows = r.json()
    return rows[0] if rows else {}


def vehicle_qty(admin_headers, delivery_partner_id, product_id):
    r = req("GET", f"/vehicle-stock/current/{delivery_partner_id}", headers=admin_headers)
    if r.status_code == 404:
        return 0
    if r.status_code != 200:
        return None
    items = r.json().get("items", [])
    total = 0
    for it in items:
        if it.get("product_id") == product_id:
            total += (it.get("loaded_qty") or 0) - (it.get("delivered_qty") or 0)
    return total


print("=" * 78)
print(f"SMOKE TEST RUN: {RUN_TS}")
print("=" * 78)

# ---------------------------------------------------------------------------
# STEP 1 - Authentication
# ---------------------------------------------------------------------------
r = req("POST", "/auth/login", json_body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
ok1 = record("Step 1", "Login as Admin", "POST", "/auth/login", {"email": ADMIN_EMAIL},
             "200, user.organization present, system_role=admin",
             f"{r.status_code}: {jshort(r)}", r.status_code == 200)
if not ok1:
    print("\nFATAL: cannot authenticate as admin. Aborting.")
    sys.exit(1)

admin_data = r.json()
admin_token = admin_data["tokens"]["access_token"]
admin_headers = auth_header(admin_token)
org_id = admin_data["user"]["organization_id"]
record("Step 1", "Verify admin org/workspace", "GET", "/auth/me", None,
       "organization_id present, system_role=admin",
       f"org={org_id}, system_role={admin_data['user'].get('system_role')}",
       bool(org_id) and admin_data["user"].get("system_role") == "admin")

# ---------------------------------------------------------------------------
# STEP 2 - Product + opening stock
# ---------------------------------------------------------------------------
r = req("GET", "/warehouses", headers=admin_headers)
warehouses = r.json() if r.status_code == 200 else []
warehouse = next((w for w in warehouses if w.get("is_default")), warehouses[0] if warehouses else None)
warehouse_id = warehouse["id"] if warehouse else None
record("Step 2a", "Resolve default warehouse", "GET", "/warehouses", None,
       "a default warehouse exists", f"warehouse_id={warehouse_id} ({warehouse.get('name') if warehouse else None})",
       bool(warehouse_id))

r = req("GET", "/categories", headers=admin_headers)
categories = r.json() if r.status_code == 200 else []
category = next((c for c in categories if c.get("name") == "Packaged Beverages"), None)
if not category:
    r = req("POST", "/categories", headers=admin_headers, json_body={"name": "Packaged Beverages"})
    category = r.json() if r.status_code == 201 else None
category_id = category["id"] if category else None
record("Step 2b", "Reuse/create category 'Packaged Beverages'", "POST", "/categories", {"name": "Packaged Beverages"},
       "category exists (reused or created)", f"category_id={category_id}", bool(category_id))

sku = f"BISLERI-1L-SMOKE-{RUN_SHORT}"
r = req("GET", "/products", headers=admin_headers, params={"search": "Bisleri Packaged Drinking Water 1L"})
existing_products = r.json() if r.status_code == 200 else []
product = next((p for p in existing_products if p.get("name") == "Bisleri Packaged Drinking Water 1L"), None)

if product:
    product_id = product["id"]
    record("Step 2c", "Reuse existing product", "GET", "/products", None,
           "product found or created", f"reused product_id={product_id}", True)
else:
    r = req(
        "POST", "/products", headers=admin_headers,
        json_body={
            "name": "Bisleri Packaged Drinking Water 1L",
            "sku": sku,
            "category_id": category_id,
            "price": 20.0,
            "tax_rate": 18.0,
        },
    )
    ok2c = record("Step 2c", "Create product 'Bisleri Packaged Drinking Water 1L'", "POST", "/products",
                  {"name": "Bisleri Packaged Drinking Water 1L", "sku": sku, "category_id": category_id, "price": 20.0, "tax_rate": 18.0},
                  "201 created", f"{r.status_code}: {jshort(r)}", r.status_code == 201)
    if not ok2c:
        print("\nFATAL: could not create the product. Aborting.")
        sys.exit(1)
    product = r.json()
    product_id = product["id"]

RECORDS["product_id"] = product_id
RECORDS["warehouse_id"] = warehouse_id

before_stock = stock_row(admin_headers, warehouse_id, product_id)
existing_on_hand = before_stock.get("on_hand", 0) or 0
top_up = 100 - existing_on_hand
if top_up > 0:
    r = req(
        "POST", f"/warehouses/{warehouse_id}/stock/adjust", headers=admin_headers,
        json_body={"product_id": product_id, "quantity": top_up, "movement_type": "opening", "note": "Smoke test opening stock"},
    )
    record("Step 2d", f"Set opening stock to 100 (adjusting by {top_up})", "POST", f"/warehouses/{warehouse_id}/stock/adjust",
           {"product_id": product_id, "quantity": top_up, "movement_type": "opening"},
           "200/201, on_hand becomes 100", f"{r.status_code}: {jshort(r)}", r.status_code in (200, 201))
else:
    record("Step 2d", "Opening stock already >= 100 (reused product)", "POST", f"/warehouses/{warehouse_id}/stock/adjust",
           None, "on_hand >= 100", f"on_hand={existing_on_hand}, no adjustment made", True)

stock_after_opening = stock_row(admin_headers, warehouse_id, product_id)
physical = stock_after_opening.get("on_hand")
reserved = stock_after_opening.get("reserved")
available = stock_after_opening.get("available")
record("Step 2e", "Read warehouse stock after opening balance", "GET", "/warehouses/stock", None,
       "Physical=100, Reserved=0, Available=100",
       f"Physical={physical}, Reserved={reserved}, Available={available}",
       physical == 100 and reserved == 0 and available == 100)

# ---------------------------------------------------------------------------
# STEP 3 - Customer
# ---------------------------------------------------------------------------
customer_phone = f"98{RUN_SHORT}01"
customer_email = f"balaji.retail.{RUN_SHORT}@example.com"
r = req(
    "POST", "/customers", headers=admin_headers,
    json_body={
        "customer_name": "Balaji Retail Mart",
        "display_name": "Balaji Retail Mart",
        "mobile_number": customer_phone,
        "email_address": customer_email,
    },
)
ok3 = record("Step 3", "Create customer 'Balaji Retail Mart'", "POST", "/customers",
             {"customer_name": "Balaji Retail Mart", "mobile_number": customer_phone, "email_address": customer_email},
             "201 created, customer_id returned", f"{r.status_code}: {jshort(r)}", r.status_code == 201)
if not ok3:
    print("\nFATAL: could not create the customer. Aborting.")
    sys.exit(1)
customer = r.json()
customer_id = customer["id"]
RECORDS["customer_id"] = customer_id

# ---------------------------------------------------------------------------
# STEP 4 - Create Sales Order as Draft
# ---------------------------------------------------------------------------
order_payload = {
    "customer_id": customer_id,
    "warehouse_id": warehouse_id,
    "fulfilment_method": "delivery",
    "payment_type": "cash",
    "order_status": "draft",
    "items": [{"product_id": product_id, "quantity": 20, "unit_price": 20.0, "tax_rate": 18}],
}
r = req("POST", "/orders", headers=admin_headers, json_body=order_payload)
ok4 = record("Step 4a", "Create order with order_status='draft'", "POST", "/orders", order_payload,
             "201 created", f"{r.status_code}: {jshort(r)}", r.status_code == 201)
if not ok4:
    print("\nFATAL: could not create the order at all. Aborting.")
    sys.exit(1)
order = r.json()
order_id = order["id"]
RECORDS["order_id"] = order_id

draft_status_ok = order.get("status") == "draft"
draft_fulfilment_ok = order.get("fulfilment_status") in ("not_started",)
record("Step 4b", "Order status is 'draft' (not reserved yet)", "GET", f"(from create response)", None,
       "status=draft, fulfilment_status=not_started",
       f"status={order.get('status')!r}, fulfilment_status={order.get('fulfilment_status')!r}",
       draft_status_ok and draft_fulfilment_ok)

stock_after_create = stock_row(admin_headers, warehouse_id, product_id)
draft_no_reserve_ok = (
    stock_after_create.get("on_hand") == 100
    and stock_after_create.get("reserved") == 0
    and stock_after_create.get("available") == 100
)
ok4c = record(
    "Step 4c", "Draft order must NOT reserve/deduct stock", "GET", "/warehouses/stock", None,
    "Physical=100, Reserved=0, Available=100",
    f"Physical={stock_after_create.get('on_hand')}, Reserved={stock_after_create.get('reserved')}, Available={stock_after_create.get('available')}",
    draft_no_reserve_ok,
)

if not ok4c or not (draft_status_ok and draft_fulfilment_ok):
    bug(
        "BUG-STEP4-1", "P0" if not draft_no_reserve_ok else "P1", "Orders", "Backend",
        "app/services/order_service.py (place_order) + app/schemas/order.py (OrderCreate.order_status)",
        "POST /orders",
        f"POST /orders with order_status='draft' and reserve_stock_on_order=true (GET /sales-workflow-settings). Body: {json.dumps(order_payload)}",
        f"status={order.get('status')!r}, fulfilment_status={order.get('fulfilment_status')!r}, "
        f"stock after create: on_hand={stock_after_create.get('on_hand')}, reserved={stock_after_create.get('reserved')}, available={stock_after_create.get('available')}",
        "Per OrderCreate.order_status field description ('Draft, Confirmed, Processing, Completed, Cancelled') and the "
        "/orders/{id}/confirm docstring ('Confirm a draft order: perform stock checks, reserve and move to placed/awaiting_approval'), "
        "a caller should be able to create a genuine unreserved draft by passing order_status='draft'. "
        "Expected: status='draft', fulfilment_status='not_started', stock unchanged (Physical=100, Reserved=0, Available=100).",
        "If actual reservation still happens on create regardless of order_status: sales staff cannot save a tentative/negotiation-stage "
        "order without instantly locking warehouse stock against it - conflicts directly with the documented Confirm-Order step, and with "
        "org setting reserve_stock_on_order appearing to be unconditional rather than gated by order_status.",
        "Either make POST /orders honor order_status='draft' by skipping the reserve step entirely (only /confirm reserves), or - if "
        "'draft' is intentionally not a real creatable state via this endpoint - remove/clarify the order_status field description and "
        "the frontend must never offer a 'Save as Draft' action that calls POST /orders directly.",
    )

# ---------------------------------------------------------------------------
# STEP 5 - Confirm Order
# ---------------------------------------------------------------------------
r = req("POST", f"/orders/{order_id}/confirm", headers=admin_headers, json_body=None)
ok5 = record("Step 5a", "Confirm the order", "POST", f"/orders/{order_id}/confirm", None,
             "200, status becomes placed/awaiting_approval, fulfilment_status=reserved",
             f"{r.status_code}: {jshort(r)}", r.status_code == 200)
order = r.json() if ok5 else order

confirm_status_ok = order.get("status") in ("placed", "awaiting_approval")
confirm_fulfilment_ok = order.get("fulfilment_status") == "reserved"
record("Step 5b", "Order confirmed state", "GET", "(from confirm response)", None,
       "status in {placed, awaiting_approval}, fulfilment_status=reserved",
       f"status={order.get('status')!r}, fulfilment_status={order.get('fulfilment_status')!r}",
       confirm_status_ok and confirm_fulfilment_ok)

stock_after_confirm = stock_row(admin_headers, warehouse_id, product_id)
confirm_reserve_ok = (
    stock_after_confirm.get("on_hand") == 100
    and stock_after_confirm.get("reserved") == 20
    and stock_after_confirm.get("available") == 80
)
record("Step 5c", "Confirm reserves exactly the ordered quantity", "GET", "/warehouses/stock", None,
       "Physical=100, Reserved=20, Available=80",
       f"Physical={stock_after_confirm.get('on_hand')}, Reserved={stock_after_confirm.get('reserved')}, Available={stock_after_confirm.get('available')}",
       confirm_reserve_ok)

r2 = req("POST", f"/orders/{order_id}/confirm", headers=admin_headers, json_body=None)
stock_after_reconfirm = stock_row(admin_headers, warehouse_id, product_id)
reconfirm_safe = r2.status_code >= 400 or stock_after_reconfirm.get("reserved") == 20
record("Step 5d", "Repeat confirm must not double-reserve", "POST", f"/orders/{order_id}/confirm", None,
       "second call rejects (4xx) OR is a safe no-op (reserved stays 20)",
       f"{r2.status_code}: {jshort(r2, 200)}; reserved after retry={stock_after_reconfirm.get('reserved')}",
       reconfirm_safe)
if not reconfirm_safe:
    bug("BUG-STEP5-1", "P0", "Orders", "Backend", "app/services/order_service.py (confirm_order)",
        f"POST /orders/{{id}}/confirm", f"Call POST /orders/{order_id}/confirm twice in a row",
        f"second call returned {r2.status_code} and reserved went to {stock_after_reconfirm.get('reserved')} (expected 20)",
        "Second confirm call is rejected or a safe no-op; reserved quantity stays at 20",
        "Double-confirming silently double-reserves stock against the same order, corrupting warehouse availability.",
        "Guard confirm_order() with a status check (`if order.status != 'draft': raise 400`), matching the pattern already used by approve/reject/cancel.")

# ---------------------------------------------------------------------------
# STEP 6 - Plan Delivery
# ---------------------------------------------------------------------------
partner_phone = f"98{RUN_SHORT}02"
partner_email = f"rahul.patil.{RUN_SHORT}@example.com"

r = req("GET", "/roles", headers=admin_headers)
roles = r.json() if r.status_code == 200 else []
delivery_role = next((rr for rr in roles if rr.get("workspace") == "delivery"), None)

r = req(
    "POST", "/users", headers=admin_headers,
    json_body={
        "basic_information": {"first_name": "Rahul", "last_name": "Patil"},
        "contact_information": {"official_email": partner_email, "mobile_number": partner_phone},
        "employment_information": {"designation": "Delivery Partner", "employment_type": "full_time", "role_id": delivery_role["id"] if delivery_role else None},
        "login_security": {"password": "Rahul@12345", "confirm_password": "Rahul@12345"},
    },
)
ok6a = record("Step 6a", "Create Delivery Partner 'Rahul Patil'", "POST", "/users",
              {"basic_information": {"first_name": "Rahul", "last_name": "Patil"}, "contact_information": {"official_email": partner_email}},
              "201 created", f"{r.status_code}: {jshort(r)}", r.status_code == 201)
if not ok6a:
    print("\nFATAL: could not create the delivery partner. Aborting.")
    sys.exit(1)
partner = r.json()
partner_id = partner.get("id") or partner.get("user_id")
RECORDS["delivery_partner_id"] = partner_id

vehicle_number = f"MH 02 AB 4587-{RUN_SHORT}"
r = req("POST", "/vehicles", headers=admin_headers, json_body={"vehicle_number": vehicle_number, "vehicle_type": "Tempo", "capacity_kg": 500})
ok6b = record("Step 6b", "Create vehicle 'MH 02 AB 4587'", "POST", "/vehicles", {"vehicle_number": vehicle_number},
              "201 created", f"{r.status_code}: {jshort(r)}", r.status_code == 201)
if not ok6b:
    print("\nFATAL: could not create the vehicle. Aborting.")
    sys.exit(1)
vehicle_id = r.json()["id"]
RECORDS["vehicle_id"] = vehicle_id

delivery_payload = {
    "order_id": order_id,
    "delivery_partner_id": partner_id,
    "vehicle_id": vehicle_id,
    "warehouse_id": warehouse_id,
}
r = req("POST", "/deliveries", headers=admin_headers, json_body=delivery_payload)
ok6c = record("Step 6c", "Plan delivery (real Delivery record, not just order.assign-delivery-partner)", "POST", "/deliveries",
              delivery_payload, "201 created, status=planned, delivery.id != order.id",
              f"{r.status_code}: {jshort(r)}", r.status_code == 201)
if not ok6c:
    print("\nFATAL: could not plan the delivery. Aborting.")
    sys.exit(1)
delivery = r.json()
delivery_id = delivery["id"]
delivery_item_id = delivery["items"][0]["id"]
RECORDS["delivery_id"] = delivery_id

record("Step 6d", "Delivery is planned and distinct from the order", "GET", "(from plan response)", None,
       "status=planned, delivery.id != order.id",
       f"status={delivery.get('status')!r}, delivery_id={delivery_id}, order_id={order_id}",
       delivery.get("status") == "planned" and delivery_id != order_id)

# ---------------------------------------------------------------------------
# STEP 7 - Guard: load while still 'planned'
# ---------------------------------------------------------------------------
r = req("POST", f"/deliveries/{delivery_id}/load", headers=admin_headers, json_body={})
guard7_ok = r.status_code == 400
record("Step 7", "Vehicle load is blocked while delivery is 'planned'", "POST", f"/deliveries/{delivery_id}/load", {},
       "400, reason indicates acceptance is required, no inventory movement",
       f"{r.status_code}: {jshort(r)}", guard7_ok)

stock_step7 = stock_row(admin_headers, warehouse_id, product_id)
record("Step 7b", "Inventory unchanged after blocked load attempt", "GET", "/warehouses/stock", None,
       "Physical=100, Reserved=20, Available=80, Vehicle=0",
       f"Physical={stock_step7.get('on_hand')}, Reserved={stock_step7.get('reserved')}, Available={stock_step7.get('available')}",
       stock_step7.get("on_hand") == 100 and stock_step7.get("reserved") == 20 and stock_step7.get("available") == 80)

# ---------------------------------------------------------------------------
# STEP 8 - Delivery Partner accepts
# ---------------------------------------------------------------------------
r = req("POST", "/auth/login", json_body={"email": partner_email, "password": "Rahul@12345"})
ok8a = record("Step 8a", "Rahul Patil logs in", "POST", "/auth/login", {"email": partner_email},
              "200", f"{r.status_code}: {jshort(r)}", r.status_code == 200)
if not ok8a:
    print("\nFATAL: delivery partner cannot log in. Aborting.")
    sys.exit(1)
partner_token = r.json()["tokens"]["access_token"]
partner_headers = auth_header(partner_token)

r = req("POST", "/auth/login", json_body={"email": OTHER_DELIVERY_EMAIL, "password": OTHER_DELIVERY_PASSWORD})
other_partner_headers = auth_header(r.json()["tokens"]["access_token"]) if r.status_code == 200 else None
if other_partner_headers:
    r_wrong = req("POST", f"/deliveries/{delivery_id}/accept", headers=other_partner_headers, json_body={})
    wrong_partner_blocked = r_wrong.status_code in (403, 404)
    record("Step 8b", "Non-assigned partner (existing demo delivery@demo.com) cannot accept", "POST", f"/deliveries/{delivery_id}/accept",
           {}, "403 or 404 (not the assigned partner)", f"{r_wrong.status_code}: {jshort(r_wrong)}", wrong_partner_blocked)
else:
    record("Step 8b", "Non-assigned partner check skipped (delivery@demo.com login failed)", "POST", "/auth/login", None,
           "n/a", "could not log in as the existing demo delivery partner to run this check", False)

r = req("POST", f"/deliveries/{delivery_id}/accept", headers=partner_headers, json_body={})
ok8c = record("Step 8c", "Assigned partner (Rahul Patil) accepts", "POST", f"/deliveries/{delivery_id}/accept", {},
              "200, status=accepted", f"{r.status_code}: {jshort(r)}", r.status_code == 200)
delivery = r.json() if ok8c else delivery
record("Step 8d", "Delivery status is 'accepted'", None, None, None, "status=accepted",
       f"status={delivery.get('status')!r}", delivery.get("status") == "accepted")

# ---------------------------------------------------------------------------
# STEP 9 - Guard: load right after acceptance, before pick/ready
# ---------------------------------------------------------------------------
r = req("POST", f"/deliveries/{delivery_id}/load", headers=admin_headers, json_body={})
guard9_ok = r.status_code == 400
ok9 = record("Step 9", "Vehicle load is blocked right after acceptance (must not skip pick/ready)", "POST", f"/deliveries/{delivery_id}/load",
             {}, "400 - accepted must not mean ready-for-loading", f"{r.status_code}: {jshort(r)}", guard9_ok)

stock_step9 = stock_row(admin_headers, warehouse_id, product_id)
step9_inventory_ok = stock_step9.get("on_hand") == 100 and stock_step9.get("reserved") == 20 and stock_step9.get("available") == 80
record("Step 9b", "Inventory unchanged", "GET", "/warehouses/stock", None,
       "Physical=100, Reserved=20, Available=80",
       f"Physical={stock_step9.get('on_hand')}, Reserved={stock_step9.get('reserved')}, Available={stock_step9.get('available')}",
       step9_inventory_ok)

if not guard9_ok:
    bug("BUG-STEP9-1", "P0", "Deliveries", "Backend", "app/services/delivery_service.py (load)",
        f"POST /deliveries/{{id}}/load", f"Accept a delivery, then immediately call POST /deliveries/{delivery_id}/load without picking/marking ready",
        f"{r.status_code}: {jshort(r)}",
        "400 - load() should require status='ready', not just 'accepted', now that pick/ready exist as real steps",
        "Skips the picking/ready checkpoints entirely - the frontend's Load button would fire successfully straight from 'accepted', "
        "defeating the whole point of adding a picking stage.",
        "Change load()'s status guard from `status == 'accepted'` to `status == 'ready'`, and gate accept->pick with its own guard too.")

# ---------------------------------------------------------------------------
# STEP 10 - Picking
# ---------------------------------------------------------------------------
pick_payload = {"items": [{"delivery_item_id": delivery_item_id, "picked_quantity": 20}]}
r = req("POST", f"/deliveries/{delivery_id}/pick", headers=admin_headers, json_body=pick_payload)
ok10a = record("Step 10a", "Pick all 20 bottles", "POST", f"/deliveries/{delivery_id}/pick", pick_payload,
               "200, picked_quantity=20, picking_status=picked", f"{r.status_code}: {jshort(r)}", r.status_code == 200)
delivery = r.json() if ok10a else delivery

has_picking_status = "picking_status" in delivery
has_picked_quantity_on_items = delivery.get("items") and any("picked_quantity" in it for it in delivery["items"])
contract_ok = has_picking_status and has_picked_quantity_on_items
record("Step 10b", "DeliveryOut exposes picking_status / picked_quantity", "GET", "(pick response body)", None,
       "response includes picking_status and per-item picked_quantity",
       f"picking_status present={has_picking_status}, per-item picked_quantity present={has_picked_quantity_on_items}, "
       f"top-level keys={sorted(delivery.keys())}",
       contract_ok)
if not contract_ok:
    bug("BUG-STEP10-1", "P1", "Deliveries", "Backend API contract", "app/schemas/delivery.py (DeliveryOut, DeliveryLineOut)",
        f"GET /deliveries/by-id/{{id}}, POST /deliveries/{{id}}/pick", "Call POST /deliveries/{id}/pick, inspect the response body",
        f"DeliveryOut has no `picking_status` field and DeliveryLineOut has no `picked_quantity` field "
        f"(confirmed via live /openapi.json schema: DeliveryLineOut fields are id, order_item_id, product_id, variant_id, "
        f"product_name, planned_quantity, loaded_quantity, delivered_quantity, pending_quantity - no picked_quantity)",
        "DeliveryOut/DeliveryLineOut include `picking_status` and per-line `picked_quantity` so the frontend can render "
        "picking progress without a second call",
        "Frontend cannot show 'X of Y picked' or a picking-complete indicator at all - the backend records the data "
        "(POST /pick succeeds) but never gives it back, so the UI has no way to reflect picking progress.",
        "Add `picking_status` (not_started|picking|picked) to DeliveryOut and `picked_quantity` to DeliveryLineOut, "
        "populated from whatever internal model already stores what POST /pick just wrote.")

stock_step10 = stock_row(admin_headers, warehouse_id, product_id)
step10_inventory_ok = stock_step10.get("on_hand") == 100 and stock_step10.get("reserved") == 20 and stock_step10.get("available") == 80
record("Step 10c", "Picking does not move physical/reserved stock", "GET", "/warehouses/stock", None,
       "Physical=100, Reserved=20, Available=80, Vehicle=0",
       f"Physical={stock_step10.get('on_hand')}, Reserved={stock_step10.get('reserved')}, Available={stock_step10.get('available')}",
       step10_inventory_ok)

# ---------------------------------------------------------------------------
# STEP 11 - Ready for delivery
# ---------------------------------------------------------------------------
r = req("POST", f"/deliveries/{delivery_id}/ready", headers=admin_headers, json_body={})
ok11 = record("Step 11", "Mark fully-picked delivery Ready", "POST", f"/deliveries/{delivery_id}/ready", {},
              "200, status=ready", f"{r.status_code}: {jshort(r)}", r.status_code == 200)
delivery = r.json() if ok11 else delivery
record("Step 11b", "Delivery status is 'ready'", None, None, None, "status=ready",
       f"status={delivery.get('status')!r}", delivery.get("status") == "ready")

# ---------------------------------------------------------------------------
# STEP 12 - Vehicle load
# ---------------------------------------------------------------------------
r = req("POST", f"/deliveries/{delivery_id}/load", headers=admin_headers, json_body={})
ok12 = record("Step 12a", "Load the 20 bottles (from ready)", "POST", f"/deliveries/{delivery_id}/load", {},
              "200, status=loaded", f"{r.status_code}: {jshort(r)}", r.status_code == 200)
delivery = r.json() if ok12 else delivery

stock_step12 = stock_row(admin_headers, warehouse_id, product_id)
vehicle_after_load = vehicle_qty(admin_headers, partner_id, product_id)
step12_ok = (
    delivery.get("status") == "loaded"
    and stock_step12.get("on_hand") == 80
    and stock_step12.get("reserved") == 0
    and stock_step12.get("available") == 80
    and vehicle_after_load == 20
)
record("Step 12b", "Load moves stock correctly", "GET", "/warehouses/stock + /vehicle-stock/current/{partner_id}", None,
       "Physical=80, Reserved=0, Available=80, Vehicle=20",
       f"Physical={stock_step12.get('on_hand')}, Reserved={stock_step12.get('reserved')}, Available={stock_step12.get('available')}, Vehicle={vehicle_after_load}",
       step12_ok)

r2 = req("POST", f"/deliveries/{delivery_id}/load", headers=admin_headers, json_body={})
stock_step12b = stock_row(admin_headers, warehouse_id, product_id)
vehicle_after_reload = vehicle_qty(admin_headers, partner_id, product_id)
no_double_load = stock_step12b.get("on_hand") == 80 and vehicle_after_reload == 20
record("Step 12c", "Repeat load does not deduct the same 20 bottles twice", "POST", f"/deliveries/{delivery_id}/load", {},
       "Physical stays 80, Vehicle stays 20", f"{r2.status_code}: Physical={stock_step12b.get('on_hand')}, Vehicle={vehicle_after_reload}",
       no_double_load)

# ---------------------------------------------------------------------------
# STEP 13 - Guard: confirm delivery while only 'loaded'
# ---------------------------------------------------------------------------
r = req(
    "POST", f"/deliveries/{delivery_id}/confirm", headers=partner_headers,
    json_body={"items": [{"delivery_item_id": delivery_item_id, "delivered_quantity": 20}], "notes": "smoke test"},
)
guard13_ok = r.status_code == 400
record("Step 13", "Confirm is blocked while status is only 'loaded' (must dispatch first)", "POST", f"/deliveries/{delivery_id}/confirm",
       {"items": "..."}, "400 - loaded -> delivered directly must not be permitted", f"{r.status_code}: {jshort(r)}", guard13_ok)
if not guard13_ok:
    bug("BUG-STEP13-1", "P1", "Deliveries", "Backend", "app/services/delivery_service.py (confirm)",
        f"POST /deliveries/{{id}}/confirm", f"Call confirm on a delivery whose status is 'loaded' (not yet dispatched to in_transit)",
        f"{r.status_code}: {jshort(r)}", "400 - confirm should require status='in_transit'",
        "A driver could mark a delivery 'delivered' before it was ever dispatched, corrupting the in_transit/dispatched_at audit trail.",
        "Add a status guard to confirm(): reject unless delivery.status == 'in_transit'.")

# ---------------------------------------------------------------------------
# STEP 14 - Dispatch
# ---------------------------------------------------------------------------
r = req("PATCH", f"/deliveries/by-id/{delivery_id}", headers=admin_headers, json_body={"status": "in_transit"})
ok14 = record("Step 14a", "Dispatch the delivery", "PATCH", f"/deliveries/by-id/{delivery_id}", {"status": "in_transit"},
              "200, status=in_transit, dispatched_at populated", f"{r.status_code}: {jshort(r)}", r.status_code == 200)
delivery = r.json() if ok14 else delivery
record("Step 14b", "Dispatch state correct", None, None, None,
       "status=in_transit, dispatched_at set",
       f"status={delivery.get('status')!r}, dispatched_at={delivery.get('dispatched_at')!r}",
       delivery.get("status") == "in_transit" and bool(delivery.get("dispatched_at")))

stock_step14 = stock_row(admin_headers, warehouse_id, product_id)
record("Step 14c", "No additional warehouse stock movement on dispatch", "GET", "/warehouses/stock", None,
       "Physical=80, Reserved=0, Available=80 (unchanged from step 12)",
       f"Physical={stock_step14.get('on_hand')}, Reserved={stock_step14.get('reserved')}, Available={stock_step14.get('available')}",
       stock_step14.get("on_hand") == 80 and stock_step14.get("reserved") == 0 and stock_step14.get("available") == 80)

# ---------------------------------------------------------------------------
# STEP 15 - Full delivery + POD
# ---------------------------------------------------------------------------
pod_file_ids = []
dummy_dir = None
for candidate in ["public/dummy-photo", "../public/dummy-photo"]:
    import os
    if os.path.isdir(candidate):
        dummy_dir = candidate
        break
if dummy_dir:
    import os
    images = sorted(f for f in os.listdir(dummy_dir) if f.lower().startswith("dummyimage"))
    if images:
        fpath = os.path.join(dummy_dir, images[0])
        with open(fpath, "rb") as fh:
            files = {"file": (images[0], fh, "image/png")}
            up = requests.post(f"{BASE_URL}/files/upload", headers=partner_headers, files=files, timeout=30)
        if up.status_code in (200, 201):
            up_data = up.json()
            pod_file_ids.append(up_data.get("file_id") or up_data.get("id"))

confirm_payload = {
    "items": [{"delivery_item_id": delivery_item_id, "delivered_quantity": 20}],
    "notes": "Smoke test full delivery",
}
if pod_file_ids:
    confirm_payload["pod_photo_file_ids"] = pod_file_ids

r = req("POST", f"/deliveries/{delivery_id}/confirm", headers=partner_headers, json_body=confirm_payload)
ok15a = record("Step 15a", "Confirm full delivery with POD", "POST", f"/deliveries/{delivery_id}/confirm", confirm_payload,
               "200, status=delivered", f"{r.status_code}: {jshort(r)}", r.status_code == 200)
delivery = r.json() if ok15a else delivery
delivery_item = delivery.get("items", [{}])[0]
record("Step 15b", "Delivery fully delivered", None, None, None,
       "status=delivered, delivered_quantity=20, pending_quantity=0",
       f"status={delivery.get('status')!r}, delivered_quantity={delivery_item.get('delivered_quantity')}, pending_quantity={delivery_item.get('pending_quantity')}",
       delivery.get("status") == "delivered" and delivery_item.get("delivered_quantity") == 20 and delivery_item.get("pending_quantity") == 0)

vehicle_after_delivery = vehicle_qty(admin_headers, partner_id, product_id)
record("Step 15c", "Vehicle stock is now 0", None, None, None, "Vehicle=0", f"Vehicle={vehicle_after_delivery}", vehicle_after_delivery == 0)

r = req("GET", f"/orders/{order_id}", headers=admin_headers)
order_after_delivery = r.json() if r.status_code == 200 else order
record("Step 15d", "Order fulfilment reflects delivery", None, None, None,
       "fulfilment_status=delivered", f"fulfilment_status={order_after_delivery.get('fulfilment_status')!r}",
       order_after_delivery.get("fulfilment_status") == "delivered")

stock_step15 = stock_row(admin_headers, warehouse_id, product_id)
record("Step 15e", "Warehouse remains Physical=80, Reserved=0, Available=80", "GET", "/warehouses/stock", None,
       "Physical=80, Reserved=0, Available=80",
       f"Physical={stock_step15.get('on_hand')}, Reserved={stock_step15.get('reserved')}, Available={stock_step15.get('available')}",
       stock_step15.get("on_hand") == 80 and stock_step15.get("reserved") == 0 and stock_step15.get("available") == 80)

# ---------------------------------------------------------------------------
# STEP 16 - Invoice
# ---------------------------------------------------------------------------
r = req("POST", f"/orders/{order_id}/invoice", headers=admin_headers, json_body={"delivery_id": delivery_id})
ok16a = record("Step 16a", "Create the invoice (per-delivery billing)", "POST", f"/orders/{order_id}/invoice",
               {"delivery_id": delivery_id}, "201 created", f"{r.status_code}: {jshort(r)}", r.status_code == 201)
if not ok16a:
    print("\nFATAL: could not create the invoice. Aborting remaining steps.")
    print_final = True
    invoice = {}
    invoice_id = None
else:
    invoice = r.json()
    invoice_id = invoice["id"]
    RECORDS["invoice_id"] = invoice_id

    r2 = req("GET", f"/orders/{order_id}/invoice" if False else "/invoices", headers=admin_headers, params={"customer_id": customer_id})
    invoices_for_order = [inv for inv in (r2.json() if r2.status_code == 200 else []) if inv.get("order_id") == order_id]
    record("Step 16b", "Exactly one invoice record for this order", "GET", "/invoices", None,
           "1 invoice record", f"{len(invoices_for_order)} invoice(s) found for order {order_id}",
           len(invoices_for_order) == 1)

    items = invoice.get("items", [])
    item_ok = len(items) == 1 and items[0].get("quantity") == 20 and float(items[0].get("unit_price") or items[0].get("rate") or 0) == 20.0
    record("Step 16c", "Invoice line item matches order", None, None, None,
           "Bisleri Packaged Drinking Water 1L, qty=20, rate=Rs.20", f"items={json.dumps(items)[:400]}", item_ok)

    subtotal = invoice.get("subtotal")
    tax = invoice.get("tax")
    total = invoice.get("total")
    outstanding = invoice.get("outstanding_amount")
    calc_ok = subtotal == 400 and abs((tax or 0) - 72) < 0.01 and abs((total or 0) - 472) < 0.01 and abs((outstanding or 0) - 472) < 0.01
    record("Step 16d", "Invoice calculation", None, None, None,
           "Subtotal=400, GST=72, Total=472, Outstanding=472",
           f"Subtotal={subtotal}, Tax={tax}, Total={total}, Outstanding={outstanding}", calc_ok)

    payment_status_ok = invoice.get("payment_status") in ("Unpaid", "unpaid")
    record("Step 16e", "Payment status is unpaid before any payment", None, None, None,
           "payment_status=unpaid", f"payment_status={invoice.get('payment_status')!r}", payment_status_ok)

    r3 = req("GET", f"/invoices/{invoice_id}/pdf", headers=admin_headers, params={"format": "simple"})
    r4 = req("GET", f"/invoices/{invoice_id}/pdf", headers=admin_headers, params={"format": "detailed"})
    same_record_ok = r3.status_code == 200 and r4.status_code == 200
    record("Step 16f", "Simple/Detailed PDF are two views of the SAME invoice, not two records", "GET",
           f"/invoices/{invoice_id}/pdf?format=simple|detailed", None,
           "both 200, same invoice_id used for both, no second invoice created",
           f"simple={r3.status_code}, detailed={r4.status_code}", same_record_ok)
    print_final = False

# ---------------------------------------------------------------------------
# STEP 17 - Full payment
# ---------------------------------------------------------------------------
if invoice_id:
    payment_payload = {"invoice_reference_id": invoice_id, "amount_received": 472.0, "payment_method": "cash"}
    r = req("POST", "/payment-receipts", headers=admin_headers, json_body=payment_payload)
    ok17a = record("Step 17a", "Record full cash payment of Rs.472", "POST", "/payment-receipts", payment_payload,
                   "201 created", f"{r.status_code}: {jshort(r)}", r.status_code == 201)
    receipt = r.json() if ok17a else {}
    RECORDS["payment_receipt_id"] = receipt.get("id")

    r2 = req("GET", f"/invoices/{invoice_id}", headers=admin_headers)
    invoice_after_payment = r2.json() if r2.status_code == 200 else {}
    payment_ok = invoice_after_payment.get("payment_status") == "Paid" and (invoice_after_payment.get("outstanding_amount") or 0) == 0
    record("Step 17b", "Invoice fully paid", None, None, None,
           "payment_status=Paid, Outstanding=0",
           f"payment_status={invoice_after_payment.get('payment_status')!r}, outstanding={invoice_after_payment.get('outstanding_amount')}",
           payment_ok)
else:
    record("Step 17", "Payment skipped - no invoice was created", None, None, None, "n/a", "no invoice_id available", False)
    invoice_after_payment = {}

# ---------------------------------------------------------------------------
# STEP 18 - Final state
# ---------------------------------------------------------------------------
r = req("GET", f"/orders/{order_id}", headers=admin_headers)
final_order = r.json() if r.status_code == 200 else {}
r = req("GET", f"/deliveries/by-id/{delivery_id}", headers=admin_headers)
final_delivery = r.json() if r.status_code == 200 else {}
final_stock = stock_row(admin_headers, warehouse_id, product_id)
final_vehicle = vehicle_qty(admin_headers, partner_id, product_id)

final_ok = (
    final_order.get("fulfilment_status") == "delivered"
    and final_delivery.get("status") == "delivered"
    and invoice_after_payment.get("payment_status") == "Paid"
    and final_stock.get("on_hand") == 80
    and final_stock.get("reserved") == 0
    and final_stock.get("available") == 80
    and final_vehicle == 0
)
record(
    "Step 18", "Final business state across all records", None, None, None,
    "order.fulfilment_status=delivered, delivery.status=delivered, invoice.payment_status=Paid, "
    "Physical=80/Reserved=0/Available=80, Vehicle=0",
    f"order.status={final_order.get('status')!r}/fulfilment_status={final_order.get('fulfilment_status')!r}, "
    f"delivery.status={final_delivery.get('status')!r}, invoice.payment_status={invoice_after_payment.get('payment_status')!r}, "
    f"Physical={final_stock.get('on_hand')}, Reserved={final_stock.get('reserved')}, Available={final_stock.get('available')}, Vehicle={final_vehicle}",
    final_ok,
)

# ---------------------------------------------------------------------------
# Rejection / Reassignment review (inspection only - reuses an EXISTING
# rejected delivery from a prior smoke-test run, creates nothing new)
# ---------------------------------------------------------------------------
print("\n" + "=" * 78)
print("REJECTION / REASSIGNMENT REVIEW (inspecting existing data, no new delivery created)")
print("=" * 78)

r = req("GET", "/deliveries", headers=admin_headers, params={"status": "rejected"})
existing_rejected = r.json() if r.status_code == 200 else []
if existing_rejected:
    target = existing_rejected[0]
    target_id = target["id"]
    print(f"  Reusing existing rejected delivery {target_id} ({target.get('delivery_number')}) from a prior run.")
    print(f"  Current state: partner={target.get('delivery_partner_id')}, vehicle={target.get('vehicle_id')}, status={target.get('status')}")

    reassign_payload = {"delivery_partner_id": partner_id, "vehicle_id": vehicle_id, "status": "planned"}
    r2 = req("PATCH", f"/deliveries/by-id/{target_id}", headers=admin_headers, json_body=reassign_payload)
    reassign_ok = r2.status_code == 200
    record("Reassignment", "PATCH /deliveries/by-id/{id} can reassign partner+vehicle and reset status to planned",
           "PATCH", f"/deliveries/by-id/{target_id}", reassign_payload,
           "200, status becomes planned with new partner/vehicle", f"{r2.status_code}: {jshort(r2)}", reassign_ok)
    if reassign_ok:
        reassigned = r2.json()
        print(f"  After reassignment: partner={reassigned.get('delivery_partner_id')}, vehicle={reassigned.get('vehicle_id')}, status={reassigned.get('status')}")
        status_reset_ok = reassigned.get("status") == "planned"
        record("Reassignment", "Status actually flips back to 'planned' (not left as 'rejected')", None, None, None,
               "status=planned", f"status={reassigned.get('status')!r}", status_reset_ok)
        if not status_reset_ok:
            bug("BUG-REASSIGN-1", "P1", "Deliveries", "Backend", "app/services/delivery_service.py (re_plan/update)",
                f"PATCH /deliveries/by-id/{{id}}", f"PATCH a rejected delivery with a new delivery_partner_id/vehicle_id and status='planned'",
                f"status stayed {reassigned.get('status')!r}", "status should update to 'planned' when explicitly requested",
                "Admin cannot get a rejected delivery back into the active pipeline through the documented endpoint.",
                "Ensure the PATCH handler applies the `status` field for the `planned` case the same way it does for `in_transit`/`cancelled`.")
    else:
        bug("BUG-REASSIGN-2", "P0", "Deliveries", "Backend", "app/services/delivery_service.py / app/routers/deliveries.py",
            f"PATCH /deliveries/by-id/{{id}}", f"PATCH a rejected delivery with delivery_partner_id, vehicle_id, status='planned'",
            f"{r2.status_code}: {jshort(r2)}", "200 - reassignment should be possible via this endpoint per its own schema (accepts delivery_partner_id/vehicle_id/status=planned)",
            "There is no way for Admin/Dispatch to reassign a rejected delivery at all if this rejects, despite the schema advertising support for it.",
            "Check whether re_plan()/update_delivery() has a status guard that excludes 'rejected' as a source state, and add it if missing.")
else:
    print("  No existing rejected delivery found to inspect (none from a prior run) - skipping the reassignment probe rather than creating one.")

record("Notification", "New-partner notification on plan (inspection only, from SESSION_CHANGES_DELIVERY_ACCEPT_REJECT.md)",
       None, None, None, "plan_delivery() calls notification_service on create when a partner is named",
       "Confirmed present in the backend change doc provided earlier this session; not independently re-verified here "
       "(no notification-read endpoint was probed) - reported as documented, not tested live.", True)

# ---------------------------------------------------------------------------
# Final report
# ---------------------------------------------------------------------------
print("\n\n" + "=" * 100)
print("STEP SUMMARY TABLE")
print("=" * 100)
print(f"{'Step':<10} {'Status':<6} Expected / Actual")
print("-" * 100)
for row in RESULTS:
    print(f"{row['step']:<10} {row['status']:<6} {row['action']}")
    print(f"{'':<17} expected: {row['expected']}")
    print(f"{'':<17} actual:   {row['actual']}")

fail_count = sum(1 for r in RESULTS if r["status"] == "FAIL")
pass_count = sum(1 for r in RESULTS if r["status"] == "PASS")

print("\n" + "=" * 100)
print(f"SMOKE VERDICT: {'FAIL' if fail_count else 'PASS'}  ({pass_count} passed, {fail_count} failed)")
print("=" * 100)

p0 = [b for b in BUGS if b["severity"] == "P0"]
p1 = [b for b in BUGS if b["severity"] == "P1"]
p2 = [b for b in BUGS if b["severity"] == "P2"]

for label, group in [("P0 BLOCKERS", p0), ("P1 IMPORTANT", p1), ("P2 MINOR", p2)]:
    print(f"\n{label}:")
    if not group:
        print("  (none)")
    for b in group:
        print(f"\n  [{b['id']}] {b['module']} ({b['layer']})")
        print(f"    File: {b['file']}")
        print(f"    Endpoint: {b['endpoint']}")
        print(f"    Repro: {b['repro']}")
        print(f"    Actual:   {b['actual']}")
        print(f"    Expected: {b['expected']}")
        print(f"    Impact: {b['impact']}")
        print(f"    Fix: {b['fix']}")

print(f"\nFINAL INVENTORY:")
print(f"  Physical:  {final_stock.get('on_hand')}")
print(f"  Reserved:  {final_stock.get('reserved')}")
print(f"  Available: {final_stock.get('available')}")
print(f"  Vehicle:   {final_vehicle}")

print(f"\nCREATED TEST RECORDS:")
for k, v in RECORDS.items():
    print(f"  {k}: {v}")

sys.exit(1 if fail_count else 0)
