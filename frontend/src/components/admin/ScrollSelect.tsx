import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

type Option = { value: string; label: string }

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  emptyLabel?: string
}

export function ScrollSelect({ label, value, onChange, options, placeholder = 'Select…', emptyLabel = 'All' }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value)
  const display = selected?.label || (value === '' ? placeholder : value)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pick = (next: string) => {
    onChange(next)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:border-gray-400"
      >
        <span className={selected || value ? 'text-gray-900' : 'text-gray-500'}>{display}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="scroll-light absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {emptyLabel ? (
            <li role="option" aria-selected={value === ''}>
              <button
                type="button"
                onClick={() => pick('')}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${value === '' ? 'bg-brand-accent/10 font-medium text-brand-accent' : 'text-gray-700'}`}
              >
                {emptyLabel}
              </button>
            </li>
          ) : null}
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={value === o.value}>
              <button
                type="button"
                onClick={() => pick(o.value)}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${value === o.value ? 'bg-brand-accent/10 font-medium text-brand-accent' : 'text-gray-700'}`}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
