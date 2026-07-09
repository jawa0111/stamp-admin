import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  LayoutDashboard,
  ShoppingBag,
  Shirt,
  Users,
  Wallet,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
} from 'lucide-react'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/products', label: 'Products', icon: Shirt },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/finances', label: 'Finances', icon: Wallet, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function ThemeToggle({ className = '' }) {
  const { isDark, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className={`cursor-pointer rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-900 ${className}`}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}

function NavItems({ onNavigate }) {
  const { isAdmin } = useAuth()
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.filter((n) => !n.adminOnly || isAdmin).map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
              isActive
                ? 'bg-primary-soft text-primary'
                : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900'
            }`
          }
        >
          <Icon size={18} strokeWidth={2} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function SidebarFooter() {
  const { profile, signOut } = useAuth()
  return (
    <div className="border-t border-ink-200 p-3">
      <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
          {(profile?.full_name ?? profile?.email ?? '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-900">
            {profile?.full_name ?? profile?.email}
          </p>
          <p className="truncate text-xs capitalize text-ink-400">{profile?.role}</p>
        </div>
        <ThemeToggle />
        <button
          onClick={signOut}
          className="cursor-pointer rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-red-500"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={17} />
        </button>
      </div>
    </div>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const current = NAV.find(
    (n) => n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)
  )

  const brand = (
    <div className="flex items-center gap-2.5 px-6 py-6">
      <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-500 font-display text-lg font-bold text-white shadow-md shadow-primary/30">
        S
      </div>
      <span className="font-display text-lg font-semibold tracking-tight text-ink-900">
        STAMP
      </span>
      <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
        Admin
      </span>
    </div>
  )

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-ink-200 bg-surface lg:flex">
        {brand}
        <NavItems />
        <SidebarFooter />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-ink-200 bg-surface shadow-2xl">
            <div className="flex items-center justify-between pr-3">
              {brand}
              <button
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-900"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>
            <NavItems onNavigate={() => setOpen(false)} />
            <SidebarFooter />
          </aside>
        </div>
      )}

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 flex items-center gap-2 border-b border-ink-200 bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="cursor-pointer rounded-lg p-2 text-ink-600 transition hover:bg-ink-100"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <span className="flex-1 font-display text-base font-semibold">
          {current?.label ?? 'STAMP Admin'}
        </span>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  )
}
