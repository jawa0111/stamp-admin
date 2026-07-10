import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatMoney, formatMoneyCompact, formatDate } from '../lib/format'
import { todayISO, startOfMonthISO } from '../lib/dates'
import PageHeader, { Card, CardHeader } from '../components/ui/PageHeader'
import StatusBadge, { PAID_STATUSES } from '../components/ui/StatusBadge'
import StatusSelect from '../components/StatusSelect'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import {
  Banknote,
  CalendarDays,
  ShoppingBag,
  Clock4,
  TrendingUp,
  Receipt,
  PackageSearch,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

const LOW_STOCK_THRESHOLD = 5

function MetricCard({ icon: Icon, label, value, tone = 'default', sub }) {
  // Each tone: soft gradient card, matching border, label, value and icon chip
  const tones = {
    default: {
      card: 'from-ink-50 to-ink-100 border-ink-200',
      label: 'text-ink-500', value: 'text-ink-900',
      chip: 'bg-ink-200 text-ink-600',
    },
    green: {
      card: 'from-emerald-50 to-teal-100 border-emerald-200 dark:from-emerald-500/10 dark:to-emerald-500/5 dark:border-emerald-500/20',
      label: 'text-emerald-700 dark:text-emerald-300', value: 'text-emerald-950 dark:text-emerald-50',
      chip: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30',
    },
    blue: {
      card: 'from-sky-50 to-blue-100 border-sky-200 dark:from-sky-500/10 dark:to-sky-500/5 dark:border-sky-500/20',
      label: 'text-sky-700 dark:text-sky-300', value: 'text-sky-950 dark:text-sky-50',
      chip: 'bg-sky-500 text-white shadow-sm shadow-sky-500/30',
    },
    violet: {
      card: 'from-violet-50 to-purple-100 border-violet-200 dark:from-violet-500/10 dark:to-violet-500/5 dark:border-violet-500/20',
      label: 'text-violet-700 dark:text-violet-300', value: 'text-violet-950 dark:text-violet-50',
      chip: 'bg-violet-500 text-white shadow-sm shadow-violet-500/30',
    },
    amber: {
      card: 'from-amber-50 to-orange-100 border-amber-200 dark:from-amber-500/10 dark:to-amber-500/5 dark:border-amber-500/20',
      label: 'text-amber-700 dark:text-amber-300', value: 'text-amber-950 dark:text-amber-50',
      chip: 'bg-amber-500 text-white shadow-sm shadow-amber-500/30',
    },
    red: {
      card: 'from-red-50 to-rose-100 border-red-200 dark:from-red-500/10 dark:to-red-500/5 dark:border-red-500/20',
      label: 'text-red-700 dark:text-red-300', value: 'text-red-950 dark:text-red-50',
      chip: 'bg-red-500 text-white shadow-sm shadow-red-500/30',
    },
  }
  const t = tones[tone] ?? tones.default
  return (
    <div className={`rounded-2xl border bg-gradient-to-br shadow-sm ${t.card} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-[13px] font-medium ${t.label}`}>{label}</p>
          <p className={`mt-1.5 truncate font-display text-xl font-semibold tracking-tight sm:text-2xl ${t.value}`}>
            {value}
          </p>
          {sub && <p className={`mt-0.5 text-xs opacity-70 ${t.label}`}>{sub}</p>}
        </div>
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${t.chip}`}>
          <Icon size={19} />
        </div>
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, label, money = false }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-ink-200 bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-ink-500">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-semibold text-ink-900">
          {money ? formatMoney(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { isAdmin, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([]) // last 30 days, light columns
  const [recent, setRecent] = useState([])
  const [expensesMonth, setExpensesMonth] = useState(0)
  const [lowStock, setLowStock] = useState([])
  const [bestSellers, setBestSellers] = useState([])

  async function load() {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - 29)
    const sinceISO = since.toISOString().slice(0, 10)

    const queries = [
      supabase
        .from('orders')
        .select('id, order_number, status, total, created_at')
        .gte('created_at', `${sinceISO}T00:00:00`)
        .order('created_at', { ascending: true }),
      supabase
        .from('orders')
        .select('id, order_number, status, total, email, shipping_name, created_at')
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('product_variants')
        .select('id, size, color, stock, is_active, products!inner(id, title, is_published)')
        .eq('is_active', true)
        .eq('products.is_published', true)
        .lte('stock', LOW_STOCK_THRESHOLD)
        .order('stock', { ascending: true })
        .limit(8),
      supabase
        .from('order_items')
        .select('title, quantity, line_total, orders!inner(status, created_at)')
        .gte('orders.created_at', `${sinceISO}T00:00:00`)
        .in('orders.status', PAID_STATUSES),
    ]
    if (isAdmin) {
      queries.push(
        supabase.from('expenses').select('amount').gte('spent_at', startOfMonthISO())
      )
    }

    const [ordersRes, recentRes, lowRes, itemsRes, expRes] = await Promise.all(queries)

    setOrders(ordersRes.data ?? [])
    setRecent(recentRes.data ?? [])
    setLowStock(lowRes.data ?? [])
    if (expRes) {
      setExpensesMonth((expRes.data ?? []).reduce((s, e) => s + Number(e.amount), 0))
    }

    // Aggregate best sellers by title
    const byTitle = new Map()
    for (const it of itemsRes.data ?? []) {
      const cur = byTitle.get(it.title) ?? { title: it.title, qty: 0, revenue: 0 }
      cur.qty += it.quantity
      cur.revenue += Number(it.line_total)
      byTitle.set(it.title, cur)
    }
    setBestSellers(
      [...byTitle.values()].sort((a, b) => b.qty - a.qty).slice(0, 5)
    )
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [isAdmin])

  const metrics = useMemo(() => {
    const today = todayISO()
    const monthStart = startOfMonthISO()
    let todayRevenue = 0
    let monthRevenue = 0
    let pending = 0
    for (const o of orders) {
      const day = o.created_at.slice(0, 10)
      const paid = PAID_STATUSES.includes(o.status)
      if (paid && day === today) todayRevenue += Number(o.total)
      if (paid && day >= monthStart) monthRevenue += Number(o.total)
      if (o.status === 'pending_payment') pending++
    }
    return {
      todayRevenue,
      monthRevenue,
      totalOrders: orders.length,
      pending,
      profit: monthRevenue - expensesMonth,
    }
  }, [orders, expensesMonth])

  const chartData = useMemo(() => {
    const days = new Map()
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      days.set(key, {
        day: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        revenue: 0,
        orders: 0,
      })
    }
    for (const o of orders) {
      const key = o.created_at.slice(0, 10)
      const row = days.get(key)
      if (!row) continue
      row.orders += 1
      if (PAID_STATUSES.includes(o.status)) row.revenue += Number(o.total)
    }
    return [...days.values()]
  }, [orders])

  function onStatusUpdated(id, status) {
    setRecent((r) => r.map((o) => (o.id === id ? { ...o, status } : o)))
    setOrders((r) => r.map((o) => (o.id === id ? { ...o, status } : o)))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size={30} />
      </div>
    )
  }

  const firstName = (profile?.full_name ?? '').split(' ')[0]

  return (
    <div>
      <PageHeader
        title={firstName ? `Hey, ${firstName}` : 'Dashboard'}
        subtitle="Here's what's happening at STAMP — last 30 days"
      />

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <MetricCard
          icon={Banknote}
          label="Today's revenue"
          value={formatMoney(metrics.todayRevenue)}
          tone="green"
        />
        <MetricCard
          icon={CalendarDays}
          label="Revenue this month"
          value={formatMoney(metrics.monthRevenue)}
          tone="blue"
        />
        <MetricCard
          icon={ShoppingBag}
          label="Orders (30 days)"
          value={metrics.totalOrders}
          tone="violet"
        />
        <MetricCard
          icon={Clock4}
          label="Pending payment"
          value={metrics.pending}
          tone="amber"
        />
        {isAdmin && (
          <>
            <MetricCard
              icon={TrendingUp}
              label="Profit this month"
              value={formatMoney(metrics.profit)}
              tone={metrics.profit >= 0 ? 'green' : 'red'}
              sub="Revenue − expenses"
            />
            <MetricCard
              icon={Receipt}
              label="Expenses this month"
              value={formatMoney(expensesMonth)}
              tone="red"
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Revenue — last 30 days" />
          <div className="h-64 px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#18181b" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#18181b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,140,0.2)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatMoneyCompact(v)}
                  width={70}
                />
                <Tooltip content={<ChartTooltip money />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#18181b"
                  strokeWidth={2.5}
                  fill="url(#rev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Orders — last 30 days" />
          <div className="h-64 px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ordersBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3f3f46" />
                    <stop offset="100%" stopColor="#09090b" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,140,0.2)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={32}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="orders" fill="url(#ordersBar)" radius={[5, 5, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Bottom grid */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Recent orders */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent orders"
            action={
              <Link
                to="/orders"
                className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 transition hover:text-ink-900"
              >
                View all <ArrowUpRight size={14} />
              </Link>
            }
          />
          {recent.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={ShoppingBag} title="No orders yet" message="New orders will appear here." />
            </div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {recent.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/orders/${o.id}`}
                      className="font-medium text-ink-900 transition hover:underline"
                    >
                      {o.order_number}
                    </Link>
                    <p className="truncate text-xs text-ink-400">
                      {o.shipping_name || o.email} · {formatDate(o.created_at)}
                    </p>
                  </div>
                  <span className="hidden font-medium tabular-nums sm:block">
                    {formatMoney(o.total)}
                  </span>
                  <StatusBadge status={o.status} size="xs" />
                  <StatusSelect order={o} onUpdated={onStatusUpdated} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {/* Best sellers */}
          <Card>
            <CardHeader title="Best sellers (30 days)" />
            {bestSellers.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-400">No paid orders yet.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {bestSellers.map((b, i) => (
                  <li key={b.title} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-xs font-semibold text-ink-500">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.title}</p>
                      <p className="text-xs text-ink-400">{b.qty} sold</p>
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {formatMoneyCompact(b.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Low stock */}
          <Card>
            <CardHeader title="Low stock" />
            {lowStock.length === 0 ? (
              <p className="flex items-center gap-2 px-5 py-6 text-sm text-ink-400">
                <PackageSearch size={16} /> All variants are stocked.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {lowStock.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 px-5 py-3">
                    <AlertTriangle
                      size={16}
                      className={v.stock === 0 ? 'text-red-500' : 'text-amber-500'}
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/products/${v.products.id}`}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {v.products.title}
                      </Link>
                      <p className="text-xs text-ink-400">
                        {[v.size, v.color].filter(Boolean).join(' / ') || 'Default'}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        v.stock === 0
                          ? 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400'
                          : 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {v.stock === 0 ? 'Out' : `${v.stock} left`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
