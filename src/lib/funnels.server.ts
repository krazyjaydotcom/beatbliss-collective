/**
 * Forwards a captured lead to the user's external email tool
 * (ConvertKit / Mailchimp / Zapier / etc.) via a configured webhook URL.
 *
 * If BEAT_FUNNEL_LEAD_WEBHOOK_URL is not set, this no-ops gracefully —
 * the lead is still saved in the database.
 */
export interface FunnelLeadPayload {
  email: string;
  funnel_slug: string;
  funnel_title: string;
  beat_title?: string | null;
  captured_at: string;
}

export async function forwardLeadToExternalTool(payload: FunnelLeadPayload): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.BEAT_FUNNEL_LEAD_WEBHOOK_URL;
  if (!url) {
    return { ok: false, error: "no_webhook_configured" };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { ok: false, error: `webhook_status_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
