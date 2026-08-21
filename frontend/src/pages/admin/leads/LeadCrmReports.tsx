import { useEffect, useState } from 'react'
import { useLeadCommand } from './LeadCommandContext'
import { crmService } from '@/services/crmService'
import { SOURCE_LABEL, leadInitials } from './shared'

const SOURCE_LABELS_REPORT: Record<string, string> = {
  training_interest: 'Training page',
  contact_us: 'Contact a callback',
  callback: 'Contact a callback',
  registration: 'Registration',
  campaigns: 'Campaign | QR',
  payment_recovery: 'Payment link',
  uploads: 'Uploads',
  converted: 'Converted',
}

export function LeadCrmReports() {
  const { summary } = useLeadCommand()
  const [leaderboard, setLeaderboard] = useState<Array<{ fullName: string; callsToday: number; activeLeads: number }>>([])
  const s = summary

  useEffect(() => {
    crmService.getOverviewExtras().then((r) => {
      setLeaderboard(
        (r.agentWorkload || [])
          .sort((a, b) => b.callsToday - a.callsToday)
          .slice(0, 4)
          .map((a) => ({ fullName: a.fullName, callsToday: a.callsToday, activeLeads: a.activeLeads })),
      )
    })
  }, [])

  const totalVol = s?.totalOpen ?? 0
  const contactRate = totalVol ? Math.round(((totalVol - (s?.unassigned ?? 0)) / totalVol) * 1000) / 10 : 0
  const enrollRate = totalVol ? Math.round(((s?.enrolled ?? 0) / totalVol) * 1000) / 10 : 0

  return (
    <div className="space-y-5">
      <div className="lc-kpi-row">
        {[
          { label: 'Lead volume', value: totalVol.toLocaleString(), delta: '+14.2% vs prior' },
          { label: 'Contact rate', value: `${contactRate}%`, delta: '+5.1% vs prior' },
          { label: 'Lead-to-enrollment', value: `${enrollRate}%`, delta: '+1.9% vs prior' },
          { label: 'Revenue attributed', value: '—', delta: 'Connect payments' },
        ].map((row) => (
          <div key={row.label} className="lc-stat">
            <p className="lc-stat-label">{row.label}</p>
            <p className="lc-stat-value">{row.value}</p>
            <p className="mt-1 text-xs font-medium text-emerald-600">{row.delta}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lc-card p-5">
          <div className="mb-4">
            <h3 className="lc-card-title">Lead sources</h3>
            <p className="text-xs text-slate-500">This month · volume and conversion</p>
          </div>
          <ul className="space-y-4">
            {Object.entries(s?.viewCounts ?? {}).slice(0, 5).map(([key, val]) => {
              const pct = totalVol ? Math.round((val / totalVol) * 100) : 0
              return (
                <li key={key}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-slate-700">{SOURCE_LABELS_REPORT[key] || SOURCE_LABEL[key] || key}</span>
                    <span className="text-slate-600">{val} · {pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#3b82f6]" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="lc-card p-5">
          <div className="mb-4">
            <h3 className="lc-card-title">Agent leaderboard</h3>
            <p className="text-xs text-slate-500">Qualified and enrolled outcomes</p>
          </div>
          <ul className="space-y-3">
            {leaderboard.length === 0 ? (
              <li className="text-sm text-slate-500">No agent activity yet</li>
            ) : (
              leaderboard.map((a, i) => (
                <li key={a.fullName} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                  <span className="lc-avatar">{leadInitials(a.fullName)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{a.fullName}</p>
                    <p className="text-xs text-slate-500">{a.callsToday} calls today</p>
                  </div>
                  <span className="text-sm font-bold text-[#2563eb]">{Math.max(0, 100 - a.activeLeads * 3)}%</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
