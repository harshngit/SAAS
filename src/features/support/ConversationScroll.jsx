import { useEffect, useRef } from 'react'

// The ticket conversation lives in its own bounded, scrollable area (about 575px at most) so a long
// thread never makes the whole page thousands of pixels tall. It opens scrolled to the newest message
// and jumps back there whenever `version` changes (a reply was sent, the ticket was reloaded).
export default function ConversationScroll({ version, children, className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    const element = ref.current
    if (element) element.scrollTop = element.scrollHeight
  }, [version])

  return (
    <div
      ref={ref}
      data-testid="ticket-conversation"
      role="log"
      aria-label="Conversation"
      tabIndex={0}
      className={`max-h-[min(36rem,55vh)] min-h-24 space-y-4 overflow-y-auto rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${className}`}
    >
      {children}
    </div>
  )
}
