import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  adminBirdHistory,
  adminBirdReview,
  adminBirdSend,
  adminBirdStatus,
} from "@/lib/bird.functions";
import { InquiryReplyPanel } from "@/components/admin/inquiry-reply-panel";
import {
  SesComposerSection,
  SesLogPanel,
  SesSendAction,
  type DraftFile,
} from "@/components/admin/ses-panel";
import { CustomerRecordDrawer } from "@/components/admin/customer-workspace";
import { PageHeader, Surface } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/email")({
  validateSearch: (s) =>
    z.object({ to: z.string().optional(), returnToCustomer: z.string().optional() }).parse(s),
  component: AdminEmailPage,
});
function AdminEmailPage() {
  const { to, returnToCustomer } = Route.useSearch();
  const qc = useQueryClient();
  const [view, setView] = useState("compose");
  const [provider, setProvider] = useState("bird");
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [category, setCategory] = useState<"transactional" | "marketing">("transactional");
  const [recipientText, setRecipientText] = useState(to ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<DraftFile[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const statusFn = useServerFn(adminBirdStatus),
    reviewFn = useServerFn(adminBirdReview),
    sendFn = useServerFn(adminBirdSend),
    historyFn = useServerFn(adminBirdHistory);
  const status = useQuery({ queryKey: ["bird-status"], queryFn: () => statusFn(), retry: false });
  async function recheckBirdSettings() {
    try {
      const result = await status.refetch({ throwOnError: true });
      if (!result.data) throw new Error("No settings returned");
      if (result.data.configured)
        toast.success(
          "Bird server settings checked. Verify your sending domain in Bird before sending.",
        );
      else toast.info("Check complete: Bird setup still needs attention. See the settings below.");
    } catch {
      toast.error(
        "Could not check Bird settings. Refresh the page and sign in again if needed, then retry.",
      );
    }
  }
  const history = useQuery({
    queryKey: ["bird-history"],
    queryFn: () => historyFn(),
    enabled: view === "history",
  });
  const recipients = [
    ...new Set(
      recipientText
        .split(/[\s,;]+/)
        .filter(Boolean)
        .map((r) => r.toLowerCase()),
    ),
  ];
  const valid =
    recipients.length > 0 &&
    recipients.length <= (mode === "single" ? 1 : 100) &&
    recipients.every((r) => z.string().email().safeParse(r).success);
  useEffect(() => {
    if (to) {
      setRecipientText(to);
      setMode("single");
      setView("compose");
    }
  }, [to]);
  useEffect(() => {
    setConfirmed(false);
    setConsent(false);
    setRequestId(crypto.randomUUID());
  }, [recipientText, subject, body, files, mode, category, provider]);
  const review = useQuery({
    queryKey: ["bird-review", recipients.join(",")],
    queryFn: () => reviewFn({ data: { recipients } }),
    enabled: reviewOpen && valid && provider === "bird",
    retry: false,
  });
  const drafts = useQuery({
    queryKey: ["admin-email-drafts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("admin_email_drafts")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const row = {
        mode,
        to_email: recipientText.trim() || null,
        audience: [`provider:${provider}`, `category:${category}`],
        subject,
        body,
        attachments: files,
      };
      const query = (supabase as any).from("admin_email_drafts");
      const { data, error } = draftId
        ? await query.update(row).eq("id", draftId).select("id").single()
        : await query.insert(row).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      setDraftId(id);
      toast.success("Draft saved. Nothing sent.");
      void qc.invalidateQueries({ queryKey: ["admin-email-drafts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeDraft = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("admin_manage_records", {
        p_action: "delete",
        p_table: "admin_email_drafts",
        p_ids: [id],
      });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      if (draftId === id) setDraftId(null);
      void qc.invalidateQueries({ queryKey: ["admin-email-drafts"] });
      toast.success("Draft moved to Trash. Restore it in Records & Trash.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const send = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          requestId,
          recipients,
          subject,
          body,
          category,
          consentConfirmed: consent,
          confirmed: true,
          files,
        },
      }),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["bird-history"] });
      if (result.ok) {
        toast.success(`${result.count} email(s) accepted by Bird. Delivery is pending.`);
        if (result.warning) toast.warning(result.warning);
        setReviewOpen(false);
        setView("history");
      } else toast.error(result.reason);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const load = (draft: any) => {
    setDraftId(draft.id);
    setMode(draft.mode);
    setRecipientText(draft.to_email ?? "");
    setSubject(draft.subject);
    setBody(draft.body);
    setFiles(draft.attachments ?? []);
    setProvider(draft.audience?.includes("provider:ses") ? "ses" : "bird");
    setCategory(
      draft.mode === "bulk" || draft.audience?.includes("category:marketing")
        ? "marketing"
        : "transactional",
    );
    setView("compose");
  };
  const reset = () => {
    setDraftId(null);
    setRecipientText(to ?? "");
    setSubject("");
    setBody("");
    setFiles([]);
    setView("compose");
    setMode("single");
    setCategory("transactional");
    setProvider("bird");
  };
  const attach = async (list: FileList | null) => {
    if (!list) return;
    setBusy(true);
    let next = [...files];
    try {
      for (const file of Array.from(list)) {
        if (
          next.length >= 5 ||
          next.reduce((s, f) => s + f.size, 0) + file.size > 10 * 1024 * 1024
        ) {
          toast.error("Up to 5 files, 10 MB total. Use a download link for larger files.");
          break;
        }
        const name = file.name.replace(/[^\w.\- ]/g, "_").slice(-100),
          path = `uploads/${crypto.randomUUID()}-${name}`;
        const { error } = await supabase.storage
          .from("email-attachments")
          .upload(path, file, { upsert: false });
        if (error) throw error;
        next.push({ path, name: file.name, size: file.size });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setFiles(next);
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const canSend =
    status.data?.configured &&
    review.data &&
    review.data.every((r) => !r.problem) &&
    confirmed &&
    (category !== "marketing" || consent);
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader
        breadcrumb="Workspace"
        title="Email"
        description="Write, review and follow up from one workspace."
        actions={
          <Button size="sm" variant="outline" onClick={reset}>
            New email
          </Button>
        }
      />
      {returnToCustomer && (
        <Button size="sm" variant="ghost" className="w-fit" onClick={() => setCustomerOpen(true)}>
          Back to customer
        </Button>
      )}
      <div className="flex shrink-0 gap-1 overflow-x-auto" aria-label="Email workspace">
        {["compose", "drafts", "history", "inquiries", "settings"].map((v) => (
          <Button
            key={v}
            size="sm"
            variant={view === v ? "default" : "outline"}
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className="capitalize"
          >
            {v}
          </Button>
        ))}
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/email-templates">Templates</Link>
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {view === "compose" && (
          <Surface className="flex min-h-0 flex-col gap-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1">
                {(["single", "bulk"] as const).map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant={mode === m ? "default" : "outline"}
                    aria-pressed={mode === m}
                    onClick={() => {
                      setMode(m);
                      if (m === "bulk") {
                        setCategory("marketing");
                        setProvider("bird");
                      }
                    }}
                  >
                    {m === "single" ? "One person" : "Bulk email"}
                  </Button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {provider === "bird" ? "Bird" : "Amazon SES"} ·{" "}
                {provider === "bird" && !status.data?.configured
                  ? "Setup needed"
                  : "Review before sending"}
              </span>
            </div>
            <div className="space-y-1">
              <Label htmlFor="email-recipient">{mode === "single" ? "To" : "Recipients"}</Label>
              {mode === "single" ? (
                <Input
                  id="email-recipient"
                  type="email"
                  value={recipientText}
                  onChange={(e) => setRecipientText(e.target.value)}
                  placeholder="name@example.com"
                />
              ) : (
                <Textarea
                  id="email-recipient"
                  rows={2}
                  value={recipientText}
                  onChange={(e) => setRecipientText(e.target.value)}
                  placeholder="Paste up to 100 customer emails, separated by commas or lines"
                />
              )}
            </div>
            {mode === "bulk" && (
              <p className="text-xs text-muted-foreground">
                Choose only contacts who agreed to marketing. Each person receives a separate email
                with unsubscribe protection. No contact lists are imported automatically.
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={subject}
                maxLength={200}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email-body">Message</Label>
              <Textarea
                id="email-body"
                rows={5}
                value={body}
                maxLength={20000}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            {provider === "bird" ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInput}
                    aria-label="Attach email files"
                    type="file"
                    accept=".pdf,.txt,.docx,.png,.jpg,.jpeg,.webp,.mp3,.wav"
                    multiple
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => void attach(e.target.files)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || files.length >= 5}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Paperclip className="mr-1 h-4 w-4" />
                    {busy ? "Uploading…" : "Attach files"}
                  </Button>
                  <span className="text-xs text-muted-foreground">Up to 5 files · 10 MB total</span>
                </div>
                {files.map((f) => (
                  <div key={f.path} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate">
                      {f.name} · {(f.size / 1048576).toFixed(1)} MB
                    </span>
                    <button
                      aria-label={`Remove ${f.name}`}
                      onClick={() => setFiles(files.filter((x) => x.path !== f.path))}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {mode === "single" && (
                  <label className="flex items-center gap-2 text-xs">
                    <span>Purpose</span>
                    <select
                      aria-label="Email purpose"
                      className="rounded border border-border bg-card p-2"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as typeof category)}
                    >
                      <option value="transactional">Customer matter</option>
                      <option value="marketing">Marketing / promotion</option>
                    </select>
                  </label>
                )}
              </>
            ) : (
              <SesComposerSection
                files={files}
                setFiles={setFiles}
                purpose="personal"
                setPurpose={() => {}}
              />
            )}
            {provider === "bird" && !status.data?.configured && (
              <p className="text-xs text-muted-foreground">
                Drafts and attachments are available. Configure Bird under Settings before sending.
              </p>
            )}
            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card pt-3">
              <span className="text-xs text-muted-foreground">
                {recipients.length} recipient(s) · {files.length} file(s)
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={save.isPending || busy}
                  onClick={() => save.mutate()}
                >
                  Save draft
                </Button>
                <Button
                  size="sm"
                  disabled={!valid || !subject.trim() || !body.trim() || busy}
                  onClick={() => setReviewOpen(true)}
                >
                  Review email
                </Button>
              </div>
            </div>
          </Surface>
        )}
        {view === "drafts" && (
          <Surface className="space-y-2 p-4">
            <h2 className="font-semibold">Saved drafts</h2>
            {drafts.isError ? (
              <p>
                Could not load drafts. <button onClick={() => void drafts.refetch()}>Retry</button>
              </p>
            ) : !drafts.data?.length ? (
              <p className="text-sm text-muted-foreground">No drafts yet.</p>
            ) : (
              drafts.data.map((d) => (
                <div key={d.id} className="flex gap-2">
                  <Button
                    variant="outline"
                    className="min-w-0 flex-1 justify-start truncate"
                    onClick={() => load(d)}
                  >
                    {d.subject || "Untitled draft"} ·{" "}
                    {d.mode === "bulk" ? "Bulk" : d.to_email || "No recipient"}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={removeDraft.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          "Move this saved draft to Trash? Restore it in Records & Trash. Attachments remain available.",
                        )
                      )
                        removeDraft.mutate(d.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              ))
            )}
          </Surface>
        )}
        {view === "history" && (
          <Surface className="space-y-3 p-4">
            <div className="flex justify-between">
              <h2 className="font-semibold">Bird history</h2>
              <Button size="sm" variant="outline" onClick={() => void history.refetch()}>
                Refresh
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Accepted means Bird queued the message; it does not confirm delivery or inbox
              placement. Check recipient outcomes in Bird.
            </p>
            {history.isError ? (
              <p>Could not load history.</p>
            ) : !history.data?.length ? (
              <p className="text-sm text-muted-foreground">No Bird sends yet.</p>
            ) : (
              history.data.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span>{r.recipient_email}</span>
                    <span>{r.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(r.metadata as any)?.subject} · {new Date(r.created_at).toLocaleString()}
                  </p>
                  {r.error_message && <p className="text-xs text-destructive">{r.error_message}</p>}
                </div>
              ))
            )}
            <a
              className="text-sm text-primary hover:underline"
              href="https://bird.com/dashboard"
              target="_blank"
              rel="noreferrer"
            >
              Open Bird delivery logs
            </a>
            <details>
              <summary className="cursor-pointer text-sm">Amazon SES history</summary>
              <SesLogPanel />
            </details>
          </Surface>
        )}
        {view === "inquiries" && (
          <Surface className="p-4">
            <InquiryReplyPanel />
          </Surface>
        )}
        {view === "settings" && (
          <Surface className="space-y-4 p-4">
            <h2 className="font-semibold">Email providers</h2>
            <p className="text-sm text-muted-foreground">
              Bird is the primary provider. Amazon SES is optional for one-person customer matters.
            </p>
            <label className="flex items-center gap-2 text-sm">
              Compose with
              <select
                aria-label="Email provider"
                className="rounded border border-border bg-card p-2"
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  if (e.target.value === "ses") {
                    setMode("single");
                    setCategory("transactional");
                  }
                }}
              >
                <option value="bird">Bird</option>
                <option value="ses">Amazon SES (optional)</option>
              </select>
            </label>
            <div role="status" aria-live="polite" className="space-y-2 text-sm">
              <p>
                {status.isFetching
                  ? "Checking Bird server settings…"
                  : status.isError
                    ? "Could not check Bird settings. Refresh the page and sign in again if needed, then retry."
                    : status.data?.reason}
              </p>
              {!status.isFetching && !status.isError && status.data?.missing.length ? (
                <p>Missing server secrets: {status.data.missing.join(", ")}</p>
              ) : null}
              {!status.isFetching &&
                !status.isError &&
                status.data?.issues.map((issue) => <p key={issue}>{issue}</p>)}
              {status.dataUpdatedAt > 0 && (
                <p className="text-xs text-muted-foreground">
                  Last successful check: {new Date(status.dataUpdatedAt).toLocaleTimeString()}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              This checks this site's server configuration. It does not verify DNS or send an email.
              Verify your sending domain in Bird.
            </p>
            <details>
              <summary className="cursor-pointer text-sm">Bird setup checklist</summary>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Add your sending domain in Bird and verify its DNS records.</li>
                <li>
                  Save BIRD_API_KEY, BIRD_FROM_EMAIL and BIRD_REGION (us1 or eu1) as server secrets
                  in Lovable Cloud. Keep keys out of chat and browser code.
                </li>
                <li>
                  Recheck settings, then test delivery to your own address before contacting
                  customers.
                </li>
              </ol>
              {status.data?.missing.length ? (
                <p className="mt-2 text-xs">Missing: {status.data.missing.join(", ")}</p>
              ) : null}
            </details>
            <Button
              size="sm"
              variant="outline"
              disabled={status.isFetching}
              onClick={() => void recheckBirdSettings()}
            >
              {status.isFetching && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {status.isFetching ? "Checking settings…" : "Recheck Bird settings"}
            </Button>
            <a
              className="block text-sm text-primary"
              href="https://bird.com/dashboard"
              target="_blank"
              rel="noreferrer"
            >
              Open Bird
            </a>
          </Surface>
        )}
      </div>
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[90dvh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Review email</DialogTitle>
            <DialogDescription>
              {provider === "bird" ? "Bird" : "Amazon SES"} · {recipients.length} recipient(s) ·{" "}
              {files.length} attachment(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="max-h-24 overflow-auto break-words">To: {recipients.join(", ")}</div>
            <strong>{subject}</strong>
            <p className="max-h-48 overflow-auto whitespace-pre-wrap">{body}</p>
            {files.map((f) => (
              <p key={f.path} className="text-xs">
                Attachment: {f.name}
              </p>
            ))}
            {provider === "ses" ? (
              <SesSendAction
                to={recipients[0] ?? ""}
                subject={subject}
                body={body}
                purpose="personal"
                files={files}
                onSent={() => setReviewOpen(false)}
              />
            ) : (
              <>
                <p className="text-xs">From: {status.data?.from ?? "Sender not configured"}</p>
                {review.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : review.isError ? (
                  <p className="text-destructive">Recipient checks failed. Nothing will be sent.</p>
                ) : (
                  review.data
                    ?.filter((r) => r.problem)
                    .map((r) => (
                      <p key={r.email} className="text-destructive">
                        {r.email}: {r.problem}
                      </p>
                    ))
                )}
                {category === "marketing" && (
                  <label className="flex items-start gap-2">
                    <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
                    <span>
                      Every recipient gave permission to receive this marketing message. Bird adds
                      unsubscribe links and honors its suppressions.
                    </span>
                  </label>
                )}
                <label className="flex items-start gap-2">
                  <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
                  <span>I reviewed the recipients, purpose, message and files. Send now.</span>
                </label>
                {!status.data?.configured && (
                  <p className="text-xs text-muted-foreground">
                    Bird setup is incomplete. Save your draft and open Settings.
                  </p>
                )}
                <Button
                  className="w-full"
                  disabled={!canSend || send.isPending}
                  onClick={() => send.mutate()}
                >
                  {send.isPending ? "Submitting…" : "Send via Bird"}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Back to edit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {customerOpen && returnToCustomer && (
        <CustomerRecordDrawer email={returnToCustomer} onClose={() => setCustomerOpen(false)} />
      )}
    </div>
  );
}
