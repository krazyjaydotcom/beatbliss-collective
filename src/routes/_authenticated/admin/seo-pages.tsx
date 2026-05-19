import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/seo-pages")({
  component: AdminSeoPagesPage,
});

type SeoPage = {
  id: string;
  slug: string;
  target_keyword: string;
  seo_title: string;
  meta_description: string;
  h1: string;
  intro: string;
  sections: Array<{ heading: string; body: string }>;
  tag_slugs: string[];
  related_page_slugs: string[];
  is_published: boolean;
  featured: boolean;
  sort_order: number;
};

const EMPTY: Omit<SeoPage, "id"> = {
  slug: "",
  target_keyword: "",
  seo_title: "",
  meta_description: "",
  h1: "",
  intro: "",
  sections: [{ heading: "", body: "" }],
  tag_slugs: [],
  related_page_slugs: [],
  is_published: true,
  featured: false,
  sort_order: 0,
};

function AdminSeoPagesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<SeoPage> | null>(null);

  const pagesQuery = useQuery({
    queryKey: ["admin-seo-pages"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("seo_pages")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SeoPage[];
    },
  });

  const tagsQuery = useQuery({
    queryKey: ["beat-tags"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("beat_tags").select("slug,label").order("label");
      if (error) throw error;
      return (data ?? []) as { slug: string; label: string }[];
    },
  });

  const allSlugs = useMemo(() => (pagesQuery.data ?? []).map((p) => p.slug), [pagesQuery.data]);

  async function savePage() {
    if (!editing) return;
    const payload = {
      slug: editing.slug?.trim(),
      target_keyword: editing.target_keyword?.trim() || "",
      seo_title: editing.seo_title?.trim() || "",
      meta_description: editing.meta_description?.trim() || "",
      h1: editing.h1?.trim() || "",
      intro: editing.intro ?? "",
      sections: editing.sections ?? [],
      tag_slugs: editing.tag_slugs ?? [],
      related_page_slugs: editing.related_page_slugs ?? [],
      is_published: editing.is_published ?? true,
      featured: editing.featured ?? false,
      sort_order: editing.sort_order ?? 0,
    };
    if (!payload.slug || !payload.seo_title || !payload.h1) {
      toast.error("Slug, SEO title, and H1 are required.");
      return;
    }
    const { error } = editing.id
      ? await (supabase as any).from("seo_pages").update(payload).eq("id", editing.id)
      : await (supabase as any).from("seo_pages").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved.");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-seo-pages"] });
  }

  async function deletePage(id: string) {
    if (!confirm("Delete this SEO page?")) return;
    const { error } = await (supabase as any).from("seo_pages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted.");
    qc.invalidateQueries({ queryKey: ["admin-seo-pages"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">SEO Pages</h1>
          <p className="mt-1 text-sm text-slate-400">Manage tag-driven landing pages for organic search.</p>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="mr-2 h-4 w-4" /> New page
        </Button>
      </div>

      {pagesQuery.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Keyword</th>
                <th className="px-3 py-2">Tags</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(pagesQuery.data ?? []).map((p) => (
                <tr key={p.id} className="border-t border-slate-800">
                  <td className="px-3 py-2 font-mono text-xs">/beats/{p.slug}</td>
                  <td className="px-3 py-2">{p.target_keyword}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{p.tag_slugs.join(", ")}</td>
                  <td className="px-3 py-2">
                    {p.is_published ? (
                      <Badge className="bg-emerald-500/20 text-emerald-300">Live</Badge>
                    ) : (
                      <Badge variant="outline">Draft</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deletePage(p.id)} className="ml-2 text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold">{editing.id ? "Edit page" : "New page"}</h2>
            <div className="mt-4 grid gap-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>Slug</Label>
                  <Input
                    value={editing.slug ?? ""}
                    onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                    placeholder="cinematic-rnb-type-beats"
                  />
                </div>
                <div>
                  <Label>Target keyword</Label>
                  <Input
                    value={editing.target_keyword ?? ""}
                    onChange={(e) => setEditing({ ...editing, target_keyword: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>SEO title</Label>
                <Input
                  value={editing.seo_title ?? ""}
                  onChange={(e) => setEditing({ ...editing, seo_title: e.target.value })}
                />
              </div>
              <div>
                <Label>Meta description</Label>
                <Textarea
                  rows={2}
                  value={editing.meta_description ?? ""}
                  onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })}
                />
              </div>
              <div>
                <Label>H1</Label>
                <Input value={editing.h1 ?? ""} onChange={(e) => setEditing({ ...editing, h1: e.target.value })} />
              </div>
              <div>
                <Label>Intro paragraph</Label>
                <Textarea
                  rows={4}
                  value={editing.intro ?? ""}
                  onChange={(e) => setEditing({ ...editing, intro: e.target.value })}
                />
              </div>

              <div>
                <Label>Sections</Label>
                <div className="mt-2 space-y-3">
                  {(editing.sections ?? []).map((s, i) => (
                    <div key={i} className="rounded-lg border border-slate-800 p-3">
                      <Input
                        placeholder="Heading"
                        value={s.heading}
                        onChange={(e) => {
                          const next = [...(editing.sections ?? [])];
                          next[i] = { ...next[i], heading: e.target.value };
                          setEditing({ ...editing, sections: next });
                        }}
                      />
                      <Textarea
                        rows={3}
                        className="mt-2"
                        placeholder="Body"
                        value={s.body}
                        onChange={(e) => {
                          const next = [...(editing.sections ?? [])];
                          next[i] = { ...next[i], body: e.target.value };
                          setEditing({ ...editing, sections: next });
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 text-red-400"
                        onClick={() => {
                          const next = (editing.sections ?? []).filter((_, idx) => idx !== i);
                          setEditing({ ...editing, sections: next });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing({
                        ...editing,
                        sections: [...(editing.sections ?? []), { heading: "", body: "" }],
                      })
                    }
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add section
                  </Button>
                </div>
              </div>

              <div>
                <Label>Tags (drive beat feed)</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(tagsQuery.data ?? []).map((t) => {
                    const on = (editing.tag_slugs ?? []).includes(t.slug);
                    return (
                      <button
                        type="button"
                        key={t.slug}
                        onClick={() => {
                          const set = new Set(editing.tag_slugs ?? []);
                          if (on) set.delete(t.slug);
                          else set.add(t.slug);
                          setEditing({ ...editing, tag_slugs: Array.from(set) });
                        }}
                        className={
                          "rounded-full border px-3 py-1 text-xs " +
                          (on
                            ? "border-primary bg-primary/20 text-primary"
                            : "border-slate-700 text-slate-300 hover:border-slate-500")
                        }
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Related pages</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {allSlugs
                    .filter((s) => s !== editing.slug)
                    .map((s) => {
                      const on = (editing.related_page_slugs ?? []).includes(s);
                      return (
                        <button
                          type="button"
                          key={s}
                          onClick={() => {
                            const set = new Set(editing.related_page_slugs ?? []);
                            if (on) set.delete(s);
                            else set.add(s);
                            setEditing({ ...editing, related_page_slugs: Array.from(set) });
                          }}
                          className={
                            "rounded-full border px-3 py-1 text-[11px] " +
                            (on
                              ? "border-primary bg-primary/20 text-primary"
                              : "border-slate-700 text-slate-300 hover:border-slate-500")
                          }
                        >
                          {s}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={editing.is_published ?? true}
                    onCheckedChange={(v) => setEditing({ ...editing, is_published: !!v })}
                  />
                  Published
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={editing.featured ?? false}
                    onCheckedChange={(v) => setEditing({ ...editing, featured: !!v })}
                  />
                  Featured
                </label>
                <div>
                  <Label>Sort order</Label>
                  <Input
                    type="number"
                    value={editing.sort_order ?? 0}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={savePage}>
                <Save className="mr-2 h-4 w-4" /> Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
