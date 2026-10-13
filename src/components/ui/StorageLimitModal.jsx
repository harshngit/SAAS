import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HardDrive } from 'lucide-react'
import Button from './Button'
import Modal from './Modal'
import { setStorageLimitHandler } from './storageLimitContext'

// Mounted once near the app root (inside the Router, so "View Plans" can navigate). Every upload
// call site triggers this same modal via handleStorageLimitError/showStorageLimitModal
// (storageLimitContext.js) instead of building its own PLAN_STORAGE_LIMIT_REACHED UI.
export default function StorageLimitModal() {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setStorageLimitHandler(() => setIsOpen(true))
    return () => setStorageLimitHandler(null)
  }, [])

  return (
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Storage limit reached">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <HardDrive className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm leading-6 text-neutral-600">
            Your organization has reached its storage limit. Delete unnecessary files or upgrade your plan to continue uploading.
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Close</Button>
          <Button type="button" onClick={() => { setIsOpen(false); navigate('/admin/plans') }}>View Plans</Button>
        </div>
      </div>
    </Modal>
  )
}
