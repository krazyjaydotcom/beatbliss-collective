import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Music, Trash2, FolderUp, FileAudio, FileMusic, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { decodeAudioFile, encodeMp3, encodeWav, isMp3, isWav } from "@/lib/audio-convert";

export const Route = createFileRoute("/_authenticated/admin/beats")({
  component: AdminBeatsPage,
});

async function getAudioDuration(file: File | Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => resolve(Math.round(audio.duration || 0));
    audio.onerror = () => resolve(0);
    audio.src = URL.createObjectURL(file);
  });
}

type Pending = {
  id: string;
  audio: File;
  cover?: File;
  title: string;
  status: "queued" | "decoding" | "uploading" | "done" | "error";
  message?: string;
};

function AdminBeatsPage() {
  const qc = useQueryClient();
  const { data: beats = [], isLoading } = useQuery({
    queryKey: ["admin-beats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("beats").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const allSelected = beats.length > 0 && beats.every((b: any) => selected.has(b.id));

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    const { error } = await supabase.from("beats").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    qc.invalidateQueries({ queryKey: ["admin-beats"] });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Beats</h1>
        <p className="text-muted-foreground mt-1">Drag &amp; drop to upload. Both MP3 and WAV are saved automatically.</p>
      </div>

      <DropUploader onDone={() => qc.invalidateQueries({ queryKey: ["admin-beats"] })} />

      {selected.size > 0 && (
        <BulkEditBar
          ids={Array.from(selected)}
          onDone={() => { setSelected(new Set()); qc.invalidateQueries({ queryKey: ["admin-beats"] }); }}
          onClear={() => setSelected(new Set())}
        />
      )}

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2"><Music className="h-4 w-4" /> Catalog ({beats.length})</h2>
          {beats.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => setSelected(v ? new Set(beats.map((b: any) => b.id)) : new Set())}
              />
              Select all
            </label>
          )}
        </div>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
          <div className="divide-y divide-border">
            {beats.map((b: any) => (
              <div key={b.id} className="py-3 flex items-center gap-4">
                <Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggle(b.id)} />
                {b.cover_url ? <img src={b.cover_url} className="h-12 w-12 rounded object-cover" alt="" /> : <div className="h-12 w-12 rounded bg-muted" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{b.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {b.genre} · {b.bpm} BPM · {b.music_key}
                    {b.audio_url ? <span className="ml-2 inline-flex items-center gap-1"><FileMusic className="h-3 w-3" />MP3</span> : null}
                    {b.audio_url_wav ? <span className="ml-2 inline-flex items-center gap-1"><FileAudio className="h-3 w-3" />WAV</span> : null}
                    {b.is_member_only ? " · Members" : ""}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(b.id, b.title)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {beats.length === 0 && <p className="text-sm text-muted-foreground py-4">No beats yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Drag & drop uploader with auto MP3/WAV conversion ----------------

function DropUploader({ onDone }: { onDone: () => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [items, setItems] = useState<Pending[]>([]);
  const [genre, setGenre] = useState("Trap");
  const [bpm, setBpm] = useState("140");
  const [memberOnly, setMemberOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function basename(name: string) { return name.replace(/\.[^.]+$/, ""); }

  function addFiles(files: File[]) {
    const audios = files.filter((f) => isMp3(f) || isWav(f) || f.type.startsWith("audio/"));
    const covers = files.filter((f) => f.type.startsWith("image/"));
    const coverByBase = new Map(covers.map((c) => [basename(c.name).toLowerCase(), c]));
    const next: Pending[] = audios.map((a) => ({
      id: crypto.randomUUID(),
      audio: a,
      cover: coverByBase.get(basename(a.name).toLowerCase()),
      title: basename(a.name),
      status: "queued",
    }));
    setItems((cur) => [...cur, ...next]);
    if (audios.length === 0 && files.length) toast.error("No audio files detected");
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  }

  function removeItem(id: string) { setItems((s) => s.filter((i) => i.id !== id)); }

  async function uploadOne(p: Pending): Promise<boolean> {
    const setStatus = (status: Pending["status"], message?: string) =>
      setItems((s) => s.map((i) => i.id === p.id ? { ...i, status, message } : i));
    try {
      setStatus("decoding");
      const buf = await decodeAudioFile(p.audio);
      const sourceIsMp3 = isMp3(p.audio);
      const mp3Blob = sourceIsMp3 ? p.audio : encodeMp3(buf, 192);
      const wavBlob = isWav(p.audio) ? p.audio : encodeWav(buf);

      setStatus("uploading");
      const stamp = Date.now();
      const safe = (p.title || "beat").replace(/[^\w-]+/g, "_");

      const mp3Path = `${stamp}-${safe}.mp3`;
      const wavPath = `${stamp}-${safe}.wav`;

      const up1 = await supabase.storage.from("beat-audio").upload(mp3Path, mp3Blob, { upsert: false, contentType: "audio/mpeg" });
      if (up1.error) throw up1.error;
      const up2 = await supabase.storage.from("beat-audio").upload(wavPath, wavBlob, { upsert: false, contentType: "audio/wav" });
      if (up2.error) throw up2.error;

      const audio_url = supabase.storage.from("beat-audio").getPublicUrl(mp3Path).data.publicUrl;
      const audio_url_wav = supabase.storage.from("beat-audio").getPublicUrl(wavPath).data.publicUrl;

      let cover_url: string | null = null;
      if (p.cover) {
        const coverPath = `${stamp}-${safe}.${p.cover.name.split(".").pop()}`;
        const cu = await supabase.storage.from("beat-covers").upload(coverPath, p.cover, { upsert: false });
        if (!cu.error) cover_url = supabase.storage.from("beat-covers").getPublicUrl(coverPath).data.publicUrl;
      }

      const duration_seconds = Math.round(buf.duration);

      const { error: insErr } = await supabase.from("beats").insert({
        title: p.title, genre, mood: "Unknown", bpm: parseInt(bpm) || 0,
        music_key: "C", producer_name: "KRAZYJAY",
        duration_seconds, audio_url, audio_url_wav, cover_url,
        is_member_only: memberOnly,
      });
      if (insErr) throw insErr;

      setStatus("done");
      return true;
    } catch (e: any) {
      console.error("upload failed", p.audio.name, e);
      setStatus("error", e.message || "Failed");
      return false;
    }
  }

  async function runAll() {
    if (!items.length) return;
    setBusy(true);
    let ok = 0, failed = 0;
    for (const p of items) {
      if (p.status === "done") continue;
      const r = await uploadOne(p);
      r ? ok++ : failed++;
    }
    setBusy(false);
    toast.success(`Upload complete: ${ok} succeeded, ${failed} failed`);
    onDone();
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); runAll(); }} className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h2 className="font-semibold flex items-center gap-2"><FolderUp className="h-4 w-4" /> Upload beats</h2>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
      >
        <FolderUp className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <div className="font-medium">Drop audio files here, or click to browse</div>
        <p className="text-xs text-muted-foreground mt-1">
          MP3 and WAV are auto-generated for every beat. You can also include cover images with matching filenames.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,image/*"
          multiple
          className="hidden"
          onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Default genre"><Input value={genre} onChange={(e) => setGenre(e.target.value)} /></Field>
        <Field label="Default BPM"><Input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} /></Field>
        <label className="flex items-end gap-2 text-sm pb-2">
          <Checkbox checked={memberOnly} onCheckedChange={(v) => setMemberOnly(!!v)} />
          Members only
        </label>
      </div>

      {items.length > 0 && (
        <div className="rounded-xl border border-border divide-y divide-border max-h-72 overflow-auto">
          {items.map((i) => (
            <div key={i.id} className="px-3 py-2 flex items-center gap-3 text-sm">
              <FileMusic className="h-4 w-4 text-muted-foreground" />
              <Input
                className="h-8 max-w-xs"
                value={i.title}
                onChange={(e) => setItems((s) => s.map((x) => x.id === i.id ? { ...x, title: e.target.value } : x))}
              />
              <span className="text-xs text-muted-foreground truncate flex-1">
                {i.audio.name}{i.cover ? ` · cover: ${i.cover.name}` : ""}
              </span>
              <span className={`text-xs ${i.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                {i.status === "done" ? "✓ done" : i.status === "error" ? `✗ ${i.message ?? "error"}` : i.status}
              </span>
              {!busy && i.status !== "done" && (
                <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(i.id)}><X className="h-3 w-3" /></Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Button type="submit" disabled={busy || !items.length}>
        {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing…</> : `Upload ${items.length || ""} beat${items.length === 1 ? "" : "s"}`}
      </Button>
    </form>
  );
}

// ---------------- Bulk edit bar ----------------

function BulkEditBar({ ids, onDone, onClear }: { ids: string[]; onDone: () => void; onClear: () => void }) {
  const [genre, setGenre] = useState("");
  const [mood, setMood] = useState("");
  const [bpm, setBpm] = useState("");
  const [musicKey, setMusicKey] = useState("");
  const [memberOnly, setMemberOnly] = useState<"unchanged" | "yes" | "no">("unchanged");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { data, error } = await supabase.rpc("admin_bulk_update_beats", {
      _ids: ids,
      _genre: genre || undefined,
      _mood: mood || undefined,
      _bpm: bpm ? parseInt(bpm) : undefined,
      _music_key: musicKey || undefined,
      _is_member_only: memberOnly === "unchanged" ? undefined : memberOnly === "yes",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Updated ${data} beat${data === 1 ? "" : "s"}`);
    onDone();
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${ids.length} beat${ids.length === 1 ? "" : "s"}?`)) return;
    const { error } = await supabase.from("beats").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`Deleted ${ids.length}`);
    onDone();
  }

  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5 space-y-3 sticky top-2 z-10 backdrop-blur">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Pencil className="h-4 w-4" /> Bulk edit · {ids.length} selected</h3>
        <Button variant="ghost" size="sm" onClick={onClear}><X className="h-4 w-4" /></Button>
      </div>
      <p className="text-xs text-muted-foreground">Leave a field blank to keep existing values.</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Field label="Genre"><Input value={genre} onChange={(e) => setGenre(e.target.value)} /></Field>
        <Field label="Mood"><Input value={mood} onChange={(e) => setMood(e.target.value)} /></Field>
        <Field label="BPM"><Input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} /></Field>
        <Field label="Key"><Input value={musicKey} onChange={(e) => setMusicKey(e.target.value)} /></Field>
        <Field label="Members only">
          <select
            value={memberOnly}
            onChange={(e) => setMemberOnly(e.target.value as any)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="unchanged">Unchanged</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Apply"}
        </Button>
        <Button variant="destructive" onClick={bulkDelete} disabled={saving}>
          <Trash2 className="h-4 w-4 mr-2" /> Delete selected
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
