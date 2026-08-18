import React from 'react'
import { ArrowRight, LockKeyhole, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage({ product }: { product: 'votes' | 'pulse' }) {
  const { user, testUsers, switchUser } = useAuth()
  const navigate = useNavigate()

  const title = product === 'votes' ? 'VOTES' : 'PULSE'
  const subtitle = product === 'votes'
    ? 'Local & Regional Sentiment Dashboard'
    : 'Philippines National Dashboard'
  const destination = product === 'votes' ? '/votes/overview' : '/pulse/overview'

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/60">
        <div className="mb-5 flex items-center gap-3">
          <div className={`grid h-12 w-12 place-items-center rounded-xl ${product === 'votes' ? 'bg-blue-600/20 text-blue-300' : 'bg-emerald-600/20 text-emerald-300'}`}>
            <LockKeyhole size={22} aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Sign in</div>
            <div className="text-2xl font-black tracking-tight">{title}</div>
          </div>
        </div>

        <p className="mb-5 text-sm text-slate-300">{subtitle}</p>

        <label className="mb-4 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Select user
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2">
            <UserRound size={16} className="text-slate-400" aria-hidden="true" />
            <select
              value={user?.id ?? testUsers[0].id}
              onChange={(event) => switchUser(event.target.value)}
              className="w-full bg-transparent pr-2 text-sm text-white outline-none"
            >
              {testUsers.map((candidate) => (
                <option key={candidate.id} value={candidate.id} className="bg-slate-800 text-white">
                  {candidate.displayName} · {candidate.homeLocation}
                </option>
              ))}
            </select>
          </div>
        </label>

        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-sm text-slate-300">
          <div className="font-semibold text-white">{user?.displayName}</div>
          <div className="text-xs text-slate-400">{user?.email}</div>
        </div>

        <button
          type="button"
          onClick={() => navigate(destination)}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${product === 'votes' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
        >
          Continue to {title}
          <ArrowRight size={16} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-3 w-full rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          Back to VOTES-PULSE prompt
        </button>
      </div>
    </div>
  )
}
