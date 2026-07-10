import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatMoney, formatDateTime } from '../lib/format'
import { rangeForPreset, rangeToTimestamps } from '../lib/dates'
import PageHeader, { Card } from '../components/ui/PageHeader'
import StatusBadge, { ORDER_STATUSES, STATUS_META } from '../components/ui/StatusBadge'
import StatusSelect from '../components/StatusSelect'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import { Input, Select } from '../components/ui/Field'
import { Search, ShoppingBag, ArrowUpDown } from 'lucide-react'

const PAGE_SIZE = 25

const SORTS = {
  newest: { column: 'created_at', ascending: false, label: 'Newest first' },
  oldest: { column: 'created_at', ascending: true, label: 'Oldest first' },
  total_desc: { column: 'total', ascending: false, label: 'Total: high → low' },
  total_asc: { column: 'total', ascending: true, label: 'Total: low → high' },
}

export default function Orders() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [preset, setPreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)

  // debounce search
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  const range = useMemo(() => {
    if (preset === 'custom') return { from: customFrom || null, to: customTo || null }
    return rangeForPreset(preset)
  }, [preset, customFrom, customTo])

  useEffect(() => {
    setPage(1)
  }, [debounced, status, preset, customFrom, customTo, sort])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      let q = supabase
        .from('orders')
        .select('id, order_number, status, total, email, phone, shipping_name, created_at', {
          count: 'exact',
        })

      if (debounced) {
        const like = `%${debounced}%`
        q = q.or(
          `order_number.ilike.${like},email.ilike.${like},shipping_name.ilike.${like},phone.ilike.${like}`
        )
      }
      if (status) q = q.eq('status', status)
      const { fromTs, toTs } = rangeToTimestamps(range)
      if (fromTs) q = q.gte('created_at', fromTs)
      if (toTs) q = q.lte('created_at', toTs)

      const s = SORTS[sort]
      q = q
        .order(s.column, { ascending: s.ascending })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      const { data, count, error } = await q
      if (cancelled) return
      if (!error) {
        setRows(data ?? [])
        setTotal(count ?? 0)
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [debounced, status, range, sort, page])

  function onStatusUpdated(id, newStatus) {
    setRows((r) => r.map((o) => (o.id === id ? { ...o, status: newStatus } : o)))
  }

  return (
    <div>
      <PageHeader title="Orders" subtitle={`${total} order${total === 1 ? '' : 's'}`} />

      {/* Filters */}
      <Card className="mb-4 p-3 sm:p-4">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input
              type="search"
              placeholder="Search order #, name, email, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              aria-label="Search orders"
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </Select>
          <Select value={preset} onChange={(e) => setPreset(e.target.value)} aria-label="Filter by date">
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="last7">Last 7 days</option>
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="custom">Custom range…</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort orders">
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </div>
        {preset === 'custom' && (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:max-w-md">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} aria-label="From date" />
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} aria-label="To date" />
          </div>
        )}
      </Card>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size={28} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders found"
          message="Try adjusting your search or filters."
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">
                    <span className="inline-flex items-center gap-1">
                      Total <ArrowUpDown size={12} />
                    </span>
                  </th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => navigate(`/orders/${o.id}`)}
                    className="cursor-pointer transition hover:bg-ink-50"
                  >
                    <td className="px-5 py-3.5 font-medium">{o.order_number}</td>
                    <td className="max-w-[220px] px-4 py-3.5">
                      <p className="truncate">{o.shipping_name || '—'}</p>
                      <p className="truncate text-xs text-ink-400">{o.email}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-ink-500">
                      {formatDateTime(o.created_at)}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={o.status} size="xs" />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right font-medium tabular-nums">
                      {formatMoney(o.total)}
                    </td>
                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <StatusSelect order={o} onUpdated={onStatusUpdated} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-2.5 md:hidden">
            {rows.map((o) => (
              <Card
                key={o.id}
                className="cursor-pointer p-4 transition active:bg-ink-50"
              >
                <div onClick={() => navigate(`/orders/${o.id}`)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{o.order_number}</p>
                      <p className="truncate text-xs text-ink-400">
                        {o.shipping_name || o.email}
                      </p>
                    </div>
                    <StatusBadge status={o.status} size="xs" />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-sm">
                    <span className="text-xs text-ink-400">{formatDateTime(o.created_at)}</span>
                    <span className="font-semibold tabular-nums">{formatMoney(o.total)}</span>
                  </div>
                </div>
                <div className="mt-3 border-t border-ink-100 pt-2.5">
                  <StatusSelect order={o} onUpdated={onStatusUpdated} />
                </div>
              </Card>
            ))}
          </div>

          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </>
      )}
    </div>
  )
}
