import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Edit3,
  Link as LinkIcon,
  Loader2,
  Mail,
  Music2,
  Pause,
  Phone,
  Play,
  SkipBack,
  SkipForward,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { submitAccessApplication } from "@/lib/access-application.functions";
import { supabase } from "@/integrations/supabase/client";

type AccessApplicationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Question = {
  id: string;
  sort_order: number;
  label: string;
  question_text: string;
  helper_text: string;
  placeholder: string;
  input_type: string;
  icon: string;
  is_required: boolean;
};

type ClaimableBeat = {
  id: string;
  title: string;
  producer_name: string | null;
  genre: string | null;
  mood: string | null;
  bpm: number | null;
  duration_seconds: number | null;
  cover_url: string | null;
  audio_url: string | null;
  audio_url_tagged: string | null;
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  user: UserRound,
  mail: Mail,
  phone: Phone,
  music: Music2,
  link: LinkIcon,
  edit: Edit3,
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

function beatAudio(beat: ClaimableBeat | null) {
  return beat?.audio_url_tagged || beat?.audio_url || "";
}

export function AccessApplicationModal({ open, onOpenChange }: AccessApplicationModalProps) {
  const navigate = useNavigate();
  const submitApplication = useServerFn(submitAccessApplication);
  const audioRef = useRef<HTMLAudioElement>(null);

  const questionsQuery = useQuery({
    queryKey: ["access-questions-public"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("access_application_questions")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Question[];
    },
    enabled: open,
  });

  const beatsQuery = useQuery({
    queryKey: ["claimable-beats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("list_claimable_beats");
      if (error) throw error;
      return (data ?? []) as ClaimableBeat[];
    },
    enabled: open,
  });

  const questions = questionsQuery.data ?? [];
  const beats = beatsQuery.data ?? [];

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [beatIndex, setBeatIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const totalSteps = questions.length + 1; // questions + beat picker
  const isBeatStep = step === questions.length;
  const currentQuestion = questions[step];
  const currentBeat = beats[beatIndex] ?? null;

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
    setAnswers({});
    setBeatIndex(0);
    setIsPlaying(false);
  }, [open]);

  // Stop audio on close/step away
  useEffect(() => {
    if (!isBeatStep && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isBeatStep]);

  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [open]);

  // Load audio when beat changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentBeat) return;
    const src = beatAudio(currentBeat);
    if (!src) return;
    audio.src = src;
    audio.load();
    if (isPlaying) audio.play().catch(() => setIsPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBeat?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  function getAnswer(id: string) {
    return answers[id] ?? "";
  }

  function setAnswer(id: string, value: string) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  function validateCurrentStep(): boolean {
    if (isBeatStep) {
      if (!currentBeat) {
        setMessage({ type: "error", text: "Please choose a beat before continuing." });
        return false;
      }
      setMessage(null);
      return true;
    }
    if (!currentQuestion) return true;
    const val = getAnswer(currentQuestion.id).trim();
    if (currentQuestion.is_required && !val) {
      setMessage({ type: "error", text: "Please answer this question before moving forward." });
      return false;
    }
    if (currentQuestion.input_type === "email" && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      setMessage({ type: "error", text: "Please enter a valid email address." });
      return false;
    }
    setMessage(null);
    return true;
  }

  function nextStep() {
    if (!validateCurrentStep()) return;
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  }

  function previousStep() {
    setMessage(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function playPause() {
    const audio = audioRef.current;
    if (!audio || !currentBeat) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }

  function shiftBeat(offset: number) {
    if (!beats.length) return;
    setBeatIndex((i) => (i + offset + beats.length) % beats.length);
  }

  function findAnswerByLabel(re: RegExp): string {
    const q = questions.find((x) => re.test(x.label) || re.test(x.question_text));
    return q ? getAnswer(q.id).trim() : "";
  }

  async function finalize() {
    if (!validateCurrentStep()) return;
    if (!currentBeat) return;

    const name = findAnswerByLabel(/name|artist|label/i) || "Applicant";
    const email = findAnswerByLabel(/email/i);
    const phone = findAnswerByLabel(/phone/i) || "n/a";
    const music = findAnswerByLabel(/music|link|spotify|youtube|soundcloud/i) || null;

    if (!email) {
      setMessage({ type: "error", text: "Email is required to send your free beat." });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      // Fire-and-forget: submit application to Sendy
      submitApplication({
        data: {
          name,
          email,
          phone,
          music,
          source: "apply-for-access-modal",
        },
      }).catch(() => {});

      // Create beat claim and redirect
      const res = await fetch("/api/public/beat-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase(),
          beatId: currentBeat.id,
          source: "apply-for-access-modal",
          origin: window.location.origin,
          deviceFingerprint: getDeviceFingerprint(),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.ok || !result.token) {
        throw new Error(result.error ?? "Unable to reserve your beat.");
      }

      setSubmitted(true);
      onOpenChange(false);
      navigate({ to: "/offer/$token", params: { token: result.token } });
    } catch (err) {
      const text = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setMessage({ type: "error", text });
      toast.error(text);
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (step < totalSteps - 1) {
      nextStep();
    } else {
      finalize();
    }
  }

  if (!open) return null;

  // Auto-shrink size for single-line headings
  function fitSize(text: string, base = 1.5, min = 0.95) {
    const len = text?.length ?? 0;
    if (len <= 28) return `${base}rem`;
    if (len <= 40) return `${Math.max(min, base - 0.2)}rem`;
    if (len <= 60) return `${Math.max(min, base - 0.4)}rem`;
    return `${min}rem`;
  }

  const Icon = currentQuestion ? (ICON_MAP[currentQuestion.icon] ?? Edit3) : Music2;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/75 px-2 py-2 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center sm:px-4 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Apply for access form"
    >
      <button className="absolute inset-0 cursor-default" type="button" aria-label="Close application form" onClick={() => onOpenChange(false)} />
      <div className="mobile-keyboard-safe relative my-auto flex max-h-[calc(100svh-1rem)] w-full max-w-[min(100%,34rem)] flex-col overflow-hidden rounded-xl border border-primary/40 bg-[#05070c] shadow-[0_0_90px_rgba(37,99,235,0.25)] animate-in fade-in zoom-in-95 duration-200 sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white/70 transition hover:border-primary/60 hover:text-white sm:right-4 sm:top-4 sm:h-10 sm:w-10"
          aria-label="Close application form"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="shrink-0 border-b border-white/10 px-4 py-3 pr-14 sm:px-6 sm:py-4 sm:pr-16">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary sm:text-xs">Private Access</p>
          <h2
            className="mt-1 truncate whitespace-nowrap font-black leading-tight text-white"
            style={{ fontSize: fitSize("Apply For MYBEATCATALOG Access", 1.5, 1.05) }}
            title="Apply For MYBEATCATALOG Access"
          >
            Apply For MYBEATCATALOG Access
          </h2>
        </div>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6">
          {submitted ? (
            <div className="animate-in fade-in duration-700">
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-200">Sending you to your beat</p>
                <p className="mt-3 text-xl font-black text-white">Thank you for your submission.</p>
              </div>
            </div>
          ) : questionsQuery.isLoading ? (
            <div className="flex flex-1 items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : isBeatStep ? (
            <div className="flex-1 animate-in fade-in slide-in-from-right-2 duration-500">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/55">
                <Music2 className="h-4 w-4 text-primary" />
                Your free beat
                <span className="ml-auto rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-200">Demo License</span>
              </div>
              <h3
                className="truncate whitespace-nowrap font-black leading-tight text-white"
                style={{ fontSize: fitSize("Pick a free beat to take with you", 1.5, 1) }}
                title="Pick a free beat to take with you"
              >
                Pick a free beat to take with you
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Use the arrows to browse, hit play to preview. When you find the one you want, press Continue.
              </p>

              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                {beatsQuery.isLoading ? (
                  <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>
                ) : !currentBeat ? (
                  <p className="py-6 text-center text-sm text-white/55">No beats available right now.</p>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      {currentBeat.cover_url ? (
                        <img src={currentBeat.cover_url} alt={currentBeat.title} className="h-14 w-14 shrink-0 rounded-md object-cover" />
                      ) : (
                        <div className="h-14 w-14 shrink-0 rounded-md bg-primary/20" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate whitespace-nowrap text-base font-black text-white" title={currentBeat.title}>
                          {currentBeat.title}
                        </p>
                        <p className="truncate text-xs text-white/55">
                          {[currentBeat.mood, currentBeat.genre, currentBeat.bpm ? `${currentBeat.bpm} BPM` : null].filter(Boolean).join(" / ")}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-3">
                      <button type="button" onClick={() => shiftBeat(-1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white hover:border-primary/60" aria-label="Previous beat">
                        <SkipBack className="h-5 w-5" />
                      </button>
                      <button type="button" onClick={playPause} className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:bg-primary/90" aria-label={isPlaying ? "Pause" : "Play"}>
                        {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                      </button>
                      <button type="button" onClick={() => shiftBeat(1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white hover:border-primary/60" aria-label="Next beat">
                        <SkipForward className="h-5 w-5" />
                      </button>
                    </div>
                    <p className="mt-3 text-center text-[11px] uppercase tracking-wider text-white/40">
                      {beatIndex + 1} of {beats.length}
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : currentQuestion ? (
            <div key={currentQuestion.id} className="flex-1 animate-in fade-in slide-in-from-right-2 duration-500">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/55">
                <span className="text-primary"><Icon className="h-4 w-4" /></span>
                <span className="truncate">{currentQuestion.label}</span>
              </div>
              <h3
                className="truncate whitespace-nowrap font-black leading-tight text-white"
                style={{ fontSize: fitSize(currentQuestion.question_text, 1.5, 1) }}
                title={currentQuestion.question_text}
              >
                {currentQuestion.question_text}
              </h3>
              {currentQuestion.helper_text ? (
                <p className="mt-2 text-sm leading-relaxed text-white/55">{currentQuestion.helper_text}</p>
              ) : null}
              <div className="mt-5">
                <input
                  required={currentQuestion.is_required}
                  autoFocus
                  type={currentQuestion.input_type}
                  value={getAnswer(currentQuestion.id)}
                  onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
                  className="w-full rounded-lg border border-white bg-white px-4 py-4 text-base font-semibold text-black outline-none placeholder:text-black/35 focus:border-primary focus:ring-2 focus:ring-primary/35"
                  placeholder={currentQuestion.placeholder}
                />
              </div>
            </div>
          ) : null}

          {message ? (
            <p className={`mt-4 rounded-lg border px-3 py-2 text-sm ${message.type === "success" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-red-400/30 bg-red-400/10 text-red-100"}`}>
              {message.text}
            </p>
          ) : null}

          {!submitted ? (
            <div className="mt-5 flex gap-3">
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
                disabled={submitting || questionsQuery.isLoading}
                className="flex h-12 flex-1 items-center justify-center rounded-lg bg-primary px-5 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_35px_rgba(37,99,235,0.35)] transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : isBeatStep ? "Continue To My Beat" : "Continue"}
              </button>
            </div>
          ) : null}
        </form>

        {/* Progress bar at bottom */}
        {!submitted && totalSteps > 0 ? (
          <div className="shrink-0 border-t border-white/10 bg-black/40 px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-1 gap-1.5">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition ${i <= step ? "bg-primary" : "bg-white/15"}`}
                  />
                ))}
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/45">
                {step + 1} / {totalSteps}
              </span>
            </div>
          </div>
        ) : null}

        <audio ref={audioRef} className="hidden" />
      </div>
    </div>
  );
}
