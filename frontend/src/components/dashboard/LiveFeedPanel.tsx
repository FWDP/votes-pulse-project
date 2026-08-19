import type { LiveFeedItem } from '../../types/liveFeed'
import { placeholderLiveFeed } from '../../data/placeholderLiveFeed'

type LiveFeedPanelProps = {
  title?: string
  locationLabel?: string
  items?: LiveFeedItem[]
}

const sentimentStyles = {
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  neutral: 'border-amber-200 bg-amber-50 text-amber-700',
  negative: 'border-rose-200 bg-rose-50 text-rose-700',
} as const

const formatTime = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Now'

  return date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function LiveFeedPanel({
  title = 'Live Feed',
  locationLabel = 'Selected coverage',
  items = placeholderLiveFeed,
}: LiveFeedPanelProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="relative flex h-3 w-3 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800">{title}</h2>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
              LIVE
            </span>
          </div>
        </div>

        <div className="text-[11px] font-medium text-slate-500">{locationLabel}</div>
      </header>

      <div className="space-y-3 p-5">
        {items.slice(0, 4).map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 transition-colors hover:border-slate-300"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {formatTime(item.publishedAt)}
              </div>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${sentimentStyles[item.sentiment]}`}
              >
                {item.sentiment}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">{item.location}</span>
              <span aria-hidden="true">•</span>
              <span>{item.source}</span>
              <span aria-hidden="true">•</span>
              <span>{item.category}</span>
            </div>

            <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{item.text}</p>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                {item.isNew ? 'New' : 'Monitor'}
              </span>
              <span className="text-[11px] text-slate-500">Updated now</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
