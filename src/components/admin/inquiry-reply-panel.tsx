import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Reply } from "lucide-react";
import { toast } from "sonner";
import { adminListInquiries, adminSendInquiryReply } from "@/lib/inquiry-reply.functions";
import { Surface } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const fmt = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Personal reply to ONE specific prior inquiry. Recipient is fixed to that inquiry's email. */
export function InquiryReplyPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListInquiries);
  const sendFn = useServerFn(adminSendInquiryReply);
  const q = useQuery({ queryKey: ["admin-inquiries-for-reply"], queryFn: () => listFn() });
  const [key, setKey] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [review, setReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const sel = q.data?.inquiries.find((i) => `${i.source}:${i.id}` === key) ?? null;

  const send = useMutation({
    mutationFn: () => sendFn({ data: { source: sel!.source, sourceId: sel!.id, confirmEmail: sel!.email, subject, body, confirmed: true } }),
    onSuccess: (r) => {
      if (r.ok) { toast.success(`Reply sent to ${sel?.email}`); setReview(false); setBody(""); setSubject(""); setKey(""); }
      else toast.error(r.reason ?? "Not sent.");
      qc.invalidateQueries({ queryKey: ["admin-inquiries-for-reply"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Surface className="space-y-3 p-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Reply className="h-4 w-4" />Reply to an inquiry</h2>
        <p className="text-xs text-muted-foreground">Sends one personal reply to the person who contacted you. Only for answering their inquiry — not for promotions.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ir-pick">Inquiry</Label>
        <select id="ir-pick" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={key}
          onChange={(e) => { setKey(e.target.value); setConfirmed(false); const i = q.data?.inquiries.find((x) => `${x.source}:${x.id}` === e.target.value); if (i && !subject) setSubject(`Re: your ${i.source === "access_applications" ? "application" : "inquiry"}`); }}>
          <option value="">{q.isLoading ? "Loading…" : "Choose an inquiry…"}</option>
          {(q.data?.inquiries ?? []).map((i) => (
            <option key={`${i.source}:${i.id}`} value={`${i.source}:${i.id}`}>
              {fmt(i.at)} · {i.name || i.email} · {i.context}{i.lastReply ? ` · last reply ${i.lastReply.status}` : ""}
            </option>
          ))}
        </select>
        {sel && <p className="text-xs text-muted-foreground">To: <strong className="text-foreground">{sel.email}</strong> (fixed to this inquiry)</p>}
      </div>
      <div className="space-y-1.5"><Label htmlFor="ir-subj">Subject</Label><Input id="ir-subj" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="ir-body">Reply</Label><Textarea id="ir-body" rows={6} maxLength={10000} value={body} onChange={(e) => setBody(e.target.value)} /></div>
      <div className="flex justify-end">
        <Button onClick={() => { setConfirmed(false); setReview(true); }} disabled={!sel || !subject.trim() || !body.trim()}>Review reply</Button>
      </div>

      <Dialog open={review} onOpenChange={setReview}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review reply</DialogTitle>
            <DialogDescription>Check everything before sending. This can't be undone.</DialogDescription>
          </DialogHeader>
          {sel && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-border p-3 text-xs">
                <div><span className="text-muted-foreground">To:</span> {sel.email}</div>
                <div><span className="text-muted-foreground">Replying to:</span> {sel.context} from {fmt(sel.at)}</div>
                <div><span className="text-muted-foreground">Subject:</span> {subject}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-muted-foreground">{sel.name ? `Hi ${sel.name},` : "Hi there,"}</p>
                <p className="mt-2 whitespace-pre-wrap">{body}</p>
                <p className="mt-3 text-xs text-muted-foreground">A short note explaining why they're getting this, and an unsubscribe link, are added automatically. Their reply comes to your email.</p>
              </div>
              <label className="flex items-start gap-2 text-xs">
                <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
                <span>Send this personal reply to <strong>{sel.email}</strong> about their inquiry.</span>
              </label>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReview(false)}>Back to edit</Button>
            <Button disabled={!confirmed || send.isPending} onClick={() => send.mutate()}>
              {send.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Surface>
  );
}
