import { Loader2 } from 'lucide-react'

export default function Spinner({ size = 20, className = '' }) {
  return (
    <Loader2
      size={size}
      className={`animate-spin text-ink-400 ${className}`}
      aria-label="Loading"
    />
  )
}
