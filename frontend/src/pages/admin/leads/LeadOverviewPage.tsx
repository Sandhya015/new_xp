import { useAuthStore } from '@/store/authStore'
import { isCrmManagerUser, isLeadAgentOnly, isSuperAdminPanelUser } from '@/constants/adminAccess'
import { LeadOverview } from './LeadOverview'
import { ManagerOverview } from './ManagerOverview'
import { AgentOverview } from './AgentOverview'

export function LeadOverviewPage() {
  const user = useAuthStore((s) => s.user)
  if (isLeadAgentOnly(user)) {
    return <AgentOverview />
  }
  if (isCrmManagerUser(user) && !isSuperAdminPanelUser(user)) {
    return <ManagerOverview />
  }
  return <LeadOverview />
}
