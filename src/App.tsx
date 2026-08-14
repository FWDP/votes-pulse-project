import React, { useState } from 'react'
import PulseApp from './PulseApp'

export default function App() {
  const [view, setView] = useState<string | null>(null)

  if (view) {
    return (
      <div className="min-h-screen p-8">
        <button onClick={() => setView(null)} className="mb-4">
          Back
        </button>
        <h2 className="text-2xl font-bold">Entered: {view}</h2>
        <p className="mt-2 text-sm text-slate-400">Demo placeholder for the selected workspace.</p>
      </div>
    )
  }

  return <PulseApp onEnter={(target) => setView(target)} />
}
