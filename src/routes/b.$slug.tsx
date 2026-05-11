import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getFunnelBySlug, submitFunnelLead } from "@/lib/funnels.functions";
import { KrazyLogo } from "@/components/krazy-logo";

export const Route = createFileRoute("/b/$slug")({
  loader: async ({ params }) => {
    const result = await getFunnelBySlug({ data: { slug: params.slug } });
    return result;
  },
  head: ({ loaderData }) => {
    const f = loaderData?.funnel;
    return {
      meta: [
        { title: f ? `${f.title} — Free Beat by KRAZYJAY` : "Beat — KRAZYJAYDOTCOM" },
        { name: "description", content: f?.headline ?? "Get the beat free. Then unlock the full catalog." },
      ],
    };
  },
  component: BeatLandingPage,
});

function toEmbedUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    // Loom
    if (u.hostname.includes("loom.com") && u.pathname.startsWith("/share/")) {
      return `https://www.loom.com/embed/${u.pathname.replace("/share/", "")}`;
    }
    // Vimeo
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  } catch {
    return null;
  }
}

function BeatLandingPage() {
  const { funnel } = Route.useLoaderData();
  const submit = useServerFn(submitFunnelLead);
  const navigate = useNavigate();
  const params = Route.useParams();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!funnel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Beat not found</h1>
          <p className="mt-2 text-muted-foreground">This link is no longer active.</p>
          <Link to="/" className="mt-4 inline-block text-primary hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const embed = toEmbedUrl(funnel.video_url);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const trimmed = email.trim().toLowerCase();
    const res = await submit({ data: { slug: params.slug, email: trimmed } });
    if (!res.ok) {
      setError(res.error ?? "Something went wrong. Please try again.");
      setBusy(false);
      return;
    }
    navigate({
      to: "/b/$slug/offer",
      params: { slug: params.slug },
      search: { e: trimmed, t: res.captured_at ?? new Date().toISOString() },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <KrazyLogo className="text-xl" />
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 max-w-3xl">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold tracking-wider text-primary">
            FREE BEAT
          </span>
          <h1 className="mt-4 text-4xl md:text-5xl font-black tracking-tight">{funnel.title}</h1>
          {funnel.headline && (
            <p className="mt-3 text-lg text-muted-foreground">{funnel.headline}</p>
          )}
        </div>

        {(funnel.audio_url || funnel.cover_url) && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
            {funnel.cover_url && (
              <img
                src={funnel.cover_url}
                alt={funnel.title}
                className="h-20 w-20 rounded-xl object-cover"
              />
            )}
            <div className="flex-1">
              <p className="font-semibold">{funnel.beat_title ?? funnel.title}</p>
              <p className="text-xs text-muted-foreground">Tagged preview</p>
              {funnel.audio_url && (
                <audio src={funnel.audio_url} controls className="mt-2 w-full" preload="none" />
              )}
            </div>
          </div>
        )}

        {embed && (
          <div className="mt-8 rounded-2xl overflow-hidden border border-border bg-black aspect-video">
            <iframe
              src={embed}
              title="Watch this first"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-8 rounded-2xl border border-primary/40 bg-card p-6 shadow-[var(--shadow-glow)]">
          <h2 className="text-2xl font-bold text-center">Enter your email to get the beat</h2>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            We'll send the download link straight to your inbox.
          </p>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={busy}
            className="mt-5 w-full rounded-md border border-border bg-background px-4 py-3 text-base"
          />
          <Button type="submit" variant="hero" size="lg" className="mt-4 w-full" disabled={busy}>
            {busy ? "Sending..." : "Send me the beat"}
          </Button>
          {error && <p className="mt-3 text-sm text-destructive text-center">{error}</p>}
          <p className="mt-3 text-[11px] text-muted-foreground text-center">
            By submitting, you agree to receive emails from KRAZYJAYDOTCOM. Unsubscribe anytime.
          </p>
        </form>
      </main>
    </div>
  );
}
