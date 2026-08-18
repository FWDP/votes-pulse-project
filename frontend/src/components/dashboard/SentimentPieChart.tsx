import {
  Pie,
  PieChart,
  PieSectorShapeProps,
  ResponsiveContainer,
  Sector,
  Tooltip,
} from "recharts";

import type { SentimentItem } from "../../types/dashboard";

interface SentimentPieChartProps {
  data: SentimentItem[];
}

const sentimentColors: Record<string, string> = {
  Positive: "#22c55e",
  Neutral: "#94a3b8",
  Negative: "#ef4444",
};

const renderSector = (props: PieSectorShapeProps) => {
  return <Sector {...props} fill={sentimentColors[props.name ?? ""] ?? defaultColor} key={props.name} />
}

const defaultColor = "#64748b";

export default function SentimentPieChart({
  data,
}: SentimentPieChartProps) {

  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-slate-500">
        No sentiment data available
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="mb-4">
        <h3 className="font-bold text-slate-800">
          Overall Sentiment Distribution
        </h3>

        <p className="text-sm text-slate-500">
          All topics, all locations, full period
        </p>
      </div>

      <div className="h-[200px]">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <PieChart>
            <Pie
              data={data}
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
              formatter={(value) => [
                `${value}%`,
                "Percentage",
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {data.map((item) => {
          const color =
            sentimentColors[item.name] ??
            "#64748b";

          return (
            <div
              key={item.name}
              className="text-center"
            >
              <div className="mb-3 flex items-center justify-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      color,
                  }}
                />

                <span
                  className="text-sm"
                  style={{
                    color,
                  }}
                >
                  {item.name}
                </span>
              </div>

              <div
                className="text-xl font-bold"
                style={{
                  color,
                }}
              >
                {Math.round(
                  item.value,
                )}
                %
              </div>

              <div className="text-xs text-slate-500">
                {item.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}