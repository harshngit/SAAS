import { Check, Minus } from 'lucide-react'
import Card from '../../components/ui/Card'
import { ENTITLEMENT_KEYS } from '../../entitlements/entitlementKeys'

// Every row reads straight from each plan's own real `entitlements`/`max_*` fields (the same
// source the backend uses to compute GET /organizations/me/entitlements) - never a hardcoded
// per-plan-name guess, so this can never drift from what a plan is actually configured to allow.
// Balance Sheet is deliberately NOT a row here - there is still no real backend report for it
// (see BalanceSheet.jsx), so no plan can honestly be marked as including it.
const ROWS = [
  { label: 'Users', type: 'limit', key: 'max_users' },
  { label: 'Warehouses', type: 'limit', key: 'max_warehouses' },
  { label: 'Customers', type: 'feature', key: ENTITLEMENT_KEYS.CRM_CUSTOMERS },
  { label: 'Leads', type: 'feature', key: ENTITLEMENT_KEYS.CRM_LEADS },
  { label: 'Quotations', type: 'feature', key: ENTITLEMENT_KEYS.CRM_QUOTATIONS },
  { label: 'Vehicles', type: 'feature', key: ENTITLEMENT_KEYS.SALES_VEHICLES },
  { label: 'Vehicle Stock', type: 'feature', key: ENTITLEMENT_KEYS.SALES_VEHICLE_STOCK },
  {
    label: 'Employee Management',
    type: 'feature',
    anyOf: [ENTITLEMENT_KEYS.EMPLOYEE_STAFF, ENTITLEMENT_KEYS.EMPLOYEE_ATTENDANCE, ENTITLEMENT_KEYS.EMPLOYEE_LEAVES, ENTITLEMENT_KEYS.EMPLOYEE_ROLES_PERMISSIONS],
  },
  { label: 'Basic Reports', type: 'feature', key: ENTITLEMENT_KEYS.FINANCE_REPORTS },
  { label: 'Profit & Loss', type: 'feature', key: ENTITLEMENT_KEYS.REPORT_PROFIT_LOSS },
  { label: 'Cash Flow', type: 'feature', key: ENTITLEMENT_KEYS.REPORT_CASH_FLOW },
  { label: 'GST Filing', type: 'feature', key: ENTITLEMENT_KEYS.REPORT_GST_FILING },
  { label: 'WhatsApp Delivery Notifications', type: 'feature', key: ENTITLEMENT_KEYS.NOTIFICATIONS_WHATSAPP_DELIVERY },
]

function cellValue(plan, row) {
  if (row.type === 'limit') {
    const value = plan[row.key]
    return value === null || value === undefined ? 'Unlimited' : String(value)
  }
  const entitlements = plan.entitlements || {}
  const isOn = row.anyOf ? row.anyOf.some((key) => entitlements[key]) : Boolean(entitlements[row.key])
  return isOn
    ? <Check className="mx-auto size-4 text-green-600" aria-hidden="true" />
    : <Minus className="mx-auto size-4 text-neutral-300" aria-hidden="true" />
}

export default function PlanComparisonTable({ plans }) {
  if (!plans || plans.length === 0) return null

  return (
    <Card title="Compare Plans" subtitle="What each plan actually includes, read directly from its configuration.">
      <div className="overflow-x-auto rounded-xl border border-neutral-100">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
              <th className="px-4 py-2.5">Feature</th>
              {plans.map((plan) => (
                <th key={plan.id} className="px-4 py-2.5 text-center">{plan.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {ROWS.map((row) => (
              <tr key={row.label}>
                <td className="px-4 py-2.5 font-medium text-neutral-700">{row.label}</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-4 py-2.5 text-center text-neutral-700">{cellValue(plan, row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
