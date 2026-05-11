import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Copy, Check, Trash2, Power, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/funnels")({
  component: AdminFunnelsPage,
});

interface Funnel {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  video_url: string | null;
  beat_id: string | null;
  audio_url: string | null;
  cover_url: string | null;
  download_url: string;
  is_active: boolean;
  view_count: number;
  created_at: string;
}

interface BeatRow {
  id: string;
  title: string;
  audio_url: string | null;
  audio_url_tagged: string | null;
  audio_url_wav: string | null;
  cover_url: string | null;
}

function AdminFunnelsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const funnelsQ = useQuery({
    queryKey: ["admin-funnels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beat_funnels" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Funnel[];
    },
  });

  const leadCountsQ = useQuery({
    queryKey: ["admin-funnel-lead-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beat_funnel_leads" as any)
        .select("funnel_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((row: any) => {
        map[row.funnel_id] = (map[row.funnel_id] ?? 0) + 1;
      });
      return map;
    },
  });

  const toggleM = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("beat_funnels" as any)
        .update({ is_active: active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-funnels"] }),
  });

  const deleteM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("beat_funnels" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-funnels"] });
      qc.invalidateQueries({ queryKey: ["admin-funnel-lead-counts"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Beat Funnels</h1>
          <p className="text-muted-foreground mt-1">
            One landing page per beat. Capture emails, then upsell the catalog.
          </p>
        </div>
        <Button variant="hero" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New funnel
        </Button>
      </div>

      {creating && <NewFunnelForm onClose={() => setCreating(false)} />}

      {funnelsQ.isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : funnelsQ.data && funnelsQ.data.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Funnel</th>
                <th className="text-left px-4 py-3">Link</th>
                <th className="text-right px-4 py-3">Leads</th>
                <th className="text-right px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {funnelsQ.data.map((f) => (
                <FunnelRow
                  key={f.id}
                  funnel={f}
                  leadCount={leadCountsQ.data?.[f.id] ?? 0}
                  onToggle={() => toggleM.mutate({ id: f.id, active: !f.is_active })}
                  onDelete={() => {
                    if (confirm(`Delete funnel "${f.title}"? Leads will be removed too.`)) {
                      deleteM.mutate(f.id);
                    }
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">
            No funnels yet. Create one to start sending beat-specific links.
          </p>
        </div>
      )}
    </div>
  );
}

function FunnelRow({
  funnel,
  leadCount,
  onToggle,
  onDelete,
}: {
  funnel: Funnel;
  leadCount: number;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined" ? `${window.location.origin}/b/${funnel.slug}` : `/b/${funnel.slug}`;

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3">
        <p className="font-medium">{funnel.title}</p>
        <p className="text-xs text-muted-foreground">/b/{funnel.slug}</p>
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied!" : "Copy link"}
        </button>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{leadCount}</td>
      <td className="px-4 py-3 text-right">
        <span
          className={
            funnel.is_active
              ? "inline-flex items-center gap-1 text-xs text-primary"
              : "inline-flex items-center gap-1 text-xs text-muted-foreground"
          }
        >
          {funnel.is_active ? "Active" : "Off"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Link
            to="/admin/funnels/$id"
            params={{ id: funnel.id }}
            className="p-2 rounded-md hover:bg-muted/40 text-muted-foreground hover:text-foreground"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={onToggle}
            className="p-2 rounded-md hover:bg-muted/40 text-muted-foreground hover:text-foreground"
            title={funnel.is_active ? "Disable" : "Enable"}
          >
            <Power className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function NewFunnelForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [headline, setHeadline] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [beatId, setBeatId] = useState<string>("");
  const [audioUrl, setAudioUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const beatsQ = useQuery({
    queryKey: ["admin-beats-mini"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beats")
        .select("id, title, audio_url, audio_url_tagged, audio_url_wav, cover_url")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as BeatRow[];
    },
  });

  const createM = useMutation({
    mutationFn: async () => {
      if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) {
        throw new Error("Slug must be lowercase letters, numbers, and dashes only.");
      }
      if (!title.trim()) throw new Error("Title is required.");
      if (!downloadUrl.trim()) throw new Error("Download URL is required.");

      const payload: any = {
        slug,
        title: title.trim(),
        headline: headline.trim() || null,
        video_url: videoUrl.trim() || null,
        download_url: downloadUrl.trim(),
        is_active: true,
      };

      if (beatId) {
        payload.beat_id = beatId;
        payload.audio_url = null;
        payload.cover_url = null;
      } else {
        payload.beat_id = null;
        payload.audio_url = audioUrl.trim() || null;
        payload.cover_url = coverUrl.trim() || null;
      }

      const { error } = await supabase.from("beat_funnels" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-funnels"] });
      onClose();
    },
    onError: (e: any) => setError(e?.message ?? "Failed to create funnel"),
  });

  // When picking a beat, auto-fill download URL with the WAV/MP3 if download empty
  const onPickBeat = (id: string) => {
    setBeatId(id);
    if (id && !downloadUrl) {
      const b = beatsQ.data?.find((x) => x.id === id);
      const url = b?.audio_url_wav ?? b?.audio_url ?? b?.audio_url_tagged;
      if (url) setDownloadUrl(url);
    }
    if (id && !title) {
      const b = beatsQ.data?.find((x) => x.id === id);
      if (b?.title) setTitle(b.title);
    }
    if (id && !slug) {
      const b = beatsQ.data?.find((x) => x.id === id);
      if (b?.title) {
        setSlug(
          b.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 64),
        );
      }
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        createM.mutate();
      }}
      className="rounded-2xl border border-border bg-card p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">New beat funnel</h2>
        <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Pick a beat from your catalog (optional)</Label>
          <select
            value={beatId}
            onChange={(e) => onPickBeat(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-9"
          >
            <option value="">— No beat / use custom URL below —</option>
            {beatsQ.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Slug (URL)</Label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="midnight-drive"
            required
          />
          <p className="mt-1 text-[11px] text-muted-foreground">Will be /b/{slug || "your-slug"}</p>
        </div>
      </div>

      <div>
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Midnight Drive" required />
      </div>

      <div>
        <Label>Headline (optional)</Label>
        <Input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="The dark trap beat that goes hard at 3 AM"
        />
      </div>

      <div>
        <Label>Video URL (YouTube / Loom / Vimeo)</Label>
        <Input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://youtu.be/..."
        />
      </div>

      <div>
        <Label>Download URL (file delivered after email capture)</Label>
        <Input
          value={downloadUrl}
          onChange={(e) => setDownloadUrl(e.target.value)}
          placeholder="https://..."
          required
        />
      </div>

      {!beatId && (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Preview audio URL (optional)</Label>
            <Input value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>Cover image URL (optional)</Label>
            <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" variant="hero" disabled={createM.isPending}>
        {createM.isPending ? "Creating..." : "Create funnel"}
      </Button>
    </form>
  );
}
