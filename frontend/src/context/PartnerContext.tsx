import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { partnerService } from '@/services/partnerService'

export type PartnerStats = Record<string, number | Array<{ date: string; value: number }>>

type PartnerContextValue = {
  partner: Record<string, unknown> | null
  stats: PartnerStats
  unreadNotifications: number
  loading: boolean
  refresh: () => Promise<void>
}

const PartnerContext = createContext<PartnerContextValue | null>(null)

export function PartnerProvider({ children }: { children: ReactNode }) {
  const [partner, setPartner] = useState<Record<string, unknown> | null>(null)
  const [stats, setStats] = useState<PartnerStats>({})
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const r = await partnerService.me()
      setPartner(r.partner || null)
      setStats(r.stats || {})
      setUnreadNotifications(r.unreadNotifications || 0)
    } catch {
      setPartner(null)
      setStats({})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <PartnerContext.Provider value={{ partner, stats, unreadNotifications, loading, refresh }}>
      {children}
    </PartnerContext.Provider>
  )
}

export function usePartner() {
  const ctx = useContext(PartnerContext)
  if (!ctx) throw new Error('usePartner must be used within PartnerProvider')
  return ctx
}
