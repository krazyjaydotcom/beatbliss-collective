import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/gift")({
  component: AdminGiftPage,
});

function AdminGiftPage() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [amount, setAmount] = useState("10");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: results, isFetching } = useQuery({
    queryKey: ["gift-search", q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name, full_name, credits_balance, subscription_tier")
        .or(`email.ilike.%${q}%,display_name.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  async function handleGift(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const amt = parseInt(amount);
    if (!amt) { toast.error("Enter a non-zero amount"); return; }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("admin_gift_credits", {
      _user_id: selected.id, _amount: amt, _note: note || undefined,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`Gifted ${amt} credits to ${selected.email}. New balance: ${(data as any)?.new_balance}`);
    setSelected({ ...selected, credits_balance: (data as any)?.new_balance });
    setNote("");
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Gift credits</h1>
        <p className="text-muted-foreground mt-1">Search a member, then add (or remove) credits</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <Label className="text-xs">Search member by email or name</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" value={q} onChange={(e) => { setQ(e.target.value); setSelected(null); }} placeholder="jane@example.com" />
        </div>
        {q.length >= 2 && (
          <div className="border border-border rounded-lg divide-y divide-border max-h-64 overflow-auto">
            {isFetching && <div className="p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Searching…</div>}
            {results?.map((p: any) => (
              <button key={p.id} type="button" onClick={() => setSelected(p)}
                className={`w-full text-left p-3 hover:bg-muted/40 ${selected?.id === p.id ? "bg-muted/60" : ""}`}>
                <div className="font-medium text-sm">{p.display_name || p.full_name || "—"}</div>
                <div className="text-xs text-muted-foreground">{p.email} · {p.credits_balance} credits · {p.subscription_tier}</div>
              </button>
            ))}
            {results?.length === 0 && !isFetching && <div className="p-3 text-sm text-muted-foreground">No members found.</div>}
          </div>
        )}
      </div>

      {selected && (
        <form onSubmit={handleGift} className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Gift className="h-4 w-4" />
            Gifting to <strong>{selected.email}</strong> (current: {selected.credits_balance})
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Amount (use negative to remove)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bonus for early signup" />
            </div>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</> : `Gift ${amount} credits`}
          </Button>
        </form>
      )}
    </div>
  );
}
