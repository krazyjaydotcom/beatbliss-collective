import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, Music2, Phone, UserRound, X } from "lucide-react";
import { submitAccessApplication } from "@/lib/access-application.functions";

type AccessApplicationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AccessApplicationModal({ open, onOpenChange }: AccessApplicationModalProps) {
  const submitApplication = useServerFn(submitAccessApplication);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [music, setMusic] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onOpenChange, open]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const result = await submitApplication({
        data: {
          name,
          email,
          phone,
          music: music.trim() || null,
          source: "front-page-apply",
        },
      });
      if (!result.ok) {
        setMessage({ type: "error", text: result.error || "We could not submit your application. Please try again." });
        return;
      }
      setMessage({ type: "success", text: "Application received. Check your email and phone for the next step." });
      setName("");
      setEmail("");
      setPhone("");
      setMusic("");
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "We could not submit your application. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/75 px-2 py-2 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center sm:px-4 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Apply for access form"
    >
      <button className="absolute inset-0 cursor-default" type="button" aria-label="Close application form" onClick={() => onOpenChange(false)} />
      <div className="mobile-keyboard-safe relative my-auto max-h-[calc(100svh-1rem)] w-full max-w-[min(100%,34rem)] overflow-y-auto overflow-x-hidden rounded-xl border border-primary/40 bg-[#05070c] shadow-[0_0_90px_rgba(37,99,235,0.25)] animate-in fade-in zoom-in-95 duration-200 sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white/70 transition hover:border-primary/60 hover:text-white sm:right-4 sm:top-4 sm:h-10 sm:w-10"
          aria-label="Close application form"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-white/10 px-4 py-4 pr-14 sm:px-6 sm:py-5 sm:pr-16">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary sm:text-xs sm:tracking-[0.25em]">Private Access</p>
          <h2 className="mt-2 text-xl font-black leading-tight text-white sm:text-2xl md:text-3xl">Apply For MYBEATCATALOG Access</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            Tell me where you are musically. If it fits, I will send the next step.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 px-4 py-5 sm:px-6">
          <Field icon={<UserRound className="h-4 w-4" />} label="Artist / label name">
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full bg-transparent px-3 py-3 text-base text-white outline-none placeholder:text-white/30"
              placeholder="Your artist or label name"
            />
          </Field>
          <Field icon={<Mail className="h-4 w-4" />} label="Email address">
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-transparent px-3 py-3 text-base text-white outline-none placeholder:text-white/30"
              placeholder="you@example.com"
            />
          </Field>
          <Field icon={<Phone className="h-4 w-4" />} label="Phone number">
            <input
              required
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full bg-transparent px-3 py-3 text-base text-white outline-none placeholder:text-white/30"
              placeholder="Best number to reach you"
            />
          </Field>
          <Field icon={<Music2 className="h-4 w-4" />} label="Link to music">
            <input
              value={music}
              onChange={(event) => setMusic(event.target.value)}
              className="w-full bg-transparent px-3 py-3 text-base text-white outline-none placeholder:text-white/30"
              placeholder="Spotify, YouTube, SoundCloud, etc. (optional)"
            />
          </Field>

          {message ? (
            <p className={`rounded-lg border px-3 py-2 text-sm ${
              message.type === "success"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                : "border-red-400/30 bg-red-400/10 text-red-100"
            }`}>
              {message.text}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_35px_rgba(37,99,235,0.35)] transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : "Send Application"}
          </button>

          <p className="text-center text-xs text-white/45">Your information is private. No spam.</p>
        </form>
      </div>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/55">
        <span className="text-primary">{icon}</span>
        {label}
      </span>
      <span className="block rounded-lg border border-white/12 bg-white/[0.04] transition focus-within:border-primary/70 focus-within:bg-white/[0.07]">
        {children}
      </span>
    </label>
  );
}
