import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Sidebar from '../components/Sidebar'

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('adminSidebarCollapsed') === '1'
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
    try { localStorage.setItem('adminSidebarCollapsed', collapsed ? '1' : '0') } catch (e) { }

    try {
      if (root) (root as HTMLElement).style.setProperty('--sidebar-width', collapsed ? '80px' : '246px')
    } catch (e) { }
  }, [collapsed])

  return (
    <div className="app-shell theme-votes">
      <Sidebar variant="admin" collapsed={collapsed} setCollapsed={setCollapsed} />
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
