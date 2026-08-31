import React from 'react'
import { ArrowRight, LockKeyhole, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  getUserLicenseLabel,
  getUserLicenseTier,
  type TestUser,
  useAuth,
} from '../contexts/AuthContext'
import { LICENSE_TIERS } from '../config/licenseTiers'

export default function LoginPage() {
  const { user, testUsers, switchUser } = useAuth()
  const navigate = useNavigate()

  const destination = '/votes/overview'

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/60">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-600/20 text-blue-300">
            <LockKeyhole size={22} aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Sign in</div>
            <div className="text-2xl font-black tracking-tight">VOTES</div>
          </div>
        </div>

        <p className="mb-5 text-sm text-slate-300">Local &amp; Regional Sentiment Dashboard</p>

        <label className="mb-4 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Select user
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2">
            <UserRound size={16} className="text-slate-400" aria-hidden="true" />
            <select
              value={user?.id ?? testUsers[0].id}
              onChange={(event) => switchUser(event.target.value)}
              className="w-full bg-transparent pr-2 text-sm text-white outline-none"
            >
              {testUsers.map((candidate: TestUser) => (
                <option key={candidate.id} value={candidate.id} className="bg-slate-800 text-white">
                  {candidate.displayName} · {getUserLicenseLabel(candidate)}
                </option>
              ))}
            </select>
          </div>
        </label>

        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-sm text-slate-300">
          <div className="font-semibold text-white">{user?.displayName}</div>
          <div className="text-xs text-slate-400">{user?.email}</div>
          <div className="mt-2 text-xs font-semibold tracking-wide text-amber-300">
            {getUserLicenseLabel(user)}
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-400">
            {LICENSE_TIERS[getUserLicenseTier(user)].description}
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate(destination)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold transition hover:bg-blue-500"
        >
          Continue to VOTES
          <ArrowRight size={16} aria-hidden="true" />
        </button>

      </div>
    </div>
  )
}
