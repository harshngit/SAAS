import LegalPageLayout from './LegalPageLayout'
import LegalSection from './LegalSection'

const LAST_UPDATED = '[LAST UPDATED DATE]'

export default function PrivacyPolicy({ embedded = false }) {
  return (
    <LegalPageLayout title="Privacy Policy" description={`Last updated: ${LAST_UPDATED}`} embedded={embedded}>
      <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
        This page is a product draft. Bracketed placeholders mark details that still need final legal/business sign-off before this
        policy is treated as complete.
      </p>

      <LegalSection title="Information we collect">
        <p>
          Beas Suite ("we", "us", "our") is a SaaS platform used by organizations to run their sales, delivery, inventory and
          billing operations. We collect information in the categories below in order to provide the service.
        </p>
      </LegalSection>

      <LegalSection title="Organization / business data">
        <p>Company name, address, GSTIN/tax details, logo and branding assets, and other business settings you configure.</p>
      </LegalSection>

      <LegalSection title="Customer / contact data">
        <p>
          Names, phone numbers, addresses and order/invoice history that your organization enters about its own customers, to
          operate features like orders, deliveries and invoicing.
        </p>
      </LegalSection>

      <LegalSection title="Employee / staff data">
        <p>Names, roles, contact details, attendance and leave records, and uploaded documents for staff your organization adds.</p>
      </LegalSection>

      <LegalSection title="Authentication / account data">
        <p>Login email, hashed password (or Google sign-in identifier), and session/token information used to keep you signed in.</p>
      </LegalSection>

      <LegalSection title="Usage / log information">
        <p>Basic technical logs (e.g. request timestamps, error logs) used to operate and troubleshoot the service.</p>
      </LegalSection>

      <LegalSection title="Why we process this data">
        <p>To provide and operate Beas Suite's features, to support your organization's use of the product, and to meet legal and
          billing obligations.</p>
      </LegalSection>

      <LegalSection title="Data storage">
        <p>Data is stored with our hosting/infrastructure providers. [DATA STORAGE LOCATION / REGION].</p>
      </LegalSection>

      <LegalSection title="Security">
        <p>We use reasonable technical and organizational measures to protect data, including role-based access controls within
          the product. No method of transmission or storage is 100% secure.</p>
      </LegalSection>

      <LegalSection title="Service providers / subprocessors">
        <p>
          We use third-party service providers to operate parts of the service, for example Razorpay for payment processing.
          [FULL SUBPROCESSOR LIST].
        </p>
      </LegalSection>

      <LegalSection title="Data retention">
        <p>We retain data for as long as your organization's account is active, and as needed to comply with legal obligations.
          [DATA RETENTION PERIOD].</p>
      </LegalSection>

      <LegalSection title="Data export / deletion">
        <p>
          You can request export or deletion of your organization's data by contacting us at [SUPPORT EMAIL]. [DELETION TIMELINE /
          PROCESS].
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>Depending on your jurisdiction, you may have rights to access, correct, export or delete your data. Contact us at
          [SUPPORT EMAIL] to exercise these rights.</p>
      </LegalSection>

      <LegalSection title="Cookies / analytics">
        <p>Beas Suite uses only essential cookies/local storage needed to keep you signed in and remember your preferences. We do
          not currently use non-essential tracking or analytics cookies.</p>
      </LegalSection>

      <LegalSection title="Policy updates">
        <p>We may update this policy from time to time. Material changes will be reflected by updating the "Last updated" date
          above.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          [LEGAL COMPANY NAME]
          <br />
          [REGISTERED ADDRESS]
          <br />
          Email: [SUPPORT EMAIL]
          <br />
          Jurisdiction: [LEGAL JURISDICTION]
        </p>
      </LegalSection>
    </LegalPageLayout>
  )
}
