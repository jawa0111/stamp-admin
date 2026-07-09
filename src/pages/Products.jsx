import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { formatMoney } from '../lib/format'
import PageHeader, { Card } from '../components/ui/PageHeader'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Input, Select } from '../components/ui/Field'
import {
  Plus,
  Search,
  Shirt,
  Pencil,
  Trash2,
  Archive,
  AlertTriangle,
  ImageOff,
} from 'lucide-react'

const LOW_STOCK_THRESHOLD = 5

function stockOf(p) {
  return (p.product_variants ?? [])
    .filter((v) => v.is_active)
    .reduce((s, v) => s + v.stock, 0)
}

export default function Products() {
  const navigate = useNavigate()
  const toast = useToast()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [visibility, setVisibility] = useState('active') // active | draft | published | archived | all
  const [deleting, setDeleting] = useState(null) // product pending delete/archive
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    const [prodRes, catRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, title, slug, category, tag, price, cost_price, images, is_published, is_archived, created_at, product_variants(id, stock, is_active)')
        .order('created_at', { ascending: false }),
      supabase.from('categories').select('slug, name').order('sort_order'),
    ])
    setProducts(prodRes.data ?? [])
    setCategories(catRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (q && !p.title.toLowerCase().includes(q) && !p.slug.includes(q)) return false
      if (category && p.category !== category) return false
      switch (visibility) {
        case 'active':
          return !p.is_archived
        case 'published':
          return p.is_published && !p.is_archived
        case 'draft':
          return !p.is_published && !p.is_archived
        case 'archived':
          return p.is_archived
        default:
          return true
      }
    })
  }, [products, search, category, visibility])

  async function confirmDelete() {
    const p = deleting
    setBusy(true)

    // Archive instead of hard delete when the product has order history
    const { count } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', p.id)

    if ((count ?? 0) > 0) {
      const { error } = await supabase
        .from('products')
        .update({ is_archived: true, is_published: false })
        .eq('id', p.id)
      setBusy(false)
      setDeleting(null)
      if (error) return toast(`Could not archive: ${error.message}`, 'error')
      toast(`"${p.title}" has order history — archived instead of deleted.`)
    } else {
      const { error } = await supabase.from('products').delete().eq('id', p.id)
      setBusy(false)
      setDeleting(null)
      if (error) return toast(`Could not delete: ${error.message}`, 'error')
      toast(`"${p.title}" deleted.`)
    }
    load()
  }

  async function togglePublished(p) {
    const { error } = await supabase
      .from('products')
      .update({ is_published: !p.is_published })
      .eq('id', p.id)
    if (error) return toast(error.message, 'error')
    setProducts((all) =>
      all.map((x) => (x.id === p.id ? { ...x, is_published: !p.is_published } : x))
    )
  }

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={`${filtered.length} of ${products.length} products`}
        actions={
          <Link
            to="/products/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-strong"
          >
            <Plus size={16} /> New product
          </Link>
        }
      />

      <Card className="mb-4 p-3 sm:p-4">
        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input
              type="search"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              aria-label="Search products"
            />
          </div>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={visibility} onChange={(e) => setVisibility(e.target.value)} aria-label="Filter by visibility">
            <option value="active">Active (not archived)</option>
            <option value="published">Published only</option>
            <option value="draft">Drafts only</option>
            <option value="archived">Archived</option>
            <option value="all">Everything</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Shirt}
          title="No products found"
          message="Create your first product to get started."
          action={
            <Link
              to="/products/new"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-strong"
            >
              <Plus size={16} /> New product
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => {
            const stock = stockOf(p)
            const low = stock <= LOW_STOCK_THRESHOLD
            return (
              <Card key={p.id} className="group overflow-hidden">
                <div
                  className="relative aspect-[4/5] cursor-pointer overflow-hidden bg-ink-100"
                  onClick={() => navigate(`/products/${p.id}`)}
                >
                  {p.images?.[0] ? (
                    <img
                      src={p.images[0]}
                      alt={p.title}
                      loading="lazy"
                      className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-ink-300">
                      <ImageOff size={32} />
                    </div>
                  )}
                  <div className="absolute left-2 top-2 flex flex-col gap-1.5">
                    {p.is_archived ? (
                      <span className="rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                        Archived
                      </span>
                    ) : !p.is_published ? (
                      <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                        Draft
                      </span>
                    ) : null}
                    {p.tag && (
                      <span className="rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-medium text-ink-900 backdrop-blur">
                        {p.tag}
                      </span>
                    )}
                  </div>
                  {low && !p.is_archived && (
                    <span
                      className={`absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold backdrop-blur ${
                        stock === 0 ? 'bg-red-600/90 text-white' : 'bg-amber-400/95 text-amber-950'
                      }`}
                    >
                      <AlertTriangle size={11} />
                      {stock === 0 ? 'Out of stock' : `${stock} left`}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p
                    className="cursor-pointer truncate text-sm font-medium hover:underline"
                    onClick={() => navigate(`/products/${p.id}`)}
                  >
                    {p.title}
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatMoney(p.price)}
                    </span>
                    <span className="text-xs text-ink-400">{stock} in stock</span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between border-t border-ink-100 pt-2.5">
                    {/* publish toggle */}
                    <button
                      onClick={() => togglePublished(p)}
                      disabled={p.is_archived}
                      role="switch"
                      aria-checked={p.is_published}
                      aria-label={`${p.title} published`}
                      className={`relative h-5.5 w-10 cursor-pointer rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        p.is_published ? 'bg-emerald-500' : 'bg-ink-300'
                      }`}
                      title={p.is_published ? 'Published — click to unpublish' : 'Draft — click to publish'}
                    >
                      <span
                        className={`absolute top-0.5 size-4.5 rounded-full bg-surface shadow transition-all ${
                          p.is_published ? 'left-5' : 'left-0.5'
                        }`}
                      />
                    </button>
                    <div className="flex gap-1">
                      <Link
                        to={`/products/${p.id}`}
                        className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-900"
                        aria-label={`Edit ${p.title}`}
                      >
                        <Pencil size={15} />
                      </Link>
                      <button
                        onClick={() => setDeleting(p)}
                        className="cursor-pointer rounded-lg p-1.5 text-ink-400 transition hover:bg-red-50 dark:hover:bg-red-500/15 dark:bg-red-500/10 hover:text-red-600 dark:text-red-400"
                        aria-label={`Delete ${p.title}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title="Delete product?"
        message={
          <>
            <strong>{deleting?.title}</strong> will be permanently deleted. If it has
            order history it will be <em>archived</em> instead so past orders stay intact.
          </>
        }
        confirmLabel="Delete"
      />
    </div>
  )
}
