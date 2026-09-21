import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Play, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/commercials")({
  component: CommercialsAdmin,
});

type Row = {
  id: string;
  title: string;
  media_type: "audio" | "video" | "embed";
  media_url: string;
  cover_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  is_active: boolean;
  sort_order: number;
  impressions: number;
  skips: number;
  clicks: number;
};

const BUCKET = "homepage-media";

async function uploadToBucket(file: File, folder: string) {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function CommercialsAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [preview, setPreview] = useState<Row | null>(null);
  const mediaRef = useRef<HTMLInputElement | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("ad_spots")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function addSpot() {
    const file = mediaRef.current?.files?.[0];
    const link = embedUrl.trim();
    if (!title.trim()) return toast.error("Give the commercial a title.");
    if (!file && !link) return toast.error("Choose a file or paste a YouTube/Vimeo link.");
    const isVideo = file ? file.type.startsWith("video") : false;
    const isAudio = file ? file.type.startsWith("audio") : false;
    if (file && !isVideo && !isAudio) return toast.error("That file is not audio or video.");

    setUploading(true);
    try {
      const mediaUrl = link ? link : await uploadToBucket(file!, "ads");
      const coverFile = coverRef.current?.files?.[0];
      const coverUrl = coverFile ? await uploadToBucket(coverFile, "ads/covers") : null;

      const { error } = await supabase.from("ad_spots").insert({
        title: title.trim(),
        media_type: link ? "embed" : isVideo ? "video" : "audio",
        media_url: mediaUrl,
        cover_url: coverUrl,
        cta_label: ctaLabel.trim() || null,
        cta_url: ctaUrl.trim() || null,
        sort_order: rows.length ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0,
      });
      if (error) throw error;

      toast.success("Commercial added");
      setTitle("");
      setCtaLabel("");
      setCtaUrl("");
      if (mediaRef.current) mediaRef.current.value = "";
      if (coverRef.current) coverRef.current.value = "";
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function patch(id: string, values: Partial<Row>) {
    const { error } = await supabase.from("ad_spots").update(values).eq("id", id);
    if (error) return toast.error(error.message);
    await load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("ad_spots").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Commercial removed");
    await load();
  }

  async function move(index: number, delta: number) {
    const a = rows[index];
    const b = rows[index + delta];
    if (!a || !b) return;
    await supabase.from("ad_spots").update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabase.from("ad_spots").update({ sort_order: a.sort_order }).eq("id", b.id);
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Commercials</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visitors who aren&apos;t signed in hear one of these after 5 beats or 10 minutes of
          listening, whichever comes first. They rotate in the order below. Members never hear them.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Add a commercial</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ad-title">Title</Label>
            <Input id="ad-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mixing & mastering services" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-media">Audio or video file</Label>
            <Input id="ad-media" type="file" accept="audio/*,video/*" ref={mediaRef} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ad-embed">Or paste a YouTube / Vimeo link (no upload needed)</Label>
            <Input
              id="ad-embed"
              value={embedUrl}
              onChange={(e) => setEmbedUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <p className="text-xs text-muted-foreground">
              If you paste a link, the file above is ignored.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-cover">Cover image (audio ads only, optional)</Label>
            <Input id="ad-cover" type="file" accept="image/*" ref={coverRef} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-cta-label">Button text (optional)</Label>
            <Input id="ad-cta-label" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Book a session" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ad-cta-url">Button link (optional)</Label>
            <Input id="ad-cta-url" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <Button onClick={addSpot} disabled={uploading}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {uploading ? "Uploading…" : "Add commercial"}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No commercials yet. Until you add one, guests listen without interruption.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r, i) => (
            <li key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.media_type === "video" ? "Video" : "Audio"} · shown {r.impressions} ·
                    skipped {r.skips}
                    {r.cta_url ? ` · links to ${r.cta_url}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={r.is_active}
                      onCheckedChange={(v) => patch(r.id, { is_active: v })}
                      aria-label={`Activate ${r.title}`}
                    />
                    {r.is_active ? "Active" : "Off"}
                  </label>
                  <Button variant="outline" size="icon" aria-label="Preview" onClick={() => setPreview(preview?.id === r.id ? null : r)}>
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" aria-label="Delete" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {preview?.id === r.id ? (
                <div className="mt-3">
                  {r.media_type === "video" ? (
                    <video src={r.media_url} controls className="max-h-72 w-full rounded-lg bg-black" />
                  ) : (
                    <audio src={r.media_url} controls className="w-full" />
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
