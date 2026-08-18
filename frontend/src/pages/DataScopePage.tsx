import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Info,
} from 'lucide-react'

import PageShell from '../components/PageShell'
import { getCoverageLabel, useAuth } from '../contexts/AuthContext'
import { useDashboard } from '../hooks/useDashboard'

const SOURCE_COLORS = ['#3b82f6', '#10b981', '#06b6d4', '#f59e0b', '#8b5cf6']

const IN_SCOPE = [
  'Social-media listening from public sources',
  'News and media monitoring',
  'Online forum and discussion analysis',
  'Sentiment scoring and topic classification',
  'PSGC region, province, district, city, and municipality exploration',
  'Historical reference data and simulated trends',
  'Static dashboard with interactive exploration',
  'Data limitations and confidence notes',
]

const OUT_OF_SCOPE = [
  'Live or real-time data ingestion',
  'Field-team survey submissions',
  'Direct community surveying by deployed personnel',
  'Production-grade real-time operational monitoring',
  'Private, restricted, or proprietary datasets',
  'Guaranteed representativeness of the voting population',
  'Guaranteed historical continuity across every source',
]

const LIMITATIONS = [
  'Online discussion volume is not equivalent to public-opinion polling and may overrepresent highly active communities.',
  'Public-source monitoring excludes private posts, closed groups, direct messages, and offline conversations.',
  'Automated sentiment may not fully capture sarcasm, nuance, regional language, or Filipino–English code-switching.',
  'Geographic attribution depends on available location signals and should be treated as directional.',
  'Historical events, election figures, mention totals, and sentiment values shown in this prototype are illustrative placeholders.',
  'Administrative PSGC boundaries and electoral districts are different systems with different effective dates.',
  'Every production metric should retain its source, sample period, methodology, and uncertainty notes.',
]

const NEXT_PHASE = [
  'Field-team survey submission tools',
  'Structured community-input forms',
  'Real-time sentiment dashboard',
  'Live location-based monitoring',
  'Ground-truth validation of online signals',
  'Continuous decision-support platform',
]

export default function DataScopePage() {
  const { user } = useAuth()
  const search = new URLSearchParams(window.location.search)
  const workspace = (search.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'
  const end = new Date().toISOString().slice(0, 19)
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19)
  const { data } = useDashboard(start, end)
  const totalMentions = data.sources.reduce((total, source) => total + source.mentions, 0)

  return (
    <PageShell
      title="Data & Scope"
      subtitle={candidate ? 'Candidate workspace · Ramon de la Cruz' : getCoverageLabel(user)}
    >
      <div className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <header className="flex items-start gap-3">
            <BookOpen size={20} className="mt-0.5 shrink-0 text-slate-800" />
            <div>
              <h2 className="text-sm font-bold text-slate-800">Project Scope Summary</h2>
              <p className="mt-1 text-xs text-slate-500">What this dashboard represents and how it was built</p>
            </div>
          </header>

          <dl className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              ['Type', 'One-time research exercise and interactive prototype'],
              ['Dashboard type', 'Static research data — not a live feed. UI/UX simulation with illustrative placeholder data.'],
              ['Coverage period', 'May 2022 – March 2026'],
              ['Total data points', `${totalMentions.toLocaleString()} illustrative mentions`],
              ['Geography', 'Philippines — national, island group, region, province, NCR district, city, and municipality'],
              ['Focus', 'Public sentiment, recurring themes, location patterns, timelines, and historical context'],
            ].map(([term, description]) => (
              <div key={term} className="rounded-lg bg-slate-50 p-3">
                <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{term}</dt>
                <dd className="mt-1 text-sm leading-5 text-slate-600">{description}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800">Data Sources Used</h2>
          <div className="mt-4 space-y-3">
            {data.sources.map((source, index) => {
              const percentage = totalMentions === 0
                ? 0
                : (source.mentions / totalMentions) * 100

              return (
                <article key={source.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-slate-200 p-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: SOURCE_COLORS[index % SOURCE_COLORS.length] }} />
                  <p className="text-sm font-medium text-slate-700">{source.name}</p>
                  <div className="grid min-w-40 grid-cols-[auto_96px] items-center gap-4 text-right">
                    <div>
                      <strong className="block text-sm tabular-nums text-slate-800">{source.mentions.toLocaleString()}</strong>
                      <span className="text-[11px] text-slate-500">{percentage.toFixed(1)}% of total</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: SOURCE_COLORS[index % SOURCE_COLORS.length] }} />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ScopeList title="In Scope (This Phase)" items={IN_SCOPE} variant="in" />
          <ScopeList title="Out of Scope (This Phase)" items={OUT_OF_SCOPE} variant="out" />
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <header className="flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-700" />
            <div>
              <h2 className="text-sm font-bold text-slate-800">Data Limitations &amp; Coverage Notes</h2>
              <p className="mt-1 text-xs text-slate-500">Important considerations for interpreting findings</p>
            </div>
          </header>
          <ol className="mt-4 divide-y divide-slate-100">
            {LIMITATIONS.map((limitation, index) => (
              <li key={limitation} className="flex gap-3 py-3 text-sm leading-6 text-slate-600">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-700">{index + 1}</span>
                {limitation}
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-blue-900">Possible Next Phase: Real-Time Ground Intelligence</h2>
          <p className="mt-2 text-sm leading-6 text-blue-800">
            A separately scoped build could add field submissions and real-time operations while retaining the public-source research context established in this prototype.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {NEXT_PHASE.map(item => (
              <div key={item} className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs font-medium text-blue-800">
                <ArrowRight size={13} className="shrink-0" />
                {item}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs italic text-blue-700">Future work is subject to separate scoping, technical design, privacy review, and resource planning.</p>
        </section>
      </div>
    </PageShell>
  )
}

function ScopeList({
  title,
  items,
  variant,
}: {
  title: string
  items: string[]
  variant: 'in' | 'out'
}) {
  const Icon = variant === 'in' ? CheckCircle2 : Info

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <Icon size={17} className={variant === 'in' ? 'text-green-700' : 'text-slate-700'} />
        {title}
      </h2>
      <ul className="mt-4 space-y-3">
        {items.map(item => (
          <li key={item} className="flex gap-3 text-sm leading-5 text-slate-600">
            <span className={variant === 'in' ? 'font-bold text-green-700' : 'text-slate-400'}>
              {variant === 'in' ? '✓' : '–'}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}
