# CRM SaaS — full-flow dummy data seeder

Walks your live backend end to end and creates real data for every screen:
company profile + invoice branding, a warehouse, 4 categories, 8 products
(mixing plain / batch-tracked / serial-tracked / expiry-tracked), 3
suppliers, 3 approved purchase invoices (so stock actually lands), 2 staff
members — a **Sales Executive** and a **Delivery Partner**, each with a real
login, a photo, and role assigned — a vehicle, 5 customers (with a document
each), 4 leads, 2 quotations (one converted to an order), 2 more direct
orders, deliveries (assigned → planned → loaded → confirmed), invoices
(order-billed + one direct walk-in cash sale), a partial payment receipt, a
full sales-return cycle (requested → received → approved, restocking +
issuing a credit note), 3 expenses (one approved), and an attendance
check-in + GPS location ping for each staff member.

## Why this exists

The frontend's Sales Executive / Delivery Partner dashboards are correctly
wired to the real API, but a brand-new org has zero orders, deliveries,
attendance, etc. — so everything renders blank. This script fills all of
that in one run so you can actually look at a populated dashboard.

## Setup

```bash
cd seed_script
npm install
cp .env.example .env
```

Open `.env` and check:

- `REGISTER_NEW_ORG=true` — registers a brand-new org + admin (recommended,
  keeps this data isolated from anything real). Set to `false` and fill in
  `ADMIN_EMAIL` / `ADMIN_PASSWORD` to seed into an org you already have.
- `ASSETS_DIR` — folder to cycle files from for every upload slot. Defaults
  to `SAAS/public/dummy-photo`, which already has a handful of placeholder
  images and PDFs so a run works out of the box with some variety instead of
  reusing one picture everywhere. Two pools are drawn from it:
  - **Image-only slots** (product covers, staff photos, company logo) cycle
    through `.jpg`/`.jpeg`/`.png`/`.webp` files only — the backend rejects
    non-image content here.
  - **Document slots** (customer documents, expense receipts) cycle through
    those same images *plus* any `.pdf` files, since real-world documents are
    often PDFs.

  **Drop more/better files in `public/dummy-photo` (or point `ASSETS_DIR` at
  your own folder)** if you want more variety — e.g. actual headshots for
  staff, real product photos, or more sample PDFs for documents.

## Run it

```bash
npm run seed
```

It prints progress stage by stage. If a stage errors, it's logged and the
script moves on — one broken step doesn't kill the whole run. At the end
you get:

- **`seed-output.json`** — every ID created (customers, products, orders,
  invoices, deliveries, everything), plus the staff logins.
- Printed staff logins in the terminal, e.g.:
  ```
  Sales Executive    aniket.jha@seedtest.local  /  StaffPass123!
  Delivery Partner   rohit.verma@seedtest.local  /  StaffPass123!
  ```
  Log into the frontend as either of these to see their dashboard exactly
  as that role would.

## Re-running

This is **not idempotent** — running it twice creates a second batch of
categories/products/customers/etc. (uniqueness-constrained things like
vehicle numbers or supplier emails will just skip/error safely, everything
else duplicates). For a clean re-run, either:
- keep `REGISTER_NEW_ORG=true` so every run gets its own fresh org, or
- manually delete the seeded records first if you're reusing an org.

## Things this script can't do

A few backend limitations mean some dashboard fields will stay empty no
matter what this script creates — these aren't seeding gaps, the backend
genuinely doesn't have this data yet:
- **Visits / follow-ups** — the backend explicitly returns `null` here;
  there's no visits module to seed data into.
- **Route status / stops completed / route planning** — no route-planning
  module exists on the backend at all.

If your mockups need those fields populated, that's backend work, not
something this script (or any script) can currently seed.

## What still needs your manual input

A few things a script can't reasonably fake and you'll want to do by hand
in the UI once the seed data is in:
- Testing the **credit-limit warning** flow (order a customer past their
  `credit_limit` and confirm the UI surfaces the warning from the API).
- Testing the **insufficient-stock** error path (order more than what's in
  stock and confirm the shortages list renders correctly).
- Uploading a **real staff photo / product photo** you actually care about
  the look of, rather than the cycled placeholder image.
- Anything requiring the **Super Admin** view (plan approvals, org
  suspension) — this script only authenticates as an org Admin.
