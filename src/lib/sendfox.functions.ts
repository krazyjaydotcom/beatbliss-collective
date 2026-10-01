import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * SendFox (https://sendfox.com/developer/docs/) — admin-only, server-side.
 * Token comes only from the SENDFOX_API_TOKEN server secret.
 * This module never sends a campaign and never imports contacts.
 */
const BASE = "https://api.sendfox.com";

async function assertAdmin(context: any) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

type SfResult<T> = { ok: true; data: T } | { ok: false; status: number; reason: string };

async function sf<T>(path: string, init?: RequestInit): Promise<SfResult<T>> {
  const token = process.env["SENDFOX_API_TOKEN"];
  if (!token) return { ok: false, status: 0, reason: "missing_token" };
  try {
    const res = await fetch(BASE + path, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
    });
    if (res.ok) return { ok: true, data: (await res.json()) as T };
    let reason = "error";
    if (res.status === 401) reason = "invalid_token";
    else if (res.status === 403) reason = "no_api_access"; // free plan or restricted account
    else if (res.status === 429) reason = "rate_limited";
    else if (res.status === 422) reason = "validation";
    console.error("SendFox", path, res.status, (await res.text()).slice(0, 300));
    return { ok: false, status: res.status, reason };
  } catch (e) {
    console.error("SendFox fetch failed", e);
    return { ok: false, status: 0, reason: "network" };
  }
}

/** Read-only connection check (GET /me). */
export const sendfoxStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const r = await sf<{ name?: string; email?: string; contacts_count?: number; contact_limit?: number }>("/me");
    if (!r.ok) return { connected: false as const, reason: r.reason };
    return {
      connected: true as const,
      account: { name: r.data.name ?? "", email: r.data.email ?? "", contacts: r.data.contacts_count ?? 0, limit: r.data.contact_limit ?? 0 },
    };
  });

/** Read-only list discovery (GET /lists). */
export const sendfoxLists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const r = await sf<{ data: { id: number; name: string; subscribed_contacts_count: number; unsubscribed_contacts_count: number }[] }>("/lists");
    if (!r.ok) return { lists: [], reason: r.reason };
    return {
      lists: (r.data.data ?? []).map((l) => ({ id: l.id, name: l.name, subscribed: l.subscribed_contacts_count ?? 0, unsubscribed: l.unsubscribed_contacts_count ?? 0 })),
      reason: null,
    };
  });

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Creates a SendFox campaign DRAFT for one existing list (no scheduled_at, web_publish=false).
 * Does not send. Requires explicit admin confirmation of the reviewed list.
 */
export const sendfoxCreateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      listId: z.number().int().positive(),
      confirmedListName: z.string().min(1).max(191),
      subject: z.string().trim().min(1).max(191).refine((s) => !/^(re|fwd?):/i.test(s), "Subject can't start with RE: or FWD:"),
      body: z.string().trim().min(1).max(20000),
      fromName: z.string().trim().min(1).max(191),
      fromEmail: z.string().email().max(191),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Re-verify the list still exists and matches what the admin reviewed.
    const lists = await sf<{ data: { id: number; name: string }[] }>("/lists");
    if (!lists.ok) return { ok: false as const, reason: lists.reason };
    const list = lists.data.data.find((l) => l.id === data.listId);
    if (!list || list.name !== data.confirmedListName) return { ok: false as const, reason: "list_mismatch" };

    const html = data.body.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
    const r = await sf<{ id: number }>("/campaigns", {
      method: "POST",
      body: JSON.stringify({
        title: `MYBEATCATALOG · ${data.subject}`.slice(0, 191),
        subject: data.subject,
        html,
        from_name: data.fromName,
        from_email: data.fromEmail,
        lists: [data.listId],
        web_publish: false,
      }),
    });
    if (!r.ok) return { ok: false as const, reason: r.reason };
    return { ok: true as const, campaignId: r.data.id };
  });
