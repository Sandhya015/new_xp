import type { LucideIcon } from 'lucide-react'
import {
  LayoutGrid,
  User,
  Shuffle,
  Calendar,
  Phone,
  Upload,
  Users,
  BarChart3,
  Settings,
} from 'lucide-react'

export type LeadTabId =
  | 'overview'
  | 'inbox'
  | 'assignment'
  | 'follow-ups'
  | 'calls'
  | 'imports'
  | 'people'
  | 'my-agents'
  | 'reports'
  | 'settings'

export type LeadTabDef = {
  id: LeadTabId
  path: string
  label: string
  icon: LucideIcon
  /** manager | super | agent — empty = all CRM users */
  minRole?: 'agent' | 'manager' | 'super'
  badgeKey?: keyof import('@/services/crmService').CrmSummary
}

export const LEAD_TABS: LeadTabDef[] = [
  { id: 'overview', path: 'overview', label: 'Overview', icon: LayoutGrid, minRole: 'manager' },
  { id: 'inbox', path: 'inbox', label: 'Lead Inbox', icon: User, badgeKey: 'unassigned' },
  { id: 'assignment', path: 'assignment', label: 'Assignment Center', icon: Shuffle, minRole: 'manager' },
  { id: 'follow-ups', path: 'follow-ups', label: 'Follow-ups', icon: Calendar, badgeKey: 'followUpsDue' },
  { id: 'calls', path: 'calls', label: 'Calls & Recordings', icon: Phone, minRole: 'manager' },
  { id: 'imports', path: 'imports', label: 'Imports & Exports', icon: Upload, minRole: 'manager' },
  { id: 'people', path: 'people', label: 'People & Teams', icon: Users, minRole: 'manager' },
  { id: 'reports', path: 'reports', label: 'Reports', icon: BarChart3, minRole: 'manager' },
  { id: 'settings', path: 'settings', label: 'Settings & Audit', icon: Settings, minRole: 'super' },
]

/** Manager workspace — no imports, people (super), or settings */
export const MANAGER_LEAD_TABS: LeadTabDef[] = [
  { id: 'overview', path: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'inbox', path: 'inbox', label: 'Lead Inbox', icon: User, badgeKey: 'unassigned' },
  { id: 'assignment', path: 'assignment', label: 'Assignment Center', icon: Shuffle },
  { id: 'follow-ups', path: 'follow-ups', label: 'Follow-ups', icon: Calendar, badgeKey: 'followUpsDue' },
  { id: 'calls', path: 'calls', label: 'Calls & Recordings', icon: Phone },
  { id: 'my-agents', path: 'my-agents', label: 'My Agents', icon: Users },
  { id: 'reports', path: 'reports', label: 'Reports', icon: BarChart3 },
]

/** Agent workspace — sidebar only, no top tabs */
export const AGENT_LEAD_TABS: LeadTabDef[] = [
  { id: 'overview', path: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'inbox', path: 'inbox', label: 'My Assigned Leads', icon: User, badgeKey: 'totalOpen' },
  { id: 'follow-ups', path: 'follow-ups', label: 'Follow-ups', icon: Calendar, badgeKey: 'followUpsDue' },
  { id: 'calls', path: 'calls', label: 'Calls & Recordings', icon: Phone },
]

export function tabLabelForPath(segment: string): string {
  return LEAD_TABS.find((t) => t.path === segment)?.label
    ?? MANAGER_LEAD_TABS.find((t) => t.path === segment)?.label
    ?? AGENT_LEAD_TABS.find((t) => t.path === segment)?.label
    ?? 'Leads'
}
