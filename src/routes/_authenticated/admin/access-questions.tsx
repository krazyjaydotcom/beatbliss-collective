import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/access-questions")({
  head: () => ({ meta: [{ title: "Access Questions - Admin" }] }),
  component: AdminAccessQuestionsPage,
});

type Question = {
  id: string;
  sort_order: number;
  label: string;
  question_text: string;
  helper_text: string;
  placeholder: string;
  input_type: string;
  icon: string;
  is_required: boolean;
  is_active: boolean;
};

const INPUT_TYPES = ["text", "email", "tel", "url"];
const ICONS = ["user", "mail", "phone", "music", "link", "edit"];

function AdminAccessQuestionsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-access-questions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("access_application_questions")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Question[];
    },
  });

  const [rows, setRows] = useState<Question[]>([]);
  useEffect(() => { if (data) setRows(data); }, [data]);

  function update(id: string, patch: Partial<Question>) {
    setRows((r) => r.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  async function save(q: Question) {
    const { error } = await (supabase as any)
      .from("access_application_questions")
      .update({
        label: q.label,
        question_text: q.question_text,
        helper_text: q.helper_text,
        placeholder: q.placeholder,
        input_type: q.input_type,
        icon: q.icon,
        is_required: q.is_required,
        is_active: q.is_active,
        sort_order: q.sort_order,
      })
      .eq("id", q.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["admin-access-questions"] });
    qc.invalidateQueries({ queryKey: ["access-questions-public"] });
  }

  async function addQuestion() {
    const nextOrder = (rows[rows.length - 1]?.sort_order ?? 0) + 10;
    const { error } = await (supabase as any)
      .from("access_application_questions")
      .insert({
        sort_order: nextOrder,
        label: "New question",
        question_text: "What should I know?",
        helper_text: "",
        placeholder: "",
        input_type: "text",
        icon: "edit",
        is_required: true,
        is_active: true,
      });
    if (error) return toast.error(error.message);
    toast.success("Question added");
    qc.invalidateQueries({ queryKey: ["admin-access-questions"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this question?")) return;
    const { error } = await (supabase as any)
      .from("access_application_questions")
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-access-questions"] });
    qc.invalidateQueries({ queryKey: ["access-questions-public"] });
  }

  async function move(index: number, dir: -1 | 1) {
    const a = rows[index];
    const b = rows[index + dir];
    if (!a || !b) return;
    const aOrder = a.sort_order;
    const bOrder = b.sort_order;
    await (supabase as any).from("access_application_questions").update({ sort_order: bOrder }).eq("id", a.id);
    await (supabase as any).from("access_application_questions").update({ sort_order: aOrder }).eq("id", b.id);
    qc.invalidateQueries({ queryKey: ["admin-access-questions"] });
    qc.invalidateQueries({ queryKey: ["access-questions-public"] });
  }

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black">Access Application Questions</h1>
          <p className="text-sm text-slate-400 mt-1">Edit, reorder, or add the questions in the Apply For Access popup. A beat picker is always shown as the final step.</p>
        </div>
        <Button onClick={addQuestion} className="gap-2"><Plus className="h-4 w-4" /> Add question</Button>
      </div>

      <div className="space-y-4">
        {rows.map((q, i) => (
          <div key={q.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase text-slate-400">Step {i + 1}</span>
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(q.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">Label (chip)</Label>
                <Input value={q.label} onChange={(e) => update(q.id, { label: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Placeholder</Label>
                <Input value={q.placeholder} onChange={(e) => update(q.id, { placeholder: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Question text</Label>
                <Input value={q.question_text} onChange={(e) => update(q.id, { question_text: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Helper text</Label>
                <Textarea rows={2} value={q.helper_text} onChange={(e) => update(q.id, { helper_text: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Input type</Label>
                <select value={q.input_type} onChange={(e) => update(q.id, { input_type: e.target.value })} className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm">
                  {INPUT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Icon</Label>
                <select value={q.icon} onChange={(e) => update(q.id, { icon: e.target.value })} className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm">
                  {ICONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={q.is_required} onChange={(e) => update(q.id, { is_required: e.target.checked })} /> Required
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={q.is_active} onChange={(e) => update(q.id, { is_active: e.target.checked })} /> Active
              </label>
            </div>
            <Button size="sm" onClick={() => save(q)} className="gap-2"><Save className="h-4 w-4" /> Save changes</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
