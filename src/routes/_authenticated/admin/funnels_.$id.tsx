import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, Monitor, Smartphone, ExternalLink, Save, ArrowUp, ArrowDown } from "lucide-react";
import { FunnelView, DEFAULT_CONTENT, type FunnelContent, type SectionKey } from "@/components/funnel/FunnelView";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/funnels_/$id")({
  component: EditFunnelPage,
});

interface FunnelRow {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  video_url: string | null;
  audio_url: string | null;
  cover_url: string | null;
  download_url: string;
  beat_id: string | null;
  is_active: boolean;
  content: Record<string, any> | null;
}

function EditFunnelPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const funnelQ = useQuery({
    queryKey: ["admin-funnel", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beat_funnels" as any)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as FunnelRow | null;
    },
  });

  // Editable state
  const [title, setTitle] = useState("");
  const [headline, setHeadline] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [content, setContent] = useState<FunnelContent>({});
  const [resolvedAudio, setResolvedAudio] = useState<string | null>(null);
  const [resolvedCover, setResolvedCover] = useState<string | null>(null);
  const [resolvedBeatTitle, setResolvedBeatTitle] = useState<string | null>(null);

  useEffect(() => {
    const f = funnelQ.data;
    if (!f) return;
    setTitle(f.title);
    setHeadline(f.headline ?? "");
    setVideoUrl(f.video_url ?? "");
    setDownloadUrl(f.download_url);
    setAudioUrl(f.audio_url ?? "");
    setCoverUrl(f.cover_url ?? "");
    setContent((f.content as FunnelContent) ?? {});
    // Resolve beat fields if linked
    if (f.beat_id) {
      void supabase
        .from("beats")
        .select("audio_url_tagged, audio_url, cover_url, title")
        .eq("id", f.beat_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setResolvedAudio((data as any).audio_url_tagged ?? (data as any).audio_url ?? null);
            setResolvedCover((data as any).cover_url ?? null);
            setResolvedBeatTitle((data as any).title ?? null);
          }
        });
    }
  }, [funnelQ.data]);

  const saveM = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("beat_funnels" as any)
        .update({
          title: title.trim(),
          headline: headline.trim() || null,
          video_url: videoUrl.trim() || null,
          download_url: downloadUrl.trim(),
          audio_url: audioUrl.trim() || null,
          cover_url: coverUrl.trim() || null,
          content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-funnel", id] });
      qc.invalidateQueries({ queryKey: ["admin-funnels"] });
    },
  });

  if (funnelQ.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!funnelQ.data) {
    return <p className="text-muted-foreground">Funnel not found.</p>;
  }

  const f = funnelQ.data;
  const c = { ...DEFAULT_CONTENT, ...content };
  const previewFunnel = {
    title,
    headline: headline || null,
    video_url: videoUrl || null,
    audio_url: audioUrl || resolvedAudio,
    cover_url: coverUrl || resolvedCover,
    download_url: downloadUrl || "#",
    beat_title: resolvedBeatTitle,
  };

  const setC = <K extends keyof FunnelContent>(k: K, v: FunnelContent[K]) =>
    setContent((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate({ to: "/admin/funnels" })}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{title || "Edit funnel"}</h1>
            <p className="text-xs text-muted-foreground">/b/{f.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/b/$slug"
            params={{ slug: f.slug }}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open live
          </Link>
          <Button onClick={() => saveM.mutate()} disabled={saveM.isPending} variant="hero">
            <Save className="h-4 w-4 mr-1.5" />
            {saveM.isPending ? "Saving..." : saveM.isSuccess ? "Saved" : "Save changes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        {/* LEFT: fields */}
        <div className="space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto pr-2">
          <Section title="Hero">
            <Field label="Eyebrow tag">
              <Input value={c.hero_eyebrow} onChange={(e) => setC("hero_eyebrow", e.target.value)} />
            </Field>
            <Field label="Headline">
              <Textarea
                value={c.hero_title}
                onChange={(e) => setC("hero_title", e.target.value)}
                rows={2}
              />
            </Field>
            <Field label="Subheadline">
              <Textarea
                value={c.hero_subtitle}
                onChange={(e) => setC("hero_subtitle", e.target.value)}
                rows={2}
              />
            </Field>
            <Field label="Headline override (legacy)">
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Leave empty to use subheadline"
              />
            </Field>
          </Section>

          <Section title="Media">
            <Field label="Video URL (YouTube / Loom / Vimeo)">
              <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
            </Field>
            <Field label="Cover image URL">
              <Input
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder={resolvedCover ?? ""}
              />
            </Field>
            <Field label="Sticky audio URL">
              <Input
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder={resolvedAudio ?? ""}
              />
            </Field>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label className="text-sm">Show sticky audio player</Label>
              <Switch
                checked={c.show_sticky_player}
                onCheckedChange={(v) => setC("show_sticky_player", v)}
              />
            </div>
          </Section>

          <Section title="Free download">
            <Field label="Download URL (file delivered)">
              <Input value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} />
            </Field>
            <Field label="Download link label">
              <Input value={c.download_label} onChange={(e) => setC("download_label", e.target.value)} />
            </Field>
          </Section>

          <Section title="Email capture card">
            <Field label="Heading">
              <Input value={c.email_heading} onChange={(e) => setC("email_heading", e.target.value)} />
            </Field>
            <Field label="Subheading">
              <Textarea
                value={c.email_subheading}
                onChange={(e) => setC("email_subheading", e.target.value)}
                rows={2}
              />
            </Field>
            <Field label="Input placeholder">
              <Input
                value={c.email_placeholder}
                onChange={(e) => setC("email_placeholder", e.target.value)}
              />
            </Field>
            <Field label="Button text">
              <Input value={c.email_button} onChange={(e) => setC("email_button", e.target.value)} />
            </Field>
            <Field label="Privacy line">
              <Input value={c.privacy_text} onChange={(e) => setC("privacy_text", e.target.value)} />
            </Field>
          </Section>

          <Section title="Typography">
            <SizeField
              label="Headline size"
              value={c.hero_title_size}
              min={24}
              max={96}
              onChange={(v) => setC("hero_title_size", v)}
            />
            <SizeField
              label="Subheadline size"
              value={c.hero_subtitle_size}
              min={12}
              max={28}
              onChange={(v) => setC("hero_subtitle_size", v)}
            />
            <SizeField
              label="Email card heading size"
              value={c.email_heading_size}
              min={14}
              max={36}
              onChange={(v) => setC("email_heading_size", v)}
            />
            <SizeField
              label="Body / button text size"
              value={c.body_size}
              min={12}
              max={20}
              onChange={(v) => setC("body_size", v)}
            />
          </Section>

          <Section title="Section order">
            <SectionOrder
              order={(content.section_order ?? DEFAULT_CONTENT.section_order) as SectionKey[]}
              onChange={(o) => setC("section_order", o)}
            />
          </Section>

          <Section title="Page meta">
            <Field label="Internal title (admin only)">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
          </Section>
        </div>

        {/* RIGHT: preview */}
        <div className="space-y-3">
          <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-card w-fit">
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                device === "desktop"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Monitor className="h-3.5 w-3.5" /> Desktop
            </button>
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                device === "mobile"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Smartphone className="h-3.5 w-3.5" /> Mobile
            </button>
          </div>

          <div className="rounded-2xl border border-border bg-muted/20 p-4 flex justify-center overflow-hidden">
            <div
              className={cn(
                "bg-background rounded-xl overflow-hidden border border-border shadow-2xl transition-all",
                device === "mobile" ? "w-[390px]" : "w-full max-w-[1100px]"
              )}
              style={{ height: "calc(100vh - 240px)", minHeight: 600 }}
            >
              <div className="h-full overflow-y-auto">
                <FunnelView
                  funnel={previewFunnel}
                  content={content}
                  previewMode
                  embedded
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function SizeField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs text-muted-foreground tabular-nums">{value}px</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}

const SECTION_LABELS: Record<SectionKey, string> = {
  hero: "Headline / eyebrow",
  video: "Video",
  download: "Download link",
  email: "Email capture card",
};

function SectionOrder({
  order,
  onChange,
}: {
  order: SectionKey[];
  onChange: (o: SectionKey[]) => void;
}) {
  const all: SectionKey[] = ["hero", "video", "download", "email"];
  const normalized = [...order.filter((k) => all.includes(k)), ...all.filter((k) => !order.includes(k))];

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...normalized];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {normalized.map((key, idx) => (
        <div
          key={key}
          className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
        >
          <span className="text-sm">
            <span className="text-muted-foreground mr-2 tabular-nums">{idx + 1}.</span>
            {SECTION_LABELS[key]}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => move(idx, -1)}
              disabled={idx === 0}
              className="p-1 rounded hover:bg-secondary disabled:opacity-30"
              aria-label="Move up"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => move(idx, 1)}
              disabled={idx === normalized.length - 1}
              className="p-1 rounded hover:bg-secondary disabled:opacity-30"
              aria-label="Move down"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
