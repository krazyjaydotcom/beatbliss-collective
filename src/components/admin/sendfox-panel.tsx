import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { sendfoxCreateDraft, sendfoxLists, sendfoxStatus } from "@/lib/sendfox.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REASONS: Record<string, string> = {
  missing_token: "No SendFox access token is saved yet.",
  invalid_token: "SendFox rejected the saved access token. Create a new one and replace it.",
  no_api_access: "SendFox says this account can't use the API. It needs a Lifetime or Empire plan.",
  rate_limited: "SendFox is limiting requests right now. Try again in a minute.",
  network: "Couldn't reach SendFox. Try again shortly.",
  list_mismatch: "That list changed in SendFox. Pick it again and re-review.",
  validation: "SendFox rejected the draft. Check the sender address and subject.",
};
const why = (r?: string | null) => (r && REASONS[r]) || "SendFox isn't available right now.";

export function useSendfoxStatus() {
  const fn = useServerFn(sendfoxStatus);
  return useQuery({ queryKey: ["sendfox-status"], queryFn: () => fn(), staleTime: 60_000 });
}

export function SendfoxPanel({ listId, onList }: { listId: number | null; onList: (l: { id: number; name: string; subscribed: number } | null) => void }) {
  const status = useSendfoxStatus();
  const listsFn = useServerFn(sendfoxLists);
  const connected = status.data?.connected === true;
  const lists = useQuery({ queryKey: ["sendfox-lists"], queryFn: () => listsFn(), enabled: connected });

  return (
    <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <PlugZap className="h-4 w-4" /> SendFox
        {status.isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : connected ? (
          <span className="flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="h-3.5 w-3.5" />Connected{status.data?.connected && status.data.account.email ? ` · ${status.data.account.email}` : ""}</span>
        ) : <span className="text-xs text-muted-foreground">Not connected</span>}
      </div>
      {!status.isLoading && !connected && (
        <p className="text-xs text-muted-foreground">{why(status.data && !status.data.connected ? status.data.reason : null)} Bulk emails are prepared here and sent from SendFox to one of your SendFox lists.</p>
      )}
      {connected && (
        <div className="space-y-1.5">
          <Label htmlFor="sf-list" className="text-xs">Audience: SendFox list (who receives it)</Label>
          <select
            id="sf-list"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={listId ?? ""}
            onChange={(e) => {
              const l = lists.data?.lists.find((x) => x.id === Number(e.target.value));
              onList(l ? { id: l.id, name: l.name, subscribed: l.subscribed } : null);
            }}
          >
            <option value="">Choose a list…</option>
            {(lists.data?.lists ?? []).map((l) => (
              <option key={l.id} value={l.id}>{l.name} · {l.subscribed} subscribed</option>
            ))}
          </select>
          {lists.data?.reason && <p className="text-xs text-destructive">{why(lists.data.reason)}</p>}
          <p className="text-xs text-muted-foreground">Only people already subscribed to this SendFox list receive it. SendFox adds its own unsubscribe link and skips unsubscribed contacts. Site customers are not copied into SendFox.</p>
        </div>
      )}
    </div>
  );
}

/** Review-step action: creates a SendFox DRAFT only. Sending happens later, deliberately, in SendFox. */
export function SendfoxDraftAction({ list, subject, body }: { list: { id: number; name: string } | null; subject: string; body: string }) {
  const status = useSendfoxStatus();
  const create = useServerFn(sendfoxCreateDraft);
  const [fromName, setFromName] = useState("MYBEATCATALOG");
  const [fromEmail, setFromEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const m = useMutation({
    mutationFn: () => create({ data: { listId: list!.id, confirmedListName: list!.name, subject, body, fromName, fromEmail } }),
    onSuccess: (r) => (r.ok ? toast.success(`Draft created in SendFox (#${r.campaignId}). Nothing was sent.`) : toast.error(why(r.reason))),
    onError: (e: any) => toast.error(e.message),
  });

  if (!status.data?.connected) return <p className="text-xs text-muted-foreground">Connect SendFox to prepare bulk drafts there. Sending isn't available from this page.</p>;
  if (!list) return <p className="text-xs text-muted-foreground">Choose a SendFox list on the compose screen first.</p>;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fromEmail);
  return (
    <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="sf-fn" className="text-xs">From name</Label><Input id="sf-fn" value={fromName} onChange={(e) => setFromName(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="sf-fe" className="text-xs">From email (verified in SendFox)</Label><Input id="sf-fe" type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} /></div>
      </div>
      <label className="flex items-start gap-2 text-xs">
        <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
        <span>I reviewed this message and the SendFox list <strong>{list.name}</strong>. Create it as a draft only — it will not be sent.</span>
      </label>
      <Button size="sm" variant="outline" disabled={!confirmed || !emailOk || !fromName.trim() || m.isPending} onClick={() => m.mutate()}>
        {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create SendFox draft (not sent)
      </Button>
    </div>
  );
}
