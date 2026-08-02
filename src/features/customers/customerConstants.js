import { ROLES } from '../../auth/roles'

export const customerBasePathByRole = {
  [ROLES.ADMIN]: '/admin/customers',
  [ROLES.SALES_OFFICER]: '/sales/customers',
  [ROLES.DELIVERY_PARTNER]: '/delivery/customers',
}

export const customerTypeOptions = [
  'Hotel',
  'Restaurant',
  'Household',
  'Retail',
  'Office',
  'Institution',
  'Society',
  'Event Venue',
  'Caterer',
  'Other',
].map((type) => ({ value: type, label: type }))
