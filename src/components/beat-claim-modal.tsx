import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Lock, Mail, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ClaimableBeatLite = {
  id: string;
  title: string;
  genre?: string | null;
  mood?: string | null;
  duration_seconds?: number | null;
};

type Props = {
  beat: ClaimableBeatLite | null;
  open: boolean;
  onClose: () => void;
  source?: string;
};

function getDeviceFingerprint() {
  if (typeof window === "undefined") return "";
  const key = "mbc_beat_claim_device";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const generated = window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36);
  window.localStorage.setItem(key, generated);
  return generated;
}

function formatDuration(seconds: number | null | undefined) {
  const total = Math.max(0, Number(seconds ?? 0));
  if (!total) return "--:--";
  const min = Math.floor(total / 60);
  const sec = Math.floor(total % 60);
  return String(min).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
}

export function BeatClaimModal({ beat, open, onClose, source }: Props) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !beat) return null;

  const style = [beat.mood, beat.genre].filter(Boolean).join(" / ") || "Premium";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !beat) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/beat-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          beatId: beat.id,
          source: source ?? "seo-page",
          origin: window.location.origin,
          deviceFingerprint: getDeviceFingerprint(),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.ok || !result.token) {
        throw new Error(result.error ?? "Unable to reserve this beat.");
      }
      const provider = result.sendy ?? result.sendfox;
      if (provider?.configured && !provider.ok) {
        toast.message(`Beat reserved, but Sendy needs attention: ${provider.error ?? "unknown error"}`);
      }
      navigate({ to: "/offer/$token", params: { token: result.token } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to reserve this beat.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-primary/40 bg-[#05090f] p-6 shadow-[0_0_80px_rgba(37,99,235,0.22)]">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-primary/50 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="pr-10">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">You selected</p>
          <h2 className="mt-2 text-2xl font-black text-white">{beat.title}</h2>
          <p className="mt-2 text-sm text-white/55">
            {style}
            {beat.duration_seconds ? " / " + formatDuration(beat.duration_seconds) : ""}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="mt-6">
          <h3 className="text-lg font-black uppercase text-white">Where should I send the beat?</h3>
          <p className="mt-1 text-sm text-white/55">Enter your email and I will send your private beat page.</p>
          <label className="relative mt-4 block">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="h-12 border-white/15 bg-white/[0.04] pl-11 text-white placeholder:text-white/35"
              autoFocus
            />
          </label>
          <Button type="submit" variant="hero" size="lg" className="mt-3 w-full" disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send Me This Beat
          </Button>
          <p className="mt-3 flex items-center gap-2 text-xs text-white/45">
            <Lock className="h-3.5 w-3.5" /> We will email your beat page and offer link.
          </p>
        </form>
      </div>
    </div>
  );
}
