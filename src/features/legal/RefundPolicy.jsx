import LegalPageLayout from './LegalPageLayout'
import LegalSection from './LegalSection'

const LAST_UPDATED = '[LAST UPDATED DATE]'

export default function RefundPolicy() {
  return (
    <LegalPageLayout title="Subscription, Cancellation & Refund Policy" description={`Last updated: ${LAST_UPDATED}`}>
      <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
        This page is a product draft. Refund, cancellation and proration rules below are placeholders until finalized by the
        business.
      </p>

      <LegalSection title="Monthly plans">
        <p>Monthly plans are billed in advance for each monthly period.</p>
      </LegalSection>

      <LegalSection title="Yearly plans">
        <p>Yearly plans are billed in advance for a 12-month period. [YEARLY-PLAN DISCOUNT/TERMS, IF ANY].</p>
      </LegalSection>

      <LegalSection title="Plan activation">
        <p>A plan is activated as soon as payment is confirmed (for online payments), or once a Super Admin approves an upgrade
          request (for manual activation).</p>
      </LegalSection>

      <LegalSection title="Plan upgrades">
        <p>You can upgrade your plan at any time from the Plans page. [PRORATION RULE] for the remainder of the current billing
          period.</p>
      </LegalSection>

      <LegalSection title="Failed payments">
        <p>If an online payment fails, your plan is not activated or renewed and you can retry the payment from the Plans page.</p>
      </LegalSection>

      <LegalSection title="Cancellation">
        <p>[CANCELLATION RULE] - describe how and when a subscription can be cancelled, and what happens to access afterwards.</p>
      </LegalSection>

      <LegalSection title="Plan expiry">
        <p>If a plan isn't renewed before it expires, access may be restricted until it's renewed. You'll see a reminder as your
          plan nears its expiry date.</p>
      </LegalSection>

      <LegalSection title="Refund eligibility">
        <p>[REFUND WINDOW] - describe the circumstances and time window, if any, under which a payment is refundable.</p>
      </LegalSection>

      <LegalSection title="Non-refundable cases">
        <p>[NON-REFUNDABLE CASES] - e.g. partial billing periods already used, or payments outside the refund window.</p>
      </LegalSection>

      <LegalSection title="Taxes">
        <p>Prices may be subject to applicable taxes (e.g. GST), charged in addition to the listed plan price. [TAX DETAILS].</p>
      </LegalSection>

      <LegalSection title="Payment gateway charges">
        <p>Online payments are processed by Razorpay. [GATEWAY CHARGE / FEE DETAILS, IF ANY ARE PASSED ON].</p>
      </LegalSection>

      <LegalSection title="Support / contact">
        <p>
          For billing questions, refund requests or cancellations, contact [BILLING EMAIL].
        </p>
      </LegalSection>
    </LegalPageLayout>
  )
}
