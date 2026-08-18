import {
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
} from "recharts";

import type { SentimentItem } from "../../types/dashboard";
import { sentimentColors as sharedSentimentColors, defaultColor } from '../../theme/colors'
import { useMemo } from 'react'
import { useDashboard } from '../../hooks/useDashboard'

interface SentimentPieChartProps {
  data: SentimentItem[];
}

const renderSector = (props: any) => {
  return <Sector {...props} fill={sharedSentimentColors[props.name?.toLowerCase()] ?? defaultColor} key={props.name} />
}

export default function SentimentPieChart({ data }: SentimentPieChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-slate-500">
        No sentiment data available
      </div>
    );
  }

  // derive estimated counts from dashboard totalMentions when available
  const slices = useMemo(() => data.map(item => ({
    ...item,
    key: item.name,
    color: sharedSentimentColors[item.name.toLowerCase()] ?? defaultColor,
  })), [data])

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5" role="region" aria-label="Overall sentiment distribution">
      <div className="mb-4">
        <h3 className="font-bold text-slate-800">Overall Sentiment Distribution</h3>
        <p className="text-sm text-slate-500">All topics, all locations, full period</p>
      </div>

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={2}
              stroke="white"
              strokeWidth={2}
              shape={renderSector}
            />

            <Tooltip
              formatter={(value: number, name: string, props: any) => {
                const pct = `${Math.round(value)}%`
                const total = props && props.payload && props.payload.totalMentions
                const count = total ? ` — ${Math.round((value / 100) * total).toLocaleString()} mentions` : ''
                return [`${pct}${count}`, name]
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-2" aria-hidden>
        {slices.map((item) => (
          <div key={item.key} className="text-center">
            <div className="mb-3 flex items-center justify-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-sm" style={{ color: item.color }}>{item.name}</span>
            </div>

            <div className="text-xl font-bold" style={{ color: item.color }}>{Math.round(item.value)}%</div>

            <div className="text-xs text-slate-500">{item.name}</div>
          </div>
        ))}
      </div>

      <div className="sr-only" aria-live="polite">
        {slices.map(s => `${s.name}: ${Math.round(s.value)}%`).join('. ')}
      </div>
    </div>
  )
}