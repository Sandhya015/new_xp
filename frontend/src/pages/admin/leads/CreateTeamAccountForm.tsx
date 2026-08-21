import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Headphones, Shuffle, X } from 'lucide-react'
import { crmService, type CrmAgent } from '@/services/crmService'

type Props = {
  managers: CrmAgent[]
  onClose: () => void
  onCreated: (message: string) => void
  /** When true, only Agent role can be created (manager adding to their team). */
  agentOnly?: boolean
}

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <label className="lc-team-field-label">
      {children}
      {required && <span className="text-red-500"> *</span>}
    </label>
  )
}

export function CreateTeamAccountForm({ managers, onClose, onCreated, agentOnly = false }: Props) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [leadRole, setLeadRole] = useState<'agent' | 'manager'>('agent')
  const [reportingManagerId, setReportingManagerId] = useState('')
  const [telecmiExtension, setTelecmiExtension] = useState('')
  const [dailyLeadCapacity, setDailyLeadCapacity] = useState('35')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isAgent = leadRole === 'agent'

  useEffect(() => {
    if (isAgent && !reportingManagerId && managers.length) {
      setReportingManagerId(managers[0].id)
    }
  }, [isAgent, managers, reportingManagerId])

  const canSubmit = useMemo(() => {
    const mobileOk = /^\d{10}$/.test(mobile.replace(/\D/g, '').slice(-10))
    return (
      fullName.trim().length >= 2 &&
      email.trim().includes('@') &&
      mobileOk &&
      password.length >= 8
    )
  }, [fullName, email, mobile, password])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError('')
    try {
      const r = await crmService.createAgent({
        fullName: fullName.trim(),
        email: email.trim(),
        mobile: mobile.replace(/\D/g, '').slice(-10),
        password,
        leadRole,
        telecmiExtension: telecmiExtension.trim() || undefined,
        reportingManagerId: isAgent && reportingManagerId ? reportingManagerId : undefined,
        dailyLeadCapacity: isAgent ? Number(dailyLeadCapacity) || 35 : undefined,
      })
      if (r.emailSent) {
        onCreated(`Account created. Login credentials emailed to ${r.agent.email}.`)
      } else {
        onCreated(
          `Account created for ${r.agent.email}. Welcome email will be sent once SMTP is configured${
            r.temporaryPassword ? ` — temp password: ${r.temporaryPassword}` : ''
          }.`,
        )
      }
      onClose()
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : 'Could not create account'
      if (msg === 'email_exists') setError('An account with this email already exists.')
      else if (msg === 'password_too_short') setError('Password must be at least 8 characters.')
      else setError(typeof msg === 'string' ? msg : 'Could not create account.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="lc-create-team-form">
      <div className="lc-create-team-form-head">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Create team account</h4>
          <p className="text-xs text-slate-500">Choose Manager or Agent access.</p>
        </div>
        <button type="button" onClick={onClose} className="lc-create-team-close" aria-label="Close form">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="lc-create-team-grid lc-create-team-grid--4">
        <div>
          <FieldLabel required>Full name</FieldLabel>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Anjali Kumari"
            className="lc-team-input"
          />
        </div>
        <div>
          <FieldLabel required>Work email</FieldLabel>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@xpertintern.com"
            className="lc-team-input"
          />
        </div>
        <div>
          <FieldLabel required>Mobile number</FieldLabel>
          <input
            required
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="10-digit number"
            className="lc-team-input"
            inputMode="numeric"
          />
        </div>
        <div>
          <FieldLabel required>Temporary password</FieldLabel>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            className="lc-team-input"
            minLength={8}
          />
        </div>
      </div>

      <div className={`lc-create-team-grid ${isAgent ? 'lc-create-team-grid--4' : 'lc-create-team-grid--2'}`}>
        <div>
          <FieldLabel required>Role</FieldLabel>
          <select
            value={leadRole}
            onChange={(e) => setLeadRole(e.target.value as 'agent' | 'manager')}
            className="lc-team-input"
            disabled={agentOnly}
          >
            <option value="agent">Agent</option>
            {!agentOnly && <option value="manager">Manager</option>}
          </select>
        </div>
        {isAgent && (
          <div>
            <FieldLabel>Reporting manager</FieldLabel>
            <select
              value={reportingManagerId}
              onChange={(e) => setReportingManagerId(e.target.value)}
              className="lc-team-input"
            >
              <option value="">Select manager</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.fullName}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <FieldLabel>TeleCMI extension</FieldLabel>
          <input
            value={telecmiExtension}
            onChange={(e) => setTelecmiExtension(e.target.value)}
            placeholder="e.g. 205"
            className="lc-team-input"
          />
        </div>
        {isAgent && (
          <div>
            <FieldLabel>Daily lead capacity</FieldLabel>
            <input
              type="number"
              min={1}
              max={200}
              value={dailyLeadCapacity}
              onChange={(e) => setDailyLeadCapacity(e.target.value)}
              className="lc-team-input"
            />
          </div>
        )}
      </div>

      <div className={`lc-create-team-access ${isAgent ? 'lc-create-team-access--agent' : 'lc-create-team-access--manager'}`}>
        <div className="lc-create-team-access-icon">
          {isAgent ? <Headphones className="h-5 w-5" /> : <Shuffle className="h-5 w-5" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#1e3a5f]">{isAgent ? 'Agent access' : 'Manager access'}</p>
          <p className="text-xs text-slate-600">
            {isAgent ? 'Assigned leads · Calls · Follow-ups' : 'Assign leads · Calls · Manage agents'}
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="lc-create-team-footer">
        <p className="text-xs text-slate-500">Password change required at first login</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="lc-team-btn-cancel">
            Cancel
          </button>
          <button type="submit" disabled={!canSubmit || saving} className="lc-team-btn-create">
            {saving ? 'Creating…' : 'Create account'}
          </button>
        </div>
      </div>
    </form>
  )
}
