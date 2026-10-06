import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

let _admin: ReturnType<typeof createClient> | null = null;
function adminClient() {
  if (!_admin) {
    _admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _admin;
}

export type ActivityKind = "purchase" | "free_download" | "member_download";

export type ActivityRow = {
  id: string;
  kind: ActivityKind;
  created_at: string;
  name: string | null;
  email: string | null;
  beat_id: string | null;
  beat_title: string;
  beat_slug: string | null;
  amount_cents: number | null;
  paid: boolean;
  detail: string | null;
  /** agreements.id (uuid) for PDF generation, when a license doc exists */
  agreement_row_id: string | null;
  /** human agreement code e.g. MBC-2026-00042 */
  agreement_code: string | null;
  license_type: string | null;
};

export type ActivitySummary = {
  paidCount: number;
  paidRevenueCents: number;
  pendingCount: number;
  freeDownloads: number;
  memberDownloads: number;
  uniqueCustomers: number;
};

export const adminListCustomerActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: ActivityRow[]; summary: ActivitySummary }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const sb = adminClient() as any;

    const [beatsRes, ordersRes, leadsRes, dlRes, agrRes, profRes] = await Promise.all([
      sb.from("beats").select("id,title,landing_slug"),
      sb.from("lease_orders")
        .select("id,beat_id,email,amount_cents,used_first_time_discount,stripe_session_id,created_at")
        .order("created_at", { ascending: false }).limit(1000),
      sb.from("beat_lead_captures")
        .select("id,beat_id,first_name,email,created_at")
        .order("created_at", { ascending: false }).limit(1000),
      sb.from("downloads")
        .select("id,user_id,beat_id,file_type,credits_used,created_at")
        .order("created_at", { ascending: false }).limit(1000),
      sb.from("agreements")
        .select("id,agreement_id,download_id,user_id,beat_id,license_type,user_name,user_email,accepted_at"),
      sb.from("profiles").select("id,email,display_name,full_name"),
    ]);

    const beats = new Map<string, { title: string; slug: string | null }>();
    for (const b of beatsRes.data ?? []) beats.set(b.id, { title: b.title, slug: b.landing_slug ?? null });
    const profiles = new Map<string, { email: string | null; name: string | null }>();
    for (const p of profRes.data ?? []) {
      profiles.set(p.id, { email: p.email ?? null, name: p.full_name ?? p.display_name ?? null });
    }
    const agreementsByDownload = new Map<string, any>();
    for (const a of agrRes.data ?? []) if (a.download_id) agreementsByDownload.set(a.download_id, a);

    const rows: ActivityRow[] = [];

    const licRes = await sb.from("purchase_licenses")
      .select("id,agreement_code,email,buyer_name,beat_id,license_label,stripe_session_id")
      .order("created_at", { ascending: false }).limit(2000);
    const licBySession = new Map<string, any>();
    const licByEmailBeat = new Map<string, any>();
    for (const l of licRes.data ?? []) {
      licBySession.set(`${l.stripe_session_id}:${l.beat_id}`, l);
      licBySession.set(l.stripe_session_id, licBySession.get(l.stripe_session_id) ?? l);
      licByEmailBeat.set(`${(l.email ?? "").toLowerCase()}:${l.beat_id}`, l);
    }

    for (const o of ordersRes.data ?? []) {
      const beat = o.beat_id ? beats.get(o.beat_id) : undefined;
      const lic = o.stripe_session_id
        ? licBySession.get(`${o.stripe_session_id}:${o.beat_id}`) ?? licBySession.get(o.stripe_session_id)
        : undefined;
      const license = lic ?? (o.stripe_session_id ? licByEmailBeat.get(`${(o.email ?? "").toLowerCase()}:${o.beat_id}`) : undefined);
      rows.push({
        id: `order:${o.id}`,
        kind: "purchase",
        created_at: o.created_at,
        name: license?.buyer_name ?? null,
        email: o.email,
        beat_id: o.beat_id,
        beat_title: beat?.title ?? "(unknown beat)",
        beat_slug: beat?.slug ?? null,
        amount_cents: o.amount_cents ?? 0,
        paid: !!o.stripe_session_id,
        detail: o.used_first_time_discount ? "First-time discount" : null,
        agreement_row_id: license ? `lic:${license.id}` : null,
        agreement_code: license?.agreement_code ?? null,
        license_type: license?.license_label ?? "Unlimited Lease License",
      });
    }

    for (const l of leadsRes.data ?? []) {
      const beat = l.beat_id ? beats.get(l.beat_id) : undefined;
      rows.push({
        id: `lead:${l.id}`,
        kind: "free_download",
        created_at: l.created_at,
        name: l.first_name ?? null,
        email: l.email,
        beat_id: l.beat_id,
        beat_title: beat?.title ?? "(unknown beat)",
        beat_slug: beat?.slug ?? null,
        amount_cents: 0,
        paid: false,
        detail: "Tagged MP3",
        agreement_row_id: null,
        agreement_code: null,
        license_type: "Demo / tagged preview",
      });
    }

    for (const d of dlRes.data ?? []) {
      const beat = d.beat_id ? beats.get(d.beat_id) : undefined;
      const prof = d.user_id ? profiles.get(d.user_id) : undefined;
      const agr = agreementsByDownload.get(d.id);
      rows.push({
        id: `dl:${d.id}`,
        kind: "member_download",
        created_at: d.created_at,
        name: agr?.user_name ?? prof?.name ?? null,
        email: agr?.user_email ?? prof?.email ?? null,
        beat_id: d.beat_id,
        beat_title: beat?.title ?? "(unknown beat)",
        beat_slug: beat?.slug ?? null,
        amount_cents: null,
        paid: false,
        detail: `${d.file_type} · ${d.credits_used} credit${d.credits_used === 1 ? "" : "s"}`,
        agreement_row_id: agr?.id ?? null,
        agreement_code: agr?.agreement_id ?? null,
        license_type: agr?.license_type ?? null,
      });
    }

    rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    const emails = new Set<string>();
    let paidCount = 0, paidRevenueCents = 0, pendingCount = 0, freeDownloads = 0, memberDownloads = 0;
    for (const r of rows) {
      if (r.email) emails.add(r.email.toLowerCase());
      if (r.kind === "purchase") {
        if (r.paid) { paidCount++; paidRevenueCents += r.amount_cents ?? 0; } else pendingCount++;
      } else if (r.kind === "free_download") freeDownloads++;
      else memberDownloads++;
    }

    return {
      rows,
      summary: {
        paidCount,
        paidRevenueCents,
        pendingCount,
        freeDownloads,
        memberDownloads,
        uniqueCustomers: emails.size,
      },
    };
  });
