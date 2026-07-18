import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Droplet, Sparkles, ShieldCheck, Users, FileText } from 'lucide-react'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Button from '../components/ui/Button'
import { zodResolver } from '../utils/zodResolver'
import { registerOrganization } from '../api/auth'
import { roleHomePath } from './roles'

const businessTypeOptions = [
  { value: 'Manufacturer', label: 'Manufacturer' },
  { value: 'Distributor', label: 'Distributor' },
  { value: 'Wholesaler', label: 'Wholesaler' },
  { value: 'Retailer', label: 'Retailer' },
  { value: 'Service Provider', label: 'Service Provider' },
]

const financialYearOptions = [
  { value: '2025-2026', label: 'FY 2025-2026' },
  { value: '2026-2027', label: 'FY 2026-2027' },
  { value: '2027-2028', label: 'FY 2027-2028' },
]

const benefits = [
  { icon: Sparkles, title: 'Start free', description: 'Begin on the Free plan — upgrade any time as your team grows.' },
  { icon: ShieldCheck, title: 'GST-ready from day one', description: 'Tax rates and invoice numbering configured during setup.' },
  { icon: Users, title: 'Invite your team', description: 'Add sales, delivery and accounts staff with role-based access.' },
  { icon: FileText, title: 'Your data, organized', description: 'Products, customers and orders ready to import whenever you are.' },
]

const schema = z
  .object({
    companyName: z.string().min(2, 'Company/Firm/Shop name is required'),
    companyLogo: z.any().optional(),
    businessType: z.string().min(1, 'Select a business type'),
    gstNumber: z.string().length(15, 'GST number must be 15 characters'),
    panNumber: z.string().optional().or(z.literal('')),
    billingAddress: z.string().min(5, 'Billing address is required'),
    shippingAddress: z.string().optional().or(z.literal('')),
    sameAsBilling: z.boolean().optional().default(false),
    phone: z.string().min(10, 'Enter a valid phone number'),
    alternatePhone: z.string().optional().or(z.literal('')),
    email: z.string().email('Enter a valid email'),
    website: z.string().optional().or(z.literal('')),
    financialYear: z.string().min(1, 'Select a financial year'),
    invoicePrefix: z.string().min(1, 'Invoice prefix is required'),
    invoiceStartNumber: z.coerce.number().int().min(1, 'Enter a valid starting number'),
    adminName: z.string().min(2, 'Your name is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export default function Register() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { sameAsBilling: false } })

  const sameAsBilling = watch('sameAsBilling')

  const onSubmit = async (data) => {
    setServerError('')
    const result = await registerOrganization(data)
    if (!result.success) {
      setServerError(result.error)
      return
    }
    navigate(roleHomePath[result.user.role], { replace: true })
  }

  return (
    <div className="flex h-svh bg-white">
      {/* Left: platform info panel (fixed, no scroll) */}
      <div className="relative hidden h-full w-2/5 shrink-0 flex-col justify-between overflow-hidden bg-linear-to-br from-primary-900 via-primary-800 to-primary-600 p-12 text-white lg:flex">
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
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-200">Get started in minutes</p>
          <h1 className="mt-3 font-(--font-display) text-3xl font-semibold leading-tight tracking-tight">
            Set up your organization in minutes
          </h1>
          <p className="mt-3 max-w-md text-primary-100/90">
            One workspace for orders, deliveries, inventory, invoicing and your whole team.
          </p>

          <div className="mt-10 space-y-5">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="flex items-start gap-3.5">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                  <benefit.icon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{benefit.title}</p>
                  <p className="text-sm text-primary-100/75">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-primary-100/60">© 2026 SAAS CRM. All rights reserved.</p>
      </div>

      {/* Right: registration form (scrolls independently) */}
      <div className="flex h-full w-full flex-col items-center overflow-y-auto px-4 py-10 lg:w-3/5">
        <div className="w-full max-w-2xl">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-primary-500 to-primary-700 text-white shadow-(--shadow-glow-primary)">
              <Droplet className="size-5" />
            </div>
            <span className="font-(--font-display) text-lg font-semibold tracking-tight text-primary-700">
              SAAS CRM
            </span>
          </div>

          <h1 className="font-(--font-display) text-2xl font-semibold tracking-tight text-neutral-900">
            Register your organization
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">Set up your SAAS CRM workspace</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-8">
            <section>
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary-600 text-[11px] font-semibold text-white">1</span>
                <h2 className="text-sm font-semibold text-neutral-900">Organization Details</h2>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Company/Firm/Shop Name"
                  error={errors.companyName?.message}
                  {...register('companyName')}
                />
                <Input
                  label="Company Logo"
                  type="file"
                  accept="image/*"
                  error={errors.companyLogo?.message}
                  {...register('companyLogo')}
                />
                <Select
                  label="Business Type"
                  placeholder="Select business type"
                  options={businessTypeOptions}
                  error={errors.businessType?.message}
                  {...register('businessType')}
                />
                <Input label="GST Number" error={errors.gstNumber?.message} {...register('gstNumber')} />
                <Input
                  label="PAN Number (if applicable)"
                  error={errors.panNumber?.message}
                  {...register('panNumber')}
                />
                <Select
                  label="Financial Year"
                  placeholder="Select financial year"
                  options={financialYearOptions}
                  error={errors.financialYear?.message}
                  {...register('financialYear')}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4">
                <Input
                  label="Billing Address"
                  as="textarea"
                  error={errors.billingAddress?.message}
                  {...register('billingAddress')}
                />
                <label className="flex items-center gap-2 text-sm text-neutral-600">
                  <input type="checkbox" className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/30" {...register('sameAsBilling')} />
                  Shipping/Warehouse address same as billing address
                </label>
                {!sameAsBilling && (
                  <Input
                    label="Shipping/Warehouse Address"
                    as="textarea"
                    error={errors.shippingAddress?.message}
                    {...register('shippingAddress')}
                  />
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Phone Number" type="tel" error={errors.phone?.message} {...register('phone')} />
                <Input
                  label="Alternate Phone Number"
                  type="tel"
                  error={errors.alternatePhone?.message}
                  {...register('alternatePhone')}
                />
                <Input label="Email Address" type="email" error={errors.email?.message} {...register('email')} />
                <Input
                  label="Website (if applicable)"
                  error={errors.website?.message}
                  {...register('website')}
                />
                <Input
                  label="Invoice Prefix"
                  placeholder="e.g. INV"
                  error={errors.invoicePrefix?.message}
                  {...register('invoicePrefix')}
                />
                <Input
                  label="Invoice Starting Number"
                  type="number"
                  error={errors.invoiceStartNumber?.message}
                  {...register('invoiceStartNumber')}
                />
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary-600 text-[11px] font-semibold text-white">2</span>
                <h2 className="text-sm font-semibold text-neutral-900">Account Setup</h2>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Your Name" error={errors.adminName?.message} {...register('adminName')} />
                <Input
                  label="Password"
                  type="password"
                  error={errors.password?.message}
                  {...register('password')}
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  error={errors.confirmPassword?.message}
                  {...register('confirmPassword')}
                />
              </div>
            </section>

            {serverError && <p className="text-sm text-red-600">{serverError}</p>}

            <Button type="submit" className="w-full" loading={isSubmitting}>
              Create organization
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
