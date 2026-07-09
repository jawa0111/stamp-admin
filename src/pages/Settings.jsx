import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { formatDate, slugify } from '../lib/format'
import PageHeader, { Card, CardHeader } from '../components/ui/PageHeader'
import { Field, Input } from '../components/ui/Field'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import {
  KeyRound,
  Plus,
  Trash2,
  Tags,
  Users,
  ShieldCheck,
  GripVertical,
} from 'lucide-react'

export default function Settings() {
  const { profile, isAdmin } = useAuth()
  const toast = useToast()

  // password
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwBusy, setPwBusy] = useState(false)

  // categories
  const [categories, setCategories] = useState([])
  const [newCat, setNewCat] = useState('')
  const [deletingCat, setDeletingCat] = useState(null)
  const [busy, setBusy] = useState(false)

  // team
  const [team, setTeam] = useState([])

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .then(({ data }) => setCategories(data ?? []))
    if (isAdmin) {
      supabase
        .from('admin_users')
        .select('*')
        .order('created_at')
        .then(({ data }) => setTeam(data ?? []))
    }
  }, [isAdmin])

  async function changePassword(e) {
    e.preventDefault()
    if (pw.length < 8) return toast('Password must be at least 8 characters.', 'error')
    if (pw !== pw2) return toast('Passwords do not match.', 'error')
    setPwBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setPwBusy(false)
    if (error) return toast(error.message, 'error')
    setPw('')
    setPw2('')
    toast('Password updated')
  }

  async function addCategory(e) {
    e.preventDefault()
    const name = newCat.trim()
    if (!name) return
    setBusy(true)
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name,
        slug: slugify(name),
        sort_order: categories.length,
      })
      .select()
      .single()
    setBusy(false)
    if (error) return toast(error.message, 'error')
    setCategories((c) => [...c, data])
    setNewCat('')
    toast(`Category "${name}" added`)
  }

  async function toggleCategory(cat) {
    const { error } = await supabase
      .from('categories')
      .update({ is_published: !cat.is_published })
      .eq('id', cat.id)
    if (error) return toast(error.message, 'error')
    setCategories((cs) =>
      cs.map((c) => (c.id === cat.id ? { ...c, is_published: !c.is_published } : c))
    )
  }

  async function confirmDeleteCategory() {
    setBusy(true)
    const { error } = await supabase.from('categories').delete().eq('id', deletingCat.id)
    setBusy(false)
    if (error) {
      setDeletingCat(null)
      return toast(
        error.code === '23503'
          ? 'This category has products — move or delete them first.'
          : error.message,
        'error'
      )
    }
    setCategories((cs) => cs.filter((c) => c.id !== deletingCat.id))
    setDeletingCat(null)
    toast('Category deleted')
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Account, catalog and team" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Profile */}
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-[15px] font-semibold">
            <ShieldCheck size={17} className="text-ink-400" /> Your account
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Name</dt>
              <dd className="font-medium">{profile?.full_name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Email</dt>
              <dd className="font-medium">{profile?.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Role</dt>
              <dd>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                    isAdmin ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400'
                  }`}
                >
                  {profile?.role}
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Member since</dt>
              <dd className="font-medium">{formatDate(profile?.created_at)}</dd>
            </div>
          </dl>
        </Card>

        {/* Password */}
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-[15px] font-semibold">
            <KeyRound size={17} className="text-ink-400" /> Change password
          </h2>
          <form onSubmit={changePassword} className="space-y-3">
            <Field label="New password" required hint="Minimum 8 characters">
              <Input
                type="password"
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required
                minLength={8}
              />
            </Field>
            <Field label="Confirm new password" required>
              <Input
                type="password"
                autoComplete="new-password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                required
              />
            </Field>
            <button
              type="submit"
              disabled={pwBusy}
              className="cursor-pointer rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-strong disabled:opacity-50"
            >
              {pwBusy ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </Card>

        {/* Categories */}
        <Card>
          <CardHeader title="Product categories" />
          <div className="p-5">
            {isAdmin && (
              <form onSubmit={addCategory} className="mb-4 flex gap-2">
                <Input
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  placeholder="New category name…"
                  aria-label="New category name"
                />
                <button
                  type="submit"
                  disabled={busy || !newCat.trim()}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-strong disabled:opacity-50"
                >
                  <Plus size={15} /> Add
                </button>
              </form>
            )}
            {categories.length === 0 ? (
              <p className="flex items-center gap-2 py-4 text-sm text-ink-400">
                <Tags size={16} /> No categories yet.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {categories.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <GripVertical size={14} className="text-ink-300" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-ink-400">/{c.slug}</p>
                    </div>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => toggleCategory(c)}
                          role="switch"
                          aria-checked={c.is_published}
                          aria-label={`${c.name} published`}
                          className={`relative h-5 w-9 cursor-pointer rounded-full transition ${
                            c.is_published ? 'bg-emerald-500' : 'bg-ink-300'
                          }`}
                          title={c.is_published ? 'Published' : 'Hidden'}
                        >
                          <span
                            className={`absolute top-0.5 size-4 rounded-full bg-surface shadow transition-all ${
                              c.is_published ? 'left-[18px]' : 'left-0.5'
                            }`}
                          />
                        </button>
                        <button
                          onClick={() => setDeletingCat(c)}
                          className="cursor-pointer rounded-lg p-1.5 text-ink-400 transition hover:bg-red-50 dark:hover:bg-red-500/15 dark:bg-red-500/10 hover:text-red-600 dark:text-red-400"
                          aria-label={`Delete ${c.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Team (admin only) */}
        {isAdmin && (
          <Card>
            <CardHeader title="Team" />
            <div className="p-5">
              <ul className="divide-y divide-ink-100">
                {team.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                      {(u.full_name ?? u.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.full_name ?? u.email}</p>
                      <p className="truncate text-xs text-ink-400">{u.email}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                        u.role === 'admin'
                          ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : 'bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400'
                      }`}
                    >
                      {u.role}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-ink-50 px-3.5 py-3 text-xs leading-relaxed text-ink-500">
                <Users size={14} className="mt-0.5 shrink-0" />
                To add a team member: create the user in Supabase Auth, then insert a row
                into <code className="rounded bg-ink-200 px-1">admin_users</code> with role{' '}
                <code className="rounded bg-ink-200 px-1">admin</code> or{' '}
                <code className="rounded bg-ink-200 px-1">staff</code>. See the setup guide.
              </p>
            </div>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={!!deletingCat}
        onClose={() => setDeletingCat(null)}
        onConfirm={confirmDeleteCategory}
        busy={busy}
        title="Delete category?"
        message={
          <>
            Delete <strong>{deletingCat?.name}</strong>? Categories with products cannot be
            deleted.
          </>
        }
        confirmLabel="Delete"
      />
    </div>
  )
}
