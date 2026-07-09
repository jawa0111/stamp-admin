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
  pending_payment: { label: 'Pending payment', cls: 'bg-amber-100 text-amber-800 ring-amber-200' },
  payment_received: { label: 'Payment received', cls: 'bg-sky-100 text-sky-800 ring-sky-200' },
  processing: { label: 'Processing', cls: 'bg-violet-100 text-violet-800 ring-violet-200' },
  shipped: { label: 'Shipped', cls: 'bg-blue-100 text-blue-800 ring-blue-200' },
  delivered: { label: 'Delivered', cls: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-ink-200 text-ink-600 ring-ink-300' },
  refunded: { label: 'Refunded', cls: 'bg-red-100 text-red-800 ring-red-200' },
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
  const meta = STATUS_META[status] ?? { label: status, cls: 'bg-ink-100 text-ink-600 ring-ink-200' }
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
