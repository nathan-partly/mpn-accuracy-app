"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { AccuracyPoint } from "@/types";
import { formatDate } from "@/lib/utils";

interface Props {
  data: AccuracyPoint[];
}

export function AccuracyChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-grey-400 text-sm">
        No snapshot history yet
      </div>
    );
  }

  if (data.length === 1) {
    // Single point — show a simple stat instead of a line
    const point = data[0];
    return (
      <div className="h-48 flex flex-col items-center justify-center gap-1">
        <p className="text-4xl font-bold text-brand-blue">
          {Number(point.accuracy_pct).toFixed(2)}%
        </p>
        <p className="text-xs text-grey-400">
          Single snapshot — {formatDate(point.snapshot_date)}
        </p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: formatDate(d.snapshot_date),
    accuracy: Number(d.accuracy_pct),
    valid: d.valid_count,
    invalid: d.invalid_count,
    total: d.total_parts,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#6B7280" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={["auto", 100]}
          tick={{ fontSize: 11, fill: "#6B7280" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
          width={45}
        />
        <Tooltip
          contentStyle={{
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            fontSize: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
          }}
          formatter={(value: number, name: string) => {
            if (name === "accuracy") return [`${value.toFixed(2)}%`, "Accuracy"];
            return [value, name];
          }}
        />
        <ReferenceLine y={99} stroke="#E5E7EB" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="accuracy"
          stroke="#3632FF"
          strokeWidth={2.5}
          dot={{ fill: "#3632FF", r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
