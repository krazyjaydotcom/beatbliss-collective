import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Real-data only: one bar per day for the last 30 days, built from confirmed
 * paid purchases. Unpaid / abandoned checkouts are never included and days
 * with no sales stay at zero — no smoothing, no synthetic curve.
 */

export type RevenuePoint = { date: string; cents: number; count: number };

const DAY = 86_400_000;
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function buildDailyRevenue(
  rows: { created_at: string; kind: string; paid?: boolean; amount_cents?: number | null }[],
  days = 30,
): RevenuePoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = new Map<string, RevenuePoint>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = new Date(today.getTime() - i * DAY).toISOString().slice(0, 10);
    buckets.set(key, { date: key, cents: 0, count: 0 });
  }
  for (const r of rows) {
    if (r.kind !== "purchase" || !r.paid) continue;
    const key = new Date(r.created_at).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.cents += r.amount_cents ?? 0;
    bucket.count += 1;
  }
  return Array.from(buckets.values());
}

function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const total = useMemo(() => data.reduce((s, d) => s + d.cents, 0), [data]);

  if (total === 0) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/70 px-4 text-center">
        <p className="text-sm font-medium text-foreground">No confirmed sales in the last 30 days</p>
        <p className="text-xs text-muted-foreground">
          Paid purchases appear here the moment payment is confirmed. Unpaid checkouts are excluded.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.16)" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fontSize: 11, fill: "rgba(226,232,240,0.6)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v: number) => `$${Math.round(v / 100)}`}
            tick={{ fontSize: 11, fill: "rgba(226,232,240,0.6)" }}
            tickLine={false}
            axisLine={false}
            width={48}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.08)" }}
            contentStyle={{
              background: "#0b1220",
              border: "1px solid rgba(148,163,184,0.22)",
              borderRadius: 10,
              fontSize: 12,
              color: "#f8fafc",
            }}
            labelFormatter={(label: string) => shortDate(label)}
            formatter={(value: number, _name, item: any) => [
              `${money(value)} · ${item?.payload?.count ?? 0} paid sale${item?.payload?.count === 1 ? "" : "s"}`,
              "Confirmed revenue",
            ]}
          />
          <Bar dataKey="cents" fill="rgb(37,99,235)" radius={[3, 3, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
