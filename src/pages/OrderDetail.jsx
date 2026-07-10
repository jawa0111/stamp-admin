import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { formatMoney, formatDateTime } from '../lib/format'
import PageHeader, { Card, CardHeader } from '../components/ui/PageHeader'
import StatusBadge, { NEXT_STATUSES, STATUS_META } from '../components/ui/StatusBadge'
import Spinner from '../components/ui/Spinner'
import { Textarea } from '../components/ui/Field'
import {
  ArrowLeft,
  Printer,
  Mail,
  Phone,
  MapPin,
  StickyNote,
  Save,
  ChevronRight,
  User,
} from 'lucide-react'

function Address({ title, name, line1, line2, city, state, postal, country }) {
  const empty = ![name, line1, city].some(Boolean)
  return (
    <div>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
        <MapPin size={13} /> {title}
      </h3>
      {empty ? (
        <p className="text-sm text-ink-400">Not provided</p>
      ) : (
        <div className="text-sm leading-relaxed text-ink-700">
          {name && <p className="font-medium text-ink-900">{name}</p>}
          {line1 && <p>{line1}</p>}
          {line2 && <p>{line2}</p>}
          <p>{[city, state, postal].filter(Boolean).join(', ')}</p>
          {country && <p>{country}</p>}
        </div>
      )}
    </div>
  )
}

export default function OrderDetail() {
  const { id } = useParams()
  const toast = useToast()
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [{ data: o }, { data: its }] = await Promise.all([
        supabase.from('orders').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('order_items')
          .select('*')
          .eq('order_id', id)
          .order('created_at', { ascending: true }),
      ])
      if (cancelled) return
      setOrder(o)
      setNotes(o?.notes ?? '')
      setItems(its ?? [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  async function updateStatus(status) {
    setUpdating(true)
    const { error } = await supabase.from('orders').update({ status }).eq('id', id)
    setUpdating(false)
    if (error) return toast(`Could not update: ${error.message}`, 'error')
    setOrder((o) => ({ ...o, status }))
    toast(`Status updated to ${STATUS_META[status].label}`)
  }

  async function saveNotes() {
    setSavingNotes(true)
    const { error } = await supabase.from('orders').update({ notes }).eq('id', id)
    setSavingNotes(false)
    if (error) return toast(`Could not save notes: ${error.message}`, 'error')
    toast('Notes saved')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size={30} />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="py-24 text-center text-ink-500">
        Order not found.{' '}
        <Link to="/orders" className="font-medium text-ink-900 underline">
          Back to orders
        </Link>
      </div>
    )
  }

  const next = NEXT_STATUSES[order.status] ?? []
  const billing = order.billing_same_as_shipping
    ? {
        name: order.shipping_name,
        line1: order.shipping_address_line1,
        line2: order.shipping_address_line2,
        city: order.shipping_city,
        state: order.shipping_state,
        postal: order.shipping_postal_code,
        country: order.shipping_country,
      }
    : {
        name: order.billing_name,
        line1: order.billing_address_line1,
        line2: order.billing_address_line2,
        city: order.billing_city,
        state: order.billing_state,
        postal: order.billing_postal_code,
        country: order.billing_country,
      }

  return (
    <div>
      <div className="no-print mb-4">
        <Link
          to="/orders"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-ink-900"
        >
          <ArrowLeft size={16} /> Orders
        </Link>
      </div>

      <PageHeader
        title={order.order_number}
        subtitle={`Placed ${formatDateTime(order.created_at)}`}
        actions={
          <button
            onClick={() => window.print()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-ink-200 bg-surface px-4 py-2.5 text-sm font-medium transition hover:bg-ink-100"
          >
            <Printer size={16} /> Print invoice
          </button>
        }
      />

      {/* Status flow */}
      <Card className="no-print mb-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={order.status} />
          {next.length > 0 && (
            <>
              <ChevronRight size={16} className="text-ink-300" />
              <div className="flex flex-wrap gap-2">
                {next.map((s) => {
                  const destructive = s === 'cancelled' || s === 'refunded'
                  return (
                    <button
                      key={s}
                      disabled={updating}
                      onClick={() => updateStatus(s)}
                      className={`cursor-pointer rounded-xl px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 ${
                        destructive
                          ? 'border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-100 dark:bg-red-500/15'
                          : 'bg-brand text-white hover:brightness-110'
                      }`}
                    >
                      {STATUS_META[s].label}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Invoice / items — printable */}
        <Card className="print-area p-0 lg:col-span-2">
          {/* Print-only header */}
          <div className="hidden border-b border-ink-200 px-6 py-5 print:block">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-2xl font-bold">STAMP</p>
                <p className="mt-1 text-sm text-ink-500">Invoice / Packing slip</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">{order.order_number}</p>
                <p className="text-ink-500">{formatDateTime(order.created_at)}</p>
                <p className="mt-1">{STATUS_META[order.status]?.label}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-ink-400">Ship to</p>
                <p className="mt-1 font-medium">{order.shipping_name}</p>
                <p>{order.shipping_address_line1}</p>
                {order.shipping_address_line2 && <p>{order.shipping_address_line2}</p>}
                <p>
                  {[order.shipping_city, order.shipping_state, order.shipping_postal_code]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                <p>{order.shipping_country}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-ink-400">Contact</p>
                <p className="mt-1">{order.email}</p>
                {order.phone && <p>{order.phone}</p>}
              </div>
            </div>
          </div>

          <CardHeader title={`Items (${items.length})`} />
          <ul className="divide-y divide-ink-100">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-4 px-5 py-4">
                {it.image ? (
                  <img
                    src={it.image}
                    alt=""
                    className="size-14 shrink-0 rounded-xl border border-ink-200 object-cover"
                  />
                ) : (
                  <div className="size-14 shrink-0 rounded-xl bg-ink-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{it.title}</p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {[it.size, it.color].filter(Boolean).join(' / ') || 'One size'}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-ink-500">
                    {it.quantity} × {formatMoney(it.unit_price)}
                  </p>
                  <p className="font-semibold tabular-nums">{formatMoney(it.line_total)}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* Totals */}
          <div className="border-t border-ink-200 px-5 py-4">
            <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between text-ink-500">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatMoney(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between text-ink-500">
                <dt>Shipping</dt>
                <dd className="tabular-nums">{formatMoney(order.shipping_fee)}</dd>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <dt>Discount</dt>
                  <dd className="tabular-nums">−{formatMoney(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-ink-200 pt-2 text-base font-semibold">
                <dt>Total ({order.currency})</dt>
                <dd className="tabular-nums">{formatMoney(order.total)}</dd>
              </div>
            </dl>
          </div>
        </Card>

        {/* Sidebar */}
        <div className="no-print flex flex-col gap-4">
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
              <User size={13} /> Customer
            </h3>
            <div className="space-y-2 text-sm">
              {order.shipping_name && (
                <p className="font-medium text-ink-900">{order.shipping_name}</p>
              )}
              <a
                href={`mailto:${order.email}`}
                className="flex items-center gap-2 text-ink-600 transition hover:text-ink-900"
              >
                <Mail size={14} className="shrink-0" /> {order.email}
              </a>
              {order.phone && (
                <a
                  href={`tel:${order.phone}`}
                  className="flex items-center gap-2 text-ink-600 transition hover:text-ink-900"
                >
                  <Phone size={14} className="shrink-0" /> {order.phone}
                </a>
              )}
              {order.customer_id && (
                <Link
                  to={`/customers/${order.customer_id}`}
                  className="inline-block text-sm font-medium text-ink-900 underline"
                >
                  View customer profile
                </Link>
              )}
            </div>
          </Card>

          <Card className="space-y-5 p-5">
            <Address
              title="Shipping address"
              name={order.shipping_name}
              line1={order.shipping_address_line1}
              line2={order.shipping_address_line2}
              city={order.shipping_city}
              state={order.shipping_state}
              postal={order.shipping_postal_code}
              country={order.shipping_country}
            />
            <Address title="Billing address" {...billing} />
            {order.billing_same_as_shipping && (
              <p className="-mt-3 text-xs text-ink-400">Same as shipping</p>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
              <StickyNote size={13} /> Internal notes
            </h3>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="e.g. Courier: Koombiyo, tracking #KB123456"
            />
            <button
              onClick={saveNotes}
              disabled={savingNotes || notes === (order.notes ?? '')}
              className="mt-2.5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-40"
            >
              <Save size={15} /> {savingNotes ? 'Saving…' : 'Save notes'}
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}
