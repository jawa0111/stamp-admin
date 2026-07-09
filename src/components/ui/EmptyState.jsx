export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink-300 bg-surface/60 px-6 py-14 text-center">
      {Icon && (
        <div className="flex size-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">
          <Icon size={24} />
        </div>
      )}
      <div>
        <p className="font-medium text-ink-700">{title}</p>
        {message && <p className="mt-1 text-sm text-ink-500">{message}</p>}
      </div>
      {action}
    </div>
  )
}
