import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getStoreAnalytics } from "@/lib/analytics.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: AdminAnalyticsPage,
});

const RANGES = [7, 30, 90];

function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [panel, setPanel] = useState("trends");
  const [tableView, setTableView] = useState(false);
  const [selectedDay, setSelectedDay] = useState<{ day: string; total: number } | null>(null);
  const [campaign, setCampaign] = useState("");
  const [funnelPage, setFunnelPage] = useState(0);
  const [allBeats, setAllBeats] = useState(false);
  const fetchAnalytics = useServerFn(getStoreAnalytics);

  const query = useQuery({
    queryKey: ["store-analytics", days],
    queryFn: () => fetchAnalytics({ data: { days } }),
  });

  const data = query.data;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real counts recorded when a beat starts playing and when a commercial is shown, skipped or clicked.
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={r === days ? "default" : "outline"}
              aria-pressed={r === days}
              onClick={() => {
                setDays(r);
                setSelectedDay(null);
                setFunnelPage(0);
              }}
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
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Plays" value={data.totalPlays} />
            <Stat label="By members" value={data.memberPlays} />
            <Stat label="By visitors" value={data.guestPlays} />
            <Stat label="Commercials shown" value={data.adTotals.impressions} />
          </div>

          <div className="flex shrink-0 gap-2" aria-label="Analytics views">
            {[
              ["trends", "Trends"],
              ["funnel", "Campaign details"],
              ["ads", "Commercials"],
            ].map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={panel === key ? "default" : "outline"}
                aria-pressed={panel === key}
                onClick={() => setPanel(key)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-auto">
            {panel === "trends" && (
              <>
                <section className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Plays per day · last {days} days</h2>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-pressed={tableView}
                      onClick={() => setTableView(!tableView)}
                    >
                      {tableView ? "Chart" : "Table"}
                    </Button>
                  </div>
                  {tableView ? (
                    <div className="max-h-64 overflow-auto">
                      <table className="w-full text-left text-sm">
                        <caption className="sr-only">Daily plays</caption>
                        <thead className="sticky top-0 bg-card">
                          <tr>
                            <th className="py-2">Date</th>
                            <th className="text-right">Plays</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.series.map((point) => (
                            <tr key={point.day} className="border-t border-border">
                              <td className="py-2">{point.day}</td>
                              <td className="text-right">{point.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : data.totalPlays === 0 ? (
                    <p className="mt-6 pb-6 text-center text-sm text-muted-foreground">
                      No plays recorded in this period yet.
                    </p>
                  ) : (
                    <div className="mt-4 h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          accessibilityLayer
                          onClick={(state: any) => {
                            const point = state?.activePayload?.[0]?.payload;
                            if (point) setSelectedDay(point);
                          }}
                          data={data.series}
                          margin={{ left: -20, right: 8, top: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                          <XAxis
                            dataKey="day"
                            tickFormatter={(d: string) => d.slice(5)}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#94a3b8", fontSize: 11 }}
                            minTickGap={24}
                            className="text-xs"
                          />
                          <YAxis
                            tick={{ fill: "#94a3b8", fontSize: 11 }}
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                            className="text-xs"
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#111827",
                              color: "#f8fafc",
                              border: "1px solid #475569",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                            labelFormatter={(d) => `Day ${d}`}
                          />
                          <Area
                            isAnimationActive={false}
                            type="linear"
                            dataKey="total"
                            name="Plays"
                            stroke="#60a5fa"
                            fill="#3b82f6"
                            fillOpacity={0.15}
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </section>

                <p aria-live="polite" className="text-xs text-muted-foreground">
                  {selectedDay
                    ? `${selectedDay.day}: ${selectedDay.total} plays`
                    : "Hover or tap a day for the exact play count."}
                </p>
                <section className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Most played beats</h2>
                    <Button size="sm" variant="outline" onClick={() => setAllBeats(!allBeats)}>
                      {allBeats ? "Top five" : "View all"}
                    </Button>
                  </div>
                  {data.topBeats.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">Nothing played yet.</p>
                  ) : (
                    <ol className="mt-3 space-y-1.5">
                      {data.topBeats.slice(0, allBeats ? undefined : 5).map((b, i) => (
                        <li
                          key={b.beatId}
                          className="relative flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm"
                        >
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 left-0 rounded-md bg-blue-500/15"
                            style={{ width: `${(100 * b.plays) / Math.max(1, data.topBeats[0]?.plays ?? 1)}%` }}
                          />
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
              </>
            )}
            {panel === "funnel" && (
              <section className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold">Campaign events · last {days} days</h2>
                <p className="my-2 text-xs text-muted-foreground">
                  Raw event counts may include repeat actions. These are not unique-customer conversion rates.
                </p>
                <input
                  aria-label="Filter campaign or beat"
                  placeholder="Filter campaign or beat"
                  value={campaign}
                  onChange={(event) => {
                    setCampaign(event.target.value);
                    setFunnelPage(0);
                  }}
                  className="my-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Paid purchases are recorded only by Stripe&apos;s verified webhook. Missing Short IDs remain
                  unattributed.
                </p>
                {data.funnel.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">No attributed purchase activity in this period.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-3">Campaign / beat</th>
                          <th className="py-2 pr-3">Short ID</th>
                          <th className="py-2 text-right">Land</th>
                          <th className="py-2 text-right">Play</th>
                          <th className="py-2 text-right">Select</th>
                          <th className="py-2 text-right">Buy</th>
                          <th className="py-2 text-right">Checkout</th>
                          <th className="py-2 text-right">Paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.funnel
                          .filter((f) => (f.campaign + " " + f.beat).toLowerCase().includes(campaign.toLowerCase()))
                          .slice(funnelPage * 20, (funnelPage + 1) * 20)
                          .map((f) => (
                            <tr key={`${f.campaign}-${f.beat}-${f.shortId ?? ""}`} className="border-t border-border">
                              <td className="py-2 pr-3">
                                <span className="block font-medium">{f.campaign}</span>
                                <span className="text-muted-foreground">{f.beat}</span>
                              </td>
                              <td className="py-2 pr-3 text-muted-foreground">{f.shortId ?? "—"}</td>
                              <td className="py-2 text-right tabular-nums">{f.landings}</td>
                              <td className="py-2 text-right tabular-nums">{f.plays}</td>
                              <td className="py-2 text-right tabular-nums">{f.selections}</td>
                              <td className="py-2 text-right tabular-nums">{f.buyClicks}</td>
                              <td className="py-2 text-right tabular-nums">{f.checkouts}</td>
                              <td className="py-2 text-right tabular-nums">{f.purchases}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-3 flex justify-between">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={funnelPage === 0}
                    onClick={() => setFunnelPage(funnelPage - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-xs">Page {funnelPage + 1}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      (funnelPage + 1) * 20 >=
                      data.funnel.filter((f) =>
                        (f.campaign + " " + f.beat).toLowerCase().includes(campaign.toLowerCase()),
                      ).length
                    }
                    onClick={() => setFunnelPage(funnelPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </section>
            )}

            {panel === "ads" && (
              <section className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold">Commercial performance</h2>
                {data.ads.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">No commercials have been shown in this period.</p>
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
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}
