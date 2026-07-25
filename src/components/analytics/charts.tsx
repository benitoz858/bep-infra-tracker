"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TONE_HEX } from "@/lib/domain";
import { formatCountCompact, formatPowerScaled } from "@/lib/format";

/**
 * Chart wrappers for the analytics page.
 *
 * A shared axis/grid/tooltip treatment lives here so every chart in the app
 * reads as one system: muted grid, mono tick labels, dark tooltip surface.
 */

const AXIS = {
  stroke: "#6B6B6B",
  fontSize: 10,
  fontFamily: "var(--font-mono), monospace",
} as const;

const GRID_STROKE = "#1f1f1f";

/** Sequential palette for categorical series where status colour is meaningless. */
const SERIES = [
  "#00D4FF",
  "#76B900",
  "#FFB800",
  "#A855F7",
  "#FF4444",
  "#22D3EE",
  "#84CC16",
  "#F59E0B",
  "#C084FC",
  "#FB7185",
];

function DarkTooltip({
  formatter,
}: {
  formatter?: (value: number, name: string) => string;
}) {
  return (
    <Tooltip
      contentStyle={{
        background: "#111111",
        border: "1px solid #333333",
        borderRadius: 6,
        fontSize: 11,
        fontFamily: "var(--font-mono), monospace",
      }}
      labelStyle={{ color: "#9A9A9A" }}
      itemStyle={{ color: "#E8E8E8" }}
      formatter={
        formatter
          ? (value, name) => [formatter(Number(value), String(name)), String(name)]
          : undefined
      }
    />
  );
}

/**
 * Announced vs operational MW by opening year. The two bars are deliberately
 * grouped rather than stacked: the gap between them is the point — pipeline that
 * has not yet energised.
 */
export function CapacityByYearChart({
  data,
}: {
  data: { year: number; announcedMw: number; operationalMw: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-fg-muted">No dated projects.</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="year" {...AXIS} tickLine={false} />
        <YAxis
          {...AXIS}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}GW` : `${v}`)}
        />
        <DarkTooltip formatter={(value) => formatPowerScaled(value)} />
        <Legend
          wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono), monospace" }}
        />
        <Bar
          dataKey="announcedMw"
          name="Announced MW"
          fill="#00D4FF"
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="operationalMw"
          name="Operational MW"
          fill="#76B900"
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars for "MW by X" rollups with long category labels. */
export function GroupedBarChart({
  data,
  metric = "power",
}: {
  data: { label: string; powerMw: number; gpuCount: number; count: number }[];
  metric?: "power" | "gpus" | "count";
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-fg-muted">No data.</p>;
  }

  const key = metric === "power" ? "powerMw" : metric === "gpus" ? "gpuCount" : "count";
  const format =
    metric === "power"
      ? (v: number) => formatPowerScaled(v)
      : (v: number) => formatCountCompact(v);

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 28)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 40, bottom: 4, left: 4 }}
      >
        <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
        <XAxis
          type="number"
          {...AXIS}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => format(v)}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={140}
          {...AXIS}
          tickLine={false}
          axisLine={false}
        />
        <DarkTooltip formatter={(value) => format(value)} />
        <Bar dataKey={key} radius={[0, 2, 2, 0]} isAnimationActive={false}>
          {data.map((_, index) => (
            <Cell key={index} fill={SERIES[index % SERIES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Mix donut for power source / cooling / platform. */
export function MixChart({
  data,
  valueKey = "count",
}: {
  data: { label: string; count: number; powerMw: number }[];
  valueKey?: "count" | "powerMw";
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-fg-muted">No data.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey="label"
          innerRadius={50}
          outerRadius={85}
          paddingAngle={2}
          stroke="#0A0A0A"
          isAnimationActive={false}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={SERIES[index % SERIES.length]} />
          ))}
        </Pie>
        <DarkTooltip
          formatter={(value) =>
            valueKey === "powerMw" ? formatPowerScaled(value) : `${value} projects`
          }
        />
        <Legend
          wrapperStyle={{ fontSize: 10, fontFamily: "var(--font-mono), monospace" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Status distribution, coloured by the app's status semantics. */
export function StatusChart({
  data,
}: {
  data: { label: string; count: number; tone: keyof typeof TONE_HEX }[];
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-fg-muted">No data.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 40, left: 4 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="label"
          {...AXIS}
          tickLine={false}
          angle={-35}
          textAnchor="end"
          interval={0}
          height={60}
        />
        <YAxis {...AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <DarkTooltip formatter={(value) => `${value} projects`} />
        <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
          {data.map((row, index) => (
            <Cell key={index} fill={TONE_HEX[row.tone]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
