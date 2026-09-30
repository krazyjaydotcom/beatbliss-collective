import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * Real-data only: one bar per day for the last 30 days, built from confirmed
 * paid purchases. Unpaid / abandoned checkouts are never included and days
 * with no sales stay at zero — no smoothing, no synthetic curve.
 */

export type RevenuePoint = { date: string; cents: number; count: number };

const localDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function buildDailyRevenue(
  rows: { created_at: string; kind: string; paid?: boolean; amount_cents?: number | null }[],
  days = 30,
): RevenuePoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = new Map<string, RevenuePoint>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const key = localDay(day);
    buckets.set(key, { date: key, cents: 0, count: 0 });
  }
  for (const r of rows) {
    if (r.kind !== "purchase" || !r.paid) continue;
    const key = localDay(new Date(r.created_at));
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
  const [days, setDays] = useState(30);
  const [table, setTable] = useState(false);
  const [selected, setSelected] = useState<RevenuePoint | null>(null);
  const visible = useMemo(() => data.slice(-days), [data, days]);
  const total = useMemo(() => visible.reduce((s, d) => s + d.cents, 0), [visible]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {money(total)} <span className="font-normal text-muted-foreground">confirmed revenue</span>
        </p>
        <div className="flex gap-1">
          {[7, 30].map((range) => (
            <button
              key={range}
              type="button"
              aria-pressed={days === range}
              onClick={() => {
                setDays(range);
                setSelected(null);
              }}
              className={
                "min-h-9 rounded-md border px-3 text-xs " +
                (days === range ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground")
              }
            >
              {range} days
            </button>
          ))}
          <button
            type="button"
            aria-pressed={table}
            onClick={() => setTable(!table)}
            className="min-h-9 rounded-md border border-border px-3 text-xs"
          >
            {table ? "Chart" : "Table"}
          </button>
        </div>
      </div>
      {total === 0 && (
        <p className="text-xs text-muted-foreground">
          No confirmed sales in this period. Unpaid checkouts are excluded.
        </p>
      )}
      {table ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Daily confirmed revenue for the last {days} days</caption>
            <thead className="sticky top-0 bg-card">
              <tr>
                <th className="py-2">Date</th>
                <th>Paid sales</th>
                <th className="text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((point) => (
                <tr key={point.date} className="border-t border-border">
                  <td className="py-2">{shortDate(point.date)}</td>
                  <td>{point.count}</td>
                  <td className="text-right">{money(point.cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              accessibilityLayer
              data={visible}
              onClick={(state: any) => {
                const point = state?.activePayload?.[0]?.payload;
                if (point) setSelected(point);
              }}
              margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
            >
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
              <Bar dataKey="cents" fill="#60a5fa" radius={[3, 3, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {selected
          ? `${shortDate(selected.date)}: ${money(selected.cents)} from ${selected.count} paid sales`
          : "Hover or tap a day for details. Use Table to read every value."}
      </p>
    </div>
  );
}
