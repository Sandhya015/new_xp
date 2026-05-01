import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Share2, X, Copy, Check } from 'lucide-react'

type Props = {
  url: string
  title: string
  description?: string
  university?: string
  className?: string
  /** Compact icon button (e.g. card corner). */
  iconOnly?: boolean
}

const PANEL_MIN_W = 320
const Z_BACKDROP = 340
const Z_PANEL = 350

function shareTargets(url: string, title: string, description: string | undefined, university: string | undefined) {
  const desc = (description || '').slice(0, 200).trim()
  const text = `${title}${university ? ` — ${university}` : ''}${desc ? `\n\n${desc}` : ''}\n${url}`
  const tw = `${title} ${url} #XpertIntern`
  const enc = encodeURIComponent
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
    /** Instagram has no universal web share URL; opens instagram.com (paste link from copy bar). */
    instagram: 'https://www.instagram.com/',
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
    twitter: `https://twitter.com/intent/tweet?text=${enc(tw)}`,
    whatsapp: `https://wa.me/?text=${enc(text)}`,
    telegram: `https://t.me/share/url?url=${enc(url)}&text=${enc(title)}`,
  }
}

function computePanelPosition(anchor: DOMRect) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 400
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const margin = 8
  const width = Math.min(PANEL_MIN_W, vw - margin * 2)
  const top = anchor.bottom + margin
  let left = anchor.left
  const maxLeft = vw - width - margin
  if (left > maxLeft) left = Math.max(margin, maxLeft)
  if (left < margin) left = margin
  const estHeight = 280
  const topClamped = top + estHeight > vh - margin ? Math.max(margin, anchor.top - estHeight - margin) : top
  return { top: topClamped, left, width }
}

const SOCIAL_ROW: Array<{
  key: string
  label: string
  href: (t: ReturnType<typeof shareTargets>) => string
  className: string
  children: ReactNode
}> = [
  {
    key: 'fb',
    label: 'Facebook',
    href: (t) => t.facebook,
    className: 'bg-[#1877F2] text-white hover:opacity-90',
    children: <span className="text-sm font-bold">f</span>,
  },
  {
    key: 'ig',
    label: 'Instagram',
    href: (t) => t.instagram,
    className: 'bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888] text-white hover:opacity-90',
    children: <span className="text-xs font-bold">IG</span>,
  },
  {
    key: 'in',
    label: 'LinkedIn',
    href: (t) => t.linkedin,
    className: 'bg-[#0A66C2] text-white hover:opacity-90',
    children: <span className="text-xs font-bold">in</span>,
  },
  {
    key: 'x',
    label: 'X',
    href: (t) => t.twitter,
    className: 'bg-black text-white hover:opacity-90',
    children: <span className="text-xs font-bold">X</span>,
  },
  {
    key: 'wa',
    label: 'WhatsApp',
    href: (t) => t.whatsapp,
    className: 'bg-[#25D366] text-white hover:opacity-90',
    children: <span className="text-xs font-bold">WA</span>,
  },
  {
    key: 'tg',
    label: 'Telegram',
    href: (t) => t.telegram,
    className: 'bg-[#229ED9] text-white hover:opacity-90',
    children: <span className="text-xs font-bold">TG</span>,
  },
]

export function ShareCourseMenu({ url, title, description, university, className = '', iconOnly }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number } | null>(null)

  const targets = shareTargets(url, title, description, university)

  const updatePosition = () => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPanelStyle(computePanelPosition(r))
  }

  const closeMenu = useCallback(() => {
    setOpen(false)
    setPanelStyle(null)
    setCopied(false)
  }, [])

  const toggleOpen = () => {
    setOpen((v) => {
      const next = !v
      if (next && anchorRef.current) {
        setPanelStyle(computePanelPosition(anchorRef.current.getBoundingClientRect()))
      } else if (!next) {
        setPanelStyle(null)
        setCopied(false)
      }
      return next
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onWin = () => updatePosition()
    window.addEventListener('scroll', onWin, true)
    window.addEventListener('resize', onWin)
    return () => {
      window.removeEventListener('scroll', onWin, true)
      window.removeEventListener('resize', onWin)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (anchorRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      closeMenu()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, closeMenu])

  const onCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const openWin = (href: string) => {
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const portal =
    open && typeof document !== 'undefined' && panelStyle != null
      ? createPortal(
          <>
            <div
              className="fixed inset-0 bg-black/20"
              style={{ zIndex: Z_BACKDROP }}
              aria-hidden
              onClick={closeMenu}
            />
            <div
              ref={panelRef}
              className="fixed rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
              style={{ zIndex: Z_PANEL, top: panelStyle.top, left: panelStyle.left, width: panelStyle.width }}
              role="dialog"
              aria-label="Share course"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3 mb-3">
                <span className="text-sm font-semibold text-gray-900">Share</span>
                <button type="button" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" onClick={closeMenu} aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex rounded-lg border border-gray-200 bg-gray-50 overflow-hidden mb-4">
                <input
                  readOnly
                  value={url}
                  className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-xs text-gray-700 focus:ring-0"
                  aria-label="Course link"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={() => void onCopyLink()}
                  className="shrink-0 inline-flex items-center gap-1.5 border-l border-gray-200 bg-white px-3 py-2.5 text-xs font-semibold text-brand-navy hover:bg-gray-50"
                  aria-label="Copy link"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <p className="text-xs font-medium text-gray-500 mb-2">Share via</p>
              <div className="flex flex-wrap justify-center gap-3">
                {SOCIAL_ROW.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => openWin(s.href(targets))}
                    className={`flex h-11 w-11 items-center justify-center rounded-full shadow-sm transition ${s.className}`}
                    aria-label={s.label}
                  >
                    {s.children}
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body,
        )
      : null

  return (
    <div className={`relative ${className}`}>
      <button
        ref={anchorRef}
        type="button"
        onClick={toggleOpen}
        className={
          iconOnly
            ? 'rounded-lg bg-black/50 p-2 text-white backdrop-blur-sm hover:bg-black/65 transition'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:text-sm'
        }
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Share2 className={iconOnly ? 'h-4 w-4' : 'h-4 w-4 text-gray-500'} />
        {!iconOnly ? 'Share' : null}
      </button>
      {portal}
    </div>
  )
}
