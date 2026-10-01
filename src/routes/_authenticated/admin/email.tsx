import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AlertTriangle, FileText, Loader2, Paperclip, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { adminPreviewAudience, AUDIENCES, type Audience } from "@/lib/admin-email.functions";
import { PageHeader, Surface, EmptyState } from "@/components/admin/ui";
import { InquiryReplyPanel } from "@/components/admin/inquiry-reply-panel";
import { SesComposerSection, SesLogPanel, SesSendAction, type DraftFile, type Purpose } from "@/components/admin/ses-panel";
import { fmtSubscribed, SendfoxDraftAction, SendfoxPanel, type SendfoxList } from "@/components/admin/sendfox-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/email")({
  validateSearch: (s) => z.object({ to: z.string().optional() }).parse(s),
  component: AdminEmailPage,
});

const AUDIENCE_LABEL: Record<Audience, string> = {
  clients: "Clients (paid orders)",
  leads: "Free-download leads",
  members: "Active members",
  prospects: "CRM prospects",
};

function AdminEmailPage() {
  const { to } = Route.useSearch();
  const qc = useQueryClient();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [sfList, setSfList] = useState<SendfoxList | null>(null);
  const [toEmail, setToEmail] = useState(to ?? "");
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [files, setFiles] = useState<DraftFile[]>([]);
  const [purpose, setPurpose] = useState<Purpose>("personal");
  const preview = useServerFn(adminPreviewAudience);

  useEffect(() => { if (to) { setMode("single"); setToEmail(to); } }, [to]);

  const drafts = useQuery({
    queryKey: ["admin-email-drafts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("admin_email_drafts").select("*").order("updated_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  const audienceQ = useQuery({
    queryKey: ["admin-email-audience", [...audiences].sort().join(",")],
    queryFn: () => preview({ data: { audiences } }),
    enabled: mode === "bulk" && audiences.length > 0,
  });

  const save = useMutation({
    mutationFn: async () => {
      const row = { mode, to_email: mode === "single" ? toEmail.trim() || null : null, audience: audiences, subject, body, attachments: mode === "single" ? files : [] };
      const q = (supabase as any).from("admin_email_drafts");
      const { data, error } = draftId ? await q.update(row).eq("id", draftId).select("id").single() : await q.insert(row).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => { setDraftId(id); toast.success("Draft saved"); qc.invalidateQueries({ queryKey: ["admin-email-drafts"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeDraft = async (id: string) => {
    if (!confirm("Delete this draft?")) return;
    const d = (drafts.data ?? []).find((x) => x.id === id);
    const { error } = await (supabase as any).from("admin_email_drafts").delete().eq("id", id);
    const paths = ((d?.attachments ?? []) as any[]).map((a) => a?.path).filter(Boolean);
    if (!error && paths.length) await supabase.storage.from("email-attachments").remove(paths);
    if (error) return toast.error(error.message);
    if (id === draftId) setDraftId(null);
    qc.invalidateQueries({ queryKey: ["admin-email-drafts"] });
  };

  const load = (d: any) => {
    setDraftId(d.id); setMode(d.mode); setToEmail(d.to_email ?? ""); setAudiences(d.audience ?? []);
    setSubject(d.subject); setBody(d.body);
    setFiles(((d.attachments ?? []) as any[]).filter((a) => a?.path && a?.name).map((a) => ({ path: a.path, name: a.name, size: Number(a.size) || 0 })));
  };
  const reset = () => { setDraftId(null); setToEmail(""); setAudiences([]); setSubject(""); setBody(""); setFiles([]); };

  const singleValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(toEmail.trim());
  const count = mode === "single" ? (singleValid ? 1 : 0) : (sfList?.subscribed ?? 0);
  const canReview = (mode === "single" ? singleValid : !!sfList) && subject.trim() && body.trim();

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb="Marketing"
        title="Email"
        description="SendFox for bulk campaign drafts · Amazon SES for one-person emails with attachments · replies to inquiries."
        actions={<Button size="sm" variant="outline" onClick={reset}>New email</Button>}
      />

      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p>
          <strong>Bulk = SendFox drafts only</strong> (sent from inside SendFox). <strong>One person</strong> can be sent via
          Amazon SES with real attachments, only after review and confirmation. Inquiry replies use their own panel.
          Saving or previewing never sends.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Surface className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary/50 p-1" role="tablist">
            {(["single", "bulk"] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                className={"min-h-10 rounded-md text-sm font-semibold " + (mode === m ? "bg-card text-primary" : "text-muted-foreground")}>
                {m === "single" ? "One person" : "Bulk"}
              </button>
            ))}
          </div>

          {mode === "single" ? (
            <div className="space-y-1.5">
              <Label htmlFor="em-to">To</Label>
              <Input id="em-to" type="email" value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="name@example.com" />
            </div>
          ) : (
            <div className="space-y-3">
              <SendfoxPanel listId={sfList?.id ?? null} onList={setSfList} />
              <details className="rounded-lg border border-dashed border-border p-3 text-sm">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Site groups (local reference only · not synced to SendFox)</summary>
                <p className="mt-2 text-xs text-muted-foreground">These groups are saved with the draft for your notes. They don't change who receives a SendFox campaign, and no one is copied into SendFox.</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {AUDIENCES.map((a) => (
                    <label key={a} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm">
                      <Checkbox checked={audiences.includes(a)}
                        onCheckedChange={(v) => setAudiences((s) => (v ? [...s, a] : s.filter((x) => x !== a)))} />
                      {AUDIENCE_LABEL[a]}
                    </label>
                  ))}
                </div>
                {audiences.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {audienceQ.isLoading ? "Counting…" : audienceQ.isError ? "Could not load site contacts." :
                      `${audienceQ.data?.recipients.length ?? 0} site contacts in these groups (reference only).`}
                  </p>
                )}
              </details>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="em-subj">Subject</Label>
            <Input id="em-subj" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="em-body">Message</Label>
            <Textarea id="em-body" rows={9} value={body} maxLength={20000} onChange={(e) => setBody(e.target.value)} />
          </div>

          {mode === "single" ? (
            <SesComposerSection files={files} setFiles={setFiles} purpose={purpose} setPurpose={setPurpose} />
          ) : (
          <div className="flex items-start gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            <Paperclip className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong className="text-foreground">Files: unavailable.</strong> SendFox can't attach files on any plan. It can only
              include links. File uploads stay off until private storage and expiring, per-recipient download links are built.
              Bulk drafts save text only.
            </p>
          </div>

          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">
              {mode === "bulk"
                ? sfList ? `SendFox · ${sfList.name} · ${fmtSubscribed(sfList.subscribed)}` : "Choose a SendFox list"
                : `${count} recipient${count === 1 ? "" : "s"}${files.length ? ` · ${files.length} file${files.length === 1 ? "" : "s"}` : ""}`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save draft
              </Button>
              <Button onClick={() => setReviewOpen(true)} disabled={!canReview}>Review send</Button>
            </div>
          </div>
        </Surface>

        <div className="space-y-4">
        {mode === "single" && <InquiryReplyPanel />}
        {mode === "single" && <Surface className="p-4"><SesLogPanel /></Surface>}
        <Surface className="p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Drafts</h2>
          {drafts.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (drafts.data ?? []).length === 0 ? (
            <EmptyState title="No drafts yet" />
          ) : (
            <ul className="space-y-1">
              {drafts.data!.map((d) => (
                <li key={d.id} className={"flex items-center gap-2 rounded-lg px-2 py-2 text-sm " + (d.id === draftId ? "bg-primary/10" : "hover:bg-secondary/50")}>
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => load(d)}>
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{d.subject || "(no subject)"}</span>
                      <span className="block truncate text-xs text-muted-foreground">{d.mode === "single" ? d.to_email ?? "No recipient" : `Bulk · ${(d.audience ?? []).join(", ")}`}</span>
                    </span>
                  </button>
                  <button type="button" aria-label="Delete draft" onClick={() => removeDraft(d.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>
                </li>
              ))}
            </ul>
          )}
        </Surface>
        </div>
      </div>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review email</DialogTitle>
            <DialogDescription>
              {mode === "bulk"
                ? sfList ? `SendFox list "${sfList.name}" · ${fmtSubscribed(sfList.subscribed)} (count reported by SendFox)` : "No SendFox list chosen"
                : "One person · draft in this app, or send via Amazon SES below"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <div className="font-semibold">{subject}</div>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{body}</p>
              {mode === "bulk" && <p className="mt-2 text-xs text-muted-foreground">SendFox adds its own unsubscribe link and skips contacts unsubscribed in SendFox.</p>}
              {mode === "single" && <p className="mt-2 text-xs text-muted-foreground">Never sent through SendFox. Separate from inquiry replies.</p>}
            </div>
            {mode === "bulk" && <SendfoxDraftAction list={sfList} subject={subject} body={body} />}
            {mode === "single" && (
              <SesSendAction to={toEmail} subject={subject} body={body} purpose={purpose} files={files} onSent={() => setReviewOpen(false)} />
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Back to edit</Button>
            {mode === "bulk" && <Button disabled>Send (off — sending happens in SendFox)</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
