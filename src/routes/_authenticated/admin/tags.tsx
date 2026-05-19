import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/admin/tags")({
  component: AdminTagsPage,
});

type Tag = { slug: string; label: string };
type Beat = { id: string; title: string; is_active: boolean; is_featured: boolean };
type Assignment = { beat_id: string; tag_slug: string };

function AdminTagsPage() {
  const qc = useQueryClient();
  const [newTag, setNewTag] = useState({ slug: "", label: "" });
  const [filter, setFilter] = useState("");

  const tagsQuery = useQuery({
    queryKey: ["beat-tags"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("beat_tags").select("slug,label").order("label");
      if (error) throw error;
      return (data ?? []) as Tag[];
    },
  });

  const beatsQuery = useQuery({
    queryKey: ["admin-beats-list"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("beats")
        .select("id,title,is_active,is_featured")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Beat[];
    },
  });

  const assignQuery = useQuery({
    queryKey: ["beat-tag-assignments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("beat_tag_assignments").select("beat_id,tag_slug");
      if (error) throw error;
      return (data ?? []) as Assignment[];
    },
  });

  async function addTag() {
    const slug = newTag.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    if (!slug || !newTag.label.trim()) return;
    const { error } = await (supabase as any).from("beat_tags").insert({ slug, label: newTag.label.trim() });
    if (error) return toast.error(error.message);
    setNewTag({ slug: "", label: "" });
    qc.invalidateQueries({ queryKey: ["beat-tags"] });
  }

  async function deleteTag(slug: string) {
    if (!confirm(`Delete tag "${slug}"? Beats will be unassigned.`)) return;
    const { error } = await (supabase as any).from("beat_tags").delete().eq("slug", slug);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["beat-tags"] });
    qc.invalidateQueries({ queryKey: ["beat-tag-assignments"] });
  }

  async function toggleAssignment(beatId: string, tagSlug: string, on: boolean) {
    if (on) {
      const { error } = await (supabase as any)
        .from("beat_tag_assignments")
        .insert({ beat_id: beatId, tag_slug: tagSlug });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await (supabase as any)
        .from("beat_tag_assignments")
        .delete()
        .eq("beat_id", beatId)
        .eq("tag_slug", tagSlug);
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["beat-tag-assignments"] });
  }

  async function toggleBeatFlag(beatId: string, field: "is_active" | "is_featured", value: boolean) {
    const { error } = await (supabase as any).from("beats").update({ [field]: value }).eq("id", beatId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-beats-list"] });
  }

  const tags = tagsQuery.data ?? [];
  const beats = (beatsQuery.data ?? []).filter((b) => b.title.toLowerCase().includes(filter.toLowerCase()));
  const assignments = assignQuery.data ?? [];
  const has = (beatId: string, slug: string) =>
    assignments.some((a) => a.beat_id === beatId && a.tag_slug === slug);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black">Tags & Beat Assignments</h1>
        <p className="mt-1 text-sm text-slate-400">
          Tags drive which beats appear on each SEO landing page.
        </p>
      </div>

      <section className="rounded-xl border border-slate-800 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide">Master tag list</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((t) => (
            <div
              key={t.slug}
              className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs"
            >
              <span className="font-mono text-slate-400">{t.slug}</span>
              <span className="text-slate-200">{t.label}</span>
              <button onClick={() => deleteTag(t.slug)} className="text-red-400 hover:text-red-300">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">Slug</Label>
            <Input
              className="h-9 w-40"
              placeholder="cinematic"
              value={newTag.slug}
              onChange={(e) => setNewTag({ ...newTag, slug: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Label</Label>
            <Input
              className="h-9 w-48"
              placeholder="Cinematic"
              value={newTag.label}
              onChange={(e) => setNewTag({ ...newTag, label: e.target.value })}
            />
          </div>
          <Button size="sm" onClick={addTag}>
            <Plus className="mr-1 h-3 w-3" /> Add tag
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide">Per-beat tagging</h2>
          <Input
            placeholder="Filter beats..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 w-60"
          />
        </div>

        {beatsQuery.isLoading || assignQuery.isLoading ? (
          <Loader2 className="mt-4 h-4 w-4 animate-spin" />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">Beat</th>
                  <th className="px-2 py-2">Active</th>
                  <th className="px-2 py-2">Featured</th>
                  {tags.map((t) => (
                    <th key={t.slug} className="px-2 py-2 text-center" title={t.label}>
                      {t.slug}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {beats.map((b) => (
                  <tr key={b.id} className="border-t border-slate-800">
                    <td className="px-2 py-1.5 max-w-[200px] truncate">{b.title}</td>
                    <td className="px-2 py-1.5">
                      <Checkbox
                        checked={b.is_active}
                        onCheckedChange={(v) => toggleBeatFlag(b.id, "is_active", !!v)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Checkbox
                        checked={b.is_featured}
                        onCheckedChange={(v) => toggleBeatFlag(b.id, "is_featured", !!v)}
                      />
                    </td>
                    {tags.map((t) => (
                      <td key={t.slug} className="px-2 py-1.5 text-center">
                        <Checkbox
                          checked={has(b.id, t.slug)}
                          onCheckedChange={(v) => toggleAssignment(b.id, t.slug, !!v)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
