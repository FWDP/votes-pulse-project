import React from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { MapPin, Globe, Zap, Map, Clock, BarChart2, Database, FileText, ChevronRight, Radio, Lightbulb, LogOut, UserRound } from 'lucide-react'
import { preloadRoute } from '../routeLoaders'
import { useTenantWorkspace } from '../contexts/TenantWorkspaceContext'
import { useAuth } from '../contexts/AuthContext'
import type { WorkspaceFeature } from '../types/tenancy'
import WorkspaceSelector from './WorkspaceSelector'

const items: Array<{ to: string; label: string; icon: typeof MapPin; feature: WorkspaceFeature }> = [
  { to: '/overview', label: 'Overview', icon: MapPin, feature: 'overview' },
  { to: '/sentiment', label: 'Sentiment', icon: Globe, feature: 'sentiment' },
  { to: '/issues', label: 'Issues', icon: Zap, feature: 'issues' },
  { to: '/location', label: 'Location', icon: Map, feature: 'location' },
  { to: '/timeline', label: 'Timeline', icon: Clock, feature: 'timeline' },
  { to: '/historical', label: 'Historical', icon: BarChart2, feature: 'historical' },
  { to: '/insights', label: 'Key Insights', icon: Lightbulb, feature: 'insights' },
  { to: '/datascope', label: 'Data & Scope', icon: Database, feature: 'datascope' },
  { to: '/fieldreports', label: 'Field Reports', icon: FileText, feature: 'fieldreports' },
]

export default function Sidebar({ collapsed }: { collapsed?: boolean, setCollapsed?: (v: boolean) => void }) {
  const { tenant, workspace, basePath } = useTenantWorkspace()
  const { user, accessibleWorkspaces, membershipForTenant, signOut } = useAuth()
  const navigate = useNavigate()
  const isVotes = workspace.product === 'votes'
  const membership = membershipForTenant(tenant.id)

  // `collapsed` is controlled by parent `DashboardLayout` (if provided).
  // Persist to localStorage when parent provides the state and setter.
  React.useEffect(() => {
    try { if (typeof collapsed !== 'undefined') localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0') } catch (e) { }
  }, [collapsed])

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : 'expanded'} bg-slate-900`}>
      <div className="sidebar-back">
        <Link to="/login" className="back-link">Back to PULSE Portal</Link>
      </div>
      <div className={`brand ${isVotes ? 'votes' : ''}`} title={`${tenant.name} · ${workspace.name}`}>
        <div className="brand-mark"><Radio size={18} /></div>
        <div>
          <strong>{isVotes ? 'VOTES' : 'PULSE'}</strong>
          <small>{workspace.name}</small>
        </div>
      </div>
      <nav>
        {items.filter(item => workspace.enabledFeatures.includes(item.feature)).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={`${basePath}${to}`}
            onFocus={() => {
              void preloadRoute(to).catch(() => undefined)
            }}
            onPointerEnter={() => {
              void preloadRoute(to).catch(() => undefined)
            }}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={label}
          >
            {({ isActive }) => (
              <>
                <Icon size={16} />
                <span aria-hidden={!!collapsed}>{label}</span>
                {isActive && !collapsed && <ChevronRight size={16} className="nav-chev" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      {(membership?.role === 'owner' || (user as any)?.isSuperadmin) && (
        <div className="mt-3 border-t border-white/10 pt-2">
          {!collapsed && (
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Admin
            </div>
          )}
          <nav className="space-y-1">
            <NavLink to={`${basePath}/admin/roles`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Roles">
              <Database size={16} />
              <span>Roles</span>
            </NavLink>
            {(user as any)?.isSuperadmin && (
              <NavLink to={`/admin/superadmins`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Superadmins">
                <UserRound size={16} />
                <span>Superadmins</span>
              </NavLink>
            )}
          </nav>
        </div>
      )}
      <div className="mt-auto border-t border-white/15 pt-4">
        {collapsed ? (
          <button
            type="button"
            onClick={signOut}
            title={`Sign out ${user?.displayName ?? ''}`}
            aria-label="Sign out"
            className="mx-auto grid h-10 w-10 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={17} aria-hidden="true" />
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white"><UserRound size={17} aria-hidden="true" /></span>
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-white">{user?.displayName}</div>
                <div className="truncate text-[10px] capitalize text-slate-400">{membership?.role}</div>
              </div>
            </div>
            <WorkspaceSelector />
            <button type="button" onClick={() => { signOut(); navigate('/login') }} className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white">
              <LogOut size={14} aria-hidden="true" />Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
