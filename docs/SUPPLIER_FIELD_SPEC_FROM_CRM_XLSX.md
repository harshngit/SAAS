# Supplier Field Specification — extracted from CRM (1)(2).xlsx

Use this file as the complete Supplier-field inventory for the frontend/backend audit. Do not assume every row is a user-editable form field.

| Section | Field | Description | Type / Format | Required |
|---|---|---|---|---|
| Basic Information | Supplier ID | Unique supplier identifier | Auto Number (SUP-000001) | Yes |
| Basic Information | Supplier Name | Legal business name | Text (200) | Yes |
| Basic Information | Display Name | Short/display name | Text | No |
| Basic Information | Supplier Type | Company, Individual, Manufacturer, Distributor, Wholesaler, Retailer | Dropdown | Yes |
| Basic Information | Business Type | Private, Partnership, LLP, Public Ltd, Proprietorship | Dropdown | No |
| Basic Information | Supplier Category | Raw Material, Packaging, Service, Transport, Maintenance, Contractor | Multi-select | Yes |
| Basic Information | Industry | Supplier industry | Lookup | No |
| Basic Information | Status | Active, Inactive, Blacklisted, Pending Approval | Dropdown | Yes |
| Basic Information | Priority | Preferred, Standard, Backup | Dropdown | No |
| Basic Information | Supplier Since | Date supplier relationship started | Date | No |
| Basic Information | Parent Company | Parent supplier | Lookup | No |
| Basic Information | Remarks | General notes | Multi-line Text | No |
| Contact Information | Primary Contact Name | Main contact person | Text | Yes |
| Contact Information | Designation | Job title | Text | No |
| Contact Information | Department | Contact department | Text | No |
| Contact Information | Mobile Number | Mobile | Phone | Yes |
| Contact Information | Alternate Mobile | Secondary mobile | Phone | No |
| Contact Information | Office Phone | Landline | Phone | No |
| Contact Information | Email Address | Official email | Email | Yes |
| Contact Information | Alternate Email | Secondary email | Email | No |
| Contact Information | WhatsApp Number | WhatsApp contact | Phone | No |
| Contact Information | Website | Company website | URL | No |
| Address | Address Type | Billing, Shipping, Head Office, Warehouse | Dropdown | Yes |
| Address | Address Line 1 | Street | Text | Yes |
| Address | Address Line 2 | Additional address | Text | No |
| Address | Landmark | Landmark | Text | No |
| Address | City | City | Lookup | Yes |
| Address | State | State | Lookup | Yes |
| Address | Country | Country | Lookup | Yes |
| Address | Postal Code | ZIP/PIN | Text | Yes |
| Address | Google Location | GPS Location | Decimal | No |
| Tax | GST Registration | Registered for GST | Yes/No | Yes |
| Tax | GST Number | GSTIN | Text | Conditional |
| Tax | PAN Number | PAN | Text | Conditional |
| Tax | TAN Number | TAN | Text | No |
| Tax | CIN Number | Corporate Identity Number | Text | No |
| Tax | MSME Registered | MSME status | Yes/No | No |
| Tax | MSME Number | MSME registration | Text | No |
| Tax | VAT Number | VAT (international) | Text | No |
| Tax | Tax Exempt | Tax exemption | Yes/No | No |
| Tax | Tax Exemption Certificate | Certificate upload | File | No |
| Banking | Bank Name | Bank | Text | No |
| Banking | Branch | Branch | Text | No |
| Banking | Account Holder | Account name | Text | No |
| Banking | Account Number | Account number | Text | No |
| Banking | Account Type | Savings, Current | Dropdown | No |
| Banking | IFSC Code | IFSC | Text | No |
| Banking | SWIFT Code | SWIFT | Text | No |
| Banking | IBAN | International account | Text | No |
| Banking | UPI ID | UPI | Text | No |
| Banking | Payment Currency | INR, USD, EUR | Lookup | Yes |
| Procurement | Purchase Manager | Internal owner | Lookup(User) | Yes |
| Procurement | Payment Terms | Immediate, 15 Days, 30 Days | Dropdown | Yes |
| Procurement | Credit Limit | Credit amount | Currency | No |
| Procurement | Lead Time | Delivery lead time | Number (Days) | No |
| Procurement | Minimum Order Value | Minimum PO value | Currency | No |
| Procurement | Minimum Order Quantity | MOQ | Number | No |
| Procurement | Preferred Delivery Method | Road, Courier, Air, Sea | Dropdown | No |
| Procurement | Incoterms | FOB, CIF, EXW, etc. | Dropdown | No |
| Procurement | Purchase Currency | Currency | Lookup | Yes |
| Products | Product Categories | Categories supplied | Multi-select | Yes |
| Products | Brands | Brands supplied | Multi-select | No |
| Products | Product List | Linked products | Lookup (Multiple) | No |
| Products | Services Offered | Services provided | Multi-select | No |
| Products | Price List | Supplier price list | Lookup | No |
| Logistics | Warehouse Address | Warehouse | Lookup | No |
| Logistics | Pickup Available | Pickup supported | Yes/No | No |
| Logistics | Delivery Available | Supplier delivers | Yes/No | No |
| Logistics | Vehicle Type | Truck, Van, Bike | Dropdown | No |
| Logistics | Average Delivery Time | Average days | Number | No |
| Logistics | Shipping Charges | Standard shipping | Currency | No |
| Documents | GST Certificate | Upload | File | No |
| Documents | PAN Card | Upload | File | No |
| Documents | MSME Certificate | Upload | File | No |
| Documents | Trade License | Upload | File | No |
| Documents | Bank Proof | Upload | File | No |
| Documents | Company Registration | Upload | File | No |
| Documents | Insurance Certificate | Upload | File | No |
| Documents | NDA | Upload | File | No |
| Documents | Supplier Agreement | Upload | File | No |
| Documents | Other Documents | Upload | Multiple Files | No |
| Performance | Supplier Rating | 1–5 stars | Number | No |
| Performance | On-Time Delivery % | KPI | Percentage | Calculated |
| Performance | Quality Score | KPI | Percentage | Calculated |
| Performance | Defect Rate | KPI | Percentage | Calculated |
| Performance | Last Purchase Date | Last PO | Date | Calculated |
| Performance | Total Purchase Value | Lifetime purchases | Currency | Calculated |
| Performance | Total Purchase Orders | PO count | Number | Calculated |
| Communication | Preferred Contact Method | Email, Phone, WhatsApp | Dropdown | No |
| Communication | Receive Purchase Orders by | Email, Portal, WhatsApp | Dropdown | No |
| Communication | Language | Preferred language | Lookup | No |
| Communication | Time Zone | Supplier timezone | Lookup | No |
| Payment | Payment Terms | Cash, 15 Days, 30 Days, etc. | Dropdown | Yes |
| Payment | Credit Limit | Maximum credit allowed | Currency | No |
| Payment | Preferred Payment Method | Bank Transfer, UPI, Cash, Cheque | Dropdown | Yes |
| Payment | Currency | Transaction currency | Lookup | Yes |
| CRM | Account Owner | Internal owner | Lookup(User) | Yes |
| CRM | Territory | Sales region | Lookup | No |
| CRM | Supplier Source | Referral, Website, Trade Show | Dropdown | No |
| CRM | Approval Status | Draft, Submitted, Approved, Rejected | Dropdown | Yes |
| CRM | Rating | Supplier performance rating | Dropdown (1–5 Stars) | No |
| CRM | Preferred Supplier | Preferred supplier indicator | Yes/No | No |
| CRM | Last Purchase Date | Most recent purchase | Date | No |
| CRM | Total Purchase Value | Total purchases made | Currency (Calculated) | No |
| Audit | Created By | User who created the supplier | Lookup (User) | System |
| Audit | Created On | Record creation date | DateTime | System |
| Audit | Modified By | Last modified by | Lookup (User) | System |
| Audit | Modified On | Last modified date | DateTime | System |
| Audit | Record Status | Active/Inactive | Dropdown | System |