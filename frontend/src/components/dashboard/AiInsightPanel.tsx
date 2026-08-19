import { useMemo, useState } from 'react'
import { Bot, Send, Sparkles, Wand2 } from 'lucide-react'

export type AiInsightTopic = {
  name: string
  mentions?: number
  positive?: number
  neutral?: number
  negative?: number
}

export type AiInsightCard = {
  title: string
  description: string
}

export type AiInsightContext = {
  coverageLabel: string
  periodLabel?: string
  sentiment?: {
    positive: number
    neutral: number
    negative: number
  }
  topics?: AiInsightTopic[]
  insights?: AiInsightCard[]
}

const SAMPLE_PROMPTS = [
  'Explain the strongest sentiment pattern in this coverage.',
  'What should we act on first based on the current issues?',
  'Why is sentiment trending negative right now?',
  'Summarize the most important findings in one brief update.',
  'Give me a concise executive summary and next steps.',
]

const DEFAULT_LOCATION_PROMPTS = [
  'What is driving sentiment in this area right now?',
  'Which local issues need attention first?',
  'How does this location compare with nearby coverage?',
  'Give me a plain-language summary for leadership and field teams.',
]

const getDominantMood = (sentiment?: AiInsightContext['sentiment']) => {
  if (!sentiment) return 'mixed'

  if (sentiment.negative >= Math.max(sentiment.positive, sentiment.neutral)) return 'negative'
  if (sentiment.positive >= Math.max(sentiment.neutral, sentiment.negative)) return 'positive'
  return 'neutral'
}

const formatMoodLabel = (value: string) => {
  if (value === 'negative') return 'negative'
  if (value === 'positive') return 'positive'
  return 'balanced'
}

const buildInsightResponse = (context: AiInsightContext, prompt: string) => {
  const topicList = context.topics ?? []
  const strongestTopic = topicList.reduce<AiInsightTopic | undefined>((current, candidate) => {
    const currentMentions = current?.mentions ?? 0
    const candidateMentions = candidate.mentions ?? 0
    return candidateMentions > currentMentions ? candidate : current
  }, undefined)

  const dominantMood = getDominantMood(context.sentiment)
  const strongIssue = strongestTopic?.name ?? 'the leading local issue'
  const trendSummary = dominantMood === 'negative'
    ? 'requires immediate attention'
    : dominantMood === 'positive'
      ? 'is improving and should be sustained'
      : 'needs monitoring to confirm the direction'

  const normalizedPrompt = prompt.toLowerCase()

  const quickSummary = normalizedPrompt.includes('action') || normalizedPrompt.includes('act') || normalizedPrompt.includes('priority')
    ? `The most actionable focus for ${context.coverageLabel} is ${strongIssue}. The current dashboard suggests this issue is driving most of the engagement and should be prioritized before secondary trends.`
    : normalizedPrompt.includes('why') || normalizedPrompt.includes('driver')
      ? `The current pattern is being driven by ${strongIssue}, which has the highest volume and the largest share of negative sentiment over the selected period.`
      : normalizedPrompt.includes('summarize') || normalizedPrompt.includes('brief') || normalizedPrompt.includes('executive')
        ? `Across ${context.coverageLabel}, the key story is that ${strongIssue} remains the dominant driver of discussion while the overall mood is ${formatMoodLabel(dominantMood)}. This suggests the issue is shaping public perception and deserves focused monitoring.`
        : `In ${context.coverageLabel}, the strongest signal is ${strongIssue}. The current sentiment mix is ${formatMoodLabel(dominantMood)}, and the recent pattern suggests ${trendSummary}.`

  const findings = [
    `${strongIssue} is the most active theme in the selected scope and should be treated as the main driver of the current pattern.`,
    context.sentiment
      ? `Sentiment currently sits at ${context.sentiment.positive}% positive, ${context.sentiment.neutral}% neutral, and ${context.sentiment.negative}% negative across the selected period.`
      : 'The current coverage shows a balanced but active public discussion pattern.',
    context.insights?.[0]
      ? `The strongest operational cue is: ${context.insights[0].title}.`
      : 'Most attention should remain on the highest-volume issue group identified in the dashboard.',
  ]

  const actions = [
    `Prioritize ${strongIssue} in the next reporting cycle and validate whether it is improving, spreading, or becoming more urgent.`,
    'Compare the current signal with the prior reporting period to determine whether this is a sustained shift or a short-lived spike.',
    'Prepare a concise response or follow-up plan for the affected area so local teams can act quickly based on the current trend.',
  ]

  return {
    summary: quickSummary,
    findings,
    actions,
  }
}

export default function AiInsightPanel({
  title = 'AI Insight Assistant',
  context,
  prompts,
}: {
  title?: string
  context: AiInsightContext
  prompts?: string[]
}) {
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState<ReturnType<typeof buildInsightResponse> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const promptOptions = prompts && prompts.length > 0 ? prompts : SAMPLE_PROMPTS

  const defaultPrompt = useMemo(() => {
    return `Explain the strongest sentiment pattern in ${context.coverageLabel}.`
  }, [context.coverageLabel])

  const handleSubmit = () => {
    const nextPrompt = prompt.trim() || defaultPrompt
    setIsLoading(true)

    window.setTimeout(() => {
      setResponse(buildInsightResponse(context, nextPrompt))
      setIsLoading(false)
    }, 450)
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Bot size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">{title}</h2>
            <p className="text-[11px] text-slate-500">Grounded in the current coverage context</p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700">
          <Wand2 size={11} />
          AI
        </span>
      </header>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          {promptOptions.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setPrompt(item)}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Coverage context</span>
            <span className="text-[11px] text-slate-500">{context.periodLabel ?? 'Selected period'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-700">{context.coverageLabel}</span>
            {context.sentiment && (
              <>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{context.sentiment.positive}% positive</span>
                <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-700">{context.sentiment.neutral}% neutral</span>
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">{context.sentiment.negative}% negative</span>
              </>
            )}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Ask about this view</span>
          <textarea
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            rows={3}
            placeholder={defaultPrompt}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isLoading}
          >
            <Send size={14} />
            {isLoading ? 'Thinking…' : 'Generate insight'}
          </button>
        </div>

        {response && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700">
              <Sparkles size={12} />
              AI summary
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{response.summary}</p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Key findings</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  {response.findings.map(item => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Recommended action</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  {response.actions.map(item => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
