import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function AdminControls() {
  const { user } = useAuth()
  const navigate = useNavigate()

  if (!user || !(user as any).isSuperadmin) return null

  return (
    <div className="admin-controls flex items-center gap-2">
      <button onClick={() => navigate('/admin/sessions')} className="text-xs rounded bg-white/5 px-2 py-1">Sessions</button>
      <button onClick={() => navigate('/admin/exports')} className="text-xs rounded bg-white/5 px-2 py-1">Exports</button>
    </div>
  )
}
