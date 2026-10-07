import { resolveSummaryValue, formatSummaryValue } from '../reportDataUtils'

// Report-specific summary cards, in the config's own order - never a generic
// Object.entries(summary) dump. A card is skipped entirely when none of its candidate backend
// keys are present, rather than showing a fabricated zero.
export default function ReportSummaryCards({ summary, cards = [] }) {
  const resolved = cards
    .map((card) => ({ ...card, value: resolveSummaryValue(summary, card.keys) }))
    .filter((card) => card.value !== undefined)

  if (resolved.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {resolved.map((card) => (
        <div key={card.label} className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{card.label}</p>
          <p className="mt-1 text-lg font-semibold text-neutral-900">{formatSummaryValue(card.value, card.format)}</p>
        </div>
      ))}
    </div>
  )
}
