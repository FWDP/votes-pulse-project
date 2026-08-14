import React, { useEffect, useState } from 'react'
import { Star, MapPin, ArrowRight, Globe } from 'lucide-react'

type PulseAppProps = {
  onEnter?: (target: string) => void
}

export default function PulseApp({ onEnter }: PulseAppProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className={`relative min-h-screen flex flex-col items-center justify-center py-8 sm:py-12 transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}
    >
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-96 rounded-full opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)', filter: 'blur(60px)' }}
      />

      <div className={`relative z-10 flex flex-col items-center text-center px-4 sm:px-8 max-w-5xl w-full transition-all duration-700 ${
        visible ? 'translate-y-0' : 'translate-y-4'
      }`}>
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-2xl shadow-blue-900/60 mb-3 sm:mb-6" style={{ animation: 'pulse 3s ease-in-out infinite' }}>
          <Star size={28} className="text-white" />
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-none mb-2">PULSE</h1>
        <div className="text-blue-400 text-sm sm:text-base font-medium tracking-widest uppercase mb-1">Sentiment Intelligence Platform</div>
        <div className="text-slate-400 text-xs sm:text-sm mb-6 sm:mb-10">Public discourse monitoring & local governance intelligence · Philippines</div>
        <div className="w-16 h-0.5 bg-blue-600 rounded-full mb-6 sm:mb-10 opacity-60" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 w-full max-w-4xl mb-6 sm:mb-10">
          <button
            onClick={() => onEnter?.('votes')}
            className="group relative text-left rounded-2xl border border-slate-700 hover:border-blue-500 bg-slate-800/80 hover:bg-slate-800 p-6 sm:p-7 transition-all duration-200 hover:shadow-2xl hover:shadow-blue-900/40 hover:-translate-y-1 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  <MapPin size={22} className="text-blue-400" />
                </div>
                <div>
                  <div className="font-black text-white text-2xl tracking-wide leading-none">VOTES</div>
                  <div className="text-blue-400 text-xs font-semibold tracking-wider uppercase mt-0.5">Local & Regional Sentiment Dashboard</div>
                </div>
              </div>

              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-5">
                Multi-province intelligence covering Camarines Sur & Oriental Mindoro with multi-select filtering across 7 Congressional
                Districts, 52 Cities & Municipalities, candidates, and community census.
              </p>

              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6 p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 text-center">
                {[
                  ['23,073+', 'Data Points'],
                  ['52 LGUs', '2 Provinces'],
                  ['7 Districts', 'Multi-Select'],
                ].map(([val, lbl]) => (
                  <div key={String(lbl)}>
                    <div className="text-white font-bold text-sm sm:text-base">{val}</div>
                    <div className="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider mt-0.5">{lbl}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
              <div className="flex items-center gap-1.5 text-xs text-blue-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                CamSur · Mindoro · Multi-LGU
              </div>
              <div className="flex items-center gap-1.5 text-blue-400 text-sm font-bold group-hover:gap-2.5 transition-all">
                <span>Enter VOTES</span>
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </button>

          <button
            onClick={() => onEnter?.('pulse-ph')}
            className="group relative text-left rounded-2xl border border-slate-700 hover:border-emerald-500 bg-slate-800/80 hover:bg-slate-800 p-6 sm:p-7 transition-all duration-200 hover:shadow-2xl hover:shadow-emerald-900/40 hover:-translate-y-1 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
                  <Globe size={22} className="text-emerald-400" />
                </div>
                <div>
                  <div className="font-black text-white text-2xl tracking-wide leading-none">PULSE</div>
                  <div className="text-emerald-400 text-xs font-semibold tracking-wider uppercase mt-0.5">Philippines National Dashboard</div>
                </div>
              </div>

              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-5">
                Nationwide public sentiment across all 17 administrative regions — national issues, macroeconomic signals, legislation,
                politics, and cultural discourse.
              </p>

              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6 p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 text-center">
                {[
                  ['284,512', 'Data Points'],
                  ['17 Regions', 'Nationwide'],
                  ['47 mo.', 'Coverage'],
                ].map(([val, lbl]) => (
                  <div key={String(lbl)}>
                    <div className="text-white font-bold text-sm sm:text-base">{val}</div>
                    <div className="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider mt-0.5">{lbl}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
              <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                National · Regional · Multi-Source
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-bold group-hover:gap-2.5 transition-all">
                <span>Enter PULSE</span>
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
