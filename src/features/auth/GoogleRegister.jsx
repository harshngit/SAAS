import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Droplet } from 'lucide-react'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import AuthShowcase from '../../components/auth/AuthShowcase'
import { zodResolver } from '../../utils/zodResolver'
import { completeGoogleRegistration, getGoogleRegistrationInfo } from '../../api/auth'
import { resolveHomePath } from '../../auth/roles'

const schema = z.object({
  organizationName: z.string().trim().min(1, 'Organization name is required').max(200),
  adminName: z.string().trim().min(1, 'Your name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  businessType: z.string().max(100).optional().or(z.literal('')),
  gstNumber: z.string().max(20).optional().or(z.literal('')),
  panNumber: z.string().max(20).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  financialYear: z.string().max(20).optional().or(z.literal('')),
})

export default function GoogleRegister() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const registrationCode = searchParams.get('registration_code') || ''

  const [isLoadingInfo, setIsLoadingInfo] = useState(true)
  const [infoError, setInfoError] = useState('')
  const [email, setEmail] = useState('')
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!registrationCode) {
      setInfoError('Missing registration code. Please start sign-in again.')
      setIsLoadingInfo(false)
      return
    }

    getGoogleRegistrationInfo(registrationCode).then((result) => {
      setIsLoadingInfo(false)

      if (!result.success) {
        setInfoError(result.error)
        return
      }

      setEmail(result.email)
      reset({ adminName: result.name })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationCode])

  const onSubmit = async (data) => {
    setServerError('')

    const result = await completeGoogleRegistration({ ...data, registrationCode })

    if (!result.success) {
      setServerError(result.error)
      return
    }

    navigate(resolveHomePath({ role: result.user?.role, currentUser: result.user }), { replace: true })
  }

  if (isLoadingInfo) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-neutral-50">
        <LoadingSpinner label="Loading your Google account details..." />
      </div>
    )
  }

  if (infoError) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-neutral-50 p-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-100 bg-white p-6 text-center shadow-popover">
          <p className="text-sm font-medium text-neutral-900">Registration session expired</p>
          <p className="mt-1.5 text-sm text-neutral-500">{infoError}</p>
          <Link to="/login" className="mt-4 inline-block text-sm font-medium text-primary-600 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-svh overflow-hidden bg-neutral-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex h-[calc(100svh-2rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-3 shadow-popover sm:h-[calc(100svh-3rem)] lg:h-[calc(100svh-4rem)]">
        <AuthShowcase
          kicker="New workspace"
          title="Finish setting up your account"
          description="Your Google account is verified - just add your organization details to get started."
          quote="The setup brought our products, customers and billing into one workspace without slowing down daily operations."
          name="Arjun Mehta"
          role="Distribution Owner"
        />

        <main className="flex min-h-0 w-full flex-col items-center overflow-y-auto px-4 py-8 lg:w-1/2 lg:px-10">
          <div className="flex w-full max-w-2xl flex-col justify-center">
            <div className="mb-8 flex items-center gap-2.5 lg:hidden">
              <div className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-primary-500 to-primary-700 text-white shadow-(--shadow-glow-primary)">
                <Droplet className="size-5" />
              </div>
              <span className="font-(--font-display) text-lg font-semibold tracking-tight text-primary-700">
                SAAS CRM
              </span>
            </div>

            <h1 className="text-center font-(--font-display) text-3xl font-semibold tracking-tight text-neutral-950">
              Complete your registration
            </h1>
            <p className="mt-2 text-center text-base text-neutral-500">Signed in as {email}</p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-6">
              <section>
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">1</span>
                  <h2 className="text-base font-semibold text-neutral-950">Account Details</h2>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                  <Input label="Email Address" value={email} disabled readOnly />
                  <Input label="Your Name" error={errors.adminName?.message} {...register('adminName')} />
                  <Input
                    label="Organization Name"
                    error={errors.organizationName?.message}
                    {...register('organizationName')}
                  />
                  <Input
                    label="Password"
                    type="password"
                    placeholder="Create a password"
                    error={errors.password?.message}
                    {...register('password')}
                  />
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-700">2</span>
                  <h2 className="text-base font-semibold text-neutral-950">Business Details <span className="font-normal text-neutral-400">(optional)</span></h2>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                  <Input label="Business Type" error={errors.businessType?.message} {...register('businessType')} />
                  <Input label="Phone Number" type="tel" error={errors.phone?.message} {...register('phone')} />
                  <Input label="GST Number" error={errors.gstNumber?.message} {...register('gstNumber')} />
                  <Input label="PAN Number" error={errors.panNumber?.message} {...register('panNumber')} />
                  <Input label="Financial Year" placeholder="e.g. 2025-2026" error={errors.financialYear?.message} {...register('financialYear')} />
                  <Input label="Address" error={errors.address?.message} {...register('address')} />
                </div>
              </section>

              {serverError && <p className="text-sm text-red-600">{serverError}</p>}

              <Button
                type="submit"
                className="w-full rounded-xl bg-linear-to-r from-primary-500 to-primary-600 py-3 text-base shadow-[0_14px_30px_-14px_rgb(6_59_0/0.8)] hover:from-primary-500 hover:to-primary-700"
                loading={isSubmitting}
              >
                Complete Registration
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-neutral-500">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-primary-600 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
