import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { loginWithPhoneOtp, sendPhoneOtp } from '../../api/auth'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

const phoneSchema = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number')
const otpSchema = z.string().regex(/^\d{6}$/, 'Enter the 6-digit OTP')
const signInClass = 'w-full rounded-xl bg-linear-to-b from-neutral-800 to-neutral-950 shadow-[0_10px_24px_-10px_rgb(17_24_39/0.55)] hover:from-neutral-800 hover:to-neutral-900'

export default function PhoneOtpLogin({ onSuccess, onBusyChange, onUnavailable, disabled = false }) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sentPhone, setSentPhone] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [resendAt, setResendAt] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [info, setInfo] = useState('')
  const busy = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => { onBusyChange?.(sending || verifying) }, [sending, verifying, onBusyChange])

  useEffect(() => {
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)))
    update()
    if (!resendAt) return undefined
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [resendAt])

  const handleOtpError = (result) => {
    if (result.status === 503) { onUnavailable?.(); return }
    if (result.status === 502) {
      setError('Mobile login is temporarily unavailable. Please use email login.')
      return
    }
    setError(result.error)
    if (result.status === 429) {
      // The server remains authoritative on longer per-number/device limits.
      // Reapply the documented minimum resend cooldown; never auto-retry.
      setSecondsLeft(30)
      setResendAt(Math.max(resendAt, Date.now() + 30000))
    }
  }

  const sendOtp = async () => {
    if (busy.current || disabled || (sentPhone && Date.now() < resendAt)) return
    const parsed = phoneSchema.safeParse(phone)
    if (!parsed.success) { setError(parsed.error.issues[0].message); return }
    busy.current = true
    setSending(true)
    setError('')
    setInfo('')
    try {
      const result = await sendPhoneOtp({ phone: `+91${phone}` })
      if (!mounted.current) return
      if (!result.success) { handleOtpError(result); return }
      const delay = Number(result.resendAfter)
      const cooldown = Number.isFinite(delay) && delay >= 0 ? Math.ceil(delay) : 30
      setSentPhone(`+91${phone}`)
      setCode('')
      setSecondsLeft(cooldown)
      setResendAt(Date.now() + cooldown * 1000)
      setInfo(result.detail || '')
    } finally {
      busy.current = false
      if (mounted.current) setSending(false)
    }
  }

  const verifyOtp = async (value = code) => {
    if (busy.current || disabled || !sentPhone) return
    const parsed = otpSchema.safeParse(value)
    if (!parsed.success) { setError(parsed.error.issues[0].message); return }
    busy.current = true
    setVerifying(true)
    setError('')
    try {
      const result = await loginWithPhoneOtp({ phone: sentPhone, code: value })
      if (!mounted.current) return
      if (!result.success) { handleOtpError(result); return }
      onSuccess(result)
    } finally {
      busy.current = false
      if (mounted.current) setVerifying(false)
    }
  }

  const changeNumber = () => {
    if (busy.current || disabled) return
    setSentPhone('')
    setCode('')
    setError('')
    setInfo('')
  }

  const isBusy = sending || verifying || disabled
  return (
    <form className="mt-7 space-y-4" noValidate onSubmit={(event) => { event.preventDefault(); if (sentPhone) verifyOtp(); else sendOtp() }}>
      <p className="text-sm text-neutral-500">Mobile login is for staff accounts. Admins, use email or Google.</p>
      {!sentPhone ? (
        <div className="space-y-1.5">
          <label htmlFor="login-phone" className="text-sm font-medium text-fg">Mobile Number</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-2.5 z-10 border-r border-neutral-200 pr-3 text-sm text-neutral-600">+91</span>
            <Input id="login-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10}
              placeholder="98765 43210" inputClassName="pl-16" value={phone} disabled={isBusy}
              error={error} aria-invalid={Boolean(error)} onChange={(event) => { setPhone(event.target.value.replace(/\D/g, '').slice(0, 10)); setError('') }} />
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-1 text-sm">
            <p className="text-neutral-600">OTP sent to +91 XXXXX XX{sentPhone.slice(-3)}</p>
            <button type="button" onClick={changeNumber} disabled={isBusy} className="font-medium text-primary-600 hover:underline disabled:opacity-50">Change number</button>
          </div>
          <Input key={sentPhone} id="login-otp" label="OTP" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            placeholder="Enter 6-digit OTP" value={code} disabled={isBusy} autoFocus error={error} aria-invalid={Boolean(error)}
            onChange={(event) => {
              const next = event.target.value.replace(/\D/g, '').slice(0, 6)
              setCode(next)
              setError('')
              if (next.length === 6) verifyOtp(next)
            }} />
        </>
      )}
      {info && <p role="status" className="text-sm text-neutral-500">{info}</p>}
      <Button type="submit" className={signInClass} loading={sending || verifying} disabled={isBusy}>
        {sentPhone ? 'Verify & Sign in' : 'Send OTP'}
      </Button>
      {sentPhone && <div className="text-center">
        <button type="button" onClick={sendOtp} disabled={isBusy || secondsLeft > 0}
          className="text-sm font-medium text-primary-600 hover:underline disabled:cursor-not-allowed disabled:text-neutral-400 disabled:no-underline">
          {secondsLeft > 0 ? `Resend OTP in ${secondsLeft}s` : 'Resend OTP'}
        </button>
      </div>}
    </form>
  )
}
