import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { IssueItem } from "../../types/dashboard";

interface IssuesBarChartProps {
  data: IssueItem[];
}

export default function IssuesBarChart({
  data,
}: IssuesBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[380px] items-center justify-center 
      rounded-xl border border-slate-200 bg-white text-sm text-slate-500">
        No issue data available
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="mb-4">
        <h3 className="font-bold text-slate-800">
          Top Issues by Mention Volume
        </h3>

        <p className="text-sm text-slate-500">
          Total mentions across all data sources
        </p>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <BarChart
            data={data}
            layout="vertical"
            margin={{
              top: 5,
              right: 20,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="#e2e8f0"
            />

            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{
                fontSize: 12,
                fill: "#64748b",
              }}
            />

            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tickLine={false}
              axisLine={false}
              tick={{
                fontSize: 11,
                fill: "#64748b",
              }}
            />

            <Tooltip
              formatter={(value) => [
                Number(value).toLocaleString(),
                "Mentions",
              ]}
            />

            <Bar
              dataKey="mentions"
              fill="#3b82f6"
              radius={[0, 4, 4, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}