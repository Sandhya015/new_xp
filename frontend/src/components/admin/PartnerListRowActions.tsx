import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Eye, MoreHorizontal, PauseCircle, Pencil, Trash2 } from 'lucide-react'
import { adminPartnerService } from '@/services/partnerService'

export function PartnerListRowActions({
  partnerId,
  partnerName,
  status,
  onChanged,
}: {
  partnerId: string
  partnerName: string
  status: string
  onChanged?: () => void
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const go = (tab?: string) => {
    setOpen(false)
    navigate(tab ? `/admin/partners/${partnerId}?tab=${tab}` : `/admin/partners/${partnerId}`)
  }

  const suspend = async () => {
    if (!window.confirm(`Suspend ${partnerName}? Login and link tracking will be paused.`)) return
    setOpen(false)
    await adminPartnerService.updatePartner(partnerId, { status: 'suspended' })
    onChanged?.()
  }

  const del = async () => {
    if (!window.confirm(`Delete partner ${partnerName}? This requires confirmation and cannot be undone easily.`)) return
    setOpen(false)
    await adminPartnerService.updatePartner(partnerId, { status: 'deleted' })
    onChanged?.()
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => go()}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-accent hover:bg-blue-50"
      >
        <Eye className="h-3.5 w-3.5" /> View
      </button>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0f172a] hover:bg-gray-50"
        >
          <MoreHorizontal className="h-3.5 w-3.5" /> Actions
        </button>
        {open ? (
          <div className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-gray">Partner actions</p>
            <button type="button" onClick={() => go('profile')} className="flex w-full gap-3 px-3 py-2.5 text-left hover:bg-gray-50">
              <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-slate-gray" />
              <span>
                <span className="block text-sm font-medium text-[#0f172a]">Edit partner</span>
                <span className="block text-[11px] text-slate-gray">Update profile and commission</span>
              </span>
            </button>
            <button type="button" onClick={() => go('performance')} className="flex w-full gap-3 px-3 py-2.5 text-left hover:bg-gray-50">
              <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-gray" />
              <span>
                <span className="block text-sm font-medium text-[#0f172a]">View performance</span>
                <span className="block text-[11px] text-slate-gray">Revenue, payments and students</span>
              </span>
            </button>
            {status !== 'suspended' ? (
              <button type="button" onClick={() => void suspend()} className="flex w-full gap-3 px-3 py-2.5 text-left hover:bg-gray-50">
                <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-gray" />
                <span>
                  <span className="block text-sm font-medium text-[#0f172a]">Suspend account</span>
                  <span className="block text-[11px] text-slate-gray">Pause login and link tracking</span>
                </span>
              </button>
            ) : null}
            <button type="button" onClick={() => void del()} className="flex w-full gap-3 px-3 py-2.5 text-left hover:bg-red-50">
              <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>
                <span className="block text-sm font-medium text-red-700">Delete partner</span>
                <span className="block text-[11px] text-red-600/80">Super Admin only — requires confirmation</span>
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
