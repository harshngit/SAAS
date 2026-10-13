import { ArrowDownCircle, ArrowUpCircle, Clock, Equal, Wallet } from 'lucide-react'
import { resolveSummaryValue, formatSummaryValue } from '../reportDataUtils'

const TONE_CLASSES = {
  primary: 'bg-primary-50 text-primary-600',
  success: 'bg-green-50 text-green-600',
  danger: 'bg-red-50 text-red-600',
  warning: 'bg-amber-50 text-amber-600',
  neutral: 'bg-neutral-100 text-neutral-500',
}

// Every card's tone/icon is derived from its own label text - never a per-report hand-picked
// list (this file has no knowledge of which specific report a card belongs to), so every report's
// summary cards get the same colored-icon treatment consistently, not just GST's.
function resolveCardVisual(label) {
  const normalized = String(label || '').toLowerCase()
  if (/\boutput\b/.test(normalized)) return { tone: 'primary', icon: ArrowUpCircle }
  if (/\binput\b/.test(normalized)) return { tone: 'danger', icon: ArrowDownCircle }
  if (/\bnet\b/.test(normalized)) return { tone: 'success', icon: Equal }
  if (/(pending|due|overdue|outstanding|draft)/.test(normalized)) return { tone: 'warning', icon: Clock }
  return { tone: 'neutral', icon: Wallet }
}

// Report-specific summary cards, in the config's own order - never a generic
// Object.entries(summary) dump. A card is skipped entirely when none of its candidate backend
// keys are present, rather than showing a fabricated zero.
export default function ReportSummaryCards({ summary, cards = [] }) {
  const resolved = cards
    .map((card) => ({ ...card, value: resolveSummaryValue(summary, card.keys), visual: resolveCardVisual(card.label) }))
    .filter((card) => card.value !== undefined)

  if (resolved.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {resolved.map((card) => (
        <div key={card.label} className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${TONE_CLASSES[card.visual.tone]}`}>
            <card.visual.icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{card.label}</p>
            <p className="mt-0.5 truncate text-lg font-semibold text-neutral-900">{formatSummaryValue(card.value, card.format)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
