function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO() {
  return toISODate(new Date())
}

export function startOfMonthISO(offsetMonths = 0) {
  const d = new Date()
  return toISODate(new Date(d.getFullYear(), d.getMonth() + offsetMonths, 1))
}

export function endOfMonthISO(offsetMonths = 0) {
  const d = new Date()
  return toISODate(new Date(d.getFullYear(), d.getMonth() + offsetMonths + 1, 0))
}

// Preset ranges — return { from, to } inclusive ISO dates (local time)
export function rangeForPreset(preset) {
  switch (preset) {
    case 'today':
      return { from: todayISO(), to: todayISO() }
    case 'last7': {
      const d = new Date()
      d.setDate(d.getDate() - 6)
      return { from: toISODate(d), to: todayISO() }
    }
    case 'this_month':
      return { from: startOfMonthISO(), to: endOfMonthISO() }
    case 'last_month':
      return { from: startOfMonthISO(-1), to: endOfMonthISO(-1) }
    case 'this_year': {
      const d = new Date()
      return { from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31` }
    }
    case 'all':
    default:
      return { from: null, to: null }
  }
}

// Convert inclusive date-range to timestamptz bounds for querying
export function rangeToTimestamps({ from, to }) {
  return {
    fromTs: from ? `${from}T00:00:00` : null,
    toTs: to ? `${to}T23:59:59.999` : null,
  }
}
