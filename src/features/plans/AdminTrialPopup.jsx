import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Crown } from 'lucide-react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { ROLES } from '../../auth/roles'
import { useAuthStore } from '../../store/authStore'

const trialDaysLeft = 7
const trialTotalDays = 14
const trialProgress = ((trialTotalDays - trialDaysLeft) / trialTotalDays) * 100

export default function AdminTrialPopup() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (currentUser?.role === ROLES.ADMIN) {
      setIsOpen(true)
    }
  }, [currentUser?.id, currentUser?.role])

  const explorePlans = () => {
    setIsOpen(false)
    navigate('/admin/plans')
  }

  if (currentUser?.role !== ROLES.ADMIN) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Free Trial"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="secondary" onClick={() => setIsOpen(false)}>
            Later
          </Button>
          <Button onClick={explorePlans} className="group">
            Explore Plans
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-4 rounded-2xl border border-primary-100 bg-primary-50/60 p-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-primary-700 shadow-(--shadow-xs)">
            <Crown className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-neutral-900">
              You are using a free trial
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              {trialDaysLeft} days Free Trial left.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
          <div className="flex items-center justify-between text-sm font-medium text-neutral-600">
            <span>Trial progress</span>
            <span className="text-neutral-900">{trialDaysLeft} days left</span>
          </div>
          <div className="mt-3 h-4 overflow-hidden rounded-full bg-white shadow-inner">
            <div
              className="h-full rounded-full bg-linear-to-r from-orange-500 to-amber-400 shadow-[0_8px_18px_-10px_rgb(249_115_22/0.9)]"
              style={{ width: `${trialProgress}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}
