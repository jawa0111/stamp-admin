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

// Theme toggle — usable on the black sidebar (light-on-dark) and the
// mobile top bar (page-themed). `onSidebar` picks the right colors.
export function ThemeToggle({ onSidebar = false }) {
  const { isDark, toggle } = useTheme()
  const base = onSidebar
    ? 'text-zinc-400 hover:bg-white/10 hover:text-white'
    : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900'
  return (
    <button
      onClick={toggle}
      className={`cursor-pointer rounded-lg p-2 transition ${base}`}
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
            `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
              isActive
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:bg-white/10 hover:text-white'
            }`
          }
        >
          <Icon size={18} strokeWidth={2} className="transition-transform group-hover:scale-110" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function SidebarFooter() {
  const { profile, signOut } = useAuth()
  return (
    <div className="border-t border-white/10 p-3">
      <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
          {(profile?.full_name ?? profile?.email ?? '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {profile?.full_name ?? profile?.email}
          </p>
          <p className="truncate text-xs capitalize text-zinc-500">{profile?.role}</p>
        </div>
        <ThemeToggle onSidebar />
        <button
          onClick={signOut}
          className="cursor-pointer rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
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
      <div className="flex size-9 items-center justify-center rounded-xl bg-white font-display text-lg font-bold text-zinc-950">
        S
      </div>
      <span className="font-display text-lg font-semibold tracking-tight text-white">
        STAMP
      </span>
      <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Admin
      </span>
    </div>
  )

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar — always black */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-zinc-950 lg:flex">
        {brand}
        <NavItems />
        <SidebarFooter />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between pr-3">
              {brand}
              <button
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
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

      {/* Mobile top bar — themed with the page */}
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
