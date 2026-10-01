import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AlertTriangle, FileText, Loader2, Paperclip, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { adminPreviewAudience, AUDIENCES, type Audience } from "@/lib/admin-email.functions";
import { PageHeader, Surface, EmptyState } from "@/components/admin/ui";
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
const MAX_FILE = 10 * 1024 * 1024;
const ALLOWED = /^(application\/pdf|image\/(png|jpeg|gif|webp)|audio\/(mpeg|wav|x-wav)|text\/plain|application\/(msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document))$/;
type Att = { name: string; size: number; type: string };
const fmtSize = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.ceil(n / 1024) + " KB");

function AdminEmailPage() {
  const { to } = Route.useSearch();
  const qc = useQueryClient();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [toEmail, setToEmail] = useState(to ?? "");
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [atts, setAtts] = useState<Att[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
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
      const row = { mode, to_email: mode === "single" ? toEmail.trim() || null : null, audience: audiences, subject, body, attachments: atts };
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
    const { error } = await (supabase as any).from("admin_email_drafts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (id === draftId) setDraftId(null);
    qc.invalidateQueries({ queryKey: ["admin-email-drafts"] });
  };

  const load = (d: any) => {
    setDraftId(d.id); setMode(d.mode); setToEmail(d.to_email ?? ""); setAudiences(d.audience ?? []);
    setSubject(d.subject); setBody(d.body);
  };
  const reset = () => { setDraftId(null); setToEmail(""); setAudiences([]); setSubject(""); setBody(""); };

  const singleValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(toEmail.trim());
  const count = mode === "single" ? (singleValid ? 1 : 0) : audienceQ.data?.recipients.length ?? 0;
  const canReview = count > 0 && subject.trim() && body.trim();

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb="Marketing"
        title="Email"
        description="Write one-off or bulk emails, review recipients and save drafts."
        actions={<Button size="sm" variant="outline" onClick={reset}>New email</Button>}
      />

      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p>
          <strong>Drafts only — live sending is off.</strong> Your current email service only sends account and purchase
          emails. Bulk/promotional mail needs a marketing email service connected first. Nothing on this page sends email.
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
            <div className="space-y-2">
              <Label>Audience</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {AUDIENCES.map((a) => (
                  <label key={a} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm">
                    <Checkbox checked={audiences.includes(a)}
                      onCheckedChange={(v) => setAudiences((s) => (v ? [...s, a] : s.filter((x) => x !== a)))} />
                    {AUDIENCE_LABEL[a]}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {audiences.length === 0 ? "Pick at least one group." : audienceQ.isLoading ? "Counting…" : audienceQ.isError ? "Could not load recipients." :
                  `${count} recipients after removing ${audienceQ.data?.duplicates ?? 0} duplicates, ${audienceQ.data?.invalid ?? 0} invalid and ${audienceQ.data?.unsubscribed ?? 0} unsubscribed. Each person gets their own copy.`}
              </p>
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

          <div className="flex items-start gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            <Paperclip className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong className="text-foreground">Files: unavailable.</strong> File attachments and download links can't be
              added until an email service and private file storage are connected. Drafts save text only.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">{count} recipient{count === 1 ? "" : "s"}</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save draft
              </Button>
              <Button onClick={() => setReviewOpen(true)} disabled={!canReview}>Review send</Button>
            </div>
          </div>
        </Surface>

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

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review email</DialogTitle>
            <DialogDescription>{count} recipient{count === 1 ? "" : "s"} · each receives a separate copy.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <div className="font-semibold">{subject}</div>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{body}</p>
              {atts.length > 0 && <p className="mt-2 text-xs">Download links: {atts.map((a) => a.name).join(", ")}</p>}
              {mode === "bulk" && <p className="mt-2 text-xs text-muted-foreground">An unsubscribe link will be added to bulk emails.</p>}
            </div>
            <div>
              <div className="mb-1 font-medium">Recipients</div>
              <ul className="max-h-48 overflow-y-auto rounded-lg border border-border text-xs">
                {(mode === "single" ? [{ email: toEmail.trim(), sources: [] as string[] }] : audienceQ.data?.recipients ?? []).map((r) => (
                  <li key={r.email} className="flex justify-between gap-2 border-b border-border px-3 py-1.5 last:border-0">
                    <span className="truncate">{r.email}</span>
                    <span className="shrink-0 text-muted-foreground">{r.sources.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Back to edit</Button>
            <Button disabled title="Sending is turned off until an email service is connected">Send (not available yet)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
