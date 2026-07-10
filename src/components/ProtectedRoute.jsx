import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ShieldAlert, LogOut } from 'lucide-react'
import Spinner from './ui/Spinner'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { session, profile, loading, signOut, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-100">
        <Spinner size={32} />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Signed in but not registered in admin_users → block access
  if (!profile) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink-100 px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400">
          <ShieldAlert size={28} />
        </div>
        <h1 className="font-display text-xl font-semibold">Access denied</h1>
        <p className="max-w-sm text-sm text-ink-500">
          Your account is not registered as an admin. Ask an administrator to add
          you to the <code className="rounded bg-ink-200 px-1">admin_users</code> table.
        </p>
        <button
          onClick={signOut}
          className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    )
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />
  }

  return children
}
