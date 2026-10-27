import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Droplet } from 'lucide-react'
import AuthShowcase from '../../components/auth/AuthShowcase'
import AuthFooterLinks from '../../components/auth/AuthFooterLinks'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { zodResolver } from '../../utils/zodResolver'
import { resetPassword } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'

const schema = z.object({
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Confirm your new password'),
}).refine((values) => values.newPassword === values.confirmPassword, {
  message: 'Passwords do not match', path: ['confirmPassword'],
})

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() || ''
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async ({ newPassword, confirmPassword }) => {
    if (!token) return
    setServerError('')
    const result = await resetPassword({ token, newPassword, confirmPassword })
    if (!result.success) {
      if (result.status === 422 && Object.keys(result.fieldErrors || {}).length) {
        for (const [field, message] of Object.entries(result.fieldErrors)) setError(field, { type: 'server', message })
      } else setServerError(result.status === 400 ? 'This link has expired or was already used.' : result.error)
      return
    }
    // Reset revokes server sessions. Clear this browser's old session too;
    // resetting a password never establishes a new authenticated session.
    useAuthStore.getState().logout()
    navigate('/login', { replace: true, state: { message: 'Password has been reset. Please log in.' } })
  }

  return (
    <div className="min-h-svh bg-neutral-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] max-w-7xl overflow-hidden rounded-2xl border border-neutral-200 bg-surface p-3 shadow-popover sm:min-h-[calc(100svh-3rem)] lg:min-h-[calc(100svh-4rem)]">
        <AuthShowcase
          kicker="Live workspace" title="Run distribution from one dashboard"
          description="Track orders, stock, invoices, deliveries and payments with role-based access for every team."
          quote="Beas Suite keeps our sales, delivery and accounts teams aligned from first order to final collection."
          name="Isabella Garcia" role="Operations Director"
        />
        <main className="flex min-h-full w-full flex-col items-center justify-center overflow-y-auto px-4 py-8 lg:w-1/2 lg:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-2.5 lg:hidden">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary-700 text-white"><Droplet className="size-5" aria-hidden="true" /></span>
              <span className="font-(--font-display) text-lg font-semibold text-primary-700">Beas Suite</span>
            </div>
            <h1 className="text-center font-(--font-display) text-2xl font-semibold tracking-tight text-neutral-900">{token ? 'Set a new password' : 'Invalid reset link'}</h1>
            {!token ? (
              <div className="mt-7 space-y-4 text-center">
                <p className="text-sm text-neutral-500">Open the complete password reset link from your email.</p>
                <Link to="/login" className="text-sm font-medium text-primary-600 hover:underline">Back to sign in</Link>
              </div>
            ) : (
              <>
                <p className="mt-1.5 text-center text-sm text-neutral-500">Choose a new password for your account.</p>
                <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
                  <Input label="New password" type="password" autoComplete="new-password" placeholder="Enter new password"
                    disabled={isSubmitting} error={errors.newPassword?.message} {...register('newPassword')} />
                  <Input label="Confirm password" type="password" autoComplete="new-password" placeholder="Confirm new password"
                    disabled={isSubmitting} error={errors.confirmPassword?.message} {...register('confirmPassword')} />
                  {serverError && <div role="alert" className="space-y-2 text-sm">
                    <p className="text-red-600">{serverError}</p>
                    <Button type="button" size="sm" variant="outline" onClick={() => navigate('/login', { state: { forgotPassword: true } })}>Send a new link</Button>
                  </div>}
                  <Button type="submit" loading={isSubmitting} className="w-full rounded-xl bg-linear-to-b from-neutral-800 to-neutral-950 shadow-[0_10px_24px_-10px_rgb(17_24_39/0.55)] hover:from-neutral-800 hover:to-neutral-900">Reset password</Button>
                  <Link to="/login" className="block text-center text-sm font-medium text-primary-600 hover:underline">Back to sign in</Link>
                </form>
              </>
            )}
            <AuthFooterLinks />
          </div>
        </main>
      </div>
    </div>
  )
}
