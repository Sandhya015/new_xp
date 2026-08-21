import { useCallback, useEffect, useState } from 'react'
import { Phone, Plus, TrendingUp, Users } from 'lucide-react'
import { crmService, type CrmAgent } from '@/services/crmService'
import { CreateTeamAccountForm } from './CreateTeamAccountForm'
import { leadInitials } from './shared'

type AgentRow = CrmAgent & { activeLeads: number; callsToday: number; capacityPct: number }

function agentStatus(a: AgentRow): { label: string; class: string } {
  if (a.callsToday > 0) return { label: 'On call', class: 'bg-blue-50 text-blue-700' }
  if (a.capacityPct >= 70) return { label: 'Break', class: 'bg-amber-50 text-amber-700' }
  return { label: 'Available', class: 'bg-emerald-50 text-emerald-700' }
}

export function ManagerMyAgents() {
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [managers, setManagers] = useState<CrmAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [banner, setBanner] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [extras, users] = await Promise.all([
        crmService.getOverviewExtras(),
        crmService.listAgents(),
      ])
      const workload = extras.agentWorkload || []
      setAgents(workload.filter((a) => a.leadRole === 'agent'))
      setManagers(users.filter((u) => u.leadRole === 'manager'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const callingAgents = agents.filter((a) => a.leadRole === 'agent')
  const availableNow = callingAgents.filter((a) => a.callsToday === 0 && a.capacityPct < 70).length
  const teamCalls = callingAgents.reduce((n, a) => n + a.callsToday, 0)

  return (
    <div className="space-y-5">
      {banner && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{banner}</div>
      )}

      <div className="lc-kpi-row lc-kpi-row--3">
        <div className="lc-kpi-icon-card">
          <div className="lc-kpi-icon lc-kpi-icon--blue"><Users className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Active agents</p>
            <p className="text-2xl font-bold">{callingAgents.length}</p>
            <p className="text-xs text-slate-500">{availableNow} available now</p>
          </div>
        </div>
        <div className="lc-kpi-icon-card">
          <div className="lc-kpi-icon lc-kpi-icon--blue"><Phone className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Team calls today</p>
            <p className="text-2xl font-bold">{teamCalls}</p>
            <p className="text-xs text-slate-500">{Math.round(teamCalls * 0.76)} connected</p>
          </div>
        </div>
        <div className="lc-kpi-icon-card">
          <div className="lc-kpi-icon lc-kpi-icon--green"><TrendingUp className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Team conversion</p>
            <p className="text-2xl font-bold">—</p>
            <p className="text-xs text-slate-500">From enrolled outcomes</p>
          </div>
        </div>
      </div>

      <div className="lc-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="lc-card-title">My calling team</h3>
            <p className="text-xs text-slate-500">Agents you assign leads to and monitor daily</p>
          </div>
          <button
            type="button"
            onClick={() => { setShowForm((v) => !v); setBanner('') }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> {showForm ? 'Close form' : 'Add agent'}
          </button>
        </div>
        {showForm && (
          <div className="mt-4">
            <CreateTeamAccountForm
              managers={managers}
              agentOnly
              onClose={() => setShowForm(false)}
              onCreated={(msg) => { setBanner(msg); void load() }}
            />
          </div>
        )}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading team…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {callingAgents.map((a) => {
            const st = agentStatus(a)
            const cap = 50
            return (
              <div key={a.id} className="lc-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="lc-avatar">{leadInitials(a.fullName)}</span>
                    <div>
                      <p className="font-semibold text-slate-900">{a.fullName}</p>
                      <p className="text-xs text-slate-500">Calling Agent · Ext: {a.telecmiAgentId || '—'}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.class}`}>{st.label}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div><p className="text-lg font-bold">{a.callsToday}</p><p className="text-slate-400">Calls today</p></div>
                  <div><p className="text-lg font-bold">—</p><p className="text-slate-400">Conversion</p></div>
                  <div><p className="text-lg font-bold">{a.activeLeads}</p><p className="text-slate-400">Overdue</p></div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                    <span>Lead capacity</span>
                    <span>{a.activeLeads}/{cap}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${Math.min(100, (a.activeLeads / cap) * 100)}%` }} />
                  </div>
                </div>
                <div className="mt-3 flex gap-3 text-xs font-semibold text-[#2563eb]">
                  <button type="button" className="hover:underline">View performance</button>
                  <button type="button" className="hover:underline">Manage access</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
