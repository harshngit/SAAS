import { ROLES } from '../../auth/roles'

export const customerBasePathByRole = {
  [ROLES.ADMIN]: '/admin/customers',
  [ROLES.SALES_OFFICER]: '/sales/customers',
  [ROLES.DELIVERY_PARTNER]: '/delivery/customers',
}

// Matches the customer_category enum the backend actually stores (see CustomerForm.jsx optionValues.customerCategory).
export const customerCategoryOptions = [
  'Retail',
  'Wholesale',
  'Corporate',
  'VIP',
  'Dealer',
  'Distributor',
].map((category) => ({ value: category, label: category }))
