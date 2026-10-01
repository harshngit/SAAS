export default function LegalSection({ title, children }) {
  return (
    <section>
      <h2 className="font-(--font-display) text-base font-semibold tracking-tight text-fg">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-6 text-neutral-600">{children}</div>
    </section>
  )
}
