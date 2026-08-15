import React from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { MapPin, Globe, Zap, Map, Clock, BarChart2, Layers, FileText, ChevronLeft, ChevronRight, ArrowLeft, Radio } from 'lucide-react'

const items = [
  { to: '/overview', label: 'Overview', icon: MapPin },
  { to: '/sentiment', label: 'Sentiment', icon: Globe },
  { to: '/issues', label: 'Issues', icon: Zap },
  { to: '/location', label: 'Location', icon: Map },
  { to: '/timeline', label: 'Timeline', icon: Clock },
  { to: '/historical', label: 'Historical', icon: BarChart2 },
  { to: '/datascope', label: 'DataScope', icon: Layers },
  { to: '/fieldreports', label: 'Field Reports', icon: FileText },
]

export default function Sidebar({ collapsed, setCollapsed }: { collapsed?: boolean, setCollapsed?: (v:boolean)=>void }) {
  const location = useLocation()
  const search = location.search || ''
  const pathname = location.pathname || ''
  let prefix = pathname.split('/')[1] || ''
  // fallback to legacy `workspace` query param
  if (!prefix || (prefix !== 'votes' && prefix !== 'pulse')) {
    const ws = new URLSearchParams(location.search).get('workspace') || ''
    prefix = ws === 'candidate' || ws === 'votes' ? 'votes' : (ws ? 'pulse' : '')
  }
  const base = prefix || 'pulse'
  const isVotes = base === 'votes'
  // strip workspace param from links to avoid duplication
  const params = new URLSearchParams(location.search)
  params.delete('workspace')
  const cleanSearch = params.toString() ? `?${params.toString()}` : ''

  // `collapsed` is controlled by parent `DashboardLayout` (if provided).
  // Persist to localStorage when parent provides the state and setter.
  React.useEffect(() => {
    try { if (typeof collapsed !== 'undefined') localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0') } catch (e) {}
  }, [collapsed])

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : 'expanded'}`}>
      <div className={`brand ${isVotes ? 'votes' : ''}`}>
        <div className="brand-mark"><Radio size={18} /></div>
        <div>
          <strong>{isVotes ? 'VOTES' : 'PULSE'}</strong>
          <small>Sentiment Dashboard</small>
        </div>
      </div>

      {/* Sidebar toggle moved to page content; remove duplicate control here */}

      <div className="sidebar-back">
        <Link to="/" className="back-link">Back to PULSE Portal</Link>
      </div>

      <nav>
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={`/${base}${to}${cleanSearch}`}
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

      <div className="sidebar-foot">
        <div style={{ 
            display: collapsed ? 'none' : 'block',
         }}>
            <div className="status-dot" />
          <strong>PULSE</strong>
          <small>Built by FWDP</small>
        </div>
        <div className="avatar">P</div>
      </div>
    </aside>
  )
}
