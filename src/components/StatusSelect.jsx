import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { NEXT_STATUSES, STATUS_META } from './ui/StatusBadge'

// Compact inline status updater following the allowed transition flow
export default function StatusSelect({ order, onUpdated }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const next = NEXT_STATUSES[order.status] ?? []

  if (next.length === 0) return null

  async function update(status) {
    if (!status) return
    setBusy(true)
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', order.id)
    setBusy(false)
    if (error) {
      toast(`Could not update status: ${error.message}`, 'error')
    } else {
      toast(`Order ${order.order_number} → ${STATUS_META[status].label}`)
      onUpdated?.(order.id, status)
    }
  }

  return (
    <select
      value=""
      disabled={busy}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => update(e.target.value)}
      className="cursor-pointer rounded-lg border border-ink-200 bg-surface px-2 py-1.5 text-xs font-medium text-ink-600 transition hover:border-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-900/10 disabled:opacity-50"
      aria-label={`Update status of ${order.order_number}`}
    >
      <option value="" disabled>
        {busy ? 'Saving…' : 'Move to…'}
      </option>
      {next.map((s) => (
        <option key={s} value={s}>
          {STATUS_META[s].label}
        </option>
      ))}
    </select>
  )
}
