import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, UserPlus, Users } from 'lucide-react'
import { crmService, type CrmAgent } from '@/services/crmService'
import { isSuperAdminPanelUser } from '@/constants/adminAccess'
import { useAuthStore } from '@/store/authStore'
import { Navigate } from 'react-router-dom'

type TelecmiAgent = { agentId: string; name: string; mobile?: string }

export function LeadAgents() {
  const user = useAuthStore((s) => s.user)
  const [agents, setAgents] = useState<CrmAgent[]>([])
  const [telecmiAgents, setTelecmiAgents] = useState<TelecmiAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [lastPassword, setLastPassword] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [telecmiAgentId, setTelecmiAgentId] = useState('')
  const [leadRole, setLeadRole] = useState('agent')

  const canManage = isSuperAdminPanelUser(user) || user?.leadRole === 'manager'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, tele] = await Promise.all([
        crmService.listAgents(),
        crmService.listTelecmiAgents().catch(() => []),
      ])
      setAgents(list)
      setTelecmiAgents(tele)
    } catch {
      setError('Could not load agents.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canManage) load()
  }, [canManage, load])

  if (!canManage) {
    return <Navigate to="/admin/leads/inbox" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    setLastPassword(null)
    try {
      const r = await crmService.createAgent({
        fullName: fullName.trim(),
        email: email.trim(),
        mobile: mobile.trim() || undefined,
        telecmiAgentId: telecmiAgentId || undefined,
        leadRole,
      })
      setSuccess(`Agent added. Welcome email sent to ${r.agent.email}.`)
      if (r.temporaryPassword) setLastPassword(r.temporaryPassword)
      setFullName('')
      setEmail('')
      setMobile('')
      setTelecmiAgentId('')
      setLeadRole('agent')
      await load()
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : 'Failed to add agent'
      setError(msg === 'email_exists' ? 'An account with this email already exists.' : msg || 'Failed to add agent')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full space-y-4">
      <p className="text-sm text-slate-gray">
        Add counselors here — they appear in the assign dropdown and receive login + lead emails when you assign leads.
      </p>

      <div className="grid w-full grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(300px,380px)_1fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3"
        >
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2 text-sm font-semibold text-brand-navy">
            <UserPlus className="h-4 w-4 text-brand-accent" />
            Add agent
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700">Full name</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                placeholder="Aishwarya Sharma"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700">Email (login)</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                placeholder="counselor@xpertintern.com"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700">Mobile</label>
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                placeholder="9876543210"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700">TeleCMI (click-to-call)</label>
              <select
                value={telecmiAgentId}
                onChange={(e) => setTelecmiAgentId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
              >
                <option value="">— Optional —</option>
                {telecmiAgents.map((a) => (
                  <option key={a.agentId} value={a.agentId}>
                    {a.name} ({a.agentId})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">CRM role</label>
            <select
              value={leadRole}
              onChange={(e) => setLeadRole(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
            >
              <option value="agent">Agent — My Day + assigned leads</option>
              <option value="manager">Manager — assign + add agents</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-emerald-700">{success}</p>}
          {lastPassword && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Temporary password (also emailed): <strong>{lastPassword}</strong>
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Adding…' : 'Add agent'}
          </button>
        </form>

        <div className="min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
              <Users className="h-4 w-4 text-brand-accent" />
              Active agents
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">{agents.length}</span>
            </div>
            <span className="text-xs text-slate-gray hidden sm:inline">Bulk assign · round-robin</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-gray">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
              <Users className="h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-slate-gray">No agents yet. Add your first counselor using the form.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600">Email</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600">Mobile</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600">Role</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600">TeleCMI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {agents.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm font-medium text-brand-navy">{row.fullName}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-gray">{row.email}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-gray">{row.mobile || '—'}</td>
                      <td className="px-4 py-2.5 text-sm capitalize text-slate-gray">{row.leadRole}</td>
                      <td className="px-4 py-2.5 text-xs font-mono text-slate-gray">{row.telecmiAgentId || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
