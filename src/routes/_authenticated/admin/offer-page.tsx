import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/offer-page")({
  component: OfferPageEditor,
});

type OfferSettings = {
  id: string;
  video_url: string;
  eyebrow: string;
  headline_template: string;
  intro_text: string;
  video_title: string;
  video_body: string;
  show_intro_text: boolean;
  show_video_body: boolean;
  show_video_cta: boolean;
  video_cta_text: string;
  beat_title: string;
  benefits_title: string;
  benefits: string[];
  section_order: string[];
};

type HeroImageFilter = {
  grayscale?: number;
  sepia?: number;
  brightness?: number;
  contrast?: number;
  saturate?: number;
  blur?: number;
  hueRotate?: number;
};

type HomepageSettings = {
  id: string;
  hero_media_type: "image" | "video";
  hero_media_url: string;
  hero_image_filter: HeroImageFilter;
};

const DEFAULT_SETTINGS: OfferSettings = {
  id: "main",
  video_url: "",
  eyebrow: "Your beat is reserved",
  headline_template: "{beat} is Reserved For You",
  intro_text: "This is a private offer. Watch the video below to see everything you get with your membership before the timer expires.",
  video_title: "Watch the private offer video",
  video_body: "A quick breakdown of how MYBEATCATALOG helps artists create, release, and stay consistent.",
  show_intro_text: true,
  show_video_body: true,
  show_video_cta: true,
  video_cta_text: "See Special Offer",
  beat_title: "Preview the beat",
  benefits_title: "Membership includes",
  benefits: ["Full Beat Catalog", "New Beats Weekly", "Direct Artist Access", "Cancel Anytime"],
  section_order: ["video", "beat", "benefits"],
};

const DEFAULT_HOMEPAGE_SETTINGS: HomepageSettings = {
  id: "main",
  hero_media_type: "image",
  hero_media_url: "",
  hero_image_filter: {},
};

const SECTION_LABELS: Record<string, string> = {
  video: "Private video",
  beat: "Beat preview",
  benefits: "Benefit blocks",
};

function normalize(row: Partial<OfferSettings> | null | undefined): OfferSettings {
  if (!row) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...row,
    video_url: row.video_url ?? "",
    benefits: Array.isArray(row.benefits) ? row.benefits : DEFAULT_SETTINGS.benefits,
    section_order: Array.isArray(row.section_order) && row.section_order.length ? row.section_order : DEFAULT_SETTINGS.section_order,
  };
}

function normalizeHomepage(row: Partial<HomepageSettings> | null | undefined): HomepageSettings {
  if (!row) return DEFAULT_HOMEPAGE_SETTINGS;
  const filterRaw = (row as any).hero_image_filter;
  const filter: HeroImageFilter = filterRaw && typeof filterRaw === "object" ? filterRaw : {};
  return {
    ...DEFAULT_HOMEPAGE_SETTINGS,
    ...row,
    id: "main",
    hero_media_type: row.hero_media_type === "video" ? "video" : "image",
    hero_media_url: row.hero_media_url ?? "",
    hero_image_filter: filter,
  };
}

function filterToCss(f: HeroImageFilter): string | undefined {
  const parts: string[] = [];
  if (f.grayscale) parts.push(`grayscale(${f.grayscale}%)`);
  if (f.sepia) parts.push(`sepia(${f.sepia}%)`);
  if (typeof f.brightness === "number" && f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
  if (typeof f.contrast === "number" && f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
  if (typeof f.saturate === "number" && f.saturate !== 100) parts.push(`saturate(${f.saturate}%)`);
  if (f.blur) parts.push(`blur(${f.blur}px)`);
  if (f.hueRotate) parts.push(`hue-rotate(${f.hueRotate}deg)`);
  return parts.length ? parts.join(" ") : undefined;
}


export function OfferPageEditor() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<OfferSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);

  const settingsQ = useQuery({
    queryKey: ["admin-offer-page-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("offer_page_settings")
        .select("*")
        .eq("id", "main")
        .maybeSingle();
      if (error) throw error;
      return normalize(data as Partial<OfferSettings> | null);
    },
  });

  useEffect(() => {
    if (settingsQ.data) setSettings(settingsQ.data);
  }, [settingsQ.data]);

  function setField<K extends keyof OfferSettings>(key: K, value: OfferSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function moveSection(target: string) {
    if (!dragged || dragged === target) return;
    setSettings((current) => {
      const without = current.section_order.filter((id) => id !== dragged);
      const targetIndex = without.indexOf(target);
      const next = [...without];
      next.splice(targetIndex, 0, dragged);
      return { ...current, section_order: next };
    });
    setDragged(null);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        id: "main",
        video_url: settings.video_url || null,
        eyebrow: settings.eyebrow,
        headline_template: settings.headline_template,
        intro_text: settings.intro_text,
        video_title: settings.video_title,
        video_body: settings.video_body,
        show_intro_text: settings.show_intro_text,
        show_video_body: settings.show_video_body,
        show_video_cta: settings.show_video_cta,
        video_cta_text: settings.video_cta_text,
        beat_title: settings.beat_title,
        benefits_title: settings.benefits_title,
        benefits: settings.benefits.filter(Boolean),
        section_order: settings.section_order,
        updated_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any).from("offer_page_settings").upsert(payload, { onConflict: "id" });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["admin-offer-page-settings"] });
      toast.success("Offer page saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save offer page.");
    } finally {
      setSaving(false);
    }
  }

  if (settingsQ.isLoading) {
    return <div className="flex items-center gap-2 text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading offer editor...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Offer Page</h1>
          <p className="mt-1 text-slate-600">Edit the private offer page copy, YouTube embed, and drag the sections into order.</p>
        </div>
        <Button type="button" variant="hero" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Offer Page
        </Button>
      </div>

      {settingsQ.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          If this editor cannot save yet, run the new Supabase migration for offer_page_settings first.
        </div>
      ) : null}

      <HomepageHeroEditor />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Field label="YouTube or video URL">
            <Input value={settings.video_url} onChange={(e) => setField("video_url", e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
          </Field>
          <Field label="Eyebrow">
            <Input value={settings.eyebrow} onChange={(e) => setField("eyebrow", e.target.value)} />
          </Field>
          <Field label="Headline">
            <Input value={settings.headline_template} onChange={(e) => setField("headline_template", e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">Use {"{beat}"} where the selected beat title should appear.</p>
          </Field>
          <ToggleField
            label="Show intro text"
            checked={settings.show_intro_text}
            onChange={(checked) => setField("show_intro_text", checked)}
          />
          <Field label="Intro text">
            <textarea className="min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={settings.intro_text} onChange={(e) => setField("intro_text", e.target.value)} />
          </Field>
          <Field label="Video title">
            <Input value={settings.video_title} onChange={(e) => setField("video_title", e.target.value)} />
          </Field>
          <ToggleField
            label="Show video supporting text"
            checked={settings.show_video_body}
            onChange={(checked) => setField("show_video_body", checked)}
          />
          <Field label="Video supporting text">
            <textarea className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={settings.video_body} onChange={(e) => setField("video_body", e.target.value)} />
          </Field>
          <ToggleField
            label="Show button below video"
            checked={settings.show_video_cta}
            onChange={(checked) => setField("show_video_cta", checked)}
          />
          <Field label="Video button text">
            <Input value={settings.video_cta_text} onChange={(e) => setField("video_cta_text", e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">This button scrolls visitors to the special offer checkout section.</p>
          </Field>
          <Field label="Beat section title">
            <Input value={settings.beat_title} onChange={(e) => setField("beat_title", e.target.value)} />
          </Field>
          <Field label="Benefit block subtitle">
            <Input value={settings.benefits_title} onChange={(e) => setField("benefits_title", e.target.value)} />
          </Field>
          <Field label="Benefits">
            <textarea
              className="min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950"
              value={settings.benefits.join("\n")}
              onChange={(e) => setField("benefits", e.target.value.split("\n").map((line) => line.trim()).filter(Boolean))}
            />
            <p className="mt-1 text-xs text-slate-500">One benefit per line.</p>
          </Field>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Section Order</h2>
          <p className="mt-1 text-sm text-slate-600">Drag these into the order you want on the offer page.</p>
          <div className="mt-4 space-y-2">
            {settings.section_order.map((sectionId) => (
              <div
                key={sectionId}
                draggable
                onDragStart={() => setDragged(sectionId)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => moveSection(sectionId)}
                className="flex cursor-grab items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4 text-slate-400" />
                {SECTION_LABELS[sectionId] ?? sectionId}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function HomepageHeroEditor() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<HomepageSettings>(DEFAULT_HOMEPAGE_SETTINGS);
  const [saving, setSaving] = useState(false);

  const settingsQ = useQuery({
    queryKey: ["admin-homepage-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("homepage_settings")
        .select("*")
        .eq("id", "main")
        .maybeSingle();
      if (error) return DEFAULT_HOMEPAGE_SETTINGS;
      return normalizeHomepage(data as Partial<HomepageSettings> | null);
    },
  });

  useEffect(() => {
    if (settingsQ.data) setSettings(settingsQ.data);
  }, [settingsQ.data]);

  async function uploadImage(file: File) {
    setSaving(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9.]+/g, "_");
      const path = `hero_${Date.now()}_${safe}`;
      const up = await supabase.storage.from("homepage-media").upload(path, file, {
        upsert: false,
        contentType: file.type || "image/jpeg",
      });
      if (up.error) throw up.error;
      const url = supabase.storage.from("homepage-media").getPublicUrl(path).data.publicUrl;
      setSettings((cur) => ({ ...cur, hero_media_type: "image", hero_media_url: url }));
      toast.success("Image uploaded. Click Save to apply.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        id: "main",
        hero_media_type: settings.hero_media_type,
        hero_media_url: settings.hero_media_url.trim() || null,
        hero_image_filter: settings.hero_image_filter,
        updated_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any).from("homepage_settings").upsert(payload, { onConflict: "id" });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["admin-homepage-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["homepage-settings"] });
      toast.success("Homepage media saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save homepage media.");
    } finally {
      setSaving(false);
    }
  }

  function setFilter(patch: Partial<HeroImageFilter>) {
    setSettings((cur) => ({ ...cur, hero_image_filter: { ...cur.hero_image_filter, ...patch } }));
  }

  const previewUrl = settings.hero_media_url.trim();
  const filterCss = filterToCss(settings.hero_image_filter);
  const f = settings.hero_image_filter;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-black">Homepage Main Media</h2>
          <p className="mt-1 text-sm text-slate-600">Upload or link an image / video for the front-page box. Add filter effects to make the image pop.</p>
        </div>
        <Button type="button" variant="hero" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Homepage Media
        </Button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[260px_1fr]">
        <div className="space-y-3">
          <div className="aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            {previewUrl && settings.hero_media_type === "image" ? (
              <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" style={filterCss ? { filter: filterCss } : undefined} />
            ) : previewUrl && settings.hero_media_type === "video" ? (
              <video src={previewUrl} className="h-full w-full object-cover" muted loop playsInline autoPlay />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">Preview</div>
            )}
          </div>
          <Field label="Upload image">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImage(file); }}
            />
          </Field>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <Field label="Media type">
              <select
                value={settings.hero_media_type}
                onChange={(e) => setSettings((current) => ({ ...current, hero_media_type: e.target.value === "video" ? "video" : "image" }))}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950"
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </Field>
            <Field label="Image or video URL">
              <Input
                value={settings.hero_media_url}
                onChange={(e) => setSettings((current) => ({ ...current, hero_media_url: e.target.value }))}
                placeholder={settings.hero_media_type === "video" ? "https://.../studio-video.mp4" : "https://.../studio-image.jpg"}
              />
            </Field>
          </div>

          {settings.hero_media_type === "image" ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Image filter effects</h3>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSettings((c) => ({ ...c, hero_image_filter: {} }))}>
                  Reset
                </Button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <FilterSlider label="Grayscale" value={f.grayscale ?? 0} min={0} max={100} unit="%" onChange={(v) => setFilter({ grayscale: v })} />
                <FilterSlider label="Sepia" value={f.sepia ?? 0} min={0} max={100} unit="%" onChange={(v) => setFilter({ sepia: v })} />
                <FilterSlider label="Brightness" value={f.brightness ?? 100} min={50} max={200} unit="%" onChange={(v) => setFilter({ brightness: v })} />
                <FilterSlider label="Contrast" value={f.contrast ?? 100} min={50} max={200} unit="%" onChange={(v) => setFilter({ contrast: v })} />
                <FilterSlider label="Saturation" value={f.saturate ?? 100} min={0} max={200} unit="%" onChange={(v) => setFilter({ saturate: v })} />
                <FilterSlider label="Blur" value={f.blur ?? 0} min={0} max={20} unit="px" onChange={(v) => setFilter({ blur: v })} />
                <FilterSlider label="Hue rotate" value={f.hueRotate ?? 0} min={0} max={360} unit="°" onChange={(v) => setFilter({ hueRotate: v })} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function FilterSlider({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
        <span>{label}</span>
        <span className="text-slate-500">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-blue-600"
      />
    </label>
  );
}

}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-800">{label}</span>
      {children}
    </label>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-primary"
      />
    </label>
  );
}
