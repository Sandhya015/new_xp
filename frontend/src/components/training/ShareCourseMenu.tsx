import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Share2, X, Link as LinkIcon } from 'lucide-react'

type Props = {
  url: string
  title: string
  description?: string
  university?: string
  className?: string
  /** Compact icon button (e.g. card corner). */
  iconOnly?: boolean
}

const PANEL_W = 280
const Z_BACKDROP = 340
const Z_PANEL = 350

function shareLinks(url: string, title: string, description: string | undefined, university: string | undefined) {
  const desc = (description || '').slice(0, 200).trim()
  const text = `${title}${university ? ` — ${university}` : ''}${desc ? `\n\n${desc}` : ''}\n${url}`
  const tw = `${title} ${url} #XpertIntern`
  const enc = encodeURIComponent
  return {
    whatsapp: `https://wa.me/?text=${enc(text)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
    twitter: `https://twitter.com/intent/tweet?text=${enc(tw)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
  }
}

function computePanelPosition(anchor: DOMRect) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 400
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const margin = 8
  const top = anchor.bottom + margin
  let left = anchor.left
  const maxLeft = vw - PANEL_W - margin
  if (left > maxLeft) left = Math.max(margin, maxLeft)
  if (left < margin) left = margin
  const estHeight = 200
  const topClamped = top + estHeight > vh - margin ? Math.max(margin, anchor.top - estHeight - margin) : top
  return { top: topClamped, left, width: PANEL_W }
}

export function ShareCourseMenu({ url, title, description, university, className = '', iconOnly }: Props) {
  const [open, setOpen] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number } | null>(null)

  const updatePosition = () => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPanelStyle(computePanelPosition(r))
  }

  const closeMenu = useCallback(() => {
    setOpen(false)
    setPanelStyle(null)
  }, [])

  const toggleOpen = () => {
    setOpen((v) => {
      const next = !v
      if (next && anchorRef.current) {
        setPanelStyle(computePanelPosition(anchorRef.current.getBoundingClientRect()))
      } else if (!next) {
        setPanelStyle(null)
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

  const links = shareLinks(url, title, description, university)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setHint('Link copied to clipboard!')
    } catch {
      setHint('Could not copy link')
    }
    setTimeout(() => setHint(null), 2500)
    closeMenu()
  }

  const openWin = (href: string) => {
    window.open(href, '_blank', 'noopener,noreferrer')
    closeMenu()
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
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2 mb-3">
                <span className="text-sm font-semibold text-gray-900">Share</span>
                <button type="button" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" onClick={closeMenu} aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={() => openWin(links.whatsapp)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white text-xs font-bold hover:opacity-90"
                  aria-label="WhatsApp"
                >
                  WA
                </button>
                <button
                  type="button"
                  onClick={() => openWin(links.linkedin)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0A66C2] text-white text-xs font-bold hover:opacity-90"
                  aria-label="LinkedIn"
                >
                  in
                </button>
                <button
                  type="button"
                  onClick={() => openWin(links.twitter)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-white text-xs font-bold hover:opacity-90"
                  aria-label="X / Twitter"
                >
                  X
                </button>
                <button
                  type="button"
                  onClick={() => openWin(links.facebook)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1877F2] text-white text-xs font-bold hover:opacity-90"
                  aria-label="Facebook"
                >
                  f
                </button>
                <button
                  type="button"
                  onClick={() => void onCopy()}
                  className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  aria-label="Copy link"
                >
                  <LinkIcon className="h-5 w-5" />
                </button>
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
      {hint && !iconOnly ? <p className="absolute right-0 top-full mt-1 text-xs font-medium text-emerald-600 whitespace-nowrap z-50">{hint}</p> : null}
      {hint && iconOnly ? <span className="sr-only">{hint}</span> : null}
      {portal}
    </div>
  )
}
