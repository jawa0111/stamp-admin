import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { formatMoney, formatDate } from '../lib/format'
import { rangeForPreset, rangeToTimestamps } from '../lib/dates'
import PageHeader, { Card, CardHeader } from '../components/ui/PageHeader'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { PAID_STATUSES } from '../components/ui/StatusBadge'
import {
  Banknote,
  Receipt,
  TrendingUp,
  PiggyBank,
  Plus,
  Pencil,
  Trash2,
  Package,
  Wallet,
} from 'lucide-react'

const EXPENSE_CATEGORIES = ['inventory', 'packaging', 'ads', 'delivery', 'other']

const CATEGORY_STYLES = {
  inventory: 'bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400',
  packaging: 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400',
  ads: 'bg-pink-100 dark:bg-pink-500/15 text-pink-700 dark:text-pink-400',
  delivery: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
  other: 'bg-ink-100 text-ink-600',
}

function CategoryChip({ category }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
        CATEGORY_STYLES[category] ?? CATEGORY_STYLES.other
      }`}
    >
      {category || 'other'}
    </span>
  )
}

function StatCard({ icon: Icon, label, value, tone, sub }) {
  const tones = {
    green: {
      card: 'from-emerald-50 to-teal-100 border-emerald-200 dark:from-emerald-500/10 dark:to-emerald-500/5 dark:border-emerald-500/20',
      label: 'text-emerald-700 dark:text-emerald-300', value: 'text-emerald-950 dark:text-emerald-50',
      chip: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30',
    },
    red: {
      card: 'from-red-50 to-rose-100 border-red-200 dark:from-red-500/10 dark:to-red-500/5 dark:border-red-500/20',
      label: 'text-red-700 dark:text-red-300', value: 'text-red-950 dark:text-red-50',
      chip: 'bg-red-500 text-white shadow-sm shadow-red-500/30',
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
  }
  const t = tones[tone] ?? tones.blue
  return (
    <div className={`rounded-2xl border bg-gradient-to-br shadow-sm ${t.card} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-[13px] font-medium ${t.label}`}>{label}</p>
          <p className={`mt-1.5 truncate font-display text-lg font-semibold tracking-tight sm:text-xl ${t.value}`}>
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

export default function Finances() {
  const { profile } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState('overview')
  const [preset, setPreset] = useState('this_month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [includeCogs, setIncludeCogs] = useState(false)

  const [loading, setLoading] = useState(true)
  const [revenue, setRevenue] = useState(0)
  const [cogs, setCogs] = useState(0)
  const [expenses, setExpenses] = useState([])
  const [investments, setInvestments] = useState([])
  const [reloadKey, setReloadKey] = useState(0)

  // modals
  const [expenseModal, setExpenseModal] = useState(null) // null | {} | row
  const [investModal, setInvestModal] = useState(null)
  const [deleting, setDeleting] = useState(null) // { table, row }
  const [busy, setBusy] = useState(false)

  const range = useMemo(() => {
    if (preset === 'custom') return { from: customFrom || null, to: customTo || null }
    return rangeForPreset(preset)
  }, [preset, customFrom, customTo])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { fromTs, toTs } = rangeToTimestamps(range)

      // Paid orders revenue in range
      let oq = supabase.from('orders').select('total').in('status', PAID_STATUSES)
      if (fromTs) oq = oq.gte('created_at', fromTs)
      if (toTs) oq = oq.lte('created_at', toTs)

      // COGS: order items of paid orders joined to product cost price
      let cq = supabase
        .from('order_items')
        .select('quantity, product_id, products(cost_price), orders!inner(status, created_at)')
        .in('orders.status', PAID_STATUSES)
      if (fromTs) cq = cq.gte('orders.created_at', fromTs)
      if (toTs) cq = cq.lte('orders.created_at', toTs)

      let eq = supabase.from('expenses').select('*').order('spent_at', { ascending: false })
      if (range.from) eq = eq.gte('spent_at', range.from)
      if (range.to) eq = eq.lte('spent_at', range.to)

      // Investments are always shown in full (running totals), unaffected by range
      const iq = supabase
        .from('investments')
        .select('*')
        .order('invested_at', { ascending: false })

      const [oRes, cRes, eRes, iRes] = await Promise.all([oq, cq, eq, iq])
      if (cancelled) return

      setRevenue((oRes.data ?? []).reduce((s, o) => s + Number(o.total), 0))
      setCogs(
        (cRes.data ?? []).reduce(
          (s, it) => s + it.quantity * Number(it.products?.cost_price ?? 0),
          0
        )
      )
      setExpenses(eRes.data ?? [])
      setInvestments(iRes.data ?? [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [range, reloadKey])

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const profit = revenue - totalExpenses - (includeCogs ? cogs : 0)

  const expensesByCategory = useMemo(() => {
    const m = new Map()
    for (const e of expenses) {
      const k = e.category || 'other'
      m.set(k, (m.get(k) ?? 0) + Number(e.amount))
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [expenses])

  const investmentsByFounder = useMemo(() => {
    const m = new Map()
    for (const i of investments) {
      m.set(i.founder_name, (m.get(i.founder_name) ?? 0) + Number(i.amount))
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [investments])
  const totalInvested = investments.reduce((s, i) => s + Number(i.amount), 0)

  async function saveExpense(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    const row = {
      description: fd.get('description'),
      category: fd.get('category'),
      amount: Number(fd.get('amount')),
      spent_at: fd.get('spent_at'),
    }
    setBusy(true)
    const res = expenseModal.id
      ? await supabase.from('expenses').update(row).eq('id', expenseModal.id)
      : await supabase.from('expenses').insert({ ...row, created_by: profile.id })
    setBusy(false)
    if (res.error) return toast(res.error.message, 'error')
    toast(expenseModal.id ? 'Expense updated' : 'Expense added')
    setExpenseModal(null)
    setReloadKey((k) => k + 1)
  }

  async function saveInvestment(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    const row = {
      founder_name: fd.get('founder_name'),
      amount: Number(fd.get('amount')),
      invested_at: fd.get('invested_at'),
      notes: fd.get('notes') || null,
    }
    setBusy(true)
    const res = investModal.id
      ? await supabase.from('investments').update(row).eq('id', investModal.id)
      : await supabase.from('investments').insert({ ...row, created_by: profile.id })
    setBusy(false)
    if (res.error) return toast(res.error.message, 'error')
    toast(investModal.id ? 'Investment updated' : 'Investment recorded')
    setInvestModal(null)
    setReloadKey((k) => k + 1)
  }

  async function confirmDelete() {
    setBusy(true)
    const { error } = await supabase
      .from(deleting.table)
      .delete()
      .eq('id', deleting.row.id)
    setBusy(false)
    setDeleting(null)
    if (error) return toast(error.message, 'error')
    toast('Deleted')
    setReloadKey((k) => k + 1)
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'expenses', label: `Expenses (${expenses.length})` },
    { id: 'investments', label: `Investments (${investments.length})` },
  ]

  return (
    <div>
      <PageHeader
        title="Finances"
        subtitle="Revenue, expenses, profit and founder investments"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              aria-label="Date range"
              className="!w-auto"
            >
              <option value="this_month">This month</option>
              <option value="last_month">Last month</option>
              <option value="this_year">This year</option>
              <option value="all">All time</option>
              <option value="custom">Custom…</option>
            </Select>
            {preset === 'custom' && (
              <>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="!w-auto"
                  aria-label="From date"
                />
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="!w-auto"
                  aria-label="To date"
                />
              </>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl bg-ink-200/60 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.id ? 'bg-surface text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size={28} />
        </div>
      ) : tab === 'overview' ? (
        <div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard icon={Banknote} label="Revenue (paid orders)" value={formatMoney(revenue)} tone="green" />
            <StatCard icon={Receipt} label="Expenses" value={formatMoney(totalExpenses)} tone="red" />
            <StatCard
              icon={TrendingUp}
              label="Profit"
              value={formatMoney(profit)}
              tone={profit >= 0 ? 'green' : 'red'}
              sub={includeCogs ? 'Revenue − expenses − COGS' : 'Revenue − expenses'}
            />
            <StatCard
              icon={PiggyBank}
              label="Total invested"
              value={formatMoney(totalInvested)}
              tone="violet"
              sub="All time"
            />
          </div>

          <label className="mt-4 flex w-fit cursor-pointer items-center gap-2.5 rounded-xl border border-ink-200 bg-surface px-4 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={includeCogs}
              onChange={(e) => setIncludeCogs(e.target.checked)}
              className="size-4 cursor-pointer accent-primary"
            />
            <Package size={15} className="text-ink-400" />
            Subtract cost of goods sold ({formatMoney(cogs)}) from profit
          </label>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Expenses by category" />
              {expensesByCategory.length === 0 ? (
                <p className="px-5 py-8 text-sm text-ink-400">No expenses in this period.</p>
              ) : (
                <ul className="space-y-3 p-5">
                  {expensesByCategory.map(([cat, amount]) => (
                    <li key={cat}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <CategoryChip category={cat} />
                        <span className="font-medium tabular-nums">{formatMoney(amount)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${Math.max(3, (amount / totalExpenses) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="Investment by founder (all time)" />
              {investmentsByFounder.length === 0 ? (
                <p className="px-5 py-8 text-sm text-ink-400">No investments recorded yet.</p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {investmentsByFounder.map(([name, amount]) => (
                    <li key={name} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-500/15 text-sm font-semibold text-violet-700 dark:text-violet-400">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">{formatMoney(amount)}</p>
                        <p className="text-xs text-ink-400">
                          {((amount / totalInvested) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      ) : tab === 'expenses' ? (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-ink-500">
              Total: <strong className="text-ink-900">{formatMoney(totalExpenses)}</strong> in selected period
            </p>
            <button
              onClick={() => setExpenseModal({})}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110"
            >
              <Plus size={16} /> Add expense
            </button>
          </div>

          {expenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No expenses in this period"
              message="Track inventory, packaging, ads and delivery costs here."
            />
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-ink-100">
                {expenses.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{x.description}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <CategoryChip category={x.category} />
                        <span className="text-xs text-ink-400">{formatDate(x.spent_at)}</span>
                      </div>
                    </div>
                    <span className="font-semibold tabular-nums">{formatMoney(x.amount)}</span>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => setExpenseModal(x)}
                        className="cursor-pointer rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-900"
                        aria-label="Edit expense"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleting({ table: 'expenses', row: x })}
                        className="cursor-pointer rounded-lg p-2 text-ink-400 transition hover:bg-red-50 dark:hover:bg-red-500/15 dark:bg-red-500/10 hover:text-red-600 dark:text-red-400"
                        aria-label="Delete expense"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-ink-500">
              Total invested: <strong className="text-ink-900">{formatMoney(totalInvested)}</strong>
            </p>
            <button
              onClick={() => setInvestModal({})}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110"
            >
              <Plus size={16} /> Record investment
            </button>
          </div>

          {/* Running totals per founder */}
          {investmentsByFounder.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {investmentsByFounder.map(([name, amount]) => (
                <Card key={name} className="p-4">
                  <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-ink-500">
                    <Wallet size={13} /> {name}
                  </p>
                  <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                    {formatMoney(amount)}
                  </p>
                </Card>
              ))}
            </div>
          )}

          {investments.length === 0 ? (
            <EmptyState
              icon={PiggyBank}
              title="No investments recorded"
              message="Track each founder's capital contributions over time."
            />
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-ink-100">
                {investments.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-500/15 text-sm font-semibold text-violet-700 dark:text-violet-400">
                      {x.founder_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{x.founder_name}</p>
                      <p className="truncate text-xs text-ink-400">
                        {formatDate(x.invested_at)}
                        {x.notes && ` · ${x.notes}`}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums">{formatMoney(x.amount)}</span>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => setInvestModal(x)}
                        className="cursor-pointer rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-900"
                        aria-label="Edit investment"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleting({ table: 'investments', row: x })}
                        className="cursor-pointer rounded-lg p-2 text-ink-400 transition hover:bg-red-50 dark:hover:bg-red-500/15 dark:bg-red-500/10 hover:text-red-600 dark:text-red-400"
                        aria-label="Delete investment"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* Expense modal */}
      <Modal
        open={!!expenseModal}
        onClose={() => setExpenseModal(null)}
        title={expenseModal?.id ? 'Edit expense' : 'Add expense'}
      >
        {expenseModal && (
          <form onSubmit={saveExpense} className="space-y-4">
            <Field label="Description" required>
              <Input
                name="description"
                required
                defaultValue={expenseModal.description ?? ''}
                placeholder="Fabric order — 50 units"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category" required>
                <Select name="category" required defaultValue={expenseModal.category ?? 'inventory'}>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c} className="capitalize">
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Amount (LKR)" required>
                <Input
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  required
                  defaultValue={expenseModal.amount ?? ''}
                  placeholder="12500.00"
                />
              </Field>
            </div>
            <Field label="Date" required>
              <Input
                name="spent_at"
                type="date"
                required
                defaultValue={expenseModal.spent_at ?? new Date().toISOString().slice(0, 10)}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setExpenseModal(null)}
                className="cursor-pointer rounded-xl border border-ink-200 px-4 py-2 text-sm font-medium transition hover:bg-ink-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="cursor-pointer rounded-xl bg-brand px-5 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save expense'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Investment modal */}
      <Modal
        open={!!investModal}
        onClose={() => setInvestModal(null)}
        title={investModal?.id ? 'Edit investment' : 'Record investment'}
      >
        {investModal && (
          <form onSubmit={saveInvestment} className="space-y-4">
            <Field label="Founder name" required>
              <Input
                name="founder_name"
                required
                defaultValue={investModal.founder_name ?? ''}
                placeholder="e.g. Mathu"
                list="founder-names"
              />
              <datalist id="founder-names">
                {investmentsByFounder.map(([name]) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (LKR)" required>
                <Input
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  required
                  defaultValue={investModal.amount ?? ''}
                  placeholder="100000.00"
                />
              </Field>
              <Field label="Date" required>
                <Input
                  name="invested_at"
                  type="date"
                  required
                  defaultValue={investModal.invested_at ?? new Date().toISOString().slice(0, 10)}
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                name="notes"
                rows={2}
                defaultValue={investModal.notes ?? ''}
                placeholder="Optional — e.g. initial capital, restock round…"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setInvestModal(null)}
                className="cursor-pointer rounded-xl border border-ink-200 px-4 py-2 text-sm font-medium transition hover:bg-ink-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="cursor-pointer rounded-xl bg-brand px-5 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save investment'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={`Delete ${deleting?.table === 'expenses' ? 'expense' : 'investment'}?`}
        message="This entry will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  )
}
