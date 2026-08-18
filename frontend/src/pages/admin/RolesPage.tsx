import React from 'react'

export default function RolesPage() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-bold">Roles</h2>
      <div className="mt-4 rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Tenant admin controls</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Owner</li>
          <li>Administrator</li>
          <li>Member</li>
        </ul>
      </div>
    </div>
  )
}
