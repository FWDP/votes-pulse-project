import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sidebarCollapsed') === '1'
    } catch (e) {
      return false
    }
  })

  useEffect(() => {
    const root = document.querySelector('.app-shell')
    if (root) {
      if (collapsed) root.classList.add('collapsed')
      else root.classList.remove('collapsed')
    }
    try { localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0') } catch (e) { }

    // Also set the CSS variable on the app-shell element to force grid/aside recalculation
    try {
      if (root) (root as HTMLElement).style.setProperty('--sidebar-width', collapsed ? '80px' : '246px')
    } catch (e) { }

  }, [collapsed])

  return (
    <div className="app-shell theme-votes">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className="flex-1 overflow-auto page">
        <button
          className="content-toggle text-slate-300 bg-slate-700"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
          onClick={() => setCollapsed(s => !s)}
          style={{
            transform: collapsed ? 'rotate(180deg)' : 'none',
            left: collapsed ? 'calc(80px - 20px)' : 'calc(var(--sidebar-width) - 20px)',
            top: '50px',
          }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <Outlet />
      </main>
    </div>
  )
}
