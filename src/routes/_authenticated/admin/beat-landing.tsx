import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListBeats,
  adminUpdateBeatLanding,
  adminBulkUpdateLandingPrices,
  adminBulkEnableLandingSlugs,
  adminGetGlobalVideo,
  adminUpdateGlobalVideo,
  adminListLeadCaptures,
  adminListLeaseOrders,
  adminListInquiryQuestions,
  adminUpsertInquiryQuestion,
  adminDeleteInquiryQuestion,
  adminListInquirySubmissions,
  adminListAttachments,
  adminCreateAttachment,
  adminDeleteAttachment,
  adminSendTestEmail,
  adminListEmailStatus,
} from "@/lib/beat-landing.functions";

export const Route = createFileRoute("/_authenticated/admin/beat-landing")({
  component: BeatLandingAdmin,
});

type BeatRow = {
  id: string;
  title: string;
  landing_slug: string | null;
  is_landing_published: boolean;
  is_active: boolean;
  landing_visibility: "public" | "unlisted" | "private";
  price_cents: number;
  discount_price_cents: number;
  cover_url: string | null;
  producer_name: string | null;
  checkout_url: string | null;
  application_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  custom_video_url: string | null;
  custom_video_recorded_at: string | null;
  audio_url_tagged: string | null;
  audio_url: string | null;
  nonexclusive_price_cents: number | null;
  trackout_price_cents: number | null;
  exclusive_price_cents: number | null;
};

function BeatLandingAdmin() {
  const listFn = useServerFn(adminListBeats);
  const beatsQuery = useQuery({ queryKey: ["admin-landing-beats"], queryFn: () => listFn() });
  const [tab, setTab] = useState("beats");
  const tabs = [
    { id: "beats", label: "Beats" },
    { id: "media", label: "Media & contact" },
    { id: "pricing", label: "Pricing" },
    { id: "questions", label: "Questions" },
    { id: "inquiries", label: "Inquiries" },
    { id: "leads", label: "Leads" },
    { id: "orders", label: "Orders" },
    { id: "email", label: "Email & delivery" },
  ];
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Catalog workspace</p>
          <h1 className="text-base font-bold sm:text-2xl">Landing Pages</h1>
        </div>
        <span className="text-xs text-muted-foreground">{beatsQuery.data?.beats?.length ?? "—"} beats</span>
      </header>
      <nav
        aria-label="Landing page sections"
        className="grid shrink-0 grid-cols-4 gap-1 rounded-xl border border-border bg-card p-1 xl:grid-cols-8"
        role="tablist"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            id={"landing-tab-" + t.id}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={"landing-panel-" + t.id}
            onClick={() => setTab(t.id)}
            className={
              "min-h-11 rounded-lg px-1 text-[11px] font-semibold transition-colors sm:text-xs " +
              (tab === t.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary")
            }
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tabs.map((t) => (
          <section
            key={t.id}
            id={"landing-panel-" + t.id}
            role="tabpanel"
            aria-labelledby={"landing-tab-" + t.id}
            tabIndex={0}
            style={{ display: tab === t.id ? "block" : "none" }}
            className={"h-full min-h-0 overscroll-contain " + (t.id === "beats" ? "overflow-hidden" : "overflow-auto")}
          >
            {t.id === "beats" &&
              (beatsQuery.isError ? (
                <div className="rounded-xl border border-border p-4">
                  <p>Could not load beats.</p>
                  <button className="mt-3 min-h-11 text-primary" onClick={() => void beatsQuery.refetch()}>
                    Retry
                  </button>
                </div>
              ) : (
                <AllBeatsTable
                  beats={(beatsQuery.data?.beats ?? []) as unknown as BeatRow[]}
                  loading={beatsQuery.isLoading}
                />
              ))}
            {t.id === "media" && <GlobalVideoCard />}
            {t.id === "pricing" && <BulkPricingCard />}
            {t.id === "questions" && <InquiryQuestionsCard />}
            {t.id === "inquiries" && <InquirySubmissionsCard />}
            {t.id === "leads" && <LeadsCard />}
            {t.id === "orders" && <OrdersCard />}
            {t.id === "email" && (
              <>
                <details className="mb-3 rounded-xl border border-border p-3">
                  <summary className="cursor-pointer text-sm font-semibold">How delivery works</summary>
                  <DeliveryInfoCard />
                </details>
                <EmailTesterCard />
              </>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function GlobalVideoCard() {
  const getFn = useServerFn(adminGetGlobalVideo);
  const updateFn = useServerFn(adminUpdateGlobalVideo);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-global-video"], queryFn: () => getFn() });
  const g = q.data?.global as
    | {
        video_url: string | null;
        contact_instagram: string | null;
        contact_email: string | null;
        contact_phone: string | null;
      }
    | null
    | undefined;

  const [videoUrl, setVideoUrl] = useState("");
  const [ig, setIg] = useState("");
  const [em, setEm] = useState("");
  const [ph, setPh] = useState("");
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (g) {
      setVideoUrl(g.video_url || "");
      setIg(g.contact_instagram || "");
      setEm(g.contact_email || "");
      setPh(g.contact_phone || "");
    }
  }, [g]);

  const uploadFile = async (file: File | Blob) => {
    setUploading(true);
    try {
      const path = `global/video-${Date.now()}.webm`;
      const { error } = await supabase.storage.from("homepage-media").upload(path, file, {
        contentType: file.type || "video/webm",
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("homepage-media").getPublicUrl(path);
      setVideoUrl(data.publicUrl);
      toast.success("Video uploaded. Click Save to publish it.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
        previewVideoRef.current.play();
      }
      const mr = new MediaRecorder(stream, { mimeType: "video/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setRecordedBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = null;
          previewVideoRef.current.src = URL.createObjectURL(blob);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (err) {
      toast.error("Could not access camera/mic");
    }
  };
  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const save = async () => {
    const r = await updateFn({
      data: {
        video_url: videoUrl || null,
        contact_instagram: ig || null,
        contact_email: em || null,
        contact_phone: ph || null,
      },
    });
    if (r.ok) {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-global-video"] });
    } else {
      toast.error(r.error || "Failed");
    }
  };

  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-sm space-y-4">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-card pb-2">
        <div>
          <h2 className="text-base font-bold">Global Video & Contact Info</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Shows on every beat landing page unless a beat has its own custom video.
          </p>
        </div>
        <button
          onClick={save}
          className="min-h-11 shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Save
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold mb-1">Video URL</label>
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
          <div className="mt-2 flex gap-2 flex-wrap">
            <label className="cursor-pointer rounded-lg border border-border bg-card px-3 py-2 text-sm hover:border-gray-300">
              {uploading ? "Uploading..." : "Upload File"}
              <input
                type="file"
                accept="video/*"
                hidden
                onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
              />
            </label>
            {!recording ? (
              <button
                onClick={startRecording}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 hover:bg-red-100"
              >
                ● Record
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="rounded-lg border border-red-500 bg-red-500 px-3 py-2 text-sm text-white"
              >
                Stop
              </button>
            )}
            {recordedBlob && !recording && (
              <button
                onClick={() => uploadFile(recordedBlob)}
                className="rounded-lg bg-purple-600 text-white px-3 py-2 text-sm"
              >
                Upload Recording
              </button>
            )}
          </div>
          <video
            ref={previewVideoRef}
            controls
            className="mt-3 w-full max-h-48 aspect-video rounded-lg bg-gray-900"
            src={!recording && !recordedBlob ? videoUrl : undefined}
          />
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold mb-1">Instagram (handle or URL)</label>
            <input
              value={ig}
              onChange={(e) => setIg(e.target.value)}
              placeholder="@krazyjaydotcom"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <input
              value={em}
              onChange={(e) => setEm(e.target.value)}
              placeholder="hello@..."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Phone</label>
            <input
              value={ph}
              onChange={(e) => setPh(e.target.value)}
              placeholder="+1..."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function AllBeatsTable({ beats, loading }: { beats: BeatRow[]; loading: boolean }) {
  const [editing, setEditing] = useState<BeatRow | null>(null);
  const [search, setSearch] = useState("");
  const visibleBeats = beats.filter((b) =>
    (b.title + " " + (b.landing_slug || "")).toLowerCase().includes(search.trim().toLowerCase()),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const bulkFn = useServerFn(adminBulkEnableLandingSlugs);
  const qc = useQueryClient();

  const allVisibleIds = visibleBeats.map((b) => b.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) allVisibleIds.forEach((id) => next.delete(id));
      else allVisibleIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const clear = () => setSelected(new Set());

  const runBulk = async (visibility: "public" | "unlisted" | "private") => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const res = await bulkFn({ data: { ids: Array.from(selected), visibility } });
      if (res.ok) {
        toast.success(
          `Set ${res.updated} landing page${res.updated === 1 ? "" : "s"} to ${visibility}${res.slugsAssigned ? ` · ${res.slugsAssigned} new link${res.slugsAssigned === 1 ? "" : "s"} generated` : ""}`,
        );
        clear();
        qc.invalidateQueries({ queryKey: ["admin-landing-beats"] });
      } else {
        toast.error(res.error || "Bulk update failed");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl bg-card border border-border p-3 sm:p-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-base font-bold">Landing Page Beats</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Public pages can be discovered, Unlisted pages open only by direct link, and Private pages stay closed.
            Missing links are generated automatically.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {visibleBeats.length} of {beats.length} beats · {selected.size} selected
        </div>
      </div>

      <input
        aria-label="Search landing pages"
        placeholder="Search beats or links…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3 h-11 w-full shrink-0 rounded-lg border border-border bg-background px-3 text-sm"
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : visibleBeats.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matching beats. Clear your search or add beats in Catalog.</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                <th className="py-2 pr-2 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    aria-label="Select all visible"
                    onChange={toggleAllVisible}
                    className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                  />
                </th>
                <th className="py-2">Title</th>
                <th className="py-2 hidden sm:table-cell">Slug</th>
                <th className="py-2 hidden md:table-cell">Price</th>
                <th className="py-2 hidden md:table-cell">Discount</th>
                <th className="py-2">Visibility</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {visibleBeats.map((b) => (
                <tr
                  key={b.id}
                  className={`border-b border-border/40 align-top ${selected.has(b.id) ? "bg-blue-50/50" : ""}`}
                >
                  <td className="py-3 pr-2">
                    <input
                      type="checkbox"
                      checked={selected.has(b.id)}
                      onChange={() => toggleOne(b.id)}
                      aria-label={`Select ${b.title}`}
                      className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                    />
                  </td>
                  <td className="max-w-[180px] py-2 font-medium">
                    <div className="break-words">{b.title}</div>
                    {b.landing_slug && b.landing_visibility !== "private" && (
                      <div className="mt-1 hidden space-y-1 lg:block">
                        <ShareLinkRow url={`https://mybeatcatalog.com/beats/${b.landing_slug}`} label="Canonical" />
                      </div>
                    )}
                  </td>
                  <td className="py-3 font-mono text-xs hidden sm:table-cell">{b.landing_slug || "—"}</td>
                  <td className="py-3 hidden md:table-cell">${(b.price_cents / 100).toFixed(2)}</td>
                  <td className="py-3 hidden md:table-cell">${(b.discount_price_cents / 100).toFixed(2)}</td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${b.landing_visibility === "public" ? "bg-green-100 text-green-700" : b.landing_visibility === "unlisted" ? "bg-blue-100 text-blue-700" : "bg-secondary text-muted-foreground"}`}
                    >
                      {b.landing_visibility === "public"
                        ? "Public"
                        : b.landing_visibility === "unlisted"
                          ? "Unlisted"
                          : "Private"}
                    </span>
                    {!b.is_active && (
                      <div className="mt-1 text-[10px] font-semibold text-amber-600">Catalog inactive</div>
                    )}
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    <button onClick={() => setEditing(b)} className="text-blue-600 hover:underline text-xs">
                      Edit
                    </button>
                    {b.landing_slug && b.landing_visibility !== "private" && b.is_active && (
                      <>
                        <a
                          href={`/beats/${b.landing_slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 text-muted-foreground hover:underline text-xs"
                        >
                          View →
                        </a>
                        <CopyLinkButton url={`https://mybeatcatalog.com/beats/${b.landing_slug}`} />
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <EditBeatModal beat={editing} onClose={() => setEditing(null)} />}

      {/* Sticky bulk action bar */}
      {someSelected && (
        <div className="shrink-0 pt-3">
          <div className="rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700 p-3 flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-0 text-sm">
              <strong>{selected.size}</strong> selected
            </div>
            <button
              onClick={() => runBulk("public")}
              disabled={busy}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-xs font-semibold disabled:opacity-60"
            >
              {busy ? "Working…" : "Make Public"}
            </button>
            <button
              onClick={() => runBulk("unlisted")}
              disabled={busy}
              className="rounded-lg bg-blue-500 hover:bg-blue-400 px-3 py-2 text-xs font-semibold disabled:opacity-60"
            >
              Make Unlisted
            </button>
            <button
              onClick={() => runBulk("private")}
              disabled={busy}
              className="rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold disabled:opacity-60"
            >
              Make Private
            </button>
            <button
              onClick={clear}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatBeatPromoCopy(url: string) {
  return [
    `💰 Download/Purchase | Untagged: ${url}`,
    "🌐 Website: https://www.mybeatcatalog.com",
    "📧 EMAIL: Jason@Krazyjay.com",
    "📲 Cell: (470) 315-0280",
    "Instagram: https://www.instagram.com/krazyjaydotcomga",
  ].join("\n");
}
function ShareLinkRow({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatBeatPromoCopy(url));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-16 shrink-0">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-purple-600 hover:underline truncate max-w-xs"
      >
        {url}
      </a>
      <button onClick={copy} className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-secondary/40">
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

function EditBeatModal({ beat, onClose }: { beat: BeatRow; onClose: () => void }) {
  const update = useServerFn(adminUpdateBeatLanding);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    landing_slug: beat.landing_slug || "",
    price_cents: beat.price_cents,
    discount_price_cents: beat.discount_price_cents,
    checkout_url: beat.checkout_url || "",
    application_url: beat.application_url || "",
    seo_title: beat.seo_title || "",
    seo_description: beat.seo_description || "",
    custom_video_url: beat.custom_video_url || "",
    custom_video_recorded_at: beat.custom_video_recorded_at ? beat.custom_video_recorded_at.slice(0, 16) : "",
    landing_visibility: beat.landing_visibility,
    producer_name: beat.producer_name || "",
    nonexclusive_price_cents:
      beat.nonexclusive_price_cents == null ? "" : String(beat.nonexclusive_price_cents),
    trackout_price_cents:
      beat.trackout_price_cents == null ? "" : String(beat.trackout_price_cents),
    exclusive_price_cents:
      beat.exclusive_price_cents == null ? "" : String(beat.exclusive_price_cents),
  });

  const save = async () => {
    const r = await update({
      data: {
        id: beat.id,
        landing_slug: form.landing_slug || undefined,
        price_cents: Number(form.price_cents),
        discount_price_cents: Number(form.discount_price_cents),
        checkout_url: form.checkout_url || null,
        application_url: form.application_url || null,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
        custom_video_url: form.custom_video_url || null,
        custom_video_recorded_at: form.custom_video_recorded_at
          ? new Date(form.custom_video_recorded_at).toISOString()
          : null,
        landing_visibility: form.landing_visibility,
        producer_name: form.producer_name || null,
        nonexclusive_price_cents:
          form.nonexclusive_price_cents.trim() === ""
            ? null
            : Number(form.nonexclusive_price_cents),
        trackout_price_cents:
          form.trackout_price_cents.trim() === "" ? null : Number(form.trackout_price_cents),
        exclusive_price_cents:
          form.exclusive_price_cents.trim() === "" ? null : Number(form.exclusive_price_cents),
      },
    });
    if (r.ok) {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-landing-beats"] });
      onClose();
    } else {
      toast.error(r.error || "Failed");
    }
  };

  const inp = "w-full rounded-lg border border-border px-3 py-2 text-sm";
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card p-4 shadow-xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-black mb-4">Edit: {beat.title}</h3>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold">URL slug</label>
            <input
              className={inp}
              value={form.landing_slug}
              onChange={(e) => setForm({ ...form, landing_slug: e.target.value })}
              placeholder="midnight-drive"
            />
          </div>
          <div>
            <label className="text-xs font-semibold">Producer name</label>
            <input
              className={inp}
              value={form.producer_name}
              onChange={(e) => setForm({ ...form, producer_name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold">Price (cents)</label>
            <input
              type="number"
              className={inp}
              value={form.price_cents}
              onChange={(e) => setForm({ ...form, price_cents: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold">First-time discount (cents)</label>
            <input
              type="number"
              className={inp}
              value={form.discount_price_cents}
              onChange={(e) => setForm({ ...form, discount_price_cents: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold">
              Non-exclusive price (cents){" "}
              <span className="font-normal text-muted-foreground">(blank = not offered)</span>
            </label>
            <input
              type="number"
              className={inp}
              value={form.nonexclusive_price_cents}
              onChange={(e) => setForm({ ...form, nonexclusive_price_cents: e.target.value })}
              placeholder="2499"
            />
          </div>
          <div>
            <label className="text-xs font-semibold">
              Unlimited w/ STEMs price (cents){" "}
              <span className="font-normal text-muted-foreground">(blank = $150 default)</span>
            </label>
            <input
              type="number"
              className={inp}
              value={form.trackout_price_cents}
              onChange={(e) => setForm({ ...form, trackout_price_cents: e.target.value })}
              placeholder="15000"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold">
              Legacy external checkout URL{" "}
              <span className="text-muted-foreground font-normal">
                (optional fallback — leave blank to use built-in Stripe checkout)
              </span>
            </label>
            <input
              className={inp}
              value={form.checkout_url}
              onChange={(e) => setForm({ ...form, checkout_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold">Application URL (legacy — inquiry popup now handles this)</label>
            <input
              className={inp}
              value={form.application_url}
              onChange={(e) => setForm({ ...form, application_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold">Custom video URL (optional; overrides global)</label>
            <input
              className={inp}
              value={form.custom_video_url}
              onChange={(e) => setForm({ ...form, custom_video_url: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold">Video posted at (shown as "Posted X ago" under the video)</label>
            <input
              type="datetime-local"
              className={inp}
              value={form.custom_video_recorded_at}
              onChange={(e) => setForm({ ...form, custom_video_recorded_at: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold">SEO title</label>
            <input
              className={inp}
              value={form.seo_title}
              onChange={(e) => setForm({ ...form, seo_title: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold">SEO description</label>
            <textarea
              rows={3}
              className={inp}
              value={form.seo_description}
              onChange={(e) => setForm({ ...form, seo_description: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold" htmlFor="visibility">
              Landing page visibility
            </label>
            <select
              id="visibility"
              value={form.landing_visibility}
              onChange={(e) =>
                setForm({ ...form, landing_visibility: e.target.value as BeatRow["landing_visibility"] })
              }
              className={inp}
            >
              <option value="public">Public — link opens and may appear in public lookups</option>
              <option value="unlisted">Unlisted — link opens only when shared directly</option>
              <option value="private">Private — link shows Beat not found</option>
            </select>
            {!beat.is_active && form.landing_visibility !== "private" && (
              <p className="mt-2 text-xs font-medium text-amber-600">
                This beat is inactive in the catalog, so its landing link remains unavailable until catalog access is
                reactivated.
              </p>
            )}
          </div>
          <div className="sm:col-span-2 border-t border-border/60 pt-4 mt-2">
            <AttachmentsManager beatId={beat.id} />
          </div>
        </div>
        <div className="mt-3 flex shrink-0 gap-2 justify-end border-t border-border pt-3">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border">
            Cancel
          </button>
          <button
            onClick={save}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function LeadsCard() {
  const fn = useServerFn(adminListLeadCaptures);
  const q = useQuery({ queryKey: ["admin-lead-captures"], queryFn: () => fn() });
  const leads = (q.data?.leads ?? []) as Array<{
    id: string;
    first_name: string;
    email: string;
    created_at: string;
    beat_id: string | null;
  }>;
  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
      <h2 className="text-base font-bold mb-3">Tagged Download Leads ({leads.length})</h2>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground text-left border-b border-border/60">
              <th className="py-1.5">Name</th>
              <th>Email</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-border/40">
                <td className="py-1.5">{l.first_name}</td>
                <td>{l.email}</td>
                <td className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrdersCard() {
  const fn = useServerFn(adminListLeaseOrders);
  const q = useQuery({ queryKey: ["admin-lease-orders"], queryFn: () => fn() });
  const orders = (q.data?.orders ?? []) as Array<{
    id: string;
    email: string;
    amount_cents: number;
    license_tier: string | null;
    used_first_time_discount: boolean;
    created_at: string;
  }>;
  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
      <h2 className="text-base font-bold mb-3">Lease Orders ({orders.length})</h2>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground text-left border-b border-border/60">
              <th className="py-1.5">Email</th>
              <th>Tier</th>
              <th>Amount</th>
              <th>Discount</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-border/40">
                <td className="py-1.5">{o.email}</td>
                <td className="text-xs capitalize">{o.license_tier ?? "—"}</td>
                <td>${(o.amount_cents / 100).toFixed(2)}</td>
                <td>{o.used_first_time_discount ? <span className="text-orange-600 text-xs">First-time</span> : ""}</td>
                <td className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeliveryInfoCard() {
  return (
    <div className="rounded-2xl bg-blue-50 border border-blue-200 p-5 text-sm text-blue-900">
      <p className="font-semibold mb-1">How beat landing delivery works</p>
      <p className="text-blue-800/90 leading-relaxed">
        Paid purchases are delivered after Stripe confirms payment. The buyer automatically receives an email with the
        beat MP3 download link and the Unlimited License Agreement. You (admin) receive a sale notification email. Free
        MP3 downloads capture the lead and email them the MP3 link.
      </p>
    </div>
  );
}

function BulkPricingCard() {
  const bulk = useServerFn(adminBulkUpdateLandingPrices);
  const qc = useQueryClient();
  const [price, setPrice] = useState("49.99");
  const [discount, setDiscount] = useState("");
  const [target, setTarget] = useState<"published" | "all">("published");
  const [saving, setSaving] = useState(false);

  const apply = async () => {
    const priceCents = Math.round(parseFloat(price) * 100);
    if (!isFinite(priceCents) || priceCents < 50) {
      toast.error("Enter a valid price (at least $0.50)");
      return;
    }
    let discountCents: number | null = null;
    if (discount.trim() !== "") {
      const d = Math.round(parseFloat(discount) * 100);
      if (!isFinite(d) || d < 0) {
        toast.error("Invalid discount price");
        return;
      }
      discountCents = d;
    }
    const label = target === "published" ? "published landing pages" : "all beats";
    if (
      !confirm(
        `Apply price $${(priceCents / 100).toFixed(2)}${discountCents !== null ? ` and discount $${(discountCents / 100).toFixed(2)}` : ""} to ${label}?`,
      )
    )
      return;
    setSaving(true);
    try {
      const r = await bulk({
        data: {
          price_cents: priceCents,
          discount_price_cents: discountCents,
          target,
        },
      });
      if (r.ok) {
        toast.success(`Updated ${r.updated} beat${r.updated === 1 ? "" : "s"}`);
        qc.invalidateQueries({ queryKey: ["admin-landing-beats"] });
      } else {
        toast.error(r.error || "Update failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-bold">Bulk pricing</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Set lease and optional first-time discount pricing once and apply to landing pages in bulk. Only updates{" "}
          <code className="text-xs">price_cents</code> and <code className="text-xs">discount_price_cents</code>.
          Membership pricing is not affected.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div>
          <label className="block text-xs font-semibold mb-1">Lease price (USD)</label>
          <input
            type="number"
            step="0.01"
            min="0.5"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Discount price (optional)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="Leave blank to skip"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Apply to</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as "published" | "all")}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="published">Published landing pages only</option>
            <option value="all">All beats</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={apply}
            disabled={saving}
            className="w-full rounded-lg bg-black text-white px-4 py-2.5 font-semibold hover:bg-gray-800 disabled:opacity-60"
          >
            {saving ? "Applying..." : "Apply to beats"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Copy link button ----------
function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(formatBeatPromoCopy(url));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Copy failed");
        }
      }}
      className="ml-3 text-blue-600 hover:underline text-xs"
      title={url}
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}

// ---------- Email tester ----------
function EmailTesterCard() {
  const send = useServerFn(adminSendTestEmail);
  const listStatus = useServerFn(adminListEmailStatus);
  const qc = useQueryClient();
  const statusQuery = useQuery({ queryKey: ["admin-email-status"], queryFn: () => listStatus() });
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (kind: "free_download" | "purchase_buyer" | "admin_sale" | "exclusive_inquiry") => {
    if (!to || !to.includes("@")) {
      toast.error("Enter a recipient email first");
      return;
    }
    setBusy(kind);
    try {
      const r = await send({ data: { to, kind } });
      if (r.ok) {
        toast.success(`Test email queued (${kind})`);
        await qc.invalidateQueries({ queryKey: ["admin-email-status"] });
      } else toast.error(r.error || "Failed");
    } finally {
      setBusy(null);
    }
  };

  const btn =
    "rounded-lg border border-blue-200 bg-blue-50 text-blue-700 px-3 py-2 text-xs font-semibold hover:bg-blue-100 disabled:opacity-60";
  const emails = statusQuery.data?.emails ?? [];
  const stats = statusQuery.data?.stats ?? { total: 0, sent: 0, failed: 0, pending: 0, suppressed: 0 };
  const statusClass = (status: string) => {
    if (status === "sent") return "bg-green-50 text-green-700 border-green-200";
    if (status === "pending") return "bg-yellow-50 text-yellow-700 border-yellow-200";
    if (status === "suppressed") return "bg-secondary/40 text-foreground border-border";
    return "bg-red-50 text-red-700 border-red-200";
  };
  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-base font-bold">Test emails</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Send a real copy of each beat-landing email to any address to verify delivery and template.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="recipient@example.com"
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy !== null} onClick={() => run("free_download")} className={btn}>
          {busy === "free_download" ? "Sending…" : "Free MP3 download"}
        </button>
        <button disabled={busy !== null} onClick={() => run("purchase_buyer")} className={btn}>
          {busy === "purchase_buyer" ? "Sending…" : "Purchase (buyer)"}
        </button>
        <button disabled={busy !== null} onClick={() => run("admin_sale")} className={btn}>
          {busy === "admin_sale" ? "Sending…" : "Admin sale notification"}
        </button>
        <button disabled={busy !== null} onClick={() => run("exclusive_inquiry")} className={btn}>
          {busy === "exclusive_inquiry" ? "Sending…" : "Exclusive inquiry"}
        </button>
      </div>
      <div className="mt-6 border-t border-border/60 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold">Email delivery status</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Latest unique attempts for free downloads, purchases, inquiries, and invites.
            </p>
          </div>
          <button
            onClick={() => statusQuery.refetch()}
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary/40"
          >
            Refresh status
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <StatPill label="Total" value={stats.total} />
          <StatPill label="Sent" value={stats.sent} tone="green" />
          <StatPill label="Pending" value={stats.pending} tone="yellow" />
          <StatPill label="Failed" value={stats.failed} tone="red" />
          <StatPill label="Suppressed" value={stats.suppressed} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border/60">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Recipient</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Time</th>
                <th className="px-3 py-2 font-semibold">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {statusQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-muted-foreground">
                    Loading email status…
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-muted-foreground">
                    No email attempts found yet.
                  </td>
                </tr>
              ) : (
                emails.slice(0, 12).map((email) => (
                  <tr key={email.message_id}>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {email.template_name.replace(/^beat_/, "").replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{email.recipient_email}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${statusClass(email.status)}`}
                      >
                        {email.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{new Date(email.created_at).toLocaleString()}</td>
                    <td className="max-w-[260px] truncate px-3 py-2 text-red-600" title={email.error_message || ""}>
                      {email.error_message || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  tone = "gray",
}: {
  label: string;
  value: number;
  tone?: "gray" | "green" | "yellow" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "bg-green-50 text-green-700"
      : tone === "yellow"
        ? "bg-yellow-50 text-yellow-700"
        : tone === "red"
          ? "bg-red-50 text-red-700"
          : "bg-secondary/40 text-foreground";
  return (
    <div className={`rounded-lg px-3 py-2 ${toneClass}`}>
      <div className="text-lg font-black leading-none">{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide">{label}</div>
    </div>
  );
}

// ---------- Inquiry questions editor ----------
type InquiryQ = {
  id: string;
  label: string;
  placeholder: string | null;
  field_type: string;
  required: boolean;
  sort_order: number;
  active: boolean;
};
function InquiryQuestionsCard() {
  const listFn = useServerFn(adminListInquiryQuestions);
  const upsert = useServerFn(adminUpsertInquiryQuestion);
  const del = useServerFn(adminDeleteInquiryQuestion);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-inquiry-questions"], queryFn: () => listFn() });
  const questions = (q.data?.questions ?? []) as InquiryQ[];
  const [adding, setAdding] = useState(false);

  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-bold">Exclusive Inquiry Questions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            These populate the popup when someone taps "Apply for Exclusive / Custom Work". Answers are emailed to
            jason@krazyjay.com.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg bg-blue-600 text-white text-sm font-semibold px-3 py-2 hover:bg-blue-700"
        >
          + New question
        </button>
      </div>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {questions.map((qq) => (
            <QuestionRow
              key={qq.id}
              q={qq}
              onSave={async (patch) => {
                const r = await upsert({ data: { id: qq.id, ...patch } });
                if (r.ok) {
                  toast.success("Saved");
                  qc.invalidateQueries({ queryKey: ["admin-inquiry-questions"] });
                } else toast.error(r.error || "Failed");
              }}
              onDelete={async () => {
                if (!confirm(`Delete "${qq.label}"?`)) return;
                const r = await del({ data: { id: qq.id } });
                if (r.ok) {
                  toast.success("Deleted");
                  qc.invalidateQueries({ queryKey: ["admin-inquiry-questions"] });
                } else toast.error(r.error || "Failed");
              }}
            />
          ))}
        </ul>
      )}
      {adding && (
        <NewQuestionForm
          onCancel={() => setAdding(false)}
          onCreate={async (patch) => {
            const r = await upsert({ data: patch });
            if (r.ok) {
              toast.success("Added");
              qc.invalidateQueries({ queryKey: ["admin-inquiry-questions"] });
              setAdding(false);
            } else toast.error(r.error || "Failed");
          }}
        />
      )}
    </div>
  );
}

function QuestionRow({
  q,
  onSave,
  onDelete,
}: {
  q: InquiryQ;
  onSave: (p: {
    label: string;
    placeholder?: string | null;
    field_type?: string;
    required?: boolean;
    sort_order?: number;
    active?: boolean;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(q.label);
  const [placeholder, setPlaceholder] = useState(q.placeholder || "");
  const [fieldType, setFieldType] = useState(q.field_type);
  const [required, setRequired] = useState(q.required);
  const [sortOrder, setSortOrder] = useState(q.sort_order);
  const [active, setActive] = useState(q.active);

  if (!editing) {
    return (
      <li className="py-3 flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-8 tabular-nums">{q.sort_order}</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">
            {q.label}
            {q.required && <span className="text-red-500 ml-1">*</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {q.field_type}
            {q.active ? "" : " · disabled"}
          </div>
        </div>
        <button onClick={() => setEditing(true)} className="text-blue-600 hover:underline text-xs">
          Edit
        </button>
        <button onClick={onDelete} className="text-red-600 hover:underline text-xs">
          Delete
        </button>
      </li>
    );
  }
  const inp = "w-full rounded-lg border border-border px-2 py-1.5 text-sm";
  return (
    <li className="py-3 space-y-2 bg-secondary/40 rounded-lg p-3">
      <input className={inp} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Question label" />
      <input
        className={inp}
        value={placeholder}
        onChange={(e) => setPlaceholder(e.target.value)}
        placeholder="Placeholder (optional)"
      />
      <div className="grid grid-cols-3 gap-2">
        <select className={inp} value={fieldType} onChange={(e) => setFieldType(e.target.value)}>
          <option value="text">Short text</option>
          <option value="textarea">Long text</option>
          <option value="email">Email</option>
        </select>
        <input
          type="number"
          className={inp}
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          placeholder="Order"
        />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
      </label>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs rounded-lg border border-border">
          Cancel
        </button>
        <button
          onClick={async () => {
            await onSave({ label, placeholder, field_type: fieldType, required, sort_order: sortOrder, active });
            setEditing(false);
          }}
          className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white font-semibold"
        >
          Save
        </button>
      </div>
    </li>
  );
}

function NewQuestionForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (p: {
    label: string;
    placeholder?: string | null;
    field_type?: string;
    required?: boolean;
    sort_order?: number;
    active?: boolean;
  }) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [placeholder, setPlaceholder] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [required, setRequired] = useState(true);
  const [sortOrder, setSortOrder] = useState(100);
  const inp = "w-full rounded-lg border border-border px-2 py-1.5 text-sm";
  return (
    <div className="mt-4 p-3 bg-secondary/40 rounded-lg space-y-2">
      <input className={inp} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Question label" />
      <input
        className={inp}
        value={placeholder}
        onChange={(e) => setPlaceholder(e.target.value)}
        placeholder="Placeholder (optional)"
      />
      <div className="grid grid-cols-3 gap-2">
        <select className={inp} value={fieldType} onChange={(e) => setFieldType(e.target.value)}>
          <option value="text">Short text</option>
          <option value="textarea">Long text</option>
          <option value="email">Email</option>
        </select>
        <input
          type="number"
          className={inp}
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          placeholder="Order"
        />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required
        </label>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs rounded-lg border border-border">
          Cancel
        </button>
        <button
          onClick={async () => {
            if (!label.trim()) {
              toast.error("Label required");
              return;
            }
            await onCreate({
              label,
              placeholder,
              field_type: fieldType,
              required,
              sort_order: sortOrder,
              active: true,
            });
          }}
          className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white font-semibold"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ---------- Inquiry submissions viewer ----------
function InquirySubmissionsCard() {
  const fn = useServerFn(adminListInquirySubmissions);
  const q = useQuery({ queryKey: ["admin-inquiry-submissions"], queryFn: () => fn() });
  const rows = (q.data?.submissions ?? []) as Array<{
    id: string;
    name: string;
    email: string;
    beat_id: string | null;
    answers: Record<string, string>;
    created_at: string;
  }>;
  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
      <h2 className="text-base font-bold mb-3">Exclusive Inquiries ({rows.length})</h2>
      <div className="max-h-96 overflow-y-auto space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No submissions yet.</p>
        ) : (
          rows.map((r) => (
            <details key={r.id} className="border border-border/60 rounded-lg p-3">
              <summary className="cursor-pointer text-sm font-semibold flex items-center gap-3">
                <span>{r.name}</span>
                <span className="text-muted-foreground font-normal">{r.email}</span>
                <span className="ml-auto text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              </summary>
              <pre className="mt-2 text-xs bg-secondary/40 rounded p-2 overflow-x-auto">
                {JSON.stringify(r.answers, null, 2)}
              </pre>
            </details>
          ))
        )}
      </div>
    </div>
  );
}

// ---------- Attachments manager (inside EditBeatModal) ----------
function AttachmentsManager({ beatId }: { beatId: string }) {
  const listFn = useServerFn(adminListAttachments);
  const createFn = useServerFn(adminCreateAttachment);
  const delFn = useServerFn(adminDeleteAttachment);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-attachments", beatId], queryFn: () => listFn({ data: { beatId } }) });
  const rows = (q.data?.attachments ?? []) as Array<{
    id: string;
    filename: string;
    mime_type: string | null;
    size_bytes: number | null;
    storage_path: string;
    sort_order: number;
  }>;
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const path = `${beatId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("beat-attachments").upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
      if (error) throw error;
      const r = await createFn({
        data: {
          beatId,
          storage_path: path,
          filename: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          sort_order: rows.length * 10,
        },
      });
      if (!r.ok) throw new Error(r.error || "Failed");
      toast.success("Attachment uploaded");
      qc.invalidateQueries({ queryKey: ["admin-attachments", beatId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold">
          Attachments (PDFs, docs, images — buyers can download from the beat page)
        </label>
        <label className="cursor-pointer text-xs rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-700 hover:bg-blue-100">
          {uploading ? "Uploading…" : "+ Upload"}
          <input type="file" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">None yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2">
              <span className="flex-1 text-sm truncate">{r.filename}</span>
              <span className="text-xs text-muted-foreground">
                {r.size_bytes ? `${(r.size_bytes / 1024).toFixed(1)} KB` : ""}
              </span>
              <button
                onClick={async () => {
                  if (!confirm("Delete this attachment?")) return;
                  await delFn({ data: { id: r.id } });
                  qc.invalidateQueries({ queryKey: ["admin-attachments", beatId] });
                }}
                className="text-red-600 text-xs hover:underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
