import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { formatMoney } from '../lib/format'
import PageHeader, { Card, CardHeader } from '../components/ui/PageHeader'
import Spinner from '../components/ui/Spinner'
import { Field, Input, Select } from '../components/ui/Field'
import { ORDER_STATUSES, STATUS_META } from '../components/ui/StatusBadge'
import { ArrowLeft, Plus, Trash2, Save, Search, UserPlus } from 'lucide-react'

const emptyAddress = {
  name: '', line1: '', line2: '', city: '', state: '', postal: '', country: '',
}

export default function OrderForm() {
  const navigate = useNavigate()
  const toast = useToast()
  const pickerRef = useRef(null)

  const [saving, setSaving] = useState(false)

  // customer
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('') // '' = new
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [newName, setNewName] = useState('')

  // items
  const [products, setProducts] = useState([]) // published, with variants
  const [items, setItems] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')

  // address + money + meta
  const [ship, setShip] = useState({ ...emptyAddress })
  const [billSame, setBillSame] = useState(true)
  const [bill, setBill] = useState({ ...emptyAddress })
  const [shippingFee, setShippingFee] = useState('')
  const [discount, setDiscount] = useState('')
  const [status, setStatus] = useState('payment_received')
  const [notes, setNotes] = useState('')
  const [reduceStock, setReduceStock] = useState(true)

  useEffect(() => {
    supabase
      .from('customers')
      .select('id, name, email, phone')
      .order('name')
      .then(({ data }) => setCustomers(data ?? []))
    supabase
      .from('products')
      .select('id, title, slug, price, images, product_variants(id, size, color, stock, price_override, is_active)')
      .eq('is_published', true)
      .order('title')
      .then(({ data }) => setProducts(data ?? []))
  }, [])

  // When picking an existing customer, prefill contact + name
  function selectCustomer(id) {
    setCustomerId(id)
    const c = customers.find((x) => x.id === id)
    if (c) {
      setEmail(c.email ?? '')
      setPhone(c.phone ?? '')
      setNewName(c.name ?? '')
      setShip((s) => ({ ...s, name: s.name || c.name || '' }))
    }
  }

  function addItem(product, variant) {
    const unit = Number(variant?.price_override ?? product.price)
    setItems((prev) => {
      // merge same product+variant
      const key = `${product.id}:${variant?.id ?? ''}`
      const existing = prev.find((i) => i.key === key)
      if (existing) {
        return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + 1 } : i))
      }
      return [
        ...prev,
        {
          key,
          product_id: product.id,
          variant_id: variant?.id ?? null,
          title: product.title,
          slug: product.slug,
          image: product.images?.[0] ?? null,
          size: variant?.size ?? null,
          color: variant?.color ?? null,
          unit_price: unit,
          quantity: 1,
          stock: variant?.stock ?? null,
        },
      ]
    })
    setPickerOpen(false)
    setPickerSearch('')
  }

  function updateItem(key, field, value) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, [field]: value } : i)))
  }
  function removeItem(key) {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0),
    [items]
  )
  const total = Math.max(
    0,
    subtotal + Number(shippingFee || 0) - Number(discount || 0)
  )

  const filteredProducts = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.title.toLowerCase().includes(q))
  }, [products, pickerSearch])

  async function save(e) {
    e.preventDefault()
    if (!email.trim()) return toast('Customer email is required.', 'error')
    if (items.length === 0) return toast('Add at least one item.', 'error')
    setSaving(true)

    // 1. Resolve customer — existing id, or create/find by email
    let cid = customerId || null
    if (!cid) {
      const custRow = {
        name: (newName || ship.name || email).trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
      }
      const { data: created, error: cErr } = await supabase
        .from('customers')
        .upsert(custRow, { onConflict: 'email' })
        .select('id')
        .single()
      if (cErr) {
        setSaving(false)
        return toast(`Could not save customer: ${cErr.message}`, 'error')
      }
      cid = created.id
    }

    // 2. Insert the order (order_number auto-generated by DB)
    const billing = billSame ? ship : bill
    const orderRow = {
      customer_id: cid,
      status,
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      shipping_name: ship.name || null,
      shipping_address_line1: ship.line1 || null,
      shipping_address_line2: ship.line2 || null,
      shipping_city: ship.city || null,
      shipping_state: ship.state || null,
      shipping_postal_code: ship.postal || null,
      shipping_country: ship.country || null,
      billing_same_as_shipping: billSame,
      billing_name: billing.name || null,
      billing_address_line1: billing.line1 || null,
      billing_address_line2: billing.line2 || null,
      billing_city: billing.city || null,
      billing_state: billing.state || null,
      billing_postal_code: billing.postal || null,
      billing_country: billing.country || null,
      currency: 'LKR',
      subtotal,
      shipping_fee: Number(shippingFee || 0),
      discount: Number(discount || 0),
      total,
      notes: notes.trim() || null,
    }
    const { data: order, error: oErr } = await supabase
      .from('orders')
      .insert(orderRow)
      .select('id, order_number')
      .single()
    if (oErr) {
      setSaving(false)
      return toast(`Could not create order: ${oErr.message}`, 'error')
    }

    // 3. Insert order_items (snapshots + links)
    const itemRows = items.map((i) => ({
      order_id: order.id,
      product_id: i.product_id,
      variant_id: i.variant_id,
      title: i.title,
      slug: i.slug,
      image: i.image,
      size: i.size,
      color: i.color,
      unit_price: Number(i.unit_price),
      quantity: Number(i.quantity),
      line_total: Number(i.unit_price) * Number(i.quantity),
    }))
    const { error: iErr } = await supabase.from('order_items').insert(itemRows)
    if (iErr) {
      setSaving(false)
      return toast(`Order created but items failed: ${iErr.message}`, 'error')
    }

    // 4. Optionally reduce variant stock
    if (reduceStock) {
      for (const i of items) {
        if (i.variant_id && i.stock != null) {
          await supabase
            .from('product_variants')
            .update({ stock: Math.max(0, i.stock - i.quantity) })
            .eq('id', i.variant_id)
        }
      }
    }

    setSaving(false)
    toast(`Order ${order.order_number} created`)
    navigate(`/orders/${order.id}`)
  }

  const addrField = (obj, setObj, key, label, ph) => (
    <Field label={label}>
      <Input value={obj[key]} onChange={(e) => setObj({ ...obj, [key]: e.target.value })} placeholder={ph} />
    </Field>
  )

  return (
    <form onSubmit={save}>
      <div className="mb-4">
        <Link to="/orders" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-ink-900">
          <ArrowLeft size={16} /> Orders
        </Link>
      </div>

      <PageHeader
        title="New order"
        subtitle="Create an order manually (phone / walk-in)"
        actions={
          <button
            type="submit"
            disabled={saving}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'Saving…' : 'Create order'}
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Customer */}
          <Card className="p-5">
            <h2 className="mb-4 font-display text-[15px] font-semibold">Customer</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Existing customer" hint="Or leave as “New customer” below">
                <Select value={customerId} onChange={(e) => selectCustomer(e.target.value)}>
                  <option value="">＋ New customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.email}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Name" required={!customerId}>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Customer name"
                  disabled={!!customerId}
                />
              </Field>
              <Field label="Email" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                  disabled={!!customerId}
                />
              </Field>
              <Field label="Phone">
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+94 7X XXX XXXX"
                  disabled={!!customerId}
                />
              </Field>
            </div>
            {customerId && (
              <button
                type="button"
                onClick={() => selectCustomer('')}
                className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-900"
              >
                <UserPlus size={13} /> Enter a new customer instead
              </button>
            )}
          </Card>

          {/* Items */}
          <Card>
            <CardHeader
              title={`Items (${items.length})`}
              action={
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPickerOpen((v) => !v)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium transition hover:bg-ink-100"
                  >
                    <Plus size={15} /> Add product
                  </button>
                  {pickerOpen && (
                    <div
                      ref={pickerRef}
                      className="absolute right-0 z-20 mt-2 max-h-80 w-80 overflow-y-auto rounded-xl border border-ink-200 bg-surface p-2 shadow-xl"
                    >
                      <div className="relative mb-2">
                        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                        <Input
                          autoFocus
                          value={pickerSearch}
                          onChange={(e) => setPickerSearch(e.target.value)}
                          placeholder="Search products…"
                          className="pl-9"
                        />
                      </div>
                      {filteredProducts.length === 0 ? (
                        <p className="px-2 py-4 text-center text-sm text-ink-400">No products found.</p>
                      ) : (
                        filteredProducts.map((p) => {
                          const variants = (p.product_variants ?? []).filter((v) => v.is_active)
                          return (
                            <div key={p.id} className="border-b border-ink-100 py-1.5 last:border-0">
                              <p className="px-2 text-sm font-medium">{p.title}</p>
                              <div className="mt-1 flex flex-wrap gap-1 px-2">
                                {variants.length === 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => addItem(p, null)}
                                    className="cursor-pointer rounded-md bg-ink-100 px-2 py-1 text-xs font-medium hover:bg-ink-200"
                                  >
                                    Add · {formatMoney(p.price)}
                                  </button>
                                ) : (
                                  variants.map((v) => (
                                    <button
                                      key={v.id}
                                      type="button"
                                      onClick={() => addItem(p, v)}
                                      className="cursor-pointer rounded-md bg-ink-100 px-2 py-1 text-xs font-medium hover:bg-ink-200"
                                      title={`Stock: ${v.stock}`}
                                    >
                                      {[v.size, v.color].filter(Boolean).join('/') || 'Default'} · {v.stock} left
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              }
            />
            {items.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-400">
                No items yet. Click “Add product” to build the order.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {items.map((i) => (
                  <li key={i.key} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    {i.image ? (
                      <img src={i.image} alt="" className="size-12 shrink-0 rounded-lg border border-ink-200 object-cover" />
                    ) : (
                      <div className="size-12 shrink-0 rounded-lg bg-ink-100" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.title}</p>
                      <p className="text-xs text-ink-400">
                        {[i.size, i.color].filter(Boolean).join(' / ') || 'One size'}
                      </p>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={i.unit_price}
                        onChange={(e) => updateItem(i.key, 'unit_price', e.target.value)}
                        aria-label="Unit price"
                      />
                    </div>
                    <div className="w-16">
                      <Input
                        type="number"
                        min="1"
                        value={i.quantity}
                        onChange={(e) => updateItem(i.key, 'quantity', Math.max(1, Number(e.target.value)))}
                        aria-label="Quantity"
                      />
                    </div>
                    <span className="w-24 text-right text-sm font-semibold tabular-nums">
                      {formatMoney(Number(i.unit_price) * Number(i.quantity))}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(i.key)}
                      className="cursor-pointer rounded-lg p-2 text-ink-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400"
                      aria-label="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Shipping address */}
          <Card className="p-5">
            <h2 className="mb-4 font-display text-[15px] font-semibold">Shipping address</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {addrField(ship, setShip, 'name', 'Recipient name', 'Jane Perera')}
              {addrField(ship, setShip, 'line1', 'Address line 1', 'No. 12, Main St')}
              {addrField(ship, setShip, 'line2', 'Address line 2', 'Apartment, unit…')}
              {addrField(ship, setShip, 'city', 'City', 'Colombo')}
              {addrField(ship, setShip, 'state', 'State / District', 'Western')}
              {addrField(ship, setShip, 'postal', 'Postal code', '00100')}
              {addrField(ship, setShip, 'country', 'Country', 'Sri Lanka')}
            </div>
            <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={billSame}
                onChange={(e) => setBillSame(e.target.checked)}
                className="size-4 cursor-pointer accent-primary"
              />
              Billing address same as shipping
            </label>
            {!billSame && (
              <div className="mt-4 grid gap-4 border-t border-ink-100 pt-4 sm:grid-cols-2">
                {addrField(bill, setBill, 'name', 'Billing name', '')}
                {addrField(bill, setBill, 'line1', 'Address line 1', '')}
                {addrField(bill, setBill, 'line2', 'Address line 2', '')}
                {addrField(bill, setBill, 'city', 'City', '')}
                {addrField(bill, setBill, 'state', 'State / District', '')}
                {addrField(bill, setBill, 'postal', 'Postal code', '')}
                {addrField(bill, setBill, 'country', 'Country', '')}
              </div>
            )}
          </Card>
        </div>

        {/* Summary sidebar */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="mb-4 font-display text-[15px] font-semibold">Summary</h2>
            <div className="space-y-3">
              <Field label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_META[s].label}</option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Shipping (LKR)">
                  <Input type="number" min="0" step="0.01" value={shippingFee} onChange={(e) => setShippingFee(e.target.value)} placeholder="0.00" />
                </Field>
                <Field label="Discount (LKR)">
                  <Input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" />
                </Field>
              </div>
              <Field label="Notes">
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Courier, remarks…" />
              </Field>
            </div>

            <dl className="mt-4 space-y-1.5 border-t border-ink-100 pt-4 text-sm">
              <div className="flex justify-between text-ink-500">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatMoney(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-ink-500">
                <dt>Shipping</dt>
                <dd className="tabular-nums">{formatMoney(Number(shippingFee || 0))}</dd>
              </div>
              {Number(discount || 0) > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <dt>Discount</dt>
                  <dd className="tabular-nums">−{formatMoney(Number(discount))}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-ink-200 pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(total)}</dd>
              </div>
            </dl>

            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={reduceStock}
                onChange={(e) => setReduceStock(e.target.checked)}
                className="size-4 cursor-pointer accent-primary"
              />
              Reduce stock for these items
            </label>

            <button
              type="submit"
              disabled={saving}
              className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              <Save size={16} /> {saving ? 'Saving…' : 'Create order'}
            </button>
          </Card>
        </div>
      </div>
    </form>
  )
}
