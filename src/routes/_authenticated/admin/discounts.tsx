import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, Surface, SectionTitle, EmptyState } from "@/components/admin/ui";
import { getStripeEnvironment } from "@/lib/stripe";
import { createDiscountCode, listDiscountCodes, setDiscountCodeActive } from "@/lib/discount-codes.functions";

export const Route = createFileRoute("/_authenticated/admin/discounts")({
  head: () => ({ meta: [{ title: "Discount codes — Admin" }] }),
  component: DiscountsPage,
});

const TIER_OPTIONS = [
  { id: "nonexclusive", label: "Non-Exclusive" },
  { id: "unlimited", label: "Unlimited" },
  { id: "trackout", label: "Unlimited w/ STEMs" },
];

function env(): "sandbox" | "live" {
  try { return getStripeEnvironment(); } catch { return "sandbox"; }
}

function DiscountsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listDiscountCodes);
  const create = useServerFn(createDiscountCode);
  const toggle = useServerFn(setDiscountCodeActive);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("20");
  const [max, setMax] = useState("");
  const [expires, setExpires] = useState("");
  const [firstTime, setFirstTime] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tiers, setTiers] = useState<string[]>(["nonexclusive", "unlimited", "trackout"]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["discount-codes", env()],
    queryFn: () => list({ data: { environment: env() } }),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await create({
        data: {
          environment: env(),
          code,
          kind,
          value: Number(value),
          maxRedemptions: max ? Number(max) : undefined,
          expiresAt: expires || undefined,
          firstTimeOnly: firstTime,
          tiers: tiers as ("nonexclusive" | "unlimited" | "trackout")[],
        },
      });
      if (!r.ok) throw new Error(r.error);
      toast.success(`Code ${code.toUpperCase()} created`);
      setCode("");
      qc.invalidateQueries({ queryKey: ["discount-codes"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create code");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Marketing"
        title="Discount codes"
        description="Buyers can enter these codes on the payment form."
      />

      <Surface className="p-4">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SUMMER20" required />
          </div>
          <div className="space-y-1.5">
            <Label>Discount</Label>
            <div className="flex gap-2">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as "percent" | "amount")}
                className="rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="percent">% off</option>
                <option value="amount">$ off</option>
              </select>
              <Input type="number" min="0.01" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Max uses (optional)</Label>
            <Input type="number" min="1" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Unlimited" />
          </div>
          <div className="space-y-1.5">
            <Label>Expires (optional)</Label>
            <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={firstTime} onChange={(e) => setFirstTime(e.target.checked)} />
            First-time buyers only
          </label>
          <fieldset className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <Label>Works on</Label>
            <div className="flex flex-wrap gap-4 text-sm">
              {TIER_OPTIONS.map((t) => (
                <label key={t.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={tiers.includes(t.id)}
                    onChange={(e) => setTiers((cur) => (e.target.checked ? [...cur, t.id] : cur.filter((x) => x !== t.id)))}
                  />
                  {t.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {tiers.length === 3 ? "All licenses." : "Only the checked licenses get the discount. Buyers enter limited codes in the cart's code box."}
            </p>
          </fieldset>
          <div className="self-end">
            <Button type="submit" disabled={saving || !code || !tiers.length}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create code
            </Button>
          </div>
        </form>
      </Surface>

      <Surface>
        <SectionTitle>Your codes</SectionTitle>
        <div className="p-4 pt-0">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : error ? (
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          ) : !data?.length ? (
            <EmptyState title="No discount codes yet" description="Create your first code above." />
          ) : (
            <div className="divide-y divide-border/60">
              {data.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-bold text-foreground">{c.code}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.percentOff != null ? `${c.percentOff}% off` : c.amountOffCents != null ? `$${(c.amountOffCents / 100).toFixed(2)} off` : "—"}
                      {" · "}{c.tiers ? c.tiers.map((t) => TIER_OPTIONS.find((o) => o.id === t)?.label ?? t).join(", ") : "All licenses"}
                      {" · "}used {c.timesRedeemed}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}
                      {c.expiresAt ? ` · expires ${new Date(c.expiresAt * 1000).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={c.active ? "text-xs font-semibold text-primary" : "text-xs text-muted-foreground"}>
                      {c.active ? "Active" : "Off"}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await toggle({ data: { environment: env(), id: c.id, active: !c.active } });
                        qc.invalidateQueries({ queryKey: ["discount-codes"] });
                      }}
                    >
                      {c.active ? "Turn off" : "Turn on"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Surface>
    </div>
  );
}
