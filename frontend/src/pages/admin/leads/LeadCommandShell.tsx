import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Download, Phone, Plus, Radio, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { isCrmManagerUser, isLeadAgentOnly, isSuperAdminPanelUser } from '@/constants/adminAccess'
import { crmService, type CrmLead } from '@/services/crmService'
import { LeadCommandProvider, useLeadCommand } from './LeadCommandContext'
import { AGENT_LEAD_TABS, LEAD_TABS, MANAGER_LEAD_TABS } from './leadCommandNav'
import { AddLeadModal } from './AddLeadModal'
import { CallLeadModal } from './CallLeadModal'
import './lead-command.css'

function LeadCommandTabs() {
  const { summary } = useLeadCommand()
  const user = useAuthStore((s) => s.user)
  const agentOnly = isLeadAgentOnly(user)
  const superAdmin = isSuperAdminPanelUser(user)
  const managerOnly = isCrmManagerUser(user) && !superAdmin
  const manager = user?.leadRole === 'manager' || superAdmin

  let visible = LEAD_TABS.filter((t) => {
    if (agentOnly) return t.id === 'inbox' || t.id === 'follow-ups'
    if (t.minRole === 'super') return superAdmin
    if (t.minRole === 'manager') return manager
    return true
  })

  if (managerOnly) {
    visible = MANAGER_LEAD_TABS
  }

  return (
    <div className="lead-page-tabs-wrap">
      <nav className="lead-page-tabs" aria-label="Lead sections">
        {visible.map((tab) => {
          const badge = tab.badgeKey && summary ? summary[tab.badgeKey] : null
          return (
            <NavLink
              key={tab.id}
              to={`/admin/leads/${tab.path}`}
              className={({ isActive }) => `lead-page-tab${isActive ? ' lead-page-tab--active' : ''}`}
            >
              <span>{tab.label}</span>
              {typeof badge === 'number' && badge > 0 && (
                <span className="lead-page-tab-badge">{badge > 99 ? '99+' : badge}</span>
              )}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}

function LeadCommandHeader() {
  const loc = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { setAddLeadOpen } = useLeadCommand()
  const [exporting, setExporting] = useState(false)
  const [callLead, setCallLead] = useState<CrmLead | null>(null)
  const [startingCall, setStartingCall] = useState(false)
  const segment = loc.pathname.split('/').filter(Boolean)[2] || 'overview'
  const superAdmin = isSuperAdminPanelUser(user)
  const managerOnly = isCrmManagerUser(user) && !superAdmin
  const agentOnly = isLeadAgentOnly(user)
  const tab = [...LEAD_TABS, ...MANAGER_LEAD_TABS, ...AGENT_LEAD_TABS].find((t) => t.path === segment)

  const agentSubtitles: Record<string, string> = {
    overview: 'Your assigned leads and calling plan are ready.',
    inbox: 'Only leads assigned to you are visible here.',
    'follow-ups': 'Work your assigned reminders in due-time order, then complete or reschedule them.',
    calls: 'Only your calls and recordings are shown.',
  }

  const managerSubtitles: Record<string, string> = {
    overview: 'Manage your agents, assignments and team calling performance.',
    inbox: 'Capture, qualify and progress leads from every XpertIntern source.',
    assignment: 'Balance agent workload and route leads to the right counsellor.',
    'follow-ups': 'Assign ownership, monitor due work and keep every promised callback visible.',
    calls: 'Monitor TeleCMI call outcomes, quality and recordings.',
    'my-agents': 'Manage the calling agents in your team.',
    reports: 'Understand sources, funnel health and team performance.',
  }

  const superSubtitles: Record<string, string> = {
    overview: 'Monitor urgency, funnel health and team performance at a glance.',
    inbox: 'Capture, qualify and progress leads from every XpertIntern source.',
    assignment: 'Balance agent workload and route leads to the right counsellor.',
    'follow-ups': 'Assign ownership, monitor due work and keep every promised callback visible.',
    calls: 'Monitor TeleCMI call outcomes, quality and recordings.',
    imports: 'Upload campaign leads and download filtered operational data.',
    people: 'Manage roles, availability and calling capacity.',
    reports: 'Understand sources, funnel health and team performance.',
    settings: 'Control routing, TeleCMI, permissions and operational history.',
  }

  const firstName = (user?.name || 'there').split(' ')[0]
  const title = (managerOnly || agentOnly) && segment === 'overview'
    ? `Good morning, ${firstName}`
    : agentOnly && segment === 'inbox'
      ? 'My Assigned Leads'
      : (tab?.label ?? 'Leads')
  const subtitle = agentOnly
    ? (agentSubtitles[segment] || agentSubtitles.inbox)
    : managerOnly
      ? (managerSubtitles[segment] || managerSubtitles.inbox)
      : (superSubtitles[segment] || superSubtitles.inbox)

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await crmService.exportLeads()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = managerOnly ? 'team-leads-export.csv' : 'leads-export.csv'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const handleStartNextCall = async () => {
    setStartingCall(true)
    try {
      const day = await crmService.getMyDay()
      const next = day.hotUncontacted[0] || day.followUps[0] || day.newAssigned[0]
      if (next) {
        setCallLead(next)
      } else {
        const list = await crmService.listLeads({ limit: 1 })
        if (list.items[0]) setCallLead(list.items[0])
        else navigate('/admin/leads/inbox')
      }
    } finally {
      setStartingCall(false)
    }
  }

  return (
    <>
    <div className="lead-command-header">
      <div className="min-w-0">
        {agentOnly && (
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Agent workspace</p>
        )}
        {managerOnly && (
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#2563eb] mb-1">Manager workspace</p>
        )}
        {superAdmin && !managerOnly && !agentOnly && (
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#2563eb] mb-1">Super Admin workspace</p>
        )}
        <h1 className="lead-command-title">{title}</h1>
        <p className="lead-command-subtitle">{subtitle}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 sm:inline-flex">
          <Radio className="h-3 w-3" /> TeleCMI connected
        </span>
        {agentOnly ? (
          <button
            type="button"
            onClick={() => void handleStartNextCall()}
            disabled={startingCall}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <Phone className="h-4 w-4" /> {startingCall ? 'Loading…' : 'Start next call'}
          </button>
        ) : managerOnly ? (
          <>
            <button
              type="button"
              disabled={exporting}
              onClick={() => void handleExport()}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export team'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/leads/assignment')}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <UserPlus className="h-4 w-4" /> Assign leads
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={exporting}
              onClick={() => void handleExport()}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export'}
            </button>
            <button
              type="button"
              onClick={() => setAddLeadOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Add lead
            </button>
          </>
        )}
      </div>
    </div>
    <CallLeadModal open={!!callLead} lead={callLead} onClose={() => setCallLead(null)} />
    </>
  )
}

function LeadCommandShellInner() {
  const user = useAuthStore((s) => s.user)
  const managerOnly = isCrmManagerUser(user) && !isSuperAdminPanelUser(user)
  const agentOnly = isLeadAgentOnly(user)
  const sidebarNavOnly = managerOnly || agentOnly

  return (
    <div className="lead-command w-full space-y-5">
      {!sidebarNavOnly && <LeadCommandTabs />}
      <LeadCommandHeader />
      <div className="lead-command-content">
        <Outlet />
      </div>
    </div>
  )
}

export function LeadCommandShell() {
  return (
    <LeadCommandProvider>
      <LeadCommandShellInner />
      <AddLeadModal />
    </LeadCommandProvider>
  )
}
