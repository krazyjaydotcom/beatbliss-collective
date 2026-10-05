import { useMemo, useState } from "react";
import { Copy, ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TIER_META, TIER_ORDER, tierPriceCents, type LicenseTier } from "@/lib/licensing";

type BeatOption = {
  id: string;
  title: string;
  landing_slug: string | null;
  is_active: boolean | null;
  landing_visibility: string | null;
  price_cents: number | null;
  nonexclusive_price_cents: number | null;
  trackout_price_cents: number | null;
};

export function CreatePaymentLink({ beats, initialBeatId }: { beats: BeatOption[]; initialBeatId?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [beatId, setBeatId] = useState(initialBeatId ?? "");
  const [tier, setTier] = useState<LicenseTier>("nonexclusive");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [created, setCreated] = useState(false);
  const eligible = useMemo(() => beats.filter((beat) => beat.is_active && (beat.landing_visibility === "public" || beat.landing_visibility === "unlisted")), [beats]);
  const matches = eligible.filter((beat) => beat.title.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 30);
  const beat = eligible.find((item) => item.id === beatId);
  const price = beat ? tierPriceCents({ priceCents: beat.price_cents ?? 0, nonExclusivePriceCents: beat.nonexclusive_price_cents, trackoutPriceCents: beat.trackout_price_cents }, tier) : null;
  const cleanCode = code.trim().toUpperCase();
  const cleanEmail = email.trim().toLowerCase();
  const codeValid = !cleanCode || /^[A-Z0-9_-]{3,30}$/.test(cleanCode);
  const emailValid = !cleanEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
  const link = (() => {
    if (!beat || price === null || !codeValid || !emailValid) return "";
    const params = new URLSearchParams({ tier });
    if (cleanCode) params.set("code", cleanCode);
    if (cleanEmail) params.set("email", cleanEmail);
    return `https://mybeatcatalog.com/pay/${encodeURIComponent(beat.landing_slug || beat.id)}?${params}`;
  })();

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setBeatId(initialBeatId ?? ""); setCreated(false); setOpen(true); }}>
        <Link2 className="mr-2 h-4 w-4" /> Create payment link
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create payment link</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-beat-search">Beat</Label>
              <Input id="payment-beat-search" value={query} onChange={(event) => { setQuery(event.target.value); setCreated(false); }} placeholder="Search beats" />
              {beat && <p className="text-xs text-muted-foreground">Selected: {beat.title}</p>}
              {(!beat || query) && <div className="max-h-36 overflow-y-auto rounded-md border border-border" role="listbox" aria-label="Beats">
                {matches.map((item) => (
                  <button type="button" role="option" aria-selected={item.id === beatId} key={item.id} onClick={() => { setBeatId(item.id); setQuery(""); setCreated(false); }} className="block w-full border-b border-border px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent">
                    {item.title}{item.landing_visibility === "unlisted" ? " · Unlisted" : ""}
                  </button>
                ))}
                {matches.length === 0 && <p className="p-3 text-sm text-muted-foreground">No available beats found.</p>}
              </div>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-tier">License</Label>
              <select id="payment-tier" value={tier} onChange={(event) => { setTier(event.target.value as LicenseTier); setCreated(false); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                {TIER_ORDER.map((option) => <option key={option} value={option}>{TIER_META[option].label}{beat ? ` · ${(() => { const p = tierPriceCents({ priceCents: beat.price_cents ?? 0, nonExclusivePriceCents: beat.nonexclusive_price_cents, trackoutPriceCents: beat.trackout_price_cents }, option); return p === null ? "Unavailable" : `$${(p / 100).toFixed(2)}`; })()}` : ""}</option>)}
              </select>
              {beat && price === null && <p className="text-xs text-destructive">This license has no price for this beat.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-code">Discount code (optional)</Label>
              <Input id="payment-code" value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); setCreated(false); }} placeholder="PROMO50" maxLength={30} />
              {!codeValid && <p className="text-xs text-destructive">Enter a valid code (3–30 letters, numbers, - or _).</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-email">Buyer email (optional)</Label>
              <Input id="payment-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setCreated(false); }} placeholder="buyer@example.com" maxLength={255} />
              {!emailValid && <p className="text-xs text-destructive">Enter a valid email address.</p>}
            </div>
            <p className="text-xs text-muted-foreground">The code is checked at checkout. This is a payment link, not a formal invoice; the final discount and tax appear in the payment form.</p>
            <Button className="w-full" disabled={!link} onClick={() => setCreated(true)}>Create link</Button>
            {created && link && <div className="space-y-2 border-t border-border pt-4">
              <Label htmlFor="created-payment-link">Payment link</Label>
              <Input id="created-payment-link" value={link} readOnly onFocus={(event) => event.target.select()} />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Payment link copied"), () => toast.error("Could not copy link"))}><Copy className="mr-2 h-4 w-4" />Copy link</Button>
                <Button variant="outline" asChild><a href={link} target="_blank" rel="noopener noreferrer" aria-label="Preview payment link"><ExternalLink className="h-4 w-4" /></a></Button>
              </div>
            </div>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}