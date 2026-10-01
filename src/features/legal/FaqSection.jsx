import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

function FaqItem({ question, answer }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border-b border-neutral-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 py-3.5 text-left"
      >
        <span className="text-sm font-medium text-neutral-900">{question}</span>
        <ChevronDown className={`size-4 shrink-0 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {isOpen && <p className="pb-3.5 text-sm leading-6 text-neutral-600">{answer}</p>}
    </div>
  )
}

export default function FaqSection({ title, items }) {
  return (
    <div>
      <h2 className="font-(--font-display) text-sm font-semibold uppercase tracking-wide text-primary-700">{title}</h2>
      <div className="mt-2">
        {items.map((item) => (
          <FaqItem key={item.question} question={item.question} answer={item.answer} />
        ))}
      </div>
    </div>
  )
}
