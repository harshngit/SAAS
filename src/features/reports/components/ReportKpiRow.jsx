import { ListOverview, ListSummary, ListStatCard } from '../../../components/ui/ListPresentation'
import { resolveSummaryValue, formatSummaryValue } from '../reportDataUtils'
import { resolveCardVisual } from './ReportSummaryCards'

// Five or six cards go three-per-row until the screen is very wide (1850px) - six currency values such as
// "₹7,47,118.03" do not fit one row at laptop widths and would wrap mid-number.
const COLUMNS = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-3 2xl:grid-cols-5', 6: 'lg:grid-cols-3 min-[1850px]:grid-cols-6' }

const SINGLE_ROW = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'sm:grid-cols-3 lg:grid-cols-3', 4: 'sm:grid-cols-4 lg:grid-cols-4', 5: 'sm:grid-cols-3 lg:grid-cols-5', 6: 'sm:grid-cols-3 lg:grid-cols-6' }

// The report summary as the same KPI strip every list page (Customers, Purchases, Expenses, ...)
// shows directly under the page heading. Same data rules as ReportSummaryCards: a card whose
// backend key is not in the response is skipped, never shown as a made-up zero. While the report is
// loading every configured card is shown as a skeleton so the strip does not jump.
// singleRow keeps every card on one line from the lg breakpoint (Sales Overview). The value font scales with the
// card width (container query in ListStatCard), so six cards still fit without wrapping mid-number.
export default function ReportKpiRow({ summary, cards = [], loading = false, singleRow = false }) {
  const resolved = cards
    .map((card) => ({ ...card, value: resolveSummaryValue(summary, card.keys), visual: resolveCardVisual(card.label) }))
    .filter((card) => loading || card.value !== undefined)

  if (resolved.length === 0) return null

  const columns = singleRow ? SINGLE_ROW[Math.min(resolved.length, 6)] : COLUMNS[Math.min(resolved.length, 6)]

  return (
    <ListOverview>
      <ListSummary loading={loading} className={`grid-cols-2 ${columns}`}>
        {resolved.map((card) => (
          <ListStatCard key={card.label} icon={card.visual.icon} label={card.label} value={loading ? '' : formatSummaryValue(card.value, card.format)} />
        ))}
      </ListSummary>
    </ListOverview>
  )
}
