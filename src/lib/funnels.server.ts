/**
 * Forwards a captured lead to Sendy (self-hosted email/newsletter platform)
 * and adds them to the configured list. Falls back to a generic webhook if
 * BEAT_FUNNEL_LEAD_WEBHOOK_URL is set. If neither is configured, no-ops
 * gracefully — the lead is still saved in the database.
 */
export interface FunnelLeadPayload {
  email: string;
  funnel_slug: string;
  funnel_title: string;
  beat_title?: string | null;
  captured_at: string;
}

async function forwardToSendy(payload: FunnelLeadPayload): Promise<{ ok: boolean; error?: string }> {
  const baseUrl = process.env.SENDY_BASE_URL;
  const apiKey = process.env.SENDY_API_KEY;
  const listId = process.env.SENDY_LIST_ID;
  if (!baseUrl || !apiKey || !listId) return { ok: false, error: "no_sendy_config" };

  try {
    const url = baseUrl.replace(/\/+$/, "") + "/subscribe";
    const form = new URLSearchParams({
      api_key: apiKey,
      list: listId,
      email: payload.email,
      boolean: "true", // return plain text "1" or error string
      referrer: payload.funnel_slug,
    });
    if (payload.beat_title) form.set("Beat", payload.beat_title);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const text = (await res.text()).trim();
    // Sendy returns "1" or "true" on success; "Already subscribed" is also a benign success
    if (res.ok && (text === "1" || text.toLowerCase() === "true" || /already subscribed/i.test(text))) {
      return { ok: true };
    }
    return { ok: false, error: `sendy_${res.status}:${text.slice(0, 200)}` };
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
  // Prefer native Sendy integration
  if (process.env.SENDY_BASE_URL && process.env.SENDY_API_KEY && process.env.SENDY_LIST_ID) {
    const sy = await forwardToSendy(payload);
    // Also fire generic webhook if configured (best-effort)
    if (process.env.BEAT_FUNNEL_LEAD_WEBHOOK_URL) {
      await forwardToGenericWebhook(payload).catch(() => null);
    }
    return sy;
  }
  return forwardToGenericWebhook(payload);
}
