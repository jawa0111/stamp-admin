import Modal from './Modal'
import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  danger = true,
  busy = false,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex items-start gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
            danger ? 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
          }`}
        >
          <AlertTriangle size={20} />
        </div>
        <p className="pt-1 text-sm text-ink-600">{message}</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="cursor-pointer rounded-xl border border-ink-200 px-4 py-2 text-sm font-medium transition hover:bg-ink-100"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 ${
            danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-strong'
          }`}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
