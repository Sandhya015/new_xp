/** Course `price` from API is treated as GST-inclusive total (INR). */

const DEFAULT_GST = 0.18

export function splitInrTaxInclusive(totalInr: number, gstRate = DEFAULT_GST) {
  const gross = Math.max(0, Number(totalInr) || 0)
  if (gross <= 0) {
    return { base: 0, gst: 0, total: 0, gstRate }
  }
  const divisor = 1 + gstRate
  const base = Math.round((gross / divisor) * 100) / 100
  const gst = Math.round((gross - base) * 100) / 100
  return { base, gst, total: gross, gstRate }
}

export function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
