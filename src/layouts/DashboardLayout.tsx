import React, { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function DashboardLayout() {
  const location = useLocation()
  const pathname = location.pathname || ''
  // determine theme from path prefix: /votes/* or /pulse/*
  const prefix = pathname.split('/')[1] || ''
  const themeClass = prefix === 'votes' ? 'theme-votes' : 'theme-pulse'

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
    try { localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0') } catch (e) {}
  }, [collapsed])

  return (
    <div className={`app-shell ${themeClass}`}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className="page">
        <button
          className="content-toggle"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
          onClick={() => setCollapsed(s => !s)}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <Outlet />
      </main>
    </div>
  )
}
