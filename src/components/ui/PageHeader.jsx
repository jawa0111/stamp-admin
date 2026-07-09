export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="no-print mb-6 flex animate-fade-up flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-[27px]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ children, className = '' }) {
  return (
    <div className={`card-shadow rounded-2xl border border-ink-200/70 bg-surface ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-5 py-4">
      <h2 className="font-display text-[15px] font-semibold">{title}</h2>
      {action}
    </div>
  )
}
