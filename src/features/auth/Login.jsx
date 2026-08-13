import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Box,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock,
  Droplet,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogIn,
  PackageX,
  Search,
  Truck,
  Wallet,
  XCircle,
} from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import Button from '../../components/ui/Button'
import FullScreenLoader from '../../components/ui/FullScreenLoader'
import Input from '../../components/ui/Input'
import { login, resetPasswordDirect } from '../../api/auth'
import { resolveHomePath } from '../../auth/roles'
import { zodResolver } from '../../utils/zodResolver'

const countryCodes = [
  { value: 'IN:+91', code: '+91', flag: '\u{1F1EE}\u{1F1F3}', label: '\u{1F1EE}\u{1F1F3} +91' },
  { value: 'US:+1', code: '+1', flag: '\u{1F1FA}\u{1F1F8}', label: '\u{1F1FA}\u{1F1F8} +1' },
  { value: 'GB:+44', code: '+44', flag: '\u{1F1EC}\u{1F1E7}', label: '\u{1F1EC}\u{1F1E7} +44' },
  { value: 'AE:+971', code: '+971', flag: '\u{1F1E6}\u{1F1EA}', label: '\u{1F1E6}\u{1F1EA} +971' },
  { value: 'AU:+61', code: '+61', flag: '\u{1F1E6}\u{1F1FA}', label: '\u{1F1E6}\u{1F1FA} +61' },
  { value: 'JP:+81', code: '+81', flag: '\u{1F1EF}\u{1F1F5}', label: '\u{1F1EF}\u{1F1F5} +81' },
  { value: 'CN:+86', code: '+86', flag: '\u{1F1E8}\u{1F1F3}', label: '\u{1F1E8}\u{1F1F3} +86' },
  { value: 'DE:+49', code: '+49', flag: '\u{1F1E9}\u{1F1EA}', label: '\u{1F1E9}\u{1F1EA} +49' },
  { value: 'FR:+33', code: '+33', flag: '\u{1F1EB}\u{1F1F7}', label: '\u{1F1EB}\u{1F1F7} +33' },
  { value: 'IT:+39', code: '+39', flag: '\u{1F1EE}\u{1F1F9}', label: '\u{1F1EE}\u{1F1F9} +39' },
  { value: 'ES:+34', code: '+34', flag: '\u{1F1EA}\u{1F1F8}', label: '\u{1F1EA}\u{1F1F8} +34' },
  { value: 'NL:+31', code: '+31', flag: '\u{1F1F3}\u{1F1F1}', label: '\u{1F1F3}\u{1F1F1} +31' },
  { value: 'SG:+65', code: '+65', flag: '\u{1F1F8}\u{1F1EC}', label: '\u{1F1F8}\u{1F1EC} +65' },
  { value: 'MY:+60', code: '+60', flag: '\u{1F1F2}\u{1F1FE}', label: '\u{1F1F2}\u{1F1FE} +60' },
  { value: 'TH:+66', code: '+66', flag: '\u{1F1F9}\u{1F1ED}', label: '\u{1F1F9}\u{1F1ED} +66' },
  { value: 'BD:+880', code: '+880', flag: '\u{1F1E7}\u{1F1E9}', label: '\u{1F1E7}\u{1F1E9} +880' },
  { value: 'PK:+92', code: '+92', flag: '\u{1F1F5}\u{1F1F0}', label: '\u{1F1F5}\u{1F1F0} +92' },
  { value: 'LK:+94', code: '+94', flag: '\u{1F1F1}\u{1F1F0}', label: '\u{1F1F1}\u{1F1F0} +94' },
  { value: 'ZA:+27', code: '+27', flag: '\u{1F1FF}\u{1F1E6}', label: '\u{1F1FF}\u{1F1E6} +27' },
  { value: 'BR:+55', code: '+55', flag: '\u{1F1E7}\u{1F1F7}', label: '\u{1F1E7}\u{1F1F7} +55' },
  { value: 'MX:+52', code: '+52', flag: '\u{1F1F2}\u{1F1FD}', label: '\u{1F1F2}\u{1F1FD} +52' },
  { value: 'CA:+1', code: '+1', flag: '\u{1F1E8}\u{1F1E6}', label: '\u{1F1E8}\u{1F1E6} +1' },
]

const phonePlaceholders = {
  'IN:+91': '98450 11223',
  'US:+1': '202 555 0143',
  'GB:+44': '7400 123456',
  'AE:+971': '50 123 4567',
  'AU:+61': '412 345 678',
  'JP:+81': '90 1234 5678',
  'CN:+86': '138 0013 8000',
  'DE:+49': '1512 3456789',
  'FR:+33': '6 12 34 56 78',
  'IT:+39': '312 345 6789',
  'ES:+34': '612 34 56 78',
  'NL:+31': '6 12345678',
  'SG:+65': '8123 4567',
  'MY:+60': '12 345 6789',
  'TH:+66': '81 234 5678',
  'BD:+880': '1712 345678',
  'PK:+92': '300 1234567',
  'LK:+94': '71 234 5678',
  'ZA:+27': '82 123 4567',
  'BR:+55': '11 91234 5678',
  'MX:+52': '55 1234 5678',
  'CA:+1': '416 555 0198',
}

const sidebarItems = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'My Deliveries', icon: Truck },
  { label: 'Vehicle Stock', icon: Box },
  { label: 'Collections', icon: Wallet },
  { label: 'Attendance', icon: CalendarDays },
  { label: 'Expenses', icon: FileText },
  { label: 'End of Day Return', icon: PackageX },
]

const deliveryStats = [
  {
    label: 'Deliveries Today',
    value: '8',
    footer: 'View all deliveries',
    footerColor: 'text-primary-700',
    icon: Truck,
    iconClass: 'bg-primary-100 text-primary-700',
  },
  {
    label: 'Completed Today',
    value: '5',
    footer: "62% of today's deliveries",
    footerColor: 'text-primary-700',
    icon: CheckCircle2,
    iconClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    label: 'Pending Today',
    value: '3',
    footer: 'View pending',
    footerColor: 'text-orange-600',
    icon: Clock,
    iconClass: 'bg-orange-100 text-orange-600',
  },
  {
    label: 'Collection Due Today',
    value: '₹12,799',
    footer: 'View collection summary',
    footerColor: 'text-blue-600',
    icon: Wallet,
    iconClass: 'bg-blue-100 text-blue-600',
  },
]

const priorityRows = [
  {
    label: 'Pending deliveries',
    description: 'Deliveries yet to be completed',
    count: '3',
    icon: AlertTriangle,
    iconClass: 'bg-red-50 text-red-500',
  },
  {
    label: 'Failed reattempts',
    description: 'Require immediate attention',
    count: '1',
    icon: AlertTriangle,
    iconClass: 'bg-orange-50 text-orange-500',
  },
  {
    label: 'Payment pending',
    description: 'Cash to collect from customers',
    count: '2',
    icon: Wallet,
    iconClass: 'bg-amber-50 text-amber-500',
  },
  {
    label: 'Partial deliveries pending',
    description: 'Awaiting remaining items',
    count: '1',
    icon: Clock,
    iconClass: 'bg-orange-50 text-orange-500',
  },
]

const stockAlerts = [
  { name: 'Sparkling Water (750ml)', left: '12 left' },
  { name: 'Flavored Water - Orange (500ml)', left: '8 left' },
  { name: 'Alkaline Water (1L)', left: '5 left' },
  { name: 'Bottle Stand (Standard)', left: '4 left' },
]

const collectionSummary = [
  { label: 'Expected', value: '₹6,200', color: 'text-blue-600' },
  { label: 'Collected', value: '₹4,500', color: 'text-primary-700' },
  { label: 'Pending', value: '₹1,700', color: 'text-orange-600' },
]

const deliveryStatusTiles = [
  { label: 'Ready', value: '2', icon: Truck, iconClass: 'bg-primary-50 text-primary-700' },
  { label: 'In Transit', value: '2', icon: Truck, iconClass: 'bg-blue-50 text-blue-600' },
  { label: 'Delivered', value: '5', icon: CheckCircle2, iconClass: 'bg-emerald-50 text-emerald-600' },
  { label: 'Failed', value: '1', icon: XCircle, iconClass: 'bg-red-50 text-red-600' },
  { label: 'Partial', value: '1', icon: Clock, iconClass: 'bg-orange-50 text-orange-600' },
]

const deliveriesPreview = [
  { id: 'SO-2026-1011', customer: 'TechNova Solutions Pvt Ltd', scheduled: '10:00 AM', status: 'Ready', amount: '₹10,017', collection: 'Due', statusClass: 'bg-blue-50 text-blue-600', collectionClass: 'bg-orange-50 text-orange-600' },
  { id: 'SO-2026-1012', customer: 'Vinayaka Medical Store', scheduled: '10:30 AM', status: 'In Transit', amount: '₹1,239', collection: 'Paid', statusClass: 'bg-blue-50 text-blue-600', collectionClass: 'bg-emerald-50 text-emerald-600' },
  { id: 'SO-2026-1010', customer: 'Star Public School', scheduled: '11:00 AM', status: 'Partial', amount: '₹4,484', collection: 'Due', statusClass: 'bg-orange-50 text-orange-600', collectionClass: 'bg-orange-50 text-orange-600' },
  { id: 'SO-2026-1009', customer: 'Blue Orchid Banquet Hall', scheduled: '11:30 AM', status: 'Delivered', amount: '₹6,073', collection: 'Paid', statusClass: 'bg-emerald-50 text-emerald-700', collectionClass: 'bg-emerald-50 text-emerald-600' },
  { id: 'SO-2026-1008', customer: 'Cafe Mocha', scheduled: '12:00 PM', status: 'Delivered', amount: '₹2,242', collection: 'Paid', statusClass: 'bg-emerald-50 text-emerald-700', collectionClass: 'bg-emerald-50 text-emerald-600' },
  { id: 'SO-2026-1013', customer: 'Cloud Nine Cafe', scheduled: '02:00 PM', status: 'Failed', amount: '₹1,534', collection: 'Due', statusClass: 'bg-red-50 text-red-600', collectionClass: 'bg-orange-50 text-orange-600' },
]

const recentActivity = [
  { icon: Truck, iconClass: 'bg-primary-600 text-white', title: 'POD uploaded for SO-2026-1009', subtitle: 'Blue Orchid Banquet Hall', timestamp: 'Today, 10:12 AM' },
  { icon: Wallet, iconClass: 'bg-primary-700 text-white', title: 'Collection received from Cafe Mocha', subtitle: 'Amount: ₹2,242', timestamp: 'Today, 9:55 AM' },
  { icon: CheckCircle2, iconClass: 'bg-primary-700 text-white', title: 'Delivery completed for SO-2026-1008', subtitle: 'Cafe Mocha', timestamp: 'Today, 9:30 AM' },
  { icon: Clock, iconClass: 'bg-orange-500 text-white', title: 'Partial delivery marked for SO-2026-1010', subtitle: 'Star Public School', timestamp: 'Yesterday, 6:40 PM' },
  { icon: XCircle, iconClass: 'bg-red-600 text-white', title: 'Failed delivery marked for SO-2026-1013', subtitle: 'Cloud Nine Cafe', timestamp: 'Yesterday, 4:15 PM' },
  { icon: Truck, iconClass: 'bg-blue-600 text-white', title: 'Vehicle checked in', subtitle: 'TS09AB1234', timestamp: 'Yesterday, 8:45 AM' },
]

const schema = z
  .object({
    loginMethod: z.enum(['email', 'phone']).default('email'),
    email: z.string().optional(),
    countryCode: z.string().default('IN:+91'),
    phone: z.string().optional(),
    password: z.string().optional(),
    otp: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.loginMethod === 'email' && !z.string().email().safeParse(data.email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid email',
        path: ['email'],
      })
    }

    if (data.loginMethod === 'email' && !data.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password is required',
        path: ['password'],
      })
    }

    if (data.loginMethod === 'phone' && (data.phone || '').replace(/\D/g, '').length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid phone number',
        path: ['phone'],
      })
    }

    if (data.loginMethod === 'phone' && !/^\d{6}$/.test(data.otp || '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter the 6 digit OTP',
        path: ['otp'],
      })
    }
  })

function SidebarEntry({ icon: Icon, label, active = false }) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? 'bg-[#cfe9bb] text-neutral-900 shadow-[0_8px_20px_-16px_rgb(11_61_13/0.55)]'
          : 'text-neutral-600 hover:bg-white/70 hover:text-neutral-900'
      }`}
    >
      <span
        className={`flex size-5 items-center justify-center ${active ? 'text-primary-700' : 'text-neutral-500'}`}
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <span>{label}</span>
    </button>
  )
}

function ShellCard({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-[1.5rem] border border-neutral-100 bg-white p-5 shadow-[0_16px_36px_-26px_rgb(15_23_42/0.22)] ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-neutral-900">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function DashboardStat({ icon: Icon, iconClass, label, value, footer, footerColor }) {
  return (
    <article className="rounded-[1.35rem] border border-neutral-100 bg-white p-5 shadow-[0_14px_32px_-26px_rgb(15_23_42/0.22)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-neutral-500">{label}</p>
        <div className={`flex size-11 items-center justify-center rounded-[1rem] ${iconClass}`}>
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 font-(--font-display) text-[2rem] font-semibold tracking-tight text-neutral-900">{value}</p>
      <p className={`mt-2 text-sm font-medium ${footerColor}`}>{footer} <ArrowRight className="ml-1 inline size-4 align-[-2px]" /></p>
    </article>
  )
}

function PriorityRow({ icon: Icon, iconClass, label, description, count }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl px-2 py-2.5">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-800">{label}</p>
        <p className="truncate text-xs text-neutral-400">{description}</p>
      </div>
      <span className="shrink-0 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1 text-sm font-medium text-red-500">{count}</span>
    </div>
  )
}

function StatusTile({ icon: Icon, iconClass, label, value }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 rounded-2xl border border-neutral-100 bg-neutral-50/60 px-3 py-3 text-center">
      <div className={`flex size-9 items-center justify-center rounded-full ${iconClass}`}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <p className="text-[0.7rem] text-neutral-500">{label}</p>
      <p className="text-base font-semibold text-neutral-900">{value}</p>
    </div>
  )
}

function ActivityRow({ icon: Icon, iconClass, title, subtitle, timestamp }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-800">{title}</p>
        <p className="truncate text-xs text-neutral-400">{subtitle}</p>
      </div>
      <span className="shrink-0 text-xs text-neutral-400">{timestamp}</span>
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState('')
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpMessage, setOtpMessage] = useState('')
  const [otpDigits, setOtpDigits] = useState(Array(6).fill(''))
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [resetStep, setResetStep] = useState('email')
  const [resetEmail, setResetEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [isResetSubmitting, setIsResetSubmitting] = useState(false)
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(false)
  const countryMenuRef = useRef(null)
  const otpInputRefs = useRef([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { loginMethod: 'email', countryCode: 'IN:+91' },
  })

  const loginMethod = watch('loginMethod')
  const phoneValue = watch('phone')
  const countryCodeValue = watch('countryCode')
  const selectedCountry = countryCodes.find((country) => country.value === countryCodeValue) || countryCodes[0]
  const phonePlaceholder = phonePlaceholders[selectedCountry.value] || 'Phone number'

  useEffect(() => {
    function handleClickOutside(event) {
      if (countryMenuRef.current && !countryMenuRef.current.contains(event.target)) {
        setIsCountryMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const resetOtp = () => {
    setOtpDigits(Array(6).fill(''))
    setValue('otp', '')
  }

  const performLogin = async (credentials) => {
    setServerError('')
    const result = await login({
      ...(credentials.loginMethod === 'phone'
        ? {
            phone: `${selectedCountry.code} ${credentials.phone}`,
            otp: credentials.otp,
          }
        : { email: credentials.email, password: credentials.password }),
    })

    if (!result.success) {
      setServerError(result.error)
      return
    }

    setIsRedirecting(true)
    const redirectTo =
      location.state?.from?.pathname ||
      resolveHomePath({ fullAccess: result.full_access, role: result.role, currentUser: result.user })
    navigate(redirectTo, { replace: true })
  }

  const switchLoginMethod = (method) => {
    setServerError('')
    setResetMessage('')
    setOtpSent(false)
    setOtpMessage('')
    resetOtp()
    setValue('loginMethod', method)
  }

  const selectCountryCode = (country) => {
    setValue('countryCode', country.value)
    setIsCountryMenuOpen(false)
    setOtpSent(false)
    setOtpMessage('')
    resetOtp()
  }

  const startPasswordReset = () => {
    setServerError('')
    setResetError('')
    setResetMessage('')
    setResetStep('email')
    setIsResettingPassword(true)
  }

  const cancelPasswordReset = () => {
    setIsResettingPassword(false)
    setResetError('')
    setResetMessage('')
    setResetStep('email')
    setNewPassword('')
    setConfirmNewPassword('')
  }

  const handleResetEmailNext = (event) => {
    event.preventDefault()
    setResetError('')
    setResetMessage('')

    if (!z.string().email().safeParse(resetEmail).success) {
      setResetError('Enter a valid email')
      return
    }

    setResetStep('password')
  }

  const handlePasswordReset = async (event) => {
    event.preventDefault()
    setResetError('')
    setResetMessage('')

    if (!z.string().email().safeParse(resetEmail).success) {
      setResetError('Enter a valid email')
      setResetStep('email')
      return
    }

    if (!newPassword) {
      setResetError('New password is required')
      return
    }

    if (!confirmNewPassword) {
      setResetError('Confirm new password is required')
      return
    }

    if (newPassword.length < 8) {
      setResetError('New password must be at least 8 characters')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setResetError('Passwords do not match')
      return
    }

    setIsResetSubmitting(true)
    const result = await resetPasswordDirect({ email: resetEmail, newPassword })
    setIsResetSubmitting(false)

    if (!result.success) {
      setResetError(result.error)
      return
    }

    setResetMessage(result.detail)
    setIsResettingPassword(false)
    setResetStep('email')
    setResetEmail('')
    setNewPassword('')
    setConfirmNewPassword('')
    navigate('/login', { replace: true })
  }

  const requestOtp = () => {
    const phoneDigits = (phoneValue || '').replace(/\D/g, '')
    setServerError('')
    setOtpMessage('')
    resetOtp()

    if (phoneDigits.length < 10) {
      setOtpSent(false)
      setServerError('Enter a valid phone number')
      return
    }

    setOtpSent(true)
    setOtpMessage(`OTP sent to ${selectedCountry.code} ${phoneValue}`)
  }

  const applyOtpDigits = (digits, focusIndex) => {
    const nextDigits = Array(6).fill('')
    digits.slice(0, 6).forEach((digit, index) => {
      nextDigits[index] = digit
    })
    setOtpDigits(nextDigits)
    setValue('otp', nextDigits.join(''))
    otpInputRefs.current[Math.min(focusIndex, 5)]?.focus()
  }

  const updateOtpDigit = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const nextDigits = [...otpDigits]
    nextDigits[index] = digit
    setOtpDigits(nextDigits)
    setValue('otp', nextDigits.join(''))

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (event) => {
    event.preventDefault()
    const digits = event.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6)
      .split('')
    applyOtpDigits(digits, digits.length)
  }

  return (
    <div className="min-h-svh bg-[radial-gradient(circle_at_top_left,_rgba(198,228,173,0.52),_transparent_30%),linear-gradient(180deg,_#f7faf3_0%,_#edf4e8_100%)] p-3 text-neutral-900 sm:p-4 lg:p-5">
      {isRedirecting && <FullScreenLoader label="Signing you in..." />}

      <div className="mx-auto flex min-h-[calc(100svh-1.5rem)] max-w-[1600px] overflow-hidden rounded-[2rem] border border-[#d9e7d2] bg-[#fbfcf8] shadow-[0_30px_80px_-34px_rgb(16_58_15/0.28)] sm:min-h-[calc(100svh-2rem)] lg:min-h-[calc(100svh-2.5rem)]">
        <aside className="hidden w-64 shrink-0 border-r border-neutral-100 bg-[linear-gradient(180deg,_#f4f8ef_0%,_#eef5e7_100%)] px-3 py-4 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-2 py-2.5">
            <div className="flex size-11 items-center justify-center rounded-full bg-[#0f5116] text-white shadow-[0_12px_24px_-14px_rgb(15_81_22/0.55)]">
              <Droplet className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-(--font-display) text-[1.02rem] font-semibold tracking-tight text-neutral-900">SAAS CRM</p>
              <p className="text-sm text-neutral-500">Delivery Partner</p>
            </div>
          </div>

          <div className="mt-8 px-2">
            <p className="px-2 text-[0.68rem] font-semibold uppercase tracking-[0.34em] text-neutral-400">Main Menu</p>
            <div className="mt-3 space-y-1.5">
              {sidebarItems.map((item) => (
                <SidebarEntry key={item.label} icon={item.icon} label={item.label} active={item.active} />
              ))}
            </div>
          </div>

          <div className="mt-auto px-1 pb-2">
            <div className="rounded-[1.35rem] border border-white/80 bg-white/80 p-4 shadow-[0_14px_34px_-28px_rgb(15_23_42/0.22)]">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-primary-700 text-white">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">You're checked in</p>
                  <p className="text-xs text-neutral-500">Since 8:45 AM</p>
                </div>
              </div>
              <button type="button" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
                View Attendance <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-neutral-100 bg-white/80 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex min-w-0 flex-1 max-w-[30rem] items-center gap-3 rounded-full border border-neutral-200 bg-white px-4 py-2.5 shadow-[0_10px_22px_-18px_rgb(15_23_42/0.18)]">
                <Search className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
                <input
                  type="text"
                  readOnly
                  value=""
                  placeholder="Search deliveries, customers, orders..."
                  className="w-full bg-transparent text-sm text-neutral-700 placeholder:text-neutral-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="relative flex size-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-800"
                aria-label="Help"
              >
                <HelpCircle className="size-4.5" />
              </button>
              <button
                type="button"
                className="relative flex size-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-800"
                aria-label="Notifications"
              >
                <Bell className="size-4.5" />
                <span className="absolute right-0 top-0 flex size-5 -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full bg-red-500 text-[0.65rem] font-semibold text-white ring-2 ring-white">
                  3
                </span>
              </button>
              <button type="button" className="flex items-center gap-3 rounded-full px-1 py-1 text-left transition-colors hover:bg-neutral-50">
                <span className="flex size-11 items-center justify-center rounded-full bg-[#0f5116] text-sm font-semibold text-white shadow-[0_10px_24px_-16px_rgb(15_81_22/0.55)]">
                  DD
                </span>
                <span className="hidden text-left md:block">
                  <span className="block text-sm font-medium text-neutral-900">Deepak Delivery</span>
                  <span className="block text-xs text-neutral-500">Delivery Partner</span>
                </span>
                <ChevronDown className="hidden size-4 text-neutral-400 md:block" />
              </button>
            </div>
          </header>

          <main className="dashboard-page-content flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
            <div className="space-y-5 lg:space-y-6">
              <div>
                <h1 className="font-(--font-display) text-2xl font-semibold tracking-tight text-neutral-900 sm:text-[2rem]">Dashboard</h1>
              </div>

              <section className="overflow-hidden rounded-[1.75rem] border border-[#d8e8d1] bg-[linear-gradient(90deg,_#f3f8ec_0%,_#edf5e4_58%,_#f4f8ef_100%)] shadow-[0_16px_32px_-24px_rgb(15_81_22/0.28)]">
                <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.25fr)_360px] lg:items-stretch lg:p-6">
                  <div className="relative overflow-hidden rounded-[1.5rem] border border-[#d8e8d1] bg-white/55 p-4 shadow-[0_10px_24px_-22px_rgb(15_81_22/0.18)] backdrop-blur-sm sm:p-5">
                    <div className="pointer-events-none absolute right-0 top-0 h-full w-52 opacity-30">
                      <div className="absolute inset-y-0 right-[-3rem] top-6 rounded-full bg-[radial-gradient(circle,_rgba(28,109,30,0.28),_transparent_60%)] blur-2xl" />
                      <div className="absolute bottom-0 right-0 h-32 w-36 rounded-tl-[4rem] bg-[linear-gradient(180deg,_rgba(34,197,94,0.16),_rgba(34,197,94,0.02))]" />
                    </div>

                    <div className="relative flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#0f5116] text-lg font-semibold text-white shadow-[0_12px_26px_-18px_rgb(15_81_22/0.55)]">
                          DD
                        </div>
                        <div className="min-w-0">
                          <h2 className="font-(--font-display) text-[1.5rem] font-semibold tracking-tight text-neutral-900">
                            Good Morning, Deepak <span aria-hidden="true">👋</span>
                          </h2>
                          <div className="mt-4 grid gap-4 sm:grid-cols-3">
                            <div className="flex items-center gap-3">
                              <span className="flex size-8 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700">
                                <CheckCircle2 className="size-4" />
                              </span>
                              <div>
                                <p className="text-xs text-neutral-500">Checked In</p>
                                <p className="text-sm font-semibold text-neutral-900">8:45 AM</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="flex size-8 items-center justify-center rounded-full border border-emerald-200 bg-white text-primary-700">
                                <Truck className="size-4" />
                              </span>
                              <div>
                                <p className="text-xs text-neutral-500">Vehicle</p>
                                <p className="text-sm font-semibold text-neutral-900">TS09AB1234</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="flex size-8 items-center justify-center rounded-full border border-emerald-200 bg-white text-primary-700">
                                <Box className="size-4" />
                              </span>
                              <div>
                                <p className="text-xs text-neutral-500">Today's Deliveries</p>
                                <p className="text-sm font-semibold text-neutral-900">8</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col gap-3 sm:flex-row xl:flex-col 2xl:flex-row">
                        <Button type="button" className="rounded-2xl bg-linear-to-b from-primary-600 to-primary-700 px-5 py-3 text-sm shadow-[0_14px_28px_-18px_rgb(15_81_22/0.55)] hover:from-primary-600 hover:to-primary-800">
                          <Truck className="size-4" />
                          View Pending Deliveries
                        </Button>
                        <Button type="button" variant="outline" className="rounded-2xl border-neutral-200 bg-white px-5 py-3 text-sm text-neutral-700 hover:bg-neutral-50">
                          <LogIn className="size-4" />
                          End Day Return
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-[#d8e8d1] bg-white p-4 shadow-[0_14px_32px_-24px_rgb(15_81_22/0.22)] sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-primary-700">Delivery access</p>
                        <h2 className="mt-2 font-(--font-display) text-xl font-semibold tracking-tight text-neutral-900">Sign in to continue</h2>
                        <p className="mt-1 text-sm text-neutral-500">Use your delivery partner account to open the dashboard.</p>
                      </div>
                      <span className="inline-flex items-center rounded-full border border-primary-100 bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
                        Partner
                      </span>
                    </div>

                    <div className="mt-4 space-y-4">
                      {!isResettingPassword && (
                        <div className="flex rounded-2xl border border-neutral-200 bg-neutral-50 p-1 text-sm shadow-[0_8px_18px_-18px_rgb(15_23_42/0.14)]">
                          {[
                            ['email', 'Email'],
                            ['phone', 'Phone No'],
                          ].map(([method, label]) => (
                            <button
                              key={method}
                              type="button"
                              onClick={() => switchLoginMethod(method)}
                              className={`flex-1 rounded-xl px-3 py-2.5 font-medium transition-colors ${
                                loginMethod === method ? 'bg-white text-neutral-900 shadow-[0_8px_18px_-18px_rgb(15_23_42/0.18)]' : 'text-neutral-500 hover:text-neutral-900'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}

                      {isResettingPassword ? (
                        <form onSubmit={resetStep === 'email' ? handleResetEmailNext : handlePasswordReset} className="space-y-4">
                          {resetStep === 'email' ? (
                            <>
                              <Input
                                label="Email"
                                type="email"
                                placeholder="you@company.com"
                                value={resetEmail}
                                onChange={(event) => setResetEmail(event.target.value)}
                                error={resetError}
                              />
                              <Button type="submit" className="w-full rounded-2xl bg-linear-to-b from-neutral-800 to-neutral-950 shadow-[0_12px_24px_-14px_rgb(17_24_39/0.45)] hover:from-neutral-800 hover:to-neutral-900">
                                Next
                              </Button>
                            </>
                          ) : (
                            <>
                              <Input
                                label="New Password"
                                type="password"
                                placeholder="Enter new password"
                                value={newPassword}
                                onChange={(event) => setNewPassword(event.target.value)}
                              />
                              <Input
                                label="Confirm New Password"
                                type="password"
                                placeholder="Confirm new password"
                                value={confirmNewPassword}
                                onChange={(event) => setConfirmNewPassword(event.target.value)}
                              />
                              {resetError && <p className="text-sm text-red-600">{resetError}</p>}
                              <Button
                                type="submit"
                                className="w-full rounded-2xl bg-linear-to-b from-neutral-800 to-neutral-950 shadow-[0_12px_24px_-14px_rgb(17_24_39/0.45)] hover:from-neutral-800 hover:to-neutral-900"
                                loading={isResetSubmitting}
                              >
                                Reset
                              </Button>
                            </>
                          )}

                          <button type="button" onClick={cancelPasswordReset} className="w-full text-center text-sm font-medium text-primary-700 hover:underline">
                            Back to sign in
                          </button>
                        </form>
                      ) : (
                        <form onSubmit={handleSubmit(performLogin)} className="space-y-4">
                          <input type="hidden" {...register('loginMethod')} />

                          {loginMethod === 'email' ? (
                            <Input
                              label="Email"
                              type="email"
                              placeholder="you@company.com"
                              error={errors.email?.message}
                              {...register('email')}
                            />
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              <label className="text-sm font-medium text-neutral-700">Phone Number</label>
                              <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
                                <div className="relative" ref={countryMenuRef}>
                                  <input type="hidden" {...register('countryCode')} />
                                  <button
                                    type="button"
                                    aria-label="Country code"
                                    aria-expanded={isCountryMenuOpen}
                                    onClick={() => setIsCountryMenuOpen((isOpen) => !isOpen)}
                                    className="flex h-full w-full items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-900 transition-all focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10"
                                  >
                                    <ReactCountryFlag countryCode={selectedCountry.value.split(':')[0]} svg />
                                    <span>{selectedCountry.code}</span>
                                  </button>
                                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                                  {isCountryMenuOpen && (
                                    <div className="absolute left-0 top-full z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-neutral-200 bg-white py-1 shadow-[0_18px_36px_-24px_rgb(15_23_42/0.28)]">
                                      {countryCodes.map((country) => (
                                        <button
                                          key={country.value}
                                          type="button"
                                          onClick={() => selectCountryCode(country)}
                                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                            selectedCountry.value === country.value ? 'bg-primary-50 text-primary-700' : 'text-neutral-900 hover:bg-neutral-50'
                                          }`}
                                        >
                                          <ReactCountryFlag countryCode={country.value.split(':')[0]} svg />
                                          <span>{country.code}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <input
                                  type="tel"
                                  placeholder={phonePlaceholder}
                                  className={`h-full w-full rounded-2xl border bg-neutral-50 px-3.5 py-3 text-sm text-neutral-900 transition-all placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-4 ${
                                    errors.phone
                                      ? 'border-red-300 focus:border-red-400 focus:ring-red-500/15'
                                      : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-500/10'
                                  }`}
                                  {...register('phone', {
                                    onChange: () => {
                                      setOtpSent(false)
                                      setOtpMessage('')
                                      resetOtp()
                                    },
                                  })}
                                />
                              </div>
                              {errors.phone && <span className="text-xs text-red-600">{errors.phone.message}</span>}
                            </div>
                          )}

                          {loginMethod === 'phone' && (
                            <>
                              {!otpSent && (
                                <Button type="button" variant="outline" className="w-full rounded-2xl" onClick={requestOtp}>
                                  Get OTP
                                </Button>
                              )}

                              {otpSent && (
                                <div className="space-y-3">
                                  <input type="hidden" {...register('otp')} />
                                  <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-neutral-700">OTP</label>
                                    <div className="grid grid-cols-6 gap-2" onPaste={handleOtpPaste}>
                                      {otpDigits.map((digit, index) => (
                                        <input
                                          key={index}
                                          ref={(element) => {
                                            otpInputRefs.current[index] = element
                                          }}
                                          type="text"
                                          inputMode="numeric"
                                          maxLength={1}
                                          aria-label={`OTP digit ${index + 1}`}
                                          value={digit}
                                          onChange={(event) => updateOtpDigit(index, event.target.value)}
                                          onKeyDown={(event) => handleOtpKeyDown(index, event)}
                                          className={`aspect-square w-full rounded-2xl border bg-neutral-50 text-center font-(--font-display) text-lg font-semibold text-neutral-900 transition-all focus:bg-white focus:outline-none focus:ring-4 ${
                                            errors.otp
                                              ? 'border-red-300 focus:border-red-400 focus:ring-red-500/15'
                                              : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-500/10'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                    {errors.otp && <span className="text-xs text-red-600">{errors.otp.message}</span>}
                                  </div>
                                  <div className="flex items-center justify-between gap-3 text-sm">
                                    <span className="text-neutral-500">{otpMessage}</span>
                                    <button type="button" onClick={requestOtp} className="font-medium text-primary-700 hover:underline">
                                      Resend OTP
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {loginMethod === 'email' && (
                            <div className="space-y-2">
                              <Input
                                label="Password"
                                type="password"
                                placeholder="Enter your password"
                                error={errors.password?.message}
                                {...register('password')}
                              />
                              <button type="button" onClick={startPasswordReset} className="text-sm font-medium text-primary-700 hover:underline">
                                Forgot password?
                              </button>
                            </div>
                          )}

                          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
                          {resetMessage && <p className="text-sm text-emerald-600">{resetMessage}</p>}

                          {(loginMethod === 'email' || otpSent) && (
                            <Button
                              type="submit"
                              className="w-full rounded-2xl bg-linear-to-b from-primary-600 to-primary-700 shadow-[0_12px_24px_-14px_rgb(15_81_22/0.45)] hover:from-primary-600 hover:to-primary-800"
                              loading={isSubmitting || isRedirecting}
                            >
                              Sign in
                            </Button>
                          )}
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {deliveryStats.map((item) => (
                  <DashboardStat
                    key={item.label}
                    icon={item.icon}
                    iconClass={item.iconClass}
                    label={item.label}
                    value={item.value}
                    footer={item.footer}
                    footerColor={item.footerColor}
                  />
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <ShellCard title="Today's Priorities" className="xl:col-span-1">
                  <div className="space-y-1">
                    {priorityRows.map((row) => (
                      <PriorityRow key={row.label} icon={row.icon} iconClass={row.iconClass} label={row.label} description={row.description} count={row.count} />
                    ))}
                  </div>
                  <button type="button" className="mt-4 flex w-full items-center justify-center gap-1 text-sm font-medium text-primary-700 hover:underline">
                    View all priorities <ArrowRight className="size-4" />
                  </button>
                </ShellCard>

                <ShellCard
                  title="Vehicle Stock Alerts"
                  action={
                    <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-600">
                      Low Stock
                    </span>
                  }
                  className="xl:col-span-1"
                >
                  <p className="text-xs text-neutral-400">Reorder soon to avoid stockouts</p>
                  <div className="mt-3 space-y-2.5">
                    {stockAlerts.map((item) => (
                      <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 text-neutral-700">
                          <span className="size-2 rounded-full bg-orange-500" aria-hidden="true" />
                          {item.name}
                        </span>
                        <span className="shrink-0 font-medium text-neutral-900">{item.left}</span>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="mt-4 flex w-full items-center justify-center gap-1 text-sm font-medium text-primary-700 hover:underline">
                    View all vehicle stock <ArrowRight className="size-4" />
                  </button>
                </ShellCard>

                <ShellCard
                  title="Collection Summary"
                  action={
                    <button type="button" className="text-sm font-medium text-primary-700 hover:underline">
                      View details <ArrowRight className="size-4 inline align-[-2px]" />
                    </button>
                  }
                  className="xl:col-span-1"
                >
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {collectionSummary.map((item) => (
                      <div key={item.label} className="rounded-2xl border border-neutral-100 bg-neutral-50/50 p-3">
                        <p className="text-xs text-neutral-400">{item.label}</p>
                        <p className={`mt-1 text-base font-semibold ${item.color}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 border-t border-neutral-100 pt-4">
                    <p className="text-sm font-semibold text-neutral-800">Delivery Status</p>
                    <p className="text-xs text-neutral-400">Today at a glance</p>
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      {deliveryStatusTiles.map((tile) => (
                        <StatusTile key={tile.label} icon={tile.icon} iconClass={tile.iconClass} label={tile.label} value={tile.value} />
                      ))}
                    </div>
                  </div>
                </ShellCard>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <ShellCard
                  title="My Deliveries"
                  action={
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="text"
                          readOnly
                          value=""
                          placeholder="Search deliveries..."
                          className="w-56 rounded-full border border-neutral-200 bg-neutral-50 py-2.5 pl-9 pr-4 text-sm text-neutral-700 placeholder:text-neutral-400"
                        />
                      </div>
                      <button type="button" className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-700">
                        All Statuses <ChevronDown className="ml-1 inline size-4 align-[-2px]" />
                      </button>
                    </div>
                  }
                >
                  <div className="overflow-hidden rounded-[1.15rem] border border-neutral-100">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-neutral-100 bg-neutral-50/80">
                          <th className="px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Delivery #</th>
                          <th className="px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Customer</th>
                          <th className="px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Scheduled</th>
                          <th className="px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Status</th>
                          <th className="px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Amount Due</th>
                          <th className="px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">Collection</th>
                          <th className="w-12 px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-50">
                        {deliveriesPreview.map((row) => (
                          <tr key={row.id} className="transition-colors hover:bg-primary-50/30">
                            <td className="px-4 py-3.5 text-neutral-700">{row.id}</td>
                            <td className="px-4 py-3.5 text-neutral-700">{row.customer}</td>
                            <td className="px-4 py-3.5 text-neutral-700">{row.scheduled}</td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-black/5 ${row.statusClass}`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-neutral-700">{row.amount}</td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-black/5 ${row.collectionClass}`}>
                                {row.collection}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right text-neutral-400">⋮</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-sm text-neutral-400">
                    <p>Showing 1 to 6 of 8 deliveries</p>
                    <div className="flex items-center gap-2">
                      <button type="button" className="flex size-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500">
                        <ChevronLeft className="size-4" />
                      </button>
                      <button type="button" className="flex size-8 items-center justify-center rounded-full bg-primary-700 text-white">1</button>
                      <button type="button" className="flex size-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-700">2</button>
                      <button type="button" className="flex size-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500">
                        <ArrowRight className="size-4" />
                      </button>
                    </div>
                  </div>
                </ShellCard>

                <ShellCard
                  title="Recent Activity"
                  action={
                    <button type="button" className="text-sm font-medium text-primary-700 hover:underline">
                      View all <ArrowRight className="size-4 inline align-[-2px]" />
                    </button>
                  }
                >
                  <div className="space-y-4">
                    {recentActivity.map((item) => (
                      <ActivityRow
                        key={item.title}
                        icon={item.icon}
                        iconClass={item.iconClass}
                        title={item.title}
                        subtitle={item.subtitle}
                        timestamp={item.timestamp}
                      />
                    ))}
                  </div>
                </ShellCard>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
