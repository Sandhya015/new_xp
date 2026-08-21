import { useEffect, useState } from 'react'
import { Loader2, Shuffle, X } from 'lucide-react'
import { crmService, type CrmAgent } from '@/services/crmService'
import { leadInitials } from './shared'

type AgentRow = CrmAgent & { activeLeads: number; callsToday?: number }

type Props = {
  open: boolean
  leadIds: string[]
  onClose: () => void
  onAssigned: () => void
}

export function AssignLeadsModal({ open, leadIds, onClose, onAssigned }: Props) {
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setSelectedAgentId('')
    setError('')
    setLoading(true)
    crmService
      .getOverviewExtras()
      .then((r) => setAgents(r.agentWorkload || []))
      .catch(() =>
        crmService.listAgents().then((list) =>
          setAgents(list.map((a) => ({ ...a, activeLeads: 0 }))),
        ),
      )
      .finally(() => setLoading(false))
  }, [open])

  const confirm = async () => {
    if (!selectedAgentId || !leadIds.length || saving) return
    setSaving(true)
    setError('')
    try {
      if (leadIds.length === 1) {
        await crmService.assignLead(leadIds[0], selectedAgentId)
      } else {
        await crmService.bulkAssign(leadIds, selectedAgentId)
      }
      onAssigned()
      onClose()
    } catch {
      setError('Assignment failed. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const count = leadIds.length

  return (
    <>
      <button type="button" className="lc-modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="lc-modal lc-assign-modal" role="dialog" aria-labelledby="assign-leads-title">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
          <X className="h-5 w-5" />
        </button>
        <div className="lc-modal-icon">
          <Shuffle className="h-6 w-6 text-[#2563eb]" strokeWidth={2} />
        </div>
        <h2 id="assign-leads-title" className="text-center text-lg font-bold text-slate-900">
          Assign {count} lead{count === 1 ? '' : 's'}
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          Choose an agent. Current workload is shown below.
        </p>

        <div className="mt-5 max-h-[320px] space-y-2 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : agents.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No agents available. Add agents under People &amp; Teams.</p>
          ) : (
            agents.map((a) => (
              <label
                key={a.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition ${
                  selectedAgentId === a.id ? 'border-[#2563eb] bg-[#eff6ff]/60' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="lc-avatar">{leadInitials(a.fullName)}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{a.fullName}</p>
                  <p className="text-xs text-slate-500">
                    Available · {a.activeLeads} active lead{a.activeLeads === 1 ? '' : 's'}
                  </p>
                </div>
                <input
                  type="radio"
                  name="assign-agent"
                  value={a.id}
                  checked={selectedAgentId === a.id}
                  onChange={() => setSelectedAgentId(a.id)}
                  className="h-4 w-4 shrink-0 border-gray-300 text-[#2563eb] focus:ring-[#2563eb]"
                />
              </label>
            ))
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={confirm}
          disabled={saving || !selectedAgentId || !count}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#1e3a5f] py-2.5 text-sm font-semibold text-white hover:bg-[#152a45] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? 'Assigning…' : 'Confirm assignment'}
        </button>
      </div>
    </>
  )
}
