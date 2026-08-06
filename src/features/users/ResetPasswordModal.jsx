import { useState } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { resetUserPassword } from '../../api/users'

const MIN_PASSWORD_LENGTH = 8

export default function ResetPasswordModal({ user, onClose, onSuccess }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleClose = () => {
    if (isSaving) return
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSaving(true)
    const result = await resetUserPassword(user.id, newPassword)
    setIsSaving(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    setNewPassword('')
    setConfirmPassword('')
    onSuccess(user, result.detail)
  }

  return (
    <Modal isOpen={Boolean(user)} onClose={handleClose} title="Reset Password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-sm text-neutral-500">Resetting password for</p>
          <div className="mt-2 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <p className="font-medium text-neutral-900">{user?.name}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{user?.email}</p>
          </div>
        </div>

        <Input
          label="New Password"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />
        <Input
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            Reset Password
          </Button>
        </div>
      </form>
    </Modal>
  )
}
