import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, GraduationCap, Youtube, Edit2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/classroom")({
  head: () => ({ meta: [{ title: "Admin · Classroom — MYBEATCATALOG" }] }),
  component: AdminClassroomPage,
});

function toEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname.includes("youtube.com")) id = u.searchParams.get("v");
    else if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch { return null; }
}

function AdminClassroomPage() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", video_url: "", sort_order: "0" });
  const [submitting, setSubmitting] = useState(false);

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  function resetForm() {
    setForm({ title: "", description: "", video_url: "", sort_order: "0" });
    setAdding(false);
    setEditingId(null);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.video_url.trim()) {
      toast.error("Title and video URL are required.");
      return;
    }
    if (!toEmbed(form.video_url)) {
      toast.error("Please enter a valid YouTube URL.");
      return;
    }
    setSubmitting(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      video_url: form.video_url.trim(),
      sort_order: parseInt(form.sort_order) || 0,
    };
    const { error } = editingId
      ? await supabase.from("courses").update(payload).eq("id", editingId)
      : await supabase.from("courses").insert(payload);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Course updated!" : "Course added!");
    qc.invalidateQueries({ queryKey: ["admin-courses"] });
    resetForm();
  }

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"?`)) return;
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Course deleted.");
    qc.invalidateQueries({ queryKey: ["admin-courses"] });
  }

  function startEdit(c: any) {
    setForm({ title: c.title, description: c.description ?? "", video_url: c.video_url, sort_order: String(c.sort_order ?? 0) });
    setEditingId(c.id);
    setAdding(true);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Classroom</h1>
          <p className="text-muted-foreground mt-1">Add and manage video courses for your members.</p>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Course
          </Button>
        )}
      </div>

      {adding && (
        <div className="rounded-2xl border border-primary bg-card p-6 space-y-4">
          <h2 className="font-semibold">{editingId ? "Edit Course" : "New Course"}</h2>
          <div className="space-y-3">
            <Input
              placeholder="Course title (e.g. Beat Making 101)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Textarea
              placeholder="Short description (optional)"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Input
              placeholder="YouTube URL (e.g. https://youtube.com/watch?v=...)"
              value={form.video_url}
              onChange={(e) => setForm({ ...form, video_url: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Sort order (0 = first)"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
            />
          </div>
          {form.video_url && toEmbed(form.video_url) && (
            <div className="aspect-video rounded-xl overflow-hidden border border-border">
              <iframe src={toEmbed(form.video_url)!} className="w-full h-full" allowFullScreen title="Preview" />
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              {editingId ? "Save Changes" : "Add Course"}
            </Button>
            <Button variant="outline" onClick={resetForm}>
              <X className="h-4 w-4 mr-2" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-border">
          <GraduationCap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No courses yet. Add your first one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((c: any) => (
            <div key={c.id} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Youtube className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{c.title}</p>
                {c.description && <p className="text-xs text-muted-foreground truncate">{c.description}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(c.id, c.title)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
