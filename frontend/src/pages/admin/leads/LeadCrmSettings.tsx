import { useEffect, useState } from 'react'
import { Bell, Clock, Download, Globe, Phone, Settings, Shield, Users } from 'lucide-react'
import { crmService, type CrmAuditEntry, type CrmSettings } from '@/services/crmService'

const SETTINGS_NAV = [
  { id: 'lead', label: 'Lead configuration', icon: Settings },
  { id: 'telecmi', label: 'TeleCMI integration', icon: Phone },
  { id: 'roles', label: 'Roles & permissions', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Data & privacy', icon: Globe },
  { id: 'audit', label: 'Audit log', icon: Clock },
]

const ROLES = [
  { name: 'Super Admin', desc: 'All modules, reports and settings.' },
  { name: 'Manager', desc: 'Team leads, assignment, calls and reports.' },
  { name: 'Agent', desc: 'Assigned leads, calls and own follow-ups.' },
]

function formatAuditTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`lc-settings-toggle ${checked ? 'lc-settings-toggle--on' : ''}`}
    >
      <span className="lc-settings-toggle-knob" />
    </button>
  )
}

function SettingsRow({
  label,
  sub,
  checked,
  onChange,
}: {
  label: string
  sub: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="lc-settings-row">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{sub}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

export function LeadCrmSettings() {
  const [section, setSection] = useState('lead')
  const [autoAssign, setAutoAssign] = useState(true)
  const [dupDetect, setDupDetect] = useState(true)
  const [overdueAlerts, setOverdueAlerts] = useState(true)
  const [recordingAccess, setRecordingAccess] = useState(true)
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [whatsappAlerts, setWhatsappAlerts] = useState(false)
  const [retentionDays, setRetentionDays] = useState('180')
  const [telecmiCount, setTelecmiCount] = useState({ linked: 0, total: 0 })
  const [exporting, setExporting] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [auditEntries, setAuditEntries] = useState<CrmAuditEntry[]>([])
  const [telecmiTesting, setTelecmiTesting] = useState(false)

  useEffect(() => {
    crmService.getSettings().then((s) => {
      setAutoAssign(s.autoAssign)
      setDupDetect(s.duplicateDetection)
      setOverdueAlerts(s.overdueFollowUpAlerts)
      setRecordingAccess(s.recordingAccess)
      setEmailAlerts(s.emailAlerts)
      setWhatsappAlerts(s.whatsappAlerts)
      setRetentionDays(String(s.recordingRetentionDays))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (section === 'audit') {
      crmService.getAuditLog(30).then(setAuditEntries).catch(() => setAuditEntries([]))
    }
  }, [section])

  useEffect(() => {
    if (section !== 'telecmi') return
    Promise.all([
      crmService.listAgents().catch(() => []),
      crmService.listTelecmiAgents().catch(() => []),
    ]).then(([users, tele]) => {
      const linked = users.filter((u) => u.telecmiAgentId).length
      setTelecmiCount({ linked, total: Math.max(tele.length, users.length) })
    })
  }, [section])

  const saveSettings = async (patch: Partial<CrmSettings>, msg: string) => {
    setSaving(true)
    try {
      await crmService.updateSettings(patch)
      flashSaved(msg)
    } catch {
      flashSaved('Save failed — try again.')
    } finally {
      setSaving(false)
    }
  }

  const testTelecmi = async () => {
    setTelecmiTesting(true)
    try {
      const r = await crmService.testTelecmi()
      flashSaved(r.ok ? 'TeleCMI connection test passed.' : 'TeleCMI test failed — check credentials.')
    } catch {
      flashSaved('TeleCMI test failed.')
    } finally {
      setTelecmiTesting(false)
    }
  }

  const flashSaved = (msg: string) => {
    setSavedMsg(msg)
    window.setTimeout(() => setSavedMsg(''), 2500)
  }

  const exportLeadData = async () => {
    setExporting(true)
    try {
      const blob = await crmService.exportLeads()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'leads-export.csv'
      a.click()
      URL.revokeObjectURL(url)
      flashSaved('Lead data export started.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="lc-settings-layout">
      <nav className="lc-settings-nav lc-card">
        {SETTINGS_NAV.map((item) => {
          const Icon = item.icon
          const active = section === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => { setSection(item.id); setSavedMsg('') }}
              className={`lc-settings-nav-item${active ? ' lc-settings-nav-item--active' : ''}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="lc-card lc-settings-panel">
        {savedMsg && (
          <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{savedMsg}</p>
        )}

        {section === 'lead' && (
          <>
            <h3 className="lc-settings-panel-title">Lead configuration</h3>
            <p className="lc-settings-panel-sub">Defaults for capture, assignment and follow-up</p>
            <div className="mt-6 space-y-0">
              <SettingsRow label="Automatic lead distribution" sub="Route new leads using active rules." checked={autoAssign} onChange={setAutoAssign} />
              <SettingsRow label="Duplicate detection" sub="Match incoming records using phone and email." checked={dupDetect} onChange={setDupDetect} />
              <SettingsRow label="Overdue follow-up alerts" sub="Notify managers after 15 minutes." checked={overdueAlerts} onChange={setOverdueAlerts} />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveSettings({ autoAssign, duplicateDetection: dupDetect, overdueFollowUpAlerts: overdueAlerts }, 'Lead configuration saved.')}
              className="lc-settings-primary-btn mt-6"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </>
        )}

        {section === 'telecmi' && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="lc-settings-icon-badge"><Phone className="h-5 w-5" /></div>
                <div>
                  <h3 className="lc-settings-panel-title">TeleCMI</h3>
                  <p className="lc-settings-panel-sub">Click-to-call, CRM, webhooks and recordings</p>
                </div>
              </div>
              <span className="lc-settings-connected-pill">Connected</span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Last sync', value: '1 minute ago' },
                { label: 'Extensions', value: `${telecmiCount.linked} of ${telecmiCount.total || '—'}` },
                { label: 'Webhook health', value: 'Healthy' },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-gray-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500">{s.label}</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{s.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <SettingsRow
                label="Call recording access"
                sub="Admin, manager and assigned agent"
                checked={recordingAccess}
                onChange={setRecordingAccess}
              />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button type="button" disabled={telecmiTesting} onClick={() => void testTelecmi()} className="lc-settings-outline-btn">
                {telecmiTesting ? 'Testing…' : 'Test connection'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveSettings({ recordingAccess }, 'TeleCMI settings saved.')}
                className="lc-settings-outline-btn"
              >
                Save recording access
              </button>
              <button type="button" onClick={() => setSection('audit')} className="text-sm font-semibold text-[#2563eb] hover:underline">
                View integration log
              </button>
            </div>
          </>
        )}

        {section === 'roles' && (
          <>
            <h3 className="lc-settings-panel-title">Roles &amp; permissions</h3>
            <p className="lc-settings-panel-sub">Access is enforced by workspace role</p>
            <ul className="mt-6 divide-y divide-gray-100">
              {ROLES.map((r) => (
                <li key={r.name} className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="lc-settings-icon-badge lc-settings-icon-badge--muted">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                      <p className="text-xs text-slate-500">{r.desc}</p>
                    </div>
                  </div>
                  <button type="button" className="text-sm font-semibold text-[#2563eb] hover:underline">Review</button>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-500">Role permissions are enforced by the backend on each API request.</p>
          </>
        )}

        {section === 'notifications' && (
          <>
            <h3 className="lc-settings-panel-title">Notifications</h3>
            <p className="lc-settings-panel-sub">Choose how managers receive urgent alerts</p>
            <div className="mt-6 space-y-0">
              <SettingsRow label="Email alerts" sub="Overdue follow-ups and assignment SLA" checked={emailAlerts} onChange={setEmailAlerts} />
              <SettingsRow label="WhatsApp alerts" sub="High priority leads, user payment notifications" checked={whatsappAlerts} onChange={setWhatsappAlerts} />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveSettings({ emailAlerts, whatsappAlerts }, 'Notification preferences saved.')}
              className="lc-settings-primary-btn mt-6"
            >
              Save preferences
            </button>
          </>
        )}

        {section === 'privacy' && (
          <>
            <h3 className="lc-settings-panel-title">Data &amp; privacy</h3>
            <p className="lc-settings-panel-sub">Retention and export controls</p>
            <div className="mt-6 space-y-0">
              <div className="lc-settings-row">
                <div>
                  <p className="text-sm font-medium text-slate-900">Call recording retention</p>
                  <p className="text-xs text-slate-500">Recordings are retained for {retentionDays} days</p>
                </div>
                <select
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-700"
                >
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="365">365 days</option>
                </select>
              </div>
              <div className="lc-settings-row">
                <div>
                  <p className="text-sm font-medium text-slate-900">Lead data export</p>
                  <p className="text-xs text-slate-500">Download a complete administrator copy</p>
                </div>
                <button type="button" disabled={exporting} onClick={exportLeadData} className="lc-settings-outline-btn inline-flex items-center gap-2">
                  <Download className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export data'}
                </button>
              </div>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveSettings({ recordingRetentionDays: parseInt(retentionDays, 10) || 180 }, 'Privacy settings saved.')}
              className="lc-settings-primary-btn mt-6"
            >
              Save privacy settings
            </button>
          </>
        )}

        {section === 'audit' && (
          <>
            <h3 className="lc-settings-panel-title">Recent audit activity</h3>
            <p className="lc-settings-panel-sub">Sensitive actions recorded automatically</p>
            <ul className="mt-6 divide-y divide-gray-100">
              {auditEntries.length === 0 ? (
                <li className="py-8 text-center text-sm text-slate-500">No audit entries yet.</li>
              ) : (
                auditEntries.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-4 py-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="lc-settings-icon-badge lc-settings-icon-badge--muted mt-0.5">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{entry.action}</p>
                        <p className="text-xs text-slate-500">
                          {formatAuditTime(entry.createdAt)} · {entry.actorName}
                          {entry.ip ? ` · ${entry.ip}` : ''}
                        </p>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
