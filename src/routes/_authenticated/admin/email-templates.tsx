import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Copy, Eye, Loader2, RotateCcw, Send, X } from "lucide-react";
import {
  adminListEmailTemplates,
  adminUpsertEmailTemplate,
  adminResetEmailTemplate,
  adminPreviewEmailTemplate,
  type EmailTemplateSummary,
} from "@/lib/email-templates.functions";
import { adminSendTestEmail } from "@/lib/beat-landing.functions";

export const Route = createFileRoute("/_authenticated/admin/email-templates")({
  component: EmailTemplatesAdmin,
});

const TEST_KIND_BY_KEY: Record<string, "free_download" | "purchase_buyer" | "admin_sale" | "exclusive_inquiry" | null> = {
  beat_free_download: "free_download",
  beat_purchase_buyer: "purchase_buyer",
  beat_purchase_admin: "admin_sale",
  beat_exclusive_inquiry: "exclusive_inquiry",
  invite_access: null,
  membership_welcome: null,
};

function EmailTemplatesAdmin() {
  const listFn = useServerFn(adminListEmailTemplates);
  const q = useQuery({ queryKey: ["admin-email-templates"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<EmailTemplateSummary | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Email Templates</h1>
        <p className="mt-1 text-sm text-slate-400">
          Edit the subject and HTML for system emails. Missing or disabled templates fall back to the built-in defaults so mail keeps sending.
        </p>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3 hidden md:table-cell">Subject</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 hidden lg:table-cell">Source</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.templates.map((t) => (
                <tr key={t.key} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-900/40">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{t.name}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-500">{t.key}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300 hidden md:table-cell truncate max-w-xs">{t.subject}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${t.enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700/40 text-slate-400"}`}>
                      {t.enabled ? "Enabled" : "Default"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell text-xs">
                    {t.source === "db" ? "Custom" : "Built-in"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditing(t)} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <TemplateEditor template={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TemplateEditor({ template, onClose }: { template: EmailTemplateSummary; onClose: () => void }) {
  const upsertFn = useServerFn(adminUpsertEmailTemplate);
  const resetFn = useServerFn(adminResetEmailTemplate);
  const previewFn = useServerFn(adminPreviewEmailTemplate);
  const testFn = useServerFn(adminSendTestEmail);
  const qc = useQueryClient();
  const [name, setName] = useState(template.name);
  const [subject, setSubject] = useState(template.subject);
  const [html, setHtml] = useState(template.html);
  const [previewText, setPreviewText] = useState(template.preview_text ?? "");
  const [enabled, setEnabled] = useState(template.enabled);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [testTo, setTestTo] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const testKind = TEST_KIND_BY_KEY[template.key];

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await upsertFn({ data: { key: template.key, name, subject, html, preview_text: previewText || null, enabled } });
      if (res.ok) { toast.success("Template saved"); qc.invalidateQueries({ queryKey: ["admin-email-templates"] }); onClose(); }
      else toast.error(res.error || "Save failed");
    } finally { setSaving(false); }
  };

  const reset = async () => {
    if (!confirm("Reset this template to the built-in default?")) return;
    const res = await resetFn({ data: { key: template.key } });
    if (res.ok) { toast.success("Reverted to built-in"); qc.invalidateQueries({ queryKey: ["admin-email-templates"] }); onClose(); }
    else toast.error(res.error || "Reset failed");
  };

  const runPreview = async () => {
    const res = await previewFn({ data: { key: template.key, subject, html } });
    setPreview(res);
  };

  const sendTest = async () => {
    if (!testKind) { toast.error("No live trigger for this template — cannot send test yet."); return; }
    if (!testTo) { toast.error("Enter an email address"); return; }
    setSendingTest(true);
    try {
      const r = await testFn({ data: { to: testTo, kind: testKind } });
      if (r.ok) toast.success(`Queued (status: ${r.status || "pending"})`);
      else toast.error(r.error || "Send failed");
    } finally { setSendingTest(false); }
  };

  const inp = "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl my-4 sm:my-8">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs font-mono text-slate-500">{template.key}</div>
            <h3 className="text-lg font-bold text-white truncate">{template.name}</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-[1fr_260px]">
          <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-300">Enabled</label>
              <button
                onClick={() => setEnabled(!enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${enabled ? "bg-primary" : "bg-slate-700"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${enabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <span className="text-xs text-slate-500">{enabled ? "Custom template will be used" : "Falls back to built-in default"}</span>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Display name</label>
              <input className={inp} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Subject</label>
              <input className={inp} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Preview text (optional)</label>
              <input className={inp} value={previewText} onChange={(e) => setPreviewText(e.target.value)} placeholder="Shown as the inbox preview snippet" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">HTML body</label>
              <textarea rows={16} className={`${inp} font-mono text-xs leading-relaxed`} value={html} onChange={(e) => setHtml(e.target.value)} />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Merge tags</div>
              <p className="text-[11px] text-slate-400 mb-2">Click to copy. Values are HTML-escaped automatically.</p>
              <div className="flex flex-wrap gap-1">
                {template.variables.map((v) => <MergeTag key={v} tag={v} />)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Send test</div>
              {testKind ? (
                <>
                  <input className={inp} placeholder="you@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                  <button onClick={sendTest} disabled={sendingTest} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                    {sendingTest ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Send test
                  </button>
                  <p className="text-[10px] text-slate-500">Uses the live queue — saves first if you want to test edits.</p>
                </>
              ) : (
                <p className="text-[11px] text-slate-500">No live trigger wired yet. Edit and enable now; it will be used once the app calls this template.</p>
              )}
            </div>
          </aside>
        </div>

        {preview && (
          <div className="border-t border-slate-800 p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Preview</div>
              <button onClick={() => setPreview(null)} className="text-xs text-slate-400 hover:text-white">Close preview</button>
            </div>
            <div className="rounded-xl border border-slate-800 bg-white overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">Subject: {preview.subject}</div>
              <iframe title="preview" srcDoc={preview.html} className="w-full h-[420px] bg-white" sandbox="" />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={runPreview} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800">
              <Eye className="h-3 w-3" /> Preview
            </button>
            {template.source === "db" && (
              <button onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800">
                <RotateCcw className="h-3 w-3" /> Reset to default
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">Cancel</button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MergeTag({ tag }: { tag: string }) {
  const [copied, setCopied] = useState(false);
  const value = useMemo(() => `{{${tag}}}`, [tag]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { toast.error("Copy failed"); }
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-300 hover:border-primary hover:text-white"
    >
      {copied ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />} {value}
    </button>
  );
}
