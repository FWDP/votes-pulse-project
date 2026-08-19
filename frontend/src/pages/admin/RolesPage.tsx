import React from 'react'

const roles = [
  {
    name: 'Owner',
    summary: 'Full platform access and tenant management.',
    permissions: ['Manage users', 'Configure tenant', 'Approve exports'],
  },
  {
    name: 'Administrator',
    summary: 'Can manage team access and content operations.',
    permissions: ['Manage roles', 'Edit dashboards', 'Access reports'],
  },
  {
    name: 'Member',
    summary: 'Operational access with reporting and view permissions.',
    permissions: ['View dashboards', 'Submit reports', 'Read exports'],
  },
]

export default function RolesPage() {
  return (
    <div className="p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Administration</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">Roles</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {roles.map((role) => (
          <div key={role.name} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-800">{role.name}</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                Active
              </span>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600">{role.summary}</p>

            <ul className="mt-4 space-y-2">
              {role.permissions.map((permission) => (
                <li key={permission} className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  {permission}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
