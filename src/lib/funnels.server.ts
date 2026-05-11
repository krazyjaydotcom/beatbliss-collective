/**
 * Forwards a captured lead to SendFox (native API) and adds them to the
 * configured list. Falls back to a generic webhook if BEAT_FUNNEL_LEAD_WEBHOOK_URL
 * is set. If neither is configured, no-ops gracefully — the lead is still
 * saved in the database.
 */
export interface FunnelLeadPayload {
  email: string;
  funnel_slug: string;
  funnel_title: string;
  beat_title?: string | null;
  captured_at: string;
}

const SENDFOX_LIST_ID = 624751;

async function forwardToSendFox(payload: FunnelLeadPayload): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.SENDFOX_API_TOKEN;
  if (!token) return { ok: false, error: "no_sendfox_token" };
  try {
    const res = await fetch("https://api.sendfox.com/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: payload.email,
        lists: [SENDFOX_LIST_ID],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `sendfox_${res.status}:${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

async function forwardToGenericWebhook(payload: FunnelLeadPayload): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.BEAT_FUNNEL_LEAD_WEBHOOK_URL;
  if (!url) return { ok: false, error: "no_webhook_configured" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, error: `webhook_status_${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function forwardLeadToExternalTool(payload: FunnelLeadPayload): Promise<{ ok: boolean; error?: string }> {
  // Prefer native SendFox integration
  if (process.env.SENDFOX_API_TOKEN) {
    const sf = await forwardToSendFox(payload);
    // Also fire generic webhook if configured (best-effort)
    if (process.env.BEAT_FUNNEL_LEAD_WEBHOOK_URL) {
      await forwardToGenericWebhook(payload).catch(() => null);
    }
    return sf;
  }
  return forwardToGenericWebhook(payload);
}
