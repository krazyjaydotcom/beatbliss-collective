import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin analytics for beat plays and commercials.
 *
 * Reads go through the caller's own client, so the admin-only row policies on
 * `beat_plays` and `ad_events` are what actually enforces access.
 */

export type DayPoint = { day: string; total: number; members: number; guests: number };
export type TopBeat = { beatId: string; title: string; plays: number };
export type AdStat = {
  adId: string;
  title: string;
  impressions: number;
  skips: number;
  clicks: number;
};

export type AnalyticsSummary = {
  days: number;
  totalPlays: number;
  memberPlays: number;
  guestPlays: number;
  series: DayPoint[];
  topBeats: TopBeat[];
  ads: AdStat[];
  adTotals: { impressions: number; skips: number; clicks: number };
  funnel: FunnelStat[];
};
export type FunnelStat = { campaign: string; beat: string; shortId: string | null; landings: number; plays: number; selections: number; buyClicks: number; checkouts: number; purchases: number; revenueCents: number };

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export const getStoreAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number }) => ({
    days: Math.min(90, Math.max(7, Number(input?.days) || 30)),
  }))
  .handler(async ({ data, context }): Promise<AnalyticsSummary> => {
    const sb = context.supabase as any;
    const { data: isAdmin } = await sb.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();

    const [playsRes, eventsRes, adsRes, funnelRes] = await Promise.all([
      sb
        .from("beat_plays")
        .select("beat_id,is_member,created_at")
        .gte("created_at", since)
        .limit(50_000),
      sb.from("ad_events").select("ad_id,event,created_at").gte("created_at", since).limit(50_000),
      sb.from("ad_spots").select("id,title"),
      sb.from("purchase_funnel_events").select("event_type,beat_id,utm_campaign,utm_content,amount_cents").gte("created_at", since).limit(50_000),
    ]);

    const plays = (playsRes.data ?? []) as {
      beat_id: string;
      is_member: boolean;
      created_at: string;
    }[];

    const byDay = new Map<string, DayPoint>();
    for (let i = data.days - 1; i >= 0; i -= 1) {
      const key = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      byDay.set(key, { day: key, total: 0, members: 0, guests: 0 });
    }

    const byBeat = new Map<string, number>();
    let memberPlays = 0;
    for (const p of plays) {
      const point = byDay.get(dayKey(p.created_at));
      if (point) {
        point.total += 1;
        if (p.is_member) point.members += 1;
        else point.guests += 1;
      }
      if (p.is_member) memberPlays += 1;
      byBeat.set(p.beat_id, (byBeat.get(p.beat_id) ?? 0) + 1);
    }

    const topIds = [...byBeat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    let titles = new Map<string, string>();
    if (topIds.length) {
      const { data: beatRows } = await sb
        .from("beats")
        .select("id,title")
        .in("id", topIds.map(([id]) => id));
      titles = new Map(((beatRows ?? []) as { id: string; title: string }[]).map((b) => [b.id, b.title]));
    }

    const adTitles = new Map(
      (((adsRes.data ?? []) as { id: string; title: string }[]) || []).map((a) => [a.id, a.title]),
    );
    const adMap = new Map<string, AdStat>();
    for (const e of (eventsRes.data ?? []) as { ad_id: string; event: string }[]) {
      const row =
        adMap.get(e.ad_id) ??
        ({
          adId: e.ad_id,
          title: adTitles.get(e.ad_id) ?? "Removed commercial",
          impressions: 0,
          skips: 0,
          clicks: 0,
        } as AdStat);
      if (e.event === "impression") row.impressions += 1;
      else if (e.event === "skip") row.skips += 1;
      else if (e.event === "click") row.clicks += 1;
      adMap.set(e.ad_id, row);
    }
    const ads = [...adMap.values()].sort((a, b) => b.impressions - a.impressions);

    const funnelRows = (funnelRes.data ?? []) as { event_type: string; beat_id: string | null; utm_campaign: string | null; utm_content: string | null; amount_cents: number | null }[];
    const funnelBeatIds = [...new Set(funnelRows.flatMap((r) => r.beat_id ? [r.beat_id] : []))];
    let funnelTitles = new Map<string, string>();
    if (funnelBeatIds.length) {
      const { data: beatRows } = await sb.from("beats").select("id,title").in("id", funnelBeatIds);
      funnelTitles = new Map(((beatRows ?? []) as { id: string; title: string }[]).map((b) => [b.id, b.title]));
    }
    const funnelMap = new Map<string, FunnelStat>();
    for (const row of funnelRows) {
      const campaign = row.utm_campaign || "Unattributed";
      const shortId = row.utm_content || null;
      const key = `${campaign}|${row.beat_id ?? ""}|${shortId ?? ""}`;
      const stat = funnelMap.get(key) ?? { campaign, beat: row.beat_id ? funnelTitles.get(row.beat_id) ?? "Removed beat" : "Unknown beat", shortId, landings: 0, plays: 0, selections: 0, buyClicks: 0, checkouts: 0, purchases: 0, revenueCents: 0 };
      if (row.event_type === "attributed_landing") stat.landings += 1;
      else if (row.event_type === "preview_play") stat.plays += 1;
      else if (row.event_type === "license_selected") stat.selections += 1;
      else if (row.event_type === "buy_now_clicked") stat.buyClicks += 1;
      else if (row.event_type === "checkout_started") stat.checkouts += 1;
      else if (row.event_type === "purchase_confirmed") { stat.purchases += 1; stat.revenueCents += row.amount_cents ?? 0; }
      funnelMap.set(key, stat);
    }

    return {
      days: data.days,
      totalPlays: plays.length,
      memberPlays,
      guestPlays: plays.length - memberPlays,
      series: [...byDay.values()],
      topBeats: topIds.map(([id, count]) => ({
        beatId: id,
        title: titles.get(id) ?? "Removed beat",
        plays: count,
      })),
      ads,
      adTotals: ads.reduce(
        (acc, a) => ({
          impressions: acc.impressions + a.impressions,
          skips: acc.skips + a.skips,
          clicks: acc.clicks + a.clicks,
        }),
        { impressions: 0, skips: 0, clicks: 0 },
      ),
      funnel: [...funnelMap.values()].sort((a, b) => b.landings - a.landings || b.purchases - a.purchases),
    };
  });
