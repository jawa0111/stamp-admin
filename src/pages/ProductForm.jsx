import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { slugify } from '../lib/format'
import PageHeader, { Card, CardHeader } from '../components/ui/PageHeader'
import Spinner from '../components/ui/Spinner'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import {
  ArrowLeft,
  UploadCloud,
  X,
  Plus,
  Trash2,
  Save,
  GripVertical,
  ArchiveRestore,
} from 'lucide-react'

const emptyVariant = () => ({
  key: crypto.randomUUID(),
  id: null,
  size: '',
  color: '',
  sku: '',
  stock: 0,
  price_override: '',
  is_active: true,
})

export default function ProductForm() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const toast = useToast()
  const fileRef = useRef(null)

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [categories, setCategories] = useState([])
  const [isArchived, setIsArchived] = useState(false)

  const [form, setForm] = useState({
    title: '',
    slug: '',
    description: '',
    category: '',
    tag: '',
    price: '',
    comparedPrice: '',
    cost_price: '',
    material: '',
    care: '',
    warranty: '',
    video: '',
    is_published: false,
    images: [],
  })
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [variants, setVariants] = useState([emptyVariant()])
  const [removedVariantIds, setRemovedVariantIds] = useState([])

  useEffect(() => {
    supabase
      .from('categories')
      .select('slug, name')
      .order('sort_order')
      .then(({ data }) => setCategories(data ?? []))
  }, [])

  useEffect(() => {
    if (isNew) return
    let cancelled = false
    async function load() {
      const [{ data: p }, { data: vs }] = await Promise.all([
        supabase.from('products').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('product_variants')
          .select('*')
          .eq('product_id', id)
          .order('created_at'),
      ])
      if (cancelled) return
      if (!p) {
        toast('Product not found', 'error')
        navigate('/products')
        return
      }
      setForm({
        title: p.title ?? '',
        slug: p.slug ?? '',
        description: p.description ?? '',
        category: p.category ?? '',
        tag: p.tag ?? '',
        price: p.price ?? '',
        comparedPrice: p.comparedPrice ?? '',
        cost_price: p.cost_price ?? '',
        material: p.material ?? '',
        care: p.care ?? '',
        warranty: p.warranty ?? '',
        video: p.video ?? '',
        is_published: p.is_published,
        images: p.images ?? [],
      })
      setIsArchived(!!p.is_archived)
      setVariants(
        (vs?.length ? vs : []).map((v) => ({
          key: v.id,
          id: v.id,
          size: v.size ?? '',
          color: v.color ?? '',
          sku: v.sku ?? '',
          stock: v.stock,
          price_override: v.price_override ?? '',
          is_active: v.is_active,
        })) || [emptyVariant()]
      )
      if (!vs?.length) setVariants([emptyVariant()])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setVariant(key, field, value) {
    setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, [field]: value } : v)))
  }

  function removeVariant(v) {
    if (v.id) setRemovedVariantIds((ids) => [...ids, v.id])
    setVariants((vs) => vs.filter((x) => x.key !== v.key))
  }

  async function uploadImages(files) {
    if (!files?.length) return
    setUploading(true)
    const urls = []
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error } = await supabase.storage
        .from('product-images')
        .upload(path, file, { cacheControl: '31536000', upsert: false })
      if (error) {
        toast(`Upload failed: ${error.message}`, 'error')
        continue
      }
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      urls.push(data.publicUrl)
    }
    if (urls.length) set('images', [...form.images, ...urls])
    setUploading(false)
  }

  function moveImage(index, dir) {
    setForm((f) => {
      const imgs = [...f.images]
      const target = index + dir
      if (target < 0 || target >= imgs.length) return f
      ;[imgs[index], imgs[target]] = [imgs[target], imgs[index]]
      return { ...f, images: imgs }
    })
  }

  async function save(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.category || form.price === '') {
      toast('Title, category and price are required.', 'error')
      return
    }
    setSaving(true)

    const payload = {
      title: form.title.trim(),
      slug: (form.slug || slugify(form.title)).trim(),
      description: form.description || null,
      category: form.category,
      tag: form.tag || null,
      price: Number(form.price),
      comparedPrice: form.comparedPrice === '' ? null : Number(form.comparedPrice),
      cost_price: form.cost_price === '' ? null : Number(form.cost_price),
      material: form.material || null,
      care: form.care || null,
      warranty: form.warranty || null,
      video: form.video || null,
      is_published: form.is_published,
      images: form.images,
    }

    let productId = id
    if (isNew) {
      const { data, error } = await supabase
        .from('products')
        .insert(payload)
        .select('id')
        .single()
      if (error) {
        setSaving(false)
        return toast(`Could not create product: ${error.message}`, 'error')
      }
      productId = data.id
    } else {
      const { error } = await supabase.from('products').update(payload).eq('id', id)
      if (error) {
        setSaving(false)
        return toast(`Could not save: ${error.message}`, 'error')
      }
    }

    // Variants: delete removed, upsert the rest
    if (removedVariantIds.length) {
      await supabase.from('product_variants').delete().in('id', removedVariantIds)
    }
    const cleanVariants = variants.filter(
      (v) => v.size.trim() || v.color.trim() || v.sku.trim() || v.stock > 0
    )
    for (const v of cleanVariants) {
      const row = {
        product_id: productId,
        size: v.size.trim() || null,
        color: v.color.trim() || null,
        sku: v.sku.trim() || null,
        stock: Number(v.stock) || 0,
        price_override: v.price_override === '' ? null : Number(v.price_override),
        is_active: v.is_active,
      }
      const res = v.id
        ? await supabase.from('product_variants').update(row).eq('id', v.id)
        : await supabase.from('product_variants').insert(row)
      if (res.error) {
        setSaving(false)
        return toast(`Variant error: ${res.error.message}`, 'error')
      }
    }

    setSaving(false)
    toast(isNew ? 'Product created' : 'Product saved')
    navigate('/products')
  }

  async function unarchive() {
    const { error } = await supabase
      .from('products')
      .update({ is_archived: false })
      .eq('id', id)
    if (error) return toast(error.message, 'error')
    setIsArchived(false)
    toast('Product restored from archive')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size={30} />
      </div>
    )
  }

  return (
    <form onSubmit={save}>
      <div className="mb-4">
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-ink-900"
        >
          <ArrowLeft size={16} /> Products
        </Link>
      </div>

      <PageHeader
        title={isNew ? 'New product' : form.title || 'Edit product'}
        subtitle={isNew ? 'Add a product to your catalog' : undefined}
        actions={
          <>
            {isArchived && (
              <button
                type="button"
                onClick={unarchive}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium transition hover:bg-ink-100"
              >
                <ArchiveRestore size={16} /> Restore
              </button>
            )}
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-ink-200 bg-white px-4 py-2.5">
              <span className="text-sm font-medium">
                {form.is_published ? 'Published' : 'Draft'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={form.is_published}
                onClick={() => set('is_published', !form.is_published)}
                className={`relative h-5.5 w-10 cursor-pointer rounded-full transition ${
                  form.is_published ? 'bg-emerald-500' : 'bg-ink-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 size-4.5 rounded-full bg-white shadow transition-all ${
                    form.is_published ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </label>
            <button
              type="submit"
              disabled={saving || uploading}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-ink-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-ink-700 disabled:opacity-50"
            >
              <Save size={16} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      />

      {isArchived && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This product is archived. It is hidden from the store; restore it to make changes visible.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Basics */}
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" required className="sm:col-span-2">
                <Input
                  value={form.title}
                  onChange={(e) => {
                    set('title', e.target.value)
                    if (!slugTouched) set('slug', slugify(e.target.value))
                  }}
                  placeholder="Oversized Heavyweight Tee"
                  required
                />
              </Field>
              <Field label="Slug" hint="Used in store URLs" required>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    set('slug', slugify(e.target.value))
                  }}
                  placeholder="oversized-heavyweight-tee"
                />
              </Field>
              <Field label="Category" required>
                <Select
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                  required
                >
                  <option value="">Select category…</option>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Fabric, fit, and everything customers should know…"
                />
              </Field>
              <Field label="Tag" hint="e.g. Web Drop, Best Seller">
                <Input
                  value={form.tag}
                  onChange={(e) => set('tag', e.target.value)}
                  placeholder="Web Drop"
                />
              </Field>
              <Field label="Video URL" hint="Optional hover turnaround clip">
                <Input
                  type="url"
                  value={form.video}
                  onChange={(e) => set('video', e.target.value)}
                  placeholder="https://…"
                />
              </Field>
            </div>
          </Card>

          {/* Pricing */}
          <Card className="p-5">
            <h2 className="mb-4 font-display text-[15px] font-semibold">Pricing (LKR)</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Selling price" required>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                  placeholder="4500.00"
                  required
                />
              </Field>
              <Field label="Compare-at price" hint="Shown struck-through">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.comparedPrice}
                  onChange={(e) => set('comparedPrice', e.target.value)}
                  placeholder="5900.00"
                />
              </Field>
              <Field label="Cost price" hint="Used for profit / COGS">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.cost_price}
                  onChange={(e) => set('cost_price', e.target.value)}
                  placeholder="2100.00"
                />
              </Field>
            </div>
          </Card>

          {/* Variants */}
          <Card>
            <CardHeader
              title="Variants — size / color / stock"
              action={
                <button
                  type="button"
                  onClick={() => setVariants((vs) => [...vs, emptyVariant()])}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium transition hover:bg-ink-100"
                >
                  <Plus size={15} /> Add variant
                </button>
              }
            />
            <div className="space-y-3 p-4">
              {variants.length === 0 && (
                <p className="py-4 text-center text-sm text-ink-400">
                  No variants. Add sizes/colors to track stock.
                </p>
              )}
              {variants.map((v) => (
                <div
                  key={v.key}
                  className="grid grid-cols-2 gap-2.5 rounded-xl border border-ink-200 p-3 sm:grid-cols-[1fr_1fr_1.2fr_0.8fr_1fr_auto] sm:items-end"
                >
                  <Field label="Size">
                    <Input
                      value={v.size}
                      onChange={(e) => setVariant(v.key, 'size', e.target.value)}
                      placeholder="M"
                    />
                  </Field>
                  <Field label="Color">
                    <Input
                      value={v.color}
                      onChange={(e) => setVariant(v.key, 'color', e.target.value)}
                      placeholder="Black"
                    />
                  </Field>
                  <Field label="SKU">
                    <Input
                      value={v.sku}
                      onChange={(e) => setVariant(v.key, 'sku', e.target.value)}
                      placeholder="TEE-BLK-M"
                    />
                  </Field>
                  <Field label="Stock">
                    <Input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={v.stock}
                      onChange={(e) => setVariant(v.key, 'stock', e.target.value)}
                    />
                  </Field>
                  <Field label="Price override">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={v.price_override}
                      onChange={(e) => setVariant(v.key, 'price_override', e.target.value)}
                      placeholder="—"
                    />
                  </Field>
                  <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end">
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-500">
                      <input
                        type="checkbox"
                        checked={v.is_active}
                        onChange={(e) => setVariant(v.key, 'is_active', e.target.checked)}
                        className="size-4 cursor-pointer accent-ink-900"
                      />
                      Active
                    </label>
                    <button
                      type="button"
                      onClick={() => removeVariant(v)}
                      className="cursor-pointer rounded-lg p-2 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove variant"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Details */}
          <Card className="p-5">
            <h2 className="mb-4 font-display text-[15px] font-semibold">Details</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Material">
                <Input
                  value={form.material}
                  onChange={(e) => set('material', e.target.value)}
                  placeholder="100% cotton, 240 GSM"
                />
              </Field>
              <Field label="Care">
                <Input
                  value={form.care}
                  onChange={(e) => set('care', e.target.value)}
                  placeholder="Machine wash cold"
                />
              </Field>
              <Field label="Warranty">
                <Input
                  value={form.warranty}
                  onChange={(e) => set('warranty', e.target.value)}
                  placeholder="14-day exchange"
                />
              </Field>
            </div>
          </Card>
        </div>

        {/* Images */}
        <div>
          <Card>
            <CardHeader title="Images" />
            <div className="p-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-300 bg-ink-50 px-4 py-8 text-ink-500 transition hover:border-ink-400 hover:bg-ink-100 disabled:opacity-50"
              >
                {uploading ? (
                  <Spinner size={22} />
                ) : (
                  <UploadCloud size={24} />
                )}
                <span className="text-sm font-medium">
                  {uploading ? 'Uploading…' : 'Upload images'}
                </span>
                <span className="text-xs text-ink-400">JPG, PNG or WebP</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  uploadImages([...e.target.files])
                  e.target.value = ''
                }}
              />

              {form.images.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {form.images.map((url, i) => (
                    <li
                      key={url}
                      className="flex items-center gap-2.5 rounded-xl border border-ink-200 p-2"
                    >
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => moveImage(i, -1)}
                          disabled={i === 0}
                          className="cursor-pointer p-0.5 text-ink-300 hover:text-ink-700 disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <GripVertical size={14} />
                        </button>
                      </div>
                      <img
                        src={url}
                        alt=""
                        className="size-14 rounded-lg border border-ink-100 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        {i === 0 && (
                          <span className="rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                            Cover
                          </span>
                        )}
                        <p className="mt-0.5 truncate text-xs text-ink-400">{url.split('/').pop()}</p>
                        {i > 0 && (
                          <button
                            type="button"
                            onClick={() => moveImage(i, -1)}
                            className="cursor-pointer text-xs font-medium text-ink-500 hover:text-ink-900"
                          >
                            Move up
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          set('images', form.images.filter((u) => u !== url))
                        }
                        className="cursor-pointer rounded-lg p-1.5 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove image"
                      >
                        <X size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Mobile sticky save */}
      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t border-ink-200 bg-ink-100/90 py-3 backdrop-blur lg:hidden">
        <button
          type="submit"
          disabled={saving || uploading}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-ink-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink-700 disabled:opacity-50"
        >
          <Save size={16} /> {saving ? 'Saving…' : 'Save product'}
        </button>
      </div>
    </form>
  )
}
