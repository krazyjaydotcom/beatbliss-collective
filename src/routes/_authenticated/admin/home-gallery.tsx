import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2, Upload, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/home-gallery")({
  component: HomeGalleryAdmin,
});

type Row = {
  id: string;
  image_url: string;
  alt: string | null;
  sort_order: number;
  transition: string;
  is_active: boolean;
};

const TRANSITIONS = [
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Slide" },
  { value: "zoom", label: "Zoom" },
  { value: "crossfade", label: "Crossfade" },
];

// 100 years
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 365 * 100;

function HomeGalleryAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("home_gallery_images")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("home_gallery")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data: signed, error: signErr } = await supabase.storage
          .from("home_gallery")
          .createSignedUrl(path, SIGNED_URL_EXPIRY);
        if (signErr || !signed) throw signErr ?? new Error("Failed to sign URL");
        const nextOrder = (rows.at(-1)?.sort_order ?? 0) + 10;
        const { error: insErr } = await (supabase as any)
          .from("home_gallery_images")
          .insert({
            image_url: signed.signedUrl,
            alt: file.name,
            sort_order: nextOrder,
            transition: "fade",
            is_active: true,
          });
        if (insErr) throw insErr;
      }
      toast.success("Uploaded");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function update(id: string, patch: Partial<Row>) {
    const { error } = await (supabase as any)
      .from("home_gallery_images")
      .update(patch)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function remove(id: string) {
    if (!confirm("Delete this image?")) return;
    const { error } = await (supabase as any)
      .from("home_gallery_images")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  async function move(id: string, dir: -1 | 1) {
    const i = rows.findIndex((r) => r.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= rows.length) return;
    const a = rows[i];
    const b = rows[j];
    await update(a.id, { sort_order: b.sort_order });
    await update(b.id, { sort_order: a.sort_order });
    setRows((rs) => {
      const next = [...rs];
      next[i] = { ...a, sort_order: b.sort_order };
      next[j] = { ...b, sort_order: a.sort_order };
      next.sort((x, y) => x.sort_order - y.sort_order);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Home Gallery</h1>
        <p className="mt-1 text-sm text-slate-400">
          Upload images that rotate on the home page with fade, slide, or zoom transitions.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <Label className="text-sm font-semibold">Upload images</Label>
        <div className="mt-2 flex items-center gap-3">
          <Input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleUpload(e.target.files)}
            disabled={uploading}
          />
          {uploading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-400">
          <Upload className="mx-auto mb-2 h-6 w-6" />
          No images yet. Upload the first one above.
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((r, i) => (
            <div
              key={r.id}
              className="grid grid-cols-1 items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3 md:grid-cols-[120px_1fr_auto]"
            >
              <img
                src={r.image_url}
                alt={r.alt ?? ""}
                className="aspect-video w-full rounded-md object-cover md:w-[120px]"
              />
              <div className="grid gap-2 md:grid-cols-[1fr_160px_auto]">
                <div>
                  <Label className="text-xs text-slate-400">Alt text</Label>
                  <Input
                    value={r.alt ?? ""}
                    onChange={(e) =>
                      setRows((rs) =>
                        rs.map((x) => (x.id === r.id ? { ...x, alt: e.target.value } : x)),
                      )
                    }
                    onBlur={(e) => update(r.id, { alt: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Transition</Label>
                  <Select
                    value={r.transition}
                    onValueChange={(v) => update(r.id, { transition: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSITIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <Label className="text-xs text-slate-400">Active</Label>
                    <div className="h-10 pt-2">
                      <Switch
                        checked={r.is_active}
                        onCheckedChange={(v) => update(r.id, { is_active: v })}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={i === 0}
                  onClick={() => move(r.id, -1)}
                  aria-label="Move up"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={i === rows.length - 1}
                  onClick={() => move(r.id, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(r.id)}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
