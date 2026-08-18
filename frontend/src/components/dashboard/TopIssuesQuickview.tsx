import {
  CircleDot,
  GraduationCap,
  HeartPulse,
  Landmark,
  Leaf,
  Minus,
  Shield,
  Sprout,
  TrendingDown,
  TrendingUp,
  Waves,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { IssueTrend, QuickIssue } from "../../types/dashboard";

interface TopIssuesQuickViewProps {
  data: QuickIssue[];
}

const ISSUE_ICONS: Record<string, LucideIcon> = {
  infrastructure: Wrench,
  agriculture: Sprout,
  health: HeartPulse,
  education: GraduationCap,
  flooding: Waves,
  safety: Shield,
  tourism: Landmark,
  environment: Leaf,
  topic: CircleDot,
};

function TrendIndicator({ trend }: { trend: IssueTrend }) {
  switch (trend) {
    case 'up':
      return <TrendingUp size={14} className="shrink-0 text-orange-500" />
    case 'down':
      return <TrendingDown size={14} className="shrink-0 text-green-600" />
    default:
      return <Minus size={14} className="shrink-0 text-slate-400" />
  }
}

export default function TopIssuesQuickView({ data }: TopIssuesQuickViewProps) {
  if (!data.length) {
    return (
      <div className="border-t border-slate-200 pt-4">
        <h4 className="mb-3 text-sm font-bold text-slate-700">Top Issues — Quick View</h4>
        <div className="py-4 text-sm text-slate-500">No issue data available.</div>
      </div>
    )
  }

  const total = data.reduce((sum, issue) => sum + issue.mentions, 0)

  return (
    <div className="border-t border-slate-200 pt-4">
      <h4 className="mb-3 text-sm font-bold text-slate-700">Top Issues — Quick View</h4>
      <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        {data.map((issue) => {
          const Icon = ISSUE_ICONS[issue.id] ?? CircleDot
          const share = total > 0 ? (issue.mentions / total) * 100 : 0

          return (
            <div key={issue.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <Icon size={14} className="shrink-0 text-slate-600" />
                <span className="truncate text-xs text-slate-600">{issue.name}</span>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span className="font-semibold text-slate-700">{issue.mentions.toLocaleString()}</span>
                <span>{share.toFixed(1)}%</span>
                <TrendIndicator trend={issue.trend} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}