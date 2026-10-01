import LegalPageLayout from './LegalPageLayout'
import LegalSection from './LegalSection'

export default function AcceptableUsePolicy() {
  return (
    <LegalPageLayout title="Acceptable Use Policy" description="What you can and can't do on Beas Suite.">
      <LegalSection title="The short version">
        <p>Use Beas Suite lawfully, respect other users and accounts, and don't try to break or abuse the platform.</p>
      </LegalSection>

      <LegalSection title="You may not">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Use Beas Suite for any illegal purpose.</li>
          <li>Access, or try to access, an account, organization or data that isn't yours.</li>
          <li>Abuse, harass or interfere with other users or accounts.</li>
          <li>Upload malware, viruses or other malicious files.</li>
          <li>Send spam or unsolicited bulk messages through the platform.</li>
          <li>Share, sell or misuse account credentials.</li>
          <li>Scrape, probe or attack the platform's systems or infrastructure.</li>
          <li>Misuse the WhatsApp or payment (Razorpay) integrations - for example, to send spam or process payments outside their
            intended purpose.</li>
          <li>Attempt to bypass permissions, roles or security controls.</li>
          <li>Process customer or personal data unlawfully through the platform.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Enforcement">
        <p>Violating this policy may result in suspension or termination of your account, as described in the Terms of Service.</p>
      </LegalSection>

      <LegalSection title="Reporting a violation">
        <p>If you believe someone is misusing Beas Suite, contact us at [SUPPORT EMAIL].</p>
      </LegalSection>
    </LegalPageLayout>
  )
}
