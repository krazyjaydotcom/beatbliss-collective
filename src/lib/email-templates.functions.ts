import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: any) {
  const { data: ok } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!ok) throw new Error("Forbidden");
}

export type EmailTemplateRow = {
  id: string;
  template_key: string;
  name: string;
  subject: string;
  html: string;
  preview_text: string | null;
  enabled: boolean;
  updated_at: string;
};

export type EmailTemplateSummary = {
  key: string;
  name: string;
  subject: string;
  html: string;
  preview_text: string | null;
  enabled: boolean;
  variables: string[];
  updated_at: string | null;
  source: "db" | "default";
};

export const adminListEmailTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ templates: EmailTemplateSummary[]; mergeTags: string[] }> => {
    await assertAdmin(context);
    const { DEFAULT_EMAIL_TEMPLATES, ALLOWED_MERGE_TAGS } = await import("@/lib/email-templates.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data } = await (supabaseAdmin as any)
      .from("email_templates")
      .select("template_key,name,subject,html,preview_text,enabled,updated_at");
    const rows = (data ?? []) as Array<{ template_key: string; name: string; subject: string; html: string; preview_text: string | null; enabled: boolean; updated_at: string }>;
    const byKey = new Map(rows.map((r) => [r.template_key, r]));

    const templates: EmailTemplateSummary[] = DEFAULT_EMAIL_TEMPLATES.map((d) => {
      const row = byKey.get(d.key);
      return {
        key: d.key,
        name: row?.name || d.name,
        subject: row?.subject || d.subject,
        html: row?.html || d.html,
        preview_text: (row?.preview_text ?? d.preview_text) || null,
        enabled: row ? row.enabled : false,
        variables: d.variables,
        updated_at: row?.updated_at ?? null,
        source: row ? "db" : "default",
      };
    });
    return { templates, mergeTags: [...ALLOWED_MERGE_TAGS] };
  });

export const adminUpsertEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string; name: string; subject: string; html: string; preview_text?: string | null; enabled: boolean }) =>
    z.object({
      key: z.string().min(2).max(80),
      name: z.string().min(1).max(120),
      subject: z.string().min(1).max(300),
      html: z.string().min(10).max(200_000),
      preview_text: z.string().max(300).nullable().optional(),
      enabled: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("email_templates")
      .upsert({
        template_key: data.key,
        name: data.name,
        subject: data.subject,
        html: data.html,
        preview_text: data.preview_text ?? null,
        enabled: data.enabled,
      }, { onConflict: "template_key" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const adminResetEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string }) => z.object({ key: z.string().min(2).max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("email_templates").delete().eq("template_key", data.key);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const adminPreviewEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string; subject?: string; html?: string }) =>
    z.object({
      key: z.string().min(2).max(80),
      subject: z.string().max(300).optional(),
      html: z.string().max(200_000).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ subject: string; html: string }> => {
    await assertAdmin(context);
    const { applyMergeTags, DEFAULT_EMAIL_TEMPLATES } = await import("@/lib/email-templates.server");
    const def = DEFAULT_EMAIL_TEMPLATES.find((t) => t.key === data.key);
    const sample: Record<string, string> = {
      siteName: "MYBEATCATALOG", supportEmail: "support@krazyjay.com",
      firstName: "Alex", buyerEmail: "buyer@example.com", name: "Sample Sender", email: "sender@example.com",
      beatTitle: "Sample Beat", beatUrl: "https://mybeatcatalog.com/beats/sample",
      downloadUrl: "https://mybeatcatalog.com/d/Ab3dEf9hIj12",
      checkoutUrl: "https://mybeatcatalog.com/buy/sample",
      loginUrl: "https://mybeatcatalog.com/login",
      inviteUrl: "https://mybeatcatalog.com/invite/sample",
      unsubscribeUrl: "https://mybeatcatalog.com/unsubscribe/sample",
      amount: "$49.99", sessionId: "sess_test_123", date: new Date().toISOString().slice(0, 10),
      answersTable: `<tr><td style="padding:6px 12px 6px 0;color:#71717a"><strong>Sample</strong></td><td>Sample answer</td></tr>`,
    };
    const subject = applyMergeTags(data.subject ?? def?.subject ?? "", sample, false);
    const html = applyMergeTags(data.html ?? def?.html ?? "", sample, true);
    return { subject, html };
  });
