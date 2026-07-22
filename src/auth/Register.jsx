import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Droplet, ImagePlus } from 'lucide-react'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Button from '../components/ui/Button'
import AuthShowcase from '../components/auth/AuthShowcase'
import { zodResolver } from '../utils/zodResolver'
import { registerOrganization } from '../api/auth'
import { roleHomePath } from './roles'

const adminFields = ['adminName', 'email', 'password', 'phone']
const organizationFields = ['companyName', 'companyLogo', 'businessType', 'gstNumber', 'panNumber', 'financialYear']

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
    email: z.string().email('Enter a valid email'),
    website: z.string().optional().or(z.literal('')),
    financialYear: z.string().min(1, 'Select a financial year'),
    invoicePrefix: z.string().min(1, 'Invoice prefix is required'),
    invoiceStartNumber: z.coerce.number().int().min(1, 'Enter a valid starting number'),
    adminName: z.string().min(2, 'Your name is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  })

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { sameAsBilling: false } })

  const sameAsBilling = watch('sameAsBilling')
  const companyLogo = watch('companyLogo')
  const companyLogoName = companyLogo?.[0]?.name

  const goToOrganizationStep = async () => {
    setServerError('')
    const isAdminStepValid = await trigger(adminFields)
    if (isAdminStepValid) {
      setStep(2)
    }
  }

  const goToBusinessStep = async () => {
    setServerError('')
    const isOrganizationStepValid = await trigger(organizationFields)
    if (isOrganizationStepValid) {
      setStep(3)
    }
  }

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
    <div className="h-svh overflow-hidden bg-neutral-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex h-[calc(100svh-2rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-3 shadow-popover sm:h-[calc(100svh-3rem)] lg:h-[calc(100svh-4rem)]">
        <AuthShowcase
          kicker="New workspace"
          title="Set up your organization in minutes"
          description="Configure company details, GST settings, invoice numbering and your admin account from one clean flow."
          quote="The setup brought our products, customers and billing into one workspace without slowing down daily operations."
          name="Arjun Mehta"
          role="Distribution Owner"
        />

        <main className="flex min-h-0 w-full flex-col items-center overflow-hidden px-4 py-8 lg:w-1/2 lg:px-10">
          <div className="flex h-full min-h-0 w-full max-w-2xl flex-col justify-center">
            <div className="mb-8 flex items-center gap-2.5 lg:hidden">
              <div className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-primary-500 to-primary-700 text-white shadow-(--shadow-glow-primary)">
                <Droplet className="size-5" />
              </div>
              <span className="font-(--font-display) text-lg font-semibold tracking-tight text-primary-700">
                SAAS CRM
              </span>
            </div>

            {/* <div className="mb-7 flex justify-center">
              <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-50 p-1 text-sm shadow-xs">
                <Link to="/login" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-neutral-500 hover:text-neutral-900">
                  <LogIn className="size-4" />
                  Login
                </Link>
                <Link to="/register" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 font-medium text-neutral-900 shadow-xs">
                  <UserPlus className="size-4" />
                  Sign Up
                </Link>
              </div>
            </div> */}

            <h1 className="text-center font-(--font-display) text-3xl font-semibold tracking-tight text-neutral-950">
              Register your organization
            </h1>
            <p className="mt-2 text-center text-base text-neutral-500">Set up your SAAS CRM workspace</p>

            <form onSubmit={handleSubmit(onSubmit)} className={`flex flex-col ${step > 1 ? 'mt-6 gap-4' : 'mt-10 gap-6'}`}>
              {/* <div className="shrink-0 grid grid-cols-1 gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-2 shadow-xs sm:grid-cols-2">
                {steps.map((item) => {
                  const isActive = step === item.number

                  return (
                    <div
                      key={item.number}
                      className={`flex min-h-14 items-center gap-3 rounded-xl px-3 text-base font-medium transition-all sm:px-4 ${
                        isActive ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500'
                      }`}
                    >
                      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">
                        {item.number}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>
                  )
                })}
              </div> */}

              <div className={step === 2 ? 'max-h-[calc(100svh-25rem)] overflow-y-auto pr-1' : 'pr-1'}>
                {step === 1 && (
                  <section>
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">1</span>
                      <h2 className="text-base font-semibold text-neutral-950">Admin Registration</h2>
                    </div>
                    <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                      <Input label="Admin Name" error={errors.adminName?.message} {...register('adminName')} />
                      <Input label="Email Address" type="email" error={errors.email?.message} {...register('email')} />
                      <Input
                        label="Password"
                        type="password"
                        placeholder="Enter your password"
                        error={errors.password?.message}
                        {...register('password')}
                      />
                      <Input label="Phone Number" type="tel" error={errors.phone?.message} {...register('phone')} />
                    </div>
                  </section>
                )}

                {step === 2 && (
                  <section>
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">2</span>
                      <h2 className="text-base font-semibold text-neutral-950">Organization Details</h2>
                    </div>
                    <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                      <Input
                        label="Company/Firm/Shop Name"
                        error={errors.companyName?.message}
                        {...register('companyName')}
                      />
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="company-logo" className="text-sm font-medium text-neutral-700">
                          Company Logo
                        </label>
                        <label
                          htmlFor="company-logo"
                          className={`flex h-[42px] cursor-pointer items-center gap-2 rounded-xl border bg-neutral-50 px-3 text-sm transition-all hover:bg-white ${
                            errors.companyLogo
                              ? 'border-red-300'
                              : 'border-neutral-200 focus-within:border-primary-400'
                          }`}
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                            <ImagePlus className="size-4" />
                          </span>
                          <span className={`min-w-0 flex-1 whitespace-nowrap text-sm ${companyLogoName ? 'truncate text-neutral-900' : 'text-neutral-400'}`}>
                            {companyLogoName || 'Upload company logo'}
                          </span>
                          <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-xs font-medium text-neutral-600 shadow-xs">
                            Browse
                          </span>
                          <input
                            id="company-logo"
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            {...register('companyLogo')}
                          />
                        </label>
                        {errors.companyLogo && <span className="text-xs text-red-600">{errors.companyLogo.message}</span>}
                      </div>
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
                  </section>
                )}

                {step === 3 && (
                  <section>
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">3</span>
                      <h2 className="text-base font-semibold text-neutral-950">Business Details</h2>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-5">
                      <Input
                        label="Billing Address"
                        as="textarea"
                        rows={2}
                        className="[&_textarea]:min-h-0"
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
                          rows={2}
                          className="[&_textarea]:min-h-0"
                          error={errors.shippingAddress?.message}
                          {...register('shippingAddress')}
                        />
                      )}
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-5 pb-2 sm:grid-cols-2">
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
                      {/* <Input
                        label="Invoice Starting Number"
                        type="number"
                        error={errors.invoiceStartNumber?.message}
                        {...register('invoiceStartNumber')}
                      /> */}
                    </div>
                  </section>
                )}
              </div>

              {serverError && <p className="text-sm text-red-600">{serverError}</p>}

              {step === 1 && (
                <Button
                  type="button"
                  onClick={goToOrganizationStep}
                  className="w-full rounded-xl bg-linear-to-r from-primary-500 to-primary-600 py-3 text-base shadow-[0_14px_30px_-14px_rgb(147_51_234/0.8)] hover:from-primary-500 hover:to-primary-700"
                >
                  Next
                </Button>
                
              )}
              

              {step === 2 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={goToBusinessStep}
                    className="rounded-xl bg-linear-to-r from-primary-500 to-primary-600 py-3 text-base shadow-[0_14px_30px_-14px_rgb(147_51_234/0.8)] hover:from-primary-500 hover:to-primary-700"
                  >
                    Next
                  </Button>
                </div>
              )}

              {step === 3 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="rounded-xl bg-linear-to-r from-primary-500 to-primary-600 py-3 text-base shadow-[0_14px_30px_-14px_rgb(147_51_234/0.8)] hover:from-primary-500 hover:to-primary-700"
                    loading={isSubmitting}
                  >
                    Create organization
                  </Button>
                </div>
              )}
            </form>

            {step === 1 && (
                 <p className="mt-6 text-center text-sm text-neutral-500">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-primary-600 hover:underline">
                Sign in
              </Link>
            </p>
                
              )}

          </div>
        </main>
      </div>
    </div>
  )
}
