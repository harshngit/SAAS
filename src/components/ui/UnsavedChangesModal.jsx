import Modal from './Modal'
import Button from './Button'

// Pair with `useUnsavedChangesGuard` (src/hooks). Reused across every form that needs a
// leave-confirmation - never build a one-off version of this per page.
export default function UnsavedChangesModal({ isOpen, onStay, onLeave }) {
  return (
    <Modal isOpen={isOpen} onClose={onStay} title="Leave this page?" size="sm">
      <div className="space-y-5">
        <p className="text-sm leading-6 text-neutral-600">
          Your changes have not been saved. If you leave now, they may be lost.
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onStay}>Stay</Button>
          <Button type="button" variant="danger" onClick={onLeave}>Leave Page</Button>
        </div>
      </div>
    </Modal>
  )
}
