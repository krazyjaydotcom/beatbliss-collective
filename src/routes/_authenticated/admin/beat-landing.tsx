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
} from "@/lib/beat-landing.functions";


export const Route = createFileRoute("/_authenticated/admin/beat-landing")({
  component: BeatLandingAdmin,
});

type BeatRow = {
  id: string;
  title: string;
  landing_slug: string | null;
  is_landing_published: boolean;
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
};

function BeatLandingAdmin() {
  const listFn = useServerFn(adminListBeats);
  const beatsQuery = useQuery({
    queryKey: ["admin-landing-beats"],
    queryFn: () => listFn(),
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-black">Beat Landing Pages</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure the public /beats/[slug] pages and the global video shown on every landing page.
          </p>
        </div>

        <DeliveryInfoCard />
        <EmailTesterCard />
        <BulkPricingCard />
        <GlobalVideoCard />
        <AllBeatsTable
          beats={((beatsQuery.data?.beats ?? []) as unknown) as BeatRow[]}
          loading={beatsQuery.isLoading}
        />
        <InquiryQuestionsCard />
        <InquirySubmissionsCard />
        <LeadsCard />
        <OrdersCard />

      </div>
    </div>
  );
}

function GlobalVideoCard() {
  const getFn = useServerFn(adminGetGlobalVideo);
  const updateFn = useServerFn(adminUpdateGlobalVideo);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-global-video"], queryFn: () => getFn() });
  const g = q.data?.global as { video_url: string | null; contact_instagram: string | null; contact_email: string | null; contact_phone: string | null } | null | undefined;

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
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
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
    <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-xl font-bold">Global Video & Contact Info</h2>
        <p className="text-sm text-gray-500 mt-1">Shows on every beat landing page unless a beat has its own custom video.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold mb-1">Video URL</label>
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <div className="mt-2 flex gap-2 flex-wrap">
            <label className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm hover:border-gray-300">
              {uploading ? "Uploading..." : "Upload File"}
              <input type="file" accept="video/*" hidden onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
            </label>
            {!recording ? (
              <button onClick={startRecording} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 hover:bg-red-100">● Record</button>
            ) : (
              <button onClick={stopRecording} className="rounded-lg border border-red-500 bg-red-500 px-3 py-2 text-sm text-white">Stop</button>
            )}
            {recordedBlob && !recording && (
              <button onClick={() => uploadFile(recordedBlob)} className="rounded-lg bg-purple-600 text-white px-3 py-2 text-sm">Upload Recording</button>
            )}
          </div>
          <video ref={previewVideoRef} controls className="mt-3 w-full aspect-video rounded-lg bg-gray-900" src={!recording && !recordedBlob ? videoUrl : undefined} />
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold mb-1">Instagram (handle or URL)</label>
            <input value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@krazyjaydotcom" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <input value={em} onChange={(e) => setEm(e.target.value)} placeholder="hello@..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Phone</label>
            <input value={ph} onChange={(e) => setPh(e.target.value)} placeholder="+1..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          </div>
          <button onClick={save} className="w-full rounded-lg bg-black text-white px-4 py-2.5 font-semibold hover:bg-gray-800">Save</button>
        </div>
      </div>
    </div>
  );
}

function AllBeatsTable({ beats, loading }: { beats: BeatRow[]; loading: boolean }) {
  const [editing, setEditing] = useState<BeatRow | null>(null);
  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Landing Page Beats</h2>
        <p className="text-xs text-gray-500">Only beats with a slug appear here. Add slugs in /admin/beats first.</p>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : beats.length === 0 ? (
        <p className="text-sm text-gray-500">No beats yet. Create beats in /admin/beats first.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="py-2">Title</th>
                <th className="py-2">Slug</th>
                <th className="py-2">Price</th>
                <th className="py-2">Discount</th>
                <th className="py-2">Live</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {beats.map((b) => (
                <tr key={b.id} className="border-b border-gray-50 align-top">
                  <td className="py-3 font-medium">
                    <div>{b.title}</div>
                    {b.landing_slug && b.is_landing_published && (
                      <div className="mt-2 space-y-1">
                        <ShareLinkRow url={`https://mybeatcatalog.com/beats/${b.landing_slug}`} label="Canonical" />
                        <ShareLinkRow url={`https://mybeatcatalog.com/beat-landing/${b.landing_slug}`} label="Friendly" />
                      </div>
                    )}
                  </td>
                  <td className="py-3 font-mono text-xs">{b.landing_slug || "—"}</td>
                  <td className="py-3">${(b.price_cents / 100).toFixed(2)}</td>
                  <td className="py-3">${(b.discount_price_cents / 100).toFixed(2)}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${b.is_landing_published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {b.is_landing_published ? "Live" : "Draft"}
                    </span>
                  </td>
                  <td className="py-3">
                    <button onClick={() => setEditing(b)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    {b.landing_slug && b.is_landing_published && (
                      <>
                        <a href={`/beats/${b.landing_slug}`} target="_blank" rel="noreferrer" className="ml-3 text-gray-500 hover:underline text-xs">View →</a>
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
    </div>
  );
}

function ShareLinkRow({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-400 w-16 shrink-0">{label}</span>
      <a href={url} target="_blank" rel="noreferrer" className="font-mono text-purple-600 hover:underline truncate max-w-xs">{url}</a>
      <button onClick={copy} className="rounded border border-gray-200 px-2 py-0.5 text-[10px] hover:bg-gray-50">
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
    is_landing_published: beat.is_landing_published,
    producer_name: beat.producer_name || "",
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
        is_landing_published: form.is_landing_published,
        producer_name: form.producer_name || null,
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

  const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm";
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl my-8" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-black mb-4">Edit: {beat.title}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="text-xs font-semibold">URL slug</label><input className={inp} value={form.landing_slug} onChange={(e) => setForm({ ...form, landing_slug: e.target.value })} placeholder="midnight-drive" /></div>
          <div><label className="text-xs font-semibold">Producer name</label><input className={inp} value={form.producer_name} onChange={(e) => setForm({ ...form, producer_name: e.target.value })} /></div>
          <div><label className="text-xs font-semibold">Price (cents)</label><input type="number" className={inp} value={form.price_cents} onChange={(e) => setForm({ ...form, price_cents: Number(e.target.value) })} /></div>
          <div><label className="text-xs font-semibold">First-time discount (cents)</label><input type="number" className={inp} value={form.discount_price_cents} onChange={(e) => setForm({ ...form, discount_price_cents: Number(e.target.value) })} /></div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold">Legacy external checkout URL <span className="text-gray-400 font-normal">(optional fallback — no longer required; normal Stripe checkout works without this)</span></label>
            <input className={inp} value={form.checkout_url} onChange={(e) => setForm({ ...form, checkout_url: e.target.value })} placeholder="https://... (leave blank to use built-in Stripe checkout)" />
          </div>
          <div className="sm:col-span-2"><label className="text-xs font-semibold">Application URL</label><input className={inp} value={form.application_url} onChange={(e) => setForm({ ...form, application_url: e.target.value })} placeholder="https://..." /></div>
          <div className="sm:col-span-2"><label className="text-xs font-semibold">Custom video URL (optional; overrides global)</label><input className={inp} value={form.custom_video_url} onChange={(e) => setForm({ ...form, custom_video_url: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="text-xs font-semibold">SEO title</label><input className={inp} value={form.seo_title} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="text-xs font-semibold">SEO description</label><textarea rows={3} className={inp} value={form.seo_description} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} /></div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input id="pub" type="checkbox" checked={form.is_landing_published} onChange={(e) => setForm({ ...form, is_landing_published: e.target.checked })} />
            <label htmlFor="pub" className="text-sm">Published (visible at /beats/{form.landing_slug || "…"})</label>
          </div>
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200">Cancel</button>
          <button onClick={save} className="px-4 py-2 text-sm rounded-lg bg-black text-white font-semibold">Save</button>
        </div>
      </div>
    </div>
  );
}

function LeadsCard() {
  const fn = useServerFn(adminListLeadCaptures);
  const q = useQuery({ queryKey: ["admin-lead-captures"], queryFn: () => fn() });
  const leads = (q.data?.leads ?? []) as Array<{ id: string; first_name: string; email: string; created_at: string; beat_id: string | null }>;
  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
      <h2 className="text-xl font-bold mb-3">Tagged Download Leads ({leads.length})</h2>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-gray-500 text-left border-b border-gray-100"><th className="py-1.5">Name</th><th>Email</th><th>When</th></tr></thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-gray-50"><td className="py-1.5">{l.first_name}</td><td>{l.email}</td><td className="text-xs text-gray-500">{new Date(l.created_at).toLocaleString()}</td></tr>
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
  const orders = (q.data?.orders ?? []) as Array<{ id: string; email: string; amount_cents: number; used_first_time_discount: boolean; created_at: string }>;
  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
      <h2 className="text-xl font-bold mb-3">Lease Orders ({orders.length})</h2>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-gray-500 text-left border-b border-gray-100"><th className="py-1.5">Email</th><th>Amount</th><th>Discount</th><th>When</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-gray-50">
                <td className="py-1.5">{o.email}</td>
                <td>${(o.amount_cents / 100).toFixed(2)}</td>
                <td>{o.used_first_time_discount ? <span className="text-orange-600 text-xs">First-time</span> : ""}</td>
                <td className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString()}</td>
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
        Paid purchases are delivered after Stripe confirms payment. The buyer automatically receives an email with the beat MP3 download link and the Unlimited License Agreement. You (admin) receive a sale notification email. Free MP3 downloads capture the lead and email them the MP3 link.
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
    if (!confirm(`Apply price $${(priceCents / 100).toFixed(2)}${discountCents !== null ? ` and discount $${(discountCents / 100).toFixed(2)}` : ""} to ${label}?`)) return;
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
    <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-bold">Bulk pricing</h2>
        <p className="text-sm text-gray-500 mt-1">
          Set lease and optional first-time discount pricing once and apply to landing pages in bulk. Only updates <code className="text-xs">price_cents</code> and <code className="text-xs">discount_price_cents</code>. Membership pricing is not affected.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-semibold mb-1">Lease price (USD)</label>
          <input
            type="number"
            step="0.01"
            min="0.5"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
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
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Apply to</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as "published" | "all")}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
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
