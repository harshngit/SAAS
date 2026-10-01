import LegalPageLayout from './LegalPageLayout'
import LegalSection from './LegalSection'

const LAST_UPDATED = '[LAST UPDATED DATE]'

export default function TermsOfService() {
  return (
    <LegalPageLayout title="Terms of Service" description={`Last updated: ${LAST_UPDATED}`}>
      <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
        This page is a product draft. Bracketed placeholders mark details that still need final legal/business sign-off before
        these terms are treated as complete.
      </p>

      <LegalSection title="About Beas Suite">
        <p>
          Beas Suite is a SaaS platform for running sales, delivery, inventory and billing operations. By creating an account or
          using Beas Suite, you agree to these Terms of Service.
        </p>
      </LegalSection>

      <LegalSection title="Account eligibility">
        <p>You must be authorized to act on behalf of your organization to create an account and agree to these terms.</p>
      </LegalSection>

      <LegalSection title="Organization responsibility">
        <p>Your organization is responsible for the accuracy of the data it enters, for managing its own staff accounts and
          permissions, and for how it uses Beas Suite.</p>
      </LegalSection>

      <LegalSection title="Subscription plans">
        <p>Access to Beas Suite is provided under subscription plans described on the Plans page. Plan features and pricing may
          change; see the Subscription, Cancellation & Refund Policy for billing details.</p>
      </LegalSection>

      <LegalSection title="Payments and billing">
        <p>Online payments are processed through Razorpay. [BILLING ENTITY / INVOICING DETAILS].</p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You agree to use Beas Suite in line with our Acceptable Use Policy.</p>
      </LegalSection>

      <LegalSection title="User / staff access responsibility">
        <p>Your organization's Admin is responsible for which staff accounts exist and what access (role/permissions) each one
          has.</p>
      </LegalSection>

      <LegalSection title="Customer data responsibility">
        <p>Your organization is the data controller for the customer, order and payment data it enters into Beas Suite, and is
          responsible for having a lawful basis to process it.</p>
      </LegalSection>

      <LegalSection title="Service availability">
        <p>We aim to keep Beas Suite available and reliable, but do not guarantee uninterrupted access. [UPTIME / SLA DETAILS, IF
          ANY].</p>
      </LegalSection>

      <LegalSection title="Suspension / termination">
        <p>We may suspend or terminate an account for violation of these terms or the Acceptable Use Policy, or for non-payment,
          [SUSPENSION / TERMINATION PROCESS].</p>
      </LegalSection>

      <LegalSection title="Intellectual property">
        <p>Beas Suite's software, design and branding belong to [LEGAL COMPANY NAME]. Your organization retains ownership of the
          business data it enters.</p>
      </LegalSection>

      <LegalSection title="Third-party services">
        <p>Beas Suite integrates with third-party services such as Razorpay (payments) and Google (sign-in). Use of those
          services is also subject to their own terms.</p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>Beas Suite is provided "as is". To the maximum extent permitted by law, [LEGAL COMPANY NAME] is not liable for indirect
          or consequential damages arising from use of the service. [FULL LIABILITY CLAUSE].</p>
      </LegalSection>

      <LegalSection title="Changes to terms">
        <p>We may update these terms from time to time. Material changes will be reflected by updating the "Last updated" date
          above.</p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>These terms are governed by the laws of [LEGAL JURISDICTION].</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          [LEGAL COMPANY NAME]
          <br />
          [REGISTERED ADDRESS]
          <br />
          Email: [SUPPORT EMAIL]
        </p>
      </LegalSection>
    </LegalPageLayout>
  )
}
