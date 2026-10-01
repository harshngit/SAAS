import { Clock, CreditCard, Mail } from 'lucide-react'
import LegalPageLayout from './LegalPageLayout'

function ContactRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-neutral-100 bg-neutral-50 p-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs text-neutral-400">{label}</p>
        <p className="text-sm font-medium text-neutral-900">{value}</p>
      </div>
    </div>
  )
}

export default function ContactSupport() {
  return (
    <LegalPageLayout title="Contact & Support" description="Beas Suite Support">
      <p>
        Have a question, found a bug, or need help with billing? Reach out and our team will get back to you.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <ContactRow icon={Mail} label="Support Email" value="[SUPPORT EMAIL]" />
        <ContactRow icon={CreditCard} label="Billing Email" value="[BILLING EMAIL]" />
        <ContactRow icon={Clock} label="Support Hours" value="[SUPPORT HOURS]" />
      </div>

      <p className="text-xs text-neutral-400">
        For urgent account or billing issues, please include your organization name in your email so we can find your account
        quickly.
      </p>
    </LegalPageLayout>
  )
}
