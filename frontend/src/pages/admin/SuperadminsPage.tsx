import React, { useState } from 'react'
import {
  getUserLicenseLabel,
  type TestUser,
  useAuth,
} from '../../contexts/AuthContext'
import {
  LICENSE_TIERS,
  type LicenseTier,
} from '../../config/licenseTiers'

const emptyForm = {
  displayName: '',
  email: '',
  licenseTier: 'city-district-municipality' as LicenseTier,
  homeLocation: '',
  coverageScope: 'locality',
  regionCode: '',
  provinceCode: '',
  coverageCode: '',
}

export default function SuperadminsPage() {
  const { testUsers, switchUser, createTestUser } = useAuth()
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    const requiresAssignedArea = form.licenseTier !== 'national'
    if (
      !form.displayName.trim() ||
      !form.email.trim() ||
      (requiresAssignedArea && (
        !form.homeLocation.trim() ||
        !form.coverageCode.trim()
      ))
    ) {
      setMessage(requiresAssignedArea
        ? 'Please complete the name, email, license, coverage label, and PSGC code.'
        : 'Please complete the name and email.')
      return
    }

    const created = createTestUser({
      displayName: form.displayName,
      email: form.email,
      licenseTier: form.licenseTier,
      homeLocation: form.homeLocation,
      coverageScope: form.coverageScope as 'national' | 'province' | 'locality',
      regionCode: form.regionCode,
      provinceCode: form.provinceCode,
      coverageCode: form.coverageCode,
    })

    setMessage(
      `Created ${created.displayName} with a ${getUserLicenseLabel(created)} license.`,
    )
    setForm(emptyForm)
    switchUser(created.id)
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Administration</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">Superadmins</h2>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700">
            Managed users
          </div>
          <table className="min-w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">License</th>
                <th className="px-4 py-3 font-semibold">Coverage</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {testUsers.map((user: TestUser) => (
                <tr key={user.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{user.displayName}</div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold tracking-wide text-amber-800 ring-1 ring-inset ring-amber-200">
                      {getUserLicenseLabel(user)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{user.homeLocation ?? 'National'}</td>
                  <td className="px-4 py-3">
                    {!user.isSuperadmin && (
                      <button
                        type="button"
                        onClick={() => switchUser(user.id)}
                        className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Use user
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800">Create licensed user</h3>

          <div className="mt-4 space-y-4">
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Display name</span>
              <input
                value={form.displayName}
                onChange={event => setForm(current => ({ ...current, displayName: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 outline-none transition focus:border-blue-500 focus:bg-white"
                placeholder="e.g. Juan Dela Cruz"
              />
            </label>

            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 outline-none transition focus:border-blue-500 focus:bg-white"
                placeholder="juan@example.test"
              />
            </label>

            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">License tier</span>
              <select
                value={form.licenseTier}
                onChange={event => {
                  const licenseTier = event.target.value as LicenseTier
                  setForm(current => ({
                    ...current,
                    licenseTier,
                    coverageScope: licenseTier === 'national'
                      ? 'national'
                      : licenseTier === 'provincial-partylist'
                        ? 'province'
                        : 'locality',
                  }))
                }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 outline-none transition focus:border-blue-500 focus:bg-white"
              >
                {Object.entries(LICENSE_TIERS).map(([value, tier]) => (
                  <option key={value} value={value}>{tier.label}</option>
                ))}
              </select>
              <span className="mt-2 block text-xs leading-5 text-slate-500">
                {LICENSE_TIERS[form.licenseTier].description}
              </span>
            </label>

            {form.licenseTier !== 'national' && (<>
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Assigned area label</span>
              <input
                value={form.homeLocation}
                onChange={event => setForm(current => ({ ...current, homeLocation: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 outline-none transition focus:border-blue-500 focus:bg-white"
                placeholder="Marilao, Bulacan"
              />
            </label>

            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Coverage type</span>
              <select
                value={form.coverageScope}
                onChange={event => setForm(current => ({
                  ...current,
                  coverageScope: event.target.value as 'province' | 'locality',
                }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 outline-none transition focus:border-blue-500 focus:bg-white"
              >
                {form.licenseTier === 'provincial-partylist' ? (
                  <option value="province">Province / Party-list base</option>
                ) : (
                  <option value="locality">City / District / Municipality</option>
                )}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block font-medium">Region code</span>
                <input
                  value={form.regionCode}
                  onChange={event => setForm(current => ({ ...current, regionCode: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 outline-none transition focus:border-blue-500 focus:bg-white"
                  placeholder="0400000000"
                />
              </label>

              <label className="block text-sm text-slate-700">
                <span className="mb-1 block font-medium">Province code</span>
                <input
                  value={form.provinceCode}
                  onChange={event => setForm(current => ({ ...current, provinceCode: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 outline-none transition focus:border-blue-500 focus:bg-white"
                  placeholder="0301400000"
                />
              </label>
            </div>

            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Coverage PSGC code</span>
              <input
                value={form.coverageCode}
                onChange={event => setForm(current => ({ ...current, coverageCode: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 outline-none transition focus:border-blue-500 focus:bg-white"
                placeholder="0301411000"
              />
            </label>
            </>)}
          </div>

          {message && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Create licensed user
          </button>
        </form>
      </div>
    </div>
  )
}
