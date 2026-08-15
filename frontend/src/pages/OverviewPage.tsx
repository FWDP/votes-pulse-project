import OverviewContent from '../components/OverviewContent'

export default function OverviewPage() {
  let newDate = new Date();
  let month = newDate.toLocaleString('default', { month: 'long' });
  let year = newDate.getFullYear();

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold">Overview</h1>
            <div className="text-sm text-slate-500">Summary of research findings across </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500">Data as of {month} {year}</div>
          <p className="bg-amber-50 text-amber-800 px-3 py-1 rounded-full text-xs">Simulation — Placeholder Data</p>
        </div>
      </header>

      <main className="flex-1 overflow-auto mt-0">
        <div className="p-4 sm:p-6 sm:space-y-6 fade-in">
          <OverviewContent />
        </div>
      </main>
    </div>
  )
}
