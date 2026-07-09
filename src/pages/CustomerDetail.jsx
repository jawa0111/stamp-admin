import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatMoney, formatDateTime } from '../lib/format'
import PageHeader, { Card, CardHeader } from '../components/ui/PageHeader'
import StatusBadge, { PAID_STATUSES } from '../components/ui/StatusBadge'
import Spinner from '../components/ui/Spinner'
import { ArrowLeft, Mail, Phone, ShoppingBag, Banknote, CalendarDays, MapPin } from 'lucide-react'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [{ data: c }, { data: os }] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('orders')
          .select('id, order_number, status, total, created_at, shipping_address_line1, shipping_city, shipping_country')
          .eq('customer_id', id)
          .order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      setCustomer(c)
      setOrders(os ?? [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  const totals = useMemo(() => {
    const spend = orders
      .filter((o) => PAID_STATUSES.includes(o.status))
      .reduce((s, o) => s + Number(o.total), 0)
    return { orders: orders.length, spend }
  }, [orders])

  // Most recent shipping address on file
  const lastAddress = orders.find((o) => o.shipping_address_line1)

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size={30} />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="py-24 text-center text-ink-500">
        Customer not found.{' '}
        <Link to="/customers" className="font-medium text-ink-900 underline">
          Back to customers
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-ink-900"
        >
          <ArrowLeft size={16} /> Customers
        </Link>
      </div>

      <PageHeader
        title={customer.name}
        subtitle={`Customer since ${formatDateTime(customer.created_at)}`}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-500">
            <ShoppingBag size={14} /> Total orders
          </p>
          <p className="mt-1 font-display text-xl font-semibold">{totals.orders}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-500">
            <Banknote size={14} /> Total spend
          </p>
          <p className="mt-1 font-display text-xl font-semibold">{formatMoney(totals.spend)}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-500">
            <Mail size={14} /> Email
          </p>
          <a
            href={`mailto:${customer.email}`}
            className="mt-1 block truncate text-sm font-medium hover:underline"
          >
            {customer.email}
          </a>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-500">
            <Phone size={14} /> Phone
          </p>
          {customer.phone ? (
            <a href={`tel:${customer.phone}`} className="mt-1 block text-sm font-medium hover:underline">
              {customer.phone}
            </a>
          ) : (
            <p className="mt-1 text-sm text-ink-400">Not provided</p>
          )}
        </Card>
      </div>

      {lastAddress && (
        <Card className="mb-4 p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-500">
            <MapPin size={14} /> Most recent shipping address
          </p>
          <p className="mt-1 text-sm">
            {[lastAddress.shipping_address_line1, lastAddress.shipping_city, lastAddress.shipping_country]
              .filter(Boolean)
              .join(', ')}
          </p>
        </Card>
      )}

      <Card>
        <CardHeader title={`Order history (${orders.length})`} />
        {orders.length === 0 ? (
          <p className="flex items-center gap-2 px-5 py-8 text-sm text-ink-400">
            <CalendarDays size={16} /> No orders yet.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {orders.map((o) => (
              <li
                key={o.id}
                onClick={() => navigate(`/orders/${o.id}`)}
                className="flex cursor-pointer items-center gap-3 px-5 py-3.5 transition hover:bg-ink-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{o.order_number}</p>
                  <p className="text-xs text-ink-400">{formatDateTime(o.created_at)}</p>
                </div>
                <span className="hidden font-medium tabular-nums sm:block">
                  {formatMoney(o.total)}
                </span>
                <StatusBadge status={o.status} size="xs" />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
