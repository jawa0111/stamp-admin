export const ORDER_STATUSES = [
  'pending_payment',
  'payment_received',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]

// Statuses that count as "paid" for revenue purposes
export const PAID_STATUSES = ['payment_received', 'processing', 'shipped', 'delivered']

export const STATUS_META = {
  pending_payment: { label: 'Pending payment', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-400 ring-amber-200 dark:ring-amber-500/25' },
  payment_received: { label: 'Payment received', cls: 'bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-400 ring-sky-200 dark:ring-sky-500/25' },
  processing: { label: 'Processing', cls: 'bg-violet-100 dark:bg-violet-500/15 text-violet-800 dark:text-violet-400 ring-violet-200 dark:ring-violet-500/25' },
  shipped: { label: 'Shipped', cls: 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-400 ring-blue-200 dark:ring-blue-500/25' },
  delivered: { label: 'Delivered', cls: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-500/25' },
  cancelled: { label: 'Cancelled', cls: 'bg-ink-200 text-ink-600 ring-ink-300' },
  refunded: { label: 'Refunded', cls: 'bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-400 ring-red-200 dark:ring-red-500/25' },
}

// Allowed transitions from each status (forward flow + cancel/refund)
export const NEXT_STATUSES = {
  pending_payment: ['payment_received', 'cancelled'],
  payment_received: ['processing', 'cancelled', 'refunded'],
  processing: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
}

export default function StatusBadge({ status, size = 'sm' }) {
  const meta = STATUS_META[status] ?? { label: status, cls: 'bg-ink-100 text-ink-600 ring-ink-200 dark:ring-ink-500/25' }
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full font-medium ring-1 ${meta.cls} ${
        size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      {meta.label}
    </span>
  )
}
