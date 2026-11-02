import {
  AlertCircle,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle,
  FileText,
  HandCoins,
  Info,
  Package,
  PhoneCall,
  Receipt,
  ShoppingCart,
  Truck,
  UserPlus,
} from 'lucide-react'

// One shared icon/badge/label map for every notification `type` this app shows, reused by both
// the Topbar dropdown and the full Notifications page - the contract (§3) explicitly says not to
// build a unique component per event, just an icon keyed off the broad `type`. Legacy
// alert/warning kept for any older rows still in that shape.
export const NOTIFICATION_TYPE_ICON = {
  order: ShoppingCart,
  delivery: Truck,
  success: CheckCircle,
  expense: Receipt,
  leave: CalendarClock,
  lead: UserPlus,
  follow_up: PhoneCall,
  quotation: FileText,
  day_end: HandCoins,
  inventory: Package,
  platform: Building2,
  info: Info,
  alert: AlertCircle,
  warning: AlertCircle,
}

export const NOTIFICATION_TYPE_BADGE_VARIANT = {
  order: 'info',
  delivery: 'info',
  success: 'success',
  expense: 'warning',
  leave: 'info',
  lead: 'primary',
  follow_up: 'primary',
  quotation: 'info',
  day_end: 'warning',
  inventory: 'warning',
  platform: 'neutral',
  info: 'info',
  alert: 'danger',
  warning: 'warning',
}

export const NOTIFICATION_TYPE_COLOR_CLASS = {
  order: 'text-blue-600 bg-blue-50',
  delivery: 'text-blue-600 bg-blue-50',
  success: 'text-green-600 bg-green-50',
  expense: 'text-amber-600 bg-amber-50',
  leave: 'text-blue-600 bg-blue-50',
  lead: 'text-primary-700 bg-primary-50',
  follow_up: 'text-primary-700 bg-primary-50',
  quotation: 'text-blue-600 bg-blue-50',
  day_end: 'text-amber-600 bg-amber-50',
  inventory: 'text-amber-600 bg-amber-50',
  platform: 'text-neutral-600 bg-neutral-50',
  info: 'text-blue-600 bg-blue-50',
  alert: 'text-red-600 bg-red-50',
  warning: 'text-amber-600 bg-amber-50',
}

export function notificationTypeIcon(type) {
  return NOTIFICATION_TYPE_ICON[type] || Bell
}

export function notificationTypeLabel(type) {
  if (!type) return 'Info'
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
