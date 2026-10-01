import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const AUDIENCES = ["clients", "leads", "members", "prospects"] as const;
export type Audience = (typeof AUDIENCES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function assertAdmin(context: any) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

/** Build a deduplicated recipient list for review. Read-only; sends nothing. */
export const adminPreviewAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ audiences: z.array(z.enum(AUDIENCES)).min(1).max(4) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = (context as any).supabase;
    const raw: { email: string; source: Audience }[] = [];
    const add = (rows: any[] | null, key: string, source: Audience) =>
      (rows ?? []).forEach((r) => r?.[key] && raw.push({ email: String(r[key]), source }));

    if (data.audiences.includes("clients")) {
      const { data: rows } = await sb.from("lease_orders").select("email").not("stripe_session_id", "is", null).limit(5000);
      add(rows, "email", "clients");
    }
    if (data.audiences.includes("leads")) {
      const { data: rows } = await sb.from("beat_lead_captures").select("email").limit(5000);
      add(rows, "email", "leads");
    }
    if (data.audiences.includes("members")) {
      const { data: rows } = await sb.from("profiles").select("email").eq("subscription_status", "active").limit(5000);
      add(rows, "email", "members");
    }
    if (data.audiences.includes("prospects")) {
      const { data: rows } = await sb.from("crm_prospects").select("email").neq("stage", "archived").limit(5000);
      add(rows, "email", "prospects");
    }

    const { data: sup } = await sb.from("suppressed_emails").select("email").limit(10000);
    const suppressed = new Set((sup ?? []).map((r: any) => String(r.email).toLowerCase()));

    const map = new Map<string, Set<Audience>>();
    let invalid = 0;
    let excluded = 0;
    for (const r of raw) {
      const e = r.email.trim().toLowerCase();
      if (!EMAIL_RE.test(e)) { invalid++; continue; }
      if (suppressed.has(e)) { excluded++; continue; }
      if (!map.has(e)) map.set(e, new Set());
      map.get(e)!.add(r.source);
    }
    const recipients = [...map.entries()]
      .map(([email, s]) => ({ email, sources: [...s] }))
      .sort((a, b) => a.email.localeCompare(b.email));
    return { recipients, rawCount: raw.length, invalid, unsubscribed: excluded, duplicates: raw.length - invalid - excluded - recipients.length };
  });
