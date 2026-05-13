import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Play, Pause, Download, DollarSign, Heart, Music2, ExternalLink, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/artist/$username")({
  head: ({ params }) => ({
    meta: [{ title: `${params.username} — MyBeatCatalog` }],
  }),
  component: ArtistStorePage,
});

type Track = {
  id: string;
  title: string;
  stream_url: string;
  download_url: string;
  duration: string;
};

type StoreProfile = {
  store_name: string | null;
  store_bio: string | null;
  store_artwork_url: string | null;
  store_tracks: Track[];
  store_buy_url: string | null;
  store_donate_url: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

function ArtistStorePage() {
  const { username } = Route.useParams();
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    (supabase as any)
      .from("profiles")
      .select("store_name, store_bio, store_artwork_url, store_tracks, store_buy_url, store_donate_url, display_name, avatar_url")
      .eq("store_username", username)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setNotFound(true); }
        else { setProfile({ ...data, store_tracks: (data.store_tracks as Track[]) ?? [] }); }
        setLoading(false);
      });
  }, [username]);

  function togglePlay(track: Track) {
    if (!track.stream_url) return;

    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(track.stream_url);
    audioRef.current = audio;
    audio.play().catch(() => {
      // If direct audio fails, open the URL in a new tab
      window.open(track.stream_url, "_blank", "noopener,noreferrer");
    });
    audio.onended = () => setPlayingId(null);
    setPlayingId(track.id);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-6">
        <Music2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-black">Artist not found</h1>
        <p className="text-muted-foreground mt-2">This store doesn't exist or the link may have changed.</p>
        <Button variant="hero" className="mt-6" asChild>
          <Link to="/">Back to MyBeatCatalog</Link>
        </Button>
      </div>
    );
  }

  const artistName = profile.store_name || profile.display_name || username;
  const tracks = profile.store_tracks ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border/40 backdrop-blur bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/" className="text-xs font-bold tracking-wider text-muted-foreground hover:text-foreground transition-colors">
            MyBeatCatalog
          </Link>
          <Button variant="heroOutline" size="sm" asChild>
            <a href="/#pricing">Apply For Access</a>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-3xl">

        {/* Artist Hero */}
        <div className="flex flex-col sm:flex-row gap-8 items-start mb-12">
          {/* Artwork */}
          <div className="shrink-0">
            {profile.store_artwork_url ? (
              <img
                src={profile.store_artwork_url}
                alt={artistName}
                className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl object-cover border border-border shadow-[var(--shadow-card)]"
              />
            ) : profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={artistName}
                className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl object-cover border border-border"
              />
            ) : (
              <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Music2 className="h-14 w-14 text-primary" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold tracking-widest text-primary uppercase mb-2">Artist</p>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none">{artistName}</h1>
            {profile.store_bio && (
              <p className="mt-4 text-muted-foreground leading-relaxed text-sm max-w-md">{profile.store_bio}</p>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-3 mt-6">
              {profile.store_buy_url && (
                <Button variant="hero" asChild>
                  <a href={profile.store_buy_url} target="_blank" rel="noopener noreferrer">
                    <DollarSign className="h-4 w-4 mr-2" /> Buy Now
                  </a>
                </Button>
              )}
              {profile.store_donate_url && (
                <Button variant="heroOutline" asChild>
                  <a href={profile.store_donate_url} target="_blank" rel="noopener noreferrer">
                    <Heart className="h-4 w-4 mr-2" /> Support
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tracks */}
        {tracks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Tracks</h2>
              <span className="text-xs text-muted-foreground">{tracks.length} track{tracks.length !== 1 ? "s" : ""}</span>
            </div>

            <div className="rounded-2xl border border-border overflow-hidden">
              {tracks.map((track, i) => {
                const isPlaying = playingId === track.id;
                const hasStream = !!track.stream_url;
                const hasDownload = !!track.download_url;

                return (
                  <div
                    key={track.id}
                    className={`flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0 transition-colors ${isPlaying ? "bg-primary/5" : "hover:bg-muted/20"}`}
                  >
                    {/* Track number / play */}
                    <button
                      onClick={() => hasStream && togglePlay(track)}
                      disabled={!hasStream}
                      className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors shrink-0 ${hasStream ? "hover:bg-primary/20 text-primary cursor-pointer" : "text-muted-foreground cursor-default"}`}
                    >
                      {isPlaying
                        ? <Pause className="h-4 w-4" />
                        : hasStream
                          ? <Play className="h-4 w-4" />
                          : <span className="text-xs font-medium">{i + 1}</span>
                      }
                    </button>

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm truncate ${isPlaying ? "text-primary" : ""}`}>
                        {track.title || `Track ${i + 1}`}
                      </p>
                      {isPlaying && (
                        <p className="text-xs text-primary/70 mt-0.5">Now playing</p>
                      )}
                    </div>

                    {/* Duration */}
                    {track.duration && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Clock className="h-3 w-3" />
                        {track.duration}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {hasStream && (
                        <a
                          href={track.stream_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Open stream"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      {hasDownload && (
                        <a
                          href={track.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tracks.length === 0 && (
          <div className="text-center py-16 rounded-2xl border border-dashed border-border">
            <Music2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No tracks added yet.</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            Powered by{" "}
            <Link to="/" className="text-primary font-medium hover:underline">
              MyBeatCatalog
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
