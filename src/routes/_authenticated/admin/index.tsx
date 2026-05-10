import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Music, Users, Wallet, Loader2 } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [profiles, downloads, agreements, transactions] = await Promise.all([
        supabase.from("profiles").select("id, subscription_tier, subscription_status, created_at, credits_balance"),
        supabase.from("downloads").select("id, beat_id, created_at, credits_used").gte("created_at", since),
        supabase.from("agreements").select("id"),
        supabase.from("transactions").select("type, credits_amount, created_at").gte("created_at", since),
      ]);
      return {
        profiles: profiles.data ?? [],
        downloads: downloads.data ?? [],
        agreementsCount: agreements.data?.length ?? 0,
        transactions: transactions.data ?? [],
      };
    },
  });

  if (isLoading || !data) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const totalUsers = data.profiles.length;
  const activeSubs = data.profiles.filter((p: any) => p.subscription_status === "active").length;
  const totalCreditsOut = data.profiles.reduce((s: number, p: any) => s + (p.credits_balance ?? 0), 0);
  const downloads30 = data.downloads.length;

  // downloads per day (last 30)
  const buckets: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    buckets[d] = 0;
  }
  data.downloads.forEach((d: any) => {
    const k = d.created_at.slice(0, 10);
    if (k in buckets) buckets[k]++;
  });
  const dailyData = Object.entries(buckets).map(([date, count]) => ({ date: date.slice(5), count }));

  // top beats
  const counts: Record<string, number> = {};
  data.downloads.forEach((d: any) => { counts[d.beat_id] = (counts[d.beat_id] ?? 0) + 1; });
  const topBeatIds = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Last 30 days overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Users} label="Total users" value={totalUsers} />
        <Stat icon={Wallet} label="Active subs" value={activeSubs} />
        <Stat icon={Download} label="Downloads (30d)" value={downloads30} />
        <Stat icon={Music} label="Credits in wallets" value={totalCreditsOut} />
      </div>

      <Card title="Downloads per day">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={dailyData}>
            <defs>
              <linearGradient id="fillBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.6} />
                <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Area type="monotone" dataKey="count" stroke="hsl(var(--accent))" fill="url(#fillBlue)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Top beats (30d)">
        <TopBeats topBeatIds={topBeatIds} />
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 text-3xl font-bold">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function TopBeats({ topBeatIds }: { topBeatIds: [string, number][] }) {
  const ids = topBeatIds.map(([id]) => id);
  const { data } = useQuery({
    queryKey: ["top-beats", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("beats").select("id, title").in("id", ids);
      return data ?? [];
    },
  });
  if (ids.length === 0) return <p className="text-sm text-muted-foreground">No downloads yet.</p>;
  const chartData = topBeatIds.map(([id, count]) => ({
    name: data?.find((b: any) => b.id === id)?.title ?? id.slice(0, 6),
    count,
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
        <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
        <Bar dataKey="count" fill="hsl(var(--accent))" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
