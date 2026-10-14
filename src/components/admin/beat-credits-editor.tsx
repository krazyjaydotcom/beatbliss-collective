import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { creditConfigSchema, emptyContributor, generatedCredit, splitFields, type Contributor, type CreditConfig } from "@/lib/beat-credits";

const textFields = [
  ["credit_name", "Producer / credit name"], ["legal_name", "Legal writer name"],
  ["writer_ipi", "Writer IPI"], ["pro", "Writer PRO"],
  ["publisher_name", "Publisher name"], ["publisher_ipi", "Publisher IPI"], ["publisher_pro", "Publisher PRO"],
] as const;
const splitLabels = { writer_pct: "Final song writer share %", publishing_pct: "Final song publisher share %", master_pct: "Underlying beat master ownership %", sales_pct: "Beat-sale proceeds % (private)" };
const emptyConfig: CreditConfig = { production_credit: "", contributors: [], admin_notes: "" };

export function BeatCreditsEditor({ beatId }: { beatId: string }) {
  const prefix = useId();
  const [config, setConfig] = useState<CreditConfig>(emptyConfig);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [preview, setPreview] = useState("");
  const [previewed, setPreviewed] = useState("");
  const [error, setError] = useState("");
  const revision = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    setLoading(true); setLoadError(""); setPreview(""); setPreviewed("");
    void (async () => {
      const { data, error: err } = await (supabase as any).from("beat_credit_configs").select("production_credit,contributors,admin_notes,updated_at").eq("beat_id", beatId).maybeSingle();
      if (!active) return;
      if (err) setLoadError(err.message);
      else { setConfig(data ? { production_credit: data.production_credit, contributors: data.contributors, admin_notes: data.admin_notes } : emptyConfig); setUpdatedAt(data?.updated_at ?? null); }
      setLoading(false);
    })();
    return () => { active = false; mounted.current = false; revision.current++; };
  }, [beatId]);
  function change(next: CreditConfig) { revision.current++; setConfig(next); setPreviewed(""); setError(""); }
  function updateContributor(index: number, patch: Partial<Contributor>) {
    change({ ...config, contributors: config.contributors.map((c, i) => i === index ? { ...c, ...patch } : c) });
  }
  async function showPreview() {
    const parsed = creditConfigSchema.safeParse(config);
    if (!parsed.success) { setError(parsed.error.issues.map((i) => i.message).join("; ")); return; }
    const current = revision.current;
    setBusy(true); setError("");
    try {
      if (!parsed.data.contributors.length) { setPreview("No custom contributors. Future agreements use the existing default credits."); setPreviewed(JSON.stringify(parsed.data)); return; }
      const { data, error: err } = await (supabase as any).rpc("admin_preview_beat_credit_terms", { _production_credit: parsed.data.production_credit, _contributors: parsed.data.contributors });
      if (err) throw err;
      if (mounted.current && revision.current === current) { setPreview(data); setPreviewed(JSON.stringify(parsed.data)); }
    } catch (e: any) { if (mounted.current) setError(e.message || "Preview failed"); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function save() {
    const parsed = creditConfigSchema.safeParse(config);
    if (!parsed.success || JSON.stringify(parsed.data) !== previewed) { setError("Preview the current agreement terms before saving."); return; }
    setBusy(true); setError("");
    try {
      const { data, error: err } = await (supabase as any).rpc("admin_save_beat_credits", { _beat_id: beatId, _production_credit: parsed.data.production_credit, _contributors: parsed.data.contributors, _admin_notes: parsed.data.admin_notes, _expected_updated_at: updatedAt });
      if (err) throw err;
      if (mounted.current) { setUpdatedAt(data); setConfig(parsed.data); toast.success("Credits & splits saved for future agreements"); }
    } catch (e: any) { if (mounted.current) setError(e.message || "Credits could not be saved"); }
    finally { if (mounted.current) setBusy(false); }
  }
  if (loading) return <p className="text-sm" role="status">Loading credits &amp; splits…</p>;
  if (loadError) return <p role="alert" className="text-sm text-destructive">Credits could not be loaded: {loadError}. Close and reopen this beat to retry.</p>;
  return <section className="rounded-xl border p-4 space-y-4">
    <div><h3 className="font-semibold">Contributing producers &amp; agreement splits</h3><p className="text-xs text-muted-foreground mt-1">Include yourself and each contributor. Saves apply only to this beat’s future agreements. Existing agreements keep their original terms.</p></div>
    <fieldset disabled={busy} className="space-y-4">
      {config.contributors.map((c, index) => <div key={index} className="rounded-lg border p-3 space-y-3">
        <div className="flex justify-between items-center"><h4 className="text-sm font-semibold">Contributor {index + 1}</h4><Button type="button" variant="ghost" size="sm" onClick={() => change({ ...config, contributors: config.contributors.filter((_, i) => i !== index) })}>Remove contributor {index + 1}</Button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {textFields.map(([field, label]) => <div key={field}><Label htmlFor={`${prefix}-${index}-${field}`}>{label}</Label><Input id={`${prefix}-${index}-${field}`} value={c[field]} maxLength={field.includes("ipi") ? 11 : 200} inputMode={field.includes("ipi") ? "numeric" : "text"} onChange={(e) => updateContributor(index, { [field]: e.target.value })} /></div>)}
          <div><Label htmlFor={`${prefix}-${index}-role`}>Contribution role</Label><select id={`${prefix}-${index}-role`} className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={c.role} onChange={(e) => updateContributor(index, { role: e.target.value as Contributor["role"] })}><option value="producer">Producer</option><option value="co_producer">Co-producer</option><option value="additional_production">Additional production</option></select></div>
          {splitFields.map((field) => <div key={field}><Label htmlFor={`${prefix}-${index}-${field}`}>{splitLabels[field]}</Label><Input id={`${prefix}-${index}-${field}`} type="number" min="0" max="100" step="0.01" placeholder="Unspecified" value={c[field] ?? ""} onChange={(e) => updateContributor(index, { [field]: e.target.value === "" ? null : Number(e.target.value) })} /></div>)}
        </div>
      </div>)}
      <Button type="button" variant="outline" disabled={config.contributors.length >= 50} onClick={() => change({ ...config, contributors: [...config.contributors, emptyContributor()] })}>Add contributing producer</Button>
      <p className="text-xs text-muted-foreground">Blank shares are unspecified. Writer and publishing percentages refer to separate shares of the final song. Beat master ownership refers to the original beat recording. Beat-sale proceeds are private records only; this does not send payouts or register royalties.</p>
      <div className="grid gap-2 sm:grid-cols-2">{splitFields.map((field) => {
        const values = config.contributors.map((c) => c[field]).filter((v): v is number => v !== null);
        const total = values.reduce((sum, n) => sum + Math.round(n * 100), 0) / 100;
        return <p key={field} className="text-xs"><strong>{splitLabels[field]}:</strong> {values.length ? `${total}% listed · ${Math.round((100 - total) * 100) / 100}% not allocated here` : "Unspecified"}</p>;
      })}</div>
      <div><Label htmlFor={`${prefix}-credit`}>Required production credit line</Label><Input id={`${prefix}-credit`} value={config.production_credit} maxLength={300} placeholder="Produced by …" onChange={(e) => change({ ...config, production_credit: e.target.value })} /><Button type="button" size="sm" variant="ghost" onClick={() => change({ ...config, production_credit: generatedCredit(config.contributors) })}>Generate from contributor names</Button></div>
      <div><Label htmlFor={`${prefix}-notes`}>Private admin notes</Label><Textarea id={`${prefix}-notes`} value={config.admin_notes} maxLength={4000} onChange={(e) => change({ ...config, admin_notes: e.target.value })} /></div>
    </fieldset>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={showPreview}>Preview agreement credits</Button><Button type="button" disabled={busy || !previewed} onClick={save}>{busy ? "Working…" : "Save credits & splits"}</Button></div>
    {preview && <div><h4 className="text-sm font-semibold">Buyer agreement credit preview</h4>{!previewed && <p className="text-xs text-muted-foreground">Preview is out of date. Preview again before saving.</p>}<pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs font-sans">{preview}</pre></div>}
  </section>;
}
