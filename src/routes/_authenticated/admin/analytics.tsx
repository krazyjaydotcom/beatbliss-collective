import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getStoreAnalytics } from "@/lib/analytics.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: AdminAnalyticsPage,
});

const RANGES = [7, 30, 90];

function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const fetchAnalytics = useServerFn(getStoreAnalytics);

  const query = useQuery({
    queryKey: ["store-analytics", days],
    queryFn: () => fetchAnalytics({ data: { days } }),
  });

  const data = query.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Plays & commercials</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real counts recorded when a beat starts playing and when a commercial is shown,
            skipped or clicked.
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={r === days ? "default" : "outline"}
              onClick={() => setDays(r)}
            >
              {r} days
            </Button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : query.isError ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm">
          <p>That didn&apos;t load.</p>
          <Button className="mt-3" size="sm" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : !data ? null : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Plays" value={data.totalPlays} />
            <Stat label="By members" value={data.memberPlays} />
            <Stat label="By visitors" value={data.guestPlays} />
            <Stat label="Commercials shown" value={data.adTotals.impressions} />
          </div>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Plays per day</h2>
            {data.totalPlays === 0 ? (
              <p className="mt-6 pb-6 text-center text-sm text-muted-foreground">
                No plays recorded in this period yet.
              </p>
            ) : (
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.series} margin={{ left: -20, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickFormatter={(d: string) => d.slice(5)}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                      className="text-xs"
                    />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelFormatter={(d) => `Day ${d}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      name="Plays"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Most played beats</h2>
            {data.topBeats.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nothing played yet.</p>
            ) : (
              <ol className="mt-3 space-y-1.5">
                {data.topBeats.map((b, i) => (
                  <li key={b.beatId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="mr-2 tabular-nums text-muted-foreground">{i + 1}.</span>
                      {b.title}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{b.plays}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Commercial performance</h2>
            {data.ads.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No commercials have been shown in this period.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Commercial</th>
                      <th className="py-2 pr-3 text-right">Shown</th>
                      <th className="py-2 pr-3 text-right">Skipped</th>
                      <th className="py-2 pr-3 text-right">Clicks</th>
                      <th className="py-2 text-right">Skip rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ads.map((a) => (
                      <tr key={a.adId} className="border-t border-border">
                        <td className="max-w-[240px] truncate py-2 pr-3">{a.title}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{a.impressions}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{a.skips}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{a.clicks}</td>
                        <td className="py-2 text-right tabular-nums">
                          {a.impressions ? `${Math.round((a.skips / a.impressions) * 100)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}
