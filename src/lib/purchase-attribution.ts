import { supabase } from "@/integrations/supabase/client";
import type { LicenseTier } from "@/lib/licensing";

export type PurchaseAttribution = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  sessionKey: string | null;
};

const KEY = "mbc.purchase.attribution.v1";

function clean(value: string | null, max = 160) {
  const next = value?.trim();
  return next ? next.slice(0, max) : null;
}

export function getPurchaseAttribution(): PurchaseAttribution {
  if (typeof window === "undefined") {
    return { source: null, medium: null, campaign: null, content: null, sessionKey: null };
  }
  const params = new URLSearchParams(window.location.search);
  const incoming = {
    source: clean(params.get("utm_source"), 100),
    medium: clean(params.get("utm_medium"), 100),
    campaign: clean(params.get("utm_campaign")),
    content: clean(params.get("utm_content")),
  };
  try {
    let sessionKey = sessionStorage.getItem("mbc.session.key");
    if (!sessionKey) {
      sessionKey = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      sessionStorage.setItem("mbc.session.key", sessionKey);
    }
    if (incoming.source || incoming.medium || incoming.campaign || incoming.content) {
      sessionStorage.setItem(KEY, JSON.stringify(incoming));
      return { ...incoming, sessionKey };
    }
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Partial<PurchaseAttribution>;
    return {
      source: clean(saved.source ?? null, 100),
      medium: clean(saved.medium ?? null, 100),
      campaign: clean(saved.campaign ?? null),
      content: clean(saved.content ?? null),
      sessionKey,
    };
  } catch {
    return { ...incoming, sessionKey: null };
  }
}

export function trackPurchaseFunnel(
  eventType: "attributed_landing" | "preview_play" | "license_selected" | "buy_now_clicked",
  beatId: string,
  licenseTier?: LicenseTier,
) {
  const a = getPurchaseAttribution();
  if (eventType === "attributed_landing" && !a.source && !a.campaign) return;
  void supabase
    .from("purchase_funnel_events")
    .insert({
      event_type: eventType,
      beat_id: beatId,
      license_tier: licenseTier ?? null,
      utm_source: a.source,
      utm_medium: a.medium,
      utm_campaign: a.campaign,
      utm_content: a.content,
      session_key: a.sessionKey,
    })
    .then(() => undefined, () => undefined);
}