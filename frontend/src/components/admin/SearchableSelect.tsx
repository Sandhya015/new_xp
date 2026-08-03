/**
 * Shared admin searchable selects (Rev 3).
 * Closed by default; search lives inside the open panel; multi shows chips + clear all.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'

export type SelectOption = { value: string; label: string }

function useOutsideClose(ref: React.RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, ref])
}

export function SearchableMultiSelect({
  label,
  options,
  values,
  onChange,
  placeholder = 'Select…',
  disabled,
  className = '',
}: {
  label: string
  options: SelectOption[]
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  useOutsideClose(rootRef, open, () => setOpen(false))

  useEffect(() => {
    if (open) {
      setQ('')
      queueMicrotask(() => searchRef.current?.focus())
    }
  }, [open])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return options
    return options.filter((o) => o.label.toLowerCase().includes(s) || o.value.toLowerCase().includes(s))
  }, [options, q])

  const selectedLabels = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]))
    return values.map((v) => ({ value: v, label: map.get(v) || v }))
  }, [options, values])

  const toggle = (value: string) => {
    if (values.includes(value)) onChange(values.filter((v) => v !== value))
    else onChange([...values, value])
  }

  const remove = (value: string) => onChange(values.filter((v) => v !== value))

  return (
    <div className={`min-w-[200px] max-w-[280px] ${className}`} ref={rootRef}>
      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">{label}</label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listId}
          onClick={() => !disabled && setOpen((o) => !o)}
          className="flex w-full min-h-[40px] items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-left text-sm hover:border-gray-400 focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent disabled:opacity-50"
        >
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {selectedLabels.length === 0 ? (
              <span className="text-slate-gray px-1 py-0.5">{placeholder}</span>
            ) : (
              selectedLabels.map((s) => (
                <span
                  key={s.value}
                  className="inline-flex max-w-full items-center gap-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-brand-navy"
                >
                  <span className="truncate max-w-[9rem]" title={s.label}>
                    {s.label}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="rounded p-0.5 hover:bg-slate-200"
                    onClick={(e) => {
                      e.stopPropagation()
                      remove(s.value)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        remove(s.value)
                      }
                    }}
                    aria-label={`Remove ${s.label}`}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </span>
              ))
            )}
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div
            id={listId}
            role="listbox"
            aria-multiselectable
            className="absolute z-40 mt-1 w-full min-w-[220px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          >
            <div className="border-b border-gray-100 p-2">
              <input
                ref={searchRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent"
              />
            </div>
            <ul className="max-h-48 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-gray">No matches</li>
              ) : (
                filtered.map((o) => {
                  const checked = values.includes(o.value)
                  return (
                    <li key={o.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={checked}
                        onClick={() => toggle(o.value)}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${
                          checked ? 'bg-brand-accent/5 text-brand-navy' : 'text-gray-800'
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                            checked ? 'border-brand-accent bg-brand-accent text-white' : 'border-gray-300'
                          }`}
                        >
                          {checked ? '✓' : ''}
                        </span>
                        <span className="truncate" title={o.label}>
                          {o.label}
                        </span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
            {values.length > 1 && (
              <div className="border-t border-gray-100 px-3 py-1.5">
                <button
                  type="button"
                  className="text-xs font-medium text-brand-accent hover:underline"
                  onClick={() => onChange([])}
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}
      </div>
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
  placeholder,
  disabled,
  className = '',
}: {
  label: string
  options: SelectOption[]
  value: string
  onChange: (v: string) => void
  allowEmpty?: boolean
  emptyLabel?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  useOutsideClose(rootRef, open, () => setOpen(false))

  useEffect(() => {
    if (open) {
      setQ('')
      queueMicrotask(() => searchRef.current?.focus())
    }
  }, [open])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return options
    return options.filter((o) => o.label.toLowerCase().includes(s) || o.value.toLowerCase().includes(s))
  }, [options, q])

  const selectedLabel = options.find((o) => o.value === value)?.label || (value || '')

  return (
    <div className={`min-w-[160px] ${className}`} ref={rootRef}>
      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">{label}</label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listId}
          onClick={() => !disabled && setOpen((o) => !o)}
          className="flex w-full min-h-[40px] items-center justify-between gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-left text-sm hover:border-gray-400 focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent disabled:opacity-50"
        >
          <span className={`truncate ${value ? 'text-gray-900' : 'text-slate-gray'}`}>
            {value ? selectedLabel : placeholder || emptyLabel}
          </span>
          <span className="flex shrink-0 items-center gap-0.5">
            {value && allowEmpty && !disabled ? (
              <span
                role="button"
                tabIndex={0}
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onChange('')
                  }
                }}
                aria-label="Clear"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <ChevronDown className={`h-4 w-4 text-gray-500 transition ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {open && (
          <div
            id={listId}
            role="listbox"
            className="absolute z-40 mt-1 w-full min-w-[200px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          >
            <div className="border-b border-gray-100 p-2">
              <input
                ref={searchRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent"
              />
            </div>
            <ul className="max-h-48 overflow-y-auto py-1">
              {allowEmpty && (
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={!value}
                    onClick={() => {
                      onChange('')
                      setOpen(false)
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm text-slate-gray hover:bg-gray-50"
                  >
                    {emptyLabel}
                  </button>
                </li>
              )}
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-gray">No matches</li>
              ) : (
                filtered.map((o) => (
                  <li key={o.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === o.value}
                      onClick={() => {
                        onChange(o.value)
                        setOpen(false)
                      }}
                      className={`w-full truncate px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${
                        value === o.value ? 'bg-brand-accent/5 font-medium text-brand-navy' : 'text-gray-800'
                      }`}
                      title={o.label}
                    >
                      {o.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
