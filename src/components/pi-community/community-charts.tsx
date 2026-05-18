"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BAR_FILL = "#2563eb";

export function CommunityBarChart({
  title,
  data,
  emptyMessage,
}: {
  title: string;
  data: { name: string; count: number }[];
  emptyMessage: string;
}) {
  if (!data.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-3 text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  const chartData = [...data].reverse().map((d) => ({
    ...d,
    label:
      d.name.length > 48 ? `${d.name.slice(0, 46)}…` : d.name,
  }));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 h-80 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
            <XAxis type="number" allowDecimals={false} className="text-xs" />
            <YAxis
              type="category"
              dataKey="label"
              width={200}
              tick={{ fontSize: 11 }}
              interval={0}
            />
            <Tooltip
              formatter={(value) => [String(value ?? ""), "PIs"]}
              labelFormatter={(_, payload) =>
                String(
                  (payload?.[0]?.payload as { name?: string } | undefined)?.name ??
                    ""
                )
              }
            />
            <Bar dataKey="count" fill={BAR_FILL} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
