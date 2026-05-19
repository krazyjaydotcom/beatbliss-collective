import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, Sparkles, Waves } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { KrazyLogo } from "@/components/krazy-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BeatClaimModal, type ClaimableBeatLite } from "@/components/beat-claim-modal";

type SeoPage = {
  slug: string;
  target_keyword: string;
  seo_title: string;
  meta_description: string;
  h1: string;
  intro: string;
  sections: Array<{ heading: string; body: string }>;
  tag_slugs: string[];
  related_page_slugs: string[];
};

type SeoBeat = {
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
  is_featured: boolean;
  tag_slugs: string[];
};

type RelatedPage = { slug: string; h1: string; target_keyword: string };

const SITE = "https://mybeatcatalog.com";

export const Route = createFileRoute("/beats/$slug")({
  loader: async ({ params }) => {
    const { data: page, error } = await (supabase as any)
      .from("seo_pages")
      .select("slug,target_keyword,seo_title,meta_description,h1,intro,sections,tag_slugs,related_page_slugs")
      .eq("slug", params.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw error;
    if (!page) throw notFound();

    const [{ data: beats }, { data: related }] = await Promise.all([
      (supabase as any).rpc("list_beats_by_tags", { _slugs: page.tag_slugs }),
      (supabase as any)
        .from("seo_pages")
        .select("slug,h1,target_keyword")
        .in("slug", page.related_page_slugs?.length ? page.related_page_slugs : ["__none__"])
        .eq("is_published", true),
    ]);

    return {
      page: page as SeoPage,
      beats: (beats ?? []) as SeoBeat[],
      related: (related ?? []) as RelatedPage[],
    };
  },
  head: ({ loaderData, params }) => {
    const p = loaderData?.page;
    const url = `${SITE}/beats/${params.slug}`;
    return {
      meta: [
        { title: p?.seo_title ?? "Beats — MYBEATCATALOG" },
        { name: "description", content: p?.meta_description ?? "Premium beats and instrumentals." },
        { property: "og:title", content: p?.seo_title ?? "Beats — MYBEATCATALOG" },
        { property: "og:description", content: p?.meta_description ?? "Premium beats and instrumentals." },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: p
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: p.h1,
                description: p.meta_description,
                mainEntityOfPage: url,
                author: { "@type": "Organization", name: "MYBEATCATALOG" },
              }),
            },
          ]
        : [],
    };
  },
  component: SeoBeatsPage,
});

function formatDuration(seconds: number | null | undefined) {
  const total = Math.max(0, Number(seconds ?? 0));
  if (!total) return "--:--";
  const min = Math.floor(total / 60);
  const sec = Math.floor(total % 60);
  return String(min).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
}

function SeoBeatsPage() {
  const { page, beats, related } = Route.useLoaderData() as {
    page: SeoPage;
    beats: SeoBeat[];
    related: RelatedPage[];
  };
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playingId, setPlayingId] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [modalBeat, setModalBeat] = useState<ClaimableBeatLite | null>(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnd = () => setIsPlaying(false);
    a.addEventListener("ended", onEnd);
    return () => a.removeEventListener("ended", onEnd);
  }, []);

  function togglePlay(beat: SeoBeat) {
    const a = audioRef.current;
    if (!a) return;
    const src = beat.audio_url_tagged || beat.audio_url || "";
    if (!src) return;
    if (playingId === beat.id && isPlaying) {
      a.pause();
      setIsPlaying(false);
      return;
    }
    if (playingId !== beat.id) {
      a.src = src;
      a.load();
      setPlayingId(beat.id);
    }
    setIsPlaying(true);
    setTimeout(() => a.play().catch(() => setIsPlaying(false)), 0);
  }

  return (
    <div className="min-h-screen bg-[#02060a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.16),transparent_36%),linear-gradient(180deg,rgba(2,6,10,0.2),#02060a_72%)]" />
      <div className="relative min-h-screen">
        <header className="border-b border-white/10">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
            <Link to="/" aria-label="MYBEATCATALOG home">
              <KrazyLogo className="text-2xl" />
            </Link>
            <Link
              to="/beat-claim"
              className="hidden items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white md:flex"
            >
              <Waves className="h-5 w-5 text-primary" /> Browse All Beats
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8 pb-16 sm:px-5">
          <article>
            <header className="text-center">
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                {page.target_keyword}
              </Badge>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">{page.h1}</h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm text-white/65 sm:text-base">{page.intro}</p>
            </header>

            <section className="mt-8" aria-labelledby="beats-heading">
              <div className="mb-4 flex items-center justify-between">
                <h2 id="beats-heading" className="text-xl font-black uppercase tracking-tight">
                  Available Beats
                </h2>
                <span className="text-xs text-white/45">{beats.length} ready</span>
              </div>

              {beats.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center text-sm text-white/55">
                  <Sparkles className="mx-auto mb-3 h-6 w-6 text-primary" />
                  No beats are tagged for this page yet. Check back soon, or
                  <Link to="/beat-claim" className="ml-1 text-primary underline">
                    browse the full catalog
                  </Link>
                  .
                </div>
              ) : (
                <ul className="grid gap-3">
                  {beats.map((beat) => {
                    const active = playingId === beat.id && isPlaying;
                    return (
                      <li
                        key={beat.id}
                        className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-primary/40 sm:flex-row sm:items-center"
                      >
                        <button
                          type="button"
                          onClick={() => togglePlay(beat)}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/25 text-white transition hover:border-primary hover:text-primary"
                          aria-label={(active ? "Pause " : "Play ") + beat.title}
                        >
                          {active ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-base font-bold">{beat.title}</p>
                            {beat.is_featured ? (
                              <Badge className="bg-primary/20 text-primary">Featured</Badge>
                            ) : null}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/55">
                            {beat.bpm ? <span>{beat.bpm} BPM</span> : null}
                            {beat.duration_seconds ? <span>{formatDuration(beat.duration_seconds)}</span> : null}
                            {beat.tag_slugs.slice(0, 4).map((t) => (
                              <span
                                key={t}
                                className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/55"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="hero"
                          className="sm:w-auto"
                          onClick={() =>
                            setModalBeat({
                              id: beat.id,
                              title: beat.title,
                              genre: beat.genre,
                              mood: beat.mood,
                              duration_seconds: beat.duration_seconds,
                            })
                          }
                        >
                          Select This Beat
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <div className="mt-12 space-y-8">
              {page.sections.map((s, i) => (
                <section key={i}>
                  <h2 className="text-xl font-black uppercase tracking-tight sm:text-2xl">{s.heading}</h2>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/70 sm:text-base">
                    {s.body}
                  </p>
                </section>
              ))}
            </div>

            {related.length > 0 ? (
              <section className="mt-12 rounded-2xl border border-white/10 bg-white/[0.025] p-6">
                <h2 className="text-lg font-black uppercase tracking-tight">Related beat styles</h2>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <Link
                        to="/beats/$slug"
                        params={{ slug: r.slug }}
                        className="block rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
                      >
                        {r.h1}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="mt-10 text-center">
              <Link
                to="/beat-claim"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                Browse the full catalog →
              </Link>
            </div>
          </article>
        </main>
      </div>

      <audio ref={audioRef} preload="metadata" />
      <BeatClaimModal
        beat={modalBeat}
        open={!!modalBeat}
        onClose={() => setModalBeat(null)}
        source={`seo:${page.slug}`}
      />
    </div>
  );
}
