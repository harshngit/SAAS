# Object Field catalog (live backend, GET /organizations/settings/fields)

## company (63 fields)

| # | Key | Label | Classification | Depends on / condition |
|---|---|---|---|---|
| 1 | name | Company Name | mandatory |  |
| 2 | legal_name | Legal Name | optional |  |
| 3 | business_type | Business Type | optional |  |
| 4 | industry | Industry | optional |  |
| 5 | date_of_incorporation | Date of Incorporation | optional |  |
| 6 | cin_number | CIN Number | optional |  |
| 7 | gst_number | GST Number | optional |  |
| 8 | pan_number | PAN Number | optional |  |
| 9 | gstin_pan | GSTIN / PAN | optional |  |
| 10 | description | Business Description | optional |  |
| 11 | financial_year | Financial Year | optional |  |
| 12 | phone | Phone | optional |  |
| 13 | primary_mobile | Primary Mobile | optional |  |
| 14 | alternate_mobile | Alternate Mobile | optional |  |
| 15 | landline | Landline | optional |  |
| 16 | email | Email | optional |  |
| 17 | website | Website | optional |  |
| 18 | customer_support_number | Customer Support Number | optional |  |
| 19 | whatsapp_number | WhatsApp Number | optional |  |
| 20 | registered_address | Registered Address | optional |  |
| 21 | branch_addresses | Branch Addresses | optional |  |
| 22 | city | City | optional |  |
| 23 | state | State | optional |  |
| 24 | country | Country | optional |  |
| 25 | pin_code | PIN Code | optional |  |
| 26 | maps_latitude | Map Latitude | optional |  |
| 27 | maps_longitude | Map Longitude | optional |  |
| 28 | logo_url | Company Logo | optional |  |
| 29 | signature_url | Authorized Signature | optional |  |
| 30 | stamp_url | Company Stamp | optional |  |
| 31 | letterhead_url | Letterhead | optional |  |
| 32 | banner_url | Banner | optional |  |
| 33 | payment_qr_url | Payment QR Code | optional |  |
| 34 | upi_id | UPI ID | optional |  |
| 35 | bank_name | Bank Name | optional |  |
| 36 | bank_account_details | Bank Account Details | optional |  |
| 37 | bank_account_holder | Account Holder Name | optional |  |
| 38 | bank_ifsc | IFSC Code | optional |  |
| 39 | facebook_url | Facebook | optional |  |
| 40 | instagram_url | Instagram | optional |  |
| 41 | linkedin_url | LinkedIn | optional |  |
| 42 | twitter_url | Twitter / X | optional |  |
| 43 | youtube_url | YouTube | optional |  |
| 44 | currency | Currency | optional |  |
| 45 | timezone | Time Zone | optional |  |
| 46 | language | Language | optional |  |
| 47 | doc_gst_url | GST Certificate | optional |  |
| 48 | doc_pan_url | PAN Card | optional |  |
| 49 | doc_coi_url | Certificate of Incorporation | optional |  |
| 50 | doc_trade_license_url | Trade License | optional |  |
| 51 | doc_msme_url | MSME Certificate | optional |  |
| 52 | doc_fssai_url | FSSAI License | optional |  |
| 53 | doc_other_url | Other Business Document | optional |  |
| 54 | auth_person_name | Authorized Person Name | optional |  |
| 55 | auth_person_designation | Authorized Person Designation | optional |  |
| 56 | auth_person_mobile | Authorized Person Mobile | optional |  |
| 57 | auth_person_email | Authorized Person Email | optional |  |
| 58 | auth_person_photo_url | Authorized Person Photo | optional |  |
| 59 | auth_person_signature_url | Authorized Person Signature | optional |  |
| 60 | employee_count | Number of Employees | optional |  |
| 61 | business_hours | Business Hours | optional |  |
| 62 | mission_vision | Mission & Vision | optional |  |
| 63 | notes | Notes | optional |  |

## lead (12 fields)

| # | Key | Label | Classification | Depends on / condition |
|---|---|---|---|---|
| 1 | name | Lead / Business Name | mandatory |  |
| 2 | mobile_number | Mobile Number | mandatory |  |
| 3 | lead_source | Lead Source | mandatory |  |
| 4 | contact_person | Contact Person | optional |  |
| 5 | email | Email | optional |  |
| 6 | interested_product | Interested Product (Free Text) | optional |  |
| 7 | interested_product_ids | Interested Products | optional |  |
| 8 | lead_type | Lead Type | optional |  |
| 9 | segment | Segment | optional |  |
| 10 | customer_id | Linked Customer | optional |  |
| 11 | assigned_salesperson_id | Assigned Salesperson | optional |  |
| 12 | notes | Notes | optional |  |

## customer (62 fields)

| # | Key | Label | Classification | Depends on / condition |
|---|---|---|---|---|
| 1 | basic_information.customer_name | Customer Name | mandatory |  |
| 2 | basic_information.customer_type | Customer Type | optional |  |
| 3 | basic_information.legal_business_name | Legal Business Name | optional |  |
| 4 | basic_information.display_name | Display Name | optional |  |
| 5 | basic_information.industry | Industry | optional |  |
| 6 | basic_information.customer_category | Customer Category | optional |  |
| 7 | basic_information.customer_since | Customer Since | optional |  |
| 8 | basic_information.profile_image_id | Profile Image | optional |  |
| 9 | contact_information.primary_contact_person | Primary Contact Person | optional |  |
| 10 | contact_information.designation | Designation | optional |  |
| 11 | contact_information.mobile_number | Mobile Number | optional |  |
| 12 | contact_information.alternate_mobile_number | Alternate Mobile Number | optional |  |
| 13 | contact_information.email_address | Email Address | optional |  |
| 14 | contact_information.website | Website | optional |  |
| 15 | address_information.billing_address | Billing Address | optional |  |
| 16 | address_information.shipping_address | Shipping Address | optional |  |
| 17 | address_information.city | City | optional |  |
| 18 | address_information.state | State | optional |  |
| 19 | address_information.country | Country | optional |  |
| 20 | address_information.pin_zip_code | PIN / ZIP Code | optional |  |
| 21 | address_information.google_maps_location | Map Location | optional |  |
| 22 | business_tax_information.gstin_tax_id | GSTIN / Tax ID | optional |  |
| 23 | business_tax_information.pan_business_registration_no | PAN / Business Registration No. | optional |  |
| 24 | business_tax_information.tax_exempt | Tax Exempt | optional |  |
| 25 | business_tax_information.tax_category | Tax Category | optional |  |
| 26 | business_tax_information.currency | Currency | optional |  |
| 27 | payment_information.payment_terms | Payment Terms | optional |  |
| 28 | payment_information.credit_limit | Credit Limit | optional |  |
| 29 | payment_information.opening_balance | Opening Balance | optional |  |
| 30 | payment_information.preferred_payment_method | Preferred Payment Method | optional |  |
| 31 | payment_information.upi_id | UPI ID | optional |  |
| 32 | payment_information.bank_name | Bank Name | optional |  |
| 33 | payment_information.account_number | Bank Account Number | optional |  |
| 34 | payment_information.ifsc_swift_code | IFSC / SWIFT Code | optional |  |
| 35 | sales_crm_information.sales_representative_id | Sales Representative | optional |  |
| 36 | sales_crm_information.lead_source | Lead Source | optional |  |
| 37 | sales_crm_information.territory | Territory | optional |  |
| 38 | sales_crm_information.customer_priority | Customer Priority | optional |  |
| 39 | sales_crm_information.preferred_communication | Preferred Communication | optional |  |
| 40 | sales_crm_information.customer_tags | Customer Tags | optional |  |
| 41 | social_media_online_presence.facebook_url | Facebook | optional |  |
| 42 | social_media_online_presence.instagram_url | Instagram | optional |  |
| 43 | social_media_online_presence.linkedin_url | LinkedIn | optional |  |
| 44 | social_media_online_presence.x_twitter_url | X / Twitter | optional |  |
| 45 | social_media_online_presence.youtube_url | YouTube | optional |  |
| 46 | additional_information.date_of_birth | Date of Birth | optional |  |
| 47 | additional_information.anniversary_date | Anniversary Date | optional |  |
| 48 | additional_information.referral_customer_id | Referred By (Customer) | optional |  |
| 49 | additional_information.loyalty_number | Loyalty Number | optional |  |
| 50 | additional_information.notes | Notes | optional |  |
| 51 | preferences.portal_access_enabled | Customer Portal Access | optional |  |
| 52 | preferences.favorite_product_ids | Favourite Products | optional |  |
| 53 | preferences.default_price_list_id | Default Price List | optional |  |
| 54 | preferences.default_tax_profile_id | Default Tax Profile | optional |  |
| 55 | preferences.default_warehouse_id | Default Warehouse | optional |  |
| 56 | preferences.preferred_invoice_delivery | Preferred Invoice Delivery | optional |  |
| 57 | documents.gst_certificate_id | GST Certificate | optional |  |
| 58 | documents.pan_card_id | PAN Card | optional |  |
| 59 | documents.business_registration_certificate_id | Business Registration Certificate | optional |  |
| 60 | documents.address_proof_id | Address Proof | optional |  |
| 61 | documents.purchase_agreement_id | Purchase Agreement | optional |  |
| 62 | documents.other_document_ids | Other Documents | optional |  |

## quotation (13 fields)

| # | Key | Label | Classification | Depends on / condition |
|---|---|---|---|---|
| 1 | items | Line Items | mandatory |  |
| 2 | customer_id | Customer | conditional | Exactly one of customer_id or lead_id is required |
| 3 | lead_id | Lead | conditional | Exactly one of customer_id or lead_id is required |
| 4 | quotation_date | Quotation Date | optional |  |
| 5 | valid_until | Valid Until | optional |  |
| 6 | billing_address | Billing Address | optional |  |
| 7 | shipping_address | Shipping Address | optional |  |
| 8 | salesperson_id | Salesperson | optional |  |
| 9 | currency | Currency | optional |  |
| 10 | payment_terms | Payment Terms | optional |  |
| 11 | delivery_terms | Delivery Terms | optional |  |
| 12 | notes | Notes | optional |  |
| 13 | terms_conditions | Terms & Conditions | optional |  |

## product (76 fields)

| # | Key | Label | Classification | Depends on / condition |
|---|---|---|---|---|
| 1 | name | Product Name | mandatory |  |
| 2 | has_variants | Has Variants | non_configurable |  |
| 3 | variant_attributes | Variant Attributes | non_configurable |  |
| 4 | variations | Variants | non_configurable |  |
| 5 | short_name | Short Name | optional |  |
| 6 | description | Description | optional |  |
| 7 | sku | SKU | optional |  |
| 8 | barcode | Barcode | optional |  |
| 9 | product_type_id | Product Type | optional |  |
| 10 | category_id | Category | optional |  |
| 11 | sub_category_id | Subcategory | optional | category_id |
| 12 | brand_id | Brand | optional |  |
| 13 | vendor | Vendor | optional |  |
| 14 | manufacturer | Manufacturer | optional |  |
| 15 | model_number | Model Number | optional |  |
| 16 | pricing.purchase_price | Purchase Price | optional |  |
| 17 | pricing.selling_price | Selling Price | optional |  |
| 18 | pricing.mrp | MRP | optional |  |
| 19 | pricing.wholesale_price | Wholesale Price | optional |  |
| 20 | pricing.dealer_price | Dealer Price | optional |  |
| 21 | pricing.discount_percent | Discount (%) | optional |  |
| 22 | pricing.tax_inclusive | Price Includes Tax | optional |  |
| 23 | pricing.currency | Price Currency | optional |  |
| 24 | hsn_code | HSN Code | optional |  |
| 25 | tax_rate | Tax Rate (%) | optional |  |
| 26 | tax_category | Tax Category | optional |  |
| 27 | cover_image | Cover Image | optional |  |
| 28 | images | Product Images | optional |  |
| 29 | product_video | Product Video | optional |  |
| 30 | product_catalog_brochure | Catalog / Brochure | optional |  |
| 31 | product_manual | Product Manual | optional |  |
| 32 | product_datasheet | Datasheet | optional |  |
| 33 | compliance_certificate | Compliance Certificate | optional |  |
| 34 | warranty_document | Warranty Document | optional |  |
| 35 | inventory_tracking | Inventory Tracking | optional |  |
| 36 | uom | Unit of Measure | optional |  |
| 37 | opening_stock | Opening Stock | optional |  |
| 38 | minimum_stock_level | Minimum Stock Level | optional |  |
| 39 | maximum_stock_level | Maximum Stock Level | optional |  |
| 40 | reorder_level | Reorder Level | optional |  |
| 41 | reorder_quantity | Reorder Quantity | optional |  |
| 42 | bin_shelf_location | Bin / Shelf Location | optional |  |
| 43 | batch_tracking | Batch Tracking | optional |  |
| 44 | serial_number_tracking | Serial Number Tracking | optional |  |
| 45 | expiry_tracking | Expiry Tracking | optional |  |
| 46 | preferred_supplier_id | Preferred Supplier | optional |  |
| 47 | supplier_product_code | Supplier Product Code | optional |  |
| 48 | lead_time | Lead Time | optional |  |
| 49 | minimum_order_quantity | Minimum Order Quantity | optional |  |
| 50 | purchase_unit | Purchase Unit | optional |  |
| 51 | sales_unit | Sales Unit | optional |  |
| 52 | commission_eligible | Commission Eligible | optional |  |
| 53 | commission | Commission | optional |  |
| 54 | default_discount | Default Discount | optional |  |
| 55 | weight | Weight | optional |  |
| 56 | weight_unit | Weight Unit | optional |  |
| 57 | length | Length | optional |  |
| 58 | width | Width | optional |  |
| 59 | height | Height | optional |  |
| 60 | volume | Volume | optional |  |
| 61 | color | Colour | optional |  |
| 62 | material | Material | optional |  |
| 63 | physical_size | Size | optional |  |
| 64 | downloadable_product | Downloadable Product | optional |  |
| 65 | download_file | Download File | optional |  |
| 66 | license_key_required | License Key Required | optional |  |
| 67 | download_limit | Download Limit | optional |  |
| 68 | warranty_period | Warranty Period | optional |  |
| 69 | warranty_period_unit | Warranty Period Unit | optional |  |
| 70 | shelf_life | Shelf Life | optional |  |
| 71 | shelf_life_unit | Shelf Life Unit | optional |  |
| 72 | country_of_origin | Country of Origin | optional |  |
| 73 | launch_date | Launch Date | optional |  |
| 74 | end_of_life_date | End-of-Life Date | optional |  |
| 75 | product_tags | Tags | optional |  |
| 76 | notes | Notes | optional |  |

## sales_order (28 fields)

| # | Key | Label | Classification | Depends on / condition |
|---|---|---|---|---|
| 1 | customer_id | Customer | mandatory |  |
| 2 | items | Line Items | mandatory |  |
| 3 | delivery_address | Delivery Address | conditional | Required for home delivery when neither shipping_address nor the customer's saved delivery address is available |
| 4 | paid_amount | Amount Paid | conditional | Required for a partial payment: more than zero and less than the order total |
| 5 | order_date | Order Date | optional |  |
| 6 | delivery_date | Delivery Date | optional |  |
| 7 | warehouse_id | Warehouse | optional |  |
| 8 | quotation_id | Source Quotation | optional |  |
| 9 | salesperson_id | Salesperson | optional |  |
| 10 | source | Order Source | optional |  |
| 11 | fulfilment_method | Fulfilment Method | optional |  |
| 12 | delivery_method | Delivery Method | optional |  |
| 13 | billing_address | Billing Address | optional |  |
| 14 | shipping_address | Shipping Address | optional |  |
| 15 | delivery_partner_id | Delivery Partner | optional |  |
| 16 | vehicle_id | Vehicle | optional |  |
| 17 | currency | Currency | optional |  |
| 18 | discount | Order Discount | optional |  |
| 19 | tax | Order Tax | optional |  |
| 20 | payment_type | Payment Type | optional |  |
| 21 | payment_method | Payment Method | optional |  |
| 22 | payment_terms | Payment Terms | optional |  |
| 23 | payment_terms_days | Payment Terms (Days) | optional |  |
| 24 | delivery_terms | Delivery Terms | optional |  |
| 25 | customer_po_number | Customer PO Number | optional |  |
| 26 | payment_proof_url | Payment Proof | optional |  |
| 27 | delivery_proof_url | Delivery Proof | optional |  |
| 28 | notes | Notes | optional |  |

## supplier (19 fields)

| # | Key | Label | Classification | Depends on / condition |
|---|---|---|---|---|
| 1 | name | Supplier Name | mandatory |  |
| 2 | company_name | Company Name | optional |  |
| 3 | contact_person | Contact Person | optional |  |
| 4 | phone | Phone | optional |  |
| 5 | email | Email | optional |  |
| 6 | gst_number | GST Number | optional |  |
| 7 | pan_number | PAN Number | optional |  |
| 8 | category | Category | optional |  |
| 9 | supplier_categories | Supplier Categories | optional |  |
| 10 | supplier_type | Supplier Type | optional |  |
| 11 | payment_terms | Payment Terms | optional |  |
| 12 | credit_limit | Credit Limit | optional |  |
| 13 | opening_balance | Opening Balance | optional |  |
| 14 | address | Address | optional |  |
| 15 | city | City | optional |  |
| 16 | state | State | optional |  |
| 17 | pincode | PIN Code | optional |  |
| 18 | country | Country | optional |  |
| 19 | notes | Notes | optional |  |

## purchase (42 fields)

| # | Key | Label | Classification | Depends on / condition |
|---|---|---|---|---|
| 1 | invoice_number | Supplier Invoice Number | mandatory |  |
| 2 | supplier_id | Supplier | mandatory |  |
| 3 | items | Line Items | mandatory |  |
| 4 | invoice_date | Invoice Date | optional |  |
| 5 | purchase_date | Purchase Date | optional |  |
| 6 | purchase_type | Purchase Type | optional |  |
| 7 | financial_year | Financial Year | optional |  |
| 8 | reference_number | Reference Number | optional |  |
| 9 | contact_person | Contact Person | optional |  |
| 10 | mobile_number | Mobile Number | optional |  |
| 11 | email_address | Email Address | optional |  |
| 12 | payee_gstin | Supplier GSTIN | optional |  |
| 13 | billing_address | Billing Address | optional |  |
| 14 | shipping_address | Shipping Address | optional |  |
| 15 | warehouse_id | Receiving Warehouse | optional |  |
| 16 | received_date | Received Date | optional |  |
| 17 | discount | Discount | optional |  |
| 18 | tax | Tax | optional |  |
| 19 | freight_charges | Freight Charges | optional |  |
| 20 | packing_charges | Packing Charges | optional |  |
| 21 | insurance_charges | Insurance Charges | optional |  |
| 22 | other_charges | Other Charges | optional |  |
| 23 | round_off | Round Off | optional |  |
| 24 | payment_method | Payment Method | optional |  |
| 25 | payment_terms | Payment Terms | optional |  |
| 26 | due_date | Due Date | optional |  |
| 27 | amount_paid | Amount Paid | optional |  |
| 28 | payment_reference | Payment Reference | optional |  |
| 29 | purchase_account_id | Purchase Account | optional |  |
| 30 | tax_category | Tax Category | optional |  |
| 31 | cost_center_id | Cost Center | optional |  |
| 32 | project_id | Project | optional |  |
| 33 | attachment_url | Attachment | optional |  |
| 34 | supplier_quotation_url | Supplier Quotation | optional |  |
| 35 | purchase_order_url | Purchase Order | optional |  |
| 36 | supplier_invoice_url | Supplier Invoice | optional |  |
| 37 | delivery_challan_url | Delivery Challan | optional |  |
| 38 | supporting_documents | Supporting Documents | optional |  |
| 39 | terms_and_conditions | Terms & Conditions | optional |  |
| 40 | internal_remarks | Internal Remarks | optional |  |
| 41 | tags | Tags | optional |  |
| 42 | notes | Notes | optional |  |

## expense (34 fields)

| # | Key | Label | Classification | Depends on / condition |
|---|---|---|---|---|
| 1 | category | Category | mandatory |  |
| 2 | amount | Amount | conditional | Required (more than zero) when no line items are sent; calculated from the items otherwise |
| 3 | description | Description | optional |  |
| 4 | expense_date | Expense Date | optional |  |
| 5 | expense_type | Expense Type | optional |  |
| 6 | items | Line Items | optional |  |
| 7 | currency | Currency | optional |  |
| 8 | financial_year | Financial Year | optional |  |
| 9 | payment_mode | Payment Mode | optional |  |
| 10 | payment_reference | Payment Reference | optional |  |
| 11 | paid_from_account_id | Paid From Account | optional |  |
| 12 | expense_account_id | Expense Account | optional |  |
| 13 | vendor_id | Vendor | optional |  |
| 14 | payee_name | Payee Name | optional |  |
| 15 | contact_person | Contact Person | optional |  |
| 16 | mobile_number | Mobile Number | optional |  |
| 17 | email_address | Email Address | optional |  |
| 18 | payee_gstin | Payee GSTIN | optional |  |
| 19 | tax_rate | Tax Rate (%) | optional |  |
| 20 | tax_amount | Tax Amount | optional |  |
| 21 | tax_category | Tax Category | optional |  |
| 22 | tds_applicable | TDS Applicable | optional |  |
| 23 | tds_amount | TDS Amount | optional |  |
| 24 | branch_id | Branch | optional |  |
| 25 | department_id | Department | optional |  |
| 26 | cost_center_id | Cost Center | optional |  |
| 27 | project_id | Project | optional |  |
| 28 | receipt_url | Receipt | optional |  |
| 29 | vendor_invoice_url | Vendor Invoice | optional |  |
| 30 | supporting_documents | Supporting Documents | optional |  |
| 31 | is_recurring | Recurring Expense | optional |  |
| 32 | recurrence_frequency | Recurrence Frequency | optional |  |
| 33 | next_due_date | Next Due Date | optional |  |
| 34 | tags | Tags | optional |  |

**Total: 349 fields across 9 modules**
