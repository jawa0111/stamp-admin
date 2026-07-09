export function Field({ label, required, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'w-full rounded-xl border border-ink-200 bg-surface px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:bg-ink-100'

export function Input(props) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />
}

export function Select({ children, ...props }) {
  return (
    <select {...props} className={`${inputCls} cursor-pointer ${props.className ?? ''}`}>
      {children}
    </select>
  )
}

export function Textarea(props) {
  return (
    <textarea rows={3} {...props} className={`${inputCls} ${props.className ?? ''}`} />
  )
}
