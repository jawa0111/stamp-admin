import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Field, Input } from '../components/ui/Field'
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
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4 py-10">
      {/* subtle backdrop pattern */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-white font-display text-2xl font-bold text-zinc-950 shadow-lg">
            S
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
            STAMP Admin
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Sign in to manage your store
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-white/10 bg-white p-6 shadow-2xl"
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
                className="absolute inset-y-0 right-0 flex cursor-pointer items-center px-3 text-zinc-400 transition hover:text-zinc-700"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={15} />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-center text-xs text-zinc-400">
            Admin access only. Accounts are created by an administrator.
          </p>
        </form>
      </div>
    </div>
  )
}
