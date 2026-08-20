r"""
End-to-end smoke test - ONE realistic sales flow, real product/customer names.

HTTP version: runs against the LIVE backend (default: the deployed Render
instance) over plain `requests` calls, logging into the org's existing demo
Admin account. There is no backend source tree in this workspace, so this
does NOT boot the FastAPI app in-process or touch a local/throwaway DB -
every record it creates is a real record in the real dev org, prefixed with
a unique run id so reruns never collide with previous runs or with other
demo/E2E data.

Flow tested (matches the documented Order -> Delivery -> Invoice -> Payment
flow, including the 2026-08-18 delivery Accept/Reject gate):

    1. Login as Admin (existing demo org)
    2. Create a warehouse
    3. Create 2 products: Bisleri Water Bottle 1L, Balaji Wafers 150g
    4. Add opening stock for both products IN THAT WAREHOUSE
    5. Create a Sales Officer staff account
    6. Create a Delivery Partner staff account
    7. Create a vehicle
    8. Create a customer: Sharma General Store
    9. Sales Officer places a Sales Order (both products) for that customer
       -> stock reserved, order status = placed
   10. Admin plans a Delivery for the order, assigns the Delivery Partner + vehicle
       -> delivery status = planned
   11. Delivery Partner ACCEPTS the delivery (new gate: load() 400s until this
       happens) -> delivery status = accepted
   12. Vehicle is loaded with the planned quantities
       -> warehouse stock decreases, delivery = loaded
   13. Delivery is dispatched -> delivery = in_transit
   14. Delivery Partner confirms full delivery with POD
       -> delivery = delivered, order.fulfilment_status = delivered
   15. Invoice is generated from the order (bills delivered quantity)
   16. Full payment is recorded against the invoice
       -> invoice status = paid, outstanding = 0
   17. (Bonus) Reject-path check on a second delivery: a partner who isn't
       assigned cannot accept (403); the assigned partner rejects with a
       reason -> partner/vehicle cleared, admin can see it via ?status=rejected

Run with:
    python scripts/test_smoke_realflow.py

Reads credentials from environment variables (falls back to the seeded demo
defaults used elsewhere in scripts/):
    SMOKE_API_BASE_URL, SMOKE_ADMIN_EMAIL, SMOKE_ADMIN_PASSWORD

Prints a step-by-step PASS/FAIL log as it runs. Exits non-zero on the first
category of failure so CI/manual runs fail loudly instead of silently.
"""

import os
import sys
from datetime import datetime

import requests

BASE_URL = os.environ.get("SMOKE_API_BASE_URL", "https://crm-saas-backend-9nom.onrender.com").rstrip("/")
ADMIN_EMAIL = os.environ.get("SMOKE_ADMIN_EMAIL", "admin@demo.com")
ADMIN_PASSWORD = os.environ.get("SMOKE_ADMIN_PASSWORD", "Admin@123")
RUN_ID = datetime.now().strftime("SMOKE-%Y%m%d-%H%M%S")
RUN_SHORT = datetime.now().strftime("%H%M%S")

FAILURES = []


def step(label):
    print(f"\n{'=' * 70}\nSTEP: {label}\n{'=' * 70}")


def check(condition, message):
    status_tag = "PASS" if condition else "FAIL"
    print(f"  [{status_tag}] {message}")
    if not condition:
        FAILURES.append(message)
    return condition


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def req(method, path, headers=None, json_body=None, params=None):
    return requests.request(method, f"{BASE_URL}{path}", headers=headers, json=json_body, params=params, timeout=30)


def body_preview(resp, limit=250):
    try:
        return str(resp.json())[:limit]
    except Exception:
        return resp.text[:limit]


# ---------------------------------------------------------------------------
step("1. Login as Admin (existing demo org)")
# ---------------------------------------------------------------------------
resp = req("POST", "/auth/login", json_body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
if not check(resp.status_code == 200, f"Admin login succeeds (got {resp.status_code}: {body_preview(resp)})"):
    print("\nCannot continue without an authenticated admin session. Exiting.")
    sys.exit(1)

admin_token = resp.json()["tokens"]["access_token"]
admin_headers = auth_header(admin_token)

me = req("GET", "/auth/me", headers=admin_headers).json()
org_id = me["organization"]["id"]
check(me["full_access"] is True, "Admin has full_access = true")
print(f"  Organization: {me['organization']['name']} ({org_id})")


# ---------------------------------------------------------------------------
step(f"2. Create warehouse: {RUN_ID} Main Warehouse - Hyderabad")
# ---------------------------------------------------------------------------
resp = req(
    "POST",
    "/warehouses",
    headers=admin_headers,
    json_body={
        "name": f"{RUN_ID} Main Warehouse - Hyderabad",
        "city": "Hyderabad",
        "is_default": False,
        "is_active": True,
    },
)
check(resp.status_code == 201, f"Warehouse created (got {resp.status_code}: {body_preview(resp)})")
warehouse = resp.json()
warehouse_id = warehouse["id"]
print(f"  Warehouse: {warehouse['name']} ({warehouse_id})")


# ---------------------------------------------------------------------------
step("3. Create products: Bisleri Water Bottle 1L, Balaji Wafers 150g")
# ---------------------------------------------------------------------------
resp = req(
    "POST",
    "/products",
    headers=admin_headers,
    json_body={
        "name": f"{RUN_ID} Bisleri Water Bottle 1L",
        "sku": f"{RUN_ID}-BSL-WTR-1L",
        "price": 20.0,
        "tax_rate": 18.0,
    },
)
check(resp.status_code == 201, f"Bisleri product created (got {resp.status_code}: {body_preview(resp)})")
product_bisleri = resp.json()
bisleri_id = product_bisleri["id"]

resp = req(
    "POST",
    "/products",
    headers=admin_headers,
    json_body={
        "name": f"{RUN_ID} Balaji Wafers 150g",
        "sku": f"{RUN_ID}-BLJ-WFR-150G",
        "price": 30.0,
        "tax_rate": 12.0,
    },
)
check(resp.status_code == 201, f"Balaji product created (got {resp.status_code}: {body_preview(resp)})")
product_balaji = resp.json()
balaji_id = product_balaji["id"]

print(f"  Bisleri Water Bottle 1L: {bisleri_id} (Rs.20, 18% GST)")
print(f"  Balaji Wafers 150g:      {balaji_id} (Rs.30, 12% GST)")


# ---------------------------------------------------------------------------
step("4. Opening stock: 100 Bisleri + 100 Balaji at the new warehouse")
# ---------------------------------------------------------------------------
resp = req(
    "POST",
    f"/warehouses/{warehouse_id}/stock/adjust",
    headers=admin_headers,
    json_body={"product_id": bisleri_id, "quantity": 100, "movement_type": "opening", "note": "Smoke test opening stock"},
)
check(resp.status_code in (200, 201), f"Bisleri opening stock added (got {resp.status_code}: {body_preview(resp)})")

resp = req(
    "POST",
    f"/warehouses/{warehouse_id}/stock/adjust",
    headers=admin_headers,
    json_body={"product_id": balaji_id, "quantity": 100, "movement_type": "opening", "note": "Smoke test opening stock"},
)
check(resp.status_code in (200, 201), f"Balaji opening stock added (got {resp.status_code}: {body_preview(resp)})")


# ---------------------------------------------------------------------------
step("5. Create Sales Officer: Ramesh Kumar")
# ---------------------------------------------------------------------------
resp = req("GET", "/roles", headers=admin_headers)
roles = resp.json()
sales_role = next((r for r in roles if r.get("workspace") == "sales"), None)
delivery_role = next((r for r in roles if r.get("workspace") == "delivery"), None)
check(sales_role is not None, "Found a role with workspace='sales'")
check(delivery_role is not None, "Found a role with workspace='delivery'")

sales_email = f"ramesh.kumar.{RUN_ID.lower()}@sharma-demo.com"
resp = req(
    "POST",
    "/users",
    headers=admin_headers,
    json_body={
        "basic_information": {"first_name": "Ramesh", "last_name": "Kumar"},
        "contact_information": {"official_email": sales_email, "mobile_number": "9876543210"},
        "employment_information": {
            "designation": "Sales Officer",
            "employment_type": "full_time",
            "role_id": sales_role["id"] if sales_role else None,
        },
        "login_security": {"password": "Sales@12345", "confirm_password": "Sales@12345"},
    },
)
check(resp.status_code == 201, f"Sales Officer created (got {resp.status_code}: {body_preview(resp)})")
sales_officer = resp.json()
sales_officer_id = sales_officer.get("id") or sales_officer.get("user_id")
print(f"  Ramesh Kumar (Sales Officer): {sales_officer_id}")


# ---------------------------------------------------------------------------
step("6. Create Delivery Partner: Suresh Yadav")
# ---------------------------------------------------------------------------
delivery_email = f"suresh.yadav.{RUN_ID.lower()}@sharma-demo.com"
resp = req(
    "POST",
    "/users",
    headers=admin_headers,
    json_body={
        "basic_information": {"first_name": "Suresh", "last_name": "Yadav"},
        "contact_information": {"official_email": delivery_email, "mobile_number": "9876500001"},
        "employment_information": {
            "designation": "Delivery Partner",
            "employment_type": "full_time",
            "role_id": delivery_role["id"] if delivery_role else None,
        },
        "login_security": {"password": "Delivery@12345", "confirm_password": "Delivery@12345"},
    },
)
check(resp.status_code == 201, f"Delivery Partner created (got {resp.status_code}: {body_preview(resp)})")
delivery_partner = resp.json()
delivery_partner_id = delivery_partner.get("id") or delivery_partner.get("user_id")
print(f"  Suresh Yadav (Delivery Partner): {delivery_partner_id}")

# A second delivery partner, used only for the reject-path bonus check in step 17
delivery_email_2 = f"vikram.singh.{RUN_ID.lower()}@sharma-demo.com"
resp = req(
    "POST",
    "/users",
    headers=admin_headers,
    json_body={
        "basic_information": {"first_name": "Vikram", "last_name": "Singh"},
        "contact_information": {"official_email": delivery_email_2, "mobile_number": "9876500002"},
        "employment_information": {
            "designation": "Delivery Partner",
            "employment_type": "full_time",
            "role_id": delivery_role["id"] if delivery_role else None,
        },
        "login_security": {"password": "Delivery@12345", "confirm_password": "Delivery@12345"},
    },
)
check(resp.status_code == 201, f"Second Delivery Partner created (got {resp.status_code}: {body_preview(resp)})")
delivery_partner_2 = resp.json()
delivery_partner_2_id = delivery_partner_2.get("id") or delivery_partner_2.get("user_id")


# ---------------------------------------------------------------------------
step("7. Create vehicle: TS09 AB 1234")
# ---------------------------------------------------------------------------
resp = req(
    "POST",
    "/vehicles",
    headers=admin_headers,
    json_body={"vehicle_number": f"TS09 AB {RUN_SHORT}", "vehicle_type": "Tempo", "capacity_kg": 500},
)
check(resp.status_code == 201, f"Vehicle created (got {resp.status_code}: {body_preview(resp)})")
vehicle_id = resp.json()["id"]


# ---------------------------------------------------------------------------
step("8. Create customer: Sharma General Store")
# ---------------------------------------------------------------------------
resp = req(
    "POST",
    "/customers",
    headers=admin_headers,
    json_body={
        "customer_name": f"{RUN_ID} Sharma General Store",
        "display_name": f"{RUN_ID} Sharma General Store",
        "mobile_number": "9812345678",
        "email_address": f"sharma.store.{RUN_ID.lower()}@example.com",
        "sales_representative_id": sales_officer_id,
    },
)
check(resp.status_code == 201, f"Customer created (got {resp.status_code}: {body_preview(resp)})")
customer = resp.json()
customer_id = customer["id"]
print(f"  Sharma General Store: {customer_id}")


# ---------------------------------------------------------------------------
step("9. Sales Officer logs in and places a Sales Order")
# ---------------------------------------------------------------------------
resp = req("POST", "/auth/login", json_body={"email": sales_email, "password": "Sales@12345"})
check(resp.status_code == 200, f"Sales Officer login succeeds (got {resp.status_code}: {body_preview(resp)})")
sales_token = resp.json()["tokens"]["access_token"]
sales_headers = auth_header(sales_token)

resp = req(
    "POST",
    "/orders",
    headers=sales_headers,
    json_body={
        "customer_id": customer_id,
        "warehouse_id": warehouse_id,
        "salesperson_id": sales_officer_id,
        "fulfilment_method": "delivery",
        "payment_type": "credit",
        "payment_terms_days": 15,
        "items": [
            {"product_id": bisleri_id, "quantity": 60, "unit_price": 20.0, "tax_rate": 18},
            {"product_id": balaji_id, "quantity": 20, "unit_price": 30.0, "tax_rate": 12},
        ],
    },
)
check(resp.status_code == 201, f"Sales order placed (got {resp.status_code}: {body_preview(resp, 400)})")
order = resp.json()
order_id = order["id"]
check(order["status"] in ("placed", "awaiting_approval"), f"Order status is 'placed' or 'awaiting_approval' (got '{order.get('status')}')")

if order["status"] == "awaiting_approval":
    resp = req("PATCH", f"/orders/{order_id}/approve", headers=admin_headers, json_body={})
    check(resp.status_code == 200, f"Order approved (got {resp.status_code}: {body_preview(resp)})")
    order = resp.json()

check(
    order["fulfilment_status"] == "reserved",
    f"Fulfilment status is 'reserved' (got '{order.get('fulfilment_status')}')",
)
print(f"  Order {order.get('order_number', order_id)}: {order_id}")
print(f"  Total: Rs.{order.get('total')}  Status: {order['status']} / {order['fulfilment_status']}")


# ---------------------------------------------------------------------------
step("10. Admin plans a Delivery: assigns Suresh Yadav + vehicle")
# ---------------------------------------------------------------------------
resp = req(
    "POST",
    "/deliveries",
    headers=admin_headers,
    json_body={
        "order_id": order_id,
        "delivery_partner_id": delivery_partner_id,
        "vehicle_id": vehicle_id,
        "warehouse_id": warehouse_id,
        "scheduled_date": datetime.now().strftime("%Y-%m-%d"),
        "delivery_address": "Shop 4, Sharma Market, Hyderabad",
        "notes": f"{RUN_ID} planned delivery",
    },
)
check(resp.status_code == 201, f"Delivery planned (got {resp.status_code}: {body_preview(resp, 400)})")
delivery = resp.json()
delivery_id = delivery["id"]
check(delivery["status"] == "planned", f"Delivery status is 'planned' (got '{delivery.get('status')}')")
print(f"  Delivery {delivery.get('delivery_number', delivery_id)}: {delivery_id}")


# ---------------------------------------------------------------------------
step("11. Delivery Partner accepts the delivery (required before loading)")
# ---------------------------------------------------------------------------
resp = req("POST", "/auth/login", json_body={"email": delivery_email, "password": "Delivery@12345"})
check(resp.status_code == 200, f"Delivery Partner login succeeds (got {resp.status_code}: {body_preview(resp)})")
delivery_partner_token = resp.json()["tokens"]["access_token"]
delivery_partner_headers = auth_header(delivery_partner_token)

# Loading before acceptance must be rejected by the new gate
resp = req("POST", f"/deliveries/{delivery_id}/load", headers=admin_headers, json_body={})
check(resp.status_code == 400, f"Loading a not-yet-accepted delivery is rejected (got {resp.status_code}: {body_preview(resp)})")

resp = req("POST", f"/deliveries/{delivery_id}/accept", headers=delivery_partner_headers, json_body={})
check(resp.status_code == 200, f"Delivery accepted (got {resp.status_code}: {body_preview(resp)})")
delivery = resp.json()
check(delivery["status"] == "accepted", f"Delivery status is 'accepted' (got '{delivery.get('status')}')")

resp = req("POST", f"/deliveries/{delivery_id}/accept", headers=delivery_partner_headers, json_body={})
check(resp.status_code == 400, f"Accepting an already-accepted delivery is rejected (got {resp.status_code}: {body_preview(resp)})")


# ---------------------------------------------------------------------------
step("12. Load the vehicle with planned quantities")
# ---------------------------------------------------------------------------
resp = req("POST", f"/deliveries/{delivery_id}/load", headers=admin_headers, json_body={})
check(resp.status_code == 200, f"Vehicle loaded (got {resp.status_code}: {body_preview(resp, 400)})")
delivery = resp.json()
check(delivery["status"] == "loaded", f"Delivery status is 'loaded' (got '{delivery.get('status')}')")

resp = req("GET", "/warehouses/stock", headers=admin_headers, params={"warehouse_id": warehouse_id})
stock_rows = {row["product_id"]: row for row in resp.json()} if resp.status_code == 200 else {}
bisleri_stock = stock_rows.get(bisleri_id, {})
balaji_stock = stock_rows.get(balaji_id, {})
print(f"  Warehouse stock after load -> Bisleri: {bisleri_stock.get('on_hand')}, Balaji: {balaji_stock.get('on_hand')}")
check(bisleri_stock.get("on_hand") == 40, f"Bisleri on-hand dropped to 40 (got {bisleri_stock.get('on_hand')})")
check(balaji_stock.get("on_hand") == 80, f"Balaji on-hand dropped to 80 (got {balaji_stock.get('on_hand')})")


# ---------------------------------------------------------------------------
step("13. Dispatch the delivery (status -> in_transit)")
# ---------------------------------------------------------------------------
resp = req("PATCH", f"/deliveries/by-id/{delivery_id}", headers=admin_headers, json_body={"status": "in_transit"})
check(resp.status_code == 200, f"Delivery dispatched (got {resp.status_code}: {body_preview(resp)})")
check(resp.json()["status"] == "in_transit", "Delivery status is 'in_transit'")


# ---------------------------------------------------------------------------
step("14. Delivery Partner confirms FULL delivery with POD")
# ---------------------------------------------------------------------------
delivery_item_ids = [item["id"] for item in delivery["items"]]
resp = req(
    "POST",
    f"/deliveries/{delivery_id}/confirm",
    headers=delivery_partner_headers,
    json_body={
        "items": [
            {"delivery_item_id": delivery_item_ids[0], "delivered_quantity": 60},
            {"delivery_item_id": delivery_item_ids[1], "delivered_quantity": 20},
        ],
        "pod_photo_file_ids": [],
        "notes": "Delivered to shop owner directly, no issues",
    },
)
check(resp.status_code == 200, f"Delivery confirmed (got {resp.status_code}: {body_preview(resp, 400)})")
delivery = resp.json()
check(delivery["status"] == "delivered", f"Delivery status is 'delivered' (got '{delivery.get('status')}')")


# ---------------------------------------------------------------------------
step("15. Generate invoice from the order (bills delivered quantity)")
# ---------------------------------------------------------------------------
resp = req("POST", f"/orders/{order_id}/invoice", headers=admin_headers, json_body={"delivery_id": delivery_id})
check(resp.status_code == 201, f"Invoice generated (got {resp.status_code}: {body_preview(resp, 400)})")
invoice = resp.json()
invoice_id = invoice["id"]
print(f"  Invoice {invoice.get('invoice_number', invoice_id)}: Rs.{invoice.get('total')}")
check(invoice.get("total", 0) > 0, f"Invoice total computed: Rs.{invoice.get('total')}")


# ---------------------------------------------------------------------------
step("16. Record full payment against the invoice")
# ---------------------------------------------------------------------------
resp = req(
    "POST",
    "/payment-receipts",
    headers=admin_headers,
    json_body={
        "invoice_reference_id": invoice_id,
        "amount_received": invoice["total"],
        "payment_method": "upi",
        "receipt_date": datetime.now().strftime("%Y-%m-%d"),
    },
)
check(resp.status_code == 201, f"Payment recorded (got {resp.status_code}: {body_preview(resp, 400)})")

resp = req("GET", f"/invoices/{invoice_id}", headers=admin_headers)
final_invoice = resp.json()
print(f"  Invoice payment status after payment: {final_invoice.get('payment_status')}")
check(
    final_invoice.get("payment_status") == "Paid",
    f"Invoice payment_status is 'Paid' (got '{final_invoice.get('payment_status')}')",
)
balance = final_invoice.get("outstanding_amount") or final_invoice.get("balance") or 0
check(balance == 0, f"Invoice outstanding balance is 0 (got {balance})")


# ---------------------------------------------------------------------------
step("17. (Bonus) Reject-path check on a second delivery")
# ---------------------------------------------------------------------------
resp = req(
    "POST",
    "/orders",
    headers=sales_headers,
    json_body={
        "customer_id": customer_id,
        "warehouse_id": warehouse_id,
        "salesperson_id": sales_officer_id,
        "fulfilment_method": "delivery",
        "payment_type": "cash",
        "items": [{"product_id": bisleri_id, "quantity": 5, "unit_price": 20.0, "tax_rate": 18}],
    },
)
order_2 = resp.json() if resp.status_code == 201 else None
check(resp.status_code == 201, f"Second order placed for reject-path check (got {resp.status_code}: {body_preview(resp, 400)})")

if order_2:
    if order_2["status"] == "awaiting_approval":
        r = req("PATCH", f"/orders/{order_2['id']}/approve", headers=admin_headers, json_body={})
        if r.status_code == 200:
            order_2 = r.json()

    resp = req(
        "POST",
        "/deliveries",
        headers=admin_headers,
        json_body={
            "order_id": order_2["id"],
            "delivery_partner_id": delivery_partner_id,
            "vehicle_id": vehicle_id,
            "warehouse_id": warehouse_id,
            "scheduled_date": datetime.now().strftime("%Y-%m-%d"),
            "notes": f"{RUN_ID} reject-path delivery",
        },
    )
    check(resp.status_code == 201, f"Second delivery planned (got {resp.status_code}: {body_preview(resp, 400)})")
    delivery_2 = resp.json()
    delivery_2_id = delivery_2["id"]

    resp = req("POST", "/auth/login", json_body={"email": delivery_email_2, "password": "Delivery@12345"})
    other_partner_token = resp.json()["tokens"]["access_token"] if resp.status_code == 200 else None
    if other_partner_token:
        resp = req("POST", f"/deliveries/{delivery_2_id}/accept", headers=auth_header(other_partner_token), json_body={})
        check(resp.status_code in (403, 404), f"Non-assigned partner cannot accept (got {resp.status_code}: {body_preview(resp)})")

    resp = req(
        "POST",
        f"/deliveries/{delivery_2_id}/reject",
        headers=delivery_partner_headers,
        json_body={"reason": "Vehicle broken down"},
    )
    check(resp.status_code == 200, f"Assigned partner rejects the delivery (got {resp.status_code}: {body_preview(resp)})")
    rejected = resp.json()
    check(rejected.get("status") == "rejected", f"Delivery status is 'rejected' (got '{rejected.get('status')}')")
    check(rejected.get("delivery_partner_id") is None, "delivery_partner_id cleared on rejection")
    check(rejected.get("vehicle_id") is None, "vehicle_id cleared on rejection")

    resp = req("GET", "/deliveries", headers=admin_headers, params={"status": "rejected"})
    rejected_ids = [d["id"] for d in resp.json()] if resp.status_code == 200 else []
    check(delivery_2_id in rejected_ids, "Admin can find it via GET /deliveries?status=rejected")

    resp = req("POST", f"/deliveries/{delivery_2_id}/load", headers=admin_headers, json_body={})
    check(resp.status_code == 400, f"Loading a rejected delivery is rejected (got {resp.status_code}: {body_preview(resp)})")


# ---------------------------------------------------------------------------
step("SUMMARY")
# ---------------------------------------------------------------------------
print(f"\n  Customer:        Sharma General Store ({customer_id})")
print(f"  Order:           {order.get('order_number', order_id)} - Rs.{order.get('total')}")
print(f"  Delivery:        {delivery.get('delivery_number', delivery_id)} - delivered in full")
print(f"  Invoice:         {invoice.get('invoice_number', invoice_id)} - Rs.{invoice.get('total')} - PAID")
print(f"\n  Total checks: {len(FAILURES) == 0 and 'ALL PASSED' or f'{len(FAILURES)} FAILED'}")

if FAILURES:
    print("\n  Failed checks:")
    for f in FAILURES:
        print(f"    - {f}")
    sys.exit(1)
else:
    print("\n  Full flow (Order -> Delivery [accept] -> Invoice -> Payment) works end to end.")
    sys.exit(0)
