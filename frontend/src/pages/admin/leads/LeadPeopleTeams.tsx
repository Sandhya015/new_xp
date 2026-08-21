import { useCallback, useEffect, useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { crmService, type CrmAgent } from '@/services/crmService'
import { isSuperAdminPanelUser } from '@/constants/adminAccess'
import { useAuthStore } from '@/store/authStore'
import { CreateTeamAccountForm } from './CreateTeamAccountForm'
import { leadInitials } from './shared'

type AgentRow = CrmAgent & { activeLeads: number; callsToday: number; capacityPct: number }

function agentStatus(a: AgentRow): { label: string; class: string } {
  if (a.callsToday > 0) return { label: 'On call', class: 'bg-blue-50 text-blue-700' }
  if (a.capacityPct >= 70) return { label: 'Break', class: 'bg-amber-50 text-amber-700' }
  return { label: 'Available', class: 'bg-emerald-50 text-emerald-700' }
}

export function LeadPeopleTeams() {
  const user = useAuthStore((s) => s.user)
  const canManage = isSuperAdminPanelUser(user) || user?.leadRole === 'manager'
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [allUsers, setAllUsers] = useState<CrmAgent[]>([])
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
      setAgents(extras.agentWorkload || [])
      setAllUsers(users)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canManage) void load()
  }, [canManage, load])

  if (!canManage) return <Navigate to="/admin/leads/inbox" replace />

  const managers = agents.filter((a) => a.leadRole === 'manager')
  const counselors = agents.filter((a) => a.leadRole === 'agent')
  const telecmiPending = allUsers.filter((u) => !u.telecmiAgentId && u.leadRole !== 'manager').length

  return (
    <div className="space-y-5">
      <div className="lc-kpi-row lc-kpi-row--3">
        {[
          { title: 'Super Admins', count: isSuperAdminPanelUser(user) ? 1 : 0, sub: 'Full system access' },
          { title: 'Managers', count: managers.length, sub: 'Assign, call & manage agents' },
          { title: 'Agents', count: counselors.length, sub: 'Assigned leads & calling' },
        ].map((r) => (
          <div key={r.title} className="lc-kpi-icon-card">
            <div className="lc-kpi-icon lc-kpi-icon--blue"><Users className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-semibold text-slate-500">{r.title}</p>
              <p className="text-2xl font-bold text-slate-900">{r.count}</p>
              <p className="text-xs text-slate-500">{r.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {banner && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {banner}
        </div>
      )}

      <div className="lc-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="lc-card-title">Team directory</h3>
            <p className="text-xs text-slate-500">
              {allUsers.length} active users · {telecmiPending} TeleCMI pending
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setShowForm((v) => !v); setBanner('') }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> {showForm ? 'Close form' : 'Add team member'}
          </button>
        </div>

        {showForm && (
          <div className="mt-4">
            <CreateTeamAccountForm
              managers={managers}
              onClose={() => setShowForm(false)}
              onCreated={(msg) => {
                setBanner(msg)
                void load()
              }}
            />
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-center text-sm text-slate-500 py-8">Loading team…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {agents.map((a) => {
            const st = agentStatus(a)
            return (
              <div key={a.id} className="lc-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="lc-avatar">{leadInitials(a.fullName)}</span>
                    <div>
                      <p className="font-semibold text-slate-900">{a.fullName}</p>
                      <p className="text-xs capitalize text-slate-500">
                        {a.leadRole === 'agent' ? 'Agent' : a.leadRole === 'manager' ? 'Manager' : a.leadRole}
                      </p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.class}`}>{st.label}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div><p className="text-lg font-bold">{a.callsToday}</p><p className="text-slate-400">Calls</p></div>
                  <div><p className="text-lg font-bold">—</p><p className="text-slate-400">Conversion</p></div>
                  <div><p className="text-lg font-bold">{a.activeLeads}</p><p className="text-slate-400">Overdue</p></div>
                </div>
                <p className="mt-3 text-[10px] text-slate-400">TeleCMI ext: {a.telecmiAgentId || '—'}</p>
                <button type="button" className="mt-2 text-xs font-semibold text-[#2563eb] hover:underline">View profile →</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
