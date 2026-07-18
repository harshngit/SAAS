import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Droplet, ShieldCheck, Truck, BarChart3, Users, Shield, UserCog, Wallet, Globe, ChevronDown } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { zodResolver } from '../../utils/zodResolver'
import { login } from '../../api/auth'
import { roleHomePath, roleLabels } from '../../auth/roles'

const DEMO_PASSWORD = 'demo123'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

const demoAccounts = [
  { role: 'super_admin', email: 'superadmin@demo.com', icon: Shield },
  { role: 'admin', email: 'admin@demo.com', icon: UserCog },
  { role: 'sales_officer', email: 'sales@demo.com', icon: Users },
  { role: 'delivery_partner', email: 'delivery@demo.com', icon: Truck },
  { role: 'accountant', email: 'accountant@demo.com', icon: Wallet },
]

const features = [
  {
    icon: Users,
    title: 'Multi-role access',
    description: 'Super Admin, Admin, Sales, Delivery & Accounts — each with a tailored workspace.',
  },
  {
    icon: Truck,
    title: 'Orders to doorstep',
    description: 'Track every sales order from draft to delivered, with live status updates.',
  },
  {
    icon: BarChart3,
    title: 'Real-time insights',
    description: 'Sales, receivables, payables and stock — always up to date.',
  },
  {
    icon: ShieldCheck,
    title: 'GST-ready invoicing',
    description: 'Built-in tax rates, invoice numbering, and compliant billing.',
  },
]

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState('')
  const [loadingRole, setLoadingRole] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const emailValue = watch('email')

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const performLogin = async (credentials) => {
    setServerError('')
    const result = await login(credentials)
    if (!result.success) {
      setServerError(result.error)
      return
    }
    const redirectTo = location.state?.from?.pathname || roleHomePath[result.user.role]
    navigate(redirectTo, { replace: true })
  }

  const onSubmit = (data) => performLogin(data)

  const selectDemoAccount = (account) => {
    setServerError('')
    setValue('email', account.email)
    setValue('password', DEMO_PASSWORD)
    setShowDropdown(false)
  }

  return (
    <div className="flex h-svh bg-white">
      {/* Left: platform info panel (fixed, no scroll) */}
      <div className="relative hidden h-full w-1/2 flex-col justify-between overflow-hidden bg-linear-to-br from-primary-900 via-primary-800 to-primary-600 p-12 text-white lg:flex xl:px-16">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-primary-400/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.08)_1px,transparent_0)] bg-size-[24px_24px]" />

        <div className="relative flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
            <Droplet className="size-5" />
          </div>
          <span className="font-(--font-display) text-lg font-semibold tracking-tight">SAAS CRM</span>
        </div>

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-200">
            Built for distribution businesses
          </p>
          <h1 className="mt-3 font-(--font-display) text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
            Run your entire water distribution business from one dashboard
          </h1>
          <p className="mt-3 max-w-md text-primary-100/90">
            Orders, deliveries, inventory, invoicing and staff — built for distributors, wholesalers and retailers.
          </p>

          <div className="mt-10 space-y-5">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3.5">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                  <feature.icon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{feature.title}</p>
                  <p className="text-sm text-primary-100/75">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-primary-100/60">© 2026 SAAS CRM. All rights reserved.</p>
      </div>

      {/* Right: login form + demo credentials (scrolls independently) */}
      <div className="flex h-full w-full flex-col items-center justify-center overflow-y-auto px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-primary-500 to-primary-700 text-white shadow-(--shadow-glow-primary)">
              <Droplet className="size-5" />
            </div>
            <span className="font-(--font-display) text-lg font-semibold tracking-tight text-primary-700">
              SAAS CRM
            </span>
          </div>

          <h2 className="font-(--font-display) text-2xl font-semibold tracking-tight text-neutral-900">
            Welcome back
          </h2>
          <p className="mt-1.5 text-sm text-neutral-500">Sign in to your workspace to continue</p>

          <div className="mt-7 space-y-3">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <Globe className="size-5" />
              Continue with Google
            </button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wider">
                <span className="bg-white px-2 text-neutral-400">Or sign in with email</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div className="flex flex-col gap-1.5" ref={dropdownRef}>
              <label className="text-sm font-medium text-neutral-700">Email</label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={emailValue || ''}
                  onChange={(e) => setValue('email', e.target.value)}
                  onClick={() => setShowDropdown(!showDropdown)}
                  className={`w-full rounded-xl border bg-neutral-50 px-3.5 py-2.5 pr-10 text-sm text-neutral-900 transition-all placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-4 ${
                    errors.email
                      ? 'border-red-300 focus:border-red-400 focus:ring-red-500/15'
                      : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-500/12'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <ChevronDown className={`size-5 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showDropdown && (
                  <div className="absolute z-10 mt-2 w-full rounded-xl border border-neutral-100 bg-white shadow-(--shadow-popover)">
                    {demoAccounts.map((account) => (
                      <button
                        key={account.role}
                        type="button"
                        onClick={() => selectDemoAccount(account)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 first:rounded-t-xl last:rounded-b-xl"
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                          <account.icon className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{roleLabels[account.role]}</p>
                          <p className="text-xs text-neutral-500">{account.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {errors.email && <span className="text-xs text-red-600">{errors.email.message}</span>}
            </div>
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
            {serverError && <p className="text-sm text-red-600">{serverError}</p>}
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Sign in
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-neutral-500">
            New organization?{' '}
            <Link to="/register" className="font-medium text-primary-600 hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
