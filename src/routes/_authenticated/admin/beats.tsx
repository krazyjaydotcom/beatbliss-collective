import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, Music, Trash2, FolderUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/beats")({
  component: AdminBeatsPage,
});

async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => resolve(Math.round(audio.duration || 0));
    audio.onerror = () => resolve(0);
    audio.src = URL.createObjectURL(file);
  });
}

function AdminBeatsPage() {
  const qc = useQueryClient();
  const { data: beats, isLoading } = useQuery({
    queryKey: ["admin-beats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("beats").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    title: "", genre: "", mood: "", bpm: "", music_key: "", producer_name: "KRAZYJAY",
    is_member_only: false,
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!audioFile) { toast.error("Audio file required"); return; }
    setUploading(true);
    try {
      const stamp = Date.now();
      const safeTitle = form.title.replace(/[^\w-]+/g, "_") || "beat";
      const audioPath = `${stamp}-${safeTitle}.${audioFile.name.split(".").pop()}`;
      const { error: aErr } = await supabase.storage.from("beat-audio").upload(audioPath, audioFile, { upsert: false });
      if (aErr) throw aErr;
      const { data: { publicUrl: audio_url } } = supabase.storage.from("beat-audio").getPublicUrl(audioPath);

      let cover_url: string | null = null;
      if (coverFile) {
        const coverPath = `${stamp}-${safeTitle}.${coverFile.name.split(".").pop()}`;
        const { error: cErr } = await supabase.storage.from("beat-covers").upload(coverPath, coverFile, { upsert: false });
        if (cErr) throw cErr;
        cover_url = supabase.storage.from("beat-covers").getPublicUrl(coverPath).data.publicUrl;
      }

      const duration_seconds = await getAudioDuration(audioFile);

      const { error: insErr } = await supabase.from("beats").insert({
        title: form.title,
        genre: form.genre,
        mood: form.mood || "Unknown",
        bpm: parseInt(form.bpm) || 0,
        music_key: form.music_key || "C",
        producer_name: form.producer_name,
        duration_seconds,
        audio_url, cover_url,
        is_member_only: form.is_member_only,
      });
      if (insErr) throw insErr;

      toast.success(`Uploaded "${form.title}"`);
      setForm({ title: "", genre: "", mood: "", bpm: "", music_key: "", producer_name: "KRAZYJAY", is_member_only: false });
      setAudioFile(null); setCoverFile(null);
      qc.invalidateQueries({ queryKey: ["admin-beats"] });
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    const { error } = await supabase.from("beats").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-beats"] });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Beats</h1>
        <p className="text-muted-foreground mt-1">Upload and manage your catalog</p>
      </div>

      <form onSubmit={handleUpload} className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Upload className="h-4 w-4" /> Upload new beat</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Title *"><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Producer"><Input value={form.producer_name} onChange={(e) => setForm({ ...form, producer_name: e.target.value })} /></Field>
          <Field label="Genre *"><Input required value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} placeholder="Trap, R&B, Funk…" /></Field>
          <Field label="Mood"><Input value={form.mood} onChange={(e) => setForm({ ...form, mood: e.target.value })} placeholder="Dark, Chill, Hype…" /></Field>
          <Field label="BPM *"><Input required type="number" value={form.bpm} onChange={(e) => setForm({ ...form, bpm: e.target.value })} /></Field>
          <Field label="Key"><Input value={form.music_key} onChange={(e) => setForm({ ...form, music_key: e.target.value })} placeholder="C minor" /></Field>
          <Field label="Audio file (mp3/wav) *"><Input required type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} /></Field>
          <Field label="Cover image"><Input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_member_only} onChange={(e) => setForm({ ...form, is_member_only: e.target.checked })} />
          Members only
        </label>
        <Button type="submit" disabled={uploading}>
          {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading…</> : "Upload beat"}
        </Button>
      </form>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Music className="h-4 w-4" /> Catalog ({beats?.length ?? 0})</h2>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
          <div className="divide-y divide-border">
            {beats?.map((b: any) => (
              <div key={b.id} className="py-3 flex items-center gap-4">
                {b.cover_url ? <img src={b.cover_url} className="h-12 w-12 rounded object-cover" alt="" /> : <div className="h-12 w-12 rounded bg-muted" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{b.title}</div>
                  <div className="text-xs text-muted-foreground">{b.genre} · {b.bpm} BPM · {b.music_key}{b.is_member_only ? " · Members" : ""}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(b.id, b.title)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {beats?.length === 0 && <p className="text-sm text-muted-foreground py-4">No beats yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
