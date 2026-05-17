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
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const steps = [
    {
      icon: <UserRound className="h-4 w-4" />,
      label: "Artist / label name",
      question: "What artist or label name should I know?",
      helper: "This helps me know who I am listening for.",
      value: name,
      required: true,
      input: (
        <input
          required
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-lg border border-white bg-white px-4 py-4 text-base font-semibold text-black outline-none placeholder:text-black/35 focus:border-primary focus:ring-2 focus:ring-primary/35"
          placeholder="Your artist or label name"
        />
      ),
    },
    {
      icon: <Mail className="h-4 w-4" />,
      label: "Email address",
      question: "Where should I send the next step?",
      helper: "Use the email you check most often.",
      value: email,
      required: true,
      input: (
        <input
          required
          autoFocus
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-white bg-white px-4 py-4 text-base font-semibold text-black outline-none placeholder:text-black/35 focus:border-primary focus:ring-2 focus:ring-primary/35"
          placeholder="you@example.com"
        />
      ),
    },
    {
      icon: <Phone className="h-4 w-4" />,
      label: "Phone number",
      question: "What's the best phone number to reach you?",
      helper: "Only for serious follow-up if the fit looks right.",
      value: phone,
      required: true,
      input: (
        <input
          required
          autoFocus
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="w-full rounded-lg border border-white bg-white px-4 py-4 text-base font-semibold text-black outline-none placeholder:text-black/35 focus:border-primary focus:ring-2 focus:ring-primary/35"
          placeholder="Best number to reach you"
        />
      ),
    },
    {
      icon: <Music2 className="h-4 w-4" />,
      label: "Link to music",
      question: "Where can I hear your music?",
      helper: "Optional, but helpful. Spotify, YouTube, SoundCloud, or a private link works.",
      value: music,
      required: false,
      input: (
        <input
          autoFocus
          value={music}
          onChange={(event) => setMusic(event.target.value)}
          className="w-full rounded-lg border border-white bg-white px-4 py-4 text-base font-semibold text-black outline-none placeholder:text-black/35 focus:border-primary focus:ring-2 focus:ring-primary/35"
          placeholder="Music link (optional)"
        />
      ),
    },
  ];

  const currentStep = steps[step];

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

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSubmitted(false);
    setMessage(null);
  }, [open]);

  function validateCurrentStep() {
    if (!currentStep.required) return true;
    if (!currentStep.value.trim()) {
      setMessage({ type: "error", text: "Please answer this question before moving forward." });
      return false;
    }
    if (currentStep.label === "Email address" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMessage({ type: "error", text: "Please enter a valid email address." });
      return false;
    }
    setMessage(null);
    return true;
  }

  function nextStep() {
    if (!validateCurrentStep()) return;
    setStep((value) => Math.min(value + 1, steps.length - 1));
  }

  function previousStep() {
    setMessage(null);
    setStep((value) => Math.max(value - 1, 0));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (step < steps.length - 1) {
      nextStep();
      return;
    }
    if (!validateCurrentStep()) return;
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
      setSubmitted(true);
      setMessage({
        type: "success",
        text: "Thank you for your submission. I look forward to being your new producer. - KRAZYJAYDOTCOM",
      });
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

        <form onSubmit={onSubmit} className="space-y-5 px-4 py-5 sm:px-6">
          {submitted ? (
            <div className="min-h-[260px] animate-in fade-in duration-700">
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-200">Application sent</p>
                <p className="mt-4 text-2xl font-black leading-tight text-white">
                  Thank you for your submission.
                </p>
                <p className="mt-3 text-base leading-relaxed text-white/75">
                  I look forward to being your new producer.
                </p>
                <p className="mt-5 text-sm font-black uppercase tracking-[0.2em] text-primary">- KRAZYJAYDOTCOM</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="mt-5 flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_35px_rgba(37,99,235,0.35)] transition hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-1.5">
                  {steps.map((item, index) => (
                    <span
                      key={item.label}
                      className={`h-1.5 w-8 rounded-full transition ${index <= step ? "bg-primary" : "bg-white/15"}`}
                    />
                  ))}
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-white/45">
                  {step + 1} / {steps.length}
                </span>
              </div>

              <div key={step} className="min-h-[230px] animate-in fade-in slide-in-from-right-2 duration-500">
                <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/55">
                  <span className="text-primary">{currentStep.icon}</span>
                  {currentStep.label}
                </div>
                <h3 className="text-2xl font-black leading-tight text-white sm:text-3xl">{currentStep.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{currentStep.helper}</p>
                <div className="mt-6">{currentStep.input}</div>
              </div>
            </>
          )}

          {message && (!submitted || message.type === "error") ? (
            <p className={`rounded-lg border px-3 py-2 text-sm ${
              message.type === "success"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                : "border-red-400/30 bg-red-400/10 text-red-100"
            }`}>
              {message.text}
            </p>
          ) : null}

          {!submitted ? (
            <div className="flex gap-3">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={previousStep}
                  disabled={submitting}
                  className="flex h-12 w-24 items-center justify-center rounded-lg border border-white/15 text-sm font-bold text-white/70 transition hover:border-white/30 hover:text-white disabled:opacity-60"
                >
                  Back
                </button>
              ) : null}
              <button
                type="submit"
                disabled={submitting}
                className="flex h-12 flex-1 items-center justify-center rounded-lg bg-primary px-5 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_35px_rgba(37,99,235,0.35)] transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : step === steps.length - 1 ? "Send Application" : "Continue"}
              </button>
            </div>
          ) : null}

          {!submitted ? <p className="text-center text-xs text-white/45">Your information is private. No spam.</p> : null}
        </form>
      </div>
    </div>
  );
}
