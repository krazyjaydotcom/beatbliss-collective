import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AUDIO_TAG_DEFAULTS, fetchAudioTagSettings, type AudioTagSettings } from "@/lib/audio-tag";
import { downloadBlob, renderTaggedBeat } from "@/lib/tagged-export";

export const Route = createFileRoute("/_authenticated/admin/audio-tag")({
  component: AudioTagAdmin,
});

const BUCKET = "homepage-media";

type BeatRow = { id: string; title: string; audio_url: string | null };

function AudioTagAdmin() {
  const [settings, setSettings] = useState<AudioTagSettings>(AUDIO_TAG_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [beats, setBeats] = useState<BeatRow[]>([]);
  const [filter, setFilter] = useState("");
  const [rendering, setRendering] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void (async () => {
      const s = await fetchAudioTagSettings();
      setSettings(s);
      const { data } = await (supabase as any)
        .from("beats")
        .select("id,title,audio_url")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(300);
      setBeats(((data ?? []) as BeatRow[]).filter((b) => b.audio_url));
      setLoading(false);
    })();
  }, []);

  async function save(next: AudioTagSettings) {
    setSettings(next);
    setSaving(true);
    const { error } = await (supabase as any)
      .from("audio_tag_settings")
      .update({
        tag_url: next.tagUrl,
        is_enabled: next.isEnabled,
        interval_seconds: next.intervalSeconds,
        start_offset_seconds: next.startOffsetSeconds,
        volume: next.volume,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved");
  }

  async function uploadTag() {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Choose an audio file first.");
    if (!file.type.startsWith("audio")) return toast.error("That file is not audio.");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "mp3";
      const path = `audio-tags/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "31536000", contentType: file.type });
      if (error) throw error;
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      await save({ ...settings, tagUrl: url });
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function downloadTagged(beat: BeatRow) {
    if (!settings.tagUrl) return toast.error("Upload a tag sound first.");
    if (!beat.audio_url) return;
    setRendering(beat.id);
    try {
      const blob = await renderTaggedBeat(beat.audio_url, settings.tagUrl, {
        intervalSeconds: settings.intervalSeconds,
        startOffsetSeconds: settings.startOffsetSeconds,
        volume: settings.volume,
      });
      downloadBlob(blob, `${beat.title.replace(/[^\w]+/g, "_")}_tagged.wav`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not build the tagged file.");
    } finally {
      setRendering(null);
    }
  }

  const visible = beats.filter((b) => b.title.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Audio tag</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your voice stamp plays over previews in the store, and you can download a tagged copy of
          any beat.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Play the tag over store previews</p>
                <p className="text-xs text-muted-foreground">
                  Off means visitors hear previews clean.
                </p>
              </div>
              <Switch
                checked={settings.isEnabled}
                onCheckedChange={(v) => save({ ...settings, isEnabled: v })}
                aria-label="Play the tag over store previews"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tag-file">Tag sound</Label>
                <div className="flex gap-2">
                  <Input id="tag-file" type="file" accept="audio/*" ref={fileRef} />
                  <Button onClick={uploadTag} disabled={uploading}>
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {settings.tagUrl ? (
                  <audio src={settings.tagUrl} controls className="mt-2 w-full" />
                ) : (
                  <p className="text-xs text-muted-foreground">No tag uploaded yet.</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tag-start">First at (sec)</Label>
                  <Input
                    id="tag-start"
                    type="number"
                    min={0}
                    value={settings.startOffsetSeconds}
                    onChange={(e) =>
                      setSettings({ ...settings, startOffsetSeconds: Number(e.target.value) })
                    }
                    onBlur={() => save(settings)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tag-interval">Every (sec)</Label>
                  <Input
                    id="tag-interval"
                    type="number"
                    min={5}
                    value={settings.intervalSeconds}
                    onChange={(e) =>
                      setSettings({ ...settings, intervalSeconds: Number(e.target.value) })
                    }
                    onBlur={() => save(settings)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tag-volume">Volume (0–1)</Label>
                  <Input
                    id="tag-volume"
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.volume}
                    onChange={(e) => setSettings({ ...settings, volume: Number(e.target.value) })}
                    onBlur={() => save(settings)}
                  />
                </div>
              </div>
            </div>
            {saving ? <p className="text-xs text-muted-foreground">Saving…</p> : null}
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Download a tagged copy</h2>
              <Input
                placeholder="Filter beats…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-9 w-56"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              The tagged file is built in this browser tab, so keep it open while it works. Long
              beats take a few seconds.
            </p>
            <ul className="mt-3 divide-y divide-border">
              {visible.slice(0, 100).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{b.title}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={rendering === b.id || !settings.tagUrl}
                    onClick={() => downloadTagged(b)}
                  >
                    {rendering === b.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Tagged WAV
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
