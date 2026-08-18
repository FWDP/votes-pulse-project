import React from 'react'

const superadmins = [
  { id: 'user-superadmin-local', displayName: 'Super Admin', email: 'superadmin@example.test' },
]

export default function SuperadminsPage() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-bold">Superadmins</h2>
      <ul className="mt-4 space-y-3">
        {superadmins.map((user) => (
          <li key={user.id} className="rounded border border-slate-200 bg-white p-3">
            <div className="text-sm font-semibold text-slate-800">{user.displayName}</div>
            <div className="text-xs text-slate-500">{user.email}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
