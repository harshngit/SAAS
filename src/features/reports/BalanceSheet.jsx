import { Link } from 'react-router-dom'
import { ArrowRight, IndianRupee, Scale, TrendingUp, Wallet, Warehouse } from 'lucide-react'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'

const USEFUL_LINKS = [
  { label: 'View Receivables', to: '/admin/receivables', icon: IndianRupee },
  { label: 'View Accounts Payable', to: '/admin/payables', icon: Wallet },
  { label: 'View Inventory Valuation', to: '/admin/reports?report=inventory-summary', icon: Warehouse },
  { label: 'View Profit & Loss', to: '/admin/reports?report=profit-loss', icon: TrendingUp },
]

// BACKEND LATER: a real Balance Sheet needs a Chart of Accounts, Journal Entries, a General
// Ledger, cash/bank account balances, fixed assets/depreciation, loans/borrowings and owner
// equity/capital - none of which this accounting module maintains yet (confirmed - no such
// endpoint exists). Rather than fabricate any of Assets/Liabilities/Equity/Cash/Bank/Capital/
// Loans/Fixed Assets, this page stays an honest "coming soon" state and links to the real,
// already-available reports that cover pieces of the same financial picture today.
export default function BalanceSheet() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Balance Sheet</h1>
        <p className="mt-1 text-sm text-neutral-500">View your organization's assets, liabilities and equity.</p>
      </div>

      <Card>
        <EmptyState
          icon={Scale}
          title="Balance Sheet is coming soon"
          description="A complete balance sheet requires accounting balances such as cash and bank accounts, assets, liabilities and equity, which are not yet maintained by the current accounting module."
        />

        <div className="mt-6 grid grid-cols-1 gap-3 border-t border-neutral-100 pt-6 sm:grid-cols-2">
          {USEFUL_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-4 transition-colors hover:bg-primary-50/40"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                  <link.icon className="size-4.5" aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-neutral-900">{link.label}</p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
