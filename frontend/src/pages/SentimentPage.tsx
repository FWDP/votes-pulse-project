import React from 'react'
import { Stacked, topics, GeographyControls } from './shared'
import PageShell from '../components/PageShell'

function SentimentContent({ candidate }: { candidate: boolean }) {
  return (
    <>
      <div className="demo-sentiment-kpis">
        <article>
          <strong>{candidate ? 28 : 26}%</strong>
          <span>Positive sentiment</span>
        </article>
        <article>
          <strong>{candidate ? 32 : 46}%</strong>
          <span>Neutral sentiment</span>
        </article>
        <article>
          <strong>{candidate ? 40 : 28}%</strong>
          <span>Negative sentiment</span>
        </article>
      </div>
      <section>
        <h3>Sentiment by topic</h3>
        {topics.map(([label, value], index) => (
          <div className="demo-topic" key={label}>
            <strong>{label}</strong>
            <Stacked positive={Math.max(12, 42 - index * 4)} neutral={Number(value) % 31 + 25} negative={Math.min(58, 28 + index * 5)} />
          </div>
        ))}
      </section>
      <div className="demo-two-col">
        <section>
          <h3>Positive vs negative radar</h3>
          <div className="demo-radar"><i /><i /><i /><span>Trust</span><span>Economy</span><span>Services</span><span>Leadership</span></div>
        </section>
        <section>
          <h3>Sentiment drivers</h3>
          {topics.slice(0, 6).map(([label], index) => (
            <div className="demo-driver" key={label}>
              <i className={index < 3 ? 'positive' : 'negative'} />
              <span>{label}</span>
              <strong>{index < 3 ? '+' : '-'}{18 - index * 2}%</strong>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}

export default function SentimentPage() {
  const search = new URLSearchParams(window.location.search)
  const workspace = (search.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'

  return (
    <PageShell title="Sentiment Analysis" subtitle={candidate ? 'Candidate workspace · Ramon de la Cruz' : 'National Pulse'}>
      <div className="space-y-4">
        <div className="flex justify-end"><select aria-label="Date range"><option>Last 30 days</option><option>Last 90 days</option><option>Election period</option></select></div>
        <GeographyControls />
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <SentimentContent candidate={candidate} />
        </div>
      </div>
    </PageShell>
  )
}
