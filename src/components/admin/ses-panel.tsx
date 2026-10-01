import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Paperclip, X, XCircle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { adminCleanupEmailUploads, adminSesCheckRecipient, adminSesLog, adminSesSend, adminSesStatus, adminSesValidateFiles } from "@/lib/ses.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export type DraftFile = { path: string; name: string; size: number };
export type Purpose = "personal";

const ACCEPT = ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.mp3,.wav";
const MAX_FILE = 10 * 1024 * 1024, MAX_TOTAL = 20 * 1024 * 1024, MAX_FILES = 5;
export const fmtSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function useSesStatus() {
  const fn = useServerFn(adminSesStatus);
  return useQuery({ queryKey: ["admin-ses-status"], queryFn: () => fn(), staleTime: 60_000 });
}

export function SesComposerSection({ files, setFiles, purpose, setPurpose }: {
  files: DraftFile[]; setFiles: (f: DraftFile[]) => void; purpose: Purpose; setPurpose: (p: Purpose) => void;
}) {
  const status = useSesStatus();
  const cleanup = useServerFn(adminCleanupEmailUploads);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { cleanup().catch(() => {}); }, []); // removes stale unreferenced uploads (>24h)
  const ready = status.data?.ready === true;
  const sd = status.data as any;

  const add = async (list: FileList | null) => {
    if (!list) return;
    let next = [...files];
    setBusy(true);
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) { toast.error(`Up to ${MAX_FILES} files.`); break; }
      if (f.size > MAX_FILE) { toast.error(`${f.name} is over 10 MB.`); continue; }
      if (next.reduce((s, x) => s + x.size, 0) + f.size > MAX_TOTAL) { toast.error("Files can total 20 MB at most."); break; }
      const safe = f.name.replace(/[^\w.\- ]+/g, "_").slice(-100);
      const path = `uploads/${crypto.randomUUID()}-${safe}`;
      const { error } = await supabase.storage.from("email-attachments").upload(path, f, { upsert: false });
      if (error) { toast.error(`${f.name}: ${error.message}`); continue; }
      next = [...next, { path, name: f.name, size: f.size }];
    }
    setFiles(next);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  };
  const remove = async (p: string) => {
    setFiles(files.filter((x) => x.path !== p));
    await supabase.storage.from("email-attachments").remove([p]);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">Amazon SES · one person, real attachments</span>
        {status.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : ready ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />Ready · {sd?.from}</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><XCircle className="h-3.5 w-3.5" />Unavailable</span>
        )}
      </div>
      {!status.isLoading && !ready && (
        <div className="text-xs text-muted-foreground">
          <p>{sd?.reason ?? "Couldn't check SES."} Attachments and sending stay off.</p>
          {sd?.missing?.length > 0 && (
            <p className="mt-1">Missing server settings: {sd.missing.join(", ")}.</p>
          )}
        </div>
      )}
      {ready && sd?.sandbox && <p className="text-xs text-amber-400">SES account is in sandbox mode — it can only send to verified addresses.</p>}

      <p className="text-xs text-muted-foreground">
        Personal / customer matters only — the person must be in your customer records, and unsubscribed or bounced
        addresses are blocked. Promotional email isn't sent through SES; use SendFox for that.
      </p>

      <div>
        <input ref={inputRef} type="file" multiple accept={ACCEPT} className="sr-only" id="ses-files" disabled={!ready || busy} onChange={(e) => add(e.target.files)} />
        <Button type="button" size="sm" variant="outline" disabled={!ready || busy || files.length >= MAX_FILES} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}Attach files
        </Button>
        <span className="ml-2 text-xs text-muted-foreground">PDF, Word, text, images, MP3/WAV · 10 MB each · 20 MB total · max 5</span>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f) => (
              <li key={f.path} className="flex items-center gap-2 rounded border border-border px-2 py-1 text-xs">
                <Paperclip className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-muted-foreground">{fmtSize(f.size)}</span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => remove(f.path)}><X className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Review-step block: server-validated files, consent basis, explicit confirm, then the single SES send. */
export function SesSendAction({ to, subject, body, purpose, files, onSent }: {
  to: string; subject: string; body: string; purpose: Purpose; files: DraftFile[]; onSent: () => void;
}) {
  const status = useSesStatus();
  const qc = useQueryClient();
  const checkFn = useServerFn(adminSesCheckRecipient);
  const validateFn = useServerFn(adminSesValidateFiles);
  const sendFn = useServerFn(adminSesSend);
  const [confirmed, setConfirmed] = useState(false);
  const ready = status.data?.ready === true;
  const sd = status.data as any;
  const email = to.trim().toLowerCase();

  const basis = useQuery({ queryKey: ["ses-basis", email, purpose], queryFn: () => checkFn({ data: { to: email, purpose } }), enabled: ready });
  const vf = useQuery({
    queryKey: ["ses-files", files.map((f) => f.path).join("|")],
    queryFn: () => validateFn({ data: { files: files.map(({ path, name }) => ({ path, name })) } }),
    enabled: ready && files.length > 0,
  });
  const fileProblem = files.length > 0 && (!vf.data || vf.data.overTotal || vf.data.files.some((f) => f.problem));

  const send = useMutation({
    mutationFn: () => sendFn({ data: { to: email, confirmTo: email, subject, body, purpose, files: files.map(({ path, name }) => ({ path, name })), confirmed: true } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["admin-ses-log"] });
      if (r.ok) { toast.success("Sent via Amazon SES"); onSent(); } else toast.error(r.reason);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!ready) return <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">Amazon SES is unavailable, so this stays a draft.</p>;

  return (
    <div className="space-y-2 rounded-lg border border-primary/40 p-3 text-xs">
      <div className="font-semibold text-foreground">Send one email via Amazon SES</div>
      <div>From: {sd?.from} · To: <strong>{email}</strong></div>
      <div>Purpose: Personal / customer matter · Basis:{" "}
        {basis.isLoading ? "checking…" : basis.data?.ok ? basis.data.basis : <span className="text-destructive">{basis.data && !basis.data.ok ? basis.data.reason : "unknown"}</span>}
      </div>
      {files.length > 0 ? (
        <ul className="space-y-0.5">
          {vf.isLoading ? <li>Checking files…</li> : (vf.data?.files ?? []).map((f) => (
            <li key={f.path} className={f.problem ? "text-destructive" : ""}>📎 {f.name} · {fmtSize(f.size)}{f.problem ? ` — ${f.problem}` : " · attached"}</li>
          ))}
          {vf.data?.overTotal && <li className="text-destructive">Total over 20 MB.</li>}
        </ul>
      ) : <div>No attachments.</div>}
      <label className="flex items-start gap-2 pt-1">
        <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} />
        <span>I've reviewed the recipient, subject, message and files. Send this one email now.</span>
      </label>
      <Button size="sm" className="w-full" disabled={!confirmed || !basis.data?.ok || !!fileProblem || send.isPending} onClick={() => send.mutate()}>
        {send.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send via Amazon SES
      </Button>
    </div>
  );
}

export function SesLogPanel() {
  const fn = useServerFn(adminSesLog);
  const q = useQuery({ queryKey: ["admin-ses-log"], queryFn: () => fn() });
  const rows = q.data?.rows ?? [];
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">SES send log</h2>
      {q.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : rows.length === 0 ? <p className="text-xs text-muted-foreground">No SES sends yet.</p> : (
        <ul className="space-y-1 text-xs">
          {rows.map((r: any) => (
            <li key={r.id} className="rounded border border-border px-2 py-1">
              <div className="flex justify-between gap-2"><span className="truncate">{r.to_email}</span>
                <span className={r.status === "sent" ? "text-emerald-400" : r.status === "failed" ? "text-destructive" : "text-muted-foreground"}>{r.status}</span></div>
              <div className="truncate text-muted-foreground">{r.subject} · {(r.attachments ?? []).length} file(s)</div>
              {r.ses_message_id && <div className="truncate text-muted-foreground">ID {r.ses_message_id}</div>}
              {r.error && <div className="truncate text-destructive" title={r.error}>{r.error}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
