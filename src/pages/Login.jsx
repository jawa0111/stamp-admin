import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Field, Input } from '../components/ui/Field'
import { ThemeToggle } from '../components/Layout'
import { Eye, EyeOff, Loader2, Lock, ShoppingBag, TrendingUp, Package } from 'lucide-react'

const HIGHLIGHTS = [
  { icon: ShoppingBag, text: 'Track and fulfil orders from any device' },
  { icon: Package, text: 'Manage products, variants and stock' },
  { icon: TrendingUp, text: 'Revenue, profit and investor insights' },
]

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
    <div className="flex min-h-dvh bg-canvas">
      {/* Brand panel — desktop only */}
      <div className="relative hidden w-1/2 overflow-hidden bg-[#0e0c2a] lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* animated gradient blobs */}
        <div aria-hidden className="absolute inset-0">
          <div className="animate-blob absolute -left-24 top-1/4 size-96 rounded-full bg-indigo-600/40 blur-[100px]" />
          <div className="animate-blob animation-delay-3s absolute right-0 top-0 size-80 rounded-full bg-violet-600/30 blur-[100px]" />
          <div className="animate-blob animation-delay-6s absolute bottom-0 left-1/3 size-80 rounded-full bg-fuchsia-600/25 blur-[100px]" />
          <div
            className="absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-white font-display text-xl font-bold text-indigo-950 shadow-xl">
            S
          </div>
          <span className="font-display text-xl font-semibold tracking-tight text-white">
            STAMP
          </span>
        </div>

        <div className="relative">
          <h2 className="max-w-md font-display text-4xl font-semibold leading-tight tracking-tight text-white">
            Run your clothing brand from one place.
          </h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-indigo-100/90">
                <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
                  <Icon size={17} />
                </span>
                <span className="text-[15px]">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-indigo-200/60">
          © {new Date().getFullYear()} STAMP · Colombo, Sri Lanka
        </p>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-10">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm animate-fade-up">
          {/* mobile brand */}
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-500 font-display text-2xl font-bold text-white shadow-lg shadow-primary/30">
              S
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">STAMP Admin</h1>
          </div>

          <div className="hidden lg:block">
            <h1 className="font-display text-[28px] font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="mb-8 mt-1.5 text-[15px] text-ink-500">
              Sign in to your admin dashboard
            </p>
          </div>
          <p className="mb-8 text-center text-sm text-ink-500 lg:hidden">
            Sign in to manage your store
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
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
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary-strong hover:shadow-primary/35 active:scale-[0.99] disabled:opacity-60"
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
    </div>
  )
}
