# Backend developer prompt: Customer Basic Information

Please perform a focused backend audit/correction for the existing Customer Basic Information flow. Inspect the current backend implementation first. Reuse its existing customer profile schema, endpoints, organization scoping, permissions and field-settings service. Do not create duplicate fields or new endpoints for fields that already exist.

## Verified context

The frontend already renders and serializes the highlighted fields. The deployed contract already exposes them under `basic_information`. Legal Business Name and Customer Category were invisible because this firm's Objects & Fields settings were false, not because those backend fields were absent. Those two preferences have now been enabled for the supplied demo firm; no other field preferences changed. Do not globally reset existing organizations' settings.

## Existing field mapping to preserve

| UI label | Canonical request/response field |
| --- | --- |
| Customer / Business Name | `basic_information.customer_name` |
| Legal Business Name | `basic_information.legal_business_name` |
| Display Name | `basic_information.display_name` |
| Customer Category | `basic_information.customer_category` |
| Customer Type | `basic_information.customer_type` |
| Industry | `basic_information.industry` |
| Status | `basic_information.status` |
| Customer Since | `basic_information.customer_since` |

“Business Name” in the screenshot is the existing customer name label. Do not introduce a second canonical `business_name` field for it. Keep legal business name, display name, customer type, customer category and industry separate.

## Required checks and corrections

1. Trace existing POST `/customers`, PATCH `/customers/{customer_id}`, GET `/customers/{customer_id}` and list responses. Confirm legal business name, display name and customer category persist and survive create → GET → edit/PATCH → fresh GET. Add missing serializer/model/database wiring only if inspection proves it missing. If migrations are needed, make them backward compatible and do not overwrite existing data.
2. Keep customer name required. Legal business name, display name and customer category remain optional. Preserve current documented empty/null handling; document it so the frontend can distinguish intentional clearing from an omitted field. PATCH must retain omitted values. Keep existing field lengths, dates/timezones and status compatibility unless a specific defect requires correction.
3. Customer Type must accept `individual`, `business`, `distributor`, and the newly requested `reseller`. Preserve existing `government`, `dealer`, and `vendor` values so old customers still save. The public schema describes customer_type as a string, but its current description does not mention reseller: check internal validation/enums and update the documentation and allowed values where necessary.
4. Industry must accept the frontend's exact values: `IT`, `Healthcare`, `Banking`, `Manufacturing`, `Food & Beverage`, `Retail`, `Wholesale`, `Corporate`, `Education`, `Hospitality`, `Services`. Check internal validators rather than assuming a string in OpenAPI means every value is accepted. Preserve existing stored industry values; do not infer industry from customer type/category.
5. Preserve Customer Category options: `Retail`, `Wholesale`, `Corporate`, `VIP`, `Dealer`, `Distributor`. A customer's type `distributor` and category `Distributor` are independent fields and must round-trip separately.
6. Verify GET/PUT `/organizations/settings/fields` exposes the existing dotted keys `basic_information.customer_name`, `basic_information.legal_business_name`, `basic_information.display_name`, and `basic_information.customer_category`. Customer name is mandatory/non-hideable; the other three are optional. New organization defaults should follow the existing documented policy. Preserve explicitly saved preferences, admin-only writes, organization isolation and existing dependency resolution. Do not bypass field visibility in the frontend or make optional fields mandatory to force them visible.
7. Keep the customer business ID backend-generated/read-only. It is shown as header metadata after saving, not as an editable field. Do not require it on customer creation. Do not mix it with the internal UUID.
8. Add focused tests for the four requested customer types, the four highlighted industries, legacy type values, distinct type/category values, all highlighted field round trips, omitted-field PATCH preservation, optional-field handling, field settings and cross-organization authorization. Use isolated fixtures rather than creating/changing production customer records or globally enabling preferences.

## Expected handoff

Report exactly what was already supported versus what was corrected, exact files changed, any migrations, tests and results, updated OpenAPI/examples, and required deployment steps. If the backend already supports a field end to end, say so instead of adding a duplicate. Do not claim a deployed save/load acceptance check passed unless it was actually performed against the deployed build.

Example sectioned body (other sections may still be needed by the existing customer endpoint):

```json
{
  "basic_information": {
    "customer_name": "Example Trading",
    "legal_business_name": "Example Trading Private Limited",
    "display_name": "Example Trading",
    "customer_category": "Wholesale",
    "customer_type": "reseller",
    "industry": "IT",
    "status": "active",
    "customer_since": "2026-10-24T00:00:00Z"
  }
}
```
