// =============================================================================
// FRONTEND DEMO / MOCK RECORDS - UI TESTING ONLY
// -----------------------------------------------------------------------------
// These fixtures make every Follow-up and Visit "next action" state visible on
// screen without hand-creating each scenario. They are appended to the page
// state AFTER the real API data loads and are NEVER sent to any backend
// endpoint (no create/update/delete calls carry a `demo-` id).
//
// TODO: remove demo records (or set DEMO_RECORDS_ENABLED = false) when the
// backend provides seeded test data.
// =============================================================================

export const DEMO_RECORDS_ENABLED = true

export function isDemoRecord(id) {
  return typeof id === 'string' && id.startsWith('demo-')
}

const DAY_MS = 86_400_000

// ISO timestamp `days` from now at a fixed hour (local).
function offsetIso(days, hour = 10) {
  const date = new Date(Date.now() + days * DAY_MS)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

// -----------------------------------------------------------------------------
// Demo leads - only their status matters (feeds leadIndex for eligibility rules).
// Not injected into any lead picker, only into the status lookup maps.
// -----------------------------------------------------------------------------
export const demoLeads = [
  { id: 'demo-lead-vikram', name: 'Vikram Joshi', leadStatus: 'new', convertedCustomerId: '' },
  { id: 'demo-lead-arjun', name: 'Arjun Mehta', leadStatus: 'contacted', convertedCustomerId: '' },
  { id: 'demo-lead-neeraj', name: 'Neeraj Shah', leadStatus: 'contacted', convertedCustomerId: '' },
  { id: 'demo-lead-rohit', name: 'Rohit Verma', leadStatus: 'qualified', convertedCustomerId: '' },
  { id: 'demo-lead-aman', name: 'Aman Kapoor', leadStatus: 'qualified', convertedCustomerId: '' },
  { id: 'demo-lead-priya', name: 'Priya Nair', leadStatus: 'won', convertedCustomerId: 'demo-customer-priya' },
  { id: 'demo-lead-kunal', name: 'Kunal Sharma', leadStatus: 'lost', convertedCustomerId: '' },
  { id: 'demo-lead-sneha', name: 'Sneha Iyer', leadStatus: 'contacted', convertedCustomerId: '' },
  { id: 'demo-lead-manish', name: 'Manish Rao', leadStatus: 'new', convertedCustomerId: '' },
]

function demoFollowUp(overrides) {
  return {
    id: '',
    customerId: '',
    customerName: '',
    leadId: '',
    leadName: '',
    visitId: '',
    assignedToId: '',
    assignedToName: 'sales',
    title: '',
    description: '',
    dueDate: offsetIso(0, 12),
    priority: 'medium',
    status: 'pending',
    outcome: '',
    outcomeNotes: '',
    completedAt: null,
    createdAt: offsetIso(-3),
    ...overrides,
  }
}

// -----------------------------------------------------------------------------
// Demo follow-ups - spread across Today / Upcoming / Overdue / Completed tabs.
// -----------------------------------------------------------------------------
export const demoFollowUps = [
  // --- Pending (Today) ---
  demoFollowUp({
    id: 'demo-fu-today-vikram',
    leadId: 'demo-lead-vikram',
    leadName: 'Vikram Joshi',
    title: 'Call Vikram Joshi',
    description: 'Introductory call to understand the requirement.',
    dueDate: offsetIso(0, 16),
    status: 'pending',
  }),
  // --- Pending (Upcoming) ---
  demoFollowUp({
    id: 'demo-fu-upcoming-sneha',
    leadId: 'demo-lead-sneha',
    leadName: 'Sneha Iyer',
    title: 'Email pricing sheet to Sneha Iyer',
    description: 'Share the wholesale price list and standard terms.',
    dueDate: offsetIso(4, 11),
    priority: 'low',
    status: 'pending',
  }),
  // --- Pending (Overdue) ---
  demoFollowUp({
    id: 'demo-fu-overdue-manish',
    leadId: 'demo-lead-manish',
    leadName: 'Manish Rao',
    title: 'Call Manish Rao to reschedule',
    description: 'Missed the last call - reschedule a demo.',
    dueDate: offsetIso(-3, 15),
    priority: 'high',
    status: 'pending',
  }),

  // --- Completed (each tests a next-action rule) ---
  demoFollowUp({
    id: 'demo-fu-done-arjun-interested',
    leadId: 'demo-lead-arjun',
    leadName: 'Arjun Mehta',
    title: 'Call Arjun Mehta',
    description: 'Discussed catalogue; wants to think it over.',
    dueDate: offsetIso(-2, 10),
    status: 'completed',
    outcome: 'interested',
    outcomeNotes: 'Positive, will revert next week.',
    completedAt: offsetIso(-2, 12),
  }),
  demoFollowUp({
    id: 'demo-fu-done-neeraj-another',
    leadId: 'demo-lead-neeraj',
    leadName: 'Neeraj Shah',
    title: 'Call Neeraj Shah',
    description: 'Needs to consult his partner before deciding.',
    dueDate: offsetIso(-2, 14),
    status: 'completed',
    outcome: 'need_another_followup',
    completedAt: offsetIso(-2, 15),
  }),
  demoFollowUp({
    id: 'demo-fu-done-rohit-visit',
    leadId: 'demo-lead-rohit',
    leadName: 'Rohit Verma',
    title: 'Call Rohit Verma',
    description: 'Wants an in-person walkthrough at his shop.',
    dueDate: offsetIso(-1, 11),
    status: 'completed',
    outcome: 'ready_for_visit',
    completedAt: offsetIso(-1, 12),
  }),
  demoFollowUp({
    id: 'demo-fu-done-aman-convert',
    leadId: 'demo-lead-aman',
    leadName: 'Aman Kapoor',
    title: 'Call Aman Kapoor',
    description: 'Confirmed order intent and quantities. Ready to onboard.',
    dueDate: offsetIso(-1, 16),
    priority: 'high',
    status: 'completed',
    outcome: 'ready_to_convert',
    completedAt: offsetIso(-1, 17),
  }),
  demoFollowUp({
    id: 'demo-fu-done-rohan-customer',
    customerId: 'demo-customer-rohan',
    customerName: 'Rohan Patil',
    title: 'Call Rohan Patil about renewal',
    description: 'Existing customer - annual renewal discussion.',
    dueDate: offsetIso(-1, 9),
    status: 'completed',
    outcome: 'ready_to_convert',
    completedAt: offsetIso(-1, 10),
  }),
  demoFollowUp({
    id: 'demo-fu-done-priya-converted',
    leadId: 'demo-lead-priya',
    leadName: 'Priya Nair',
    title: 'Onboarding call with Priya Nair',
    description: 'Lead already converted - onboarding handover.',
    dueDate: offsetIso(-4, 13),
    status: 'completed',
    outcome: 'ready_to_convert',
    completedAt: offsetIso(-4, 14),
  }),
  demoFollowUp({
    id: 'demo-fu-done-kunal-lost',
    leadId: 'demo-lead-kunal',
    leadName: 'Kunal Sharma',
    title: 'Call Kunal Sharma',
    description: 'Went with a competitor - lead marked Lost.',
    dueDate: offsetIso(-5, 11),
    status: 'completed',
    outcome: 'not_interested',
    completedAt: offsetIso(-5, 12),
  }),
]

function demoVisitFollowUp(overrides) {
  return {
    id: '',
    customerId: '',
    customerName: '',
    visitId: '',
    assignedToId: '',
    assignedToName: 'sales',
    title: '',
    description: '',
    dueDate: offsetIso(2, 10),
    priority: 'medium',
    status: 'pending',
    completedAt: null,
    createdAt: offsetIso(-1),
    ...overrides,
  }
}

function demoVisit(overrides) {
  return {
    id: '',
    customerId: '',
    customerName: '',
    customerPhone: '',
    leadId: '',
    leadName: '',
    userId: '',
    userName: 'sales',
    visitDate: offsetIso(-1, 11),
    visitType: 'meeting',
    purpose: '',
    notes: '',
    outcome: '',
    status: 'completed',
    location: '',
    followUps: [],
    createdAt: offsetIso(-1),
    ...overrides,
  }
}

// -----------------------------------------------------------------------------
// Demo visits - one per next-action rule. All Completed so they expand.
// -----------------------------------------------------------------------------
export const demoVisits = [
  demoVisit({
    id: 'demo-visit-neha-customer',
    customerId: 'demo-customer-neha',
    customerName: 'Neha Sharma',
    visitType: 'meeting',
    purpose: 'Catalogue review',
    notes: 'Walked through the product range; customer reviewing internally.',
    outcome: 'interested',
    visitDate: offsetIso(-2, 10),
  }),
  demoVisit({
    id: 'demo-visit-vikram-followup',
    leadId: 'demo-lead-vikram',
    leadName: 'Vikram Joshi',
    visitType: 'site_visit',
    purpose: 'Requirement check',
    notes: 'Discussed volumes; needs a written quotation before deciding.',
    outcome: 'followup_required',
    visitDate: offsetIso(-2, 14),
    followUps: [
      demoVisitFollowUp({
        id: 'demo-vft-vikram',
        title: 'Prepare quotation for Vikram Joshi',
        description: 'Quote 200 units, standard credit terms.',
        priority: 'high',
        dueDate: offsetIso(1, 10),
      }),
    ],
  }),
  demoVisit({
    id: 'demo-visit-aman-convert',
    leadId: 'demo-lead-aman',
    leadName: 'Aman Kapoor',
    visitType: 'meeting',
    purpose: 'Final discussion',
    notes: 'Agreed on pricing and delivery. Ready to become a customer.',
    outcome: 'ready_to_convert',
    visitDate: offsetIso(-1, 12),
    followUps: [
      demoVisitFollowUp({
        id: 'demo-vft-aman',
        title: 'Collect KYC documents from Aman Kapoor',
        description: 'GST certificate + address proof for onboarding.',
        dueDate: offsetIso(1, 12),
        status: 'pending',
      }),
    ],
  }),
  demoVisit({
    id: 'demo-visit-rohan-customer',
    customerId: 'demo-customer-rohan',
    customerName: 'Rohan Patil',
    visitType: 'meeting',
    purpose: 'Renewal discussion',
    notes: 'Existing customer keen to expand order size next quarter.',
    outcome: 'ready_to_convert',
    visitDate: offsetIso(-3, 15),
  }),
  demoVisit({
    id: 'demo-visit-priya-converted',
    leadId: 'demo-lead-priya',
    leadName: 'Priya Nair',
    visitType: 'meeting',
    purpose: 'Onboarding handover',
    notes: 'Lead already converted - this visit was the onboarding handover.',
    outcome: 'ready_to_convert',
    visitDate: offsetIso(-4, 11),
  }),
  demoVisit({
    id: 'demo-visit-kunal-lost',
    leadId: 'demo-lead-kunal',
    leadName: 'Kunal Sharma',
    visitType: 'site_visit',
    purpose: 'Follow-up meeting',
    notes: 'Chose a competitor on price. Lead marked Lost.',
    outcome: 'not_interested',
    visitDate: offsetIso(-6, 10),
  }),
]
