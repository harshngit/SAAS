import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Droplet } from 'lucide-react'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import AuthShowcase from '../components/auth/AuthShowcase'
import { zodResolver } from '../utils/zodResolver'
import { registerOrganization } from '../api/auth'
import { resolveHomePath } from './roles'

const phonePattern = /^\+?[0-9][0-9\s-]{9,14}$/

const schema = z
  .object({
    organizationName: z.string().trim().min(2, 'Organization name is required'),
    phone: z.string().trim().regex(phonePattern, 'Enter a valid phone number'),
    email: z.string().email('Enter a valid email'),
    adminName: z.string().min(2, 'Your name is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  })

export default function Register() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (data) => {
    setServerError('')
    const result = await registerOrganization(data)
    if (!result.success) {
      setServerError(result.error)
      return
    }
    navigate(resolveHomePath({ fullAccess: result.full_access, role: result.role, currentUser: result.user }), { replace: true })
  }

  return (
    <div className="h-svh overflow-hidden bg-neutral-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex h-[calc(100svh-2rem)] max-w-7xl overflow-hidden rounded-2xl border border-neutral-200 bg-white p-3 shadow-popover sm:h-[calc(100svh-3rem)] lg:h-[calc(100svh-4rem)]">
        <AuthShowcase
          kicker="New workspace"
          title="Set up your admin account"
          description="Create your admin login first, then complete company and business details from settings."
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
              Register admin account
            </h1>
            <p className="mt-2 text-center text-base text-neutral-500">Create your SAAS CRM admin login</p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-10 flex flex-col gap-6">
              <div className="pr-1">
                <section>
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">1</span>
                    <h2 className="text-base font-semibold text-neutral-950">Admin Registration</h2>
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                    <Input
                      label="Organization Name"
                      error={errors.organizationName?.message}
                      {...register('organizationName')}
                    />
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
              </div>

              {serverError && <p className="text-sm text-red-600">{serverError}</p>}

              <Button
                type="submit"
                className="w-full rounded-xl bg-linear-to-r from-primary-500 to-primary-600 py-3 text-base shadow-[0_14px_30px_-14px_rgb(6_59_0/0.8)] hover:from-primary-500 hover:to-primary-700"
                loading={isSubmitting}
              >
                Register
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
