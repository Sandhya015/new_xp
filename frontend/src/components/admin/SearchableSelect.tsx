/** Searchable multi-select using native select (multi) + search filter — lightweight for admin filters. */
import { useMemo, useState } from 'react'

type Option = { value: string; label: string }

export function SearchableMultiSelect({
  label,
  options,
  values,
  onChange,
  placeholder = 'All',
  disabled,
}: {
  label: string
  options: Option[]
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return options
    return options.filter((o) => o.label.toLowerCase().includes(s) || o.value.toLowerCase().includes(s))
  }, [options, q])

  return (
    <div className="min-w-[160px] max-w-[240px]">
      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">{label}</label>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${label.toLowerCase()}…`}
        disabled={disabled}
        className="mb-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
      />
      <select
        multiple
        disabled={disabled}
        value={values}
        onChange={(e) => {
          const selected = Array.from(e.target.selectedOptions).map((o) => o.value)
          onChange(selected)
        }}
        className="w-full min-h-[72px] rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-800 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
      >
        {filtered.length === 0 && <option disabled value="">{placeholder}: no results</option>}
        {filtered.map((o) => (
          <option key={o.value} value={o.value} title={o.label}>
            {o.label}
          </option>
        ))}
      </select>
      {values.length > 0 && (
        <p className="mt-0.5 text-[10px] text-slate-gray">{values.length} selected</p>
      )}
    </div>
  )
}

export function SearchableSingleSelect({
  label,
  options,
  value,
  onChange,
  allowEmpty = true,
  emptyLabel = '— Select —',
  disabled,
}: {
  label: string
  options: Option[]
  value: string
  onChange: (v: string) => void
  allowEmpty?: boolean
  emptyLabel?: string
  disabled?: boolean
}) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return options
    return options.filter((o) => o.label.toLowerCase().includes(s) || o.value.toLowerCase().includes(s))
  }, [options, q])

  return (
    <div className="min-w-[160px]">
      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">{label}</label>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type to filter…"
        disabled={disabled}
        className="mb-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
      />
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
      >
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {filtered.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
