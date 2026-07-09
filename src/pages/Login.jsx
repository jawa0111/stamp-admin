import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Field, Input } from '../components/ui/Field'
import { ThemeToggle } from '../components/Layout'
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react'

export default function Login() {
  const { session, signIn } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (session) {
    return <Navigate to={location.state?.from?.pathname ?? '/'} replace />
  }

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signIn(email.trim(), password)
    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Incorrect email or password. Check your details and try again.'
          : error.message
      )
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      {/* soft gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/10 to-transparent"
      />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-500 font-display text-2xl font-bold text-white shadow-lg shadow-primary/30">
            S
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            STAMP Admin
          </h1>
          <p className="mt-1 text-sm text-ink-500">Sign in to manage your store</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-ink-200 bg-surface p-6 shadow-xl shadow-ink-950/5"
        >
          <Field label="Email" required>
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@stamp.lk"
            />
          </Field>

          <Field label="Password" required>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute inset-y-0 right-0 flex cursor-pointer items-center px-3 text-ink-400 transition hover:text-ink-700"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={15} />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-center text-xs text-ink-400">
            Admin access only. Accounts are created by an administrator.
          </p>
        </form>
      </div>
    </div>
  )
}
