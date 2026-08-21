import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { crmService, type CrmSummary } from '@/services/crmService'

type Ctx = {
  summary: CrmSummary | null
  loading: boolean
  refresh: () => Promise<void>
  addLeadOpen: boolean
  setAddLeadOpen: (open: boolean) => void
}

const LeadCommandContext = createContext<Ctx>({
  summary: null,
  loading: true,
  refresh: async () => {},
  addLeadOpen: false,
  setAddLeadOpen: () => {},
})

export function LeadCommandProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<CrmSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [addLeadOpen, setAddLeadOpen] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setSummary(await crmService.getSummary())
    } catch {
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <LeadCommandContext.Provider value={{ summary, loading, refresh, addLeadOpen, setAddLeadOpen }}>
      {children}
    </LeadCommandContext.Provider>
  )
}

export function useLeadCommand() {
  return useContext(LeadCommandContext)
}
