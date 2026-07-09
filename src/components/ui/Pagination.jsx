import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between gap-3 pt-4 text-sm text-ink-500">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-1.5">
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="cursor-pointer rounded-lg border border-ink-200 bg-surface p-2 transition hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="cursor-pointer rounded-lg border border-ink-200 bg-surface p-2 transition hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
