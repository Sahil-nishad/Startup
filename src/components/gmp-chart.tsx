import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { shortDate, type Ipo } from "@/lib/ipo-data";

export function GmpChart({ ipo, height = 220 }: { ipo: Ipo; height?: number }) {
  const history = ipo.gmpHistory.length ? ipo.gmpHistory : ipo.gmp ? [ipo.gmp] : [];
  const data = history
    .filter((p) => !p.disputed && p.quality !== "review")
    .map((p) => ({ ...p, label: p.date ? shortDate(p.date) : "Latest" }));
  if (!data.length)
    return (
      <p className="p-6 text-sm text-muted-foreground">Dated GMP history is not available yet.</p>
    );
  return (
    <div style={{ height }} role="img" aria-label={`GMP trend for ${ipo.name}`}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `₹${v}`}
          />
          <Tooltip
            formatter={(v: number) => [`₹${v}`, "GMP"]}
            contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="gmp"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={{ r: 4, fill: "var(--chart-1)" }}
            fill="url(#g)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
