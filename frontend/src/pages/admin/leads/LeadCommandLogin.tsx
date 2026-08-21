import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { authService } from '@/services/authService'
import { useAuthStore, type User } from '@/store/authStore'
import {
  isCrmManagerUser,
  isCrmPortalUser,
  isLeadAgentOnly,
  isSuperAdminPanelUser,
} from '@/constants/adminAccess'
import { AuthLoadingOverlay } from '@/components/ui/AuthLoadingOverlay'
import './lead-command-login.css'

type LoginRoleHint = 'manager' | 'agent' | null

function loginRoleFromPath(pathname: string): LoginRoleHint {
  if (pathname.includes('/manager/login')) return 'manager'
  if (pathname.includes('/agent/login')) return 'agent'
  return null
}

function postLoginPath(user: User, hint: LoginRoleHint): string {
  if (user.forcePasswordChange) return '/change-password'
  if (hint === 'manager') return '/admin/leads/overview'
  if (hint === 'agent') return '/admin/leads/overview'
  if (isLeadAgentOnly(user)) return '/admin/leads/overview'
  if (isCrmManagerUser(user)) return '/admin/leads/overview'
  return '/admin/leads/inbox'
}

function testUser(role: 'manager' | 'agent'): User {
  return {
    id: `dev-${role}`,
    name: role === 'manager' ? 'Test Manager' : 'Test Agent',
    email: `${role}@test.local`,
    role: 'admin',
    leadRole: role,
    adminPortalAccess: true,
  }
}

export function LeadCommandLogin() {
  const { pathname } = useLocation()
  const roleHint = loginRoleFromPath(pathname)
  const isDev = import.meta.env.DEV

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)

  const enterTestDashboard = (role: 'manager' | 'agent') => {
    setSession(testUser(role), 'dev-preview-token', 86400)
    navigate(postLoginPath(testUser(role), role), { replace: true })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await authService.loginAdmin(email, password)
      const user = data.user as unknown as User
      if (!isCrmPortalUser(user)) {
        setError('This account is not authorized for Lead Management.')
        return
      }
      if (isSuperAdminPanelUser(user)) {
        setError('Super Admin accounts should use the main admin login.')
        return
      }
      if (roleHint === 'manager' && user.leadRole === 'agent') {
        setError('This login page is for managers. Use /leadmanagement/agent/login for agents.')
        return
      }
      if (roleHint === 'agent' && user.leadRole === 'manager') {
        setError('This login page is for agents. Use /leadmanagement/manager/login for managers.')
        return
      }
      setSession(user, data.token, typeof data.expiresIn === 'number' ? data.expiresIn : undefined)
      navigate(postLoginPath(user, roleHint), { replace: true })
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : 'Login failed'
      setError(msg || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  const formTitle =
    roleHint === 'manager' ? 'Manager sign in' : roleHint === 'agent' ? 'Agent sign in' : 'Welcome back'

  return (
    <div className="lc-login-page">
      <AuthLoadingOverlay show={loading} ariaLabel="Signing in to Lead Management" message="Loading" />

      <div className="lc-login-bg-blue" aria-hidden="true" />

      <div className="lc-login-inner">
        <div className="lc-login-copy">
          <div className="lc-login-brand">
            <p className="lc-login-brand-name">XpertIntern</p>
            <p className="lc-login-brand-sub">Lead Management System</p>
          </div>
          <p className="lc-login-kicker">Role-based workspaces</p>
          <h1 className="lc-login-headline">Choose your calling workspace</h1>
          <p className="lc-login-lead">
            Each dashboard shows only the lead data, actions and recordings permitted for that role.
            Sign in with your welcome email — Manager or Agent workspace opens automatically.
          </p>
        </div>

        <div className="lc-login-white">
          <div className="lc-login-form-card">
            <p className="lc-login-form-kicker">Lead Management sign in</p>
            <h2 className="lc-login-form-title">{formTitle}</h2>

            <form onSubmit={handleSubmit} className="lc-login-form">
              <div>
                <label htmlFor="lc-email" className="lc-login-label">Work email</label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="lc-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@xpertintern.com"
                    className="lc-login-input"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="lc-password" className="lc-login-label">Password</label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="lc-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="lc-login-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading} className="lc-login-submit">
                {loading ? 'Signing in…' : 'Login'}
              </button>
            </form>

            <p className="lc-login-footer-links lc-login-footer-links--single">
              <Link to="/forgot-password">Forgot password?</Link>
            </p>

            {isDev && roleHint && (
              <div className="lc-login-dev-test">
                <p className="text-xs text-slate-500">Local testing only</p>
                <button
                  type="button"
                  onClick={() => enterTestDashboard(roleHint)}
                  className="mt-2 w-full rounded-lg border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Preview {roleHint} dashboard (no API)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
