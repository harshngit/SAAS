import LegalPageLayout from './LegalPageLayout'
import FaqSection from './FaqSection'

const SECTIONS = [
  {
    title: 'Account',
    items: [
      {
        question: 'How do I update my profile?',
        answer:
          'Your name, role and contact details are set up by your organization\'s Admin from Staff settings. You can view your own profile details from the profile menu in the top right.',
      },
      {
        question: 'How do I reset my password?',
        answer:
          'Use "Forgot password?" on the login page to reset your password by email. Admins can also change their password from Company Settings while logged in.',
      },
      {
        question: 'Who can access organization settings?',
        answer:
          'Company Settings, Roles & Permissions and other organization-wide settings are restricted to Admins. What each role can see is controlled from Roles & Permissions.',
      },
    ],
  },
  {
    title: 'Leads & Customers',
    items: [
      {
        question: 'How do I create a customer?',
        answer: 'Go to Customers and use "Add Customer" to create one directly, or convert an existing lead into a customer.',
      },
      {
        question: 'How do I convert a lead into a customer?',
        answer: 'Open the lead and use the convert action. This creates a linked customer record from the lead\'s details.',
      },
      {
        question: 'What happens to lead history after conversion?',
        answer: 'The lead stays in your Leads list with its full activity history - converting doesn\'t delete or hide it, it links the lead to the new customer record.',
      },
    ],
  },
  {
    title: 'Quotations & Orders',
    items: [
      {
        question: 'How do I create a quotation?',
        answer: 'From a lead or customer, use "New Quotation" to add items, pricing and terms, then send it for approval.',
      },
      {
        question: 'What happens when a quotation is accepted?',
        answer: 'An accepted quotation can be converted straight into a sales order, carrying over its items and pricing.',
      },
      {
        question: 'How do I create an order?',
        answer: 'Create one directly from Orders, or convert an accepted quotation. Either way you pick the customer, items and delivery details before confirming.',
      },
      {
        question: 'What happens when an order is confirmed?',
        answer: 'Confirming an order reserves the stock needed for it and moves it into the fulfilment/delivery pipeline.',
      },
      {
        question: 'Why can an order fail to confirm?',
        answer: 'Usually because there isn\'t enough available stock for one or more items, or a required field (like a delivery address) is missing.',
      },
    ],
  },
  {
    title: 'Inventory',
    items: [
      {
        question: 'How does stock reservation work?',
        answer: 'When an order is confirmed, the ordered quantity is reserved against your warehouse stock so it can\'t be double-sold to another order.',
      },
      {
        question: 'What is available stock?',
        answer: 'Available stock is your total stock on hand minus whatever is already reserved for confirmed orders.',
      },
      {
        question: 'How does vehicle stock work?',
        answer: 'A delivery partner loads stock onto their vehicle for a round of deliveries. That stock is tracked separately from warehouse stock until it\'s delivered or returned.',
      },
      {
        question: 'What happens after partial delivery?',
        answer: 'Delivered items are recorded against the order and leave vehicle stock; whatever wasn\'t delivered stays on the vehicle until it\'s delivered or returned at end of day.',
      },
    ],
  },
  {
    title: 'Delivery',
    items: [
      {
        question: 'Can an order be partially delivered?',
        answer: 'Yes - a delivery can cover some of an order\'s items now and the rest in a later delivery.',
      },
      {
        question: 'What is POD?',
        answer: 'POD (Proof of Delivery) is the photo and/or signature captured from the customer confirming an order was delivered.',
      },
      {
        question: 'How are delivery collections handled?',
        answer: 'Cash or other payments collected by a delivery partner during a delivery are recorded against that delivery and reconciled afterwards.',
      },
    ],
  },
  {
    title: 'Invoices & Payments',
    items: [
      {
        question: 'How do I generate an invoice?',
        answer: 'Invoices are generated from a confirmed order, or created directly for a customer from the Invoices section.',
      },
      {
        question: 'How do customer payments reduce outstanding balance?',
        answer: 'Recording a payment against an invoice reduces that invoice\'s outstanding amount, which updates the customer\'s overall receivables.',
      },
      {
        question: 'How do online invoice payments work?',
        answer: 'If your organization has Razorpay connected (Settings → Online Payments), you can send a customer a payment link from an invoice, and it\'s marked paid automatically once they pay.',
      },
    ],
  },
  {
    title: 'Suppliers & Purchases',
    items: [
      {
        question: 'How do suppliers, brands and products connect?',
        answer: 'Products belong to a brand and a category, and are typically sourced from one or more suppliers you purchase from.',
      },
      {
        question: 'What is GRN?',
        answer: 'GRN (Goods Receipt Note) records the stock you actually received against a purchase, which is what updates your warehouse stock.',
      },
      {
        question: 'How are supplier payments handled?',
        answer: 'Supplier invoices are recorded against a purchase, and payments made against them reduce what you owe that supplier (Accounts Payable).',
      },
    ],
  },
  {
    title: 'Expenses',
    items: [
      {
        question: 'Who can submit expenses?',
        answer: 'Any staff member with expense access can submit a claim with an amount, category and receipt.',
      },
      {
        question: 'How are expenses approved/rejected/reimbursed?',
        answer: 'A manager or Admin reviews submitted expenses and approves or rejects them. An approved expense is then marked as paid once it\'s been reimbursed.',
      },
    ],
  },
  {
    title: 'Staff & Permissions',
    items: [
      {
        question: 'How do roles and permissions work?',
        answer: 'Each staff member has a role (e.g. Sales Officer, Delivery Partner, Accountant). Roles & Permissions controls exactly what each role can view and do.',
      },
      {
        question: 'Can staff see all organization data?',
        answer: 'Not necessarily - data visibility can be scoped by role, so a staff member may only see records relevant to them (e.g. their own leads or deliveries).',
      },
    ],
  },
  {
    title: 'Appearance',
    items: [
      {
        question: 'How do I enable custom appearance?',
        answer: 'From Appearance & Branding in Settings, Admins can turn on a custom theme - colors, dark mode and an optional background image.',
      },
      {
        question: 'Can I use a custom background?',
        answer: 'Yes - Appearance & Branding lets you upload a background image, which applies a light glass effect across the app.',
      },
      {
        question: 'Who sees the organization theme?',
        answer: 'The custom theme applies for everyone signed in to that organization, once an Admin turns it on and saves it.',
      },
    ],
  },
  {
    title: 'Plans & Billing',
    items: [
      {
        question: 'How do I upgrade my plan?',
        answer: 'Go to Plans, choose a plan and pay online, or send an upgrade request for a Super Admin to approve manually if online payment isn\'t set up.',
      },
      {
        question: 'Where can I see billing history?',
        answer: 'Billing History (under Plans) lists past subscription payments for your organization.',
      },
      {
        question: 'What happens when my plan expires?',
        answer: 'You\'ll see a reminder as your plan nears expiry. Renew or upgrade from the Plans page to keep access uninterrupted.',
      },
    ],
  },
  {
    title: 'Support',
    items: [
      {
        question: 'How do I contact Beas Suite support?',
        answer: 'See the Contact & Support page for our support email and hours.',
      },
    ],
  },
]

export default function HelpFaq({ embedded = false }) {
  return (
    <LegalPageLayout title="Help & FAQ" description="Answers to common questions about using Beas Suite." embedded={embedded}>
      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <FaqSection key={section.title} title={section.title} items={section.items} />
        ))}
      </div>
    </LegalPageLayout>
  )
}
