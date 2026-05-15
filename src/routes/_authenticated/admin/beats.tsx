import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image, Loader2, Music, Save, Trash2, FolderUp, FileAudio, FileMusic, Pencil, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  tagged?: File;
  cover?: File;
  title: string;
  status: "queued" | "decoding" | "uploading" | "done" | "error";
  message?: string;
};

function stripTagTokens(name: string): string {
  return name.toLowerCase().replace(/[\s_-]*(tagged|tag)[\s_-]*/g, "").replace(/\.[^.]+$/, "").trim();
}
function isTaggedName(name: string): boolean {
  return /(?:^|[\s_-])(tag|tagged)(?:[\s_-]|\.)/i.test(name);
}

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
  const [editingBeat, setEditingBeat] = useState<any | null>(null);
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
        <p className="text-muted-foreground mt-1">Drag &amp; drop to upload. MP3 + WAV are auto-generated. Files with <code>tag</code> or <code>tagged</code> in the name are paired as the free-tier preview.</p>
      </div>

      <DropUploader onDone={() => qc.invalidateQueries({ queryKey: ["admin-beats"] })} />

      <ExclusiveRightsAdminPanel />

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
            {beats.map((b: any) => {
              const scheduled = !!b.release_at && new Date(b.release_at).getTime() > Date.now();
              return (
              <div key={b.id} className="py-3 flex items-center gap-4">
                <Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggle(b.id)} />
                {b.cover_url ? <img src={b.cover_url} className="h-14 w-14 rounded-md object-cover border border-border" alt={b.title} /> : <div className="h-14 w-14 rounded-md bg-muted border border-border flex items-center justify-center"><Image className="h-5 w-5 text-muted-foreground" /></div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 font-medium truncate">
                    <span className="truncate">{b.title}</span>
                    {scheduled ? (
                      <Badge variant="secondary" className="border border-amber-500/30 bg-amber-500/10 text-amber-300">
                        Scheduled
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {b.genre} · {b.bpm} BPM · {b.music_key}
                    {b.audio_url ? <span className="ml-2 inline-flex items-center gap-1"><FileMusic className="h-3 w-3" />MP3</span> : null}
                    {b.audio_url_wav ? <span className="ml-2 inline-flex items-center gap-1"><FileAudio className="h-3 w-3" />WAV</span> : null}
                    {b.audio_url_tagged ? <span className="ml-2 inline-flex items-center gap-1 text-electric"><FileMusic className="h-3 w-3" />TAGGED</span> : <span className="ml-2 text-amber-500">· no tagged file (free users blocked)</span>}
                    {b.is_member_only ? " · Members" : ""}
                    {scheduled ? <span className="ml-2 text-amber-400">· releases {new Date(b.release_at).toLocaleString()}</span> : null}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditingBeat(b)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(b.id, b.title)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            );
            })}
            {beats.length === 0 && <p className="text-sm text-muted-foreground py-4">No beats yet.</p>}
          </div>
        )}
      </div>

      <EditBeatDialog
        beat={editingBeat}
        onClose={() => setEditingBeat(null)}
        onDone={() => {
          setEditingBeat(null);
          qc.invalidateQueries({ queryKey: ["admin-beats"] });
        }}
      />
    </div>
  );
}

function ExclusiveRightsAdminPanel() {
  const qc = useQueryClient();
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin-exclusive-requests"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("exclusive_requests")
        .select("*, beats(title, cover_url, genre, bpm), profiles!exclusive_requests_requested_by_fkey(email, display_name, full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: bids = [] } = useQuery({
    queryKey: ["admin-exclusive-bids"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("exclusive_bids")
        .select("*, profiles!exclusive_bids_user_id_fkey(email, display_name, full_name)")
        .order("amount", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function updateRequest(id: string, patch: Record<string, unknown>) {
    const { error } = await (supabase as any).from("exclusive_requests").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Exclusive request updated");
    qc.invalidateQueries({ queryKey: ["admin-exclusive-requests"] });
    qc.invalidateQueries({ queryKey: ["admin-exclusive-bids"] });
  }

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Sparkles className="h-5 w-5 text-primary" />
            Exclusive Rights Requests
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review member requests, open bidding windows, and track bids from members who downloaded each beat.
          </p>
        </div>
        <Badge variant="outline">{requests.length} total</Badge>
      </div>

      {isLoading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading exclusive requests...
        </div>
      ) : requests.length ? (
        <div className="mt-5 space-y-4">
          {requests.map((request: any) => (
            <ExclusiveRequestAdminRow
              key={request.id}
              request={request}
              bids={bids.filter((bid: any) => bid.request_id === request.id)}
              onUpdate={(patch) => updateRequest(request.id, patch)}
            />
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No exclusive rights requests yet.
        </p>
      )}
    </div>
  );
}

function ExclusiveRequestAdminRow({
  request,
  bids,
  onUpdate,
}: {
  request: any;
  bids: any[];
  onUpdate: (patch: Record<string, unknown>) => void;
}) {
  const [minimumBid, setMinimumBid] = useState(String(request.minimum_bid ?? request.requested_amount ?? 500));
  const [deadline, setDeadline] = useState(
    request.bid_deadline
      ? new Date(request.bid_deadline).toISOString().slice(0, 16)
      : new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 16),
  );
  const highBid = bids.reduce((max, bid) => Math.max(max, Number(bid.amount ?? 0)), 0);
  const requester = request.profiles?.display_name || request.profiles?.full_name || request.profiles?.email || "Member";

  const openWindow = () => {
    const parsed = Number(minimumBid);
    if (!Number.isFinite(parsed) || parsed <= 0) return toast.error("Enter a valid minimum bid.");
    if (!deadline) return toast.error("Choose a bidding deadline.");
    onUpdate({
      status: "open",
      minimum_bid: parsed,
      bid_deadline: new Date(deadline).toISOString(),
      opened_at: new Date().toISOString(),
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {request.beats?.cover_url ? (
          <img src={request.beats.cover_url} alt={request.beats.title} className="h-16 w-16 rounded-lg object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
            <Music className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold">{request.beats?.title ?? "Unknown beat"}</p>
            <Badge variant="secondary">{request.status}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Requested by {requester} - Offer {request.requested_amount ? `$${request.requested_amount}` : "not specified"}
          </p>
          {request.intended_use ? <p className="mt-2 text-sm">{request.intended_use}</p> : null}
          {request.notes ? <p className="mt-1 text-xs text-muted-foreground">{request.notes}</p> : null}
          <div className="mt-3 grid gap-3 md:grid-cols-[150px_220px_1fr]">
            <div>
              <Label>Minimum bid</Label>
              <Input value={minimumBid} onChange={(e) => setMinimumBid(e.target.value)} type="number" min="1" />
            </div>
            <div>
              <Label>Bid deadline</Label>
              <Input value={deadline} onChange={(e) => setDeadline(e.target.value)} type="datetime-local" />
            </div>
            <div className="flex items-end gap-2">
              <Button size="sm" variant="hero" onClick={openWindow}>
                {request.status === "open" ? "Update window" : "Open bidding"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onUpdate({ status: "closed", closed_at: new Date().toISOString() })}>
                Close
              </Button>
              <Button size="sm" variant="outline" onClick={() => onUpdate({ status: "rejected", closed_at: new Date().toISOString() })}>
                Reject
              </Button>
              <Button size="sm" variant="outline" onClick={() => onUpdate({ status: "sold", closed_at: new Date().toISOString() })}>
                Sold
              </Button>
            </div>
          </div>
        </div>
        <div className="min-w-[190px] rounded-lg border border-border bg-background/60 p-3 text-sm">
          <p className="text-xs font-bold uppercase text-muted-foreground">Bidding</p>
          <p className="mt-1 text-lg font-black">${highBid.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{bids.length} bid{bids.length === 1 ? "" : "s"}</p>
          <div className="mt-3 space-y-2">
            {bids.slice(0, 3).map((bid) => (
              <div key={bid.id} className="rounded-md bg-muted/40 p-2 text-xs">
                <p className="font-semibold">${Number(bid.amount).toLocaleString()}</p>
                <p className="text-muted-foreground">
                  {bid.profiles?.display_name || bid.profiles?.full_name || bid.profiles?.email || bid.user_id}
                </p>
              </div>
            ))}
          </div>
        </div>
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
  const [releaseAt, setReleaseAt] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function basename(name: string) { return name.replace(/\.[^.]+$/, ""); }

  function addFiles(files: File[]) {
    const audiosAll = files.filter((f) => isMp3(f) || isWav(f) || f.type.startsWith("audio/"));
    const covers = files.filter((f) => f.type.startsWith("image/"));
    const taggedAudios = audiosAll.filter((a) => isTaggedName(a.name));
    const cleanAudios = audiosAll.filter((a) => !isTaggedName(a.name));
    const taggedByBase = new Map(taggedAudios.map((t) => [stripTagTokens(t.name), t]));
    const coverByBase = new Map(covers.map((c) => [basename(c.name).toLowerCase(), c]));

    const next: Pending[] = cleanAudios.map((a) => {
      const base = basename(a.name).toLowerCase();
      return {
        id: crypto.randomUUID(),
        audio: a,
        tagged: taggedByBase.get(base) ?? taggedByBase.get(stripTagTokens(a.name)),
        cover: coverByBase.get(base),
        title: basename(a.name),
        status: "queued",
      };
    });

    // Tagged-only drops (no clean counterpart) become standalone "tagged-only" entries
    const consumedTagged = new Set(next.map((n) => n.tagged).filter(Boolean));
    const orphanTagged = taggedAudios.filter((t) => !consumedTagged.has(t));
    for (const t of orphanTagged) {
      next.push({
        id: crypto.randomUUID(),
        audio: t,
        tagged: t,
        cover: coverByBase.get(basename(t.name).toLowerCase()),
        title: basename(t.name).replace(/[\s_-]*(tagged|tag)[\s_-]*/gi, "").trim(),
        status: "queued",
      });
    }

    setItems((cur) => [...cur, ...next]);
    if (audiosAll.length === 0 && files.length) toast.error("No audio files detected");
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
      const taggedOnly = p.tagged && p.audio === p.tagged;
      const buf = await decodeAudioFile(p.audio);
      const sourceIsMp3 = isMp3(p.audio);

      setStatus("uploading");
      const stamp = Date.now();
      const safe = (p.title || "beat").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
      let audio_url: string | null = null;
      let audio_url_wav: string | null = null;
      let audio_url_tagged: string | null = null;

      if (!taggedOnly) {
        const mp3Blob = sourceIsMp3 ? p.audio : encodeMp3(buf, 192);
        const wavBlob = isWav(p.audio) ? p.audio : encodeWav(buf);
        const mp3Path = `KRAZYJAYDOTCOM_${safe}.mp3`;
        const wavPath = `KRAZYJAYDOTCOM_${safe}.wav`;
        const up1 = await supabase.storage.from("beat-audio").upload(mp3Path, mp3Blob, { upsert: false, contentType: "audio/mpeg" });
        if (up1.error) throw up1.error;
        const up2 = await supabase.storage.from("beat-audio").upload(wavPath, wavBlob, { upsert: false, contentType: "audio/wav" });
        if (up2.error) throw up2.error;
        audio_url = supabase.storage.from("beat-audio").getPublicUrl(mp3Path).data.publicUrl;
        audio_url_wav = supabase.storage.from("beat-audio").getPublicUrl(wavPath).data.publicUrl;
      }

      if (p.tagged) {
        const tBuf = p.tagged === p.audio ? buf : await decodeAudioFile(p.tagged);
        const tBlob = isMp3(p.tagged) ? p.tagged : encodeMp3(tBuf, 192);
        const tPath = `KRAZYJAYDOTCOM_${safe}_Tagged.mp3`;
        const upT = await supabase.storage.from("beat-audio").upload(tPath, tBlob, { upsert: false, contentType: "audio/mpeg" });
        if (upT.error) throw upT.error;
        audio_url_tagged = supabase.storage.from("beat-audio").getPublicUrl(tPath).data.publicUrl;
      }

      let cover_url: string | null = null;
      if (p.cover) {
        const coverPath = `${stamp}-${safe}.${p.cover.name.split(".").pop()}`;
        const cu = await supabase.storage.from("beat-covers").upload(coverPath, p.cover, { upsert: false });
        if (!cu.error) cover_url = supabase.storage.from("beat-covers").getPublicUrl(coverPath).data.publicUrl;
      }

      const duration_seconds = Math.round(buf.duration);

      const { error: insErr } = await (supabase as any).from("beats").insert({
        title: p.title, genre, mood: "Unknown", bpm: parseInt(bpm) || 0,
        music_key: "C", producer_name: "KRAZYJAY",
        duration_seconds, audio_url, audio_url_wav, audio_url_tagged, cover_url,
        is_member_only: memberOnly,
        release_at: releaseAt ? new Date(releaseAt).toISOString() : null,
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Field label="Default genre"><Input value={genre} onChange={(e) => setGenre(e.target.value)} /></Field>
        <Field label="Default BPM"><Input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} /></Field>
        <Field label="Release Date">
          <Input type="datetime-local" value={releaseAt} onChange={(e) => setReleaseAt(e.target.value)} />
        </Field>
        <label className="flex items-end gap-2 pb-2 text-sm">
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
                {i.audio.name}
                {i.tagged && i.tagged !== i.audio ? ` · tagged: ${i.tagged.name}` : i.tagged === i.audio ? " · (tagged-only)" : <span className="text-amber-500"> · no tagged file</span>}
                {i.cover ? ` · cover: ${i.cover.name}` : ""}
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

// ---------------- Single beat editor ----------------

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function EditBeatDialog({ beat, onClose, onDone }: { beat: any | null; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [producer, setProducer] = useState("");
  const [genre, setGenre] = useState("");
  const [mood, setMood] = useState("");
  const [bpm, setBpm] = useState("");
  const [musicKey, setMusicKey] = useState("");
  const [duration, setDuration] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [memberOnly, setMemberOnly] = useState(false);
  const [releaseAt, setReleaseAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!beat) return;
    setTitle(beat.title ?? "");
    setProducer(beat.producer_name ?? "");
    setGenre(beat.genre ?? "");
    setMood(beat.mood ?? "");
    setBpm(String(beat.bpm ?? ""));
    setMusicKey(beat.music_key ?? "");
    setDuration(String(beat.duration_seconds ?? ""));
    setCoverUrl(beat.cover_url ?? "");
    setThumbnailFile(null);
    setMemberOnly(!!beat.is_member_only);
    setReleaseAt(toDateTimeLocal(beat.release_at));
  }, [beat?.id]);

  async function save() {
    if (!beat) return;
    if (!title.trim()) return toast.error("Title is required");
    setSaving(true);
    try {
      let nextCoverUrl = coverUrl.trim() || null;
      if (thumbnailFile) {
        const ext = thumbnailFile.name.split(".").pop() || "jpg";
        const safeTitle = (title || "beat").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "beat";
        const coverPath = "primary_" + beat.id + "_" + Date.now() + "_" + safeTitle + "." + ext;
        const upload = await supabase.storage.from("beat-covers").upload(coverPath, thumbnailFile, {
          upsert: false,
          contentType: thumbnailFile.type || "image/jpeg",
        });
        if (upload.error) throw upload.error;
        nextCoverUrl = supabase.storage.from("beat-covers").getPublicUrl(coverPath).data.publicUrl;
      }

      const { error } = await (supabase as any).from("beats").update({
        title: title.trim(),
        producer_name: producer.trim() || null,
        genre: genre.trim() || null,
        mood: mood.trim() || null,
        bpm: bpm ? parseInt(bpm, 10) || 0 : 0,
        music_key: musicKey.trim() || null,
        duration_seconds: duration ? parseInt(duration, 10) || 0 : 0,
        cover_url: nextCoverUrl,
        is_member_only: memberOnly,
        release_at: releaseAt ? new Date(releaseAt).toISOString() : null,
      }).eq("id", beat.id);

      if (error) throw error;
      toast.success("Beat updated");
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Could not update beat");
    } finally {
      setSaving(false);
    }
  }

  const previewUrl = thumbnailFile ? URL.createObjectURL(thumbnailFile) : coverUrl;

  return (
    <Dialog open={!!beat} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" /> Edit beat information</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[180px_1fr]">
          <div className="space-y-3">
            <div className="aspect-square rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center">
              {previewUrl ? <img src={previewUrl} alt="Thumbnail preview" className="h-full w-full object-cover" /> : <Image className="h-8 w-8 text-muted-foreground" />}
            </div>
            <Field label="Primary thumbnail URL"><Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..." /></Field>
            <Field label="Upload new thumbnail"><Input type="file" accept="image/*" onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)} /></Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Producer"><Input value={producer} onChange={(e) => setProducer(e.target.value)} /></Field>
            <Field label="Genre"><Input value={genre} onChange={(e) => setGenre(e.target.value)} /></Field>
            <Field label="Mood"><Input value={mood} onChange={(e) => setMood(e.target.value)} /></Field>
            <Field label="BPM"><Input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} /></Field>
            <Field label="Key"><Input value={musicKey} onChange={(e) => setMusicKey(e.target.value)} /></Field>
            <Field label="Duration seconds"><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></Field>
            <Field label="Release date"><Input type="datetime-local" value={releaseAt} onChange={(e) => setReleaseAt(e.target.value)} /></Field>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <Checkbox checked={memberOnly} onCheckedChange={(v) => setMemberOnly(!!v)} />
              Members only
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><Save className="h-4 w-4 mr-2" /> Save beat</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

