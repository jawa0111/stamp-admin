import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { formatMoney, formatDate } from '../lib/format'
import PageHeader, { Card } from '../components/ui/PageHeader'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import Modal from '../components/ui/Modal'
import { Field, Input } from '../components/ui/Field'
import { Search, Users, Mail, Phone, Plus } from 'lucide-react'
import { PAID_STATUSES } from '../components/ui/StatusBadge'

const PAGE_SIZE = 30

export default function Customers() {
  const navigate = useNavigate()
  const toast = useToast()
  const [customers, setCustomers] = useState([])
  const [stats, setStats] = useState(new Map()) // customer_id -> { orders, spend, last }
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null) // null | {} (new)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    const [custRes, orderRes] = await Promise.all([
      supabase
        .from('customers')
        .select('id, name, email, phone, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('customer_id, status, total, created_at')
        .not('customer_id', 'is', null),
    ])
    setCustomers(custRes.data ?? [])
    const m = new Map()
    for (const o of orderRes.data ?? []) {
      const s = m.get(o.customer_id) ?? { orders: 0, spend: 0, last: null }
      s.orders += 1
      if (PAID_STATUSES.includes(o.status)) s.spend += Number(o.total)
      if (!s.last || o.created_at > s.last) s.last = o.created_at
      m.set(o.customer_id, s)
    }
    setStats(m)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function saveCustomer(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    const row = {
      name: fd.get('name').trim(),
      email: fd.get('email').trim().toLowerCase(),
      phone: fd.get('phone').trim() || null,
    }
    setBusy(true)
    const { error } = await supabase.from('customers').insert(row)
    setBusy(false)
    if (error) {
      return toast(
        error.code === '23505'
          ? 'A customer with this email already exists.'
          : error.message,
        'error'
      )
    }
    toast('Customer added')
    setModal(null)
    load()
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    )
  }, [customers, search])

  useEffect(() => setPage(1), [search])
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${filtered.length} customers`}
        actions={
          <button
            onClick={() => setModal({})}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110"
          >
            <Plus size={16} /> Add customer
          </button>
        }
      />

      <Card className="mb-4 p-3 sm:p-4">
        <div className="relative sm:max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input
            type="search"
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            aria-label="Search customers"
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size={28} />
        </div>
      ) : pageRows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers found"
          message="Customers are created automatically at checkout."
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand text-left text-xs uppercase tracking-wide text-blue-100">
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 text-right font-medium">Orders</th>
                  <th className="px-4 py-3 text-right font-medium">Total spend</th>
                  <th className="px-5 py-3 text-right font-medium">Last order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {pageRows.map((c) => {
                  const s = stats.get(c.id)
                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/customers/${c.id}`)}
                      className="cursor-pointer transition hover:bg-ink-50"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
                            {c.name?.charAt(0).toUpperCase() ?? '?'}
                          </div>
                          <span className="font-medium">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-ink-500">
                        <p>{c.email}</p>
                        {c.phone && <p className="text-xs">{c.phone}</p>}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{s?.orders ?? 0}</td>
                      <td className="px-4 py-3.5 text-right font-medium tabular-nums">
                        {formatMoney(s?.spend ?? 0)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right text-ink-500">
                        {s?.last ? formatDate(s.last) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-2.5 md:hidden">
            {pageRows.map((c) => {
              const s = stats.get(c.id)
              return (
                <Card
                  key={c.id}
                  className="cursor-pointer p-4 transition active:bg-ink-50"
                >
                  <div onClick={() => navigate(`/customers/${c.id}`)}>
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-white">
                        {c.name?.charAt(0).toUpperCase() ?? '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.name}</p>
                        <p className="flex items-center gap-1 truncate text-xs text-ink-400">
                          <Mail size={11} /> {c.email}
                        </p>
                        {c.phone && (
                          <p className="flex items-center gap-1 text-xs text-ink-400">
                            <Phone size={11} /> {c.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-2.5 text-sm">
                      <span className="text-ink-500">{s?.orders ?? 0} orders</span>
                      <span className="font-semibold tabular-nums">
                        {formatMoney(s?.spend ?? 0)}
                      </span>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title="Add customer">
        {modal && (
          <form onSubmit={saveCustomer} className="space-y-4">
            <Field label="Full name" required>
              <Input name="name" required placeholder="Jane Perera" autoFocus />
            </Field>
            <Field label="Email" required hint="Must be unique — used to link orders">
              <Input name="email" type="email" required placeholder="jane@example.com" />
            </Field>
            <Field label="Phone">
              <Input name="phone" type="tel" placeholder="+94 7X XXX XXXX" />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="cursor-pointer rounded-xl border border-ink-200 px-4 py-2 text-sm font-medium transition hover:bg-ink-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="cursor-pointer rounded-xl bg-brand px-5 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Add customer'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
