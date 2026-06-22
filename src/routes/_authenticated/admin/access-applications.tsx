import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, Mail, Phone, Music2, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/access-applications")({
  head: () => ({ meta: [{ title: "Access Applications - Admin" }] }),
  component: AdminAccessApplicationsPage,
});

type Application = {
  id: string;
  created_at: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  music: string | null;
  source: string | null;
  beat_id: string | null;
  beat_title: string | null;
  answers: Array<{ label: string; question: string; answer: string }> | null;
};

function AdminAccessApplicationsPage() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-access-applications"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("access_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Application[];
    },
  });

  async function remove(id: string) {
    if (!confirm("Delete this submission?")) return;
    const { error } = await (supabase as any).from("access_applications").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-access-applications"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Access Applications</h1>
        <p className="mt-1 text-sm text-slate-400">
          Every submission from the "Apply For Access" popup, including each question and answer.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">No applications yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const isOpen = expanded[r.id] ?? false;
            return (
              <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-bold text-white">{r.name || "(no name)"}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      {r.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> <a href={`mailto:${r.email}`} className="hover:text-white">{r.email}</a></span>}
                      {r.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {r.phone}</span>}
                      {r.beat_title && <span className="inline-flex items-center gap-1"><Music2 className="h-3 w-3" /> {r.beat_title}</span>}
                      {r.music && <a href={r.music} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-electric hover:underline"><ExternalLink className="h-3 w-3" /> Music link</a>}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {new Date(r.created_at).toLocaleString()}
                      {r.source ? ` • ${r.source}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setExpanded((e) => ({ ...e, [r.id]: !isOpen }))} className="gap-1">
                      {isOpen ? <><ChevronUp className="h-4 w-4" /> Hide</> : <><ChevronDown className="h-4 w-4" /> View answers</>}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
                    {(r.answers ?? []).length === 0 ? (
                      <p className="text-xs text-slate-500">No answers captured.</p>
                    ) : (
                      (r.answers ?? []).map((a, i) => (
                        <div key={i} className="rounded-lg bg-slate-950/60 p-3">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-primary">{a.label}</div>
                          <div className="mt-0.5 text-xs text-slate-400">{a.question}</div>
                          <div className="mt-2 whitespace-pre-wrap text-sm text-white">{a.answer || <span className="text-slate-500 italic">(no answer)</span>}</div>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
